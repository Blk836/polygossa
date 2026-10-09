-- A word Amazon Translate gave back unchanged is asked again inside its sentence (translation-in-context.feature).
-- True once that was tried and gave nothing, so it isn't paid for again. Words stored as echoed before this are false,
-- so they get their in-context ask.
alter table machine_translations add column if not exists tried_in_context boolean not null default false;
