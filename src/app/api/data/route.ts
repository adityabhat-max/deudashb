import { NextResponse } from "next/server";
import { fetchInvoices, fetchRoster } from "@/lib/sheets";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const invoices = await fetchInvoices();

    // Roster failure shouldn't take down the whole dashboard — the invoice
    // table is the primary content. Fall back to an empty roster and note
    // the error instead.
    let roster: Record<string, string[]> = {};
    let rosterError: string | null = null;
    try {
      roster = await fetchRoster();
    } catch (e) {
      rosterError = e instanceof Error ? e.message : "Unknown error";
    }

    return NextResponse.json({
      invoices,
      roster,
      rosterError,
      fetchedAt: new Date().toISOString(),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
