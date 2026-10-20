Feature: Country names on the vocabulary map don't run into each other on wide screens (#187)
  Only phone-width maps fitted their labels; wider ones placed every name and count where it fell, so "Nature &
  Environment" sat touching Work & Study's "0 / 18".

  Scenario Outline: No country's name or count touches another's
    Given French on Progress at <width> px wide
    When the map shows up to A1, then A2, then B1
    Then no country's name or count overlaps another country's

    Examples:
      | width |
      | 1400  |
      | 1024  |

  Scenario: A label that can't fit where it belongs moves or drops its count
    Given two countries whose labels would collide
    Then the smaller one's label tries its other spots, then shows its name without the count, and only then hides

  Scenario: Phone maps keep fitting as before
    Given the map on a 390 px phone
    Then labels are fitted with their names split at "&", as before
