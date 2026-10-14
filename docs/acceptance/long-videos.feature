Feature: Importing long videos
  A 97-minute French interview couldn't be imported: its captions came to more than 100,000 characters, the limit
  for every text, and the error told the learner to "split it into parts", which they can't do for a video. Videos
  keep one lesson for the whole video, with a higher limit of 300,000 characters (about five hours of speech).
  Texts that aren't videos keep the 100,000-character limit.

  Scenario: A video whose captions are longer than 100,000 characters imports as one lesson
    Given a YouTube video with 150,000 characters of captions in French
    When I import it from the Library's import form
    Then it is imported as one lesson with the whole transcript, from the first caption to the last
    And its words are timed to the video right to the end

  Scenario: A long video uploaded with a subtitle file or a pasted transcript gets the same limit
    Given a YouTube video and a subtitle file of 150,000 characters
    When I import the video with that file
    Then it is imported as one lesson
    And the same holds for a pasted transcript of 150,000 characters, which the form's box accepts

  Scenario: Bulk-imported and copied library videos get the same limit
    When the curator tool imports or copies a video with 150,000 characters of captions
    Then it is in the community library as one lesson

  Scenario: A video beyond the video limit is refused with a message that fits a video
    Given a YouTube video with more than 300,000 characters of captions
    When I import it
    Then nothing is imported and no import is counted against my plan
    And I see "This video's transcript is too long to import (the limit is about five hours of speech)"
    And the message doesn't tell me to split it into parts

  Scenario: Texts that aren't videos keep their limit
    When I paste a text of 100,001 characters
    Then it is refused with "Texts are limited to 100000 characters; split it into parts", as before
    And web pages and books are still cut or split at 100,000 characters

  Scenario: A long video lesson stays quick to read
    Given a video lesson of 300,000 characters and one of 100,000
    When I open each in the reader, turn to page 2 and click a word
    Then the long one opens in under 4 times as long as the short one (measured: 1.8 s against 0.7 s; before the
      fix 11 s against 1.3 s, because finding saved phrases slowed down faster than the text grew)
    And turning a page and opening a word take under 3 times as long as on the short one
    And the video's word highlighting looks up the spoken word by binary search, so it keeps up on any length
