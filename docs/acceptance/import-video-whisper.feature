Feature: Importing a video without readable captions transcribes its audio
  YouTube often refuses the backend's caption lookup ("confirm you're not a bot"), and some videos have no captions in
  their language, so the Import page said "No captions found". When the backend can download audio (yt-dlp on this
  PC, signed in through a browser) and has an OpenAI key, it now downloads the video's audio and has Whisper
  transcribe it with a time for every word, as curated videos already can. Whisper costs about $0.006 an audio
  minute; the curator's limits apply: 30 minutes a video and $10 in all, shared with curated transcription.
  Production can't download from YouTube, so there the fallback is off and imports behave as before.

  Background:
    Given the backend runs with an OpenAI key and audio downloading switched on (yt-dlp, signed in through Firefox)
    And transcription allows 30 minutes a video and $10 in all, at $0.006 a minute

  Scenario: A video whose captions YouTube won't give is imported from its audio
    Given a 10-minute French video whose captions the backend can't read
    When I import it from the Import page as French, with no subtitle file or transcript
    Then its audio is downloaded and transcribed by Whisper
    And the lesson opens with Whisper's transcript, punctuation included, and the video's title
    And each word is highlighted from the moment Whisper heard it
    And the lesson's length is the audio's length
    And $0.06 is added to the transcription spending

  Scenario: A video whose captions can be read still uses them
    Given a video with French captions the backend can read
    When I import it as French
    Then it is imported from YouTube's captions as before
    And no audio is downloaded and Whisper is not called

  Scenario: My own subtitle file or transcript still wins
    When I import a video with a subtitle file or a pasted transcript
    Then that is used, and no audio is downloaded and Whisper is not called

  Scenario: While it works, the page says why it is taking long
    When an import is still running after a few seconds
    Then the Import page says a video without captions is being transcribed from its audio, which can take a minute or two

  Scenario: A video over the length limit is refused before anything is downloaded
    Given a 45-minute video without readable captions
    When I import it
    Then I see "45 min is over the 30-minute limit for videos without captions — upload a subtitle file or paste the transcript"
    And nothing is downloaded or spent

  Scenario: A video whose length can't be found is refused
    Given neither YouTube's lookup nor yt-dlp gives the video's length
    When I import it
    Then I see that its captions couldn't be read and its length couldn't be found, with the subtitle file and transcript as the way forward
    And nothing is downloaded or spent

  Scenario: The spending cap stops transcription
    Given $9.95 of the $10 has been spent on transcription
    When I import a 10-minute video without readable captions
    Then I see that the transcription budget is used up, with the subtitle file and transcript as the way forward
    And nothing is downloaded or spent

  Scenario: The audio can't be downloaded
    Given yt-dlp is missing, or can't fetch the video (private, region-locked, not signed in)
    When I import it
    Then I see that the captions and the audio couldn't be read, with the subtitle file and transcript as the way forward
    And nothing is saved or spent

  Scenario: Whisper hears nothing usable
    Given the audio is only music or silence, or Whisper hears a language other than the one I picked
    When I import it
    Then I see "no speech found" or the language Whisper heard, and nothing is saved
    And the audio Whisper was paid for is still counted

  Scenario: Whisper fails
    Given the OpenAI service errors
    When I import a video without readable captions
    Then I see that transcription failed and I can try again, and nothing is saved or counted

  Scenario: Audio too big for Whisper is refused
    Given the downloaded audio is over Whisper's 25 MB limit
    Then the import is refused without calling Whisper

  Scenario: Without audio downloading or an OpenAI key, imports behave as before
    Given the backend runs without audio downloading (as on production) or without an OpenAI key
    When I import a video without readable captions
    Then I see "No French captions found — upload a subtitle file or paste the transcript", as before
    And nothing is downloaded or spent

  Scenario: Plan limits still apply
    Given I have reached my plan's import limit
    When I import a video without readable captions
    Then I see the plan limit message, and nothing is downloaded or spent
