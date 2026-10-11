Feature: Handing in a writing test stops the clock and shows the results taking shape
  After Hand in, the countdown kept running while the AI graded the answer, with the test still on screen and only
  the button saying "Grading…", so it looked as if the hand-in hadn't worked or was still costing time (issue #107).

  Background:
    Given I am a Pro learner on Writing with a test running

  Scenario: Handing in replaces the test with an outline of the results
    Given I have written enough to hand in
    When I click "Hand in" and grading takes a while
    Then the clock, the answer box and the Hand in button are gone
    And a loading outline shaped like the results page shows, under the situation I was answering
    When grading finishes
    Then the results show where the outline was, with the situation card not moving

  Scenario: Running out of time hands in the same way
    Given I have written something and the clock reaches 0:00
    When the test hands itself in and grading takes a while
    Then the clock is gone and the results outline shows
    And the answer is handed in once only

  Scenario: A failed hand-in puts me back on the test with my answer and the real time left
    Given I have written enough to hand in
    When I click "Hand in" and the request fails
    Then the test is back with my answer still in the box and the error shown
    And the clock shows the time left until the real deadline, counting down again

  Scenario: A failed hand-in after time ran out is not retried by itself
    Given the clock reached 0:00 and the automatic hand-in failed
    Then the test shows 0:00 with my answer and the error
    And nothing is handed in again until I click "Hand in"
    When I click "Hand in"
    Then it is handed in and the results show
