Feature: Privacy and your data (docs/production.md, phase 4: GDPR)
  EU users are in scope at launch, so learners can take all of their data, delete their account with everything
  in it, and read what we keep and who processes it. Settings gets a Privacy tab for the first two.

  # --- Download my data ---

  Scenario: Downloading my data
    Given a learner with texts, saved words, progress and writing
    When they choose "Download my data" in Settings › Privacy
    Then they get one JSON file (named <brand>-data.json) with their profile, texts (with their content), words,
      reviews, progress, sessions, writing, playlists, classes, class memberships and forum posts
    And it has no password hash and nothing of anyone else's (not even replies in their threads)

  # --- Delete my account ---

  Scenario: Deleting my account removes everything of it
    Given a learner with texts (one shared with the community, one with audio), words, a photo, a playlist that
      another learner bookmarked, a class they teach with a student, and forum threads and replies
    When they type their account's email (any case) and choose "Delete my account"
    Then every row naming the account is gone from the database, checked by scanning every table
    And their photo and audio files are deleted from storage
    And their shared texts, playlists, class and threads (with the replies in them) are gone for everyone
    And other learners keep their own data: a word they saved from the deleted text stays, without the link
    And replies they wrote in other people's threads are gone, and those threads' reply counts follow
    And the team's moderation log keeps its entries without saying who they were about
    And they are signed out and land on the landing page; their sign-in no longer works

  Scenario: Deleting my account also deletes my sign-in at Cognito
    Given a learner signed in through Cognito
    When they delete their account
    Then their user is deleted from the user pool too, after the data, and they pass through Cognito's sign-out

  Scenario: Deleting needs the account's email typed
    When the typed email is missing or isn't the account's
    Then the button stays disabled, the server refuses it, and nothing is deleted

  # --- The legal pages ---

  Scenario: A draft privacy policy and terms anyone can read
    When anyone opens /privacy or /terms, signed in or not (and they never sign anyone in)
    Then they read a draft privacy policy naming what we keep, why, every processor and where (AWS in Ireland,
      Google for Google sign-in and YouTube, OpenAI in the US for AI features, the dictionaries,
      Stripe once paid plans launch), the cookies, how long data is kept and their rights
    And draft terms covering accounts, content, acceptable use, takedowns, plans, AI and liability
    And both say they are drafts, with what is still to fill in marked [like this]
    And the landing page's footer and the sign-up page link to them

  Scenario: No cookie notice
    Then there is no cookie banner: the app sets only cookies it needs (sign-in, theme, layout)
    And the privacy policy says YouTube's player may set its own cookies when a video plays
