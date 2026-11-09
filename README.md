# Jstaroma_Technnologies

## Cloudflare Workers static build

The existing Worker is **`jstaroma-technologies`**. Root
[`wrangler.jsonc`](wrangler.jsonc) configures `assets.directory: "./dist"`;
there is no Worker script or `main` entry point. This fixes Wrangler's
“Missing entry-point to Worker script or to assets directory” error.

Build with Node.js 20 or later (no package installation required):

```sh
node scripts/build-static.mjs
```

[`scripts/build-static.mjs`](scripts/build-static.mjs) uses an explicit
reviewable allowlist, preserves original URL paths and file contents, checks
local HTML/CSS/module dependencies and map coverage, rejects symlinks and
recognizable secrets, and replaces only its generated `dist/` directory.
Add any new local public asset to `PUBLIC_FILES` before publishing it.
The current inventory includes all 15 HTML pages, root/shared CSS and JS,
admin CSS/JS, both PNG/world GeoJSON files, boundary-source metadata, Slides
and GIS pages, and exactly these public Supabase modules:

- `supabase/functions/shared/wantok-chat-contract.js`
- `supabase/functions/shared/wantok-platform.js`

There are no checked-in image/font files. Existing images loaded from
Supabase/public content and external Google Fonts/Font Awesome resources
remain external; the build does not download or rewrite them.

The repository root is **never** the upload directory. SQL, private Edge
Function handlers, TypeScript entry points, secrets/environment files,
credentials, tests, git metadata, editor settings, Supabase temporary files
and documentation are excluded. Only the existing website publishable
Supabase key belongs in public code; server credentials never do.
Pattern scanning is an additional guard, not proof against every possible
secret format: review allowlist changes and uploaded files before release.

### Cloudflare dashboard build settings

In **Workers & Pages > jstaroma-technologies > Settings > Builds**:

| Setting | Value |
|---|---|
| Root directory | Repository root (leave blank or use `/`, according to the UI) |
| Build command | `node scripts/build-static.mjs` |
| Deploy command | `npx wrangler deploy` |
| Non-production/preview command | `npx wrangler versions upload` |

The existing preview command can remain unchanged: Wrangler now discovers
the root configuration and uploads **only `dist/`**, which must be created by
the build step first. Do not set the build root to `dist/`, upload the entire
repository, or point the dashboard at a different Worker name. Keep the
existing domain/routes and Cloudflare build authentication in the dashboard,
not source code. `CNAME` is GitHub Pages metadata and is not uploaded;
Cloudflare's configured custom domain continues to control routing.

`html_handling: "auto-trailing-slash"` resolves directory `index.html`
routes such as `/privacy/` as well as the existing `.html` links and admin
auth redirects. Cloudflare may canonicalize `.html` requests to extensionless
URLs; the original files, link targets and relative asset paths remain valid.
Missing files use a real 404, not an SPA fallback that masks broken
module paths. No Supabase project, database or deployed Edge Function needs
to change. These commands describe deployment steps only; they do not imply
deployment or approval to merge a pull request.

### Static build and regression checks

```sh
node scripts/build-static.mjs
node --test scripts/tests/*.test.mjs
node --experimental-vm-modules --test admin/js/tests/*.test.cjs
# Validate Wrangler packaging locally without deploying:
npx wrangler deploy --dry-run
# Optional local preview:
npx wrangler dev --local
```

For an automated URL check, run `npx wrangler dev --local --ip 127.0.0.1
--port 8791` in one terminal and
`node scripts/tests/verify-static-http.mjs http://127.0.0.1:8791` in another.
It compares every public response with the built bytes, checks directory
pages and confirms private/missing URLs return 404. Stop the preview after
testing. This check accepts localhost only and never contacts production.

Build tests verify byte-identical/reproducible output, original pages and
Wantok dependencies, private-file exclusion, missing-link failures, secret
rejection and symlink protection. `dist/` is gitignored. Local preview should
resolve `/`, `/products.html`, `/achievements.html`, `/privacy/`, `/terms/`,
`/account-deletion/`, `/child-safety/`, `/jstaroma-slides/`,
`/jstaroma-slides/gis-maps/`, every `/admin/*.html` page, admin map files and
both `/supabase/functions/shared/*.js` dependencies. Auth and live analytics
still require their existing Supabase configuration and allowed website
origins; the static build never bypasses authorization.

## Wantok Chat Analytics

**Admin > Wantok Chat** reuses the existing login, `admins` membership check,
sidebar and shared styles. The platform adds section navigation, interactive
world/PNG boundary maps, date filters, registration/message/call charts,
aggregate CSV exports and an investor summary view without replacing existing
admin functionality. The prepared base integration connects registered
accounts, visible-message records, all call records and groups. The reviewed
range SQL adds period registrations, message types, audio/video call counts
and daily event series. MAU, DAU,
both growth charts and day 1/7/30 retention remain **Not connected**.
Refresh clears old values before loading; failures
show an explicit error, not fabricated counts. `null` means **Not connected**,
not zero. Zero is displayed only when supplied by a verified aggregate source.

### Platform increment and honest availability

- **Overview:** existing totals plus online users, new registrations, monthly
  growth, total audio/video call records and crash-free sessions.
- **Geography:** real zoomable/pannable SVG maps with keyboard selection.
  The PNG map, bar chart and directory show current profile province counts
  when the separate Wantok RPC is installed; zero and unknown locations are
  included. The country map remains disconnected. These are profile counts,
  not app activity or historical growth, and do not follow the date filter.
- **Growth:** daily, Monday-UTC weekly and calendar-month registration charts.
  Partial buckets include only selected dates. Registration series describe
  surviving accounts, not historical total-account growth. Pie chart legends
  identify each nonzero slice and its share; hover over a slice, bar or line
  interval for its chart name and value. The chart values table also lists zero
  intervals. The legacy
  account-total chart, DAU/MAU trends, returning/inactive users, monthly growth
  rate and retention stay disconnected without proper app activity/history.
- **Engagement:** selected-period text, audio-message/voice-note and
  image-message/photo counts; daily visible-message and call-record charts;
  period and current-total audio/video calls across all statuses. Unknown
  message/call types remain in base/period totals but not typed buckets.
  Missed calls stay disconnected until the exact status column is verified;
  completed calls and duration stay disconnected until app semantics are
  verified. Messages/calls are never app-active-user metrics.
- **Performance/devices, infrastructure/finance, trust/safety:** dedicated
  sections and per-metric source coverage, with unavailable states rather
  than invented provider results. Currency and profitability are not assumed.
- **Controls:** 7/30/90 complete UTC days or custom 1-366 days; Apply sends
  bounded dates through the admin-authorized backend. Refresh clears previous
  figures and disables export until a valid snapshot returns. Empty verified
  periods show real zeros and empty-state messages. Investor mode hides
  detailed sections, not source/availability caveats. CSV contains only
  whitelisted aggregate numbers, source definitions, dates and unavailable
  markers; formula-prefixed text is escaped.

Provider integrations are **prepared interfaces/source requirements, not
implemented live API adapters**. No provider account, credentials, country
export or moderation/financial schema has been
verified. Server contract v3 rejects values for these unverified sources
instead of accepting success-shaped placeholders.

### Geographic boundaries and privacy

[`admin/data/boundary-sources.json`](admin/data/boundary-sources.json) records
exact download URLs, revisions, licenses and provenance:

- World: Natural Earth 5.1.2 Admin-0, public domain, generalized 1:110m
  GeoJSON (177 features). Small countries/territories can lack polygons.
- PNG: National Statistics Office / OCHA ROAP through geoBoundaries,
  `PNG-ADM1-602756`, represented year 2019, revision `9469f09`, upstream
  simplified GeoJSON, **CC BY 3.0 IGO**. All 22 provinces are tested, including
  Jiwaka, Hela, Morobe, both Highlands provinces, NCD and Bougainville.
  Attribution is displayed beside the map; source geometry is unmodified.
  Boundaries are genuine but generalized, not surveying data or an assertion
  that no administrative change has occurred since the represented year.

No remote map tiles, map SDK, location lookup or telemetry receives the
administrator's token or any Wantok records. Boundary coordinates describe
public administrative polygons, never an individual user's GPS position.
Keep the two GeoJSON files in the published static site; they are about
2.3 MB combined. A boundary failure is independent of metric loading and
shows an explicit map error with reload instructions.

The user explicitly approved an exception for **exact province counts in the
authenticated administrator dashboard**, including buckets below 10. The
existing `protectGeography` 10-user whole-distribution suppression rule
remains in place for other geographic uses; do not expose this privileged
province aggregate publicly or reuse it for public reports or exports.
Repeated admin refreshes can reveal changes in small groups. This exception
does not authorize filtering by date, region or device.

The fixed province RPC counts distinct `profiles.id` and verifies that it is
the primary key and a foreign key to `auth.users.id` before installation.
It normalizes approved province names/aliases and counts null, blank and
unrecognized values as Unknown. It never infers a province from coordinates,
phone numbers, city or profile existence. Country counts must come from a separately verified
Firebase Analytics (or equivalent) country aggregate, with a documented
active-user definition and Unknown category; they are not automatically
registered-account counts.

To enable province counts, review and run
[`20261109_admin_province_analytics.sql`](supabase/wantok-chat/sql/20261109_admin_province_analytics.sql)
in the **Wantok** project's SQL Editor, not the Jstaroma project. It checks
the schema, installs a read-only security-invoker RPC and grants execution only
to `service_role`; it does not change RLS or Flutter. Deploy the updated
Jstaroma `wantok-chat-analytics` Edge Function and static dashboard using the
existing deployment process. Both projects' existing server configuration and
`WANTOK_ANALYTICS_VERIFIED=true` are required. Until the RPC is installed,
the dashboard explicitly reports province data unavailable while preserving
other analytics. No credentials or individual profile records are sent to the
browser. Verify live counts with an authorized admin after deployment.
The open dashboard fetches fresh server aggregates on initial load, every
60 seconds while visible, and when the tab becomes active again. Polling
pauses in hidden tabs and stops on page exit or logout; restored pages resume
polling. Concurrent refresh requests are skipped. Each request still verifies
administrator membership and uses the existing approved province privacy
policy. Once this frontend/backend integration is deployed, changes in
Supabase counts appear on refresh without another website redeployment.
Cloudflare's `_headers` file makes admin CSS and JavaScript plus shared
analytics modules revalidate instead of retaining stale assets. Versioned
admin stylesheet URLs also force clients to request the current shared style.
Already-open tabs still need one hard refresh after a code deployment.
The dashboard distinguishes HTTP 400 (filter), 401 (session), 403
(administrator/origin), 404 (missing endpoint), 500/503 (backend), successful
responses with invalid contracts, and rendering errors. Error messages and
logs do not expose upstream payloads, credentials or profile records.

### External integration prerequisites (not connected)

| Source | Required verification before adding a read-only server adapter |
|---|---|
| Firebase Analytics | Wantok Firebase project identifier, aggregate export/report schema, app-active event definition, timezone, stable country codes, coverage, privacy-safe Unknown and suppressed groups |
| Firebase Crashlytics | Aggregate session/crash export, crash-free session denominator, app version/timezone, retention and privacy rules; not raw crash traces or user IDs |
| Firebase Performance | Approved aggregate startup/network metrics, trace names, units, time window and sample coverage |
| Google Play Console | Wantok package ID, authorized service account/report access, installation vs acquisition definitions, Android/app/device dimensions, reporting delay |
| Supabase / LiveKit | Wantok resource/project identity, scoped read-only usage/billing exports, units, timezone and attribution; never query Jstaroma infrastructure as Wantok |
| Finance | Reconciled revenue/expense ledger, currency, tax, accounting period and profitability definition; no account/payment identifiers |
| Trust and safety | Verified report/block/moderation/incident tables, event vs outstanding counts, statuses, UTC timestamps and small-group disclosure review |

Any future credentials belong only in Jstaroma Edge Function secrets and must
be scoped to Wantok's provider resources. Do not add secret placeholders to
frontend code or enable a provider on the basis of an unverified export.
Keep app-active MAU/DAU/presence separate from chat-only events.

### Verified sources and metric definitions

| Project | Reference | Purpose |
|---|---|---|
| Jstaroma Technologies | `fticsjeytmepljtkfrvm` | Existing admin Auth, `public.admins`, Edge Function |
| Wantok Chat | `patrtlxmcjrzzfvvfcft` | Read-only aggregate RPC and separate server credential |

The backend accepts only the canonical URLs for these two references; swapped
projects, different projects, aliases and non-HTTPS URLs fail closed.

| Dashboard metric | Prepared source/meaning |
|---|---|
| Registered users | `count(*)` from Wantok `auth.users`: all currently stored accounts, including unconfirmed/anonymous accounts if present |
| Messages | Currently stored `public.messages` rows where `message_type IS DISTINCT FROM 'call'` and `wantok_deleted_for_everyone IS NOT TRUE` |
| Calls | `count(*)` from `public.calls`, all statuses/types; **not** completed calls |
| Groups | `count(*)` from `public.groups`: all currently stored group rows |
| MAU / DAU | `null`: message senders and `wantok_user_chat_activity.updated_at` are not verified app-active users |
| Growth / retention | `null`: historical account totals/deletions and mature app-return cohorts are not verified |

These are **current stored-record totals**, as selected, not lifetime event
counts or activity-window counts. Hard-deleted rows are absent; null message
types/deletion flags remain included unless explicitly marked call/deleted.
`wantok_deleted_at` alone is not used to infer global deletion. No message
contents, sender IDs, profiles or activity records are selected or returned.
`profiles` does not determine account counts. Known registration dates alone
cannot recreate historical totals once accounts have been deleted.

The reference period is the last 30 complete UTC days, inclusive, derived
from one database statement timestamp. It is informational for future activity
tracking; current totals are **not** restricted to that period. Timestamp
columns and observed call statuses do not establish completed-call semantics
or proper app activity tracking, so neither is inferred.

### Deployment plan - review first; do not execute until approved

The website remains on its existing Supabase project. Deploy
[`wantok-chat-analytics`](supabase/functions/wantok-chat-analytics/index.ts)
to **Jstaroma's project**, never Wantok's. Every POST is authenticated using
Jstaroma `auth.getUser(token)`, then server-side `public.admins` membership.
Only after both succeed can the function contact Wantok. Browser checks and
CORS alone are not authorization. The function uses its Jstaroma server key
for the membership lookup, so client RLS cannot accidentally grant access.

No production database changes, secrets configuration or deployment have been
performed. The following steps are exact commands/manual actions for approval.

1. In the Supabase Dashboard, select **Wantok Chat,
   `patrtlxmcjrzzfvvfcft`**, confirm the project reference in the URL/settings,
   and review/run
   [`20261108_admin_analytics.sql`](supabase/wantok-chat/sql/20261108_admin_analytics.sql)
   in **that project's SQL Editor only**. It is intentionally outside
   `supabase/migrations`; do not copy it there, run it on Jstaroma, or use
   Jstaroma `supabase db push` to install it. The schema guard fails on missing
   Wantok tables/types but is not a substitute for verifying the project ID.

   The SQL creates/replaces only the no-argument aggregate RPC, adjusts its
   permissions and grants the server role the minimal SELECT columns needed
   by this query. It performs no inserts/updates/deletes on application tables
   and changes no RLS policies, existing rows or activity tracking. It uses
   `STABLE`, `SECURITY INVOKER`, an empty fixed `search_path` and qualified
   table names. It removes previous explicit execution grants and grants
   `EXECUTE` only to `service_role` (the owner/superuser retains implicit
   control). Supabase's existing server role has RLS bypass and broad
   privileges; the script does not revoke its pre-existing table permissions.

2. Still in **Wantok**, review/run the read-only
   [`verify_admin_analytics.sql`](supabase/wantok-chat/sql/verify_admin_analytics.sql).
   It checks counts, null activity fields and denied `anon`/`authenticated`
   execution, then calls the RPC as `service_role` inside a read-only
   transaction. Confirm your other client roles have no inherited execution
   privileges. The counts are exact full-table scans: check latency at real
   production size; the Edge Function has a ten-second upstream timeout.

   **Platform addition:** review and install
   [`20261108_analytics_platform.sql`](supabase/wantok-chat/sql/20261108_analytics_platform.sql)
   in Wantok only, after the base SQL. It adds a separate
   `public.wantok_admin_analytics_range_v1(date,date)` RPC and only the needed
   read-column/execute grants; it leaves the original no-argument RPC intact.
   No app tracking, provider schemas, RLS policies or production rows are
   created/modified. Verify `messages.created_at` is `timestamptz` and
   `calls.call_type` is text; mismatches abort installation.
   Benchmark the aggregates at real scale and review existing UTC timestamp
   indexes/`EXPLAIN` plans before enabling. No indexes are installed
   automatically. Daily series scan/group each source once per selected
   range, rather than once for every day.

3. Retrieve **Wantok's** server secret key from its API settings. Prefer the
   newer `sb_secret_...` key; a legacy Wantok `service_role` JWT also works.
   The newer key is sent only as `apikey`, not as a JWT Bearer token.
   Both use the privileged `service_role` for this SQL. Never use a Wantok
   publishable/anon key or a Jstaroma key as `WANTOK_ANALYTICS_KEY`.

4. Prepare a private secrets file locally:

   ```sh
   mkdir -p "$HOME/.config/jstaroma"
   cp supabase/wantok-chat/edge-secrets.env.example "$HOME/.config/jstaroma/wantok-analytics.env"
   chmod 600 "$HOME/.config/jstaroma/wantok-analytics.env"
   ```

   Edit the copy in a trusted editor: replace only the placeholder
   `WANTOK_ANALYTICS_KEY` with Wantok's server key. Keep
   `WANTOK_ANALYTICS_VERIFIED=false` initially. Keep the private copy outside
   the repository/static website root so local web servers and publishing
   tools cannot expose it. Alternatively configure secrets through Jstaroma's
   Supabase Dashboard without creating a local credential file.
   Never put real credentials in the example, git, browser code, terminal
   command arguments/history, logs or documentation.

5. Apply secrets and deploy the function to **Jstaroma only**:

   ```sh
   supabase login
   supabase secrets set --env-file "$HOME/.config/jstaroma/wantok-analytics.env" --project-ref fticsjeytmepljtkfrvm
   supabase functions deploy wantok-chat-analytics --no-verify-jwt --project-ref fticsjeytmepljtkfrvm
   ```

   Set exact, comma-separated origins (scheme, hostname and port, no paths or
   trailing slashes). The example uses the website's configured
   `https://jstaromatechnologies.com` origin. Add other actual site origins
   only if served there. Include a localhost origin only when needed.
   Explicit project references avoid relying on whichever project is linked.
   The CLI bundles the handler and shared JavaScript contract. The shared
   [contract](supabase/functions/shared/wantok-chat-contract.js) must also remain
   available on the static website: the admin page imports it to validate
   responses. It contains no configuration or credentials. Its folder is named
   `shared` rather than `_shared` so default GitHub Pages/Jekyll publishing does
   not exclude the browser's dependency.

   Jstaroma's hosted Edge Function supplies `SUPABASE_URL` and
   `SUPABASE_SERVICE_ROLE_KEY` automatically. Do not change the website's
   [`js/supabase.js`](js/supabase.js), admin accounts, website tables or migrations.
   [`supabase/config.toml`](supabase/config.toml) disables the gateway's legacy
   JWT check **only for this function**; its handler verifies each token with
   Jstaroma Auth, supporting newer signing keys too.

6. Publish the updated static admin files and shared contract using your
   existing website publishing process. With verification disabled, authorized
   requests return a disconnected snapshot **without contacting Wantok**.
   Before deployment the page instead reports a backend loading error with
   no figures.

7. After the SQL smoke checks, authorization tests below and review approval,
   enable **Jstaroma's** backend:

   ```sh
   supabase secrets set WANTOK_ANALYTICS_VERIFIED=true --project-ref fticsjeytmepljtkfrvm
   ```

   Also update the private local file to `true` so a later upload does not
   accidentally disable the connection. Verify the four totals in the
   authenticated dashboard against Wantok's SQL results. With the range RPC,
   registration and engagement charts should match source aggregates.
   MAU/DAU, account-total growth, provider metrics and retention must still
   show **Not connected**, never message-derived app activity.
   Missing configuration, upstream failures, timeouts and invalid responses
   return HTTP 503, never fabricated/partial results.

8. Rollback the integration without touching either database:

   ```sh
   supabase secrets set WANTOK_ANALYTICS_VERIFIED=false --project-ref fticsjeytmepljtkfrvm
   ```

   Update the private file too. This blocks all Wantok requests and restores
   the disconnected state. Preserve SQL for review; rotate Wantok's server key
   if exposed and update Jstaroma's private secret copy.

### Required environment variables (Jstaroma Edge Function only)

| Variable | Required value |
|---|---|
| `SUPABASE_URL` | Automatically supplied by Jstaroma: `https://fticsjeytmepljtkfrvm.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Automatically supplied Jstaroma server key; never override with Wantok's key |
| `ANALYTICS_ALLOWED_ORIGINS` | `https://jstaromatechnologies.com`, plus any other actual exact origins, comma-separated |
| `WANTOK_SUPABASE_URL` | `https://patrtlxmcjrzzfvvfcft.supabase.co` |
| `WANTOK_ANALYTICS_KEY` | Wantok server secret key or legacy service-role JWT; stored only as a Jstaroma function secret |
| `WANTOK_ANALYTICS_VERIFIED` | `false` until approved/checked; exactly `true` to enable the prepared current-record RPC |

Do not configure any of these Wantok credentials in static frontend code.

The browser sends only its existing Jstaroma access token to the Jstaroma
function. It never receives Wantok credentials and never queries Wantok
directly. The fixed RPC, ten-second timeout, redirect rejection, `no-store`
responses and output whitelist limit the integration to aggregates. Error
responses/logs do not include upstream payloads or credentials.

### Prepared aggregate contract (version 2)

The existing fixed RPC path remains `public.wantok_admin_analytics_v1()` to
avoid changing the browser/backend endpoint. Its new JSON response declares
`version: 2` and `metric_scope: "current_records"`. It includes `generated_at`,
the reference `period`, all six `metrics` keys, and null `growth`/`retention`.
Registered users, messages, calls and groups are safe nonnegative integers
with the definitions above. MAU and DAU **must be null**.

Requests without `date_range` use this v2 shape and reject legacy activity
responses or any v2 response containing MAU/DAU, growth or retention values. Its whitelist
discards extra fields. The frontend understands v2 total-count labels.
The shared validator also retains legacy v1 chart/retention support to
preserve existing rendering and regression coverage; the prepared backend
does not accept that contract as a live source.

### Platform contract (version 3)

The frontend now sends `{ date_range: { start, end } }` to the **same Jstaroma
Edge Function**. The backend verifies Jstaroma Auth/admin membership first,
then validates at most 366 complete UTC days. It ignores table/project/key
fields and calls only the fixed Wantok `wantok_admin_analytics_range_v1`
RPC with `{ p_start, p_end }`. Invalid dates/JSON return HTTP 400 with an
explicit error. The response must match the exact requested period.

V3 preserves v2 current `metrics`, `metric_scope`, timestamps and null
`growth`/`retention`. It adds:

- `platform.metrics`: every key in the shared metric catalog, a nonnegative
  safe integer for verified registration/message/call aggregates or `null`.
  All unverified provider/app-activity metrics **must be null**.
- `platform.series`: `registrations`, `messages`, `calls`; null or one ordered
  `{ date, count }` entry per selected UTC day, including genuine zeros.
  Counts must sum to their corresponding period metric.
- `platform.geography`: the range RPC must return null for both fields. After
  authorization, the Edge Function separately fetches the fixed current
  province RPC and returns `{ status: "available", rows, total }`, or
  `{ status: "error" }` when that RPC fails; countries stay null.
- `platform.devices`: `null`.

Extra properties are stripped on the server. Malformed series, missing keys,
unsafe values, invalid periods, impossible subtotal sums, unexpected range-RPC
location payloads or invented provider results return HTTP 503; the browser
clears all values. Invalid province responses are reported separately without
discarding the other valid analytics.
The base no-range v2 interface and legacy v1 rendering tests remain intact.
The new frontend requires the reviewed range RPC; an older deployment shows
an explicit error rather than silently using unrelated totals for filters.

### Legacy aggregate contract (version 1, not enabled by this backend)

Return one JSON object (not an array of rows):

- `version`: `1`.
- `generated_at`: actual snapshot timestamp in ISO UTC format ending in `Z`.
- `period`: `{ start: "YYYY-MM-DD", end: "YYYY-MM-DD" }`, the last 30 complete
  UTC days, inclusive; `end` is the day before the snapshot's UTC date.
- `metrics`: all six keys `registered_users`, `mau`, `dau`, `messages`, `calls`,
  `groups`; each a nonnegative safe integer **or `null` if not verified**.
  Registered users = total registered accounts at snapshot time; groups =
  total existing groups. MAU = unique users performing a verified activity
  during the period; DAU = unique users performing that same activity on
  `end`. Messages = messages sent and calls = completed calls during the
  period. Document Wantok's specific activity event and exclusion/deletion
  rules before enabling a metric; do not infer activity from registration.
- `growth`: `null` if unverified, otherwise exactly 30 date-ordered objects,
  one per period day, each `{ date, registered_users, dau }`. Registered
  users is the account total at that day's end; DAU uses the same activity
  definition as above. Supply real zeros only where tracking confirms zero.
  Missing historical totals or activity tracking means `growth: null`.
- `retention`: `null` if unverified, otherwise three objects in day 1, 7, 30
  order, each `{ day, eligible_users, returning_users }`. Eligible users are
  registrations within the period whose exact UTC return day has fully
  elapsed; returning users are those active on that exact day using the same
  activity definition. Returning users cannot exceed eligible users.
  The UI calculates the rate; an empty eligible cohort shows **No eligible
  users**, not an invented percentage.

Unexpected fields are discarded by the server. Missing keys, negative or
noninteger counts, malformed dates, incomplete daily series and invalid
retention counts are rejected. A disconnected response contains null
timestamps, period, metrics, growth and retention; it is only returned after
successful Jstaroma authorization.

### Testing and deployment checks

Run all dependency-free admin regression tests:

```sh
node --experimental-vm-modules --test admin/js/tests/*.test.cjs
```

Type-check the Edge Function with Deno:

```sh
deno check --no-lock supabase/functions/wantok-chat-analytics/index.ts
```

Local SQL regression checks (Docker required; **synthetic local database
only**, no production URLs/credentials):

```sh
docker run --rm --name wantok-platform-sql-test --network none -d \
  -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17
docker exec wantok-platform-sql-test pg_isready -U postgres
# Wait until pg_isready reports accepting connections, then:
docker cp supabase/wantok-chat wantok-platform-sql-test:/tmp/wantok-chat
docker exec wantok-platform-sql-test psql -v ON_ERROR_STOP=1 -U postgres \
  -f /tmp/wantok-chat/tests/platform.sql
docker stop wantok-platform-sql-test
# Province tests create fixture roles, so use a separate fresh container.
docker run --rm -v "$PWD/supabase/wantok-chat:/tests:ro" postgres:17 bash -c \
  'install -d -o postgres -g postgres /tmp/pgdata /tmp/pgsocket && runuser -u postgres -- initdb -D /tmp/pgdata -A trust >/dev/null && runuser -u postgres -- pg_ctl -D /tmp/pgdata -o "-k /tmp/pgsocket" -w start >/dev/null && psql -h /tmp/pgsocket -U postgres -v ON_ERROR_STOP=1 -f /tests/tests/provinces.sql'
```

The fixture creates local roles/tables, installs both RPCs, reruns the range
SQL, and asserts UTC inclusions/exclusions, deleted/call message exclusions,
typed call/message counts, series totals, rejected ranges, RLS-bypass server
execution and denied client grants. Never run the fixture in a production
SQL Editor. The script uses fixed historical test dates; run after
2026-11-08 so all fixture days are complete.

Optional full Chromium UI checks (Playwright is test-only, not a production
dependency). Install it **outside the static website/repository**, then run:

```sh
npm install --prefix "$HOME/.cache/wantok-browser-test" --no-audit --no-fund playwright
npm exec --prefix "$HOME/.cache/wantok-browser-test" -- playwright install chromium
# If Chromium reports missing OS libraries:
npm exec --prefix "$HOME/.cache/wantok-browser-test" -- playwright install-deps chromium
PLAYWRIGHT_MODULE_PATH="$HOME/.cache/wantok-browser-test/node_modules/playwright" \
  node admin/js/tests/wantok-platform.browser.cjs
```

The browser test starts/stops its own localhost-only static/mock server,
blocks external page requests, replaces Auth/Supabase with synthetic
fixtures, and verifies map counts/keyboard selection/zoom, 7-day filtering,
chart intervals, CSV downloads, investor toggle, 390/768/1440-pixel layouts,
error/recovery clearing and signed-out gating. No real admin tokens,
providers, Supabase projects or production databases are contacted.

The Wantok tests exercise authorization ordering, revoked/non-admin access,
project separation, CORS, disconnected states, upstream failures, credential
handling, aggregate validation, output whitelisting and browser rendering.
They use mocks and do **not** prove a live connection is deployed. Test the
prepared SQL in an isolated PostgreSQL database with matching synthetic
tables/roles before approval, then run the supplied read-only smoke checks
in Wantok after approved installation.

After deployment:

1. Open the page signed out: confirm it redirects to the existing login.
2. Sign in as a Jstaroma admin: confirm navigation, logout, existing dashboard
   counts and project/product/achievement management still work.
3. With Wantok disabled, confirm every metric/chart/retention cell shows
   **Not connected**; refresh must not display zeros.
4. Call the Edge Function without a token, with an expired/Wantok token and
   with a Jstaroma non-admin token: expect 401/403 and no Wantok RPC call.
   Remove an admin's membership and verify their next request is denied.
5. With the prepared RPC enabled, compare the four totals against Wantok's
   database; check UTC reference dates, real zeros, excluded call-type/global
   deletion messages, inclusion of null flags/types and all call statuses.
   Confirm MAU/DAU, historical account-total growth and retention remain
   **Not connected**. Verify filtered registrations, typed messages/calls and
   event series after the platform SQL is approved and installed.
6. Break the upstream connection in a test environment: confirm an explicit
   error and cleared metrics, not stale/partial figures. Check narrow-screen
   layout, keyboard refresh, chart data tables and screen-reader status.
7. Inspect browser requests/source: only the existing website publishable
   key and current user's Jstaroma token may be visible, never server keys.

No live deployment or production SQL execution is performed by these changes.
The user supplied verified table/column definitions; no credentials or current
browser administrator session are read from this development environment.
Actual sessions are checked on every backend request after deployment.

## Project images and documents

Visitors can click a project image to open the full-size original in a new tab.
**View full project** includes **Download Image**, plus **View Document** and
**Download Document** when a document is attached. Existing project links remain
available.

Before deploying, apply
[`supabase/migrations/20261030_add_project_documents.sql`](supabase/migrations/20261030_add_project_documents.sql)
in Supabase. It adds optional document fields and a public `project-documents`
bucket with admin-only uploads/deletions and a 10 MB limit. Attached documents
are public files; do not upload confidential material, even to draft projects.

In **Admin > Projects**, use **Project Document** to attach one PDF or Word file
(`.pdf`, `.doc`, `.docx`). Leave it blank when editing to keep the current file,
choose another file to replace it, or select **Remove current document**.
Replaced/removed documents and deleted projects' documents are cleaned up from
storage. Failed database saves roll back new uploads and report errors.

## Project Play Store links

Before deploying the updated project pages, apply
[`supabase/migrations/20261026_add_project_play_store_link.sql`](supabase/migrations/20261026_add_project_play_store_link.sql)
to the site's Supabase database (using your migration workflow or the SQL Editor).
This adds the optional `projects.play_store_url` column without changing existing projects.

In **Admin > Projects**, paste an app's Google Play URL into **Google Play Store URL**
when adding or editing a project, then save it. For published projects, visitors
can select **View full project > Get it on Google Play** on the website.
Leaving the field blank hides the button; clearing it on an existing project removes
the link.

## Product Play Store links

Before deploying the updated product page, apply
[`supabase/migrations/20261027_add_product_play_store_link.sql`](supabase/migrations/20261027_add_product_play_store_link.sql)
to the site's Supabase database. This adds the optional `products.play_store_url`
column without changing existing products.

In **Admin > Products**, enter a product's Google Play URL in **Google Play Store URL**.
Published products with a URL show a **Download on Google Play** button; products
without one keep their existing contact action, and Wantok Chat continues to show
that its Play Store link is coming soon.

## Product lifecycle statuses

Before deploying product lifecycle statuses, apply
[`supabase/migrations/20261027_add_product_lifecycle_status.sql`](supabase/migrations/20261027_add_product_lifecycle_status.sql)
to the site's Supabase database. Existing products are assigned **Published** when
they have stock and **Coming Soon** otherwise.

In **Admin > Products**, choose **Coming Soon**, **In Progress**, **In Production**,
or **Published** in the Product Status field. This status is shown on the public
product card; the separate Published toggle still controls whether the product is
visible on the site.

Run the project link, image and document regression tests with Node.js (no dependencies required):

```sh
node --experimental-vm-modules --test admin/js/tests/project-links.test.cjs
```

## Admin content counts

The dashboard loads exact database counts for projects, achievements, and products
after admin authentication. Drafts are all records that are not published.
Product and achievement management pages load all result pages before calculating
their totals; search and filters do not change the overview counts. Failed loads
show an error rather than a zero or partial total.

Run the admin count regression tests with Node.js (no dependencies required):

```sh
node --experimental-vm-modules --test admin/js/tests/content-stats.test.cjs
```