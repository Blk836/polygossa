Feature: Recommendations, next steps: learned weights and interests in Settings
  (see docs/architecture/library-and-explore.md)
  Explore's score is a weighted sum of parts (interest, topic, comprehension, level, popularity, freshness, format).
  The weights were set by hand. Now each impression is logged with the parts that ranked it, a small logistic
  regression (plain code) fits weights to what learners actually opened, and the team can read the fit and, when
  there is enough data, switch ranking over to it. Learners can also change their interests in Settings.
  pgvector stays on the roadmap: it is a new dependency and only needed at tens of thousands of texts.

  Background:
    Given I am signed in

  # --- Logging the score parts with each impression ---

  Scenario: Recommended cards carry their score parts
    When I load recommendations
    Then each ranked item (all shelves but "Continue reading") carries its unweighted score parts: interest, topic,
      comprehension, level, popular, fresh and format
    And "Continue reading" items carry none

  Scenario: Impressions are logged with their score parts
    When Explore logs an impression batch whose items carry score parts
    Then each impression is stored with its seven parts

  Scenario: Events without parts still work
    When an impression or open is logged without parts (an older page, or "Continue reading")
    Then it is stored as before, with no parts
    And opens never store parts

  Scenario Outline: Invalid score parts are rejected
    When I log an impression whose parts <problem>
    Then I get 400 and nothing from that batch is stored

    Examples:
      | problem                                |
      | lack one of the seven                  |
      | hold a value below -1 or above 50      |

  # --- Learning the weights ---

  Scenario: One training example per learner and item
    Given I was shown item A three times and opened it after the second time, and shown item B twice and never
      opened it
    Then A gives one example labelled "opened", with the parts and position of the last impression before the open
    And B gives one example labelled "not opened", with the parts of its latest impression
    And impressions logged without parts are not used

  Scenario: Outcome "half" asks for reading, not just opening
    When the outcome is "half"
    Then an example counts as positive only when the learner opened it and has read it to at least 50% (or finished it)

  Scenario: The fit finds what predicts opening
    Given 400 examples where learners open items with high comprehension fit and ignore the rest, whatever their
      other parts
    When the weights are learned
    Then comprehension gets the largest learned weight
    And the result is the same every time for the same data

  Scenario: Position on the shelf is controlled for
    Given learners open whatever is first on a shelf, whatever its parts
    When the weights are learned
    Then no part gets credit for it: position is a term of the fit but not a weight

  Scenario: Only clear evidence earns a part weight
    Given a part's effect on opening is not clearly above zero (less than 3 standard errors) or is negative
    Then its learned weight is 0 (a part never counts against an item, and noise earns nothing)

  Scenario: A part that never varies keeps its configured weight
    Given every example has the same value for a part (e.g. interest is 0 everywhere because nothing is embedded yet)
    Then the data says nothing about it, so its learned weight is its configured weight

  Scenario: Learned weights are on the configured scale
    When the weights are learned
    Then the learned weights add up to the same total as the configured ones, so the "shown, never opened" penalty
      keeps its meaning

  Scenario: Not enough data
    Given fewer than 200 examples, or fewer than 20 positive or 20 negative ones, in the window
    When the weights are learned
    Then there is no learned result, and ranking keeps the configured weights

  Scenario: No part clearly matters
    Given no varying part has a clearly positive effect
    Then there is no learned result, and ranking keeps the configured weights

  Scenario: Reading the fit
    When I request GET /api/recommendations/weights?days=28&outcome=open
    Then I get the window, the outcome, the number of examples and positives, the configured weights, the learned
      weights (null without enough data) and which of the two ranking uses now ("configured" or "learned")

  Scenario Outline: Invalid fit requests
    When I request GET /api/recommendations/weights with <param>
    Then I get 400

    Examples:
      | param          |
      | days=0         |
      | days=366       |
      | outcome=liked  |

  # --- Using learned weights ---

  Scenario: Configured weights by default
    Given app.recommend.learn.enabled is false (the default)
    Then ranking uses the configured weights, whatever the logged data says

  Scenario: Switching ranking to learned weights
    Given app.recommend.learn.enabled is true
    When the learning job runs (at start-up, then daily) and there is enough data
    Then ranking and card reasons use the learned weights until the next run
    And when a later run has not enough data, ranking goes back to the configured weights

  Scenario: The learning job never runs on its schedule in tests
    Then tests run it directly

  # --- Interests in Settings ---

  Scenario: Settings shows my interests
    Given I chose Food and Travel as interests during onboarding
    When I open Settings › Profile
    Then an "Interests" section shows every category but Other, with Food and Travel picked

  Scenario: Changing interests in Settings
    When I pick News, unpick Travel and click "Save interests"
    Then I see "Saved" and my interests are Food and News

  Scenario: Clearing interests in Settings
    When I unpick every interest and save
    Then my interests are empty, and Explore recommends from my reading alone
    And Settings, unlike onboarding, doesn't ask for at least three

  Scenario: Saving interests fails
    Given the backend rejects the change
    When I click "Save interests"
    Then an error message is shown and "Saved" is not

  Scenario: Interests can't be loaded
    Given loading my interests fails
    Then the Interests section says so instead of showing an empty choice that could wipe them

  Scenario: Profile and interests save separately
    When I save interests
    Then my name, language, goal and time zone are not sent, and the reverse
