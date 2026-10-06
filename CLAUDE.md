# Polygossa — language learning reader

A web app for learning languages by reading authentic content: import texts, click words for definitions, build a
personal vocabulary, review it with spaced repetition, and watch your known-word count grow.

Docs:
- [Architecture](docs/architecture/README.md): **read this first in a new session.** The high-level map: what each
  product area does for learners and roughly how it is built, plus the product decisions taken.
- [Product plan](docs/plan.md): the original vision. [Roadmap](docs/roadmap.md): designed but not built yet.
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
tokenizer/  FastAPI sidecar — Japanese (MeCab), Chinese (jieba), Korean (KoNLPy) tokenization
tools/      team command-line tools (plain Node, no packages): import-videos.mjs bulk-imports curated YouTube videos
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
4. Before claiming done, run and show the actual output of:
   - full test suite: `./gradlew :backend:test` (backend); `cd frontend && npm test` (Vitest, pure modules only);
     `cd frontend && npm run e2e` (Playwright, `e2e/*.spec.ts`, real Chromium against the running app — any UI change
     needs a scenario here, since there are no component tests); `cd tokenizer && pytest` (sidecar);
     `node --test "tools/**/*.test.mjs"` (tools).
   - mutation testing on changed files: `./gradlew :backend:pitest -Ppitest.since=<commit>` (PIT on just the main
     classes changed since that commit, e.g. the one before the task's first commit; `-Ppitest.targets=app.lector.text.*`
     names them directly, and no property mutates everything), `cd frontend && npm run mutate` (Stryker; the modules it
     covers are listed in `stryker.config.mjs`; incremental: it reuses the last run's results for unchanged code and
     tests and still reports the whole score; `npm run mutate -- --force` re-runs everything, and resets a score that
     looks too low: a reused result can go stale after a test file broke and was fixed, which only lowers the score), `frontend/node_modules/.bin/stryker run tools/stryker.config.mjs` from the repo root
     (tools/), `cd tokenizer && mutmut run` (configured in `pyproject.toml`, **never run here** —
     Python isn't installed, and mutmut 3 needs Linux/macOS/WSL). In Git Bash, append `/c/Windows/System32` to `PATH`
     (`PATH="$PATH:/c/Windows/System32"`; prepending makes `bash` resolve to WSL) before `npm run mutate`, or Stryker crashes at exit looking for `taskkill` and leaves `.stryker-tmp` behind.
   - lint + type check: `cd frontend && npx tsc --noEmit && npx eslint .`; for Java, `./gradlew :backend:compileJava`
     (javac is the type check); `cd tokenizer && ruff check .` (never run here).
   - complexity check: no function over cyclomatic complexity 10, no file over 300 lines. Enforced by
     `./gradlew :backend:checkstyleMain` (backend), ESLint `complexity`/`max-lines` (frontend; for tools/, from the repo root:
     `frontend/node_modules/.bin/eslint --no-config-lookup --rule '{"complexity":["error",10],"max-lines":["error",300]}' "tools/**/*.mjs"`), and ruff `C90`
     (tokenizer; ruff has no file-length rule).
5. Respect module boundaries (see below). Do not add new dependencies without asking.
6. End with a short report: what changed, every check you ran with its result,
   surviving mutants (and why they're acceptable, if any), and anything you're
   unsure about. "Should work" is not an acceptable status.
7. Commit each incremental change to git as you go (e.g. scenarios, failing tests, implementation, a fix): one
   focused commit per step with a message saying what changed and why. Small commits make it easy to diff changes
   over time and bisect to the commit that broke something. Don't batch unrelated work into one commit, and list the
   commits in the final report.

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
- `backend` → `tokenizer` only through `TokenizationService`, and it must keep working when the sidecar is down.
- Backend layering: controllers → services → repositories/entities. Controllers don't load texts from repositories
  directly (use `TextService.loadReadable`/`loadOwned`); no package depends on a controller.
- External services (dictionary APIs, OpenAI, YouTube) only through `DictionaryClient`, `AiClient` and `YouTubeClient`.

## Running it

The backend defaults to a file-based H2 database and in-memory caching, and falls back to built-in CJK segmentation
when the tokenizer sidecar isn't running, so no external services are needed.

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

**Heavy runs:** the machine has 16 GB, and IntelliJ plus the dev servers take a good share. The backend suite (4 JVMs)
and PIT (4 workers, each booting apps) each need several GB, so run them one at a time, and never while another
Gradle test/pitest run (another session's, say) uses this checkout: they share `backend/build/`, and result files
vanish mid-run, failing tests that pass alone.

**Login is currently bypassed.** With no session, `frontend/proxy.ts` calls `POST /api/auth/dev-login` and signs in
as `test@lector.local` (Classroom plan, so every feature is unlocked). To restore normal sign-up/login, set
`AUTO_LOGIN=false` (frontend) and `DEV_AUTO_LOGIN=false` (backend). The `prod` profile always disables the
endpoint — keep it that way.

Eight starter texts (one per language) are seeded into the community library for onboarding (`SEED_SAMPLES=false`
turns that off). No videos are seeded: videos come only from what is in the database.

**Filling Explore with videos (`tools/import-videos.mjs`):** when asked to find content, search YouTube for videos
actually *spoken* in the target language with captions in it (translated subtitles import fine but are the wrong
language), write them to a list file (`<url> [language] [category]` per line), and run the tool against a backend
started with `CURATOR_TOKEN` set. Use `--dry-run` first. Videos go into the community library: public, owned by the
library account, one copy each, same AI review as the Library form. Re-running a list is safe; feed
`<list>.retry.txt` back in for failures. Don't restart the user's IntelliJ backend to add the token: ask, or start a
second one. Details: [tools/README.md](tools/README.md).
`ENFORCE_PLAN_LIMITS=false` turns off free-tier limits; plans can also be switched in **Settings**.

**Brand name:** the name people see (wordmark, page titles, starter-library owner, Anki exports, launcher windows) is
`BRAND_NAME`, default Polygossa, read by the backend (`config/Brand`), frontend (`lib/brand.ts`, inlined at build time
via `next.config.ts` — restart `npm run dev` after changing it) and tokenizer. Never hard-code it: `app/branding.test.ts`
fails on any copy outside `lib/brand.ts`. Internal identifiers (package `app.lector`, `lector_*` cookies, the H2 file,
`@lector.local` accounts, the Anki `lector` tag) are deliberately not tied to it.

Optional:
- **Tokenizer sidecar** — `cd tokenizer && pip install -r requirements.txt && uvicorn app.main:app --port 8000`,
  then start the backend with `TOKENIZER_URL=http://localhost:8000`. KoNLPy needs a Java runtime.
- **AI features** — set `OPENAI_API_KEY` (any OpenAI-compatible endpoint via `OPENAI_BASE_URL` / `OPENAI_MODEL`,
  embeddings via `OPENAI_EMBEDDING_MODEL`). With a key, a background job tags and embeds public texts for Explore's
  recommendations (`RECOMMEND_FEATURE_JOB=false` turns it off).
- **Bulk video import** — set `CURATOR_TOKEN` to switch on the curator endpoints used by `tools/import-videos.mjs`
  (off when blank).
- **Docker** (PostgreSQL + Redis + everything): `cp .env.example .env` (set `JWT_SECRET`), then
  `docker compose up --build`. Uses the `prod` profile, so auto-login is off there.

## Tests

```bash
./gradlew :backend:test                                           # unit + MockMvc integration tests
cd frontend && npm test && npx tsc --noEmit && npx eslint . && npx next build
cd frontend && npm run e2e   # Playwright (first time: npx playwright install chromium); reuses servers on :3000/:8080 (e.g. the IntelliJ App run) or starts them (JAVA_HOME needed)
cd tokenizer && pip install -r requirements-dev.txt && pytest      # Python not installed on the dev machine
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
- AI: tests never call OpenAI; `OpenAiStub` (`writing/` test package) answers chat and `/embeddings` requests, including
  slow, failing and malformed replies. The recommendation feature job never runs on its schedule in tests
  (`src/test/resources/application.properties`); tests call `TextFeatureJob.runOnce()`. The dev OpenAI key lives only in
  the working copy of `.idea/runConfigurations/Backend.xml`, which git is told to ignore
  (`git update-index --skip-worktree`): never stage it.
- Plan gating goes through `PlanService` (`require(user, Feature)`, `checkCanImportText`, `checkCanSaveWord`).
- Text access: load via `TextService.loadReadable` / `loadOwned`, never the repository directly from controllers
  (owner, public, or assigned-to-a-class rules).
- Schema is Hibernate `ddl-auto: update` (no migrations yet), except `TextBodyMigration`, which moved texts' bulky
  columns out of `texts` at startup (ddl-auto can't move data or drop columns).
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
- E2E tests run as `test@lector.local` (auto-login) against the dev database: create any data a test needs through
  `page.request` and delete it afterwards. Other data in that database shows up too (e.g. imported public playlists),
  so scroll an element into view before measuring it rather than assuming where it sits. The suite runs on Playwright's
  default 3 workers: the single dev server is the bottleneck, and 4 workers were slower and flakier.
- That test account normally has **no target language** and no interests. Never change them in a test: `PATCH /api/me`
  can't clear the language again (null means no change) and other specs rely on it being unset. Stub those requests
  in the browser instead (`page.route`, as in `e2e/progress-levels.spec.ts`).
- The React lint rules forbid setting state synchronously in effects and calling `Date.now()` during render: fetch
  inside the effect with `.then` and a `cancelled` flag, as in the existing pages.

## Known limitations
- Hosting targets in the plan (Vercel, Railway/Render, Supabase) aren't configured; Dockerfiles and
  `docker-compose.yml` are provided instead.
- The tokenizer sidecar was written but never run here; its tests skip analyzers that aren't installed.
- Schema migrations rely on Hibernate `ddl-auto: update`; switch to Flyway before production data matters.
- YouTube captions come from YouTube's unofficial innertube player endpoint (there is no keyless official API), so
  automatic caption import can break when YouTube changes it; imports then return 422 and ask for a subtitle file or
  pasted transcript. Backend tests use a local stub (`YouTubeStub`), never the real site.
- Billing is simulated: `POST /api/me/plan` switches plans directly (where a Stripe webhook would plug in).
