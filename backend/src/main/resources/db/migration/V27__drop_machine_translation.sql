drop table if exists machine_translations;
drop table if exists translation_usage;

delete from lookup_counters where layer in ('MACHINE_STORED', 'MACHINE_NEW');
alter table lookup_counters drop constraint if exists lookup_counters_layer_check;
alter table lookup_counters add constraint lookup_counters_layer_check
    check ((layer in ('AI_STORED','AI_NEW','COMMUNITY','NONE')));
alter table lookup_counters drop column if exists translate_calls;
alter table lookup_counters drop column if exists translate_characters;
alter table lookup_counters drop column if exists translate_failures;
alter table lookup_counters drop column if exists translate_capped;
