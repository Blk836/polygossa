# Polygossa — language learning reader

A web app for learning languages by reading authentic content: import texts, click words for definitions, build a
personal vocabulary, review it with spaced repetition, and watch your known-word count grow.

## Where the truth lives
- **The code is the only description of what the product does and how it is built.** Read it, not prose about it.
- **Commit messages carry the why.** Write each one to explain the reason for the change; `git log -S`/`git blame`
  find it later.
- **`docs/acceptance/*.feature`** are the scenarios agreed for each piece of work: a record of what was asked for at
  the time, like history. The tests are what keep them true; a later change may supersede an old scenario.
- **The backlog is GitHub issues** (labels `launch`, `roadmap`, `product-gap`, `tech-gap`): `gh issue list`. Close an
  issue when its work ships; open one for anything designed or found but not built.
- **No code comments**, and no docs that restate what the code does: both are second copies that go stale. Put the
  why in the commit message, and guard a trap with a test or lint rule rather than a warning. Tool directives that
  must be comments (`eslint-disable`, `@ts-expect-error`, `CHECKSTYLE`, shebangs) stay; `tools/no-comments.test.mjs`
  enforces the rest.
- `docs/` holds only the acceptance scenarios. Business plans (go-to-market: polygossa-archive#147) are private issues in the archive, and
  operating procedures live with their tools in `tools/README.md`.

```
backend/    Spring Boot 4.1 (Java 21) — REST API; Gradle module :backend, package app.lector
frontend/   Next.js 16 + React 19 + Tailwind 4 — UI and backend-for-frontend (BFF) API routes
tools/      team command-line tools (plain Node, no packages); see tools/README.md
infra/      AWS CDK (TypeScript): production (stack PolygossaStaging), QA user pool, GitHub's deploy role
```

## How to work here: "gauntlet" verification

Work under a "gauntlet" verification model: I will not read your code line by line,
so the checks must prove it is correct.

1. Before writing any code, write the acceptance criteria as Gherkin-style
   scenarios (Given/When/Then), including edge cases and failure paths.
   Stop and wait for my approval. These are the only thing I review directly.
   **Exception — running under `/goal`:** don't stop for approval at the start. Still write the scenarios (and
   still test against them), but present them at the end, in the final report, for review.
2. Use TDD: write failing tests for each scenario, then implement until they pass.
   For bug fixes, write a regression test that reproduces the bug first.
3. Never delete, skip, or weaken an existing test or assertion to make
   something pass. If a test seems wrong, stop and tell me why.
4. **Every pull request runs the full checks on GitHub** (the repository is public, so Actions minutes are free;
   the repository variable `CHECKS_ON_GITHUB` is `true`). Commit and push from your worktree; GitHub picks the suites
   your branch's changes need (`.github/workflows/ci.yml`). **Always merge the latest main in first** (`git fetch`,
   `git merge origin/main`, push), so conflicts surface now and the run tests what will land, not a stale branch that
   has to go round again at merge time. **Locally, run only the individual tests you are writing or changing** (TDD's
   red and green), never a whole suite: two at once overload the machine and the end-to-end suite's fixed ports
   collide. A heavy one (a backend test class, a Playwright spec, mutation testing) takes its turn with
   `node tools/local-checks.mjs --run -- <command>`; `node tools/local-checks.mjs` alone still runs the suites here and
   marks the commit "local checks", for when GitHub can't. It sets `JAVA_HOME` when it's missing; run directly,
   backend and end-to-end runs need it (see Running it). Mutation testing (PIT `./gradlew :backend:pitest -Ppitest.since=<commit>`, Stryker `cd frontend && npm run mutate`)
   isn't run unless the user asks, so say so in the report; in Git Bash append `/c/Windows/System32` to `PATH` before
   Stryker. Any UI change needs a Playwright scenario (`frontend/e2e/`), since there are no component tests.
   Complexity limits (cyclomatic 10, 300 lines a file) are enforced by Checkstyle and ESLint.
5. Respect module boundaries (see below). Do not add new dependencies without asking.
6. End with a short report: what changed, the GitHub checks' result (each job passed or failed, with the run's link),
   the individual tests you ran, and anything you're unsure about. "Should work" is not an acceptable status.
7. Commit each incremental change to git as you go (e.g. scenarios, failing tests, implementation, a fix): one
   focused commit per step with a message saying what changed and why. Work on a feature branch, never on main:
   push it, open a pull request (`gh pr create`), and merge it yourself (`gh pr merge --merge --delete-branch`,
   keeping the commits) only when GitHub's checks on its latest commit are green (`gh pr checks --watch`). If main
   moved since they ran, merge main into the branch and push, so they run again first. Keep few branches finishing at the same time, since each merge sends the others round again.
   If a check fails, fix it on the branch; never merge red, **except for a flaky test**: one that fails in a full
   run but passes when run alone (`--repeat-each=3`) and that the branch's changes don't touch. Then merge anyway,
   add it to "Flaky tests (tech debt)" below, and say so in the report. Re-run only the failed jobs
   (`gh run rerun <id> --failed`), not the whole run. (`gh pr merge` can't merge a change to a workflow file
   without the CLI's `workflow` scope; merge locally with `git merge --no-ff` and push instead.) "Green before
   merging" is our rule. Don't batch unrelated work into one
   commit, and list the commits in the final report.
   **Merging is the end: don't deploy to production unless the user asks.** When asked, deploy with
   `node tools/local-deploy.mjs` from your worktree: it deploys the latest main from the PC's copy, skips a main that
   is already live (`--again` forces it), checks the site answers, and marks main's commit "deploy production". It
   needs Docker Desktop running and the `polygossa` AWS sign-in. A failed deploy is fixed forward on a new branch.
   GitHub deploys only when asked (a hand-started `deploy_only` run, or `DEPLOY_ON_GITHUB=true`).

### Flaky tests (tech debt)
End-to-end tests that fail in a full run on a loaded PC but pass alone. Each run usually fails at most one, a
different one each time; the same commit has gone red then green on a re-run since at least PR #55. Remove a line
when its test is fixed.
- `e2e/page-skeletons.spec.ts` › "with reduced motion the outline doesn't pulse": the outline's animation name read
  "" instead of "pulse" (suspected: read before the stylesheet applied). Seen 2026-10-24, PR #73 (sentence view);
  passed 3 of 3 alone.
- `e2e/playlist-save.spec.ts` › "Explore's playlist cards have a Save button that keeps its state": after reloading,
  the card's Save button wasn't found within 5 s. Seen 2026-10-22, PR #209 (people's names); passed 3 of 3 alone.
- `e2e/card-layout.spec.ts` › "a category or search grid follows the layout": Explore showed "This page couldn't
  load" (a failed server render). Seen 2026-10-10, PR #89. Since PR #74 a failed run uploads both servers' logs
  (`frontend/e2e-logs`) with its report, so the next occurrence shows the cause.
- `e2e/reader-colours.spec.ts` › "the word being spoken still shows, quiet or not": after "]" the word never got
  `w-speaking` within 5 s. Seen 2026-10-10, PR #90; passed 20 of 20 alone on 2026-10-24 (PR #74), cause unknown.
- `e2e/reader-media-resume.spec.ts` › "pressing Play twice while the video is still starting keeps the bar at the
  page's start". Seen 2026-10-10, PR #94; passed 20 of 20 alone on 2026-10-24 (PR #74), cause unknown.

### One worktree per session
Several Claude sessions often work on this repository at once, and in one shared folder they switch branches under
each other. So **every session that changes files starts by moving into its own worktree** (the `EnterWorktree`
tool; it makes `.claude/worktrees/<name>` on a new branch from `origin/main`) and works, commits and pushes only
there. Never run `git switch`/`checkout`, `reset`, `rebase` or bare `git stash` in the main folder: it belongs to the
user and the IntelliJ dev servers. **Always work from the latest main, including when only answering questions**:
without a worktree, `git fetch` and read `origin/main` (`git show origin/main:<path>`).
**Delete your worktree when you are done** (merged or abandoned): `ExitWorktree` with remove, or
`git worktree remove .claude/worktrees/<name>` from the main folder; never `--force` one with uncommitted changes.
Leftover worktrees each keep `node_modules`, build output and `.next`, which IntelliJ indexes. When tidying up
others' worktrees, remove only those whose branch is merged into `origin/main` and whose session has ended.
- A new worktree has no `node_modules`: run `npm ci` in `frontend/` (and `infra/`) before using them there.
- The dev OpenAI key file (`.idea/runConfigurations/Backend.xml`) exists only in the main folder; git is told to
  ignore its changes (`--skip-worktree`): never stage it.
- A single e2e spec starts servers on fixed ports (:3210 and :8210); if another session's are already there, set
  `E2E_PORT`/`E2E_BACKEND_PORT` to other ports.

### Bug reports: reproduce in the browser first
When I report a bug, reproduce it in a real browser before reading code for a fix: watch the behaviour yourself
(log state on every frame if it's timing-related) so we agree on what the bug is. Only then look for the cause in code.
If it can't be reproduced, say so and ask instead of guessing. Pick the browser by what the bug depends on:
- **Playwright driving installed Chrome** (default for playback, timing and interaction bugs): a Node script with
  `chromium.launch({ channel: "chrome", headless: false, args: ["--autoplay-policy=no-user-gesture-required"] })`
  (require `playwright` from `frontend/node_modules`). Input is exact and the repro turns straight into an e2e test.
  It signs in as `test@lector.local`, so recreate the situation and delete what you create. Playwright's bundled
  Chromium never plays YouTube.
- **Claude in Chrome extension** (my own browser): when the bug may depend on my account, data, extensions or Chrome
  settings, or when I want to watch. Chrome won't start media in a hidden tab, and only I can select the tab: ask me
  to click it.

### Module boundaries
- `frontend` ↔ `backend` only over HTTP. Browser code calls the backend only through `lib/api.ts` (the BFF);
  server-only code uses `lib/server-api.ts`. Never call the backend URL from the browser or expose the JWT to it.
- Text is split into words only through `TokenizationService`.
- Backend layering: controllers → services → repositories/entities. Controllers load texts through
  `TextService.loadReadable`/`loadOwned`, never a repository; no package depends on a controller.
- External services (OpenAI, YouTube, Amazon Translate) only through `AiClient`, `YouTubeClient` and
  `TranslationClient`, and every feature using one keeps working without it.

### AWS, GitHub and production
**Production:** https://polygossa.com (the `SiteUrl` output of the `PolygossaStaging` stack; it was
built as staging, and renaming a stack rebuilds everything). No real users yet. Test accounts made there use
`@example.com` addresses. **QA** is the local app, signing in through the QA Cognito user pool (stack `PolygossaQa`).
There is no cloud staging: treat main as releasable. What is live is the latest "deploy production" mark on main's
commits. Production can be paused behind a coming-soon page (`paused` in `infra/cdk.json`; the stack's `Paused`
output says which): only the owner decides that, and unpausing names the database snapshot (tools/README.md).

AWS is our own Organization: a management account (`322126339607`, the user's: region policy, new accounts,
organization budgets) and the app account **"polygossa-app"** (`788826923437`), the only one Claude works in.

Tools on the dev machine (not on PATH in every shell, so use the full paths):
- **AWS CLI** `C:\Program Files\Amazon\AWSCLIV2\aws.exe`, profile `polygossa` (`788826923437`, `eu-west-1`).
  Sessions last 12 hours; when one expires, the user runs
  `& "C:\Program Files\Amazon\AWSCLIV2\aws.exe" login --profile polygossa` in PowerShell and picks
  **"polygossa-app"** in the browser. If the CLI asks to overwrite the profile with any other account ID, the
  answer is **n**. Check with `aws sts get-caller-identity --profile polygossa`. The **AWS Agent Toolkit** gives
  Claude the MCP server `aws-mcp` (via `uvx` in `~/.local/bin`) and AWS skills.
- **GitHub CLI** `C:\Program Files\GitHub CLI\gh.exe`, signed in as the owner (`Blk836/polygossa`, public; the private `Blk836/polygossa-archive` keeps
  the history before it went public, its pull requests and the private issues).
- **AWS CDK** comes with `infra/` (`npx cdk diff|deploy`); deploying needs Docker running.

Rules:
- Infrastructure changes only through CDK (`infra/`), never by CLI or console. The CLI and MCP server are for
  reading, investigating and previewing (`cdk diff`). Run `cdk deploy` by hand only to bootstrap or to change the
  deploy role (`PolygossaGitHubDeploy`), always `cdk diff` first. Commit `infra/cdk.context.json`.
- GitHub's OIDC subject names the repository with immutable IDs (set in `infra/cdk.json`): the deploy role must
  trust that form, not `repo:Blk836/polygossa`.
- Everything holding user data lives in `eu-west-1`; `us-east-1` only for global services (CloudFront, WAF).
- Before AWS work, check for a relevant AWS skill; verify AWS details against documentation instead of guessing.
- Never read secret values into the conversation: reference Secrets Manager entries by name.
- When production misbehaves: CloudWatch logs (backend and frontend log groups), the last "deploy production" mark,
  and the stack's state in CloudFormation.

## Running it

**Docker Desktop must be running** (PostgreSQL is in Docker everywhere; its CLI is in
`~/AppData/Local/Programs/DockerDesktop/resources/bin`). `bootRun` starts the dev database from `compose.dev.yml`.

In IntelliJ, run the shared **App** configuration (`.idea/runConfigurations/`): Backend (`:backend:bootRun`, :8080)
and Frontend (`npm run dev`, :3000), each in its own Run tab, plus a browser opener. Or from a terminal:

```bash
./gradlew :backend:bootRun                 # API on :8080
cd frontend && npm install && npm run dev  # web app on :3000
```

`java` isn't on PATH: set `JAVA_HOME` to `~/.jdks/openjdk-26.0.1` (the IntelliJ SDK) first.

**Claude managing the servers:** check what's listening before starting anything
(`Get-NetTCPConnection -State Listen -LocalPort 8080,3000`). If the servers are already up (e.g. the user's IntelliJ
run), reuse them. Otherwise start them as background tasks, and stop them when done: stopping the task leaves the
Java/Node processes running, so stop those too and check the ports are free. Don't kill servers you didn't start
without asking. **Exception: duplicates.** More than one frontend or backend for this project overloads the machine:
keep the one in use (the IntelliJ run, if there is one) and stop the others. The e2e servers (:3210, :8210) are not
duplicates while a Playwright run uses them.

**Heavy runs:** the machine has 16 GB, shared with IntelliJ, the dev servers and other sessions. Whole suites run
only through `tools/local-checks.mjs`. Even a single backend test class shouldn't run while another Gradle test run
uses the same checkout: they share `backend/build/`.

**Login.** Local runs sign in through the QA user pool; the developer signs up there once with a real email. Setting
`COGNITO_DOMAIN=` (frontend) and `COGNITO_ISSUER=` (backend) to empty goes back to auto-login as
`test@lector.local`. Backend and browser tests never use a pool. Production signs in only through Cognito: keep the
`prod` profile turning off the app's own accounts and the auto-login. Test accounts for checking production or QA by
hand are made with Cognito's admin API (`@example.com`, deleted afterwards).

**Filling Explore with videos (`tools/import-videos.mjs`):** when asked to find content, search YouTube for videos
actually *spoken* in the target language with captions in it (translated subtitles are the wrong language), write
them to a list file, `--dry-run` first, then run against a backend started with `CURATOR_TOKEN` set. Don't restart
the user's IntelliJ backend to add the token, and never start a second backend for it: ask the user to restart theirs.
Details: [tools/README.md](tools/README.md).

**Brand name:** never hard-code it; it is `BRAND_NAME` (`lib/brand.ts`, `config/Brand`), and `app/branding.test.ts`
enforces that. Internal identifiers (`app.lector`, `lector_*` cookies, `@lector.local`) are deliberately not tied to it.

## Tests

While working, run one test class or file at a time through `node tools/local-checks.mjs --run -- <command>`, e.g.
`./gradlew :backend:test --tests app.lector.ToursApiTest` or `npx playwright test e2e/feature-tours.spec.ts`;
`npx vitest run lib/tours.test.ts` and `node --test tools/<file>.test.mjs` are light enough to run directly. Tests
never hit the network or call OpenAI (stubs: `OpenAiStub`, `YouTubeStub`, `TranslateStub`).

## Backend conventions and gotchas (Spring Boot 4 / Jackson 3)
- Jackson 3: `tools.jackson.databind.*` (`JsonNode.asString()`, not `asText()`), exceptions are unchecked.
  Annotations stay in `com.fasterxml.jackson.annotation`.
- Starters are modular: `spring-boot-starter-webmvc`, and `spring-boot-starter-restclient` is needed for
  `RestClient.Builder`. Test annotations live in e.g. `org.springframework.boot.webmvc.test.autoconfigure`.
- `AppProperties` nested records need `@DefaultValue` or they bind as null when absent from YAML.
- Errors: throw `ApiException`; `GlobalExceptionHandler` maps them to `{code, message}`.
- Deadlines use the injected `Clock` bean, never `Instant.now()`, so tests can move time.
- Plan gating goes through `PlanService`.
- API tests share a booted app: use `@ApiTest`, `@ClockApiTest` or `@YouTubeApiTest`. Give a class its own
  `@SpringBootTest`, `@DynamicPropertySource`, `@MockitoBean` or `@TestConfiguration` only when it needs settings the
  shared ones can't have, or its results depend on everything in the database. Test classes run in parallel JVMs.
- Every booted test app gets a new, empty PostgreSQL database (`TestDatabases`); a class with its own
  `@SpringBootTest` names its database with `test.database=<name>`.
- **Every schema change is a new Flyway migration** in `backend/src/main/resources/db/migration`. Hibernate only
  validates, so an entity change without its migration fails every backend test. Never edit a migration that has
  run anywhere: fix forward. A new value in an enum stored as text needs a migration updating its check constraint.
- A text's body (`TextBody`) loads lazily and `open-in-view` is off: read or change it inside a transaction. Lists of
  cards must never touch the body (`CardListsTest`).

## Frontend conventions
- **Read the bundled docs in `frontend/node_modules/next/dist/docs/` before using Next APIs** (`proxy.ts` replaces
  middleware, `params` and `cookies()` are async).
- Browser code calls the BFF with `api()` from `lib/api.ts`; server components use `backendJson()` from
  `lib/server-api.ts`. API response types in `lib/types.ts` stay in sync with backend DTOs.
- Colours only through the theme tokens in `app/globals.css`; never Tailwind's `dark:` variant or raw palette colours
  (`app/theme-palette.test.ts`).
- Lists follow the language picked in the top bar: pass it with `withLanguage()` and key the page body by it.
- E2E tests run as `test@lector.local` against the e2e backend's own database, shared by parallel tests: create the
  data a test needs through `page.request` and delete it afterwards, scroll an element into view before measuring it,
  and use `test.info().project.use.baseURL` rather than a hard-coded port. Never change the test account's target
  language or interests (they can't be cleared again): stub those requests with `page.route`.
- The React lint rules forbid setting state synchronously in effects and calling `Date.now()` during render: fetch
  inside the effect with `.then` and a `cancelled` flag.
