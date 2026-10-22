create table if not exists word_counts (
    user_id bigint not null,
    language varchar(255) not null check ((language in ('EN','ES','FR','DE','IT','PT','JA','ZH','KO'))),
    term varchar(500) not null,
    times bigint not null,
    primary key (user_id, language, term)
);

create table if not exists word_count_fills (
    user_id bigint primary key
);
