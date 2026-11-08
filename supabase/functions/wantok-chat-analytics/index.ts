import { createClient } from "npm:@supabase/supabase-js@2";
import { createAnalyticsHandler } from "./handler.js";

Deno.serve(createAnalyticsHandler({
  env: (name: string) => Deno.env.get(name),
  createClient
}));
