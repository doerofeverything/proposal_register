"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useRegister } from "./workspace";
import { Icon } from "./icon";
import { initials, latestRecords, numberFor, Proposal, today } from "@/lib/proposals";
import { createProposal } from "@/app/(workspace)/actions";

export function ProposalForm({ reviseId }: { reviseId?: string }) {
  const { state, refresh, notify } = useRegister(); const router = useRouter();
  const latest = latestRecords(state.records);
  const original = latest.find(r => r.baseId === reviseId);
  const effluentTypes = state.options?.effluentTypes || [];
  const locations = state.options?.locations || [];
  const blank = () => ({ project: "", effluent: effluentTypes[0] || "", flow: "", price: "", gp: "", location: locations[0] || "", requestedBy: "", date: today() });
  const fromRow = (r: Proposal) => ({ project: r.project, effluent: r.effluent, flow: r.flow === null ? "" : String(r.flow), price: r.price === null ? "" : String(r.price), gp: r.gp === null ? "" : String(r.gp), location: r.location || "", requestedBy: r.requestedBy || "", date: today() });
  const [form, setForm] = useState(original ? fromRow(original) : blank);
  const [kind, setKind] = useState(reviseId ? "Revised" : "New");
  const [baseId, setBaseId] = useState(original?.baseId || "");
  const [search, setSearch] = useState(""); const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const base = kind === "Revised" ? latest.find(r => r.baseId === baseId) : undefined;
  const revision = base ? base.revision + 1 : 0;
  const numbering = base || { projectCode: initials(form.project), effluentCode: form.effluent.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3).padEnd(3, "X"), fy: state.fy, sequence: state.next };
  const preview = kind === "Revised" && !base ? "Select a previous proposal" : numberFor(numbering, revision);
  function update(key: keyof typeof form, value: string) { setForm({ ...form, [key]: value }); }
  function selectPrevious(id: string) { setBaseId(id); const row = latest.find(r => r.baseId === id); if (row) setForm(fromRow(row)); }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    if (saving) return;
    const flow = Number(form.flow), price = Number(form.price), gp = Number(form.gp);
    if (!form.project.trim() || !form.flow || !form.price || !form.gp || !form.date || !Number.isFinite(flow) || flow <= 0 || !Number.isFinite(price) || price < 0 || !Number.isFinite(gp)) { setError("Complete all required fields. Flow must be positive and price must be nonnegative."); return; }
    if (kind === "Revised" && !base) { setError("Select the previous proposal before saving a revision."); return; }
    if (revision > 99) { setError("This project has reached the maximum of 99 revisions."); return; }
    setSaving(true);
    try {
      const result = await createProposal({ ...form, project: form.project.trim(), flow, price, gp }, base?.baseId || null);
      if (result.error || !result.record) { setError(result.error || "Could not save proposal."); return; }
      notify(`Saved ${result.record.number}`);
      await refresh();
      router.push("/register");
    } catch { setError("Could not confirm the save. Refresh the register before retrying to check whether it was saved."); }
    finally { setSaving(false); }
  }
  return <><div className="page-heading"><div><span className="eyebrow">BUILD WHAT’S NEXT</span><h1>{kind === "Revised" ? "Create a revision" : "New proposal"}<span className="heading-dot">.</span></h1><p>{kind === "Revised" ? "Move the project forward. Keep its complete history." : "Start a project with the details that matter."}</p></div><Link className="button secondary" href="/register">Back to register</Link></div><form className="proposal-layout" onSubmit={submit}><section className="panel form-panel"><div className="section-heading"><div><h2>Project details</h2><p>Fields marked * are required</p></div><span className="subtle-tag">FY {state.fy}</span></div><fieldset className="form-grid" disabled={saving}><label className="span-two">Project name *<input value={form.project} onChange={e => update("project", e.target.value)} placeholder="e.g. Riverside Water Treatment Plant" required maxLength={200} /></label><label>Proposal type<select value={kind} onChange={e => { setKind(e.target.value); setBaseId(""); setForm(blank()); }}><option>New</option><option>Revised</option></select></label><label>Effluent type *<select value={form.effluent} onChange={e => update("effluent", e.target.value)}>{effluentTypes.map(type => <option key={type}>{type}</option>)}</select></label>{kind === "Revised" && <div className="previous-selector span-two"><label>Find previous proposal<input aria-label="Search previous proposals" placeholder="Search by project or proposal number" value={search} onChange={e => setSearch(e.target.value)} /></label><label>Previous proposal *<select value={baseId} onChange={e => selectPrevious(e.target.value)} required><option value="">Select an existing project</option>{latest.filter(r => r.baseId === baseId || `${r.number} ${r.project}`.toLowerCase().includes(search.toLowerCase())).map(r => <option key={r.baseId} value={r.baseId}>{r.number} — {r.project}</option>)}</select></label><p className="helper">The latest version is loaded automatically. Project code and sequence are retained.</p></div>}<label>Flow rate (m³/day) *<input type="number" min="0.000001" step="any" placeholder="0.00" value={form.flow} onChange={e => update("flow", e.target.value)} required /></label><label>Proposal date *<input type="date" value={form.date} onChange={e => update("date", e.target.value)} required /></label><label>Project price (LKR) *<input type="number" min="0" step="0.01" placeholder="0.00" value={form.price} onChange={e => update("price", e.target.value)} required /></label><label>GP value (LKR) *<input type="number" step="0.01" placeholder="0.00" value={form.gp} onChange={e => update("gp", e.target.value)} required /></label><label>Location<select value={form.location} onChange={e => update("location", e.target.value)}>{locations.map(location => <option key={location}>{location}</option>)}</select></label><label>Requested by<input value={form.requestedBy} onChange={e => update("requestedBy", e.target.value)} placeholder="Team member or client" maxLength={150} /></label></fieldset>{error && <p className="message error" role="alert">{error}</p>}<div className="form-actions"><button className="button primary" type="submit" disabled={saving}><Icon name="plus" size={17} />{kind === "Revised" ? "Save revision" : "Save proposal"}</button><button className="button secondary" type="button" disabled={saving} onClick={() => { setForm(blank()); setKind("New"); setBaseId(""); setError(""); }}>Clear form</button></div></section><aside className="form-aside"><div className="preview-card"><span className="eyebrow">PROPOSAL NUMBER</span><Icon name="register" size={28} /><strong>{preview}</strong><p>Preview only. The database assigns the final number when saved.</p><div><span>Revision</span><b>{String(revision).padStart(2, "0")}</b></div></div><div className="form-tip"><Icon name="history" size={23} /><h3>A history you can rely on</h3><p>Each revision is saved as a separate record. Earlier proposals stay exactly as they were.</p></div></aside></form></>;
}
