-- Signing out everywhere (cognito-login.feature): login tokens issued up to this moment are refused.
alter table users add column if not exists signed_out_at timestamp(6) with time zone;
