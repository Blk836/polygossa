Feature: A fast e2e suite (frontend/e2e, `npm run e2e`)
  The Playwright suite took 12–15 minutes against `next dev`, which compiles pages on demand and slows down as soon as
  several test workers share it. It must get much faster without dropping, skipping or weakening any test.

  # --- The server the tests run against ---

  Scenario: Tests run against a production build on their own port
    When I run `npm run e2e`
    Then the frontend is built (`next build`) and served with `next start` on port 3210 (E2E_PORT)
    And a `next dev` on :3000 (e.g. the IntelliJ App run) keeps running and is not used
    And the backend on :8080 is reused when it is running, or started

  Scenario: The build is skipped when nothing changed
    Given the last build is newer than every app source, style, public file and config file
    When I run `npm run e2e` again
    Then no build runs ("frontend build is up to date")
    And changing only unit tests (*.test.ts) or e2e specs doesn't trigger a build

  Scenario: Changing the brand name rebuilds
    Given the last build was made with another BRAND_NAME
    Then the next run rebuilds, since the name is inlined at build time

  Scenario: Debugging against another frontend
    Given E2E_BASE_URL is set (e.g. http://localhost:3000)
    Then the tests use that frontend and no production server is started

  Scenario: Tests never assume a port
    Then no spec hard-codes localhost:3000: cookies and second browsers use the configured base URL

  # --- Cleaning up after tests ---

  Scenario: Deleting many words at once
    When I POST /api/vocabulary/delete with {"ids": [up to 1000 entry ids]}
    Then those of my entries are deleted in one request, and I get {"deleted": <how many>}
    And ids of other learners' entries, or unknown ids, are ignored (never deleted)

  Scenario Outline: Invalid bulk deletes
    When I POST /api/vocabulary/delete with <body>
    Then I get 400 and nothing is deleted

    Examples:
      | body                    |
      | no ids                  |
      | an empty list           |
      | more than 1000 ids      |
      | a null id in the list   |

  Scenario: Reader tests clean up their words in a few requests
    Given a test marked 900 words known
    Then its clean-up deletes them in one request per 200 words, not one per word

  # --- Keeping the tests honest ---

  Scenario: Same tests, same assertions
    Then every spec and every assertion from before still runs, unchanged unless a hard-coded port or a test bug had
      to be fixed
    And the suite passes repeatedly at the chosen worker count
