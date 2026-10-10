do $$
begin
    if to_regclass('sentence_cards') is null then
        return;
    end if;

    create temporary table moving_sentences on commit drop as
    select distinct on (user_id, language, term) *
    from (select s.*, left(btrim(s.sentence, E' \t\r\n'), 500) as display,
                 left(lower(replace(btrim(s.sentence, E' \t\r\n'), '’', '''')), 500) as term
          from sentence_cards s) keyed
    where term <> ''
    order by user_id, language, term, created_at, id;

    update vocabulary_entries v set definition = m.translation, updated_at = now()
    from moving_sentences m
    where v.user_id = m.user_id and v.language = m.language and v.term = m.term
      and v.definition is null and m.translation is not null;

    insert into vocabulary_entries (user_id, language, term, display_term, kind, status, definition, note,
                                    source_text_id, ease_factor, interval_days, lapses, repetitions, due_at,
                                    last_reviewed_at, created_at, updated_at)
    select m.user_id, m.language, m.term, m.display, 'PHRASE', 'LEARNING', m.translation, m.notes,
           m.source_text_id, m.ease_factor, m.interval_days, m.lapses, m.repetitions, m.due_at,
           m.last_reviewed_at, m.created_at, now()
    from moving_sentences m
    where not exists (select 1 from vocabulary_entries v
                      where v.user_id = m.user_id and v.language = m.language and v.term = m.term);

    drop table sentence_cards;
end $$;
