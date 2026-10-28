Feature: The popup waits longer for the AI's meaning, and asks a second time if the first try fails
  On 2026-10-28 "inégalitaire" got no meaning: the AI didn't answer within 5 seconds, so the popup gave up on it,
  and the Amazon Translate fallback failed too. The same request normally takes about a second. A word's meaning
  now waits up to 15 seconds for each try, and a try that fails is followed by one more, so the popup waits at most
  30 seconds before falling back. Supersedes the 5-second limit in meaning-in-context.feature.

  Background:
    Given I am reading French, my native language is English, and the AI is set up

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

  Scenario: Two failed tries fall back to Amazon Translate
    Given both tries time out or fail
    When I click "inégalitaire" in a sentence
    Then the popup shows Amazon Translate's meaning, as before
    And the AI was asked exactly twice
    And nothing is kept as the sentence's meaning, so the next click asks the AI again

  Scenario: An error that won't change on a second try is not retried
    Given the AI rejects the request (a bad key or a bad request)
    When I click "inégalitaire" in a sentence
    Then the AI was asked once and the popup falls back to Amazon Translate

  Scenario: An answer that arrives but can't be used is not retried
    Given the AI answers with something unreadable, cut off, or with no usable meaning
    When I click "inégalitaire" in a sentence
    Then the AI was asked once and the popup falls back to Amazon Translate

  Scenario: Each try is counted in the AI and lookup statistics
    Given the first try timed out and the second answered
    When an admin looks at today's lookup statistics
    Then the word lookup shows 2 AI calls, 1 of them failed
    And the timed-out try is charged as its full 200-token allowance, as timed-out calls already are

  Scenario: Other AI features keep their own limits
    When a lesson is tidied, tagged or reviewed by the AI
    Then it keeps its 30-second limit and is not retried by this change
