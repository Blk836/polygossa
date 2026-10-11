Feature: Clicking the tab you are on takes you back to its start
  Several pages switch views or hold filters without changing the address (Writing results, Explore searches and
  categories, Words filters, Review's "Practise ahead"), so clicking their tab again did nothing (issue #108).
  Clicking a tab, sub-tab or the logo that points at the page you are on now starts that page afresh, the way most
  apps' navigation works. The one exception is a writing test in progress: starting afresh would only reopen the same
  test and lose the answer typed so far, so the click leaves it alone.

  Background:
    Given I am a Pro learner

  Scenario: Writing results → Write goes back to the Writing start page
    Given I have finished a writing test and its results are showing
    When I click the "Write" sub-tab
    Then I see the start panel and my past tests, not the results

  Scenario: The Practice tab works the same way when its first page is open
    Given I am on Review with "Practise ahead" turned on
    When I click the "Practice" tab
    Then Review shows its normal due cards again

  Scenario: Explore with a search goes back to its shelves
    Given I have searched Explore
    When I click the "Explore" sub-tab
    Then the search box is empty and the shelves show

  Scenario: Explore through the logo
    Given I have searched Explore
    When I click the logo
    Then the search box is empty and the shelves show

  Scenario: Words with filters and the address's own filter go back to the defaults
    Given I opened Words from a link that picked "known" and then typed a search
    When I click the "Words" sub-tab
    Then the address has no filter, the search box is empty and the status filter is back to "learning"

  Scenario: A page restarted this way opens at the top
    Given I have scrolled down Explore
    When I click the "Explore" sub-tab
    Then the page is scrolled to the top

  Scenario: A writing test in progress is left alone
    Given a writing test is running and I have typed part of my answer
    When I click the "Write" sub-tab
    Then the test is still showing with my answer and the clock still running

  Scenario: Clicking a different tab still just goes there
    Given I am on Explore with a search
    When I click "My library"
    Then My library opens as before
