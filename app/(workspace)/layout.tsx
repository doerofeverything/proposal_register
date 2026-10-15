import { requireUser } from "@/lib/auth";
import { Workspace } from "@/components/workspace";
import { DatabaseSetupError, readRegisterState } from "@/lib/register-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { WorkspaceSetup } from "@/components/workspace-setup";
import type { RegisterState } from "@/lib/proposals";
export const instant = false;
export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const username = await requireUser();
  let state: RegisterState | null = null;
  let setupMessage = "";
  try {
    state = await readRegisterState(await createSupabaseServerClient());
  } catch (error) {
    if (!(error instanceof DatabaseSetupError)) throw error;
    setupMessage = error.message;
  }
  if (!state) return <WorkspaceSetup message={setupMessage} />;
  return <Workspace initialState={state} username={username}>{children}</Workspace>;
}
