import { NextResponse } from "next/server";
import { fetchInvoices } from "@/lib/sheets";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const invoices = await fetchInvoices();
    return NextResponse.json({ invoices, fetchedAt: new Date().toISOString() });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
