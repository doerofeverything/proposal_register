"use client";

import { useState } from "react";
import { useRegister } from "@/components/workspace";
import { Icon } from "@/components/icon";
import { download, today, validState } from "@/lib/proposals";
import { importProposals, updateNumbering } from "@/app/(workspace)/actions";

export default function SettingsPage() {
  const { state, refresh, notify } = useRegister();
  const [fy, setFy] = useState(state.fy);
  const [next, setNext] = useState(String(state.next));
  const [expected, setExpected] = useState({ fy: state.fy, next: state.next });
  const [busy, setBusy] = useState(false);

  async function saveSettings(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    const sequence = Number(next);
    if (!/^\d{2}$/.test(fy) || !Number.isSafeInteger(sequence) || sequence < 1) {
      notify("Use a two-digit financial year and a positive whole sequence number."); return;
    }
    setBusy(true);
    try {
      const result = await updateNumbering(fy, sequence, expected);
      if (result.error) { notify(result.error); await refresh(); return; }
      setExpected({ fy, next: sequence });
      notify("Numbering settings saved to Supabase.");
      await refresh();
    } catch { notify("Could not confirm the settings save. Refresh before trying again."); }
    finally { setBusy(false); }
  }

  async function importBackup(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const file = input.files?.[0];
    if (!file || busy) return;
    setBusy(true);
    try {
      const backup = JSON.parse(await file.text());
      if (backup.format !== "treatment-proposal-register-v1" || !validState(backup)) throw Error("This is not a valid proposal register backup.");
      if (!window.confirm(`Import ${backup.records.length} proposal records into the shared Supabase register? Identical records are skipped. Conflicting records stop the import; existing records are kept.`)) return;
      const result = await importProposals(backup);
      if (result.error) { notify(result.error); return; }
      notify(`Imported ${result.imported} records into Supabase.`);
      await refresh();
    } catch (error) { notify(error instanceof Error ? error.message : "Could not import this backup."); }
    finally { input.value = ""; setBusy(false); }
  }

  const changed = state.fy !== expected.fy || state.next !== expected.next;
  return <>
    <div className="page-heading"><div><span className="eyebrow">MAKE IT YOUR WORKSPACE</span><h1>Settings & backup<span className="heading-dot">.</span></h1><p>Manage shared numbering and export database records.</p></div></div>
    <div className="settings-grid">
      <section className="panel settings-panel">
        <span className="settings-icon"><Icon name="settings" size={24} /></span>
        <h2>Proposal numbering</h2><p>These settings apply to everyone in the workspace. Existing proposal numbers stay unchanged.</p>
        {changed && <div className="message" role="status">Numbering has changed in the database.<button type="button" className="button secondary" onClick={() => { setFy(state.fy); setNext(String(state.next)); setExpected({ fy: state.fy, next: state.next }); }}>Load current values</button></div>}
        <form onSubmit={saveSettings}>
          <fieldset className="form-grid" disabled={busy}>
            <label>Financial year<input value={fy} onChange={e => setFy(e.target.value)} maxLength={2} pattern="[0-9]{2}" required inputMode="numeric" /></label>
            <label>Next proposal sequence<input type="number" min="1" step="1" value={next} onChange={e => setNext(e.target.value)} required /></label>
          </fieldset>
          <p className="helper">New project sequences and revision numbers are assigned inside a database transaction.</p>
          <button className="button primary" disabled={busy}>{busy ? "Saving…" : "Save settings"}</button>
        </form>
      </section>
      <section className="panel settings-panel">
        <span className="settings-icon"><Icon name="shield" size={24} /></span>
        <h2>Data & backups</h2><p>Your {state.records.length} loaded proposal records come from Supabase. Download a JSON backup or import records from an earlier browser backup.</p>
        <div className="backup-summary"><Icon name="register" /><div><strong>{state.records.length} database records</strong><small>Complete proposals and revision history</small></div><span className="status-dot" /></div>
        <div className="backup-actions">
          <button className="button primary" disabled={busy} onClick={() => download(JSON.stringify({ format: "treatment-proposal-register-v1", ...state }, null, 2), `Treatment_Proposal_Backup_${today()}.json`, "application/json")}><Icon name="download" size={17} />Download JSON backup</button>
          <label className="button secondary restore-button">Import JSON backup<input type="file" disabled={busy} accept=".json,application/json" onChange={importBackup} /></label>
        </div>
        <p className="helper">Imports add missing proposals and retain existing history. Numbering settings remain shared; the next sequence advances when needed.</p>
      </section>
    </div>
  </>;
}
