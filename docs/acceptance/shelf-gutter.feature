Feature: Phone shelves start at the page gutter (#185)
  Each sideways shelf on Explore loaded scrolled 16 px, so its first card touched the screen edge while headings
  kept the gutter: snapping aligned the first card with the scroll box's edge, eating its padding.

  Scenario: Explore's shelves on a phone
    Given shared texts filling a shelf on Explore
    When Explore opens at 390 px wide
    Then every shelf is scrolled to its start
    And its first card starts 16 px from the screen edge, in line with the headings

  Scenario: Wider screens are unchanged
    When Explore opens at 1280 px wide
    Then every shelf's first card lines up with its heading
