-- SMB Fittings certificate store (Authenticated Admin Access)
-- Run this in Supabase Dashboard → SQL Editor (idempotent — safe to re-run).
-- 🔐 RLS Policy: Only authenticated users (admins) can view, create, edit, and delete certificates.
--    Anonymous public access is completely disabled.

create extension if not exists pgcrypto;

-- Main table: one row per certificate, payload is the full CertificateDraft JSON.
create table if not exists public.certificates (
  id         uuid        primary key default gen_random_uuid(),
  payload    jsonb       not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Fast ordering by last-modified.
create index if not exists certificates_updated_at_idx
  on public.certificates (updated_at desc);

-- GIN index for JSONB lookups (e.g. searching metadata, client name, heat numbers).
create index if not exists certificates_payload_gin_idx
  on public.certificates using gin (payload);

-- Auto-update updated_at on every row update.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists certificates_set_updated_at on public.certificates;
create trigger certificates_set_updated_at
before update on public.certificates
for each row execute function public.set_updated_at();

-- Enable Row Level Security
alter table public.certificates enable row level security;

-- Drop previous prototype open policy if exists
drop policy if exists "Prototype certificate access" on public.certificates;
drop policy if exists "Authenticated admin certificate access" on public.certificates;

-- Policy: Only authenticated users can perform SELECT, INSERT, UPDATE, DELETE
create policy "Authenticated admin certificate access"
on public.certificates
for all
to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null);

-- Company assets: single shared row holding logo/badges/stamps used on every certificate.
create table if not exists public.company_assets (
  id         text        primary key default 'default',
  images     jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

drop trigger if exists company_assets_set_updated_at on public.company_assets;
create trigger company_assets_set_updated_at
before update on public.company_assets
for each row execute function public.set_updated_at();

alter table public.company_assets enable row level security;

drop policy if exists "Authenticated admin company assets access" on public.company_assets;
create policy "Authenticated admin company assets access"
on public.company_assets
for all
to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null);
