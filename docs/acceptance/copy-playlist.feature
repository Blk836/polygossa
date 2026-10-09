Feature: Putting curated videos into a community-library playlist
  Curated videos arrive one by one (bulk-video-import.feature, copy-videos.feature), but a series like the InnerFrench
  podcast belongs in a playlist, in episode order. The bulk importer's --playlist option takes a list file of videos
  already in the community library and makes a public playlist of them, owned by the library account, in list order.

  Background:
    Given the backend runs with a curator token
    And its community library has the listed videos (imported or copied as curated videos)

  Scenario: A list of videos becomes a public library playlist in list order
    Given a list file with French videos C, A and B, in that order
    When I run the tool with --playlist "innerFrench 1-200" --description "Episodes 1 to 200" on the file
    Then the backend has a public French playlist "innerFrench 1-200" with that description, owned by the library account
    And it holds the library's copies of C, A and B, in that order
    And it shows in Explore under shared playlists for French, like any shared playlist
    And the tool prints "created" with the title and the number of videos

  Scenario: Videos the library doesn't have are left out and listed
    Given the library lacks video B (say its AI sharing check refused it)
    When the playlist is made
    Then it holds C and A, in order, and the tool lists B as left out

  Scenario: Running it again updates the playlist instead of making a second one
    Given the library account already has a playlist with the same title and language
    When I run the tool again (say after more videos were copied)
    Then that playlist's description and videos, in order, are made to match the list, and no second playlist appears
    And the tool prints "updated", and people who saved the playlist keep it

  Scenario: Dry run
    When I run it with --dry-run
    Then the tool says whether it would create or update the playlist, how many videos it would hold and which are
      left out, and nothing is saved

  Scenario: None of the videos are in the library
    When none of the listed videos are in the library
    Then nothing is saved and the tool says there were no videos to put in it (exit code 1)

  Scenario: A playlist request with missing or invalid parts is refused
    When the backend receives a playlist without a title, with a title or description over the limits, or with an
      unknown language
    Then it answers 400 and saves nothing

  Scenario: A list mixing languages is refused by the tool
    Given a list file with French and Spanish videos
    When I run the tool with --playlist
    Then it stops (exit code 1) saying a playlist is in one language, without asking the backend
    And a library video in another language than the playlist's is left out like a missing one

  Scenario: Tokens and switched-off backends
    When the backend rejects the token, can't be reached, or runs without a curator token
    Then the run stops (exit code 1), as for importing videos
    And a learner's login never grants access to the playlist endpoint
