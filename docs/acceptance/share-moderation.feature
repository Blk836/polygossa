Feature: AI checks content before it is shared
  Only shared content is checked: a private import never asks the AI whether it is appropriate. When the import also
  needs a category, both questions go in the same AI request.
  Inappropriate means: sexually explicit content, graphic violence or gore, hate speech or harassment, encouraging
  self-harm or crime, spam or scams, or private people's personal data. News, history and fiction that merely deal
  with hard subjects are fine.

  Background:
    Given I am signed in
    And AI is configured

  Scenario Outline: A shared import that passes the check is shared
    Given the AI answers {"appropriate": true, "category": "food"}
    When I import <source> with "Share in the community library" ticked and no category
    Then the import succeeds, is public and is filed under "food"
    And the AI was asked once, and the request asks whether it is appropriate

    Examples:
      | source           |
      | a pasted text    |
      | a web page       |
      | a subtitle file  |
      | a YouTube video  |

  Scenario: A shared import that fails the check is refused and nothing is saved
    Given the AI answers {"appropriate": false, "reason": "Graphic violence"}
    When I paste a shared text
    Then the response is 422 with code "not_shareable"
    And the message says it can't be shared, gives the reason "Graphic violence", and suggests importing it without sharing
    And my library has no new text, and my import count is unchanged

  Scenario: A shared import with a chosen category is still checked
    Given the AI answers {"appropriate": true}
    When I paste a shared text with category "news"
    Then it is public and filed under "news", and the AI was asked once (appropriateness only)

  Scenario: A private import is not checked
    When I paste a private text without a category
    Then the AI request asks only for the category, not whether it is appropriate
    When I paste a private text with a category
    Then the AI is not called at all

  Scenario: The check sees more of the content than categorising does
    When I paste a shared text of 50,000 characters
    Then the AI request holds the first 8,000 characters and no more

  Scenario: Sharing a private text later is checked too
    Given a private text of mine
    And the AI answers {"appropriate": false, "reason": "Hate speech"}
    When I PATCH it with isPublic = true
    Then the response is 422 with code "not_shareable" and the reason, and the text stays private
    Given the AI answers {"appropriate": true}
    When I PATCH it with isPublic = true
    Then it is public

  Scenario: Changes that don't share anything aren't checked
    Given a public text of mine
    When I rename it, or PATCH isPublic = true again, or make it private
    Then the AI is not called

  Scenario Outline: When the check can't run, sharing is refused (AI configured)
    Given <problem>
    When I paste a shared text
    Then the response is 503 with code "review_unavailable", asking to try again or import without sharing
    And nothing is saved
    When I paste the same text privately
    Then it imports

    Examples:
      | problem                                          |
      | the AI service returns HTTP 500                  |
      | the AI answers with text that isn't JSON         |
      | the AI answers {"category": "food"} (no verdict) |

  Scenario: Without AI configured, sharing isn't checked
    Given OPENAI_API_KEY is not set
    When I paste a shared text
    Then it imports as public, with no AI request

  Scenario: The check doesn't use the user's daily AI allowance
    Given my AI allowance for today is used up
    When I paste a shared text that passes the check
    Then it imports as public

  Scenario: Seeded sample videos are not checked
    Then the seeder's public sample imports make no AI request

  # UI (Playwright; the refusal is simulated, as the dev server has no AI key)
  Scenario: The import form shows why sharing was refused
    Given the server refuses the import with 422 not_shareable "This can't be shared in the community library: Graphic violence. Import it without sharing to read it yourself."
    When I paste a text with sharing ticked and submit
    Then that message is shown on the form, I stay on /import, and the form keeps what I typed

  Scenario: The library card shows why sharing was refused
    Given a private text of mine, and the server refuses to share it with that message
    When I click Share on its card
    Then the message is shown and the card still says Private
