Feature: No comments in the code
  The code is the only description of what the product does; the reasons for a change live in its commit message.
  Comments are second copies that drift, so the repository has none, and a check keeps it that way.

  Scenario: The whole repository is free of comments
    Given every file git tracks in Java, Kotlin build scripts, TypeScript, JavaScript, CSS, XML, YAML, properties,
      Dockerfiles, PowerShell and ignore files
    When the tools checks run
    Then no file contains a comment
    And a file that does is named with the line of its first comment

  Scenario: The check runs whatever part of the code a change touches
    Given a pull request that changes only backend, infra or frontend files
    When the local checks pick the suites to run
    Then the tools suite is among them

  Scenario: Text that only looks like a comment is not one
    Given code containing "//" or "/*" or "#" inside a string, a template literal, a Java text block, a regular
      expression, JSX text or a URL
    Then the check does not report it
    And stripping leaves it unchanged

  Scenario: Tool directives that must be written as comments stay
    Given an eslint-disable, @ts-expect-error, @ts-nocheck, triple-slash reference, CHECKSTYLE or Stryker directive,
      or a shebang line or a Dockerfile parser directive
    Then the check does not report it
    And stripping keeps it

  Scenario: Stripping removes a comment without leaving a gap
    Given a comment on its own lines
    When it is stripped
    Then those lines are gone, and no run of blank lines or blank first line is left behind
    Given a comment after code on the same line
    When it is stripped
    Then the code stays and the trailing spaces before the comment go
    Given a JSX comment written as {/* ... */}
    When it is stripped
    Then the braces go with it

  Scenario: Files that can't or shouldn't change are left alone
    Given a Flyway migration that has already run, the Gradle wrapper, generated files (next-env.d.ts, .idea),
      the acceptance scenarios, Markdown, and .env.example (a template listing optional settings)
    Then the check skips them

  Scenario: Stripping changes no behaviour
    Given every comment in the repository is stripped
    When all suites run (local checks with --all)
    Then every suite passes as before
