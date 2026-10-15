"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { supabaseConfig } from "@/lib/supabase/config";
import { signInWorkspaceMember } from "@/lib/supabase/password-login";

const invalidLogin = { error: "The username/email or password is incorrect, or this account does not have workspace access." };

export async function login(_previous: { error: string }, form: FormData) {
  if (!supabaseConfig()) return { error: "Add your Supabase project URL and publishable key to .env, then restart the server." };

  const identifier = String(form.get("username") || "").trim();
  const password = String(form.get("password") || "");
  if (!identifier || identifier.length > 254 || !password || password.length > 256) return invalidLogin;

  try {
    let email = identifier.toLowerCase();
    if (!identifier.includes("@")) {
      const admin = createSupabaseAdminClient();
      if (!admin) return { error: "Username login requires SUPABASE_SECRET_KEY on the server. You can sign in with your account email instead." };
      const { data: member, error } = await admin.from("register_members")
        .select("user_id").eq("username", identifier.toLowerCase()).maybeSingle();
      if (error || !member) return invalidLogin;
      const { data: account, error: accountError } = await admin.auth.admin.getUserById(member.user_id);
      if (accountError || !account.user?.email) return invalidLogin;
      email = account.user.email;
    }

    const supabase = await createSupabaseServerClient();
    if (!await signInWorkspaceMember(supabase, email, password)) return invalidLogin;
    (await cookies()).delete("flowdesk_session");
  } catch {
    return { error: "Unable to reach Supabase. Check the project configuration and try again." };
  }
  redirect("/");
}

export async function logout() {
  if (supabaseConfig()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut({ scope: "local" });
  }
  (await cookies()).delete("flowdesk_session");
  redirect("/login");
}
