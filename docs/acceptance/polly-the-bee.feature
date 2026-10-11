Feature: Polly the bee branding
  The name stays; a bee called Polly becomes the mascot, honey becomes the colour of
  a known word, and the vocabulary grows like a honeycomb filling up.

  # Logo and icon
  Scenario: The tab shows the hive mark
    When I open any page
    Then the browser tab icon is the hexagon with Polly inside

  Scenario: The top bar shows Classic Polly beside the name
    When I open any page with the top bar
    Then Classic Polly appears just before the brand name
    And she reads as "Polly the bee" to screen readers

  Scenario: Brand name stays configurable
    Given a different brand name is configured
    Then Polly and the tab icon still show, next to that name

  # Known is honey
  Scenario: Known is honey wherever it was green
    Then the Known button in the word popup is honey
    And the Known badge on the Words list is honey
    And the known part of a lesson's progress bar is honey

  Scenario: Learning and known stay easy to tell apart
    Given words in both states
    Then learning is pale honey and known is deep honey
    And they differ in lightness, not just hue, in light and dark themes

  Scenario: Known stays plain in the reading text
    When I mark a word known in the reader
    Then it has no highlight in the text, as today

  # Honeycomb map
  Scenario: The vocabulary map fills with honey
    Given the map shows known, learning and new words
    Then known tiles are deep honey, learning tiles pale honey, new tiles unfilled
    And the map's labels and focus outline stay readable on honey tiles

  # Honey jar
  Scenario: The known count in the top bar has a honey jar
    Then a small honey jar sits just before the known-word count, inside the same link
    And clicking the jar opens the Words list, like clicking the count
    And the link still reads "<count> known words" to screen readers (the jar is silent)
    And the link's visible text is still "<count> known"

  Scenario: The jar reacts when I learn a word
    Given I am in the reader
    When I mark a word known and move page
    Then the count goes up and the jar gives one small wobble
    But with "reduce motion" on, the count changes with no wobble

  # Polly in empty screens
  Scenario: Empty screens show a sleepy Polly
    When any list is empty (library, words, playlists, classes, forum, Explore search)
    Then a sleepy Polly sits above the message
    And the message and buttons are unchanged

  Scenario: Finishing review shows Polly cheering
    When I have no reviews left
    Then "All caught up!" shows a cheering Polly instead of the sleepy one

  Scenario: Polly is decoration
    Then screen readers skip the empty-screen Pollys
    And they shrink to fit on a phone without pushing buttons off screen

  # Dark mode
  Scenario: Everything works in the dark theme
    Given the dark theme
    Then honey is a slightly lighter shade that still stands out
    And Polly's outline, the jar and the map tiles stay visible
