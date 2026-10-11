Feature: Production on its own domain, polygossa.com
  The owner bought polygossa.com at Namecheap. AWS answers for it (Route 53), and the site, sign-in and payments
  move to it. Namecheap stays the registrar; the only change made there is its nameservers.

  Background:
    Given the domain is registered at Namecheap
    And the account's region policy allows ACM in us-east-1 but not CloudFormation, Lambda or SSM there

  # Stage 1: AWS starts answering for the domain

  Scenario: production has a public hosted zone for the domain
    When the production stack is built
    Then it has a public Route 53 hosted zone for "polygossa.com"
    And the zone is kept if the stack is ever deleted
    And the stack outputs the zone's four nameservers

  Scenario: stage 1 changes nothing for learners
    Given only the hosted zone has been deployed
    Then the site still answers at https://d3pd9mue4v7won.cloudfront.net
    And sign-in, sign-out and payments still return there

  Scenario: the owner points Namecheap at AWS
    Given stage 1 is deployed
    When the owner sets Namecheap's nameservers to "Custom DNS" with the four the stack output
    Then a public DNS lookup of polygossa.com's nameservers returns those four, before stage 2 is deployed

  # Stage 2: the site moves to the domain (deployed only after delegation is confirmed)

  Scenario: the site has a certificate for the domain and www
    When the production stack is built with the domain switched on
    Then a DNS-validated certificate in us-east-1 covers "polygossa.com" and "www.polygossa.com"
    And it is made from the eu-west-1 stack, without a us-east-1 stack

  Scenario: the domain and www both reach the site
    Given stage 2 is deployed
    Then "polygossa.com" and "www.polygossa.com" have A and AAAA alias records to the site's CloudFront distribution
    And the distribution answers to both names with the certificate

  Scenario: www goes to the bare domain
    When a visitor opens https://www.polygossa.com/library?tab=books
    Then they are sent with a permanent redirect to https://polygossa.com/library?tab=books

  Scenario: links handed out with the old address keep working
    When a visitor opens https://d3pd9mue4v7won.cloudfront.net/reader/42?page=3
    Then they are sent with a permanent redirect to https://polygossa.com/reader/42?page=3

  Scenario: the domain itself is not redirected
    When a visitor opens https://polygossa.com/
    Then the page loads with no redirect

  Scenario: sign-in returns to the domain
    Given stage 2 is deployed
    When a learner signs in with email or Google
    Then Cognito sends them back to https://polygossa.com/api/auth/callback
    And signing out returns them to https://polygossa.com/

  Scenario: the old address stays an allowed sign-in return for one transition
    Then Cognito also still accepts the old cloudfront.net callback and sign-out addresses
    So a sign-in started on a page opened before the switch does not fail

  Scenario: the app builds its links with the domain
    Then the backend's and frontend's APP_URL are "https://polygossa.com"
    And the stack's SiteUrl output is "https://polygossa.com", so the deploy tool checks the site there

  Scenario: Stripe keeps reaching the webhook
    Given Stripe's webhook was set up for the old address, and Stripe treats a redirect as a failed delivery
    When stage 2 is deployed
    Then the Stripe setup tool's default site is https://polygossa.com
    And the owner re-runs it, so the webhook points at the domain

  Scenario: a deploy without the domain switched on is unchanged
    When the production stack is built without a domain
    Then it has no certificate, aliases or redirect, and SiteUrl is the cloudfront.net address

  # Not in this work
  # - Email at the domain (MX/SPF records) waits for the owner to pick a provider.
  # - Opening robots.txt to search engines is #121.
