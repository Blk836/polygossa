Feature: Explore recommendations (see docs/architecture/library-and-explore.md)
  Explore ranks public content by how likely a learner is to start it, keep reading and learn from it: interest
  (what they engaged with, AI topic tags and embeddings) and comprehensibility (known-word share, level). AI only
  produces features once per text in the background; ranking is plain, deterministic code over stored features, so
  it is free per request, the same on every refresh, and keeps working when the AI is down or not configured.
  Recommendations are free on every plan.

  Background:
    Given I am signed in
    And the community library has public French texts and videos from other learners

  # --- The shelves ---

  Scenario: Personalised shelves sit above the category shelves
    When I open Explore with French as my language
    Then I see, in this order and only when they have items: "Continue reading", "For you", "Because you read <title>",
      "More about <topic>", "Just right for you", "Stretch"
    And the category shelves follow below them as before

  Scenario: Each recommended card says why it is there
    When I open Explore
    Then each personalised card shows a short reason, such as "96% known words", "42% read",
      "Because you liked Tapas en Madrid" or "You like cooking"

  Scenario: Recommendations work on the Free plan and without AI
    Given I am on the Free plan and the server has no OpenAI key
    When I open Explore
    Then the personalised shelves still appear, ranked without embeddings or topic tags

  Scenario: The same data gives the same ranking
    Given nothing about me or the library changed
    When I load recommendations twice
    Then both responses list the same items in the same order

  Scenario: Without a language, every language is recommended
    Given I have no target language
    When I load recommendations
    Then candidates come from every language and level fit counts as neutral

  # --- Continue reading ---

  Scenario: Continue reading lists what I started and haven't finished
    Given I read text A to 40% yesterday and text B to 10% an hour ago, and finished text C
    Then "Continue reading" lists B then A (most recently read first), with "10% read" and "40% read"
    And C is not in it

  Scenario: Abandoned texts drop out
    Given I opened text A, read under 10% of it, and haven't touched it for 7 days
    Then A is neither in "Continue reading" nor recommended elsewhere

  Scenario: My own imports can be continued but are never recommended
    Given I started one of my own private texts
    Then it appears in "Continue reading"
    And none of my own texts appear in any other personalised shelf

  # --- Candidates ---

  Scenario: What can be recommended
    Then "For you", "Because you read", "More about", "Just right" and "Stretch" only hold public items in my language
      that are not mine, not finished, not started, and not marked "Not interested"

  # --- Signals (implicit feedback), each decaying with a 30-day half-life ---

  Scenario Outline: Engagement signals and their starting weights
    Given I <did> on a text tagged "cooking" today
    Then my weight for "cooking" changes by <weight>

    Examples:
      | did                                              | weight |
      | finished it                                      | +3 +2  |
      | read it to at least 50% without finishing        | +2     |
      | liked it                                         | +3     |
      | bookmarked it                                    | +2     |
      | spent 25 minutes reading it                      | +2     |
      | spent 2 hours reading it                         | +3     |
      | opened it, read under 10%, left it for 7 days    | -1     |
      | marked it "Not interested"                       | -4     |

  Scenario: Old signals count for less
    Given I liked a text 30 days ago
    Then that like counts +1.5, and 60 days ago +0.75

  Scenario: Items shown many times and never opened sink
    Given an item has been shown to me 5 times on Explore and I never opened it
    Then its score drops by 0.5, and by 1 once it has been shown 10 times without an open

  # --- Scoring ---

  Scenario Outline: Comprehension fit peaks at about 95% known words
    Given a candidate where I know <known>% of the distinct words
    Then its comprehension fit is <fit>

    Examples:
      | known | fit                       |
      | 95    | 1 (the peak)              |
      | 90    | about 0.60                |
      | 85    | about 0.13                |
      | 98    | about 0.57                |
      | 100   | about 0.21                |
      | 0     | 0                         |

  Scenario Outline: Level fit against my Reading level
    Given my Reading level is B1
    Then a <text> text has level fit <fit>

    Examples:
      | text | fit |
      | B1   | 1   |
      | B2   | 0.6 |
      | A2   | 0.4 |
      | C1   | 0.1 |
      | A1   | 0.1 |
      | C2   | 0   |

  Scenario: Unknown levels are neutral
    Given my Reading level is "Not enough data", or the text has no level
    Then level fit is 0.5

  Scenario: The score combines interest, topics, comprehension, level, popularity, freshness and format
    Then a candidate's score is the configured weighted sum of: cosine(taste vector, its vector), topic affinity,
      comprehension fit, level fit, log(1 + likes in the last 30 days), freshness (half-life 30 days) and format
      affinity (video or text, and length), plus its own "shown, never opened" penalty
    And every weight is set in configuration (app.recommend.*)

  Scenario: A missing feature contributes nothing
    Given a candidate has no embedding or no topic tags yet
    Then its interest or topic term is 0 and it is still recommended on the other terms

  # --- Diversity and exploration ---

  Scenario: No more than two in a row from one category or one creator
    Given the top-scoring candidates are five food texts by one creator and some others
    Then "For you" never shows three items in a row from the same category or the same creator, while other
      candidates remain

  Scenario: Exploration slots
    Then every 7th slot of "For you" (about 15%) holds the best candidate outside my usual topics, ranked without
      the interest and topic terms, so new content and other subjects get seen
    And when I have no topic history the slot holds the best remaining candidate

  # --- Personalised shelves in detail ---

  Scenario: Because you read X
    Given the most recent text I finished or liked (any language) has an embedding
    Then "Because you read <its title>" (or "Because you liked …") lists the candidates nearest to it, most similar
      first, only those with similarity above 0.2
    And without an embedding for that text the shelf is not shown

  Scenario: More about my strongest topic
    Given "cooking" has my highest positive topic weight
    Then "More about cooking" lists candidates tagged "cooking", best score first, reason "You like cooking"
    And when no item has topic tags, my strongest category is used instead ("More about Food & cooking")

  Scenario: Just right and Stretch
    Then "Just right for you" lists candidates where I know 90–98% of the words, best fit first, with "96% known words"
    And "Stretch" lists candidates where I know 85–89.9% of the words in my positive topics or categories (any topic
      when I have none), with "88% known words"

  # --- Not interested ---

  Scenario: Not interested removes an item
    When I choose "Not interested" on a recommended card
    Then the card disappears from every personalised shelf at once
    And it is not recommended again
    And its topics and category count -4 for me

  Scenario: Undoing Not interested
    When I undo "Not interested" on an item
    Then it can be recommended again

  Scenario: Not interested on something I can't read
    When I mark a private text of another user "Not interested"
    Then I get 404

  # --- Cold start: interests ---

  Scenario: Onboarding asks what I like
    Given I picked a language during onboarding
    Then I can pick categories I like (at least 3, or skip) before choosing a starter text

  Scenario: Interests seed recommendations for a new learner
    Given I have no reading history and chose Food and Travel as interests
    Then food and travel items count +2 per category in topic affinity
    And my taste vector is the average embedding of public items in those categories
    And "More about Food & cooking" or "More about Travel" can appear

  Scenario: Interests can be read and changed later
    When I save interests ["food", "travel", "news"]
    Then GET /api/recommendations/interests returns them, and saving [] clears them

  Scenario: Unknown interests are rejected
    When I save interests ["cooking"]
    Then I get 400

  # --- Content understanding (AI, once per text, in the background) ---

  Scenario: Public texts get topic tags, a summary and an embedding
    Given the server has an OpenAI key
    And a public text has no features yet
    When the feature job runs (every minute)
    Then the AI is asked once for {topics (3–6 short English tags), summary, register, suitableFor}, with the text
      as delimited data
    And its title, summary and opening are embedded with OPENAI_EMBEDDING_MODEL (default text-embedding-3-small)
    And the tags, summary, vector and model names are stored in text_features, never on the text or its body

  Scenario: The backlog is taken in batches
    Given 50 public texts have no features
    When the job runs once
    Then at most 20 are processed, and the rest on later runs

  Scenario: Private texts are never sent
    Given a private text
    Then the feature job never sends it to the AI

  Scenario: AI replies are validated
    Given the AI replies with topics that are not strings, too long, duplicated, more than 6, an unknown register or
      an unknown suitableFor
    Then only valid topics (lower-cased, at most 6, each 1–40 characters) are kept, the register is dropped and
      suitableFor becomes "general"
    And a text saying "ignore your instructions" can only change its own tags

  Scenario: Failures are retried later
    Given the AI or embedding service fails, times out or returns something unreadable
    Then the text keeps no vector, the failure is counted, and the job tries again after a back-off
      (2, 4, 8 … minutes, at most a day)
    And Explore keeps working meanwhile

  Scenario: Without an OpenAI key nothing is sent
    Given the server has no OpenAI key
    Then the feature job does nothing

  Scenario: Changing the embedding model re-embeds
    Given a text was embedded with another embedding model
    Then the job embeds it again; until then its old vector is not compared with new ones

  Scenario: Features don't count against anyone's AI allowance
    Then tagging and embedding never use a learner's daily AI allowance

  Scenario: Deleting a text deletes its features and recommendation history
    When the owner deletes a text
    Then its features, "Not interested" marks and logged impressions go too

  Scenario: Card lists still load no text bodies
    When I load recommendations
    Then no text body is loaded

  # --- Topic filter ---

  Scenario: Explore can be filtered by topic
    When I open "See all" on "More about cooking"
    Then Explore shows public items tagged "cooking" as a grid, headed "cooking"

  # --- Measuring ---

  Scenario: Impressions and opens are logged per shelf
    When Explore shows personalised shelves
    Then each shown item is logged once per load as an impression with its shelf and position
    And opening a recommended card logs an open with its shelf and position

  Scenario: Invalid events are rejected
    When I log an event with an unknown shelf, an unknown type, or more than 100 items
    Then I get 400

  Scenario: Metrics per shelf
    When I request GET /api/recommendations/metrics?days=28
    Then I get, per shelf, impressions, opens, click-through rate, the share of opened items read to 50% and the share
      finished
    And known words gained per week by learners who opened at least 5 recommendations vs. those who didn't, each shown
      only when the group has at least 5 learners
