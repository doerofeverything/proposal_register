import { requireUser } from "@/lib/auth";
import { ProposalForm } from "@/components/proposal-form";
export const instant = false;
export default async function NewProposalPage({ searchParams }: { searchParams: Promise<{ revise?: string }> }) {
  await requireUser();
  const { revise } = await searchParams;
  return <ProposalForm key={revise || "new"} reviseId={revise} />;
}
