import { test } from "node:test";
import assert from "node:assert/strict";
import { filterProposals, latestRecords, numberFor, initials, validState, type Proposal } from "../lib/proposals.ts";

const record: Proposal = { baseId: "a", projectCode: "RWT", effluentCode: "RAW", fy: "27", sequence: 42, revision: 0, number: "PP/RWT/RAW/27/42/00", project: "Riverside Water Treatment", effluent: "Raw water", flow: 10, price: 100, gp: 20, proposalType: "New", date: "2026-10-15", createdAt: "2026-10-15T00:00:00Z", location: "Sri Lanka", requestedBy: "Admin" };
test("revisions retain original numbering identifiers", () => {
  assert.equal(numberFor(record, 3), "PP/RWT/RAW/27/42/03");
  assert.equal(initials("Riverside Water Treatment"), "RWT");
  assert.equal(initials("Lake"), "LXX");
});
test("dashboard selects latest revision even with unordered records", () => {
  const revised = { ...record, revision: 2, number: numberFor(record, 2), price: 250 };
  assert.deepEqual(latestRecords([revised, record]), [revised]);
});
test("backup validation rejects malformed, duplicate and invalid numeric records", () => {
  const state = { fy: "27", next: 43, records: [record] };
  assert.equal(validState(state), true);
  assert.equal(validState({ ...state, records: [record, record] }), false);
  assert.equal(validState({ ...state, records: [{ ...record, price: "100" }] }), false);
  assert.equal(validState({ ...state, records: [{ ...record, revision: 100 }] }), false);
  assert.equal(validState({ ...state, records: [{ number: "bad" }] }), false);
  assert.equal(validState({ ...state, next: 0 }), false);
});
test("register filter supports inclusive date ranges with search and type", () => {
  const apr = { ...record, number: "PP/A/RAW/27/01/00", project: "Alpha Plant", date: "2026-04-01", createdAt: "2026-04-01T00:00:00Z", proposalType: "New" };
  const may = { ...record, number: "PP/B/RAW/27/02/01", project: "Beta Plant", date: "2026-05-15", createdAt: "2026-05-15T00:00:00Z", proposalType: "Revised" };
  const jun = { ...record, number: "PP/C/RAW/27/03/00", project: "Gamma Plant", date: "2026-06-30", createdAt: "2026-06-30T00:00:00Z", proposalType: "New" };
  const rows = [apr, may, jun];

  assert.deepEqual(filterProposals(rows, { fromDate: "2026-05-15" }).map(r => r.number), [jun.number, may.number]);
  assert.deepEqual(filterProposals(rows, { toDate: "2026-05-15" }).map(r => r.number), [may.number, apr.number]);
  assert.deepEqual(filterProposals(rows, { fromDate: "2026-04-01", toDate: "2026-05-15" }).map(r => r.number), [may.number, apr.number]);
  assert.deepEqual(filterProposals(rows, { fromDate: "2026-06-01", toDate: "2026-05-01" }), []);
  assert.deepEqual(filterProposals(rows, { fromDate: "2026-04-01", toDate: "2026-06-30", type: "Revised", query: "beta" }).map(r => r.number), [may.number]);
  assert.deepEqual(filterProposals([{ ...apr, date: "" }], { fromDate: "2026-04-01" }), []);
});
