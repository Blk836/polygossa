Feature: Each page loads with its own outline
  A tab click shows an outline of the page being opened straight away (instant-tabs.feature). Every page used to
  get the same generic outline (a title and three boxes), so the screen jumped when the real page arrived. Now each
  page has an outline shaped like that page: its real title, its headings and controls in the same places, and grey
  shapes where its content will appear. So the page fills in without moving.

  Background:
    Given the server is slow to send the page I click

  Scenario Outline: A tab shows an outline shaped like its page
    When I open <page>
    Then I see the title "<title>" straight away
    And grey shapes stand in for <content>
    And when the page arrives, its title and main sections are where the outline had them

    Examples:
      | page        | title         | content                                                                                      |
      | Explore     | Explore       | the search and filter bar, the category chips, and rows of cards                             |
      | My library  | My library    | the Playlists and Import buttons, the filter bar, and a grid of cards                        |
      | Review      | Review        | the daily goal bar and one flashcard                                                         |
      | Words       | Vocabulary    | the import and export buttons, the Words/Sentences switch, the filters, and rows of words    |
      | Write       | Writing       | the panel to start a test and the list of past tests                                         |
      | Progress    | Progress      | the period picker, the streak card beside the goal and milestone cards, then the wide cards  |
      | Forum       | Forum         | the New thread button, the category tabs, and a list of threads                              |
      | Playlists   | Playlists     | a grid of playlist cards                                                                      |
      | Classes     | Classes       | a list of classes                                                                            |
      | Import      | Import        | the import form                                                                              |

  Scenario: While a page's own data loads, it keeps the outline instead of a spinner
    Given the page has arrived but its content is still loading (cards, figures, threads, words, past tests, flashcard)
    Then the outline's grey shapes stay where that content will appear
    And no spinner replaces them
    And on a reload, with nothing remembered, the same shapes show until the content arrives

  Scenario: Card outlines follow my chosen card layout
    Given I picked the "List" card layout
    When I open My library or Explore
    Then the outline shows list rows, not large cards
    And with "Compact" it shows the compact grid, and with "Cards" the large cards

  Scenario: Opening a lesson shows the reader's outline
    When I open a text or video from a card
    Then I see the reader's top bar (back to Library, title, settings) straight away
    And grey lines stand in for the text, at the width the lesson will have
    And no title from another page shows

  Scenario: Pages inside Settings keep the Settings tabs
    Given I am on Settings
    When I click another Settings tab
    Then the Settings title and its tabs stay where they are
    And only the tab's content shows an outline

  Scenario: Pages without their own outline still get a neutral one
    When I open a page that has no outline of its own (e.g. a forum thread, a class, a playlist, onboarding, admin)
    Then an outline with no title shows, rather than another page's

  Scenario: Outlines work for everyone
    Then each outline is marked busy for screen readers ("Loading <page>"), not read out shape by shape
    And with reduced motion the outline doesn't pulse
    And outlines use the theme's colours in light and dark mode
    And on a phone the outline has the phone layout, with no sideways scrolling
