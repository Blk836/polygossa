Feature: The forum is a top-level tab (see docs/architecture/platform.md)
  The forum used to hide in the account menu. It is where learners talk to the team and each other, so it gets its
  own tab in the top bar (and the phone bottom bar), next to Library, Practice and Progress.

  Background:
    Given I am signed in

  Scenario: The top bar has four tabs
    When I open any page
    Then the top bar's tabs are Library, Practice, Progress and Forum, in that order

  Scenario: Forum tab opens the forum and is marked there
    When I click "Forum" in the top bar
    Then I am on /forum, and the Forum tab is marked as the current page
    And no sub-tab strip is shown

  Scenario: A thread page keeps the Forum tab marked
    When I open a thread (/forum/12) or the new-thread page (/forum/new)
    Then the Forum tab is marked as the current page

  Scenario: The account menu no longer lists the forum
    When I open the account menu
    Then it lists Settings and Classes, and not Forum

  Scenario: Phones
    Given a phone-sized window
    Then the bottom bar has Library, Practice, Progress and Forum, each with an icon
    And the page doesn't scroll sideways
