-- Login with Cognito (cognito-login.feature): each account is linked to its Cognito identity (the token's "sub").
-- Accounts made through Cognito have no password of ours.
alter table users add column if not exists cognito_sub varchar(64);
alter table users add constraint users_cognito_sub_key unique (cognito_sub);
alter table users alter column password_hash drop not null;
