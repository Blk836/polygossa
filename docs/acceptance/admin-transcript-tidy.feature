Feature: An admin tidies one episode's transcript with AI, from the admin panel

  The server already tidies an episode again on request (POST /api/admin/texts/{id}/tidy-transcript); this puts a
  button on it. Only the parts still unpunctuated go to the AI, so tidying an episode that is already tidy costs
  next to nothing.

  Background:
    Given I am an admin on the admin panel
    And I have opened a user who owns a video episode and a plain text

  Scenario: Each video episode in a user's list has a Tidy button
    Then the video episode's row has a "Tidy transcript" button next to "Remove"
    And the plain text's row has no "Tidy transcript" button

  Scenario: Tidying an episode reports what changed
    When I press "Tidy transcript" on the video episode
    Then the button reads "Tidying…" and can't be pressed again until it finishes
    And afterwards I see "Tidied 12 of 40 lines in “<episode title>”"
    And "Recent actions" lists "tidy transcript" for that user with the same counts

  Scenario: Learners keep their place
    Given a learner was partway through the episode
    When I tidy it
    Then they reopen it at the same word as before

  Scenario: Nothing to tidy
    Given the AI is switched off or the transcript is already punctuated
    When I press "Tidy transcript"
    Then I see "Tidied 0 of 40 lines in “<episode title>”"
    And the transcript is unchanged

  Scenario: The episode can't be tidied
    Given the episode has no captions, or was deleted in the meantime
    When I press "Tidy transcript"
    Then I see the server's error under the user's actions
    And the button can be pressed again

  Scenario: Only admins can tidy
    Given I am a learner
    Then the admin panel isn't open to me
    And asking the server to tidy an episode is refused
