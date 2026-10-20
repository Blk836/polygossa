Feature: The Practice badge follows answered cards on the Review page (#183)
  The badge only refreshed on moving to another page, so after reviewing every card it still showed the old count
  beside "All caught up!".

  Scenario: The badge falls as cards are answered
    Given a Pro account with 2 cards due, on Practice › Review
    And the Practice tab shows "2"
    When I answer one card
    Then the Practice tab shows "1"

  Scenario: The badge goes when the last card is answered
    When I answer the last due card
    Then the page says "All caught up!"
    And the Practice tab shows no count, named just "Practice"

  Scenario: A card answered "Forgot" that is due again keeps counting
    When the answer leaves the same number of cards due
    Then the Practice tab keeps that number
