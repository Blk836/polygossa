Feature: People's names in an imported text aren't treated as new words
  A French story full of characters showed "Marie", "Dupont" and "Jean-Luc" as blue new words. They made the text look
  harder, cluttered the page, and turning the page marked them known, adding them to the learner's French vocabulary.

  On import, the AI is shown the text's capitalised words, each with a sentence it appears in, and answers which are
  people's names. Places, countries, brands and everything else stay ordinary words: "Allemagne" and "Londres" are
  worth learning. Only texts imported from now on are checked; texts already in the app are left as they are.

  Rule: names are found when a text is imported

    Scenario: A character's first name and surname are recognised
      Given I import a French text "Marie Dupont habite à Lyon. Le matin, Marie boit un café avec Jean-Luc."
      When the import finishes
      Then "Marie", "Dupont" and "Jean-Luc" are marked as people's names in that text
      And "Lyon" is not a name: it shows as an ordinary word

    Scenario: A name at the start of a sentence is recognised too
      Given a French text "Hier, il a vu Camille. Camille était fatiguée."
      When I import it
      Then both "Camille"s are names, the one starting a sentence included

    Scenario: Every way of importing checks for names
      When I import a text by pasting it, from a web page, from a subtitle file, from a book (each chapter), or from a
        video (its captions or a transcription)
      Then the new text's people's names are found

    Scenario: A video's transcript that is replaced is checked again
      Given a video whose transcript is replaced (tidied by AI, or transcribed again)
      Then its names are found again from the new transcript

    Scenario: A word also written in lowercase in the same text stays a word
      Given a French text "Pierre ramasse une pierre."
      When I import it
      Then "pierre" (a stone) is not hidden as a name anywhere in the text
      And "Pierre" shows as an ordinary word too, as words are saved without their capital letter

    Scenario: Only capitalised words are sent, with one short sentence each
      Given a long book chapter
      When it is imported
      Then the AI is sent each different capitalised word once, with one sentence it appears in (cut to 200
        characters), not the whole text
      And at most 300 different words are sent per text
      And the text is treated only as data to sort, never as instructions to the AI

    Scenario: Languages without capital letters aren't checked
      Given a Chinese, Japanese or Korean text
      When I import it
      Then no AI call is made for names, and its words show exactly as today

    Scenario: A text with no capitalised words makes no call
      Given a text with no capitalised words other than at the start of a sentence, each seen in lowercase elsewhere
      When I import it
      Then no AI call is made for names

  Rule: the import never fails because of names

    Scenario: AI is switched off, unavailable, or over its daily ceiling
      Given the AI is off, fails, times out, answers something unreadable, or has reached its daily ceiling
      When I import a text
      Then the import succeeds as before
      And its names show as new words, exactly as today

    Scenario: The AI answers with a word that isn't in the text
      Given the AI's answer lists "Napoléon", which isn't one of the words sent
      Then it is ignored and only words from the text are marked as names

    Scenario: The call is counted like every other AI job
      When names are checked on import
      Then the call has an output cap and is recorded under its own job, "person names", in the daily AI usage
      And it is a system job, stopped at the daily ceiling for system jobs

  Rule: in the reader, a name is set aside, like an ignored word

    Scenario: A name shows greyed out, not as a new word
      Given an imported text where "Marie" is a name and I have never saved "marie"
      When I open it in the reader
      Then every "Marie" shows like an ignored word, not blue
      And it is not counted in the "new" count in the reader's header

    Scenario: Names aren't marked known
      Given "Turning the page marks new words known" is on, and a page with "Marie" on it
      When I turn the page, or finish the text
      Then "marie" is not saved to my vocabulary
      And my known-word count doesn't change because of it
      And the finish panel's "words you didn't click will be marked as known" doesn't count it

    Scenario: A name can still be looked up
      When I click "Marie"
      Then the word popup opens as for any word, with its meaning and the status buttons

    Scenario: One click turns a name back into a word
      Given the AI took "Rose" for a name in a text about gardens
      When I click "Rose" and choose Learning or Known
      Then it is saved to my vocabulary and shows with that status, like any word
      And from then on it shows with my status in every text, names or not

    Scenario: My own status always wins over a name
      Given I already have "marie" saved as Learning
      When I open a text where "Marie" is a name
      Then "Marie" shows as Learning, as before

  Rule: names don't count towards how hard a text looks

    Scenario: The library's known percentage leaves names out
      Given a text of 100 different words, 10 of them names, and I know the other 90
      Then the library card and the reader show it as 100% known

    Scenario: The level estimate leaves names out
      Given two French texts identical except that one has many character names
      When both are imported
      Then they get the same level and unique-word count
      And the word count still counts every word, names included, as it measures length

  Rule: texts already in the app are unchanged

    Scenario: A text imported before this change
      Given a text imported before names were checked
      When I open it
      Then its names show as new words, exactly as before, and no AI call is made for it
