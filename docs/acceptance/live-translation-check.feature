Feature: Machine translation is checked against the real Amazon Translate before production (#88)
  Development, QA and tests run with Amazon Translate off, and the tests use a stand-in that speaks its wire
  format. What only the real service can show (that it accepts the language codes we send, and translates with
  our client settings) used to be seen first in production.

  Scenario: Every language code we send is one Amazon Translate accepts
    Given the live check runs with AWS credentials for the app's account
    When it asks Amazon Translate which languages it supports (a free call)
    Then every learning language's code (including the paused ones) and every native language's code is on the list

  Scenario: A real translation comes back through our client
    When the live check translates "Hola, amigo" from Spanish to English with the app's translation client and settings
    Then the answer contains "friend"
    And it costs a few characters of Amazon Translate's allowance

  Scenario: The live check never runs in the ordinary suites
    When the backend tests or the local checks run
    Then the live check is skipped, so they never need AWS credentials or the network

  Scenario: Deploying production runs the live check first
    Given I deploy with node tools/local-deploy.mjs, signed in to AWS
    When the deploy copy of main is ready
    Then the live check runs in it with the deploy's AWS credentials, before cdk deploy

  Scenario: A failed live check stops the deploy
    Given Amazon Translate rejects a code, or the translation fails
    When the deploy runs the live check
    Then production isn't touched
    And main's commit gets a red "deploy production" mark saying the live translation check failed
    And the turn is given back

  Scenario: Running the live check by hand
    When a developer signed in to AWS runs ./gradlew :backend:liveTest with AWS_PROFILE=polygossa
    Then only the live checks run, against the real service
