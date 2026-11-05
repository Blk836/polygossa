Feature: Videos without captions can be transcribed up to 70 minutes
  The length limit for transcribing a video's audio with Whisper goes from 30 to 70 minutes by default,
  close to Whisper's own 25 MB file limit. Videos with captions keep their five-hour limit.

  Scenario: A 70-minute video without captions is transcribed
    Given the app runs with its default settings
    And a 70-minute video without readable captions
    When I import it
    Then its audio is transcribed and the lesson is created

  Scenario: A video just over 70 minutes is refused before anything is downloaded
    Given the app runs with its default settings
    And a 71-minute video without readable captions
    When I import it
    Then I see "71 min is over the 70-minute limit for videos without captions — upload a subtitle file or paste the transcript"
    And nothing is downloaded or spent

  Scenario: Audio over Whisper's 25 MB limit is still refused
    Given a video under 70 minutes without readable captions whose audio is over 25 MB
    When I import it
    Then I see that the audio is over Whisper's 25 MB limit, with the subtitle file and transcript as the way forward

  Scenario: Curated videos without captions follow the same 70-minute limit
    Given the app runs with its default settings
    When a curator queues a 71-minute video without captions for transcription
    Then it is skipped as too long, and nothing is downloaded or spent

  Scenario: The limit can still be changed per machine
    Given TRANSCRIPTION_MAX_MINUTES is set to 30
    When I import a 45-minute video without readable captions
    Then I see "45 min is over the 30-minute limit for videos without captions — upload a subtitle file or paste the transcript"

  Scenario: The spending cap still applies
    Given $9.95 of the $10 transcription budget has been spent
    When I import a 60-minute video without readable captions
    Then it is refused because the transcription budget is used up, and nothing is downloaded
