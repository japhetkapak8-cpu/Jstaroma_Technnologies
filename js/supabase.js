import { createClient } from
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";


const SUPABASE_URL =
  "https://fticsjeytmepljtkfrvm.supabase.co";


const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_JHLwunp_dsj7vOvz5X32Fw_4b7oUYuj";


export const supabase =
  createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
  );