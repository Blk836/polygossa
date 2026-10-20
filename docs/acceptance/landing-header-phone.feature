Feature: The landing page's header is one tidy row on small phones (#191)
  At 360 and 375 px the bee sat above "Polygossa.", and "Sign in" and "Start free" each broke onto two lines.

  Scenario Outline: One row on a phone
    Given a signed-out visitor on the landing page at <width> px wide
    Then the bee sits beside "Polygossa." on one line
    And "Sign in" and "Start free" each fit on one line
    And the header is no taller than at 390 px, and nothing scrolls sideways

    Examples:
      | width |
      | 360   |
      | 375   |

  Scenario: Wider screens are unchanged
    Given the landing page at 1280 px wide
    Then the header shows the logo, the section links, "Sign in" and "Start free" on one row
