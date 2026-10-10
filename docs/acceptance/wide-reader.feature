Feature: A wide, calm reader
  The reader used a narrow 768px column (640px beside a video) inside the app's 1152px page, under a tall header, so
  a laptop showed about 11 words a line and big empty margins. Like LingQ, the reader now uses the screen: a wider
  canvas, more words per line, a slim header, big page arrows beside the text, and a choice between a video beside
  the text and a small floating player for learners who only want to listen (podcasts, talks).
  Kept as they were: word colours, the follow-along underline, the word card, the bottom player bar, pages that fit
  the screen without scrolling (reader-fit), and everything about saving words.

  Background:
    Given I am signed in and open a lesson in the reader

  # --- A wider canvas --------------------------------------------------------------------------------------------

  Scenario: On a laptop the text uses the width of the screen
    Given a text without audio or video, on a 1440 × 900 window
    When the reader opens
    Then the text column is at least 960 px wide (it was 768 px), centred on the page
    And a line holds more words than before

  Scenario: Text width is a reader setting: Standard, Wide or Full
    When I open the reader settings ("Aa")
    Then "Text width" offers Standard (the old, book-like column), Wide (the default) and Full (the whole window)
    When I pick one
    Then the text column changes at once, and the pages refit, keeping my place
    And the choice is remembered for every lesson, and the first paint of the next lesson already uses it

  Scenario: Wider lines mean fewer page turns
    Given the same long text
    Then it has fewer pages at Wide than at Standard

  Scenario: Phones are unchanged in spirit
    Given a 390 px wide phone
    Then the text fills the screen's width with its usual margins, whatever the text width setting
    And nothing scrolls sideways

  # --- A slim header ---------------------------------------------------------------------------------------------

  Scenario: The header is slim, so more of the screen is text
    Then above the text there is only: the way back (Library, or the playlist strip), the title with the reader's
      tools beside it (add to playlist, audio, Aa settings, keyboard shortcuts), and one line with the level,
      language, word count, source, and how many of the words I know (percentage, bar, new and learning counts)
    And on a 1440 × 900 window the text starts no lower than 230 px from the top of the window (it was 275 px)

  Scenario: The known-word line updates as I read
    When I click a new word
    Then the header's counts change from "N new · M learning" to "N−1 new · M+1 learning"

  # --- Turning pages ---------------------------------------------------------------------------------------------

  Scenario: Big page arrows beside the text on wide screens
    Given a text of several pages on a window at least 1280 px wide
    Then a tall arrow sits on each side of the text, quiet until hovered
    When I click the right arrow
    Then the next page shows, exactly as the Next button does (including marking the page's new words known when
      that setting is on)
    When I click the left arrow
    Then the previous page shows
    And on the first page there is no left arrow, and on the last page no right arrow

  Scenario: The page arrows are for the mouse only
    Then they are not in the keyboard's tab order and screen readers skip them
    And the pager under the text (Previous, "Page n of N" with its bar, Next) stays, with Next as the main button

  Scenario: Phones have no side arrows
    Given a phone-sized window
    Then there are no side arrows; the pager under the text turns pages

  # --- Video: beside the text, or a mini player ------------------------------------------------------------------

  Scenario: A video sits beside the text, and the text is still wide
    Given a video lesson on a 1440 × 900 window
    Then the video is beside the text and stays in view
    And the text column is at least 760 px wide (it was 640 px)

  Scenario: Shrinking the video to a mini player
    Given a video lesson on a wide screen with the video beside the text
    When I press "Mini player" in the player bar
    Then the video keeps playing without reloading, in a small player in the bottom-right corner above the player bar
    And the text takes the reader's whole width, as for a lesson without video
    And the button now reads "Video beside text", and pressing it puts the video back beside the text

  Scenario: The choice of video layout is remembered
    Given I chose the mini player
    When I open another video lesson, or reload
    Then it opens with the mini player from the first paint

  Scenario: The mini player never covers the text
    Given the mini player is open
    When it would overlap the text column
    Then every page of text ends above the mini player, still without scrolling
    But on a window wide enough for it to sit in the margin beside the text, pages use the full height

  Scenario: The mini player is 360 × 203 px
    Given a video lesson on a wide screen
    When I press "Mini player"
    Then the player is 360 px wide and 16:9 (about 203 px tall), in the bottom-right corner above the player bar
    And the video fills it with no black bars
    And it keeps playing without reloading

  Scenario: The video is never hidden completely
    Then the mini player is never smaller than 200 × 200 px: YouTube's embedding rules require a visible player of
      at least that size, so "listening only" means the mini player, not a hidden video

  Scenario: Phones keep the video above the text
    Given a video lesson on a phone, whatever layout was chosen on a computer
    Then the video stays above the text as before, and there is no "Mini player" button

  Scenario: A video that can't be embedded
    Given the YouTube embed fails
    Then the transcript stays readable with the "Watch on YouTube" link, and there is no player bar or layout button

  # --- Loading ---------------------------------------------------------------------------------------------------

  Scenario: The loading outline matches the new reader
    When I open a lesson and it is still loading
    Then the outline shows the slim header and a wide text block, so nothing jumps when the lesson arrives
