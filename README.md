# JejakUang — Simple Personal Finance Tracker

> Lacak uangmu, pahami jejaknya.

A web application for recording daily finances and understanding where your money goes. Track income, expenses, transfers, loans, and debts across cash, bank, and e-wallet accounts — then see plain-language reports of your spending patterns.

## Overview

Many people receive a salary regularly but have no record of where it goes. By the end of the month, the balance has dropped with no clear reason.

JejakUang solves this by making transaction recording fast and simple, then turning the records into facts:

- How much money do I have now?
- How much did I spend this month?
- What is my biggest expense category?
- How much money is currently lent to other people?

The main workflow:

1. Create a financial account (cash, bank, e-wallet, credit card).
2. Record transactions: expense, income, transfer, loan given, loan repayment, debt received, debt payment.
3. Review the dashboard and reports to understand spending patterns.

JejakUang is a statement of facts, not a judgment: it shows you the numbers without telling you how to spend.

## Features

### Core

- **Authentication** — register, login, logout (email + password, bcrypt-hashed, JWT session via NextAuth).
- **Financial accounts** — create, edit, and deactivate accounts (non-destructive; deactivated accounts keep their history).
- **Categories** — 33 default categories (income + expense) created automatically at registration, plus custom categories with create, edit, and deactivate.
- **Transactions** — record 7 types:
  - Income
  - Expense
  - Transfer (between your own accounts; never counted as income/expense)
  - Loan given
  - Loan repayment
  - Debt received
  - Debt payment
- **Loans & contacts** — manage people you lend to or borrow from; receivables (piutang) and debts (hutang) are computed automatically from transactions, with a guard preventing over-repayment.
- **Receipts** — attach a receipt image (JPG, JPEG, PNG, WebP, up to 5 MB) to any transaction; stored locally in development or on Vercel Blob in production.
- **Search & filters** — search by keyword and filter by date range, account, category, type, and amount range.

### Insights

- **Dashboard** — total balance (active accounts), month income/expense/net, comparison vs previous month, top expense categories, recent transactions.
- **Reports** — expense by category and by account, 6-month income/expense trend, per-category monthly budgets.
- **Export** — CSV of a selected month's transactions and full JSON backup of all your data.

### Platform

- **Responsive design** — desktop sidebar navigation and bottom mobile navigation with a prominent `+ Catat` action.
- **PWA** — installable with a web app manifest and service worker (cache-first for static assets, network-first for navigation; offline sync is out of scope).

## Tech Stack

- **Frontend:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4
- **Database:** Neon serverless PostgreSQL
- **ORM:** Drizzle ORM
- **Authentication:** NextAuth v5 (Credentials provider, JWT sessions), bcryptjs
- **Validation:** Zod
- **File storage:** local filesystem (dev) or Vercel Blob (production)
- **Deployment:** Vercel

## Requirements

- Node.js (version compatible with Next.js 16)
- npm
- A Neon PostgreSQL database — either your own project or an ephemeral dev database created via `npm run db:provision`
- A Vercel Blob store token (only when `STORAGE_DRIVER=blob`)

## Getting Started

### Installation

```bash
npm install
cp .env.example .env.local
```

### Configuration

Fill in `.env.local`:

```
DATABASE_URL=<your-value-here>
AUTH_SECRET=<openssl rand -base64 32>
```

`npm run db:provision` can create an ephemeral Neon database for development automatically (see [Database](#database)).

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Neon PostgreSQL connection string |
| `AUTH_SECRET` | Yes | NextAuth secret; generate with `openssl rand -base64 32` |
| `AUTH_URL` | No (local) / Yes (Vercel) | Public app URL; set to the production URL on Vercel (comma-separated for preview deployments) |
| `STORAGE_DRIVER` | No | Receipt storage driver: `local` (default, writes to `public/uploads/`) or `blob` (Vercel Blob) |
| `STORAGE_BLOB_READ_WRITE_TOKEN` | Only when `STORAGE_DRIVER=blob` | Vercel Blob read-write token |

> **Security:** `STORAGE_BLOB_READ_WRITE_TOKEN` is a server-side secret. Never expose it (or any database credentials) to the browser.

### Running Locally

```bash
npm run dev
```

Open http://localhost:3000, register an account, add a financial account, and start recording.

## Project Structure

```
jejakuang/
├── src/
│   ├── actions/       # Server actions: auth, account, category, transaction, contact, budget
│   ├── app/           # Next.js App Router routes and pages
│   ├── components/    # Reusable UI components (forms, nav, filters, charts)
│   ├── db/            # Drizzle schema, DB client, default category seeds
│   ├── lib/           # Core logic: balance engine, loans, reports, validation, storage, formatting
│   ├── types/         # Type declarations
│   ├── auth.config.ts # Edge-safe NextAuth config (middleware)
│   ├── auth.ts        # NextAuth setup with credentials provider
│   └── proxy.ts       # Middleware auth + route matcher
├── drizzle/           # Generated SQL migrations
├── public/            # Static assets, service worker, local receipt uploads
├── scripts/           # Dev tooling: DB provisioning, seeding, smoke tests
├── .env.example
├── drizzle.config.ts
├── next.config.ts
└── package.json
```

Key pages (under `src/app/(app)/`): `/` (Dashboard), `/transactions` (history), `/accounts`, `/loans`, `/reports`, `/settings`.

## Usage

All users have the same role: a personal finance tracker where every user sees only their own data.

- **Dashboard** — total balance, monthly income/expense/net with month-to-month comparison, top spending categories, and recent transactions. Navigate between months with the arrows.
- **Transactions** — browse history grouped by day (20 per page), search by keyword, filter by date/account/category/type/amount, open a transaction to view details, edit, delete (with confirmation), or view its receipt.
- **Accounts** — list financial accounts with derived balances, add new ones, edit names/types/initial balances, and deactivate accounts that are no longer used.
- **Loans** — see outstanding receivables (piutang) and debts (hutang) per contact, and manage contacts.
- **Reports** — monthly expense breakdown by category and account, 6-month trend, per-category budgets for the selected month, and export (CSV per month, JSON full backup).
- **Settings** — create and manage custom categories.

## API / Integrations

Two read-only export endpoints exist. Both require an authenticated session and return data scoped to the logged-in user.

| Endpoint | Description |
|---|---|
| `GET /api/export/csv?month=YYYY-MM` | Transactions of the selected month as CSV (`Tanggal,Tipe,Deskripsi,Akun,Kategori,Kontak,Nominal,Catatan`) |
| `GET /api/export/json` | Full user backup: accounts, categories, contacts, transactions, transfers, loans, receipts, budgets as JSON |

External integrations: none. Receipts are stored either on the local filesystem (`STORAGE_DRIVER=local`) or Vercel Blob (`STORAGE_DRIVER=blob`) — the storage layer is abstracted, so neither option requires changes to transaction logic.

## Database

- **Technology:** Neon serverless PostgreSQL, accessed via Drizzle ORM (HTTP driver).
- **Migrations:** SQL files in `drizzle/`, managed with Drizzle Kit.

```bash
npm run db:generate   # generate migration files from the schema
npm run db:migrate    # apply migrations to the database
npm run db:push       # push schema directly (dev only)
```

- **Ephemeral dev database:** `npm run db:provision` creates a short-lived Neon Claimable Postgres, writes `DATABASE_URL` into `.env.local` (preserving your other keys), generates an `AUTH_SECRET` on first run, and applies migrations.
- **Seed data:** `npm run db:seed-dummy` creates a demo user (`demo@jejakuang.dev` / `demo1234`) with accounts, default categories, and sample transactions. `npm run db:setup` runs provisioning + seeding together.
- **Important tables:** `users`, `money_accounts`, `categories`, `contacts`, `transactions`, `transfers`, `loans`, `receipts`, `budgets`.

> Development should use a separate Neon database from production. Never point `DATABASE_URL` at a production database during development.

## Development

```bash
npm run dev          # start the development server
npm run lint         # ESLint (0 errors/warnings expected)
npm run build        # production build
npx tsc --noEmit     # TypeScript type check
```

There is no separate formatter configuration; linting covers code style.

## Testing

The project has no test framework yet. The critical balance engine (which types affect which accounts, and by how much) is verified by a self-checking script:

```bash
npx tsx src/lib/balance.selfcheck.ts
```

It asserts the balance rules from the PRD: income/expense effects, transfers that never change total balance, and loan/debt transactions that move money without being counted as income or expense.

## Deployment

Deploy to Vercel (a push to the production branch triggers an automatic deployment):

1. In Vercel project settings, set the environment variables:
   - `AUTH_SECRET`, `AUTH_URL` (production URL), `STORAGE_DRIVER=blob`, `STORAGE_BLOB_READ_WRITE_TOKEN`, `CRON_SECRET`.
   - No `DATABASE_URL`: the prod DB is a Neon.new ephemeral Postgres (72h TTL) that auto-rotates before expiry. The active connection is published to Vercel Blob (`jejakuang/db.json`) by the rotation flow — GitHub Actions (hourly, secret `CRON_SECRET` + variable `PROD_URL`) plus the Vercel daily cron (`/api/cron/rotate-db`). The first scheduled run bootstraps an empty DB shortly after deploy; expect DB-dependent requests to fail until then.
2. Deploy, then verify: register/login works, balances match, receipts upload and display.

## Security & Privacy

This application handles personal financial data. Design principles:

- Every data entity is scoped by `user_id`; all queries are restricted to the authenticated user, and all mutations run server-side authorization checks.
- Passwords are hashed with bcrypt (cost 10); sessions use JWT via NextAuth.
- All input is validated server-side with Zod (amounts, dates, ownership of accounts/categories/contacts, receipt file type and size).
- Receipts are validated (JPG/JPEG/PNG/WebP, ≤5 MB) and access is owner-only through transaction detail.
- Server-side secrets (`AUTH_SECRET`, `STORAGE_BLOB_READ_WRITE_TOKEN`, `CRON_SECRET`) live only in environment variables and are never sent to the browser. The active DB connection string lives in Vercel Blob, readable only with the same token.
- No functionality relies on client-side filtering for authorization.

## Roadmap

Planned, not yet implemented (see the PRD for details):

- **Phase 2:** recurring transactions, advanced reports
- **Future ideas:** receipt OCR, bank synchronization, WhatsApp input

## Contributing

1. Fork the repository.
2. Create a feature branch.
3. Make your changes.
4. Run linting and a production build (`npm run lint`, `npm run build`).
5. Open a pull request.

## License

MIT License — see [LICENSE](LICENSE).

