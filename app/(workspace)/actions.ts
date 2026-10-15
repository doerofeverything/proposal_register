"use server";

import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { readRegisterState } from "@/lib/register-data";
import { validState, type Proposal, type ProposalInput, type RegisterState } from "@/lib/proposals";

export async function refreshRegister() {
  await requireUser();
  return readRegisterState(await createSupabaseServerClient());
}

export async function createProposal(input: ProposalInput, baseId: string | null) {
  await requireUser();
  if (!input || !input.project?.trim() || !input.date || ![input.flow, input.price, input.gp].every(Number.isFinite) || input.flow <= 0 || input.price < 0) {
    return { error: "Complete all required fields with valid proposal values." };
  }
  const client = await createSupabaseServerClient();
  const { data, error } = await client.rpc("flowdesk_create_proposal", { p_input: input, p_base_id: baseId }).single();
  if (error) return { error: error.code === "P0001" ? error.message : "Could not save the proposal. Check the database migration and try again." };
  return { record: data as Proposal };
}

export async function updateNumbering(fy: string, next: number, expected: { fy: string; next: number }) {
  await requireUser();
  if (!/^\d{2}$/.test(fy) || !Number.isSafeInteger(next) || next < 1) return { error: "Use a two-digit financial year and positive whole sequence number." };
  const client = await createSupabaseServerClient();
  const { error } = await client.rpc("flowdesk_update_numbering", {
    p_fy: fy, p_next: next, p_expected_fy: expected.fy, p_expected_next: expected.next,
  });
  return error ? { error: error.code === "P0001" ? error.message : "Could not save numbering settings." } : { success: true };
}

export async function importProposals(backup: RegisterState) {
  await requireUser();
  if (!validState(backup)) return { error: "Invalid proposal backup." };
  const client = await createSupabaseServerClient();
  const { data, error } = await client.rpc("flowdesk_import_proposals", { p_records: backup.records });
  return error ? { error: error.code === "P0001" ? error.message : "Could not import this backup. Check for conflicting project revisions." } : { imported: Number(data) };
}
