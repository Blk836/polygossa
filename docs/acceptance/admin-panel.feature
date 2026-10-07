Feature: Admin panel (see docs/architecture/platform.md)
  The team needs to see how the product is doing (who signs up, who comes back, which plans) and to act on accounts
  that break the rules: suspend them, remove what they posted or shared, change their plan. Admins are the team,
  named by email in configuration (FORUM_ADMINS, the same list that moderates the forum); everyone else gets 403
  from every admin endpoint and never sees the panel. Every action is recorded with who did it and when.

  Background:
    Given I am signed in as an admin

  # --- Access ---

  Scenario: Only admins
    Given I am signed in as a learner
    Then every /api/admin endpoint answers 403
    And GET /api/me says admin false, and the account menu has no "Admin" item

  Scenario: The account menu leads admins to the panel
    When I open the account menu as an admin
    Then I see "Admin", which opens /admin

  # --- Stats ---

  Scenario: Users per plan and sign-ups
    When I request GET /api/admin/stats
    Then I get the number of users in all, per plan (free, pro, classroom), suspended, and signed up today
    And new sign-ups per day for the last 30 days

  Scenario: Daily active users
    Given learners used the app on several days
    Then the stats give active users per day for the last 30 days (a user counts once per day, by UTC day),
      today's, the last 7 days' and the last 30 days' distinct active users

  Scenario: Learning and content figures
    Then the stats also give users per learning language, texts (all, public, videos), playlists, forum threads and
      posts, saved words, reviews today, words read today and AI calls today

  Scenario: Days to show
    When I request GET /api/admin/stats?days=7
    Then the per-day lists cover 7 days, oldest first
    And days outside 1-365 give 400

  # --- Users ---

  Scenario: Finding users
    When I search users for "ana"
    Then I get users whose email or name contains "ana", newest first, 25 per page, each with plan, sign-up date,
      last active day, whether suspended or an admin, and how many texts, playlists and forum posts they have

  Scenario: A user's details
    When I open a user
    Then I see their figures and their texts and playlists (title, public or not), most recent first

  # --- Actions ---

  Scenario: Suspending a user
    When I suspend a learner with the reason "spam"
    Then their account is suspended with that reason
    And every request they make answers 403 with code "account_suspended"
    And they can't sign in (403 "account_suspended")
    And their public texts and playlists stay as they are until I remove them

  Scenario: Lifting a suspension
    When I lift the suspension
    Then they can sign in and use the app again

  Scenario: Admins and the community library can't be suspended
    When I try to suspend myself, another admin or the community library account
    Then I get 400 and nothing changes

  Scenario: Removing all forum posts by a user
    Given the user started one thread (with someone else's reply) and replied to another thread
    When I remove all their forum posts
    Then the thread they started is deleted with its replies, their reply is gone, the other thread stays
    And I get how many posts and threads were removed

  Scenario: Removing all playlists by a user
    When I remove all their playlists
    Then their playlists are gone (saved copies with them), and their texts are untouched

  Scenario: Removing all content uploaded by a user
    When I remove all their texts and videos
    Then each is deleted as if they deleted it themselves (progress, playlist entries and so on go too)
    And other learners' saved words that came from those texts are kept

  Scenario: Unsharing everything
    When I unshare everything a user shared
    Then their texts and playlists become private, and Explore no longer shows them

  Scenario: Removing one text
    When I remove a single text from a user's list
    Then only that text is deleted

  Scenario: Changing a plan
    When I change a user's plan to Pro
    Then their plan is Pro

  Scenario: Bulk removal is refused for the community library
    When I try to remove all texts or playlists of the community library account
    Then I get 400, so the starter texts and curated videos can't be wiped by a slip

  Scenario: The record of actions
    When I request GET /api/admin/actions
    Then I see the latest actions, newest first: who did what to whom, when, and the details (reason, counts, plan)

  # --- The panel ---

  Scenario: The admin page
    When I open /admin
    Then I see tiles for users, active today, active this week and this month, and users per plan
    And a chart of daily active users and of sign-ups
    And a user search with a table of results
    And opening a user shows their figures and the actions, each asking "Are you sure?" inline before it runs
