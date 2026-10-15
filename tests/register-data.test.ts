import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { DatabaseSetupError, readRegisterState } from "../lib/register-data.ts";

function fixture(count: number, failProposals = false, optionStatus = "ready") {
  const records = Array.from({ length: count }, (_, index) => ({
    number: `PP/TST/EFF/99/${String(index + 1).padStart(5, "0")}/00`, baseId: `test-${index}`,
    projectCode: "TST", effluentCode: "EFF", fy: "99", sequence: index + 1, revision: 0,
    project: `Test project ${index}`, effluent: "Effluent", flow: 10, price: 100, gp: 20,
    proposalType: "New", date: "2026-10-16", createdAt: "2026-10-16T00:00:00Z", location: "Test location", requestedBy: "Test",
  }));
  const fetchMock: typeof fetch = async input => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/register_settings")) return Response.json({ fy: "99", next: count + 1 });
    if (url.pathname.endsWith("/register_options")) {
      if (optionStatus === "missing") return Response.json({ code: "PGRST205", message: "Table missing" }, { status: 404 });
      if (optionStatus === "forbidden") return Response.json({ code: "42501", message: "Permission denied" }, { status: 403 });
      if (optionStatus === "empty") return Response.json([]);
      return Response.json([
      { category: "effluent", label: "Effluent", sort_order: 0 },
      { category: "location", label: "Test location", sort_order: 0 },
      ]);
    }
    if (url.pathname.endsWith("/proposals")) {
      if (failProposals) return Response.json({ message: "Database unavailable" }, { status: 503 });
      const after = url.searchParams.get("number")?.replace(/^gt\./, "");
      return Response.json(records.filter(r => !after || r.number > after).slice(0, 500));
    }
    throw Error("Unexpected database request");
  };
  return createClient("https://database-test.example.com", "test-key", {
    auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: fetchMock },
  });
}

test("database reader loads all records above the default Supabase row limit and reads settings/options", async () => {
  const state = await readRegisterState(fixture(1205));
  assert.equal(state.records.length, 1205);
  assert.equal(new Set(state.records.map(r => r.number)).size, 1205);
  assert.equal(state.fy, "99");
  assert.equal(state.next, 1206);
  assert.deepEqual(state.options?.locations, ["Test location"]);
});

test("empty database displays empty records instead of historical or demo fixtures", async () => {
  const state = await readRegisterState(fixture(0));
  assert.deepEqual(state.records, []);
});

test("database failures surface an error without silently substituting local records", async () => {
  await assert.rejects(readRegisterState(fixture(0, true)), /Could not load proposals/);
});

test("missing or empty options produce a recoverable setup state", async () => {
  for (const status of ["missing", "empty"]) {
    await assert.rejects(readRegisterState(fixture(0, false, status)), error => error instanceof DatabaseSetupError && error.message.includes("supabase/install.sql"));
  }
});

test("permission failures remain errors instead of being treated as missing migrations", async () => {
  await assert.rejects(readRegisterState(fixture(0, false, "forbidden")), error => error instanceof Error && !(error instanceof DatabaseSetupError) && error.message.includes("permissions"));
});
