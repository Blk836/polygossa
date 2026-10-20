Feature: Free accounts aren't pointed at Review, which they can't use (#178)
  Spaced-repetition review is part of Pro. A free learner shouldn't see a due count, a daily goal or a lesson-end
  link that only Review could satisfy.

  Scenario: No due badge on the Practice tab for a free account
    Given a free account with saved words that are due
    When any page of the app is open
    Then the Practice tab shows no due count
    And its accessible name is just "Practice"

  Scenario: Pro accounts still see the badge
    Given a Pro account with 3 cards due
    Then the Practice tab shows "3"

  Scenario: A new free account's daily goal is words read
    Given a new free account that never chose a goal
    When Progress or the top bar shows today's goal
    Then the goal is 1,000 words read, not 20 reviews

  Scenario: A free account that had a review goal gets words read instead
    Given a free account whose saved goal is reviews (e.g. after leaving Pro)
    Then today's goal is 1,000 words read
    And its saved choice is kept, so going back to Pro brings the review goal back

  Scenario: Pro accounts keep reviews as the default goal
    Given a new Pro account that never chose a goal
    Then today's goal is 20 reviews

  Scenario: Settings doesn't offer a review goal on the free plan
    Given a free account on Settings › Profile
    Then "Daily goal measures" offers words read, minutes read and minutes listened, not reviews
    And it shows words read selected

  Scenario: Lesson complete offers the word list, not Review, on the free plan
    Given a free account finishing a text
    Then "Lesson complete" offers "See your words", leading to Practice › Words
    And not "Review your words"

  Scenario: Pro accounts keep "Review your words" at lesson end
    Given a Pro account finishing a text
    Then "Lesson complete" offers "Review your words", leading to Review
