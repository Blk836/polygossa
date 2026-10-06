Feature: Forum (see docs/architecture/platform.md)
  A simple place for learners to talk with us and each other: bug reports, ideas, general chat, and announcements
  from the team. Threads hold plain-text posts in order. Admins (the team) post announcements and keep order.
  Free on every plan.

  Admins are named by email in configuration (FORUM_ADMINS, comma-separated; in development the shared test account
  test@lector.local is one). There are no other roles.

  Background:
    Given I am signed in

  # --- Finding it ---

  Scenario: The forum is in the account menu
    When I open the account menu
    Then I see "Forum", which opens /forum

  Scenario: Forum categories
    When I open /forum
    Then I see the tabs All, Announcements, Bug reports, Ideas and General
    And threads from every category, each showing its category, title, author, reply count and last activity

  Scenario: Thread order
    Then pinned threads come first, then the rest by latest post (newest first)
    And 20 threads are shown per page, with Newer/Older to move between pages

  Scenario: Filtering by category
    When I pick "Bug reports"
    Then only bug-report threads are listed, and the URL is /forum?category=bugs

  # --- Posting ---

  Scenario: Starting a thread
    When I click "New thread", choose "Bug reports", enter a title and a message and click "Post"
    Then I land on the new thread, showing my message as its first post with my name and the time

  Scenario: Replying
    Given an open thread
    When I write a reply and click "Reply"
    Then my reply appears at the end of the thread
    And the thread's reply count goes up by one and it moves to the top of the list (after pinned threads)

  Scenario: Posts are plain text
    When I post "<b>hi</b>\n\nsecond line"
    Then it is shown exactly as typed, with its line breaks, and no HTML is interpreted

  Scenario Outline: Invalid posts are rejected
    When I post <problem>
    Then I get 400 with a message saying what is wrong, and nothing is saved

    Examples:
      | problem                                            |
      | a thread with a title under 3 or over 120 chars    |
      | a thread or reply with an empty or blank message   |
      | a message over 10,000 characters                   |
      | a thread without a category, or an unknown one     |

  Scenario: Long threads are paged
    Given a thread with 120 posts
    Then 50 posts are shown per page, oldest first, with page links

  # --- Editing and deleting my own posts ---

  Scenario: Editing my post
    When I edit one of my posts and save
    Then it shows the new text, marked "edited"
    And I can't edit anyone else's post (403)

  Scenario: Deleting my reply
    When I delete one of my replies
    Then it disappears and the reply count goes down by one

  Scenario: Deleting my thread
    When I delete the first post of a thread I started
    Then the whole thread is deleted with its replies, after I confirm

  Scenario: I can't delete others' posts
    When I try to delete someone else's post
    Then I get 403

  # --- Announcements and admins ---

  Scenario: Only admins start announcements
    Given I am not an admin
    Then "Announcements" is not offered when I start a thread
    And posting one anyway gets 403
    But I can reply to announcements

  Scenario: Admins post announcements
    Given I am an admin
    When I start a thread in "Announcements"
    Then it is listed with an "Announcement" label, like any other thread

  Scenario: Pinning
    Given I am an admin
    When I pin a thread
    Then it stays at the top of its category and of "All", marked "Pinned", until I unpin it

  Scenario: Locking
    Given I am an admin and I lock a thread
    Then it shows "Locked: no new replies" and has no reply box
    And replying anyway gets 409, for everyone
    And unlocking it allows replies again

  Scenario: Admins remove anything
    Given I am an admin
    Then I can delete any post or thread

  Scenario: Pinning and locking are for admins
    Given I am not an admin
    When I try to pin or lock a thread
    Then I get 403, and I see no pin or lock buttons

  Scenario: Missing threads and posts
    When I open, reply to, edit or delete a thread or post that doesn't exist
    Then I get 404
