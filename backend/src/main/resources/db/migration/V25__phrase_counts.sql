create table if not exists phrase_counts (
    entry_id bigint primary key references vocabulary_entries (id) on delete cascade,
    times bigint not null
);
