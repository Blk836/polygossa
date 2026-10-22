Feature: How often I've met each word in my own reading

  Scenario: A saved word shows how often I've met it
    Given I've read 40,000 French words in total
    And "maison" appeared 120 times in what I read
    When I open Words
    Then its row shows "120× · 0.3%"

  Scenario: Only what I've actually read counts
    Given a text where "maison" appears 5 times, 3 of them in the first half
    When I read the first half and stop
    Then "maison" has been met 3 times
    And when I read on to the end it has been met 5 times

  Scenario: Opening a text without reading it counts nothing
    When I open a text and leave it without moving forward
    Then no word counts go up

  Scenario: Re-reading counts again
    Given I've read a text to the end
    When I go back to its start and read it again to the end
    Then its words count twice, as my words-read total does

  Scenario: Counting ignores capitals
    Given "Maison" starts a sentence and "maison" appears mid-sentence
    Then both count towards "maison"

  Scenario: A word I've never met in my reading
    Given I saved a word through import or by typing it, and it hasn't appeared in anything I've read
    Then its row shows "Not met yet"

  Scenario: Percentages stay readable
    Then a 3.94% share shows "3.9%", 0.31% shows "0.3%", 0.031% shows "0.03%",
         and a word met but under 0.01% shows "<0.01%"

  Scenario: Each language has its own counts
    Given I read both French and Spanish
    Then a French word's share is out of my French reading only
    And with the language picker on all languages, each word shows its own language's share

  Scenario: Reading done before this feature counts
    Given I had read texts before this shipped
    When I first open Words afterwards
    Then each word's count includes how far I had got in each of those texts

  Scenario: Sorting by most met
    Given "de" was met 2,000 times, "maison" 120 times, and a saved word never
    When I choose sort "Most met"
    Then the order is "de", "maison", then the never-met word
    And ties and never-met words are in alphabetical order
    And the sort works with the status, tag and search filters, and across pages

  Scenario: Phrases have no count
    When I open the Phrases tab
    Then rows show no count and "Most met" isn't offered

  Scenario: Exporting my most-met words to Anki
    Given I've sorted by "Most met" with status "Learning"
    When I export to Anki (.apkg) capped at the top 100
    Then the deck holds my 100 most-met learning words and no others
    And with no cap it holds all of them

  Scenario: The CSV export carries the counts
    When I export CSV
    Then each row has "times met" and "share" columns

  Scenario: Deleting my account removes the counts
    When I delete my account
    Then my word counts are deleted with it

  Scenario: An unknown sort is ignored
    When the list is asked for an unknown sort
    Then it falls back to most recent, as today
