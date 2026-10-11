Feature: More than one backend server can run side by side (#86)
  Before a second backend server (or during a deploy, when old and new overlap), nothing may double the OpenAI
  calls or lose data because each server keeps its own memory.

  Scenario: Only one server tags and embeds texts at a time
    Given two backend servers share one database
    And one of them is running the text tagging and embedding job
    When the other's timer fires
    Then it skips this round without asking the AI anything
    And on a later round, once the first has finished, it can run the job

  Scenario: A server that stops mid-job doesn't block the job for ever
    Given a server was running the tagging job and its database connection closed (it crashed or was replaced)
    When another server's timer fires
    Then it runs the job

  Scenario: Each learner's active day is recorded once, whichever server sees them
    Given two backend servers share one database
    When the same learner is seen by both on the same day
    Then the learner has exactly one active day recorded for that day

  Scenario: A text's new features are seen by every server
    Given two servers have both cached a text's topics and vector
    When the text's features change in the database
    Then both servers give the new topics and vector on their next use, without a restart

  # Known and accepted, not fixed here:
  # - Learned recommendation weights (off by default, #66) are learned by each server from the shared database, so
  #   servers agree except for the hours between their daily runs; a new server uses the configured weights for its
  #   first 30 seconds.
  # - Per-learner rate limits (#87) are counted per server, so N servers allow up to N times the limit.
