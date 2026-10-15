// Read-only setup check. Prints counts/status, never credentials or record data.
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

nextEnv.loadEnvConfig(process.cwd());
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const secret = process.env.SUPABASE_SECRET_KEY?.trim();
if (!url || !secret) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env to run this read-only setup check.");
  process.exit(1);
}
const client = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
let failed = false;
for (const table of ["register_members", "register_settings", "register_options", "proposals"]) {
  const { count, error } = await client.from(table).select("*", { count: "exact" }).limit(1);
  if (error || count === null) {
    console.error(`${table}: unavailable (${error?.code || "connection error"}). Check credentials/network and run setup.sql, then cloud-storage.sql.`);
    failed = true;
  } else {
    console.log(`${table}: ${count} rows`);
  }
}
process.exitCode = failed ? 1 : 0;
