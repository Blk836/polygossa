Feature: Explore's Texts / Videos and level filters apply to the recommended rows too (#129)
  The category shelves and search results already followed the filters, but the rows at the top of Explore
  (Continue reading, For you, Because you read…, a favourite topic, Just right, Stretch) ignored them, so picking
  Texts still showed a page of videos.

  Background:
    Given I'm learning French and there are shared French texts and videos I haven't started
    And I have a text and a video in progress

  Scenario: Picking Texts shows only texts in every row
    When I pick "Texts" on Explore
    Then every recommended row, Continue reading included, shows only texts
    And the category shelves show only texts, as before

  Scenario: Picking Videos shows only videos in every row
    When I pick "Videos" on Explore
    Then every recommended row, Continue reading included, shows only videos

  Scenario: Back to All shows both again
    Given I picked "Videos"
    When I pick "All"
    Then the recommended rows show texts and videos again

  Scenario: Picking a level shows only that level in every row
    When I pick level "B1"
    Then every recommended row shows only texts and videos estimated at B1

  Scenario: A row with nothing left under the filter isn't shown
    Given none of my in-progress items is a video
    When I pick "Videos"
    Then there is no Continue reading row

  Scenario: The rows are filtered by the server, so what's logged as shown is what was shown
    When I pick "Texts"
    Then the recommendations are fetched for texts only
    And only the items actually shown are recorded as shown for learning recommendations

  Scenario: An unknown kind or level is refused
    When the recommendations are asked for kind "podcast" or level "Z9"
    Then the answer is 400
