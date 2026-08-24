# Due Invoices Dashboard

Live, searchable dashboard of outstanding due invoices for Isaac Wellness, reading
from the **"Payment terms"** tab of the shared Google Sheet. Built with Next.js,
deployed on Vercel.

Data is fetched fresh from Google Sheets on every page load (via `/api/data`) —
this is not a static snapshot. Access is gated by a single shared password.

## Local development

1. Copy `.env.example` to `.env.local` and fill in the three values:
   - `GOOGLE_SHEET_ID` — the sheet's ID (from its URL, between `/d/` and `/edit`)
   - `SERVICE_ACCOUNT_JSON` — the full contents of the Google service-account key
     JSON file, as one line
   - `DASHBOARD_PASSWORD` — whatever shared password you want to gate the
     dashboard with locally
2. Install dependencies and run:
   ```bash
   npm install
   npm run dev
   ```
3. Open [http://localhost:3000](http://localhost:3000) — it'll redirect to
   `/login` first.

## Deploying to Vercel

1. Push this repo to GitHub.
2. In Vercel, "Add New Project" → import this GitHub repo. It auto-detects
   Next.js, no config needed.
3. Before the first deploy (or in Project Settings → Environment Variables
   afterward), add the same three variables as above: `GOOGLE_SHEET_ID`,
   `SERVICE_ACCOUNT_JSON`, `DASHBOARD_PASSWORD`.
4. Deploy. If `DASHBOARD_PASSWORD` is missing, every page will show a plain
   500 error explaining that — set it and redeploy.

## How access control works

`src/proxy.ts` (Next.js's server-side request interceptor) checks for a cookie
proving the visitor knows `DASHBOARD_PASSWORD`, redirecting to `/login` if it's
missing. `/login` posts to `/api/login`, which checks the password against the
env var and sets an `httpOnly` cookie (a hash of the password, not the password
itself) on success. There's no user database — it's one shared password for
anyone who needs to view the dashboard.

## Data model

`src/lib/sheets.ts` reads the "Payment terms" tab directly via the Google
Sheets API (read-only scope) and returns every line-item row, typed. The
dashboard page (`src/app/page.tsx`) does all filtering/sorting/searching
client-side against that full dataset — no server-side query params.

Each row is one line item on an invoice — one invoice can have multiple rows
(multiple purchased items). The 1st/2nd/3rd Payment Date/Amount columns are
populated when staff have written a payment plan into that invoice's Invoice
Notes in the source Zenoti report (see the separate `payment_notes_parser.py`
tool in the `DUE INVOICE` project) — most rows won't have one yet.
