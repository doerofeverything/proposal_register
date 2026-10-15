import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { signInWorkspaceMember } from "../lib/supabase/password-login.ts";

const userId = "12f89acf-766d-4e6f-ab42-682f5721c021";

function authFixture({ validPassword = true, member = true, membershipError = false } = {}) {
  const calls: { url: string; body: unknown }[] = [];
  const fetchMock: typeof fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null });
    if (url.includes("/auth/v1/token")) {
      if (!validPassword) return Response.json({ code: "invalid_credentials", msg: "Invalid login credentials" }, { status: 400 });
      return Response.json({ access_token: "test-access-token", refresh_token: "test-refresh-token", token_type: "bearer", expires_in: 3600, user: { id: userId, email: "member@example.com", is_anonymous: false } });
    }
    if (url.includes("/rest/v1/register_members")) {
      if (membershipError) return Response.json({ message: "permission denied" }, { status: 403 });
      return Response.json(member ? [{ username: "member" }] : []);
    }
    if (url.includes("/auth/v1/logout")) return new Response(null, { status: 204 });
    throw new Error(`Unexpected Supabase request: ${url}`);
  };
  const client = createClient("https://auth-test.example.com", "test-publishable-key", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: fetchMock },
  });
  return { client, calls };
}

test("login delegates password validation to Supabase and checks the user's membership", async () => {
  const { client, calls } = authFixture();
  assert.equal(await signInWorkspaceMember(client, "member@example.com", "a-user-supplied-password"), true);
  assert.deepEqual(calls[0].body, { email: "member@example.com", password: "a-user-supplied-password", gotrue_meta_security: {} });
  assert.ok(calls.some(c => c.url.includes(`user_id=eq.${userId}`)));
});

test("incorrect passwords never reach workspace membership lookup", async () => {
  const { client, calls } = authFixture({ validPassword: false });
  assert.equal(await signInWorkspaceMember(client, "member@example.com", "incorrect-password"), false);
  assert.equal(calls.length, 1);
});

test("valid Auth accounts without approved membership lose their local session", async () => {
  const { client } = authFixture({ member: false });
  assert.equal(await signInWorkspaceMember(client, "member@example.com", "a-user-supplied-password"), false);
  assert.equal((await client.auth.getSession()).data.session, null);
});

test("database permission errors fail closed and clear the signed-in session", async () => {
  const { client } = authFixture({ membershipError: true });
  assert.equal(await signInWorkspaceMember(client, "member@example.com", "a-user-supplied-password"), false);
  assert.equal((await client.auth.getSession()).data.session, null);
});
