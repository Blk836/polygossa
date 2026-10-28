Feature: The reader's popup gets its meaning only from the AI, waiting longer and trying twice
  On 2026-10-28 "inégalitaire" got no meaning: the AI didn't answer within 5 seconds, so the popup gave up on it,
  and the Amazon Translate fallback failed too. The same request normally takes about a second. A word's meaning
  now waits up to 15 seconds for each try, and a try that fails is followed by one more, so the popup waits at most
  30 seconds. Amazon Translate's bare-word answers were the reason for meaning-in-context.feature, so the reader no
  longer falls back to them: Amazon Translate is used only on the vocabulary map, which has no sentence to give the
  AI. Supersedes the 5-second limit and the Amazon fallback in meaning-in-context.feature.

  Background:
    Given I am reading French, my native language is English, and the AI is set up

  # --- Waiting and trying again ---

  Scenario: A slow answer within 15 seconds is used
    Given the AI takes 8 seconds to say "inégalitaire" means "unequal"
    When I click "inégalitaire" in a sentence
    Then the popup shows "unequal" as the meaning in this sentence
    And the AI was asked once

  Scenario: A try that times out is followed by a second try
    Given the AI's first answer would take longer than 15 seconds
    And its second answer comes quickly with "unequal"
    When I click "inégalitaire" in a sentence
    Then the popup shows "unequal" as the meaning in this sentence
    And that meaning is kept for that word in that sentence

  Scenario: A try that fails with a server error is followed by a second try
    Given the AI answers the first try with a server error or "too many requests"
    And its second answer is "unequal"
    When I click "inégalitaire" in a sentence
    Then the popup shows "unequal"

  Scenario: An error that won't change on a second try is not retried
    Given the AI rejects the request (a bad key or a bad request)
    When I click "inégalitaire" in a sentence
    Then the AI was asked once

  Scenario: An answer that arrives but can't be used is not retried
    Given the AI answers with something unreadable, cut off, or with no usable meaning
    When I click "inégalitaire" in a sentence
    Then the AI was asked once

  # --- When the AI gives nothing ---

  Scenario: Two failed tries leave the popup without a suggested meaning, and Amazon Translate is not asked
    Given both tries time out or fail
    When I click "inégalitaire" in a sentence
    Then the popup shows no suggested meaning, and I can still type my own
    And the AI was asked exactly twice
    And Amazon Translate is not asked

  Scenario: Other learners' meanings still show when the AI gives nothing
    Given other learners saved "unequal" for "inégalitaire"
    And both tries fail
    When I click "inégalitaire" in a sentence
    Then the popup shows "unequal" as other learners' meaning

  Scenario: Clicking the word again asks the AI again
    Given both tries failed for "inégalitaire" in this sentence
    When I close the popup and click "inégalitaire" there again
    Then the AI is asked again, and its answer shows if it gives one
    And nothing was kept as the sentence's meaning after the failed tries

  Scenario: An Amazon answer stored earlier is not shown in the reader
    Given Amazon Translate's "unequal" was stored for "inégalitaire" before this change
    And both AI tries fail
    When I click "inégalitaire" in a sentence
    Then the popup shows no suggested meaning

  Scenario: With the AI turned off the reader shows no suggested meaning
    Given the AI is not set up on the server
    When I click "inégalitaire" in a sentence
    Then the popup shows other learners' meanings if there are any, and otherwise no suggested meaning
    And Amazon Translate is not asked

  Scenario: A word with no text around it is asked about on its own
    Given a lesson whose only text is "inégalitaire"
    When I click it
    Then the AI is asked for the meaning of the marked word with nothing around it
    And Amazon Translate is not asked

  # --- Amazon Translate stays on the vocabulary map ---

  Scenario: The vocabulary map still uses Amazon Translate
    When I open "inégalitaire" on the vocabulary map
    Then its meaning comes from Amazon Translate, stored or new, as before

  # --- Counting ---

  Scenario: Each try is counted in the AI and lookup statistics
    Given the first try timed out and the second answered
    When an admin looks at today's lookup statistics
    Then the word lookup shows 2 AI calls, 1 of them failed
    And the timed-out try is charged as its full 200-token allowance, as timed-out calls already are

  Scenario: Other AI features keep their own limits
    When a lesson is tidied, tagged or reviewed by the AI
    Then it keeps its 30-second limit and is not retried by this change
