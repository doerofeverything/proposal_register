import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { mkdir, writeFile } from "node:fs/promises";

nextEnv.loadEnvConfig(process.cwd());
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const secret = process.env.SUPABASE_SECRET_KEY?.trim();
if (!url || !secret) throw Error("Supabase server configuration is required.");
const client = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

// These are the exact IDs from the deleted optional demo-data script.
const demoNumbers = ["PP/DWF/EFF/99/01/00", "PP/DWF/EFF/99/01/01", "PP/DRH/SEW/99/02/00"];
const demoBases = ["demo-water-factory", "demo-resort-hotel"];
const { data: rows, error } = await client.from("proposals").select("*")
  .in("number", demoNumbers).in("baseId", demoBases).eq("fy", "99");
if (error) throw Error("Could not read the demo records. No records were deleted.");
if (!rows.length) {
  console.log("No demo proposal records found. No changes made.");
} else {
  await mkdir("backups", { recursive: true });
  const filename = `backups/removed-demo-proposals-${Date.now()}.json`;
  await writeFile(filename, JSON.stringify(rows, null, 2), { flag: "wx" });
  const { data: removed, error: deleteError } = await client.from("proposals").delete()
    .in("number", rows.map(r => r.number)).in("baseId", demoBases).eq("fy", "99").select("number");
  if (deleteError) throw Error(`Could not delete demo records. Backup saved at ${filename}.`);
  console.log(`Removed ${removed.length} demo proposal records. Backup saved at ${filename}.`);
}
