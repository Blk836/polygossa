Feature: Chapters imported from a book stay private (#189)
  Import › Book says "Books stay private" because most books are copyrighted, yet each imported chapter had the
  ordinary one-click Share button, and a shared book playlist told the owner to share its chapters.

  Scenario: The backend refuses to share a chapter
    Given an imported EPUB
    When its owner asks to share one of its chapters
    Then the answer is a refusal saying chapters imported from a book can't be shared
    And the chapter stays private and doesn't appear in Explore

  Scenario: Other changes to a chapter still work
    When the owner renames a chapter or changes its category
    Then the change is saved

  Scenario: No Share button on a chapter
    Given an imported book's chapters in My library
    Then they show no Share button
    And a pasted text still shows its Share button

  Scenario: A shared book playlist doesn't ask for its chapters to be shared
    Given an imported book's playlist, shared
    Then it says its chapters come from a book and stay private, so only the owner sees them
    And it doesn't say "share them from your library"

  Scenario: Other private items are still pointed out
    Given a shared playlist holding a private pasted text
    Then it still says "share them from your library to include them"

  Scenario: Chapters imported before this change
    Given chapters imported from a book before texts were marked
    Then they are marked as from a book, and any that were shared are private again
