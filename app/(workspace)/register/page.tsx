"use client";
import Link from "next/link";
import { useState } from "react";
import { useRegister } from "@/components/workspace";
import { ProposalTable } from "@/components/proposal-table";
import { Icon } from "@/components/icon";
import { exportRecords, filterProposals } from "@/lib/proposals";
export default function RegisterPage() {
  const { state } = useRegister();
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const rows = filterProposals(state.records, { query, type, fromDate, toDate });
  const hasDateFilter = Boolean(fromDate || toDate);
  const isFiltered = Boolean(query.trim() || type || hasDateFilter);
  const pages = Math.max(1, Math.ceil(rows.length / 15));
  const current = Math.min(page, pages);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">EVERY PROJECT. EVERY REVISION.</span>
          <h1>Proposal register<span className="heading-dot">.</span></h1>
          <p>Your complete proposal history, all in one place.</p>
        </div>
        <Link className="button primary" href="/new"><Icon name="plus" size={18} />New proposal</Link>
      </div>
      <section className="panel">
        <div className="register-toolbar">
          <div className="search-field">
            <Icon name="search" size={18} />
            <input
              aria-label="Search proposals"
              placeholder="Search projects, proposal numbers…"
              value={query}
              onChange={e => { setQuery(e.target.value); setPage(1); }}
            />
          </div>
          <select aria-label="Filter proposal type" value={type} onChange={e => { setType(e.target.value); setPage(1); }}>
            <option value="">All proposal types</option>
            <option>New</option>
            <option>Revised</option>
          </select>
          <div className="date-range-filter" role="group" aria-label="Filter by date range">
            <label className="date-field">
              <span>From</span>
              <input
                type="date"
                aria-label="From date"
                value={fromDate}
                max={toDate || undefined}
                onChange={e => { setFromDate(e.target.value); setPage(1); }}
              />
            </label>
            <span className="date-range-sep" aria-hidden="true">–</span>
            <label className="date-field">
              <span>To</span>
              <input
                type="date"
                aria-label="To date"
                value={toDate}
                min={fromDate || undefined}
                onChange={e => { setToDate(e.target.value); setPage(1); }}
              />
            </label>
            {hasDateFilter && (
              <button
                type="button"
                className="date-clear"
                aria-label="Clear date range"
                onClick={() => { setFromDate(""); setToDate(""); setPage(1); }}
              >
                Clear
              </button>
            )}
          </div>
          <div className="toolbar-exports">
            <button className="button secondary" onClick={() => exportRecords(state.records, true)}><Icon name="download" size={16} />Excel (.xls)</button>
            <button className="button secondary" onClick={() => exportRecords(state.records)}>CSV</button>
          </div>
        </div>
        <ProposalTable full rows={rows.slice((current - 1) * 15, current * 15)} />
        <div className="table-footer">
          <span>{isFiltered ? `${rows.length} of ${state.records.length}` : rows.length} records · All revisions included</span>
          <div className="pagination">
            <button disabled={current === 1} onClick={() => setPage(current - 1)}>Previous</button>
            <span>{current} / {pages}</span>
            <button disabled={current === pages} onClick={() => setPage(current + 1)}>Next</button>
          </div>
        </div>
      </section>
      <p className="helper">Select Revise to create the next version from the latest saved proposal. Original and historical values remain available in the table and exports.</p>
    </>
  );
}
