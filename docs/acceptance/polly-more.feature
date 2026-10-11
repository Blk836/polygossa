Feature: Polly does more — winning moments, moods tied to real states, props, a small Polly
  Polly the bee shows up when learners do well, looks sorry when something breaks, holds a prop
  that fits the section, and has a simpler drawing for small sizes. Picked from the mockups:
  sorry (not confused) for errors, line arms with round hands, the small Polly without antennae,
  and the hive mark stays the tab icon.

  # Her drawing
  Scenario: Her stripes stay inside her body
    When Polly is drawn in any mood, at any size
    Then both stripes end exactly at her outline and never stick out past it
    And there is a clear gap of honey between the lower stripe and her bottom edge

  Scenario: New moods
    Then Polly can be curious (head tilted, one antenna bent, one eyebrow raised)
    And thinking (looking up, with thought bubbles)
    And proud (eyes closed, holding a honey drop)
    And sorry (worried brows, drooping antennae and wings, a sweat drop)
    And happy, sleepy and cheering look as they do today

  Scenario: Props
    Then Polly can hold a book, headphones, a pencil or flashcards, with line arms and round hands
    And any prop can go with any mood
    And without a prop she has no arms, as today

  Scenario: The small Polly
    When Polly is drawn smaller than 32 pixels
    Then she is the simple drawing: body, one stripe, dot eyes and wings, with no antennae, cheeks or mouth
    And the logo in the top bar uses it, still read as "Polly the bee" by screen readers
    And the browser tab icon is still the hive mark

  # The right mood on every empty screen
  Scenario Outline: Each empty screen gets the mood that fits
    When the screen "<screen>" is empty
    Then Polly is <mood><prop>
    And the message and buttons are unchanged

    Examples: invite an action
      | screen                                         | mood    | prop               |
      | Library: nothing yet, or nothing saved outside playlists | curious | , holding a book   |
      | Library or Explore: no results for the filters or search | curious |                    |
      | Explore, filtered to videos: no results        | curious | , wearing headphones |
      | Explore: nothing shared in this language yet   | curious |                    |
      | Words or Phrases: none yet                     | curious | , holding a book   |
      | Playlists: none yet, or an empty playlist      | curious |                    |
      | Forum: no threads yet                          | curious |                    |
      | Classes: not in any class; a class with no students | curious |               |
      | Progress: the growth curve hasn't started      | curious |                    |
      | Writing: no language chosen                    | curious | , holding a pencil |

    Examples: nothing to do right now
      | screen                                         | mood    | prop               |
      | A class with no assignments yet                | sleepy  |                    |

    Examples: done
      | screen                                         | mood     | prop                  |
      | Review: all caught up, or nothing left to practise | cheering | , holding flashcards |

    Examples: gone
      | screen                                         | mood    | prop               |
      | A thread or playlist that doesn't exist        | sorry   |                    |

  # Errors
  Scenario: A page that fails to load shows a sorry Polly
    Given a page inside the app fails to load (the server errored or the connection dropped)
    Then I see a sorry Polly, "This page couldn't load" and "Check your connection and try again."
    And a "Try again" button that loads the page again
    And the top bar is still there, so I can go somewhere else

  Scenario: An address that doesn't exist shows a sorry Polly
    When I open an address that isn't a page
    Then I see a sorry Polly, "Page not found" and a link back home

  # Thinking while AI works
  Scenario: Polly thinks while my writing is graded
    When I hand in a writing test and the grading is under way
    Then a thinking Polly holding a pencil sits above the outline of the results, with "Grading your writing…"
    And when the grade arrives she is gone and the results show as today

  Scenario: Polly thinks while a word's meaning is looked up
    When I click a word and its meaning is still loading in the popup
    Then a small thinking Polly shows in place of the spinner
    And screen readers still hear that it is loading

  # Winning moments
  Scenario Outline: Reaching a known-word milestone
    Given I know <before> words in the language I'm learning
    When marking words known takes me to <after>
    Then a proud Polly says "<milestone> words known" with a "Keep reading" button
    And "Keep reading", its close button or Escape closes it and leaves me where I was
    And it doesn't block the page: I can keep clicking and typing underneath while it shows

  Scenario: A big jump, such as an Anki sync, also reaches a milestone
    Given I know 450 words
    When an Anki sync adds 700 known words
    Then "1,000 words known" shows without interrupting the sync bar or its buttons

    Examples:
      | before | after | milestone |
      | 99     | 100   | 100       |
      | 498    | 503   | 500       |
      | 999    | 1,000 | 1,000     |
      | 4,990  | 5,010 | 5,000     |

  Scenario: Each milestone shows only once
    Given I have seen "1,000 words known" in Italian
    When my Italian count drops below 1,000 and climbs back past it
    Then the milestone doesn't show again
    But reaching 1,000 in Spanish shows it for Spanish

  Scenario: Switching language is not a milestone
    Given I know 50 Spanish words and 2,000 Italian words
    When I switch the top bar from Spanish to Italian
    Then no milestone shows

  Scenario: Passing two milestones at once shows the higher one
    When one action takes me from 480 to 1,020 known words
    Then only "1,000 words known" shows, and 500 counts as seen

  Scenario: Keeping a streak
    Given I have a 6-day streak and haven't practised today
    When I do enough today to keep it
    Then a cheering Polly says "7-day streak kept" and "Come back tomorrow to make it 8."
    And it goes away by itself after a few seconds, or when I close it
    And it doesn't show again that day

  Scenario: Starting a streak is not "kept"
    Given I have no streak
    When I practise today
    Then a cheering Polly says "Streak started" instead

  Scenario: Finishing a lesson
    When I finish a lesson
    Then the summary shows a cheering Polly with "Lesson complete" in place of the 🎉
    And the numbers and buttons are unchanged

  Scenario: Marking a word known sends a small Polly to the jar
    Given I am reading and the honey jar is on screen
    When I mark a word known from the popup or with the keyboard
    Then a small Polly flies from the word to the honey jar
    And when she lands the jar wobbles and the count goes up by one
    And when the count next comes from the server it agrees, without a second wobble

  Scenario: Many words at once don't send a swarm
    When turning the page (or "mark the rest known") marks several words known
    Then no Polly flies; the count goes up and the jar wobbles once, as today

  Scenario: No flight when the jar isn't visible
    Given the top bar is scrolled away or hidden
    When I mark a word known
    Then no Polly flies and nothing else changes

  # Accessibility and motion
  Scenario: Reduced motion
    Given my system is set to reduce motion
    Then no Polly flies, the jar doesn't wobble, and the thought bubbles don't pulse
    But milestone and streak messages still appear, without animating in

  Scenario: Polly is decoration everywhere except the logo
    Then screen readers skip every Polly except the logo's
    And the milestone and streak messages are read out as text
    And the milestone message doesn't take keyboard focus away from what I was doing

  Scenario: Dark theme
    Given the dark theme
    Then every new mood, prop and the small Polly stay visible, using the theme's honey and outline colours
