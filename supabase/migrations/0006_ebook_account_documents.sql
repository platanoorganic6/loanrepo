alter table public.ebook_orders add column if not exists user_id uuid references auth.users(id);
alter table public.ebook_orders add column if not exists document_path text;
alter table public.ebook_orders add column if not exists document_created_at timestamptz;
create index if not exists ebook_orders_user_id_idx on public.ebook_orders(user_id);
alter table public.ebook_orders enable row level security;
drop policy if exists "ebook_orders_user_select" on public.ebook_orders;
create policy "ebook_orders_user_select" on public.ebook_orders for select to authenticated using (user_id = auth.uid());
create table if not exists public.user_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid references public.ebook_orders(id) on delete set null,
  document_type text not null,
  title text not null,
  storage_path text not null,
  created_at timestamptz not null default now(),
  unique(order_id)
);
alter table public.user_documents enable row level security;
drop policy if exists "user_documents_owner_select" on public.user_documents;
create policy "user_documents_owner_select" on public.user_documents for select to authenticated using (user_id = auth.uid());
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('loanrepo-documents','loanrepo-documents',false,10485760,array['application/pdf'])
on conflict (id) do nothing;
drop policy if exists "loanrepo_docs_insert_own" on storage.objects;
create policy "loanrepo_docs_insert_own" on storage.objects for insert to authenticated
with check (bucket_id='loanrepo-documents' and (storage.foldername(name))[1]=(select auth.uid()::text));
drop policy if exists "loanrepo_docs_select_own" on storage.objects;
create policy "loanrepo_docs_select_own" on storage.objects for select to authenticated
using (bucket_id='loanrepo-documents' and (storage.foldername(name))[1]=(select auth.uid()::text));