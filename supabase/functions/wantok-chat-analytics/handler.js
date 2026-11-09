import { disconnectedSnapshot, validateSnapshot } from "../shared/wantok-chat-contract.js";
import { validateRange, validateProvinceAggregate } from "../shared/wantok-platform.js";

const JSTAROMA_PROJECT_URL = "https://fticsjeytmepljtkfrvm.supabase.co";
const WANTOK_PROJECT_URL = "https://patrtlxmcjrzzfvvfcft.supabase.co";

function projectUrl(value) {
  if (!value) throw new Error("Missing project URL.");
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password ||
      url.pathname !== "/" || url.search || url.hash) throw new Error("Invalid project URL.");
  return url.origin;
}

export function createAnalyticsHandler({ env, createClient, fetchImpl = fetch, logger = console }) {
  return async request => {
    const origin = request.headers.get("Origin");
    const allowedOrigins = (env("ANALYTICS_ALLOWED_ORIGINS") || "").split(",")
      .map(value => value.trim()).filter(Boolean);
    const headers = {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Vary": "Origin"
    };
    const respond = (status, body) => new Response(JSON.stringify(body), { status, headers });
    if (!allowedOrigins.length) {
      logger.error("Wantok analytics: allowed origins not configured.");
      return respond(503, { error: "Analytics backend is not configured." });
    }
    if (origin && !allowedOrigins.includes(origin)) {
      return respond(403, { error: "Origin not allowed." });
    }
    if (origin) headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Headers"] = "authorization, apikey, content-type, x-client-info";
    headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (request.method !== "POST") return respond(405, { error: "Method not allowed." });
    const authorization = request.headers.get("Authorization");
    const token = authorization?.match(/^Bearer ([^\s]+)$/i)?.[1];
    if (!token) return respond(401, { error: "Jstaroma authentication required." });

    let stage = "Jstaroma configuration";
    try {
      const jstaromaUrl = projectUrl(env("SUPABASE_URL"));
      const jstaromaKey = env("SUPABASE_SERVICE_ROLE_KEY");
      if (jstaromaUrl !== JSTAROMA_PROJECT_URL || !jstaromaKey) {
        throw new Error("Invalid Jstaroma server configuration.");
      }
      const jstaroma = createClient(jstaromaUrl, jstaromaKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      });
      stage = "Jstaroma authentication";
      const { data, error } = await jstaroma.auth.getUser(token);
      if (error || !data?.user) return respond(401, { error: "Invalid Jstaroma session." });
      stage = "Jstaroma admin lookup";
      const { data: admin, error: adminError } = await jstaroma.from("admins")
        .select("user_id").eq("user_id", data.user.id).maybeSingle();
      if (adminError) throw new Error("Jstaroma admin authorization lookup failed.");
      if (!admin) return respond(403, { error: "Jstaroma administrator access required." });

      let range = null;
      try {
        const body = await request.text();
        if (body.length > 2048) throw new Error("Request too large.");
        const input = body ? JSON.parse(body) : {};
        if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid request.");
        if (Object.hasOwn(input, "date_range")) range = validateRange(input.date_range);
      }
      catch {
        logger.error("Wantok analytics: invalid date filter.");
        return respond(400, { error: "Invalid filter. Choose 1-366 complete UTC days ending before today." });
      }
      if (env("WANTOK_ANALYTICS_VERIFIED") !== "true") {
        return respond(200, disconnectedSnapshot());
      }
      stage = "Wantok configuration";
      const wantokUrl = projectUrl(env("WANTOK_SUPABASE_URL"));
      const wantokKey = env("WANTOK_ANALYTICS_KEY");
      if (!wantokKey || wantokUrl !== WANTOK_PROJECT_URL) {
        throw new Error("Invalid separate Wantok project configuration.");
      }
      // Only fixed aggregate RPCs and bounded UTC dates are accepted.
      stage = "Wantok aggregate request";
      const rpc = range ? "wantok_admin_analytics_range_v1" : "wantok_admin_analytics_v1";
      const upstream = await fetchImpl(`${wantokUrl}/rest/v1/rpc/${rpc}`, {
        method: "POST",
        headers: {
          apikey: wantokKey,
          ...(wantokKey.startsWith("sb_secret_") ? {} : { Authorization: `Bearer ${wantokKey}` }),
          "Content-Type": "application/json"
        },
        body: range ? JSON.stringify({ p_start: range.start, p_end: range.end }) : "{}",
        signal: AbortSignal.timeout(10000),
        redirect: "error"
      });
      if (!upstream.ok) {
        logger.error(`Wantok aggregate RPC returned HTTP ${upstream.status}.`);
        throw new Error("Wantok aggregate request failed.");
      }
      stage = "Wantok aggregate validation";
      const source = await upstream.json();
      if (range && source?.platform?.geography?.provinces !== null) {
        throw new Error("Unexpected province data in range snapshot.");
      }
      const snapshot = validateSnapshot(source);
      if (snapshot.version !== (range ? 3 : 2) || snapshot.generated_at === null ||
          (range && (snapshot.period.start !== range.start || snapshot.period.end !== range.end))) {
        throw new Error("Verified source returned the wrong aggregate contract or period.");
      }
      if (range) {
        try {
          const provinceResponse = await fetchImpl(`${wantokUrl}/rest/v1/rpc/wantok_admin_province_counts_v1`, {
            method: "POST",
            headers: {
              apikey: wantokKey,
              ...(wantokKey.startsWith("sb_secret_") ? {} : { Authorization: `Bearer ${wantokKey}` }),
              "Content-Type": "application/json"
            },
            body: "{}",
            signal: AbortSignal.timeout(10000),
            redirect: "error"
          });
          if (!provinceResponse.ok) {
            logger.error(`Wantok province RPC returned HTTP ${provinceResponse.status}.`);
            throw new Error("Province aggregate request failed.");
          }
          const aggregate = validateProvinceAggregate(await provinceResponse.json());
          snapshot.platform.geography.provinces = { status: "available", ...aggregate };
        }
        catch (error) {
          logger.error("Wantok province aggregate request failed.", error instanceof Error ? error.name : "UnknownError");
          snapshot.platform.geography.provinces = { status: "error" };
        }
      }
      return respond(200, snapshot);
    }
    catch (error) {
      // Do not log upstream payloads, tokens, URLs or keys.
      logger.error(`Wantok analytics request failed: ${stage}.`, error instanceof Error ? error.name : "UnknownError");
      return respond(503, { error: "Analytics unavailable. Check server configuration and aggregate source." });
    }
  };
}
