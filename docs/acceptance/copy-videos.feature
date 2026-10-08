Feature: Copying curated videos from one backend to another
  Videos already imported locally (e.g. the InnerFrench podcast) should reach production without importing them from
  YouTube again: YouTube often blocks caption requests from cloud servers, and the work (captions, levelling, timings,
  category) is already done. The bulk importer (tools/import-videos.mjs) gets a copy mode: for each video in a list it
  reads the finished text from a source backend (local) and sends it to a target backend (production), which saves it
  in the community library. Both backends need a curator token; production gets one through CDK.

  Background:
    Given the source backend runs with a curator token
    And the target backend runs with its own curator token
    And the tool is run in copy mode with both addresses and both tokens

  # ---- Copying ----

  Scenario: A list of videos is copied into the target's community library
    Given the source has French video AAAAAAAAAAA with captions, word timings and the category "learners"
    And a list file containing its URL with language fr
    When I run the tool in copy mode on the file
    Then the target's community library has the video, owned by the library account, shared publicly
    And its title, transcript, captions, video length and category are the source's
    And its words, level and word timings are worked out on the target, so they match a normal import there
    And it appears in the target's Explore for French, with captions synced to the video
    And the target never contacts YouTube
    And the tool prints "copied" with the title, and a summary: 1 copied

  Scenario: Whoever owns the source copy, the target copy belongs to the library account
    Given the source's only copy of AAAAAAAAAAA is a learner's (public or private)
    When it is copied
    Then the target copy is owned by the library account and shared publicly

  Scenario: The source has several copies of the same video
    Given the source has a private learner copy and a public copy of AAAAAAAAAAA in French
    When it is copied
    Then the public copy is the one sent (the newest public one if there are several)

  Scenario: The shared text still passes the AI sharing check on the target
    Given the target has AI configured
    When a video is copied
    Then the target's AI checks that it's fine to share, as for any public import, but doesn't pick a category
    And a video the AI refuses is reported as "refused" with the reason, and nothing is saved

  # ---- Re-runs and duplicates ----

  Scenario: Re-running a copy doesn't create duplicates
    Given the target's library account already has AAAAAAAAAAA
    When I copy a list containing it again
    Then it is reported as "already imported" and nothing changes on the target

  Scenario: Dry run
    When I run the tool in copy mode with --dry-run
    Then each video the source has and the target lacks is reported as "would copy", and nothing is saved anywhere

  # ---- Failures ----

  Scenario: The source doesn't have the video
    Given the source has no copy of BBBBBBBBBBB in the line's language
    When it is copied
    Then it is reported as "skipped" (not on the source) and written to the retry file, and the rest still run

  Scenario: The source has the video in another language only
    Given the source has BBBBBBBBBBB only in Spanish and the line says fr
    Then it is reported as "skipped" and nothing is sent to the target

  Scenario: A token is wrong or a backend is unreachable
    When the source or target rejects its token, or can't be reached
    Then the run stops (exit code 1), saying which backend, and the remaining lines are "not run" in the retry file

  Scenario: The export is switched off without a token
    Given a backend runs without a curator token
    Then its export and copy endpoints answer 404, as the import endpoint does
    And a learner's login never grants access to them

  Scenario: A copy request with missing or invalid parts is refused
    When the target receives a copy without a transcript, with an unknown language or category, or a bad video id
    Then it answers 400 and saves nothing

  # ---- Production ----

  Scenario: Production accepts the curator token through the website
    Given production's backend has a curator token from Secrets Manager (created by CDK, never shown)
    When the tool calls https://<site>/api/curator/... with that token in the X-Curator-Token header
    Then the frontend passes the header on to the backend, and the call works
    And without the header (or with a wrong one) it is refused as before

  Scenario: Normal import mode is unchanged
    When I run the tool without copy mode
    Then it imports from YouTube exactly as before
