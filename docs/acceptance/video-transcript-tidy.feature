Feature: Tidying automatic YouTube transcripts
  Auto-generated YouTube captions arrive as one caption line per row, mostly lowercase and without full stops. On
  import they become running text with sentences: punctuation and capitals added by AI, never a word changed, and
  every word still lit up at its own moment while the video plays (issue #155). The first attempt (#160) cost about
  $5 in runaway AI replies and was reverted, so every call here has a small output cap and a daily ceiling.

  Background:
    Given AI is configured on the server

  Scenario: An automatic transcript is tidied into sentences
    Given a YouTube video whose captions in my language are auto-generated and unpunctuated
    When I import the video
    Then the transcript reads as sentences with punctuation and capital letters
    And caption lines run on within a sentence instead of each starting a new line
    And a paragraph starts at the end of a sentence about every 100 words

  Scenario: Every word still lights up at its own moment
    Given the automatic captions carry a start time for each word
    When the transcript is tidied
    And I play the video
    Then each word is highlighted at exactly the time it was before tidying
    Including a word that now has a capital letter or punctuation next to it
    And a word at the start or end of a caption line
    And clicking a word or line still jumps the video to that moment

  Scenario: A caption line the AI changes keeps its original words
    Given the AI's version of one caption line changes, adds or drops a word
    When I import the video
    Then that one line keeps its original text
    And the other caption lines in the same part are still tidied
    And every word, tidied or not, keeps its timing

  Scenario: The AI merges, splits or shifts caption lines
    Given the AI's reply has every word, but joins lines, splits them, or moves a word to the next line
    When I import the video
    Then the tidied text is cut back at the original caption lines, each with exactly its own words
    And every word keeps its timing
    But if a word also changed, that part keeps its original lines

  Scenario: Fillers the AI drops don't cost the line
    Given a caption line contains a filler such as "euh" or "hum"
    And the AI's version of the line leaves the filler out
    Then the line is tidied with the filler kept in its place
    And the filler keeps its timing

  Scenario: Already-punctuated automatic captions are joined without AI
    Given the automatic captions already have full stops (YouTube punctuates some languages itself)
    When I import the video
    Then nothing is sent to the AI
    And caption lines run on within a sentence instead of each starting a new line
    And every word keeps its timing

  Scenario: Human-made captions, subtitle files and pasted transcripts are left alone
    When I import a video with captions written by a person, a subtitle file or a pasted transcript
    Then nothing is sent to the AI
    And the transcript is laid out exactly as today

  Scenario: Each AI call has a small output cap
    When a part of the transcript is sent to the AI
    Then the reply may be at most about twice as long as the part sent
    And a reply cut off at that cap is treated as a failure and that part keeps its original lines

  Scenario: The AI fails, times out or answers nonsense
    When I import the video
    Then the import succeeds
    And the parts that failed keep their original lines, joined into running text

  Scenario: No AI configured
    Given AI is not configured on the server
    When I import a video with automatic captions
    Then the import works and nothing is sent to an AI

  Scenario: The day's system AI ceiling has been reached
    Given today's system AI tokens have reached the daily ceiling
    When I import a video with automatic, unpunctuated captions
    Then nothing is sent to the AI and the import succeeds untidied

  Scenario: Tidying is counted, but not against my allowance
    Given I've used all of today's AI allowance
    When I import a video with automatic, unpunctuated captions
    Then the transcript is still tidied
    And my allowance is unchanged
    And the admin AI tab shows the calls and tokens under the transcript tidy job

  Scenario: A long transcript goes in parts
    Given an automatic transcript of more than about 400 words
    When I import it
    Then it is sent to the AI in several parts, split between caption lines
    And the tidied parts are put back together in order

  Scenario: Videos imported before this are not touched
    When the server starts
    Then no transcript already in the library is sent to the AI
