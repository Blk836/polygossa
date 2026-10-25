create table if not exists word_verdicts (
    language varchar(255) not null check ((language in ('EN','ES','FR','DE','IT','PT','JA','ZH','KO'))),
    term varchar(500) not null,
    real_word boolean not null,
    judged_at timestamp(6) with time zone not null,
    primary key (language, term)
);

alter table texts add column if not exists not_words_json text;

alter table vocabulary_entries add column if not exists set_aside_at timestamp(6) with time zone;

alter table ai_job_usage drop constraint if exists ai_job_usage_job_check;
alter table ai_job_usage add constraint ai_job_usage_job_check
    check ((job in ('DEFINITION','EXAMPLE','TRANSLATION','WRITING_FEEDBACK','WRITING_GRADE','WORD_MEANING',
                    'CONTENT_REVIEW','TOPIC_TAGS','TRANSCRIPT_TIDY','PERSON_NAMES','NOT_WORDS')));
