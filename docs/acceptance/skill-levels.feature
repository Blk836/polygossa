Feature: Skill levels on the Progress tab (docs/ai-plan.md, section 2)
  Separate Reading, Listening and Writing levels per language, recomputed from evidence every time Progress loads.
  Reading and Listening come from vocabulary and finished content (no AI). Writing comes from the AI's grades of
  writing tests. Each level has a confidence and says what it is based on.

  Background:
    Given I am signed in and my target language is Spanish

  # --- Reading ---

  Scenario Outline: Reading level from known words
    Given I know <known> Spanish words and have finished no texts
    When I open Progress
    Then Reading shows <level>

    Examples:
      | known | level            |
      | 49    | Not enough data  |
      | 50    | A1               |
      | 1199  | A1               |
      | 1200  | A2               |
      | 2500  | B1               |
      | 5000  | B2               |
      | 9000  | C1               |
      | 15000 | C2               |

  Scenario: Chinese and Japanese use their own thresholds
    Given I know 1200 Japanese words
    When I switch the target language to Japanese and open Progress
    Then Reading uses the Japanese threshold table, not the European one

  Scenario: Finishing harder texts raises Reading by at most one level
    Given I know 1300 Spanish words (A2 by vocabulary)
    And I have finished 3 Spanish B2 texts (not videos or audio)
    When I open Progress
    Then Reading shows B1, one level above vocabulary, not B2

  Scenario: Fewer than 3 finished texts at a level don't count
    Given I know 1300 Spanish words and have finished 2 B1 texts
    Then Reading shows A2

  Scenario: Opening texts without finishing them doesn't count
    Given I know 1300 Spanish words and have read 3 B1 texts to 80%
    Then Reading shows A2

  Scenario: Only the target language counts
    Given I know 6000 French words and 100 Spanish words
    Then Reading for Spanish shows A1

  # --- Listening ---

  Scenario: No listening yet
    Given I have finished no Spanish videos or audio texts
    Then Listening shows "Not enough data" and suggests watching a video

  Scenario: Listening from finished videos and audio
    Given I know 3000 Spanish words (B1 by vocabulary)
    And I have finished 3 Spanish A2 videos and 3 Spanish B1 audio texts
    Then Listening shows B1

  Scenario: Listening can't exceed vocabulary by more than one level
    Given I know 600 Spanish words (A1 by vocabulary)
    And I have finished 4 Spanish C1 videos
    Then Listening shows A2

  Scenario: Listening shows how much I've listened
    Given I have 95 minutes of reading sessions on Spanish videos and audio texts
    Then Listening shows "1h 35m listened"

  # --- Writing (AI) ---

  Scenario: No writing tests yet
    Given I have no graded Spanish writing tests
    Then Writing shows "Not enough data" and a link to take a writing test

  Scenario: Writing from the AI grades of recent tests
    Given my last 5 graded Spanish tests were given levels A2, B1, B1, B2, B1 by the AI (newest first)
    Then Writing shows B1

  Scenario: Only the last 5 graded tests count
    Given my last 5 graded tests were all B2 and 10 older tests were all A1
    Then Writing shows B2

  Scenario: Ungraded, expired and unknown-level tests are ignored
    Given I have 2 graded B1 tests, 3 ungraded tests, 1 expired test and 1 graded test with an unknown level
    Then Writing shows B1 based on 2 tests

  Scenario: Writing doesn't wait on the AI
    Given the AI service is down
    When I open Progress
    Then all three levels still show, using grades already stored

  # --- Confidence and overall ---

  Scenario Outline: Confidence from the amount of evidence
    Given my Writing level is based on <tests> graded tests
    Then Writing confidence is <confidence>
    And an "estimate" label shows when confidence is low

    Examples:
      | tests | confidence |
      | 1     | low        |
      | 2     | low        |
      | 3     | medium     |
      | 5     | high       |

  Scenario: Reading and Listening confidence
    Then Reading and Listening confidence is low with fewer than 3 finished items counted, medium with 3–9,
      and high with 10 or more, or with at least 2500 known words for Reading

  Scenario: Overall level
    Given Reading is B2, Listening is B1, Writing is A2
    Then Overall shows B1 (the average, rounded down)

  Scenario: Overall with missing skills
    Given Reading is B1 and Listening and Writing have not enough data
    Then Overall shows B1, noted as based on Reading only

  Scenario: Nothing at all
    Given I am a new user with no words, texts or tests
    Then every level shows "Not enough data" and Overall is hidden

  # --- Plans and UI ---

  Scenario: Free plan sees all levels
    Given I am on the Free plan
    Then Reading and Listening show as normal
    And Writing shows any grades I already have (taking new tests still needs Pro)

  Scenario: Levels follow the language picker
    Given I switch the top-bar language from Spanish to French
    Then the levels update to French without a page reload

  Scenario: Levels update after new evidence
    Given Reading shows A1 with 1190 known words
    When I mark 10 more words known and reopen Progress
    Then Reading shows A2
