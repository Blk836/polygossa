Feature: Copying a curated playlist from one backend to another
  Curated videos copied to production (copy-videos.feature) arrive one by one, but locally they were also gathered
  into a playlist in episode order (e.g. "innerFrench 1-200"). A command-line tool copies such a playlist: it reads
  the playlist's title, description, language and the videos in it, in order, from the source backend, and the target
  makes a public playlist owned by the community library account from the library's own copies of those videos.
  Both backends need a curator token, as for copying videos.

  Background:
    Given the source backend runs with a curator token
    And the target backend runs with its own curator token
    And the target's community library already has the videos (copied or imported as curated videos)

  # ---- Copying ----

  Scenario: A playlist is copied into the target's community library
    Given the source has playlist 1 "innerFrench 1-200" (French) with videos A, B and C in that order
    When I run the tool to copy playlist 1 from the source to the target
    Then the target has a public playlist "innerFrench 1-200", owned by the library account, with the source's
      description and language
    And it holds the library's copies of A, B and C, in that order
    And it shows in the target's Explore under shared playlists for French, like any shared playlist
    And the tool prints "created" with the title and the number of videos

  Scenario: Whoever owns the source playlist, the copy belongs to the library account
    Given the source playlist is a learner's, public or private
    When it is copied
    Then the target playlist is owned by the library account and shared publicly

  Scenario: Videos the target's library doesn't have are left out and listed
    Given the target's library lacks video B (say its AI sharing check refused it)
    When the playlist is copied
    Then the target playlist holds A and C, in order
    And the tool lists B as left out, so the description can say why

  Scenario: The description can be replaced
    When I copy the playlist with --description "innerFrench episodes 1 to 200 ..."
    Then the target playlist has that description instead of the source's

  # ---- Re-runs ----

  Scenario: Copying again updates the playlist instead of making a second one
    Given the library account already has a playlist with the same title and language
    When I copy the playlist again (say after more videos were copied)
    Then that playlist's description and videos, in order, are made to match, and no second playlist appears
    And the tool prints "updated"
    And people who saved the playlist keep it

  Scenario: Dry run
    When I copy with --dry-run
    Then the tool says whether it would create or update the playlist, how many videos it would hold and which are
      left out, and nothing is saved

  # ---- Failures ----

  Scenario: The source has no such playlist
    When I copy a playlist id the source doesn't have
    Then the run stops (exit code 1) saying the source has no such playlist, and nothing is sent to the target

  Scenario: None of the videos are in the target's library
    Given the target's library has none of the playlist's videos
    When the playlist is copied
    Then nothing is saved and the tool says there were no videos to put in it (exit code 1)

  Scenario: A copy request with missing or invalid parts is refused
    When the target receives a playlist without a title, with a title or description over the limits, or with an
      unknown language
    Then it answers 400 and saves nothing

  Scenario: Tokens and switched-off backends
    When the source or target rejects its token, can't be reached, or runs without a curator token
    Then the run stops (exit code 1) saying which backend, as when copying videos
    And a learner's login never grants access to the playlist export or copy endpoints
