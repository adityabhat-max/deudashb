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

function KpiCard({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="bg-white border border-[#e7dcd4] rounded-xl p-5 shadow-sm min-w-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#a8988d] mb-2 truncate">
        {label}
      </p>
      <p
        className={`text-2xl font-semibold tabular-nums truncate ${
          emphasize ? "text-[#7a2e40]" : "text-[#2a211d]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  optionLabels,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  optionLabels?: Record<string, string>;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="border border-[#e7dcd4] rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#7a2e40] focus:border-transparent"
    >
      <option value="All">{label}: All</option>
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {optionLabels?.[opt] ?? opt}
        </option>
      ))}
    </select>
  );
}

export default function DashboardPage() {
  const [invoices, setInvoices] = useState<InvoiceRow[] | null>(null);
  const [roster, setRoster] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [center, setCenter] = useState<string>("All");
  const [soldBy, setSoldBy] = useState<string>("All");
  const [nextPaymentFilter, setNextPaymentFilter] = useState<"All" | "Has" | "None">("All");
  const [planFilter, setPlanFilter] = useState<"All" | "Has" | "None">("All");
  const [dueFilter, setDueFilter] = useState<"All" | "DueOnly" | "PaidOff">("All");
  const [itemTypeFilter, setItemTypeFilter] = useState<string>("All");
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
      setRoster(data.roster || {});
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

  const itemTypes = useMemo(() => {
    if (!invoices) return [];
    const set = new Set(invoices.map((r) => r.itemType).filter(Boolean));
    return Array.from(set).sort();
  }, [invoices]);

  const soldByList = useMemo(() => {
    // Sourced from the Sheet6 staff roster (scoped to the selected center),
    // not from who happens to have a due invoice — so everyone on staff is
    // selectable, including people with zero invoices right now.
    if (center === "All") {
      const set = new Set(Object.values(roster).flat());
      return Array.from(set).sort();
    }
    return [...(roster[center] || [])].sort();
  }, [roster, center]);

  function handleCenterChange(next: string) {
    setCenter(next);
    setSoldBy("All"); // avoid landing on a Sold By value that doesn't exist at the new center
  }

  // Everything except the Item Type filter — the item-type KPI cards use
  // this (not `filtered`) so they always show the full type breakdown
  // within the rest of the current filter context, even once a single type
  // is selected below.
  const baseFiltered = useMemo(() => {
    if (!invoices) return [];
    const q = query.trim().toLowerCase();
    return invoices.filter((r) => {
      if (center !== "All" && r.centerName !== center) return false;
      if (soldBy !== "All" && r.soldBy !== soldBy) return false;

      if (nextPaymentFilter === "Has" && !r.nextPaymentDate) return false;
      if (nextPaymentFilter === "None" && r.nextPaymentDate) return false;

      if (planFilter === "Has" && !hasPaymentPlan(r)) return false;
      if (planFilter === "None" && hasPaymentPlan(r)) return false;

      if (dueFilter === "DueOnly" && r.due <= 0) return false;
      if (dueFilter === "PaidOff" && r.due > 0) return false;

      if (!q) return true;
      return (
        r.invoiceNo.toLowerCase().includes(q) ||
        r.guestName.toLowerCase().includes(q) ||
        r.guestCode.toLowerCase().includes(q)
      );
    });
  }, [invoices, query, center, soldBy, nextPaymentFilter, planFilter, dueFilter]);

  const filtered = useMemo(() => {
    if (itemTypeFilter === "All") return baseFiltered;
    return baseFiltered.filter((r) => r.itemType === itemTypeFilter);
  }, [baseFiltered, itemTypeFilter]);

  const itemTypeBreakdown = useMemo(() => {
    const due = new Map<string, number>();
    for (const r of baseFiltered) {
      due.set(r.itemType, (due.get(r.itemType) || 0) + r.due);
    }
    return itemTypes.map((type) => ({ type, due: due.get(type) || 0 }));
  }, [baseFiltered, itemTypes]);

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
    return { totalDue, invoiceCount: invoiceSet.size };
  }, [filtered]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "due" || key === "collected" ? "desc" : "asc");
    }
  }

  function SortHeader({
    label,
    sortKeyName,
    hideBelow,
  }: {
    label: string;
    sortKeyName: SortKey;
    hideBelow?: "sm" | "md";
  }) {
    const active = sortKey === sortKeyName;
    const visibility = hideBelow === "sm" ? "hidden sm:table-cell" : hideBelow === "md" ? "hidden md:table-cell" : "";
    return (
      <th
        className={`${visibility} text-left text-xs font-semibold uppercase tracking-wide text-[#a8988d] px-2 py-2.5 cursor-pointer select-none break-words`}
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
      <div className="w-full px-4 sm:px-8 lg:px-12 py-10">
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
            Live from the &quot;Payment terms&quot; sheet · Due invoices from 12 Aug 2026 to today
          </p>
        </header>

        {error && (
          <div className="mb-6 rounded-lg border border-[#e7b3b3] bg-[#fbeaea] text-[#8a2e2e] px-4 py-3 text-sm">
            Could not load data: {error}
          </div>
        )}

        {/* KPI row — Total due + Invoices, then one card per Item Type
            (due-only, always reflecting the full type breakdown within the
            other active filters). Auto-fit keeps every card the same width
            and perfectly aligned no matter how many item types exist. */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(9.375rem,1fr))] gap-3 mb-6">
          <KpiCard label="Total due" value={loading ? "…" : `₹${formatINR(totals.totalDue)}`} emphasize />
          <KpiCard label="Invoices" value={loading ? "…" : String(totals.invoiceCount)} />
          {itemTypeBreakdown.map(({ type, due }) => (
            <KpiCard key={type} label={`${type} due`} value={loading ? "…" : `₹${formatINR(due)}`} emphasize />
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white border border-[#e7dcd4] rounded-xl p-4 mb-4 shadow-sm">
          <input
            type="text"
            placeholder="Search invoice no. or guest name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full border border-[#e7dcd4] rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#7a2e40] focus:border-transparent mb-3"
          />
          <div className="flex flex-wrap gap-3">
            <FilterSelect label="Center" value={center} onChange={handleCenterChange} options={centers} />
            <FilterSelect label="Sold by" value={soldBy} onChange={setSoldBy} options={soldByList} />
            <FilterSelect label="Item type" value={itemTypeFilter} onChange={setItemTypeFilter} options={itemTypes} />
            <FilterSelect
              label="Next payment date"
              value={nextPaymentFilter}
              onChange={(v) => setNextPaymentFilter(v as typeof nextPaymentFilter)}
              options={["Has", "None"]}
              optionLabels={{ Has: "Has a date", None: "No date set" }}
            />
            <FilterSelect
              label="Payment plan"
              value={planFilter}
              onChange={(v) => setPlanFilter(v as typeof planFilter)}
              options={["Has", "None"]}
              optionLabels={{ Has: "Has a plan", None: "No plan" }}
            />
            <FilterSelect
              label="Due status"
              value={dueFilter}
              onChange={(v) => setDueFilter(v as typeof dueFilter)}
              options={["DueOnly", "PaidOff"]}
              optionLabels={{ DueOnly: "Still due", PaidOff: "Fully collected" }}
            />
            {(center !== "All" ||
              soldBy !== "All" ||
              itemTypeFilter !== "All" ||
              nextPaymentFilter !== "All" ||
              planFilter !== "All" ||
              dueFilter !== "All" ||
              query) && (
              <button
                onClick={() => {
                  setQuery("");
                  setCenter("All");
                  setSoldBy("All");
                  setItemTypeFilter("All");
                  setNextPaymentFilter("All");
                  setPlanFilter("All");
                  setDueFilter("All");
                }}
                className="text-sm px-3 py-1.5 rounded-lg text-[#7a2e40] hover:bg-[#f6e2e7] transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Table — fixed-width columns summing to 100% so the table never
            exceeds the viewport width; cells wrap instead of overflowing,
            so the page only ever scrolls vertically, never sideways. Center,
            item, type, collected, next payment and plan only join once
            there's enough width to show them without cramming — they're
            always available in the detail panel on tap/click regardless. */}
        <div className="bg-white border border-[#e7dcd4] rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e7dcd4]">
                <SortHeader label="Invoice" sortKeyName="invoiceNo" />
                <SortHeader label="Guest" sortKeyName="guestName" />
                <SortHeader label="Center" sortKeyName="centerName" hideBelow="sm" />
                <th className="hidden md:table-cell text-left text-xs font-semibold uppercase tracking-wide text-[#a8988d] px-2 py-2.5 break-words">
                  Item
                </th>
                <th className="hidden sm:table-cell text-left text-xs font-semibold uppercase tracking-wide text-[#a8988d] px-2 py-2.5 break-words">
                  Type
                </th>
                <SortHeader label="Due" sortKeyName="due" />
                <SortHeader label="Collected" sortKeyName="collected" hideBelow="md" />
                <SortHeader label="Next payment" sortKeyName="nextPaymentDate" hideBelow="sm" />
                <th className="hidden sm:table-cell text-left text-xs font-semibold uppercase tracking-wide text-[#a8988d] px-1.5 py-2.5 break-words">
                  Plan
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-[#a8988d]">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && sorted.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-[#a8988d]">
                    No matching invoices.
                  </td>
                </tr>
              )}
              {!loading &&
                sorted.map((row, idx) => (
                  <tr
                    key={`${row.invoiceNo}-${idx}`}
                    onClick={() => setSelected(row)}
                    className="border-b border-[#f1ebe6] last:border-0 hover:bg-[#f6e2e7] cursor-pointer transition-colors align-top"
                  >
                    <td className="px-3 py-2.5 font-medium break-words">{row.invoiceNo}</td>
                    <td className="px-3 py-2.5 break-words">{row.guestName}</td>
                    <td className="hidden sm:table-cell px-3 py-2.5 text-[#7a685e] break-words">{row.centerName}</td>
                    <td className="hidden md:table-cell px-3 py-2.5 text-[#7a685e] break-words">{row.itemName}</td>
                    <td className="hidden sm:table-cell px-1.5 py-2.5">
                      <span className="inline-flex items-center rounded-full bg-[#f1ebe6] text-[#7a685e] text-xs font-medium px-1.5 py-0.5">
                        {row.itemType || "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-medium">₹{formatINR(row.due)}</td>
                    <td className="hidden md:table-cell px-3 py-2.5 text-right tabular-nums text-[#7a685e]">
                      ₹{formatINR(row.collected)}
                    </td>
                    <td className="hidden sm:table-cell px-3 py-2.5 text-[#7a685e] break-words">
                      {row.nextPaymentDate || "—"}
                    </td>
                    <td className="hidden sm:table-cell px-1.5 py-2.5">
                      {hasPaymentPlan(row) ? (
                        <span className="inline-flex items-center rounded-full bg-[#e3ece7] text-[#3f5f4f] text-xs font-medium px-1.5 py-0.5">
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
            <dt className="text-[#a8988d] text-xs uppercase tracking-wide mb-0.5">Item type</dt>
            <dd>{row.itemType || "—"}</dd>
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
