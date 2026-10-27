alter table public.products
  add column if not exists lifecycle_status text;

update public.products
set lifecycle_status = case
  when coalesce(stock, 0) > 0 then 'published'
  else 'coming_soon'
end
where lifecycle_status is null;

alter table public.products
  alter column lifecycle_status set default 'coming_soon',
  alter column lifecycle_status set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'products_lifecycle_status_check'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_lifecycle_status_check
      check (
        lifecycle_status in (
          'coming_soon',
          'in_progress',
          'in_production',
          'published'
        )
      );
  end if;
end
$$;
