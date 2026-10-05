Feature: Bulk-importing curated YouTube videos from the command line
  To grow Explore and give recommendations enough to work with, we (the team, and Claude finding videos across
  YouTube) import many videos at once without the dashboard. A command-line tool in tools/ reads a list of videos and
  imports each one into the community library, owned by the same library account as the starter texts and shared
  publicly. Each video goes through the same import as the Library form: captions, levelling, word timings, AI
  category and the AI sharing check. The tool talks to the backend over HTTP using a curator token; with no token
  configured on the backend, bulk import is switched off.

  Background:
    Given the backend runs with CURATOR_TOKEN set
    And the tool is run with that token and the backend's address

  # ---- The list file ----

  Scenario: A list of videos is imported into the community library
    Given a list file with two lines:
      | https://www.youtube.com/watch?v=AAAAAAAAAAA fr          |
      | https://youtu.be/BBBBBBBBBBB es daily-life              |
    And both videos have captions in their language
    When I run the tool on the file
    Then both videos are in the community library, owned by the library account, shared publicly
    And the French one is filed by AI (or by YouTube's category without AI), the Spanish one under "daily-life"
    And both appear in Explore for their language, with captions synced to the video like any imported video
    And the tool prints one line per video ("imported", with the title) and a summary: 2 imported

  Scenario: A default language applies to lines that don't give one
    Given a list file of bare URLs
    When I run the tool with --language de
    Then every video is imported as German

  Scenario: Comments, blank lines and any YouTube URL form are accepted
    Given a list file with "#" comment lines, blank lines, and watch, youtu.be, shorts and embed URLs
    When I run the tool on it
    Then comments and blank lines are ignored and every URL form is imported

  Scenario: A malformed line is reported and the rest still run
    Given a list file where one line has an unknown language "xx", one an unknown category, and one isn't a YouTube URL
    When I run the tool on it
    Then those three lines are reported as "invalid" with the line number and the reason, without contacting the backend
    And every other line is imported

  # ---- Re-runs and duplicates ----

  Scenario: Re-running a list doesn't create duplicates
    Given the library account already has video AAAAAAAAAAA
    When I run the tool on a list containing it again (in any URL form)
    Then it is reported as "already imported" and nothing changes
    And YouTube is not contacted for it

  Scenario: The same video twice in one list is imported once
    Given a list file with the same video on two lines
    Then the first is imported and the second is reported as "already imported"

  Scenario: A learner's own copy doesn't count as already imported
    Given a learner privately imported video AAAAAAAAAAA
    When the tool imports it
    Then the library account gets its own public copy and the learner's copy is untouched

  # ---- Videos that can't be imported ----

  Scenario: A video with no captions in its language is skipped
    Given a video has no captions in the listed language
    When the tool imports it
    Then it is reported as "skipped: no captions" and nothing is saved
    And the run carries on with the next video

  Scenario: A video the AI finds inappropriate for sharing is refused
    Given AI is configured and finds a video inappropriate
    When the tool imports it
    Then it is reported as "refused" with the AI's reason and nothing is saved

  Scenario: A video that can't be checked for sharing is reported for a retry
    Given AI is configured but doesn't answer
    When the tool imports a video
    Then it is reported as "failed: review unavailable" and nothing is saved, so a later re-run can import it

  Scenario: A video YouTube can't find is reported
    Given a listed video doesn't exist or is private
    Then it is reported as "failed" with the reason and the run carries on

  Scenario: Failures can be retried from a results file
    When a run finishes
    Then it writes a results file next to the list (one line per video: URL, language, outcome, reason, title)
    And the lines that failed or were skipped can be fed back into the tool as a new list

  # ---- Limits and pacing ----

  Scenario: Plan limits don't apply to the library account
    Given ENFORCE_PLAN_LIMITS is on
    When the tool imports more videos than the free plan allows
    Then all of them are imported

  Scenario: Imports are paced to be polite to YouTube
    When the tool runs on a long list
    Then it imports one video at a time, waiting 2 seconds between them by default (--delay changes it)

  Scenario: A dry run checks the list without importing
    When I run the tool with --dry-run
    Then every line is parsed and reported as "would import", "already imported" or "invalid"
    And nothing is imported and YouTube is not contacted

  # ---- Access ----

  Scenario: Without a curator token on the backend, bulk import is off
    Given the backend runs without CURATOR_TOKEN
    When the tool (or anyone) calls the bulk import endpoint
    Then the response is 404, as if it didn't exist, and nothing is imported

  Scenario: A wrong or missing token is refused
    When the tool runs with a wrong token, or none
    Then the backend answers 401, nothing is imported
    And the tool stops at the first video with "curator token rejected" instead of failing every line

  Scenario: A signed-in learner can't use the endpoint
    Given I am signed in as a learner (with a valid login, any plan)
    When I call the bulk import endpoint without the curator token
    Then the response is 401 and nothing is imported

  Scenario: The backend being down stops the run
    Given the backend isn't running
    When I run the tool
    Then it stops with "backend not reachable at <address>" and a non-zero exit code, after the first attempt

  Scenario: The normal Library import is unchanged
    When a learner imports a YouTube video from the Library
    Then it is owned by the learner, plan limits apply, and it is shared only if they ticked "Share"
