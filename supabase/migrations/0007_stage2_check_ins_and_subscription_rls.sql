create table if not exists public.check_ins (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.loan_runs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  observed_on date not null default current_date,
  effective_rate numeric(7,4),
  emi numeric(14,2),
  outstanding numeric(16,2),
  remaining_months integer,
  outcome text not null default 'unsure',
  note text,
  created_at timestamptz not null default now(),
  constraint check_ins_remaining_months_nonnegative check (remaining_months is null or remaining_months >= 0),
  constraint check_ins_effective_rate_reasonable check (effective_rate is null or (effective_rate >= 0 and effective_rate <= 30)),
  constraint check_ins_emi_nonnegative check (emi is null or emi >= 0),
  constraint check_ins_outstanding_nonnegative check (outstanding is null or outstanding >= 0)
);

create index if not exists check_ins_user_id_idx on public.check_ins(user_id);
create index if not exists check_ins_loan_id_observed_idx on public.check_ins(loan_id, observed_on desc);

alter table public.check_ins enable row level security;
grant select, insert, update, delete on public.check_ins to authenticated;

drop policy if exists "check_ins_owner_select" on public.check_ins;
create policy "check_ins_owner_select" on public.check_ins
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "check_ins_owner_insert" on public.check_ins;
create policy "check_ins_owner_insert" on public.check_ins
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.loan_runs l
      where l.id = loan_id and l.user_id = (select auth.uid())
    )
  );

drop policy if exists "check_ins_owner_update" on public.check_ins;
create policy "check_ins_owner_update" on public.check_ins
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "check_ins_owner_delete" on public.check_ins;
create policy "check_ins_owner_delete" on public.check_ins
  for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select on public.subscriptions to authenticated;
drop policy if exists "subscriptions_owner_select" on public.subscriptions;
create policy "subscriptions_owner_select" on public.subscriptions
  for select to authenticated
  using ((select auth.uid()) = user_id);
