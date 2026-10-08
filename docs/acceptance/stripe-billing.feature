Feature: Real billing with Stripe (docs/production.md, phase 7)
  Upgrading pays through Stripe instead of switching the plan for free. Stripe Checkout takes the payment, a Stripe
  webhook sets the plan (through the one place plans already change), and Stripe's customer portal handles
  cancelling, changing card and invoices. Prices include VAT; Stripe Tax works it out.
  Defaults marked [default] are proposals for the owner to confirm or change.

  Background:
    Given the prices [default]: Pro €8 a month or €60 a year; Classroom €4 per student a month; all VAT included

  # --- Upgrading ---

  Scenario: Upgrading to Pro opens Stripe Checkout
    Given a learner on the Free plan
    When they choose Pro, monthly or yearly, in Settings › Subscription
    Then they go to Stripe's checkout page for that price, with their email filled in
    And after paying they come back to Settings › Subscription, which says the payment is being confirmed
    And within moments they are on Pro (set by the webhook, not by the return)

  Scenario: Coming back without paying changes nothing
    When a learner leaves Stripe's checkout without paying
    Then they come back to Settings › Subscription, still on their plan, with no error

  Scenario: Only the webhook changes the plan
    When anyone calls the old plan switch or forges a "paid" return
    Then the plan doesn't change in production (the switch stays for local runs only)
    And a webhook without Stripe's valid signature is refused and changes nothing
    And the same webhook event arriving twice changes the plan once

  # --- Managing the subscription ---

  Scenario: A paying learner manages their subscription in Stripe's portal
    Given a learner on Pro
    When they choose "Manage subscription"
    Then Stripe's customer portal opens: change monthly/yearly, change card, see invoices, cancel

  Scenario: Cancelling keeps Pro until the end of the paid period
    When a learner cancels in the portal
    Then Settings shows Pro until the period's end date, then the account is Free, keeping all its data

  Scenario: A failed payment
    Given a learner whose renewal payment fails
    Then Stripe retries and emails them (Stripe's own emails), and they stay on Pro meanwhile
    And Settings tells them the payment failed, with a link to update the card in the portal
    And if it still hasn't been paid after the retries ([default] about 7 days), the account becomes Free, keeping
      its data; texts and words over the Free limits stay, but no new ones can be added until they are under them

  # --- Classroom ---

  Scenario: A teacher pays for a class per student
    Given a teacher who chooses the Classroom plan
    Then Checkout charges per student [default: for the students who have joined their classes, at least 1]
    And when students join or leave, the next invoice follows the count (Stripe prorates)
    And students in the class get Pro features through the teacher's plan, as today

  Scenario: A teacher's plan ending
    When a teacher's Classroom subscription ends
    Then the teacher and their students lose the sponsored features (students keep any Pro they pay for themselves)

  # --- Accounts ---

  Scenario: Deleting the account cancels its subscription
    Given a learner with an active subscription
    When they delete their account
    Then the subscription is cancelled at once in Stripe (no further charges), then the account is deleted

  Scenario: One Stripe customer per account
    Then each account has at most one Stripe customer, made on its first checkout and reused afterwards

  # --- Settings and environments ---

  Scenario: Settings shows the subscription as it is
    Then Settings › Subscription shows the plan, monthly or yearly, the next renewal or end date, and any payment
      problem, from what the webhooks recorded

  Scenario: No trial [default]
    Then there is no free trial: the Free plan is the way to try the app

  Scenario: Test mode until launch
    Given production uses Stripe's test mode until the beta
    Then only Stripe's test cards work, and the site says so in Settings › Subscription
    And the Stripe keys live in Secrets Manager, never in code, the template or the browser

  Scenario: Local runs and tests
    Given no Stripe keys (local runs by default, backend tests, browser tests)
    Then the plan switch works as today; backend tests use a fake Stripe for checkout, the portal and webhooks
