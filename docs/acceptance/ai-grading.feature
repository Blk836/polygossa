Feature: AI grading groundwork (docs/ai-plan.md, phase 0)
  Switch on real AI grading safely: consistent marks, a record of what marked them, a daily cap per user so the
  $5 budget can't be drained, and no change to the writing situations, which stay a fixed bank shared by everyone.
  Backend tests use a stub AI server and never call OpenAI.

  Background:
    Given I am signed in on a plan with AI features

  # --- Writing situations stay fixed and shared ---

  Scenario: Every user draws situations from the same bank
    Given two users each start a B1 writing test
    Then both situations come from the B1 entries of writing/prompts.txt
    And no request was sent to the AI service to start either test

  Scenario: Starting a test works with AI switched off
    Given the server has no OpenAI key
    When I start an A2 writing test
    Then I get an A2 situation from the bank and the 5-minute timer starts

  # --- Consistent grading ---

  Scenario: Grading asks for deterministic output
    When I hand in a writing test
    Then the request to the AI service uses temperature 0
    And the request uses the configured model (OPENAI_MODEL)

  Scenario: A graded test records what graded it
    When I hand in a writing test and it is graded
    Then the test stores the model name and the grading prompt version
    And loading the test later still shows the same grade, even after OPENAI_MODEL changes

  Scenario: Grades from the AI are kept in bounds
    Given the AI replies with a score of 140, a grammar score of 9 and level "Z9"
    When the test is graded
    Then the score is 100, grammar is 5, and the level is shown as unknown rather than "Z9"

  # --- Failure paths (no key, outage, junk) ---

  Scenario Outline: Grading fails without losing the writing
    Given <condition>
    When I hand in a writing test
    Then the test is saved as "ungraded" with my text intact
    And I see "<message>" and a "Grade it now" button
    And no grade is stored

    Examples:
      | condition                               | message                                   |
      | the server has no OpenAI key            | AI features are not configured            |
      | the AI service returns HTTP 500         | The AI service is unavailable right now   |
      | the AI service doesn't answer in 30s    | The AI service is unavailable right now   |
      | the AI service replies with invalid JSON| The AI service returned an unreadable answer |

  Scenario: Retrying an ungraded test once the AI is back
    Given my last test is "ungraded" because the AI service was down
    And the AI service is back
    When I click "Grade it now"
    Then the test is graded and shows its score

  # --- Daily cap (protects the budget) ---

  Scenario: AI calls are capped per user per day
    Given the daily AI limit is 30 (AI_DAILY_LIMIT)
    And I have made 30 successful AI calls today
    When I ask for an AI definition, example, translation, writing feedback, or a writing grade
    Then I get HTTP 429 "You've used today's AI allowance; it resets at midnight"
    And no request is sent to the AI service
    And a handed-in writing test is still saved, as "ungraded", so I can grade it tomorrow

  Scenario: Failed AI calls don't use up the allowance
    Given the AI service is down
    When I try 5 AI actions and they all fail
    Then my count of AI calls today is still 0

  Scenario: The allowance resets at midnight in my timezone
    Given my timezone is Asia/Tokyo and I used all 30 calls on Monday
    When it is 00:01 Tuesday in Tokyo
    Then I can make AI calls again

  Scenario: Each user has their own allowance
    Given another user has used all 30 calls today
    Then I can still make AI calls

  Scenario: Free plan is still blocked before the cap is considered
    Given I am on the Free plan
    When I start a writing test
    Then I get HTTP 402 asking me to upgrade, as today

  # --- Real-key check (manual, not in CI) ---

  Scenario: Smoke test against the real OpenAI API
    Given the backend is running with the real OPENAI_API_KEY
    When I hand in one short writing test in each of the 8 languages
    Then each is graded with four rubric scores, corrections, and a CEFR level
    And the report lists each grade and the tokens used
