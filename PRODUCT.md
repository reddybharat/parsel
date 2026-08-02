# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Individuals in India tracking their own personal spending and cash flow in INR — often reviewing what they spent, finding past transactions, and asking questions about their history without leaving the app.

## Product Purpose

Parsel is an INR-focused personal finance tracker. Users log and search transactions tagged by bank (SBI, Kotak, Slice), view spending dashboards, import CSV or bank statements, export CSV, and ask natural-language questions over their own transaction data through a conversational assistant. Success means a trustworthy personal ledger they can operate quickly and query in plain language.

## Positioning

INR-first personal ledger with conversational Q&A over the user’s own transactions (read-only SQL via the chat assistant) — not a multi-currency wealth platform or a bank aggregator. Banks are labels on transactions (statement file import), not linked accounts or live balances.

## Operating Context

- Overview dashboard for monthly spend, category breakdowns, and recent activity, with month and bank filters
- Searchable ledger to filter, sort, create, edit, delete, and export transactions (including by bank)
- Bulk import via CSV template or bank statements (SBI Excel/PDF, Kotak PDF, Slice PDF), with review before save
- Chat assistant for read-only questions over transaction data (including bank-scoped totals)
- Auth via register/login with JWT-scoped per-user data

## Capabilities and Constraints

- All amounts are stored and displayed in Indian Rupees (₹)
- Each transaction may carry a `bank` label from a fixed allowlist; new creates/imports require it
- Multi-user: transactions and chat threads are scoped to the authenticated user
- Chat assistant is read-only over transaction data (no write tools for money movement)
- Stack: React (Vite) frontend, FastAPI backend, PostgreSQL
- Dev UI typically at `http://127.0.0.1:5173`; API at `http://127.0.0.1:8000`

## Brand Commitments

- Product name: **Parsel**
- Currency presentation: Indian Rupee (₹)

## Evidence on Hand

- Product and setup docs: `README.md`, `ARCHITECTURE.md`
- UI sources under `frontend/src/` (Overview, Search/ledger, Add/import, Chat, Auth)
- No customer testimonials, press, or third-party case studies in-repo — do not fabricate them

## Product Principles

1. Trust the ledger — numbers and history must feel accurate and inspectable.
2. Operate in INR without friction — currency is a given, not a setting.
3. Make finding and logging transactions fast — search and entry are core jobs.
4. Answer questions from the user’s own data — chat is grounded, not speculative advice.
5. Keep personal data scoped — every view and query belongs to the signed-in user.
