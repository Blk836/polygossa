Feature: Clearer times-met wording, and times met for phrases
  Supersedes the wording and the "Phrases have no count" scenario in words-times-met.feature,
  and drops the "Export top N" picker from Words.

  Scenario: A word shows how often I've met it and how common it is in my reading
    Given I've read 40,000 French words and met "maison" 120 times
    Then its row shows "Met 120 times · 1 in 330 words"

  Scenario: Met once
    Given I've read 45,000 French words and met a word once
    Then its row shows "Met once · 1 in 45,000 words"

  Scenario: "1 in N" is rounded so it stays easy to read
    Then 1 in 333.3 shows "1 in 330", 1 in 4,512 shows "1 in 4,500",
         1 in 45,123 shows "1 in 45,000", and anything under 1 in 100 shows the whole number (e.g. "1 in 25")

  Scenario: Never met
    Then a word not met in my reading still shows "Not met yet"

  Scenario: A saved phrase counts each time I read past all of it
    Given I saved the phrase "tout à fait"
    And a text where "tout à fait" appears 3 times, 2 of them in the first half
    When I read the first half and stop
    Then the phrase's row shows "Met 2 times"
    And when I read on to the end it shows "Met 3 times"

  Scenario: Half a phrase doesn't count
    Given I stop reading between "tout" and "à fait"
    Then that occurrence doesn't count until I read past its last word

  Scenario: Matching is the reader's highlighting: capitals and spacing are ignored
    Given "Tout à  fait" starts a sentence
    Then it counts towards "tout à fait"

  Scenario: A phrase saved later still gets credit for what I'd already read
    Given I read a text with "tout à fait" twice, before saving the phrase
    When I save it and open Phrases
    Then it shows "Met 2 times"

  Scenario: Re-reading counts again, as for words
    When I read a text to the end, go back to the start and read to the end again
    Then its phrases count twice

  Scenario: A phrase never met in my reading
    Then its row shows "Not met yet"

  Scenario: Most met works on Phrases
    Given phrases met 5 times, 2 times and never
    When I choose sort "Most met" on the Phrases tab
    Then they're in that order, with ties and never-met phrases alphabetical
    And it works with the filters and across pages

  Scenario: Deleting a phrase or my account removes its count
    When I delete a phrase, its count is gone; re-saving it fills it in again from my reading
    And deleting my account deletes all phrase counts

  Scenario: No "Export top N" picker
    When I sort Words by "Most met"
    Then there's no picker for how many words to export, and Export CSV and Export to Anki work as before
