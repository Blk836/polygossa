update users
set display_name = split_part(email, '@', 1)
where btrim(display_name) = '';
