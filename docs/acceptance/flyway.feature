Feature: Versioned schema changes with Flyway (docs/production.md, phase 1)
  Today Hibernate changes the database schema by itself at startup (ddl-auto: update): it only ever adds, never renames,
  drops, backfills or changes a type, keeps no history, and two hand-written startup migrations patch what it can't
  (text bodies, enum check constraints). Once staging holds real accounts that has to stop: every schema change becomes
  a numbered SQL migration in the repository, applied exactly once per database, in order, by Flyway, and Hibernate only
  checks that the schema matches the code. Cognito (phase 3) is the first feature that will need a migration.

  # --- How the schema is made ---

  Scenario: An empty database gets the whole schema from the migrations
    Given an empty PostgreSQL database (a new developer's, a test's, a new environment's)
    When the backend starts
    Then Flyway applies every migration in order, starting with V1, the current schema
    And Hibernate creates or changes nothing: it only validates that the tables and columns match the entities
    And the app works as before (the full backend and browser suites pass on migrated databases)

  Scenario: An existing database is adopted without changes
    Given a database Hibernate built before this change (the dev database, staging's)
    When the new backend first starts on it
    Then Flyway records it as already at V1 (a baseline) instead of re-creating anything
    And no data is changed or lost
    And from then on only migrations after V1 run on it

  Scenario: Every database ends up with the same constraint names
    Given a database Hibernate built, where some unique constraints have generated names (users.email in the dev
      database was uk6dotkott2kjsp8vw4d0m25fb7)
    When the new backend first starts on it
    Then those constraints get the names a new database has (users_email_key)
    So that a later migration can drop or change a constraint by name on every database

  Scenario: A database that has drifted from V1 is refused, not silently patched
    Given an existing database whose schema doesn't match the entities (a column missing or of another type)
    When the backend starts
    Then startup fails with a message naming the table and column, instead of running against the wrong schema

  # --- Changing the schema ---

  Scenario: A schema change is a migration
    Given a developer adds a field to an entity
    When the backend tests run without a matching migration
    Then they fail (validation finds the missing column)
    And adding V<n>__<what it does>.sql under backend/src/main/resources/db/migration makes them pass

  Scenario: A migration runs once per database, in order
    Given migrations V1 to V3 and a database at V2
    When the backend starts
    Then only V3 runs, and the database records it with when it ran and its checksum

  Scenario: A changed migration that already ran is refused
    Given V2 already ran on a database
    When someone edits V2's file afterwards
    Then the backend refuses to start on that database (checksum mismatch): a fix is always a new migration

  Scenario: Adding a value to a stored enum needs a migration
    Given an enum stored as text with a check constraint listing its values (language, category, plan, …)
    When a value is added to the enum
    Then a test fails until a migration updates that column's check constraint
    And the startup patch that rewrote these constraints (EnumCheckMigration) is gone

  # --- Failures and deploys ---

  Scenario: A failing migration leaves the database as it was
    Given a migration that fails halfway
    When the backend starts
    Then the migration's changes are rolled back (PostgreSQL runs each migration in a transaction)
    And the backend doesn't start, so on staging the deploy fails and the previous version keeps serving

  Scenario: Staging migrates on deploy
    When a merge to main deploys a backend with a new migration
    Then the migration runs when the new backend starts, before it serves requests

  # --- What goes away (its own pull request, merged only with the user's approval: it deletes the two migrations'
  # tests) ---

  Scenario: The one-off startup migrations are retired
    Then TextBodyMigration (moving text bodies out of texts) is removed: every database in use already ran it, and V1
      is the schema after it
    And so is EnumCheckMigration (see above); their tests are replaced by the migration tests here
    And docs and CLAUDE.md say schema changes are migrations, never ddl-auto
