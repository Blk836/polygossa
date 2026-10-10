create table if not exists anki_decks (
    id bigserial primary key,
    user_id bigint not null references users,
    anki_deck_id bigint not null,
    name varchar(200) not null,
    language varchar(255) not null check ((language in ('EN','ES','FR','DE','IT','PT','JA','ZH','KO'))),
    word_field varchar(100) not null,
    meaning_field varchar(100),
    first_synced_at timestamp(6) with time zone,
    constraint uk_anki_decks_user_deck unique (user_id, anki_deck_id)
);

create table if not exists anki_sync_runs (
    id bigserial primary key,
    user_id bigint not null references users,
    dry_run boolean not null,
    state varchar(16) not null check (state in ('RUNNING', 'DONE', 'STOPPED')),
    started_at timestamp(6) with time zone not null,
    last_activity_at timestamp(6) with time zone not null,
    finished_at timestamp(6) with time zone,
    cards integer not null default 0,
    became_known integer not null default 0,
    added_known integer not null default 0,
    added_learning integer not null default 0,
    over_limit integer not null default 0,
    skipped_empty integer not null default 0,
    skipped_too_long integer not null default 0,
    skipped_media integer not null default 0,
    leave_review integer not null default 0
);

create index if not exists idx_anki_sync_runs_user on anki_sync_runs (user_id, started_at);

create table if not exists anki_sync_run_words (
    id bigserial primary key,
    run_id bigint not null references anki_sync_runs on delete cascade,
    outcome varchar(20) not null check (outcome in ('BECAME_KNOWN', 'ADDED_KNOWN', 'ADDED_LEARNING', 'OVER_LIMIT',
        'SKIPPED_EMPTY', 'SKIPPED_TOO_LONG', 'SKIPPED_MEDIA', 'LEAVE_REVIEW')),
    term varchar(500) not null
);

create index if not exists idx_anki_sync_run_words_run on anki_sync_run_words (run_id, outcome);

create table if not exists anki_links (
    id bigserial primary key,
    user_id bigint not null references users,
    entry_id bigint not null references vocabulary_entries on delete cascade,
    deck_id bigint not null references anki_decks on delete cascade,
    state varchar(8) not null check (state in ('NEW', 'YOUNG', 'MATURE')),
    promoted boolean not null default false,
    run_id bigint,
    constraint uk_anki_links_entry_deck unique (entry_id, deck_id)
);

create index if not exists idx_anki_links_user on anki_links (user_id);
