-- LoanRepo Stage 1A: one-time personalised Borrower's Guide purchases.
-- The browser never writes this table directly. Edge Functions use the secret key.
create table if not exists public.ebook_orders (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  product text not null default 'quiet_years_personalised',
  amount_paise integer not null default 29900 check (amount_paise > 0),
  currency text not null default 'INR',
  status text not null default 'pending' check (status in ('pending','paid','failed','refunded')),
  razorpay_order_id text unique,
  razorpay_payment_id text,
  razorpay_event_id text,
  loan_query jsonb,
  access_token_hash text,
  access_expires_at timestamptz,
  fulfillment_started_at timestamptz,
  email_sent_at timestamptz,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists ebook_orders_email_idx on public.ebook_orders(email);
create index if not exists ebook_orders_status_idx on public.ebook_orders(status);
create unique index if not exists ebook_orders_event_idx on public.ebook_orders(razorpay_event_id) where razorpay_event_id is not null;

alter table public.ebook_orders enable row level security;

-- No browser policy: orders are created/fulfilled/read only by Edge Functions.
