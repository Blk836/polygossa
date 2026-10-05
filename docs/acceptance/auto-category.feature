Feature: Imports are filed under a category by AI
  The import form no longer asks for a category. The server asks the AI to pick one of the fixed categories
  (learners, daily-life, stories, news, culture, travel, food, science, history, entertainment, other) from the
  title and the start of the content. The owner can still change it afterwards from the card's Category dropdown.

  Background:
    Given I am signed in
    And AI is configured

  Scenario Outline: Each kind of import is categorised by AI
    Given the AI answers {"category": "food"}
    When I import <source> without a category
    Then the import succeeds and its category is "food"
    And the AI was asked once, with the title, the start of the content and the list of category codes

    Examples:
      | source                   |
      | a pasted text            |
      | a web page (import-url)  |
      | a subtitle file          |
      | a YouTube video          |

  Scenario: A category the API caller chose is kept and the AI isn't asked for one
    When I paste a text with category "news" (private)
    Then its category is "news"
    And the AI was not called

  Scenario: Only the start of a long text is sent
    When I paste a text of 50,000 characters without a category
    Then the AI request holds at most the first 2,000 characters of the content

  Scenario Outline: The AI's answer can't be used, so the old default applies
    Given <problem>
    When I paste a text without a category
    Then the import still succeeds, and its category is "other"
    When I import a YouTube video whose YouTube category is "Education" without a category
    Then the import still succeeds, and its category is "learners" (YouTube's mapping)

    Examples:
      | problem                                         |
      | the AI answers {"category": "cooking"} (unknown) |
      | the AI answers {} (no category)                 |
      | the AI service returns HTTP 500                 |
      | the AI answers with text that isn't JSON        |

  Scenario: AI isn't configured
    Given OPENAI_API_KEY is not set
    When I paste a text without a category
    Then it imports with category "other" and no AI request is attempted

  Scenario: Categorising doesn't use the user's daily AI allowance
    Given my AI allowance for today is used up
    When I paste a text without a category
    Then it is still categorised by AI, and the import succeeds

  Scenario: Sample videos seeded at startup are not sent to the AI
    Then the seeder's imports keep using their listed category or YouTube's

  # UI (Playwright)
  Scenario: The import form has no Category field
    When I open /import, in every mode (paste, web page, subtitles, YouTube)
    Then there is no Category field
    And submitting a pasted text sends no category
