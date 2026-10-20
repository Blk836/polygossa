Feature: Word-timed captions from a video's audio, for curated videos without captions
  Some videos worth curating have no captions in their language on YouTube, so their words can't be timed. The bulk
  importer's --transcribe option downloads such a video's audio on the curator's PC (yt-dlp) and sends it to the local
  backend, which has OpenAI Whisper transcribe it with a time for every word. The backend never downloads from
  YouTube, and production only ever receives the finished transcript through --copy-from. Whisper costs about $0.006
  an audio minute, so every video has a length limit and all transcription shares a spending cap.

  Background:
    Given the backend runs with a curator token and an OpenAI key
    And transcription allows 30 minutes a video and $10 in all, at $0.006 a minute

  Scenario: A video with no captions gets word-timed captions from its audio
    Given a curated Spanish video with no Spanish captions on YouTube
    When I run the tool with --transcribe on a list holding it
    Then its audio is downloaded on my PC and transcribed by Whisper
    And the community library gets the video with Whisper's transcript, punctuation included
    And each word is highlighted from the moment Whisper heard it
    And the tool prints "transcribed" with the title

  Scenario: A video that has captions still uses YouTube's
    Given a curated video with Spanish captions on YouTube
    When I run the tool with --transcribe on it
    Then it is imported from YouTube's captions, as without --transcribe
    And no audio is downloaded and Whisper is not called

  Scenario: The dry run states the cost before anything is spent
    When I run the tool with --transcribe --dry-run
    Then each video without captions is listed "would transcribe" with its length and estimated cost
    And the summary gives the total minutes and estimated cost
    And no audio is downloaded or sent and nothing is saved

  Scenario: A video over the length limit is skipped
    Given a 45-minute video without captions
    When it is transcribed
    Then it is reported skipped as too long to transcribe, and nothing is downloaded or spent

  Scenario: A video whose length the backend can't get from YouTube is quoted with yt-dlp's
    Given the backend's own YouTube lookup gives no length (YouTube often blocks it)
    When the tool quotes the video
    Then it reads the length with yt-dlp, signed in, without downloading, and asks for the quote again with it
    And the length limit and spending cap apply to that length as to any other

  Scenario: A video whose length neither the backend nor yt-dlp can get is skipped
    Then it is reported skipped, since its cost can't be known in advance

  Scenario: The spending cap stops transcription
    Given $9.95 of the $10 has been spent on transcription
    When a 10-minute video ($0.06) would be transcribed
    Then it is reported skipped as over the transcription budget, and nothing is downloaded or spent
    And the run carries on with the remaining lines

  Scenario: What Whisper is paid for is counted, even when the result is refused
    When Whisper transcribes audio, usable or not
    Then the audio's length is added to the transcription spending

  Scenario: No OpenAI key
    Given the backend runs without an OpenAI key
    When I run the tool with --transcribe
    Then it stops with "transcription is switched off on the backend"
    And imports without --transcribe work as before

  Scenario: Whisper hears nothing usable
    Given the audio is only music or silence, or Whisper hears a language other than the video's
    When it is transcribed
    Then nothing is imported and the video is reported skipped with the reason ("no speech found" or the language heard)

  Scenario: Whisper fails
    Given the OpenAI service errors
    Then nothing is imported or counted and the video is reported failed, worth retrying

  Scenario: The audio can't be downloaded
    Given yt-dlp is missing or can't fetch the video (private, region-locked, blocked)
    Then that video is reported failed with the reason and the run carries on

  Scenario: Audio too big for Whisper is refused
    Given the downloaded audio is over Whisper's 25 MB limit
    Then the backend refuses it without calling Whisper

  Scenario: A transcribed video reaches production with its timings
    Given a video transcribed on the local backend
    When I copy it to production with --copy-from
    Then production has the same transcript and word timings, without contacting YouTube or OpenAI for captions

  Scenario: --transcribe goes only with plain imports
    When I combine --transcribe with --copy-from or --playlist
    Then the tool stops and says they don't go together
