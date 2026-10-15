"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function WorkspaceSetup({ message }: { message: string }) {
  const router = useRouter();
  const [checking, startTransition] = useTransition();
  return <main className="page-content">
    <section className="panel settings-panel" role="status">
      <h1>Finish database setup</h1>
      <p>{message}</p>
      <p>The workspace will show your database records once setup is complete. Existing records are preserved.</p>
      <button className="button primary" disabled={checking} onClick={() => startTransition(() => router.refresh())}>
        {checking ? "Checking…" : "Check setup again"}
      </button>
    </section>
  </main>;
}
