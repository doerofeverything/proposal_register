import type { SupabaseClient } from "@supabase/supabase-js";
import { validState, type Proposal, type RegisterState } from "./proposals.ts";

export class DatabaseSetupError extends Error {}

export async function readRegisterState(client: SupabaseClient): Promise<RegisterState> {
  const { data: settings, error: settingsError } = await client.from("register_settings")
    .select("fy,next").eq("id", true).single();
  if (settingsError?.code === "PGRST205" || (!settingsError && !settings)) throw new DatabaseSetupError("The database settings are missing. Run supabase/install.sql in the Supabase SQL Editor.");
  if (settingsError) throw new Error("Could not load numbering settings. Check workspace access.");

  const { data: options, error: optionsError } = await client.from("register_options")
    .select("category,label,sort_order").order("sort_order").order("label");
  if (optionsError?.code === "PGRST205" || (!optionsError && !options?.length)) throw new DatabaseSetupError("The form options table is missing or empty. Run supabase/install.sql in the Supabase SQL Editor.");
  if (optionsError) throw new Error("Could not load form options. Check database permissions and workspace access.");

  // Keyset pagination avoids Supabase's default maximum of 1,000 rows.
  const records: Proposal[] = [];
  let after: string | undefined;
  while (true) {
    let query = client.from("proposals").select("*").order("number").limit(500);
    if (after) query = query.gt("number", after);
    const { data, error } = await query;
    if (error || !data) throw new Error("Could not load proposals from Supabase. Check your connection and workspace access.");
    records.push(...data as Proposal[]);
    if (!data.length) break;
    after = data[data.length - 1].number;
  }
  const result: RegisterState = {
    fy: settings.fy,
    next: settings.next,
    records,
    options: {
      effluentTypes: options.filter(o => o.category === "effluent").map(o => o.label),
      locations: options.filter(o => o.category === "location").map(o => o.label),
    },
  };
  if (!validState(result)) throw new Error("Database records contain invalid proposal values. Review the imported data.");
  return result;
}
