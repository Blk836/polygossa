-- Hibernate's ddl-auto gave the single-column unique constraints generated names (e.g. uk6dotkott2kjsp8vw4d0m25fb7)
-- in databases it built, where V1 lets PostgreSQL name them (users_email_key). Give them PostgreSQL's names everywhere,
-- so a later migration can refer to them by name on every database.
do $$
declare
    wanted record;
    current_name text;
begin
    for wanted in select * from (values
            ('users', 'email', 'users_email_key'),
            ('texts', 'body_id', 'texts_body_id_key'),
            ('classrooms', 'join_code', 'classrooms_join_code_key')) as w(tbl, col, name)
    loop
        select c.conname into current_name
        from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
        where c.contype = 'u' and array_length(c.conkey, 1) = 1
          and c.conrelid = wanted.tbl::regclass and a.attname = wanted.col;
        if current_name is null then
            raise exception 'No unique constraint on %.%', wanted.tbl, wanted.col;
        end if;
        if current_name <> wanted.name then
            execute format('alter table %I rename constraint %I to %I', wanted.tbl, current_name, wanted.name);
        end if;
    end loop;
end $$;
