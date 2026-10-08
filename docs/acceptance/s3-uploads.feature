Feature: Uploaded files kept in S3 (docs/production.md, phase 2)
  Today uploaded audio and profile photos are written to the server's disk, and production's server is replaced on
  every deploy, so every merge to main loses them. In production they go to a private S3 bucket in Ireland instead;
  local runs (QA) and tests keep the local folder and need no AWS. Learners notice nothing, except that their files
  stay.

  # --- Files survive ---

  Scenario: An uploaded audio file survives a deploy
    Given production stores uploads in its S3 bucket
    When a learner uploads audio for a text
    And production is redeployed
    Then the audio still plays

  Scenario: A profile photo survives a deploy
    When a learner uploads a profile photo and production is redeployed
    Then the photo still shows beside their name

  # --- Playing and serving ---

  Scenario: Learners can seek in audio stored in S3
    Given a text whose audio is in S3
    When the player asks for part of the file (an HTTP Range request), e.g. to jump to a sentence
    Then it gets just that part (206 Partial Content, with the range it got and the file's full length)

  Scenario: Audio plays from the start
    When the player asks for the whole file
    Then it gets all of it, with its type (e.g. audio/mpeg) and length, and is told seeking is supported

  Scenario: Who may play audio doesn't change
    Given a private text with audio
    When someone who can't read the text asks for its audio
    Then they get "not found", exactly as before; S3 is never reached

  Scenario: Photos are still cached for good
    Then a photo is served with its image type and a year-long private cache, as before

  # --- Replacing and removing ---

  Scenario: Replacing or removing audio or a photo deletes the old file
    When a learner replaces or removes their audio or photo, or deletes the text
    Then the old file is deleted from the bucket too, so nothing is left behind

  Scenario: A file that is gone answers "not found"
    Given a text whose audio file no longer exists (e.g. it was on a server's disk before this change)
    When its audio is requested
    Then the answer is 404 "Audio not found", not a server error

  # --- Failures ---

  Scenario: S3 being unreachable fails the upload clearly
    Given S3 doesn't answer or refuses the request
    When a learner uploads audio or a photo
    Then the upload fails with a message to try again, nothing is half-saved on the text or profile
    And the rest of the app keeps working

  Scenario: Upload checks are unchanged
    Then only audio files are accepted as audio, only real JPEGs and PNGs of at most 1 MB as photos, and empty files
      are refused, wherever the files are kept

  # --- Where files live ---

  Scenario: Local runs and tests keep the local folder
    Given no bucket is configured (local runs, backend tests, browser tests)
    Then uploads go to the local folder as before, and nothing needs AWS

  Scenario: The bucket is private, encrypted and only the backend can use it
    Then production's bucket is in Ireland, blocks all public access, encrypts files, refuses plain HTTP
    And only the backend's task can read, write and delete its files; the frontend can't
    And the bucket and its files are kept if the stack is ever deleted
    And the backend reaches S3 through the network's own S3 endpoint (no internet hop, no cost)
