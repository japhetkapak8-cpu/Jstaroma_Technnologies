begin;

alter table public.projects
  add column if not exists document_url text,
  add column if not exists document_path text,
  add column if not exists document_name text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-documents',
  'project-documents',
  true,
  10485760,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admins upload project documents" on storage.objects;
create policy "Admins upload project documents"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'project-documents'
  and exists (select 1 from public.admins where user_id = (select auth.uid()))
);

drop policy if exists "Admins read project document objects" on storage.objects;
create policy "Admins read project document objects"
on storage.objects for select to authenticated
using (
  bucket_id = 'project-documents'
  and exists (select 1 from public.admins where user_id = (select auth.uid()))
);

drop policy if exists "Admins delete project documents" on storage.objects;
create policy "Admins delete project documents"
on storage.objects for delete to authenticated
using (
  bucket_id = 'project-documents'
  and exists (select 1 from public.admins where user_id = (select auth.uid()))
);

commit;
