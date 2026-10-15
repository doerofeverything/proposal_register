import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("Supabase schema, historical inserts, transactions and access policies", async t => {
  const db = new PGlite();
  const member = "12f89acf-766d-4e6f-ab42-682f5721c021";
  const input = { project: "Database Test Project", effluent: "Effluent", flow: 10, price: 100, gp: 20, date: "2026-10-16", location: "Sri Lanka", requestedBy: "Test" };
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      create schema auth;
      create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth to authenticated, anon;
      insert into auth.users values ('${member}');
    `);
    await db.exec(await readFile(new URL("../supabase/install.sql", import.meta.url), "utf8"));
    await db.query("insert into public.register_members(user_id,username) values ($1,'test.member')", [member]);

    await t.test("all 152 historical rows import, and rerunning preserves records and advances settings", async () => {
      assert.equal((await db.query("select count(*)::int as n from public.proposals")).rows[0].n, 152);
      await db.exec(await readFile(new URL("../supabase/install.sql", import.meta.url), "utf8"));
      assert.equal((await db.query("select count(*)::int as n from public.proposals")).rows[0].n, 152);
      const result = await db.query('select "next", (select max("sequence")+1 from public.proposals where fy=s.fy) as expected from public.register_settings s');
      assert.equal(result.rows[0].next, result.rows[0].expected);
    });

    await t.test("anonymous requests and nonmembers cannot access records or mutation functions", async () => {
      await db.exec("set role anon");
      await assert.rejects(db.query("select * from public.proposals"), /permission denied/);
      await assert.rejects(db.query("select public.flowdesk_create_proposal($1::jsonb,null)", [JSON.stringify(input)]), /permission denied/);
      await db.exec("set role authenticated");
      assert.equal((await db.query("select * from public.proposals")).rows.length, 0);
      await assert.rejects(db.query("select public.flowdesk_create_proposal($1::jsonb,null)", [JSON.stringify(input)]), /membership is required/);
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [member]);
    });

    let created;
    await t.test("members see records but cannot bypass the transaction functions", async () => {
      assert.equal((await db.query("select count(*)::int as n from public.proposals")).rows[0].n, 152);
      await assert.rejects(db.query("update public.register_settings set fy='99'"), /permission denied/);
      await assert.rejects(db.query("delete from public.proposals"), /permission denied/);
      await assert.rejects(db.query("insert into public.proposals select * from public.proposals limit 1"), /permission denied/);
    });

    await t.test("new projects allocate unique sequences and revisions retain the original identifiers", async () => {
      const responses = await Promise.all([
        db.query("select * from public.flowdesk_create_proposal($1::jsonb,null)", [JSON.stringify(input)]),
        db.query("select * from public.flowdesk_create_proposal($1::jsonb,null)", [JSON.stringify(input)]),
      ]);
      created = responses[0].rows[0];
      assert.notEqual(created.number, responses[1].rows[0].number);
      assert.equal(created.projectCode, "DTP");
      const result = await db.query("select * from public.flowdesk_create_proposal($1::jsonb,$2)", [JSON.stringify({ ...input, price: 250, project: "Renamed project" }), created.baseId]);
      const revision = result.rows[0];
      assert.equal(revision.projectCode, created.projectCode);
      assert.equal(revision.sequence, created.sequence);
      assert.equal(revision.revision, 1);
      assert.equal(revision.number, created.number.slice(0, -2) + "01");
      assert.equal(Number((await db.query('select price from public.proposals where "number"=$1', [created.number])).rows[0].price), 100);
    });

    await t.test("invalid saves roll back numbering and stale settings cannot overwrite newer changes", async () => {
      const before = (await db.query('select fy,"next" from public.register_settings')).rows[0];
      await assert.rejects(db.query("select public.flowdesk_create_proposal($1::jsonb,null)", [JSON.stringify({ ...input, flow: -1 })]), /valid numeric values/);
      assert.deepEqual((await db.query('select fy,"next" from public.register_settings')).rows[0], before);
      await assert.rejects(db.query("select public.flowdesk_update_numbering('27',1,'27',1)"), /Numbering changed/);
    });

    await t.test("identical imports are idempotent; conflicting backups leave existing history intact", async () => {
      const existing = (await db.query('select * from public.proposals where "number"=$1', [created.number])).rows[0];
      const same = await db.query("select public.flowdesk_import_proposals($1::jsonb) as n", [JSON.stringify([existing])]);
      assert.equal(same.rows[0].n, 0);
      await assert.rejects(db.query("select public.flowdesk_import_proposals($1::jsonb)", [JSON.stringify([{ ...existing, project: "Conflicting backup" }])]), /different values/);
      assert.equal((await db.query('select project from public.proposals where "number"=$1', [created.number])).rows[0].project, created.project);
    });
  } finally { await db.close(); }
});
