-- LoanRepo — reports saved to a user's own workspace.
-- Run after 0005_engagement_emails.sql.
--
-- Stage 1 stores only an email address. A saved report necessarily stores the
-- loan particulars too, so this is a separate, explicit act: the user presses
-- Save to my workspace, and can delete it. Nothing is written by simply
-- signing in for the PDF.
--
-- We store the inputs, not a PDF binary: the report is regenerated from them on
-- demand, so it stays correct as rate history is extended, and there is no file
-- to leak.

create table if not exists public.saved_reports (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  label        text,
  start_month  text not null,
  amount       numeric not null check (amount > 0),
  tenure_years int not null check (tenure_years between 1 and 30),
  benchmark    text not null check (benchmark in ('EBLR','MCLR')),
  own_spread   numeric,
  -- A snapshot of what the model said the day it was saved, so a user can see
  -- that the figures moved rather than silently getting new ones.
  snapshot     jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists saved_reports_user_idx
  on public.saved_reports (user_id, created_at desc);

alter table public.saved_reports enable row level security;

create policy "saved_reports: owner reads"
  on public.saved_reports for select using (auth.uid() = user_id);
create policy "saved_reports: owner inserts"
  on public.saved_reports for insert with check (auth.uid() = user_id);
create policy "saved_reports: owner deletes"
  on public.saved_reports for delete using (auth.uid() = user_id);

-- Entitlement view: what documents does this user hold? Reports they saved,
-- plus the book if they have paid for it. Read by the workspace screen so the
-- client never has to ask two questions.
create or replace view public.my_documents as
  select
    'report'::text as kind,
    r.id,
    coalesce(r.label, 'Loan report') as title,
    r.created_at,
    to_jsonb(r) - 'user_id' as detail
  from public.saved_reports r
  where r.user_id = auth.uid()
  union all
  select
    'book'::text as kind,
    p.id,
    'The Quiet Years'::text as title,
    p.created_at,
    jsonb_build_object('status', p.status, 'product', p.product) as detail
  from public.purchases p
  where p.user_id = auth.uid() and p.status = 'paid';
