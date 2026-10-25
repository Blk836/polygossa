Feature: Words that aren't real words in the text's language don't count as vocabulary
  Bad YouTube captions and foreign words inflated a French learner's known-word count. "Les effets psychologiques du
  confinement" has the captions "être imé" (for "être déprimé"), "qui vous inquièteent" and "j'hésitaé", and the English
  "British Medical Journal". Turning the page marked all of them known: one account had about 9,800 known French words,
  an estimated few hundred of them misspellings or English and German words ("into", "until", "habe", "aprrendre").

  Each different word gets one verdict per language from the AI, kept and shared by every text and learner, so a word is
  never asked about twice. The AI is asked whether a word is a real word of that language, not just whether it looks
  like that language: "inquièteent" looks French but isn't a word. Words French really uses stay words ("week-end",
  "football", "interview", "sandwich", "parking"), as do places. People's names keep their own handling
  (person-names.feature) and aren't judged here.

  Rule: a text's words are checked when it is imported

    Scenario: Misspelt and foreign words in a French transcript are found
      Given I import a French video whose captions say "être imé être démoralisé", "qui vous inquièteent" and
        "publiée dans le British Medical Journal"
      When the import finishes
      Then "imé", "inquièteent", "british" and "medical" are marked as not words in that text
      And "démoralisé", "être" and "journal" are ordinary words

    Scenario: Loanwords French uses stay words
      Given a French text "Ce week-end, après le football, on a mangé un sandwich sur le parking."
      When I import it
      Then none of its words are marked as not words

    Scenario: Every way of importing checks its words
      When I import a text by pasting it, from a web page, from a subtitle file, from a book (each chapter), or from a
        video (its captions or a transcription)
      Then the new text's words are checked

    Scenario: A video's transcript that is replaced is checked again
      Given a video whose transcript is replaced (tidied by AI, or transcribed again)
      Then the words of the new transcript are checked, and words no longer in it are no longer marked

    Scenario: A word already judged isn't sent again
      Given "imé" was judged not a word when an earlier French text was imported
      When I import another French text containing "imé" and "chat"
      Then only "chat" is sent to the AI, if it was never judged
      And "imé" is marked as not a word in the new text too

    Scenario: A text whose words were all judged before makes no call
      Given every word of a French text has been judged before
      When I import it
      Then no AI call is made, and its not-words are marked from the earlier verdicts

    Scenario: The same word in another language is judged separately
      Given "chat" was judged a word in French
      When an English text containing "chat" is imported
      Then "chat" is judged again for English

    Scenario: Only the words are sent, in batches
      Given a long book chapter with 2,500 different words never judged
      When it is imported
      Then the AI is sent each different word once, without sentences, at most 300 words per call
      And each reply lists only the words that aren't words, spelled as sent
      And the text is treated only as data to sort, never as instructions to the AI

    Scenario: People's names aren't sent
      Given a French text where the AI found "Marie" is a person's name
      When its words are checked
      Then "marie" is not sent, and it shows as a name, as today

    Scenario: Languages that don't split into words with spaces aren't checked
      Given a Chinese, Japanese or Korean text
      When I import it
      Then no AI call is made for not-words, and its words show exactly as today

  Rule: the import never fails because of the check

    Scenario: AI is switched off, unavailable, or over its daily ceiling
      Given the AI is off, fails, times out, answers something unreadable, is cut off by its output cap, or has
        reached its daily ceiling
      When I import a text
      Then the import succeeds as before
      And the words of the batches that failed show as ordinary words and get no verdict, so a later import asks again

    Scenario: The AI answers with a word that wasn't sent
      Given the AI's reply lists "bonjour", which wasn't one of the words sent
      Then it is ignored, and "bonjour" gets no verdict from that reply

    Scenario: The call is counted like every other AI job
      When words are checked
      Then each call has an output cap and is recorded under its own job, "not words", in the daily AI usage
      And it is a system job, stopped at the daily ceiling for system jobs

  Rule: in the reader, a not-word is set aside, like an ignored word

    Scenario: A not-word shows greyed out, not as a new word
      Given an imported text where "imé" is not a word and I have never saved "imé"
      When I open it in the reader
      Then every "imé" shows like an ignored word, not blue
      And it is not counted in the "new" count in the reader's header

    Scenario: Not-words aren't marked known
      Given "Turning the page marks new words known" is on, and a page with "imé" on it
      When I turn the page, or finish the text
      Then "imé" is not saved to my vocabulary
      And my known-word count doesn't change because of it
      And the finish panel's "words you didn't click will be marked as known" doesn't count it

    Scenario: A not-word can still be looked up
      When I click "imé"
      Then the word popup opens as for any word, with the status buttons

    Scenario: One click turns a not-word back into a word for me
      Given the AI took "calanques" for a not-word
      When I click it and choose Learning or Known
      Then it is saved to my vocabulary and shows with that status in every text, like any word
      And other learners still see it set aside

    Scenario: My own status always wins over a not-word
      Given I already have "british" saved as Learning
      When I open a text where "british" is not a word
      Then it shows as Learning, as before

  Rule: not-words don't count towards how hard a text looks

    Scenario: The library's known percentage leaves not-words out
      Given a text of 100 different words, 5 of them not words, and I know the other 95
      Then the library card and the reader show it as 100% known

    Scenario: The level estimate leaves not-words out
      Given two French texts identical except that one has many garbled caption words
      When both are imported
      Then they get the same level and unique-word count
      And the word count still counts every word, as it measures length

  Rule: an admin cleans up texts and known words already in the app, by hand, after seeing the cost

    Scenario: A dry run says what the cleanup would cost before anything is sent
      Given I am an admin
      When I ask for a dry run of the not-words cleanup for French
      Then I see how many texts it would update, how many different words have no verdict yet, how many AI calls that
        takes, and the estimated cost in dollars
      And no AI call is made and nothing changes

    Scenario: A trial judges a few batches and shows their verdicts
      When I run the cleanup for French limited to 3 calls
      Then at most 3 calls are made, and I see each word they judged not a word
      And those verdicts are kept, so the full run doesn't ask about them again

    Scenario: The full run stops at its spending cap
      When I run the cleanup for French with a cap of 200,000 tokens
      Then it stops before going over the cap, or at the daily ceiling for system jobs, whichever comes first
      And running it again carries on from the words still without a verdict

    Scenario: The cleanup never runs by itself
      When the backend starts, or a deploy happens
      Then no cleanup call is made

    Scenario: Texts already in the app get their not-words marked
      Given the cleanup has judged the words of "Les effets psychologiques du confinement"
      Then the text marks "imé", "inquièteent", "j'hésitaé", "british" and "medical" as not words
      And its level and unique-word count are worked out again without them

    Scenario: Known words that aren't words move to Ignored
      Given my vocabulary has "imé" and "until" as Known, with no note or tags
      When the cleanup judges them not words
      Then they become Ignored, and my known-word count drops by 2
      And I can still set either back to Known myself, and the cleanup doesn't undo that

    Scenario: Words I wrote something on, or am learning, are left alone
      Given "british" is Known with a note I wrote, and "habe" is Learning
      When the cleanup judges them not words
      Then both keep their status

    Scenario: Words I made known myself after the cleanup stay known
      Given the cleanup moved "calanques" to Ignored and I set it back to Known
      When the cleanup runs again
      Then "calanques" stays Known
