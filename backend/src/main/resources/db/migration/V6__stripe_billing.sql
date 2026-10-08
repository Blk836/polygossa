-- Real billing with Stripe (stripe-billing.feature): each account's Stripe customer and subscription, as the last
-- webhook reported it, and the webhook events already handled (so a repeated event changes nothing).
create table if not exists subscriptions (
    user_id bigint not null references users,
    stripe_customer_id varchar(64) not null,
    stripe_subscription_id varchar(64),
    item_id varchar(64),
    plan varchar(32),
    billing_interval varchar(8),
    status varchar(32),
    period_end timestamp(6) with time zone,
    cancel_at_period_end boolean not null,
    primary key (user_id),
    constraint subscriptions_stripe_customer_id_key unique (stripe_customer_id)
);

create table if not exists stripe_events (
    id varchar(255) not null,
    received_at timestamp(6) with time zone not null,
    primary key (id)
);
