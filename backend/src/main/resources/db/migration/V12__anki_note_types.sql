create table if not exists anki_note_types (
    deck_id bigint not null references anki_decks on delete cascade,
    position integer not null,
    model_id bigint not null,
    name varchar(200) not null,
    word_field varchar(100),
    meaning_field varchar(100),
    primary key (deck_id, position)
);

alter table anki_sync_runs add column if not exists skipped_note_type integer not null default 0;
alter table anki_sync_runs add column if not exists waiting_note_type integer not null default 0;
