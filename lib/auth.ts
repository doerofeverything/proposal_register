import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { supabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function currentUser() {
  await connection();
  if (!supabaseConfig()) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user || data.user.is_anonymous) return null;

  const { data: member, error: membershipError } = await supabase
    .from("register_members")
    .select("username")
    .eq("user_id", data.user.id)
    .maybeSingle();
  return !membershipError && member ? member.username as string : null;
}

export async function requireUser() {
  const username = await currentUser();
  if (!username) redirect("/login");
  return username;
}
