alter table texts add column if not exists person_names_json text;

alter table ai_job_usage drop constraint if exists ai_job_usage_job_check;
alter table ai_job_usage add constraint ai_job_usage_job_check
    check ((job in ('DEFINITION','EXAMPLE','TRANSLATION','WRITING_FEEDBACK','WRITING_GRADE','WORD_MEANING',
                    'CONTENT_REVIEW','TOPIC_TAGS','TRANSCRIPT_TIDY','PERSON_NAMES')));
