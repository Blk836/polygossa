Feature: PostgreSQL everywhere (no more H2)
  Development, backend tests and the browser (e2e) tests all run on real PostgreSQL in Docker, the same database
  production uses, so behaviour that differs between databases is caught before it ships. Each environment has its
  own database: tests never read or write the developer's local data.

  # --- Local development ---

  Scenario: Starting the dev database
    Given Docker Desktop is running
    When I run "docker compose -f compose.dev.yml up -d"
    Then a PostgreSQL 17 container named "polygossa-dev-db" listens on localhost:5432
    And its data lives in a named Docker volume, so it survives the container being removed or recreated

  Scenario: The backend uses the dev database by default
    Given the dev database is running
    When I start the backend with no DATABASE_URL set (IntelliJ "Backend" run, or ./gradlew :backend:bootRun)
    Then it connects to jdbc:postgresql://localhost:5432/lector
    And it creates or updates the schema itself, seeds the starter texts and signs in the test account as before

  Scenario: The backend starts the dev database itself
    Given Docker Desktop is running but the dev database container is stopped
    When I start the backend with ./gradlew :backend:bootRun or the IntelliJ "Backend" run
    Then the dev database container is started first and the backend connects to it

  Scenario: Docker is not running
    Given Docker Desktop is not running
    When I start the backend
    Then it fails to start with an error saying the database at localhost:5432 can't be reached
    And no H2 file database is created as a fallback

  Scenario: Existing H2 data is carried over once
    Given my old H2 file backend/data/lector.mv.db has texts, vocabulary, users and progress
    When I run the one-off H2-to-Postgres copy
    Then every row of every table is in the dev database, with the same ids
    And new rows get ids after the copied ones (no duplicate-key errors)
    And the H2 file is left untouched

  Scenario: H2 is gone
    Then the backend has no H2 dependency and no configuration or test mentions an H2 URL

  # --- Backend tests ---

  Scenario: Backend tests run on PostgreSQL in a throwaway container
    Given Docker Desktop is running
    When I run ./gradlew :backend:test
    Then every Spring test boots against PostgreSQL 17 started by Testcontainers
    And the container is removed when the test JVM exits

  Scenario: Every test app gets a fresh database, as with H2's in-memory databases
    Given two test classes boot apps with different setups
    Then each app gets its own empty database in the container
    And an app booted again (after Spring evicted it) starts on an empty database, not on its earlier data

  Scenario: Tests never touch the dev database
    Given the dev database is running on localhost:5432 with my data
    When I run the backend tests
    Then no test connects to localhost:5432 and my dev data is unchanged

  Scenario: Tests can't run without Docker
    Given Docker Desktop is not running
    When I run the backend tests
    Then the Spring tests fail saying Docker isn't available (they don't silently fall back to another database)

  Scenario: Test JVMs starting together all find Docker on Windows
    Given Docker Desktop is running on Windows (reached through its named pipe)
    And another program used the pipe a moment ago (another test JVM, Testcontainers' cleanup container, the Docker CLI)
    When a test JVM looks for Docker
    Then it waits for the pipe to be free (a few seconds at most) instead of deciding Docker isn't there
    And the JVM's tests run, rather than every one of them failing with "Could not find a valid Docker environment"

  Scenario: Docker really isn't running on Windows
    Given Docker Desktop is not running on Windows
    When a test JVM looks for Docker
    Then it still fails saying Docker isn't available, after waiting a few seconds at most

  Scenario: Mutation testing uses the same throwaway databases
    When I run ./gradlew :backend:pitest
    Then its test runs boot against Testcontainers PostgreSQL like ./gradlew :backend:test

  # --- Browser (e2e) tests ---

  Scenario: The e2e backend gets its own PostgreSQL
    When I run "npm run e2e" in frontend/
    Then the e2e backend on :8210 runs on a PostgreSQL container started by Testcontainers, not the dev database
    And it starts empty apart from the seeded starter texts
    And the container goes away when the e2e backend stops

  Scenario: The e2e backend behaves like the dev backend apart from its database
    When the e2e backend runs
    Then the test account is a forum admin, the recommendation job and YouTube caching are as in development
    And no OpenAI key is set
