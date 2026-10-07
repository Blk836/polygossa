Feature: First-visit feature tours
  Someone who has just created an account gets a short tour the first time they open each main page: two or three
  tips, each pointing at the control it explains ("click here, this does that"). Tours never block the page, and
  people who don't want them can skip one or all of them. Where the tours have been seen is kept on the account, so a
  tour isn't repeated on another device.

  Tours and their tips (each one or two short sentences):
    | tour      | page              | tips                                                                  |
    | library   | Library › Mine    | Import button, Explore sub-tab, language switcher                     |
    | explore   | Library › Explore | search and filters, the Saved sub-tab                                 |
    | import    | Import            | the source choice (text, web page, file, YouTube), the language       |
    | playlists | Library › Playlists | the new-playlist form, the Shared tab                               |
    | reader    | the reader        | click a word, select a phrase, turning the page (or Finish lesson) marks the rest known |
    | review    | Practice › Review | how review works (one tip about the whole page)                       |
    | words     | Practice › Words  | search and filters, importing words                                   |
    | writing   | Practice › Write  | what a writing test is (one tip about the whole page)                 |
    | progress  | Progress          | streak and daily goal, known words and levels                         |
    | forum     | Forum             | the categories                                                        |

  Background:
    Given I have just created an account

  Scenario: A tour starts the first time I open a page
    When I open Library
    Then a tip card titled with the first Library tip is shown
    And the control it describes is highlighted
    And the card says "1 of 3"
    And I can still use the page underneath

  Scenario: Stepping through a tour
    Given the Library tour is showing its first tip
    When I click "Next" twice
    Then I see the third tip, "3 of 3", with a "Done" button instead of "Next"
    When I click "Done"
    Then the tip card goes away

  Scenario: A finished tour doesn't come back
    Given I finished the Library tour
    When I reload Library, or open it on another device
    Then no tip card is shown

  Scenario: Skipping one tour
    Given a tour is showing
    When I close it (the × button, or Escape while the card has focus)
    Then it goes away and doesn't come back on that page
    But the next page I open for the first time still shows its own tour

  Scenario: Skipping all tours (for the lazy)
    Given a tour is showing
    When I click "Skip all tours"
    Then it goes away
    And no page shows a tour any more, on any device

  Scenario: Each page has its own tour, shown once
    When I open Practice › Words for the first time
    Then the Words tour is shown, not the Library one
    And after finishing it, opening Library still shows the Library tour

  Scenario: A tip whose control isn't on screen
    Given a tip's control is hidden (e.g. the top tabs on a phone) or not loaded yet
    Then the tip is shown on its own card at the bottom of the screen, without a highlight
    And it points at the control as soon as the control appears

  Scenario: Replaying the tours
    Given I skipped all tours, or finished some
    When I click "Show tours again" in Settings › Profile
    Then every page shows its tour again on the next visit

  Scenario: Turning tours off in Settings
    Given tours are on
    When I click "Turn off tours" in Settings › Profile
    Then no page shows a tour

  Scenario: Existing accounts aren't interrupted
    Given an account created before tours existed (or the development test account)
    When it opens any page
    Then no tour is shown
    But "Show tours again" in Settings › Profile turns them on

  Scenario Outline: A locked page keeps its tour until it opens up
    Given <situation>
    When I open <page>
    Then no tour is shown, only the page's own message (<message>)
    And the tour isn't marked seen
    When <change> and I open <page> again
    Then its tour is shown

    Examples:
      | page              | situation                         | message                    | change                        |
      | Practice › Review | I'm on the Free plan              | Review is part of Pro      | I switch to Pro               |
      | Practice › Write  | I'm on the Free plan              | writing tests are Pro      | I switch to Pro               |
      | Practice › Write  | I'm on Pro with no language yet   | choose a language first    | I pick a language             |

  Scenario: Pages without a tour
    When I open Onboarding, Settings, Classes, Admin or a forum thread
    Then no tour is shown

  Scenario: Saving a seen tour fails
    Given the server can't be reached
    When I finish or skip a tour
    Then the card still goes away for now
    And the tour may come back on the next visit (nothing is lost)

  Scenario: Bad tour names are refused
    When a client marks a tour named with anything other than lower-case letters and dashes (or too long) as seen
    Then the server answers 400 and stores nothing
