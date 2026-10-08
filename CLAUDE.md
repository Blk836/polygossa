# Polygossa — language learning reader

A web app for learning languages by reading authentic content: import texts, click words for definitions, build a
personal vocabulary, review it with spaced repetition, and watch your known-word count grow.

Docs:
- [Architecture](docs/architecture/README.md): **read this first in a new session.** The high-level map: what each
  product area does for learners and roughly how it is built, plus the product decisions taken.
- [Product plan](docs/plan.md): the original vision. [Roadmap](docs/roadmap.md): designed but not built yet.
- [Product gaps](docs/product-gaps.md): what is missing (product review); ideas not yet designed.
- [Technical gaps](docs/technical-gaps.md): where development and tests differ from production, and what only works
  with one backend server.
- [Production plan](docs/production.md): going live on AWS (EU) with Cognito login, Stripe and GDPR; not started.
- [Acceptance scenarios](docs/acceptance/): the agreed Gherkin scenarios per feature.

**Keeping the docs true is part of every change.** `docs/architecture/` must always describe the product as it is:
when a change alters what the product does or how the pieces fit together, update the relevant page in the same
commit (and move shipped items out of `docs/roadmap.md`). Keep it high level (product behaviour first, then the tech
in a few lines); never copy code-level detail such as endpoint lists, class inventories or constants into docs. The
code is the source of truth for details, so there is never a second, stale copy.

```
backend/    Spring Boot 4.1 (Java 21) — REST API; Gradle module :backend, package app.lector
frontend/   Next.js 16 + React 19 + Tailwind 4 — UI and backend-for-frontend (BFF) API routes
tools/      team command-line tools (plain Node, no packages): import-videos.mjs bulk-imports curated YouTube videos
infra/      AWS CDK (TypeScript, run directly by Node): production (stack PolygossaStaging) and GitHub's deploy role
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
4. **Never run a whole suite locally: it overloads the machine.** That means no full `./gradlew :backend:test`,
   `npm test`, `npm run e2e`, PIT or Stryker run, and no running several test classes or specs "to be safe". Locally,
   run only the individual tests you are writing or changing (one backend test class with `--tests`, one Vitest file,
   one Playwright spec file), for TDD's red and green. Verification and regression checking are what CI is for: it
   runs every check below on each pull request, and its green run is the proof. Mutation testing (PIT, Stryker) isn't
   run locally and CI doesn't run it yet, so say so in the report. The checks, for reference:
   - tests: `./gradlew :backend:test` (backend); `cd frontend && npm test` (Vitest, pure modules only);
     `cd frontend && npm run e2e` (Playwright, `e2e/*.spec.ts`, real Chromium against a production build — any UI change
     needs a scenario here, since there are no component tests);
     `node --test "tools/**/*.test.mjs"` (tools); `cd infra && npm test && npm run typecheck` (CDK stacks, synthesized
     without AWS access).
   - mutation testing on changed files (not run locally, see above; for when CI runs it or the user asks): `./gradlew :backend:pitest -Ppitest.since=<commit>` (PIT on just the main
     classes changed since that commit, e.g. the one before the task's first commit; `-Ppitest.targets=app.lector.text.*`
     names them directly, and no property mutates everything), `cd frontend && npm run mutate` (Stryker; the modules it
     covers are listed in `stryker.config.mjs`; incremental: it reuses the last run's results for unchanged code and
     tests and still reports the whole score; `npm run mutate -- --force` re-runs everything, and resets a score that
     looks too low: a reused result can go stale after a test file broke and was fixed, which only lowers the score), `frontend/node_modules/.bin/stryker run tools/stryker.config.mjs` from the repo root
     (tools/). In Git Bash, append `/c/Windows/System32` to `PATH`
     (`PATH="$PATH:/c/Windows/System32"`; prepending makes `bash` resolve to WSL) before `npm run mutate`, or Stryker crashes at exit looking for `taskkill` and leaves `.stryker-tmp` behind.
   - lint + type check + build: `cd frontend && npx tsc --noEmit && npx eslint . && npx next build`; for Java, `./gradlew :backend:compileJava`
     (javac is the type check).
   - complexity check: no function over cyclomatic complexity 10, no file over 300 lines. Enforced by
     `./gradlew :backend:checkstyleMain` (backend), ESLint `complexity`/`max-lines` (frontend; for tools/, from the repo root:
     `frontend/node_modules/.bin/eslint --no-config-lookup --rule '{"complexity":["error",10],"max-lines":["error",300]}' "tools/**/*.mjs"`).
5. Respect module boundaries (see below). Do not add new dependencies without asking.
6. End with a short report: what changed, the CI run's result (with its link), the individual tests you ran locally,
   and anything you're
   unsure about. "Should work" is not an acceptable status.
7. Commit each incremental change to git as you go (e.g. scenarios, failing tests, implementation, a fix): one
   focused commit per step with a message saying what changed and why. Work on a feature branch, never on main:
   push it, open a pull request (`gh pr create`), wait for CI (`gh pr checks --watch`), and merge it yourself
   (`gh pr merge --merge --delete-branch`, keeping the commits) only when every check is green. If main moved since
   the checks ran, merge main into the branch and wait for the checks again first. A merge to main deploys production
   without re-running the checks (they ran on the pull request). If a check fails, fix it on the branch; never merge
   red. (`gh pr merge` can't merge a change to a workflow file without the CLI's `workflow` scope; merge locally with
   `git merge --no-ff` and push instead, and GitHub marks the pull request merged.) "Green before merging" is our rule, not GitHub's: enforcing it (branch
   protection) needs GitHub Pro or a public repository. Small commits make it easy to diff changes
   over time and bisect to the commit that broke something. Don't batch unrelated work into one commit, and list the
   commits in the final report.

### One worktree per session
Several Claude sessions often work on this repository at once, and in one shared folder they switch branches under
each other: commits land on the wrong branch and edits vanish. So **every session that changes files starts by moving
into its own worktree** (the `EnterWorktree` tool; it makes `.claude/worktrees/<name>` on a new branch from
`origin/main`) and works, commits and pushes only there. Never run `git switch`/`checkout`, `reset`, `rebase` or bare
`git stash` in the main folder: it belongs to the user and the IntelliJ dev servers. A session that only reads or
answers questions needs no worktree. Leave the worktree (`ExitWorktree`, removing it) once its pull request is merged.
- A new worktree has no `node_modules`: run `npm ci` in `frontend/` (and `infra/`) before using them there.
- The dev OpenAI key file (`.idea/runConfigurations/Backend.xml`, see below) exists only in the main folder.
- Worktrees don't share a build folder, but they share the machine: the heavy-run rule below still applies. A single
  e2e spec starts the e2e servers on fixed ports (:3210 and :8210); if another session's are already there, set
  `E2E_PORT`/`E2E_BACKEND_PORT` to other ports rather than reusing servers built from someone else's code.

If a required check has no tooling (marked above), say so in the report. Adding that tooling is a new dependency, so
ask first.

### Bug reports: reproduce in the browser first
When I report a bug, reproduce it in a real browser before reading code for a fix: watch the behaviour yourself
(log state on every frame if it's timing-related) so we agree on what the bug is. Only then look for the cause in code.
If it can't be reproduced, say so and ask instead of guessing. Pick the browser by what the bug depends on:
- **Playwright driving installed Chrome** (default for playback, timing and interaction bugs): a Node script with
  `chromium.launch({ channel: "chrome", headless: false, args: ["--autoplay-policy=no-user-gesture-required"] })`
  (require `playwright` from `frontend/node_modules`). Its tab is always visible, input is exact (hold a click for N ms,
  repeat a run 20 times), and the repro turns straight into an e2e test. It signs in as `test@lector.local`, so
  recreate the situation (import the video, open `?page=N` to resume partway) and delete what you create. Playwright's
  bundled Chromium never plays YouTube; in installed Chrome, YouTube's own play button works but our Play button may
  not start an unstarted video (autoplay policy for a fresh profile).
- **Claude in Chrome extension** (my own browser): when the bug may depend on my account, data, extensions or Chrome
  settings (e.g. Chrome's page translation breaking React), or when I want to watch. Its tab is hidden unless it's the
  selected tab in a visible window (`document.visibilityState`), and Chrome won't start media in a hidden tab
  (YouTube goes unstarted → buffering → unstarted, black frame). Raising the window from Windows doesn't help, since it
  can't select the tab: ask me to click the tab.

### Module boundaries
- `frontend` ↔ `backend` only over HTTP. Browser code calls the backend only through `lib/api.ts` (the BFF);
  server-only code uses `lib/server-api.ts`. Never call the backend URL from the browser or expose the JWT to it.
- Text is split into words only through `TokenizationService` (built-in for every language; it can call an external
  CJK tokenizer service at `TOKENIZER_URL`, which the project no longer has, and must keep working when that is down).
- Backend layering: controllers → services → repositories/entities. Controllers don't load texts from repositories
  directly (use `TextService.loadReadable`/`loadOwned`); no package depends on a controller.
- External services (dictionary APIs, OpenAI, YouTube) only through `DictionaryClient`, `AiClient` and `YouTubeClient`.

### AWS, GitHub and production
**Production:** https://d3pd9mue4v7won.cloudfront.net (the `SiteUrl` output of the `PolygossaStaging` stack: it was
built as staging and became production in October 2026; the stack keeps its name, since renaming a CloudFormation
stack rebuilds everything). No real users yet. Real sign-up and login, no auto-login. Test accounts made there use
`@example.com` addresses. **QA** is the local app; from phase 3 it signs in through a QA Cognito user pool in the same
AWS account, while its database stays in Docker. There is no cloud staging: treat every merge to main as a release.

Setup and decisions: [production plan](docs/production.md). AWS is our own AWS Organization: a management account
(administration and billing, owned by the user) and a member account for the app (production and the QA
resources). Claude works only in the member account, so organization-level changes (the region policy, which allows
`eu-west-1` plus the US regions AWS needs for global services and sign-in; new accounts; budgets) are the user's, in the
management account. The user still has to turn on root MFA and set a budget alert.

Tools on the dev machine (none of these are on PATH in every shell, so use the full paths):
- **AWS CLI** `C:\Program Files\Amazon\AWSCLIV2\aws.exe`, profile `polygossa` (the member account, default region
  `eu-west-1`). Sessions last 12 hours; when one expires, `aws login --profile polygossa` needs the user to sign in
  through the browser. The **AWS Agent Toolkit** gives Claude the MCP server `aws-mcp` (started with `uvx`, from **uv**
  in `~/.local/bin`) and AWS skills.
- **GitHub CLI** `C:\Program Files\GitHub CLI\gh.exe`, signed in as the repository owner (`Blk836/polygossa`, private).
  Read a failed CI run with `gh run view <id> --log-failed`; a job's log appears only once the job ends.
- **AWS CDK** comes with `infra/` (`npx cdk diff|deploy`); deploying needs Docker running (it builds the images).

When production misbehaves: the services' logs are in CloudWatch (log groups for the backend and frontend, kept a
month), the last deploy is the latest `deploy production` job in GitHub Actions, and the
stack's state is in CloudFormation. Production is deliberately small until the beta: uploads live in an S3 bucket
(`STORAGE_S3_BUCKET`; local runs and tests use the folder), AI is off (no OpenAI key), no Redis, a single-zone database.
- Infrastructure is changed only through CDK (`infra/`), never by CLI or console commands. The CLI and MCP server are
  for reading, investigating and previewing (`cdk diff`).
- Production deploys itself: CI's `deploy production` job runs `cdk deploy PolygossaStaging` on every merge to main (the
  pull request's checks are the gate; a temporary hand-started `deploy_only` run skips them),
  signed in through GitHub's OIDC as the `polygossa-github-deploy` role (its ARN is the repository variable
  `AWS_DEPLOY_ROLE_ARN`; `AWS_ACCOUNT_ID` lets CI's `cdk synth` run without AWS access). GitHub's OIDC subject names
  the repository with immutable IDs (`repo:Blk836@15254657/polygossa@1405831822`, set in `infra/cdk.json`): the role
  must trust that form, not `repo:Blk836/polygossa`. Deploy by hand only to bootstrap or to change the deploy role itself
  (`PolygossaGitHubDeploy`), and always `cdk diff` first. `infra/cdk.context.json` caches lookups so synth needs no AWS
  access: commit it.
- Before AWS work, check for a relevant AWS skill and prefer it over general knowledge; verify AWS details (limits,
  permissions, API parameters) against documentation instead of guessing.
- Everything holding user data lives in `eu-west-1`. `us-east-1` is only for global services (CloudFront and its
  certificates, WAF).
- Never read secret values into the conversation: reference Secrets Manager entries by name.

## Running it

The database is PostgreSQL in Docker everywhere, so **Docker Desktop must be running** (its CLI is in
`~/AppData/Local/Programs/DockerDesktop/resources/bin`, which a shell opened before it was installed lacks on PATH).
`bootRun` starts the dev database from `compose.dev.yml` (container `polygossa-dev-db` on :5432, data in the
`polygossa-dev-db` volume) and leaves it running; `docker compose -f compose.dev.yml up -d` starts it by hand.
Caching is in-memory.

In IntelliJ, run the shared **App** configuration (`.idea/runConfigurations/`): a compound of **Backend**
(Gradle `:backend:bootRun`) and **Frontend** (`npm run dev` in `frontend/`), each in its own Run tab; stop them there.
It also runs **Open browser** (`scripts/open-when-ready.ps1`), which opens http://localhost:3000 once both servers answer.
Or from a terminal:

```bash
./gradlew :backend:bootRun                 # API on :8080 (needs JDK 21+)
cd frontend && npm install && npm run dev  # web app on :3000
```

Gradle needs JDK 21+. The IntelliJ project SDK and Gradle JVM are the `openjdk-26` SDK (`~/.jdks/openjdk-26.0.1`).
`java` isn't on PATH on the dev machine, so from a terminal set `JAVA_HOME` to that JDK first.

**Claude managing the servers:** check what's listening before starting anything
(`Get-NetTCPConnection -State Listen -LocalPort 8080,3000`). If the servers are already up (e.g. the user's IntelliJ
run), reuse them. Otherwise start them with the commands above as background tasks, and stop them when done:
stopping the task leaves the Java/Node processes it launched running, so stop those too and check the ports are free.
Don't kill servers you didn't start without asking: they may be the user's IntelliJ run.
**Exception: duplicates.** If you see more than one frontend (`next dev`/`next start`) or more than one backend
(`bootRun`/the backend jar) running for this project, stop the extras: they overload the machine. Keep the one in use
(the IntelliJ run on :3000/:8080, if there is one) and stop the others, e.g. a leftover `next start` on another port.
The e2e suite's own servers (frontend on :3210, backend on :8210) are not duplicates while a Playwright run is using
them.

**Heavy runs:** the machine has 16 GB, and IntelliJ, the dev servers and other Claude sessions take a good share.
Whole suites (the backend suite's 4 JVMs, PIT, Stryker, the e2e suite) overloaded it and got killed, so they never run
locally (step 4): CI runs them. Even a single backend test class shouldn't run while another Gradle test run uses this
checkout: they share `backend/build/`, and result files vanish mid-run, failing tests that pass alone.

**Login is currently bypassed.** With no session, `frontend/proxy.ts` calls `POST /api/auth/dev-login` and signs in
as `test@lector.local` (Classroom plan, so every feature is unlocked) on every app page; `/`, `/login` and `/signup`
still show to signed-out visitors (so e2e tests can open them). To restore normal sign-up/login, set
`AUTO_LOGIN=false` (frontend) and `DEV_AUTO_LOGIN=false` (backend). The `prod` profile always disables the
endpoint — keep it that way.

Six starter texts (one per language you can learn; Japanese, Chinese and Korean are paused) are seeded into the community library for onboarding (`SEED_SAMPLES=false`
turns that off). No videos are seeded: videos come only from what is in the database.

**Filling Explore with videos (`tools/import-videos.mjs`):** when asked to find content, search YouTube for videos
actually *spoken* in the target language with captions in it (translated subtitles import fine but are the wrong
language), write them to a list file (`<url> [language] [category]` per line), and run the tool against a backend
started with `CURATOR_TOKEN` set. Use `--dry-run` first. Videos go into the community library: public, owned by the
library account, one copy each, same AI review as the Library form. Re-running a list is safe; feed
`<list>.retry.txt` back in for failures. Don't restart the user's IntelliJ backend to add the token, and never start a second
backend for it: ask the user to restart theirs with the token. Details: [tools/README.md](tools/README.md).
`ENFORCE_PLAN_LIMITS=false` turns off free-tier limits; plans can also be switched in **Settings**.

**Brand name:** the name people see (wordmark, page titles, starter-library owner, Anki exports, launcher windows) is
`BRAND_NAME`, default Polygossa, read by the backend (`config/Brand`), frontend (`lib/brand.ts`, inlined at build time
via `next.config.ts` — restart `npm run dev` after changing it). Never hard-code it: `app/branding.test.ts`
fails on any copy outside `lib/brand.ts`. Internal identifiers (package `app.lector`, `lector_*` cookies, the `lector`
database, `@lector.local` accounts, the Anki `lector` tag) are deliberately not tied to it.

Optional:
- **AI features** — set `OPENAI_API_KEY` (any OpenAI-compatible endpoint via `OPENAI_BASE_URL` / `OPENAI_MODEL`,
  embeddings via `OPENAI_EMBEDDING_MODEL`). With a key, a background job tags and embeds public texts for Explore's
  recommendations (`RECOMMEND_FEATURE_JOB=false` turns it off).
- **Forum admins** — `FORUM_ADMINS` (comma-separated emails) post announcements and moderate; in development the
  default is `test@lector.local`, in production nobody unless set.
- **Bulk video import** — set `CURATOR_TOKEN` to switch on the curator endpoints used by `tools/import-videos.mjs`
  (off when blank).
- **Docker** (PostgreSQL + Redis + everything): `cp .env.example .env` (set `JWT_SECRET`), then
  `docker compose up --build`. Uses the `prod` profile, so auto-login is off there.

## Tests

These are the whole suites CI runs. Locally, run one test class or file at a time, never these (step 4), e.g.
`./gradlew :backend:test --tests app.lector.ToursApiTest`, `npx vitest run lib/tours.test.ts`,
`npx playwright test e2e/feature-tours.spec.ts`.

```bash
./gradlew :backend:test                                           # unit + MockMvc integration tests (Docker needed)
cd frontend && npm test && npx tsc --noEmit && npx eslint . && npx next build
cd frontend && npm run e2e   # Playwright (first time: npx playwright install chromium); ~4.5 min. Runs against a production build on :3210
                             # (scripts/e2e-server.mjs: rebuilt only when sources change; a next dev on :3000 keeps running),
                             # starts its own backend on :8210 (JAVA_HOME needed) with no OpenAI key, so tests never call
                             # OpenAI, and its own PostgreSQL (bootTestRun: E2eApplication, a Testcontainers container
                             # removed when it stops); the IntelliJ run on :8080 and the dev database are untouched.
                             # E2E_BASE_URL=http://localhost:3000 points it at the dev server instead, for debugging.
                             # On CI it runs in 4 shards (--shard=N/4) on the runner's preinstalled Chrome (channel "chrome"
                             # when CI is set): installing Playwright's Chromium ran apt, whose mirror hung jobs.
node --test "tools/**/*.test.mjs"                                  # tools/
```

Backend tests don't hit the network. Dictionary lookups call freedictionaryapi.com / Wiktionary for real, so check
those against a running backend.

## Backend conventions and gotchas (Spring Boot 4 / Jackson 3)
- Jackson 3: `tools.jackson.databind.*` (`JsonNode.asString()`, not `asText()`), exceptions are unchecked.
  Annotations stay in `com.fasterxml.jackson.annotation`.
- Absent primitive JSON fields would fail under Jackson 3; `application.yml` sets `fail-on-null-for-primitives: false`.
- Starters are modular: `spring-boot-starter-webmvc`, and `spring-boot-starter-restclient` is needed for
  `RestClient.Builder`. Test annotations live in e.g. `org.springframework.boot.webmvc.test.autoconfigure`.
- `AppProperties` nested records need `@DefaultValue` or they bind as null when absent from YAML.
- Enums are lower-case in JSON (`@JsonValue`/`@JsonCreator`) and in query params (converters in `WebConfig`).
- Errors: throw `ApiException` (`notFound`, `badRequest`, `upgradeRequired` → 402, …); `GlobalExceptionHandler`
  maps them to `{code, message}`.
- Library items have one `Category` (fixed list; `other` also covers rows from before categories existed).
- Deadlines use the injected `Clock` bean, never `Instant.now()`, so tests can move time.
- Booting the app is most of a backend test run's cost, and Spring only reuses a booted app between classes with an
  identical setup. So API tests use a shared setup: `@ApiTest`, `@ClockApiTest` (movable `TestClock`, reset before
  each test) or `@YouTubeApiTest` (shared `YouTubeStub`; `reset()` it, never close it). Give a class its own
  `@SpringBootTest`, `@DynamicPropertySource`, `@MockitoBean` or `@TestConfiguration` only when it needs settings or
  beans the shared ones can't have, or when its results depend on everything in the database (the recommendation
  tests rank every public text, so other classes' texts on a shared database break them). Test classes run in
  parallel JVMs, so don't rely on run order.
- Tests run on PostgreSQL: `TestDatabases` (test classpath, `META-INF/spring.factories`) starts one Testcontainers
  PostgreSQL per test JVM and gives every booted app a new, empty database, overriding any configured URL. A class with
  its own `@SpringBootTest` names its database with `test.database=<name>` (that also keeps its setup distinct).
- AI: tests never call OpenAI; `OpenAiStub` (`writing/` test package) answers chat and `/embeddings` requests, including
  slow, failing and malformed replies. The recommendation feature job never runs on its schedule in tests
  (`src/test/resources/application.properties`); tests call `TextFeatureJob.runOnce()`. The dev OpenAI key lives only in
  the working copy of `.idea/runConfigurations/Backend.xml`, which git is told to ignore
  (`git update-index --skip-worktree`): never stage it.
- Plan gating goes through `PlanService` (`require(user, Feature)`, `checkCanImportText`, `checkCanSaveWord`).
- Text access: load via `TextService.loadReadable` / `loadOwned`, never the repository directly from controllers
  (owner, public, or assigned-to-a-class rules).
- **Every schema change is a Flyway migration**: a new `V<n>__<what it does>.sql` in
  `backend/src/main/resources/db/migration`, applied once per database at startup. Hibernate only validates
  (`ddl-auto: validate`), so an entity change without its migration fails startup and every backend test. Never edit
  a migration that has run anywhere (Flyway refuses the changed checksum): fix forward with a new one. A new value in
  an enum stored as text needs a migration updating that column's check constraint (`EnumColumnsMigratedTest`).
  Name constraints the way PostgreSQL does (`<table>_<column>_key`/`_check`); V2 made every database agree.
  `SchemaMigrationTest` boots the app on databases prepared in each state (`TestDatabases.newDatabase`).
- A text's content, tokens, timings and cues live in `TextBody` (`text_bodies`), loaded lazily through `Text`'s getters;
  `open-in-view` is off, so read or change them inside a transaction. Lists of cards (Library, Explore, playlists) must
  never touch the body — card stats come from `Text.wordsJson` via `UniqueWordsCache`; `CardListsTest` enforces it.
  Long transcripts made every list request read hundreds of MB before.

## Frontend conventions
- `frontend/` has its own `CLAUDE.md`/`AGENTS.md` (regenerated by `next dev`): **read the bundled docs in
  `frontend/node_modules/next/dist/docs/` before using Next APIs** — `proxy.ts` replaces middleware, `params` and
  `cookies()` are async, `PageProps<"/route">` / `RouteContext` are global types.
- Browser code calls the BFF with `api()` from `lib/api.ts` (paths without the `/api/` prefix). The JWT lives in the
  httpOnly `lector_token` cookie; `app/api/[...path]/route.ts` forwards to the backend. Server components use
  `backendJson()` from `lib/server-api.ts`.
- API response types are in `lib/types.ts`; keep them in sync with backend DTOs.
- Theme colours are CSS variables in `app/globals.css`, each `light-dark(light, dark)` (`bg-paper`, `text-muted`,
  `bg-accent` for actions, `text-rubric` for small brand highlights, `good`/`warn`/`bad` tones, word-status classes
  `.w-new/.w-learning/.w-known/.w-ignored` (LingQ-style: new blue, learning yellow, known/ignored plain), `.cover-<category>` text covers). Dark mode follows the OS unless Settings sets
  `<html data-theme>` (cookie `lector_theme`). Never use Tailwind's `dark:` variant or raw palette colours — a test
  (`app/theme-palette.test.ts`) enforces that and WCAG AA contrast for every text/background token pair.
- Lists follow the language picked in the top bar (`me.targetLanguage`): pass it with `withLanguage()` and key the page
  body by it so filters reset when it changes.
- Library and Explore share a card layout (cards / compact / list) from `useCardLayout()`, kept in the
  `lector_card_layout` cookie like the theme; lay item grids out with `cardGridClass(layout)` and pass `layout` to
  `TextCard` (`lib/card-layout.ts`).
- E2E tests run as `test@lector.local` (auto-login) against the e2e backend's own database, which starts with only the
  seeded starter texts: create any data a test needs through `page.request` and delete it afterwards, never rely on
  what is already there. Other tests' data in that database shows up too (they run in parallel),
  so scroll an element into view before measuring it rather than assuming where it sits. Never hard-code the port:
  use `test.info().project.use.baseURL` for cookies and extra browser contexts. The suite runs on Playwright's default
  3 workers: it is CPU-bound on the 6-core dev machine (IntelliJ alone was using about 2 cores), and 4–5 workers were no
  faster and made timing-sensitive tests flaky. It went from 12 to 4.5 minutes by testing a production build instead
  of next dev, and by fixing what the backend profile (JFR) showed: per-row projection proxies, a per-cue transcript
  scan, and YouTube downloads repeated for every video import.
- That test account normally has **no target language** and no interests. Never change them in a test: `PATCH /api/me`
  can't clear the language again (null means no change) and other specs rely on it being unset. Stub those requests
  in the browser instead (`page.route`, as in `e2e/progress-levels.spec.ts`).
- The React lint rules forbid setting state synchronously in effects and calling `Date.now()` during render: fetch
  inside the effect with `.then` and a `cancelled` flag, as in the existing pages.

## Known limitations
- Hosting is AWS, not the plan's original targets (Vercel, Railway/Render, Supabase): production is live,
  sized small, with no real users yet (see "AWS, GitHub and production" and the [production plan](docs/production.md)).
  `docker-compose.yml` still runs everything locally.
- Japanese, Chinese and Korean are split by simple built-in rules (Chinese per character), with no readings or
  dictionary forms: the Python tokenizer sidecar was removed unused.
- YouTube captions come from YouTube's unofficial innertube player endpoint (there is no keyless official API), so
  automatic caption import can break when YouTube changes it; imports then return 422 and ask for a subtitle file or
  pasted transcript. Backend tests use a local stub (`YouTubeStub`), never the real site.
- Billing is simulated: `POST /api/me/plan` switches plans directly (where a Stripe webhook would plug in).
