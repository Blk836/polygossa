-- First-visit tours (feature-tours.feature): whether an account gets them, and the names of the ones it has seen.
-- Existing accounts get null, which means off; new sign-ups turn them on.
alter table users add column if not exists tours_on boolean;
alter table users add column if not exists tours_seen varchar(1300);
