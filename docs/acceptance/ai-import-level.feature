Feature: Imports get their CEFR level from AI
  Until now an import's level (A1 to C2) came from a formula: how varied the words are, how long the words are and
  how long the sentences are. It can't tell rare words from common ones, so a short text full of hard words can come
  out A1. The server now asks the AI for the level, in the same request that already picks the category and checks
  shared content, so an import still makes at most one AI request. The formula stays as the fallback.

  Background:
    Given I am signed in
    And AI is configured

  Scenario Outline: Each kind of import is levelled by AI
    Given the AI answers {"category": "food", "level": "B2"}
    When I import <source>
    Then the import succeeds and its level is "B2"
    And the AI was asked once, with the title, the start of the content and the six levels A1 to C2

    Examples:
      | source                  |
      | a pasted text           |
      | a web page (import-url) |
      | a subtitle file         |
      | a YouTube video         |
      | a curated video         |

  Scenario: The level is asked for even when the category was chosen and the text is private
    Given the AI answers {"level": "C1"}
    When I paste a text with category "news" (private)
    Then its category is "news" and its level is "C1"
    And the AI was asked once, for the level only

  Scenario: Sharing on import asks for the level in the same request as the sharing check
    Given the AI answers {"category": "stories", "appropriate": true, "level": "A2"}
    When I paste a public text without a category
    Then the import succeeds, shared, with category "stories" and level "A2"
    And the AI was asked once

  Scenario: Content refused for sharing is still refused
    Given the AI answers {"appropriate": false, "reason": "graphic violence", "level": "B1"}
    When I paste a public text
    Then the import is refused as before and nothing is saved

  Scenario: A lower-case level is accepted
    Given the AI answers {"level": " b1 "}
    When I paste a text
    Then its level is "B1"

  Scenario: Only the start of a long text is sent
    When I paste a private text of 50,000 characters
    Then the AI request holds at most the first 2,000 characters of the content

  Scenario Outline: The AI's level can't be used, so the formula's level applies
    Given <problem>
    When I paste a text
    Then the import still succeeds, with the level the formula gives that text

    Examples:
      | problem                                         |
      | the AI answers {"level": "B2+"} (not a level)   |
      | the AI answers {"level": "intermediate"}        |
      | the AI answers {} (no level)                    |
      | the AI service returns HTTP 500                 |
      | the AI answers with text that isn't JSON        |

  Scenario: AI isn't configured
    Given OPENAI_API_KEY is not set
    When I paste a text
    Then it imports with the formula's level and no AI request is attempted

  Scenario: Levelling doesn't use the user's daily AI allowance
    Given my AI allowance for today is used up
    When I paste a text
    Then it is still levelled by AI, and the import succeeds

  Scenario: A book is levelled once, and every chapter gets that level
    Given the AI answers {"level": "B2"}
    When I import an EPUB with 12 chapters
    Then every chapter's level is "B2"
    And the AI was asked once, with the start of the book's longest chapter (not its title page or contents)

  Scenario: A book whose level can't be had from AI keeps each chapter's formula level
    Given the AI service returns HTTP 500
    When I import an EPUB with 3 chapters
    Then the import succeeds and each chapter has the level the formula gives it

  Scenario: Seeded sample texts are never sent to the AI
    When the sample library is seeded
    Then no AI request is made and the samples keep the formula's levels

  Scenario: Tidying a transcript again keeps its level
    Given a video imported with the AI's level "C1", which the formula would call "A1"
    When an admin tidies its automatic YouTube transcript again
    Then its level is still "C1"

  Scenario: The startup clean-up jobs still re-rate the texts they fix
    # They only touch texts imported before their fixes, whose levels came from the formula (and were thrown off by
    # the bug they fix), so they never meet an AI level.
    Given a text imported before captions' [annotations] or split elisions were fixed
    When the backend starts
    Then its words are fixed and its level is worked out again by the formula, as before

  Scenario: Texts imported before this change keep their levels
    Given texts already in the library
    When the backend starts
    Then their levels are unchanged and no AI request is made

  Scenario: The library's level filter uses the AI's level
    Given a text levelled "B2" by AI
    When I filter my library by level "B2"
    Then that text is listed
