Feature: "Page not found" has one main landmark, in the app and out of it (#188)
  Inside the app shell, the not-found page put its own <main> inside the shell's.

  Scenario: A text that can't be opened
    Given I'm signed in
    When I open /read/99999
    Then "Page not found" shows with a sorry Polly and a link home
    And the page has exactly one main landmark

  Scenario: An address that isn't a page
    When I open an address no page has
    Then "Page not found" shows
    And the page has exactly one main landmark
