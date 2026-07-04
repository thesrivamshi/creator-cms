-- Storage buckets (private) + owner-only object policies.
-- Paths are namespaced by user_id: audio/{user_id}/{idea_id}.m4a,
-- visuals/{user_id}/{part_id}.png — the first folder segment is the owner.

insert into storage.buckets (id, name, public)
values ('audio', 'audio', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('visuals', 'visuals', false)
on conflict (id) do nothing;

create policy "audio_owner_all" on storage.objects
  for all
  using (bucket_id = 'audio' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'audio' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "visuals_owner_all" on storage.objects
  for all
  using (bucket_id = 'visuals' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'visuals' and (storage.foldername(name))[1] = auth.uid()::text);
