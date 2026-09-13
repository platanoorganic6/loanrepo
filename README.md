# LoanRepo

Runs a floating-rate Indian home loan through the actual RBI repo rate history, reset by reset, and shows what the rate cycle did to its tenure and balance. No lender affiliation, no commission, descriptive rather than prescriptive.

The app is a single self-contained page. `LoanRepo.dc.html` carries the UI and the amortization engine; the engine works with no backend at all, falling back to a bundled copy of the rate history.

## Files

| Path | What it is |
| --- | --- |
| `LoanRepo.dc.html` | The whole app — calculator, rate cycle, examples, method, tracking, plans, and the engine |
| `LoanRepo Pitch.dc.html` | The market and business case, as a deck |
| `Ebook.dc.html` | The Quiet Years — sixteen chapters, print/PDF-ready. Reads loan figures from props or query params for a personalised edition |
| `Ebook.html` | Deployed copy of the book (the app links to it) |
| `doc-page.js` | Paged-document shell the ebook is built on |
| `index.html` | Self-contained build for static hosting. Regenerate after any change |
| `_ds/industry-…/` | The Industry design system — tokens, component classes, bundle. Linked, not forked |
| `supabase-config.js` | Your project URL and anon key — fill these in |
| `supabase-client.js` | The data layer. Exposes `window.LoanRepoDB` |
| `supabase/migrations/0001_init.sql` | Tables, constraints, RLS policies |
| `supabase/migrations/0002_tracking_and_billing.sql` | Tracked loans, check-ins, subscriptions, the free-tier trigger |
| `supabase/seed.sql` | The 13 MPC rate decisions and 5 published examples |
| `supabase/functions/razorpay-order/` | Creates a Razorpay subscription. Holds the key secret |
| `supabase/functions/razorpay-webhook/` | The only writer of `subscriptions`. Verifies the HMAC |
| `supabase/functions/mpc-digest/` | Scheduled email: the rate moved, and your reset is due |
| `supabase/migrations/0003_ebook_purchases.sql` | Ebook purchases |
| `supabase/functions/ebook-order/` | Creates a one-time Razorpay order for the book |
| `supabase/functions/ebook-webhook/` | Marks it paid and emails a signed download link |

## Setup

1. Create a Supabase project.
2. Run the schema and seed:

   ```bash
   supabase link --project-ref <ref>
   supabase db push                     # applies supabase/migrations
   psql "$DATABASE_URL" -f supabase/seed.sql
   ```

   Or paste them into the SQL editor in this order: `0001_init.sql`, `0002_tracking_and_billing.sql`, `0003_ebook_purchases.sql`, `0004_personalised_editions.sql`, then `seed.sql`.

3. Put your URL and **anon public** key into `supabase-config.js`. The anon key is meant to be public — RLS is what protects the data. Never put the `service_role` key in a client file.

4. For Google sign-in: Supabase → Authentication → Providers → Google, add your OAuth client, and add the page's URL to **Redirect URLs**. Magic links need no extra provider setup, but the same URL must be allowed.

Open `LoanRepo.dc.html`. With the config blank the app runs fully client-side; with it filled in, auth, tracking, the rate table, the examples library, the waitlist and analytics all come alive.

## Edge Functions

Everything above works without these. They add payments and email.

```bash
supabase functions deploy razorpay-order
supabase functions deploy razorpay-webhook --no-verify-jwt   # Razorpay calls it, not a user
supabase functions deploy mpc-digest      --no-verify-jwt   # cron calls it
supabase functions deploy ebook-order     --no-verify-jwt   # buyers need no account
supabase functions deploy ebook-webhook   --no-verify-jwt

supabase secrets set RAZORPAY_KEY_ID=... RAZORPAY_KEY_SECRET=... RAZORPAY_PLAN_ID=...
supabase secrets set RAZORPAY_WEBHOOK_SECRET=...
supabase secrets set RESEND_API_KEY=... DIGEST_FROM="LoanRepo <hello@yourdomain>" APP_URL=https://loanrepo.in
supabase secrets set EBOOK_PRICE_PAISE=29900
```

Then in Razorpay, create a ₹149/month plan — its id is `RAZORPAY_PLAN_ID` — and under Settings → Webhooks add the `razorpay-webhook` URL subscribed to `subscription.activated`, `.charged`, `.halted`, `.cancelled`, `.completed` and `.pending`. Schedule `mpc-digest` daily under Integrations → Cron.

The client never decides it is paid. `startCheckout` asks `razorpay-order` for a subscription, Checkout runs, and the app polls `subscriptions` until the webhook has written the row. `subscriptions` has no client write policy at all, and the Razorpay key secret exists only in the function's environment.

## Data model

- **`repo_rates`** — the MPC decision history. Public read, writes are service-role only. The app reads this at load and falls back to its bundled copy if the table is empty or unreachable, so a bad deploy never breaks the calculator.
- **`examples`** — the case-study library. Public read of `published = true`; unpublished rows are invisible to the anon key. Add a row, flip `published`, and it appears in the Examples table computed live.
- **`tracked_loans`** — a borrower's loan: the particulars plus a `result` snapshot of the verdict at save time. Strictly owner-scoped in all four directions (select/insert/update/delete all gated on `auth.uid() = user_id`). A `before insert` trigger enforces the one-loan free tier in the database, so the gate holds against direct API calls, not just the UI.
- **`check_ins`** — what the borrower saw on their own statement: rate, EMI, outstanding, months remaining, and whether tenure or EMI absorbed the change. Owner-scoped. The year-in-review and the digest read from this, and where it disagrees with the model, it wins.
- **`subscriptions`** — one row per user, readable by its owner, written only by the webhook. `is_pro(uid)` is the single definition of paid.
- **`payment_events`** and **`digest_log`** — service-role only, both for idempotency: a webhook retry cannot double-grant, a double cron run cannot double-email.
- **`waitlist`** — insert-only for everyone, unreadable through the anon key.
- **`usage_events`** — insert-only, unreadable through the anon key. Screen views and a `run_saved` event carrying only the benchmark. Loan amounts are never sent here.
- **`profiles`** — created by an `on_auth_user_created` trigger; owner read/update only.

## Privacy stance

The calculation happens in the browser. Particulars leave it only when a signed-in user presses **Track this loan**, and only that account can read them back. The page says this in those words on the hero and on the Method screen — if you change the data flow, change that copy in the same commit.

## Model assumptions

Stated in the app on the Method screen, and worth repeating: the EBLR spread defaults to 2.65% and MCLR to 3.75%, EBLR resets quarterly and MCLR annually, and past the current month the model holds the repo rate flat rather than forecasting. Your real spread is in your sanction letter; a spread 0.25% off moves a 20-year result by roughly a year. An enter-your-own-spread field is the next feature.

## The ebook

`Ebook.dc.html` is the manuscript, laid out and print-ready. Export it to PDF, then upload the file to a **private** Supabase Storage bucket named `ebook`, as `the-quiet-years.pdf`. Private is the point — a public bucket makes the ₹199 decorative.

Fulfilment: the buyer gives an email on the book page, `ebook-order` creates a Razorpay order, Checkout runs, and `ebook-webhook` verifies the signature, marks the purchase paid and emails a signed URL valid for fourteen days. The browser never sees the file URL, and a webhook retry will not send the email twice.

Add `order.paid` and `payment.captured` to the Razorpay webhook pointing at `ebook-webhook`.

### Personalised editions

The book reads its loan figures from query params, so the app can link a reader straight to a copy written against their own loan — `Ebook.html?amount=…&start=…&tenure=…&actual=…&rate0=…&rate1=…&emi=…&bal=…&bm=…&resets=…`. Chapters one, seven and nine’s worked examples and chapter fifteen’s reset dates all fill in; with no params the same file is the general edition. Free and paid are drawn on one line: the **result PDF stays free** (the diagnosis, which the manifesto promises), and the **book is the treatment** at ₹299. A reader who has run their loan reads chapters one and two free, with their own figures already in them, via `&sample=1` — the remaining fourteen are gated. That gate is client-side, so treat it as a norm rather than a vault; the enforced boundary is the emailed copy.

On purchase, the loan query string travels with the order and is stored on `purchases.loan_query`, so `ebook-webhook` emails a link to the buyer's **personalised** edition (plus the generic PDF as a fallback). Buyers who never ran their loan get the generic PDF and an invitation to run it. Nothing about the loan is persisted beyond that query string.

## Legal pages

About, Terms, Privacy, Refunds, Contact and Copyright live on one `legal` screen with six tabs, linked from the footer. The privacy policy describes what the code actually does (browser-only calculation, RLS on every table, three named processors, anonymous analytics) rather than boilerplate — if the data flow changes, that page has to change with it.

Five operator facts are Tweaks props on the root DC, not hardcoded: `legalEntity`, `legalAddress`, `contactEmail`, `grievanceOfficer`, `jurisdiction`. **Set all five before taking payments** — Razorpay's merchant review checks for a real business name, address and contact, and the defaults are placeholders.
