Feature: Everything clickable shows the pointing-hand cursor
  Links already show the hand. Buttons showed the plain arrow (Tailwind 4 no longer gives buttons a pointer), so the
  language picker and profile menu in the top bar felt unclickable next to the streak and known-words counters.
  The fix is one app-wide rule, so every button (about 80 of them) gets the hand, not just the two in the top bar.

  Scenario: The top bar's language picker shows the hand
    Given I am signed in on any app page
    When I hover over the language picker in the top right
    Then the cursor is the pointing hand, the same as over the streak and known-words counters

  Scenario: The top bar's profile menu shows the hand
    Given I am signed in on any app page
    When I hover over my profile button in the top right
    Then the cursor is the pointing hand

  Scenario: Buttons elsewhere show the hand too
    Given I am on a page with ordinary buttons, such as the items inside the open language or profile menu
    When I hover over one of them
    Then the cursor is the pointing hand

  Scenario: Other clickable controls that are not buttons show the hand
    Given a control built as a clickable element with the button role, or an expandable "details" summary
    When I hover over it
    Then the cursor is the pointing hand

  Scenario: A disabled button does not pretend to be clickable
    Given a button that is disabled (for example a submit button before the form is filled in)
    When I hover over it
    Then the cursor stays the plain arrow

  Scenario: Text inputs keep the text cursor
    Given a text box or text area
    When I hover over it
    Then the cursor is the text I-beam, not the hand
