Feature: Videos come from the database, not a startup list
  The backend used to import a list of sample YouTube videos (samples/videos.txt) at every start.
  That is gone: videos in Explore are whatever is in the database, added through the normal import.

  Scenario: Startup imports no videos
    Given the backend starts on an empty database with SEED_SAMPLES on
    Then the eight starter texts are seeded into the community library
    And no YouTube video is imported, and YouTube is never contacted at startup

  Scenario: Videos already in the database are kept
    Given the community library already holds the French sample video from an earlier start
    When the backend restarts
    Then the video is still there, unchanged, and still listed in Explore

  Scenario: A deleted sample video stays deleted
    Given the French sample video was deleted from the database
    When the backend restarts
    Then it doesn't come back

  Scenario: SEED_SAMPLES only controls the starter texts
    Given SEED_SAMPLES=false
    Then no starter texts are seeded, and nothing else changes

  Scenario: Importing a video still works as before
    When a learner imports a YouTube video from the Library
    Then plan limits, AI categorisation and the sharing check all apply as before
