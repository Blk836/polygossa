Feature: Tidying automatic YouTube transcripts
  Auto-generated YouTube captions often arrive as one long run of lowercase words with no full stops, which reads
  badly and splits into a "sentence" per caption line. On import, AI restores punctuation, capitals and paragraph
  breaks, without ever changing a word, so video timing and word highlighting stay in sync (issue #155).

  Background:
    Given AI is configured on the server

  Scenario: An automatic transcript with no punctuation is tidied
    Given a YouTube video whose captions in my language are auto-generated
    And the captions have almost no full stops, question marks or exclamation marks
    When I import the video
    Then the transcript reads as sentences with punctuation and capital letters
    And caption lines run on within a sentence instead of each starting a new line
    And paragraphs start where the AI suggested

  Scenario: Timing still follows the words
    Given an automatic transcript has been tidied
    When I play the video
    Then each word is highlighted at the same moment as it would have been untidied
    And clicking a line in the transcript still jumps to that moment

  Scenario: Word-by-word timing marks survive tidying
    Given the automatic captions carry a start time for each word
    When the transcript is tidied
    Then each word keeps its own start time, even where punctuation was added before it

  Scenario: The AI changes, adds or drops a word
    Given the AI's tidied version of a part of the transcript doesn't have exactly the same words in the same order
    Then that part keeps its original, untidied text
    And the rest of the transcript is still tidied

  Scenario: The AI moves a word from one caption line to another
    Then that part keeps its original text, since the word's timing would be wrong

  Scenario: The AI fails, times out or answers nonsense
    When I import the video
    Then the import succeeds with the transcript exactly as it is today

  Scenario: No AI configured
    Given AI is not configured on the server
    When I import a video with automatic captions
    Then the import works exactly as today and nothing is sent to an AI

  Scenario: Human-made captions are left alone
    Given the video's captions were written by a person
    When I import it
    Then the transcript is not sent to the AI for tidying

  Scenario: Automatic captions that are already punctuated are left alone
    Given the automatic captions already have full stops (YouTube punctuates some languages itself)
    Then the transcript is not sent to the AI for tidying

  Scenario: Uploaded subtitle files and pasted transcripts are left alone
    When I import a video with a subtitle file or a pasted transcript
    Then nothing is sent to the AI for tidying

  Scenario: A long transcript goes in parts
    Given an automatic transcript of more than about 400 words
    When I import it
    Then it is sent to the AI in several parts, split between caption lines, asked at the same time
    And the tidied parts are put back together in order

  Scenario: Tidying doesn't use up my AI allowance
    Given I've used all of today's AI allowance
    When I import a video with an automatic, unpunctuated transcript
    Then the transcript is still tidied
    And my allowance is unchanged
