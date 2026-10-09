alter table public.products
  add column if not exists privacy_policy_url text,
  add column if not exists terms_of_use_url text,
  add column if not exists account_deletion_url text,
  add column if not exists child_safety_url text;
