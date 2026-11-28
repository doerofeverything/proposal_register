export interface Proposal {
  baseId: string; projectCode: string; effluentCode: string; fy: string; sequence: number; revision: number;
  number: string; project: string; effluent: string; flow: number | null; price: number | null; gp: number | null;
  proposalType: string; date: string; createdAt: string; location: string; requestedBy: string;
  flowRaw?: string; priceRaw?: string; gpRaw?: string; sourceEffluentType?: string;
  originalProposalNumber?: string; referenceProposalNumber?: string; originalProposalType?: string;
  referenceProposalType?: string; sourceRow?: number | string; sourceIndex?: string;
}
export interface RegisterOptions { effluentTypes: string[]; locations: string[] }
export interface RegisterState { fy: string; next: number; records: Proposal[]; options?: RegisterOptions }
export interface ProposalInput {
  project: string; effluent: string; flow: number; price: number; gp: number;
  date: string; location: string; requestedBy: string;
}
export interface ProposalFilter {
  query?: string;
  type?: string;
  fromDate?: string;
  toDate?: string;
}
export function filterProposals(records: Proposal[], filter: ProposalFilter) {
  const q = (filter.query || "").trim().toLowerCase();
  const type = filter.type || "";
  const fromDate = filter.fromDate || "";
  const toDate = filter.toDate || "";
  return records
    .filter(r => {
      if (type && r.proposalType !== type) return false;
      if (fromDate || toDate) {
        const d = /^\d{4}-\d{2}-\d{2}/.test(r.date) ? r.date.slice(0, 10) : "";
        if (!d) return false;
        if (fromDate && d < fromDate) return false;
        if (toDate && d > toDate) return false;
      }
      if (q && !`${r.number} ${r.project} ${r.effluent} ${r.location} ${r.requestedBy}`.toLowerCase().includes(q)) return false;
      return true;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export function latestRecords(records: Proposal[]) {
  const map = new Map<string, Proposal>();
  for (const row of records) if (!map.has(row.baseId) || map.get(row.baseId)!.revision < row.revision) map.set(row.baseId, row);
  return [...map.values()];
}
export function validState(value: unknown): value is RegisterState {
  if (!value || typeof value !== "object") return false;
  const s = value as RegisterState;
  if (!/^\d{2}$/.test(s.fy) || !Number.isSafeInteger(s.next) || s.next < 1 || !Array.isArray(s.records)) return false;
  const numbers = new Set<string>();
  return s.records.every(r => {
    if (!r || !["baseId", "projectCode", "effluentCode", "fy", "number", "project", "effluent", "proposalType", "date", "createdAt"].every(k => typeof r[k as keyof Proposal] === "string") || !Number.isSafeInteger(r.sequence) || r.sequence < 1 || !Number.isInteger(r.revision) || r.revision < 0 || r.revision > 99 || ![r.flow, r.price, r.gp].every(n => n === null || (typeof n === "number" && Number.isFinite(n))) || numbers.has(r.number)) return false;
    numbers.add(r.number); return true;
  });
}
export function numberFor(base: Pick<Proposal, "projectCode" | "effluentCode" | "fy" | "sequence">, revision: number) {
  return ["PP", base.projectCode, base.effluentCode, base.fy, String(base.sequence).padStart(2, "0"), String(revision).padStart(2, "0")].join("/");
}
export function initials(name: string) { return name.trim().split(/[^A-Za-z0-9]+/).filter(Boolean).slice(0, 3).map(w => w[0].toUpperCase()).join("").padEnd(3, "X"); }
export const money = (value: number | null) => Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
export const compact = (value: number) => new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(value);
export function today() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Colombo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
export const columns: [keyof Proposal, string][] = [["number", "Proposal Number"], ["date", "Date"], ["project", "Project Name"], ["effluent", "Effluent Type"], ["flow", "Flow Rate (m3/day)"], ["price", "Project Price (LKR)"], ["gp", "GP Value (LKR)"], ["proposalType", "Proposal Type"], ["fy", "Financial Year"], ["sequence", "Sequence"], ["revision", "Revision"], ["location", "Location"], ["requestedBy", "Requested By"], ["sourceEffluentType", "Original Effluent Type"], ["flowRaw", "Original Flow Rate"], ["priceRaw", "Original Price Text"], ["gpRaw", "Original GP Text"], ["originalProposalNumber", "Original Proposal No. (B)"], ["referenceProposalNumber", "Reference Proposal No. (C)"], ["originalProposalType", "Original Proposal Type (K)"], ["referenceProposalType", "Reference Proposal Type (L)"], ["sourceRow", "Original Excel Row"], ["sourceIndex", "Original Excel Index"]];
export function download(data: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}
export function exportRecords(records: Proposal[], excel = false) {
  const rows = [columns.map(c => c[1]), ...records.map(r => columns.map(c => r[c[0]] ?? ""))];
  if (!excel) {
    const escape = (v: unknown) => { let s = String(v); if (/^[=+@\-\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
    download("\ufeff" + rows.map(row => row.map(escape).join(",")).join("\r\n"), "Treatment_Proposal_Register.csv", "text/csv;charset=utf-8");
  } else {
    const escape = (v: unknown) => String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const xml = rows.map(row => "<Row>" + row.map(v => `<Cell><Data ss:Type="${typeof v === "number" ? "Number" : "String"}">${escape(v)}</Data></Cell>`).join("") + "</Row>").join("");
    download('<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Proposal History"><Table>' + xml + "</Table></Worksheet></Workbook>", "Treatment_Proposal_Register.xls", "application/vnd.ms-excel");
  }
}
