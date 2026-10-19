alter table vocabulary_entries add column if not exists lemma varchar(500);

alter table users add column if not exists honey_jar varchar(255);
alter table users drop constraint if exists users_honey_jar_check;
alter table users add constraint users_honey_jar_check check ((honey_jar in ('ALL_FORMS','BASE_WORDS')));

update vocabulary_entries v
set lemma = picked.lemma
from (
    select distinct on (source_language, term) source_language, term, lemma
    from (
        select source_language, term,
               lower(btrim(replace(coalesce(nullif(btrim(lemma), ''), term), '’', ''''))) as lemma,
               count(*) as lookups
        from sentence_meanings
        where part_of_speech is not null
        group by 1, 2, 3
    ) counted
    order by source_language, term, lookups desc, lemma collate "C"
) picked
where v.language = picked.source_language
  and v.term = picked.term
  and v.kind = 'WORD'
  and v.lemma is null;
