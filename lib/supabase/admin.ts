import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "./config";

// Used only to resolve a username to an Auth email, never to verify passwords.
export function createSupabaseAdminClient() {
  const config = supabaseConfig();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!config || !secret) return null;
  return createClient(config.url, secret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
