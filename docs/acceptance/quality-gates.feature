Feature: Quality gates required by the gauntlet verification model

  Background:
    Given the repository at its current state

  # ---- tooling exists and runs ----

  Scenario: Backend mutation testing runs
    When I run "./gradlew :backend:pitest"
    Then PIT mutates the backend main classes using the JUnit 5 test suite
    And it writes an HTML report under backend/build/reports/pitest
    And the build fails if the mutation score drops below the configured threshold

  Scenario: Backend complexity and size limits are enforced
    When I run "./gradlew :backend:checkstyleMain"
    Then it fails for any method with cyclomatic complexity above 10
    And it fails for any source file longer than 300 lines
    And it passes on the current code

  Scenario: Frontend has a unit test runner
    When I run "npm test" in frontend/
    Then Vitest runs every *.test.ts file and exits 0 when all pass

  Scenario: Frontend mutation testing runs
    When I run "npm run mutate" in frontend/
    Then Stryker mutates the tested frontend modules using Vitest
    And it prints a mutation score and writes a report under frontend/reports/mutation

  Scenario: Frontend complexity and size limits are enforced
    When I run "npx eslint ." in frontend/
    Then it reports an error for any function with cyclomatic complexity above 10
    And it reports an error for any file longer than 300 lines
    And it passes on the current code

  # ---- refactors keep behaviour ----

  Scenario: The reader's text logic is unchanged after splitting reader.tsx
    Given tokens containing a separator ".\n\n" between two sentences
    When the tokens are grouped into paragraphs
    Then the first paragraph ends with "." and the second starts with the next word
    And no line-break characters are rendered

  Scenario: Saved phrases are marked wherever they occur
    Given the phrase "café con leche" saved as learning
    When it appears twice in a text, once with different capitalisation
    Then every word token of both occurrences is marked "learning"
    And words outside the occurrences are not marked

  Scenario: Phrase normalisation matches the backend
    When a selection "  Café   con\nLeche’s " is normalised
    Then the result is "café con leche's"

  Scenario: The audio position maps to the word being spoken
    Given word timings sorted by start time
    When the playback time falls inside a word's span (or within 400 ms after it)
    Then that word is active
    And when the time is before the first word or long after the last, no word is active

  Scenario: TextService behaviour is unchanged after splitting it
    Given the existing backend test suite and API smoke tests
    When TextService is split into smaller services
    Then every existing test still passes without being modified or weakened

  # ---- failure paths ----

  Scenario: A new overly complex function is rejected
    Given a function with cyclomatic complexity 11 is added to the backend or frontend
    When the complexity check runs
    Then it fails and names the function
