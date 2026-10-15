"use client";

export default function WorkspaceError({ retry }: { retry: () => void }) {
  return <main className="page-content"><section className="panel settings-panel" role="alert">
    <h1>Could not load the workspace</h1>
    <p>Check your Supabase connection, workspace membership, and that setup.sql and cloud-storage.sql have been run.</p>
    <button className="button primary" onClick={retry}>Try again</button>
  </section></main>;
}
