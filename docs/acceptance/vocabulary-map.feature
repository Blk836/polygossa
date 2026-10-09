Feature: Vocabulary map on Progress
  A map of a language's core vocabulary that learners zoom into, like a Mii plaza or Kwiziq's grammar map, but
  for words only. The whole map is split into themed regions, each region into areas, each area into words. Every
  region and area fills in as the learner knows more of its words, so they can see what they know and what is left.

  The blueprint (regions and areas) is the same for every language. Each language has its own word list that fills
  that blueprint. Every word in a list has exactly one area and one level band.

  Terms:
    blueprint = the fixed regions and areas, shared by all languages
    word list = one language's words; each has a headword, its common forms, an area, a band, and its meaning in
                the native languages the list covers
    band      = the CEFR level a word belongs to: A1 (~500 words), A2 (~1,000), B1 (~2,000), B2 (~4,000),
                C1 (~8,000); each band includes the words of the bands below it
    known     = I marked the word known in the reader or in Vocabulary (green); learning = yellow; new = no entry
    coverage  = known words / words in the tile (for the bands shown)

  MVP: the blueprint, and one word list: French, A1 to B1 (~2,000 words), with English meanings. Other target
  languages, other native languages' meanings, and the B2 and C1 bands come later and are data only: adding them
  changes no screens and no code.

  Draft blueprint (14 regions; names can change before building):
    People & Relationships  family, describing people, personality, relationships, life events
    Body & Health           body parts, illness & symptoms, at the doctor, fitness, appearance
    Food & Drink            fruit & vegetables, meat & fish, cooking, drinks, eating out, shopping for food
    Home                    rooms & furniture, household chores, in the kitchen, tools & repairs
    Clothes & Shopping      clothes, colours & materials, shops, money & paying
    Travel & Transport      getting around, holidays, hotels, directions & places in town
    Work & Study            jobs, the office, school & university, skills
    Nature & Environment    weather, animals, plants, landscape, the environment
    Time & Numbers          numbers, days & months, telling the time, frequency, quantities
    Feelings & Mind         emotions, opinions, thinking, character
    Leisure & Culture       hobbies, sport, music & art, film & books, celebrations
    Society & News          politics, law & crime, economy, media, technology
    Communication           conversation, phone & internet, letters & messages
    Core words              pronouns, articles, prepositions, conjunctions, question words, common verbs,
                            common adjectives and adverbs that belong to no theme

  Background:
    Given I am signed in, my target language is French and my native language is English

  # --- The map ---

  Scenario: The map sits on Progress
    When I open Progress
    Then I see a "Vocabulary map" section above the period comparison
    And all the cards Progress has today are still there

  Scenario: Zoomed out, I see every region with its coverage
    Given I know 120 of the 500 French A1 words, 40 of them in Food & Drink
    When I look at the map zoomed out
    Then I see all 14 regions as tiles
    And each tile is shaded by its coverage and shows "known / total", e.g. "40 / 62"
    And the map's header shows my overall coverage for the bands shown, e.g. "120 / 500 core words"

  Scenario: I zoom into a region, then an area, then back out
    When I tap the Food & Drink region
    Then the map zooms into Food & Drink and shows its areas, each with its own coverage
    When I tap the "Fruit & vegetables" area
    Then I see that area's words as tiles: known in green, learning in yellow, new in plain
    And a breadcrumb reads "Map › Food & Drink › Fruit & vegetables"
    When I tap "Map" in the breadcrumb, or press Back in the browser
    Then I go back out one level at a time, to where I was

  Scenario: The zoom level is in the address, so I can share or reload it
    Given I am zoomed into "Food & Drink › Fruit & vegetables"
    When I reload the page
    Then I am still zoomed into Fruit & vegetables

  Scenario: Words count in whatever form I know them
    Given the French list has the headword "manger" with the forms "mange", "manges", "mangeons", "mangé", ...
    And I marked "mangé" known while reading, but never "manger" itself
    Then "manger" counts as known on the map
    And if one form is known and another learning, the word counts as known

  Scenario: Learning words count separately from known ones
    Given an area has 20 words: 5 known, 3 learning and 12 new
    Then its tile shows "5 / 20" and a smaller "3 learning" marker
    And only known words count towards coverage

  Scenario: Ignored words leave the totals
    Given I marked the list word "je" as ignored
    Then "je" shows as ignored in its area
    And it counts neither as known nor towards the area's total

  # --- Bands ---

  Scenario: The map shows my band and the next one
    Given my Reading level is A2
    When I open the map
    Then tiles count the A1 and A2 words, and coverage is for those
    And the B1 words show faintly as "next band": each tile says e.g. "+18 at B1"
    And inside an area, B1 words appear as faint tiles after the A1 and A2 words

  Scenario: A learner with no level yet starts at A1
    Given I have no Reading level
    Then the map counts A1 words and shows A2 as the next band

  Scenario: I can pick which bands the map counts
    When I choose "Up to B1" in the map's band picker
    Then every tile and the header count the A1, A2 and B1 words
    And my choice is remembered on this device

  Scenario: A band with no list yet is not offered
    Given the French list stops at B1
    Then the band picker offers A1, A2 and B1 only
    And at B1, the next band says "B2 words coming soon" instead of a number

  Scenario: Words outside the list still count
    Given I know 900 French words and 640 of them are not in the list (names, rare words, slang)
    Then the map shows a "Beyond the core: 640 words" tile
    And tapping it opens Vocabulary filtered to my known words

  # --- A word on the map ---

  Scenario: Tapping a word shows its meaning
    When I tap the word "pomme" in Fruit & vegetables
    Then a panel shows "pomme", its meaning "apple", its band (A1) and my status

  Scenario: The meaning matches the area the word is in
    Given "glace" is in Food & Drink › Meat, fish & basics in the French list
    When I tap it
    Then its meaning is "ice cream", not "mirror" or "ice"

  Scenario: My own saved meaning wins
    Given I saved "pomme" in the reader with my own meaning "apple (fruit)"
    When I tap it on the map
    Then the panel shows "apple (fruit)"

  Scenario: A native language the list doesn't cover falls back to the reader's lookup
    Given my native language is Polish, and the French list has English meanings only
    When I tap "pomme"
    Then the panel looks the meaning up the way the reader's word popup does (other learners' meanings, then
      machine translation), in Polish
    And if that fails too, the panel shows the word and says no meaning was found
    And it never shows the English meaning to a learner whose native language isn't English

  Scenario: I can learn a word from the map
    Given "poire" is new to me
    When I tap it and choose "Start learning"
    Then it becomes a learning word (yellow) and goes into my reviews, like saving it in the reader
    And the area's "learning" marker goes up by one without reloading
    When I choose "I know this" on a word instead
    Then it becomes known and the area's coverage goes up by one

  Scenario: Saving from the map respects the free plan's limit
    Given I am on the free plan and have reached my saved-word limit
    When I choose "Start learning" on a map word
    Then I see the same upgrade message as in the reader, and the word stays new
    And "I know this" still works, as it does in the reader

  # --- Languages and empty states ---

  Scenario: A language without a list yet
    When I switch my target language to Spanish
    Then the map says "The vocabulary map is coming soon for Spanish"
    And the rest of Progress works as before

  Scenario: A new language's list needs no code
    Given a test-only word list for Spanish that fills the same blueprint
    When I switch my target language to Spanish
    Then the map shows the same 14 regions and areas, counting the Spanish list and my Spanish words

  Scenario: Brand new learner
    Given I know no French words yet
    Then every tile shows "0 / total" and the map says "Words you learn while reading fill in the map"

  Scenario: No target language picked
    Given I have no target language
    Then the map asks me to pick a language instead of showing tiles

  Scenario: The map works on a phone
    Given a 390 px wide screen
    Then the tiles wrap to fit the width, with no sideways scrolling
    And every tile and word is large enough to tap

  Scenario: The map loads quickly for a large vocabulary
    Given I have 30,000 vocabulary entries in French
    When I open Progress
    Then the map answers in under a second

  # --- Keeping the list right (checked by tests, not seen by learners) ---

  Scenario: Every list fits the blueprint
    Then every word in every list names an area that exists in the blueprint
    And no headword appears twice in one language's list
    And each band's size is within 15% of its target
    And every area has at least one word up to B1
    And every word has a meaning in each native language its list covers, and no meaning is just the word copied
      unchanged (except where both languages really spell it the same, which the list marks)

  Scenario: The map doesn't depend on AI at runtime
    Given AI is switched off (no OpenAI key), as on staging
    Then the map works exactly the same
