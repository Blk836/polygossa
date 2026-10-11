Feature: Reader pages hold still
  A video above the text left room for under two lines on a window around 930 x 810, so pages were made three lines
  tall anyway and scrolled. The scrollbar came and went from page to page, every time it did the text got wider or
  narrower and was split into different pages (146 <-> 163), and the reader jumped back a page, or flipped between
  two pages every second while playing.

  Background:
    Given a long video lesson in the reader
    And the window is narrow enough that the video sits above the text

  Scenario: The video gives way so three lines of text fit
    Given a window 930 x 810, where the video at its usual size would leave room for under three lines
    When I open the lesson
    Then the video is shorter than usual, still 16:9
    And no page of the lesson scrolls, with room for three lines above the player bar (a page may end sooner, at a sentence)

  Scenario: A video with room to spare keeps its usual size
    Given a window 930 x 1100
    When I open the lesson
    Then the video is its usual height, 42% of the window
    And no page scrolls

  Scenario: On a window too short for both, the video stops shrinking at 180 px tall
    Given a window 930 x 500
    When I open the lesson
    Then the video is 180 px tall
    And pages keep three lines and scroll, as on any window too short for the text

  Scenario: Turning through the lesson never changes how it is split
    Given a window 930 x 810
    When I turn through every page with Next
    Then the page count stays the same on every page
    And each page starts with the word after the last one on the page before

  Scenario: Opening a word on a page that ends low keeps the page
    Given a window too short for the text, so a page scrolls
    And a short page that does not scroll
    When I click a word on that short page and its popup reaches below the window
    Then the reader stays on the same page, with the same page count and the same first word

  Scenario: A scrollbar appearing doesn't move the text sideways
    Given a page that does not scroll
    When something makes it scroll
    Then the text column keeps its width and position, because the reader always keeps space for the scrollbar
    And phones keep no such space, since their scrollbars float over the page, and other pages are unchanged

  Scenario: Playing across the end of a page turns once and stays
    Given an audio lesson on a window too short for the text, with playback on the last sentence of a page
    When the audio reaches the next page's first word
    Then the reader turns to the next page once
    And stays there while the next few words play

  Scenario: Laptops and phones are unchanged
    Given a laptop window 1280 x 720, with the video beside the text
    Then the video keeps its size beside the text
    And on a phone 390 x 844 the video above the text keeps its usual size, the full width of the screen
