import { randomBytes } from "node:crypto";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

nextEnv.loadEnvConfig(process.cwd());

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const secret = process.env.SUPABASE_SECRET_KEY?.trim();
const email = process.env.SEED_USER_EMAIL?.trim().toLowerCase();
const username = process.env.SEED_USER_USERNAME?.trim().toLowerCase();
const password = process.env.SEED_USER_PASSWORD || randomBytes(24).toString("base64url");

if (!url || !secret || !email || !username) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, SEED_USER_EMAIL and SEED_USER_USERNAME in .env first. No changes were made.");
  process.exit(1);
}
if (!/^[a-z0-9][a-z0-9._-]{2,49}$/.test(username) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 12) {
  console.error("Use a valid email, a 3–50 character username (letters, numbers, '.', '_' or '-'), and a password of at least 12 characters.");
  process.exit(1);
}

const supabase = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

try {
  // Check the schema and username BEFORE creating a remote Auth account.
  const { data: existing, error: lookupError } = await supabase.from("register_members")
    .select("user_id").ilike("username", username).limit(1);
  if (lookupError) throw new Error("Cannot read register_members. Run supabase/setup.sql first and verify the server secret key.");
  if (existing.length) throw new Error("That username already exists. Existing accounts and passwords are never overwritten.");

  const { data, error } = await supabase.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { display_name: username },
  });
  if (error || !data.user) throw new Error("Could not create the Auth user. Check whether the email already exists and whether the password meets the project's policy. Existing accounts were not changed.");

  const { error: memberError } = await supabase.from("register_members").insert({ user_id: data.user.id, username });
  if (memberError) throw new Error(`Auth user ${data.user.id} was created, but workspace membership failed. Add this user ID to register_members and set its password in Supabase Authentication; the account currently has no workspace access.`);

  console.log("Created a Supabase Auth user and workspace membership.");
  console.log(`Username: ${username}`);
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);
  console.log("Save this password securely. It is shown only here; the application has no default credentials.");
} catch (error) {
  console.error(error instanceof Error ? error.message : "Account creation failed.");
  process.exitCode = 1;
}
