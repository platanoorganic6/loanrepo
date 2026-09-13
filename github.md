repo: platanoorganic6/loanrepo
branch: main

## Last sync

date: 2026-09-13T09:30:00Z

### Updated in this project

- Supabase is live: schema + seed applied, credentials in `supabase-config.js`. Verified rates (13), examples (5), waitlist insert, and that RLS rejects anonymous writes to `loan_runs`.
- Added `index.html` — a single self-contained build for static hosting (Render: no build command, publish directory = repo root).

- Connected the repo. It is empty (no commits yet); this project is the starting point, so nothing was imported.
- Added the Supabase data layer: schema + RLS migration, seed data, client module, config stub.
- Wired the app to Supabase: Google + magic-link auth, saved runs, rate history and examples read from the database with a client-side fallback, waitlist, anonymous screen analytics.
- Dropped the "nothing is stored" claim for an accurate one, on the hero and the Method screen.
- Added loan tracking: named loans, a check-in log of what the statement actually said, and a year-in-review panel.
- Added the paid tier: ₹149/mo plans screen, Razorpay Checkout, and a one-loan free gate enforced by a database trigger.
- Added three Edge Functions (razorpay-order, razorpay-webhook, mpc-digest) and a pitch deck.
- Added enter-your-own-spread, a payoff-routes table, a buying-soon screen, a shareable tenure graphic, check-in reconciliation and a mobile pass.
- Added the ebook: manuscript, sales page, purchases table and one-time Razorpay fulfilment.
- Live on loanrepo.in; all in-product links and the APP_URL default point there.
- Book repriced to ₹299; result-page prompt added under the verdict.
- index.html is now an unbundled copy of the app — deploy the whole folder, not one file.

## Screen map

| Project screen | Repo files |
| --- | --- |
| Your loan (calculator + result) | `LoanRepo.dc.html`, `supabase-client.js` |
| Rate cycle | `LoanRepo.dc.html`, `supabase/seed.sql` (`repo_rates`) |
| Examples | `LoanRepo.dc.html`, `supabase/seed.sql` (`examples`) |
| Saved runs / tracking | `LoanRepo.dc.html`, `supabase/migrations/0002_tracking_and_billing.sql` (`tracked_loans`, `check_ins`) |
| Plans / upgrade | `LoanRepo.dc.html`, `supabase/functions/razorpay-order/`, `supabase/functions/razorpay-webhook/` |
| Reset email + MPC digest | `supabase/functions/mpc-digest/` |
| Pitch deck | `LoanRepo Pitch.dc.html` |
| The book (sales page) | `LoanRepo.dc.html`, `supabase/functions/ebook-order/`, `supabase/functions/ebook-webhook/` |
| The book (manuscript) | `Ebook.dc.html`, `doc-page.js` |
| Method (assumptions + waitlist) | `LoanRepo.dc.html`, `README.md` |
| Visual system | `_ds/industry-0aee6b66-0396-4d31-a389-4f4990a07af6/` (linked design system) |
