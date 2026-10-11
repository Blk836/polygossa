Feature: Production can be paused before launch, showing a coming-soon page (#140)
  Production costs about $79 a month whether anyone uses it or not. One setting, "paused" in infra/cdk.json, and a
  deploy take away what costs money and leave a coming-soon page at https://polygossa.com, for roughly $4-6 a month.
  Unpausing is the same setting turned off, naming the snapshot the database is brought back from.

  # The switch

  Scenario: production is not paused unless the setting says so
    Given cdk.json has no "paused" setting, or it is false
    When the production stack is built
    Then it is the running site as before: services, load balancer, database, alarms

  Scenario: pausing removes what costs money
    Given "paused" is true
    When the production stack is built
    Then it has no ECS cluster, services or tasks, no load balancer and no database instance
    And no container images are built for it
    And no public IPv4 address is used by it

  Scenario: pausing keeps everything holding data or identity
    Given "paused" is true
    Then the stack still has the Cognito user pool, the uploads bucket, the login-token and curator secrets,
      the hosted zone, the certificate and the CloudFront distribution on polygossa.com and www
    And www still redirects to the bare domain

  Scenario: the database is kept as a snapshot when it is removed
    Given the running database's deletion policy is "Snapshot"
    When a deploy with "paused" true removes it
    Then CloudFormation keeps a final snapshot of it

  # What visitors see

  Scenario: visitors see a coming-soon page
    Given production is paused
    When a visitor opens https://polygossa.com/
    Then they get a "coming soon" page, from S3 through CloudFront

  Scenario: any path shows the coming-soon page
    Given production is paused
    When a visitor opens a link to an app page, such as https://polygossa.com/reader/42
    Then they get the same coming-soon page, not an S3 error

  Scenario: the coming-soon bucket can only be read through the site
    Given production is paused
    Then the page's bucket blocks public access and only the distribution may read it

  Scenario: the page is not shown while running
    Given production is not paused
    Then the distribution serves the app from the load balancer, with no coming-soon origin or error pages

  # Alarms and the bill

  Scenario: the site-down and backend-down alarms don't fire while paused
    Given production is paused
    Then the stack has no site, backend, server-error or database alarms
    But the monthly budget and its emails stay

  # The deploy tool

  Scenario: a paused deploy is checked by its coming-soon page
    Given the deployed stack reports it is paused
    When the deploy tool checks the site
    Then it checks that https://polygossa.com/ answers with the coming-soon page
    And it doesn't ask for the sign-in page or the backend's languages
    And main's commit gets a green "deploy production" mark

  Scenario: a coming-soon page that never answers is a failed deploy
    Given the deployed stack reports it is paused
    When the site never answers with the coming-soon page
    Then main's commit gets a red "deploy production" mark

  # Unpausing without losing data

  Scenario: unpausing brings the database back from the snapshot named in the settings
    Given "paused" is false and "database-snapshot" names a snapshot
    When the production stack is built
    Then the database instance is created from that snapshot, with a newly generated password in its own secret
    And the services, load balancer and alarms are back

  Scenario: unpausing without naming the snapshot is refused
    Given the live stack is paused
    When a deploy would unpause it without "database-snapshot", or with the same snapshot it ran from before pausing
    Then the deploy tool refuses before touching production, saying a new empty database would be made otherwise

  Scenario: changing the snapshot of a running database is refused
    Given the live stack is running with a database
    When the settings name a different "database-snapshot" from the one it runs from
    Then the deploy tool refuses before touching production, saying the database would be replaced

  Scenario: the stack reports its state for the deploy tool
    When the production stack is built
    Then it outputs whether it is paused and which snapshot its database came from ("none" for a new one)

  # Smaller saving done either way

  Scenario: the database uses gp3 storage
    When the production stack is built, paused or not
    Then the database (new or from a snapshot) uses gp3 storage

  # Not in this work
  # - Actually pausing production, and the trial pause-and-unpause the issue asks for before trusting it: deploying
  #   is the owner's call.
  # - Checking the AWS credits balance (management account, which Claude doesn't use).
  # - Fargate on ARM (Graviton): the images would need building for arm64; a separate issue.
  # - A waitlist sign-up on the coming-soon page.
