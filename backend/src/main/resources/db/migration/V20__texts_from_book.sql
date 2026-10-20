alter table texts add column if not exists from_book boolean not null default false;

update texts t
set from_book = true, is_public = false
from playlist_items i
join playlists p on p.id = i.playlist_id
where i.text_id = t.id
  and p.owner_id = t.owner_id
  and p.description like 'Imported from %';
