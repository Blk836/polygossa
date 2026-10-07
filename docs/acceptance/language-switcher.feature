Feature: A lighter language switcher in the top bar
  The switcher sat in a bordered box, unlike the borderless counters and round avatar beside it. It becomes a plain
  control like the counters: the language's short code badge, its own name and a small chevron, with the same soft
  pill behind it only on hover or while its menu is open. No flags: languages aren't countries (Spanish, Portuguese,
  Chinese), and Windows shows emoji flags as letters anyway. The menu itself is unchanged.

  Scenario: At rest the switcher has no box
    Given I am on any app page on a desktop
    Then the language switcher has no border and no background of its own
    And it is as tall as the known-words and streak counters and lines up with them

  Scenario: Hovering shows the same soft pill as the counters
    When I point at the language switcher
    Then it gets the same background as a counter I point at

  Scenario: The pill stays while the menu is open
    When I open the language menu and move the pointer away
    Then the switcher keeps the soft pill until the menu closes
    And once the menu closes it has no background again

  Scenario: The switcher shows the language I'm learning
    Given I am learning Japanese
    Then the switcher shows the "JA" badge, "日本語" and a chevron
    When I pick Français from its menu
    Then the switcher shows the "FR" badge and "Français"

  Scenario: On a phone only the badge and chevron show
    Given I am on a phone-sized screen
    Then the switcher shows the badge and chevron but not the language's name
    And it still has no border

  Scenario: No language chosen yet
    Given I haven't picked a language
    Then the switcher shows a "?" badge and "Choose language"
