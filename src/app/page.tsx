"use client";

import { useEffect, useMemo, useState } from "react";
import type { InvoiceRow } from "@/lib/sheets";

type SortKey = "invoiceNo" | "guestName" | "centerName" | "due" | "collected" | "nextPaymentDate";
type SortDir = "asc" | "desc";

function formatINR(n: number): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Math.round(n));
}

function hasPaymentPlan(row: InvoiceRow): boolean {
  return Boolean(row.payment1Date);
}

export default function DashboardPage() {
  const [invoices, setInvoices] = useState<InvoiceRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [center, setCenter] = useState<string>("All");
  const [sortKey, setSortKey] = useState<SortKey>("due");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selected, setSelected] = useState<InvoiceRow | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/data", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load data");
      setInvoices(data.invoices);
      setFetchedAt(data.fetchedAt);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const centers = useMemo(() => {
    if (!invoices) return [];
    const set = new Set(invoices.map((r) => r.centerName));
    return Array.from(set).sort();
  }, [invoices]);

  const filtered = useMemo(() => {
    if (!invoices) return [];
    const q = query.trim().toLowerCase();
    return invoices.filter((r) => {
      if (center !== "All" && r.centerName !== center) return false;
      if (!q) return true;
      return (
        r.invoiceNo.toLowerCase().includes(q) ||
        r.guestName.toLowerCase().includes(q) ||
        r.guestCode.toLowerCase().includes(q)
      );
    });
  }, [invoices, query, center]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "due" || sortKey === "collected") {
        cmp = a[sortKey] - b[sortKey];
      } else {
        cmp = String(a[sortKey]).localeCompare(String(b[sortKey]));
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  const totals = useMemo(() => {
    const totalDue = filtered.reduce((sum, r) => sum + r.due, 0);
    const invoiceSet = new Set(filtered.map((r) => r.invoiceNo).filter(Boolean));
    const centerSet = new Set(filtered.map((r) => r.centerName));
    return { totalDue, invoiceCount: invoiceSet.size, centerCount: centerSet.size };
  }, [filtered]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "due" || key === "collected" ? "desc" : "asc");
    }
  }

  function SortHeader({ label, sortKeyName }: { label: string; sortKeyName: SortKey }) {
    const active = sortKey === sortKeyName;
    return (
      <th
        className="text-left text-xs font-semibold uppercase tracking-wide text-[#a8988d] px-3 py-2.5 cursor-pointer select-none whitespace-nowrap"
        onClick={() => toggleSort(sortKeyName)}
      >
        <span className={active ? "text-[#7a2e40]" : ""}>
          {label}
          {active ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
        </span>
      </th>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf5f1] text-[#2a211d]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <header className="mb-8">
          <p className="text-xs font-semibold tracking-wide uppercase text-[#7a2e40] mb-2">
            Isaac Wellness · Due Invoices
          </p>
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h1 className="text-3xl font-serif">Due Invoices Dashboard</h1>
            <button
              onClick={load}
              disabled={loading}
              className="text-sm px-3 py-1.5 rounded-lg border border-[#e7dcd4] bg-white hover:bg-[#f6e2e7] transition-colors disabled:opacity-50"
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
          <p className="text-sm text-[#a8988d] mt-2">
            Live from the &quot;Payment terms&quot; sheet
            {fetchedAt ? ` · fetched ${new Date(fetchedAt).toLocaleString("en-IN")}` : ""}
          </p>
        </header>

        {error && (
          <div className="mb-6 rounded-lg border border-[#e7b3b3] bg-[#fbeaea] text-[#8a2e2e] px-4 py-3 text-sm">
            Could not load data: {error}
          </div>
        )}

        {/* KPI row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <div className="bg-white border border-[#e7dcd4] rounded-xl p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#a8988d] mb-2">Total due</p>
            <p className="text-3xl font-semibold text-[#7a2e40]">
              {loading ? "…" : `₹${formatINR(totals.totalDue)}`}
            </p>
          </div>
          <div className="bg-white border border-[#e7dcd4] rounded-xl p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#a8988d] mb-2">Invoices</p>
            <p className="text-3xl font-semibold">{loading ? "…" : totals.invoiceCount}</p>
          </div>
          <div className="bg-white border border-[#e7dcd4] rounded-xl p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#a8988d] mb-2">Centers</p>
            <p className="text-3xl font-semibold">{loading ? "…" : totals.centerCount}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-4">
          <input
            type="text"
            placeholder="Search invoice no. or guest name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 min-w-[240px] border border-[#e7dcd4] rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#7a2e40] focus:border-transparent"
          />
          <select
            value={center}
            onChange={(e) => setCenter(e.target.value)}
            className="border border-[#e7dcd4] rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#7a2e40] focus:border-transparent"
          >
            <option value="All">All centers</option>
            {centers.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="bg-white border border-[#e7dcd4] rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e7dcd4]">
                <SortHeader label="Invoice" sortKeyName="invoiceNo" />
                <SortHeader label="Guest" sortKeyName="guestName" />
                <SortHeader label="Center" sortKeyName="centerName" />
                <th className="text-left text-xs font-semibold uppercase tracking-wide text-[#a8988d] px-3 py-2.5">
                  Item
                </th>
                <SortHeader label="Due" sortKeyName="due" />
                <SortHeader label="Collected" sortKeyName="collected" />
                <SortHeader label="Next payment" sortKeyName="nextPaymentDate" />
                <th className="text-left text-xs font-semibold uppercase tracking-wide text-[#a8988d] px-3 py-2.5">
                  Plan
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-[#a8988d]">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && sorted.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-[#a8988d]">
                    No matching invoices.
                  </td>
                </tr>
              )}
              {!loading &&
                sorted.map((row, idx) => (
                  <tr
                    key={`${row.invoiceNo}-${idx}`}
                    onClick={() => setSelected(row)}
                    className="border-b border-[#f1ebe6] last:border-0 hover:bg-[#f6e2e7] cursor-pointer transition-colors"
                  >
                    <td className="px-3 py-2.5 font-medium whitespace-nowrap">{row.invoiceNo}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{row.guestName}</td>
                    <td className="px-3 py-2.5 text-[#7a685e] whitespace-nowrap">{row.centerName}</td>
                    <td className="px-3 py-2.5 text-[#7a685e] max-w-[220px] truncate">{row.itemName}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-medium">₹{formatINR(row.due)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-[#7a685e]">
                      ₹{formatINR(row.collected)}
                    </td>
                    <td className="px-3 py-2.5 text-[#7a685e] whitespace-nowrap">
                      {row.nextPaymentDate || "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      {hasPaymentPlan(row) ? (
                        <span className="inline-flex items-center rounded-full bg-[#e3ece7] text-[#3f5f4f] text-xs font-medium px-2 py-0.5">
                          Yes
                        </span>
                      ) : (
                        <span className="text-[#c3b8ae] text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-[#a8988d] mt-3">
          Showing {sorted.length} of {invoices?.length ?? 0} line items. Click a row for full detail.
        </p>
      </div>

      {selected && <DetailPanel row={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function DetailPanel({ row, onClose }: { row: InvoiceRow; onClose: () => void }) {
  const installments = [
    { label: "1st payment", date: row.payment1Date, amount: row.payment1Amount },
    { label: "2nd payment", date: row.payment2Date, amount: row.payment2Amount },
    { label: "3rd payment", date: row.payment3Date, amount: row.payment3Amount },
  ].filter((p) => p.date);

  return (
    <div
      className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#7a2e40] mb-1">
              Invoice {row.invoiceNo}
            </p>
            <h2 className="text-xl font-serif text-[#2a211d]">{row.guestName}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-[#a8988d] hover:text-[#2a211d] text-xl leading-none px-1"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm mb-5">
          <div>
            <dt className="text-[#a8988d] text-xs uppercase tracking-wide mb-0.5">Center</dt>
            <dd>{row.centerName}</dd>
          </div>
          <div>
            <dt className="text-[#a8988d] text-xs uppercase tracking-wide mb-0.5">Sale date</dt>
            <dd>{row.saleDate || "—"}</dd>
          </div>
          <div>
            <dt className="text-[#a8988d] text-xs uppercase tracking-wide mb-0.5">Item</dt>
            <dd>{row.itemName || "—"}</dd>
          </div>
          <div>
            <dt className="text-[#a8988d] text-xs uppercase tracking-wide mb-0.5">Sold by</dt>
            <dd>{row.soldBy || "—"}</dd>
          </div>
          <div>
            <dt className="text-[#a8988d] text-xs uppercase tracking-wide mb-0.5">Sales (Inc. Tax)</dt>
            <dd className="tabular-nums">₹{formatINR(row.salesIncTax)}</dd>
          </div>
          <div>
            <dt className="text-[#a8988d] text-xs uppercase tracking-wide mb-0.5">Collected</dt>
            <dd className="tabular-nums">₹{formatINR(row.collected)}</dd>
          </div>
          <div>
            <dt className="text-[#a8988d] text-xs uppercase tracking-wide mb-0.5">Due</dt>
            <dd className="tabular-nums font-semibold text-[#7a2e40]">₹{formatINR(row.due)}</dd>
          </div>
          <div>
            <dt className="text-[#a8988d] text-xs uppercase tracking-wide mb-0.5">Next payment date</dt>
            <dd>{row.nextPaymentDate || "—"}</dd>
          </div>
        </dl>

        <div className="border-t border-[#e7dcd4] pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#a8988d] mb-3">
            Payment plan
          </p>
          {installments.length === 0 ? (
            <p className="text-sm text-[#a8988d]">No structured payment plan recorded for this invoice.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {installments.map((p) => (
                <li
                  key={p.label}
                  className="flex items-center justify-between bg-[#faf5f1] rounded-lg px-3 py-2 text-sm"
                >
                  <span className="text-[#7a685e]">
                    {p.label} · {p.date}
                  </span>
                  <span className="tabular-nums font-medium">
                    {p.amount != null ? `₹${formatINR(p.amount)}` : "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
