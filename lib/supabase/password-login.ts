import type { SupabaseClient } from "@supabase/supabase-js";

export async function signInWorkspaceMember(client: SupabaseClient, email: string, password: string) {
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user || data.user.is_anonymous) return false;

  // Verify membership using the signed-in user's RLS permissions.
  const { data: member, error: membershipError } = await client.from("register_members")
    .select("username").eq("user_id", data.user.id).maybeSingle();
  if (membershipError || !member) {
    await client.auth.signOut({ scope: "local" });
    return false;
  }
  return true;
}
