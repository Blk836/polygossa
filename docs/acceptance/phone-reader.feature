Feature: Reading on a phone (#141)
  On a phone the reader was squished: the player bar was the desktop bar wrapped onto two or three rows with Play
  pushed to the left, and the video, pinned above the text, could not be made smaller, leaving a few lines to read.
  The user decides how the video is shown; the app never shrinks or hides it by itself.

  YouTube's embedded player must be at least 200 x 200 px, visible to play, and nothing may cover it. A phone-width
  video is already about 358 x 201, so a smaller floating tile is not offered, and a YouTube video never plays while
  tucked away (no audio-only YouTube).

  Background:
    Given a phone screen, 390 x 844

  Scenario: The player bar is one row with Play in the middle
    When I open a video lesson
    Then the player bar is a single row of controls under a seek bar that spans the screen
    And Play is centred on the screen, with previous and next sentence either side of it
    And the bar is no taller than 80 px

  Scenario: Less-used controls are in a menu
    When I open a video lesson
    Then replay, loop and speed are not in the bar
    When I open "More player controls"
    Then replay sentence, loop sentence and the speed are there
    When I pick 1.25x
    Then the speed is 1.25x
    When I press Escape
    Then the menu closes
    When I open the menu again and tap the text outside it
    Then the menu closes

  Scenario: An audio lesson gets the same bar, with Close in the menu
    Given a text with synced audio
    When I open it, and its player opens with it
    Then Play is centred on the screen
    And "Close player" is in "More player controls" and closes the player

  Scenario: Wider screens keep the full bar
    Given a screen 1280 x 720
    When I open a video lesson
    Then Play, previous, next, replay, loop, the seek bar and the speed are all in the bar, with no "More player controls"

  Scenario: The video stays as it is until I change it
    When I open a video lesson, press Play and turn the page
    Then the video is still full width above the text

  Scenario: Tucking the video away gives the text the screen
    When I open a video lesson and tap "Tuck video away"
    Then the video is gone and a "Show video" tab sits on the right edge
    And the text has at least 60% of the screen's height above the player bar
    And the first page holds more words than it did with the video shown
    And the player bar stays

  Scenario: Swiping the video's handle sideways tucks it away
    When I swipe the handle under the video 120 px to the right
    Then the video is tucked away
    When I bring it back and swipe the handle only 30 px
    Then the video stays where it was

  Scenario: Tucking a playing video pauses it
    Given the video is playing
    When I tuck it away
    Then the video is paused

  Scenario: Pressing Play brings a tucked video back
    Given the video is tucked away
    When I press Play
    Then the video is shown again before it starts playing

  Scenario: The tab brings the video back without playing it
    Given the video is tucked away
    When I tap "Show video"
    Then the video is full width above the text again, paused, and the tab is gone

  Scenario: My choice is remembered
    Given I tucked the video away
    When I reload, or open another video lesson
    Then the video is still tucked away

  Scenario: A laptop ignores the phone's choice
    Given I tucked the video away on a phone
    When I open a video lesson on a screen 1280 x 720
    Then the video is beside the text, with no "Show video" tab and no "Tuck video away"
