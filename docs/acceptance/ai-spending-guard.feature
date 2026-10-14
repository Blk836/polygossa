Feature: AI spending guard: output caps, a daily ceiling for system jobs, stored usage
  A backfill on the dev database spent about $4.90 of OpenAI and produced nothing (#155): replies had no output cap,
  ran past the 30-second timeout, were thrown away and still billed, and nothing recorded the tokens anywhere that
  survived a restart (issue #166).

  Every AI call names its job: word definition, example sentence, translation, writing feedback, writing grade,
  word meaning, content review (on import and sharing) and topic tagging. Topic tagging is the only system job today
  (it runs in the background, not for a learner who is waiting).

  Rule: every call caps its reply

    Scenario: Each call asks for at most the reply its job needs
      When the app sends any AI call
      Then the request sets an output cap ("max_completion_tokens") sized to the job
      And for jobs whose reply grows with the input (translation, writing feedback, writing grade) the cap grows with
        the input, at about twice its size plus a fixed allowance

    Scenario: A reply cut off by the cap is a failure, not an answer
      Given OpenAI stops a reply because it reached the cap ("finish_reason" is "length")
      When the app receives it
      Then the caller gets the same failure as an unavailable AI service (nothing half-written is used or stored)
      And the tokens OpenAI reported for it are still recorded against the job

  Rule: usage is stored per day per job

    Scenario: A successful call adds to today's count for its job
      Given today's count for "translation" is 2 calls, 100 tokens in and 40 out
      When a translation call reports 30 tokens in and 10 out
      Then today's count for "translation" is 3 calls, 130 tokens in and 50 out
      And the count is in the database, so it survives a restart

    Scenario: A failed call is counted as a failure
      When an AI call fails (error from OpenAI, unreadable reply, cut off by the cap)
      Then today's count for its job has one more call and one more failure

    Scenario: A call that times out is counted as if it used its whole output cap
      Given OpenAI may still bill a reply the app gave up waiting for
      When an AI call times out
      Then today's count for its job has one more call, one more failure, and its output cap added to tokens out

    Scenario: The count is kept even when the caller's work is rolled back
      When an AI call succeeds but the request that made it then fails and rolls back its database changes
      Then the AI call is still counted

    Scenario: Days are UTC days
      When a call is made at 23:59 UTC and another at 00:01 UTC
      Then they are counted on two different days

  Rule: system jobs stop at a daily ceiling and resume the next day

    Scenario: The ceiling is a setting with a small default
      Then the daily ceiling for system jobs is "app.openai.system-daily-tokens" (env "AI_SYSTEM_DAILY_TOKENS"),
        counting tokens in plus tokens out across all system jobs, default 500,000 tokens
        (at most about $0.30 a day on gpt-4o-mini, even if every token were output)

    Scenario: Under the ceiling, topic tagging runs as today
      Given system jobs have used 499,999 tokens today
      When the topic-tagging job runs
      Then it tags texts as usual

    Scenario: Over the ceiling, topic tagging stops without counting it against the texts
      Given system jobs have used 500,000 tokens or more today
      When the topic-tagging job runs
      Then it makes no AI call
      And the waiting texts are not marked as failed or pushed back, so they are first in line tomorrow

    Scenario: Reaching the ceiling part-way through a batch stops the rest of the batch
      Given a batch of texts is waiting and the ceiling is reached after the first one is tagged
      When the job carries on
      Then no further texts are sent to the AI that day, and they are not marked as failed

    Scenario: The next UTC day the job resumes
      Given topic tagging stopped at the ceiling yesterday
      When the job runs after midnight UTC
      Then it tags the waiting texts again

    Scenario: Learners' calls never count towards or stop at the system ceiling
      Given system jobs are over today's ceiling
      When a learner looks up a word, translates, gets writing feedback or a grade, or imports a text
      Then their AI calls are made as today (still limited by their own daily AI allowance)
      And they are counted under their own jobs, not the system ceiling

    Scenario: One call can overshoot the ceiling by at most its cap
      Given system jobs have used 499,900 tokens today
      When one topic-tagging call is made
      Then the day may end slightly over the ceiling, by no more than that call's input and output cap

  Rule: the admin page shows AI spending

    Scenario: An "AI" tab shows usage per job and per day
      Given AI calls were recorded over the last 30 days
      When an admin opens Admin and picks the "AI" tab
      Then the address is "/admin?tab=ai"
      And they see, for the chosen period (7, 30 or 90 days), one row per job with calls, failures, tokens in,
        tokens out and estimated cost (at the same prices as the Translations tab), and a total row
      And each job says whether it is a system job

    Scenario: Today's system usage against the ceiling
      When an admin opens the AI tab
      Then they see today's system tokens out of the ceiling, e.g. "120,000 of 500,000 tokens today (UTC)"
      And when the ceiling is reached it says system jobs are paused until midnight UTC

    Scenario: No usage yet
      Given no AI calls were recorded in the period
      When an admin opens the AI tab
      Then they see "No AI calls in this period" instead of an empty table

    Scenario: Learners can't see AI spending
      When a learner asks for the AI usage report or opens "/admin?tab=ai"
      Then they are refused with "Only the team can use the admin panel"

  Rule: no AI configured still works

    Scenario: Without an OpenAI key nothing changes
      Given no OpenAI key is set
      Then no AI call is made, nothing is counted, imports and topic tagging behave as today
      And the AI tab shows "No AI calls in this period"
