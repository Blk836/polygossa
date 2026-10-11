Feature: Per-learner rate limits on dictionary lookups and imports (#87)
  AI calls already have a daily allowance. Dictionary lookups (which can call Amazon Translate) and imports
  (which tokenize, fetch pages or videos and may call the AI) had no limit, so one account could run up costs or
  load. Limits are generous: a fast reader or a teacher setting up a class never meets them.

  Background:
    Given the limits are 120 dictionary lookups a minute and 60 imports an hour for each learner

  Scenario: A learner looking words up at a normal pace is never limited
    Given I am signed in
    When I look up 120 words within one minute
    Then every lookup answers

  Scenario: Too many lookups in one minute
    Given I have looked up 120 words this minute
    When I look up another word
    Then the answer is 429 with code "rate_limited" and a message saying to try again shortly
    And the response says when to retry (Retry-After, in seconds)

  Scenario: The lookup limit resets the next minute
    Given I was limited on lookups
    When a minute has passed
    Then my next lookup answers

  Scenario: One learner's limit doesn't affect another
    Given I have used all my lookups this minute
    When another learner looks up a word
    Then their lookup answers

  Scenario: Too many imports in one hour
    Given I am a Pro learner with no plan limit on texts
    And I have imported 60 texts this hour, by any import route
    When I import another text
    Then the answer is 429 with code "rate_limited"
    And an hour later I can import again

  Scenario Outline: Every import route counts toward the same hourly limit
    Given I have imported 60 texts this hour
    When I call <route>
    Then the answer is 429 with code "rate_limited"

    Examples:
      | route                              |
      | POST /api/texts                    |
      | POST /api/texts/import-url         |
      | POST /api/texts/import-subtitles   |
      | POST /api/texts/import-youtube     |
      | POST /api/texts/import-book        |
      | POST /api/word-imports/lingq       |
      | POST /api/word-imports/readlang    |

  Scenario: Reading isn't an import
    Given I have imported 60 texts this hour
    When I open a text, finish it or mark its words known
    Then those answer as usual

  Scenario: Limits can be switched off for the end-to-end tests
    Given the setting app.rate-limits.enabled is false
    When the shared test account makes any number of lookups and imports
    Then none is limited

  # Sign-up and sign-in are not limited here: production signs in only through Cognito, which has its own
  # protections, and the app's own accounts are switched off there.
