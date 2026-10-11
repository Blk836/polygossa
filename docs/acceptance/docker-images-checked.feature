Feature: Production's Docker images are built before a change lands, not first at deploy (#85)
  Development is on Windows and production runs Linux containers. A broken Dockerfile, a build file the image
  can't use, or a path whose letter case only Windows forgives used to show up first when deploying.

  Scenario Outline: A change that can break an image builds both images in the local checks
    Given my branch changes <file>
    When I run the local checks
    Then an "images" suite builds the backend and frontend images for linux/amd64, as the deploy does
    And a failed build turns the "local checks" mark red

    Examples:
      | file                             |
      | backend/Dockerfile               |
      | backend/Dockerfile.dockerignore  |
      | frontend/Dockerfile              |
      | frontend/.dockerignore           |
      | infra/lib/images.ts              |
      | build.gradle.kts                 |
      | settings.gradle.kts              |
      | gradle/wrapper/gradle-wrapper.properties |
      | backend/build.gradle.kts         |
      | frontend/package.json            |
      | frontend/package-lock.json       |
      | frontend/next.config.ts          |

  Scenario: Ordinary code changes don't build images
    Given my branch changes only Java or TypeScript source files
    When I run the local checks
    Then no "images" suite runs, so a normal run isn't slowed down or made heavier

  Scenario: Every suite includes the images
    When I run the local checks with --all, or my branch changes a file outside the known parts
    Then the "images" suite runs too

  Scenario: The images are built from what the deploy sends, not the whole folder
    Given the files left out of each image are listed once, in Docker's ignore files
    Then the deploy (CDK) leaves out exactly those files
    And the local build leaves out exactly those files, so it never sends node_modules or build output to Docker

  Scenario: Docker isn't on PATH in every shell
    Given Docker Desktop's command-line tools are only in its install folder
    When the images suite runs
    Then it finds docker there, as the deploy tool does

  Scenario: Letter-case mistakes in source paths are caught on every run, cheaply
    Given a frontend import names a file with different letter case from the file on disk
      (e.g. "@/components/Polly" for components/polly.tsx)
    Or a Java file's name differs in case from the type it declares, or its folder from its package
    When the tools checks run
    Then they fail, naming the file and the path, without building any image

  Scenario: An import of a package or a file that doesn't exist at all is left to the compiler
    Given an import names a package, or a path with no file in any letter case
    Then the letter-case check doesn't report it
