# tools/

Command-line tools for the team, not part of the app. Plain Node (no packages of their own).

`ci-checks.mjs` is CI's, not the team's: it decides which checks a pull request needs from the files it changes
(`.github/workflows/ci.yml`, `docs/acceptance/ci.feature`). `local-checks.mjs` uses the same rules.

## local-checks.mjs: the suites on this PC, one run at a time

Runs the checks a branch needs on the developer's PC instead of GitHub (`docs/acceptance/local-checks.feature`) and
marks the commit on GitHub with a green or red "local checks" status. Run it from a worktree with everything
committed and pushed:

```bash
node tools/local-checks.mjs                  # the suites this branch's changes need, compared with origin/main
node tools/local-checks.mjs --all            # every suite
node tools/local-checks.mjs --run -- <cmd>   # one heavy command (a test class, a spec, mutation testing) in its turn
```

Only one run holds the PC at a time, across every worktree: the lock file is `polygossa-checks.lock` in the main
checkout's `.git` folder and names its holder, so a waiting run says whom it waits for. A lock whose process has died is
taken over. Backend and end-to-end runs need `JAVA_HOME`; missing or outdated `node_modules` are installed with
`npm ci` first; infra's synth gets the AWS account from the `AWS_ACCOUNT_ID` repository variable (or
`CDK_DEFAULT_ACCOUNT`). `GH` overrides where the GitHub CLI is. The images suite (production's Docker images, run
when a Dockerfile, ignore file or dependency manifest changes) needs Docker Desktop running.

## stripe-setup.mjs: the prices and the webhook in Stripe

Sets up a Stripe account for the app (`docs/acceptance/stripe-billing.feature`): the three prices (€8 a month and €60
a year for Pro, €4 per student a month for Classroom, VAT included), found by their lookup keys, and the webhook for
subscription events at production's address. It reads the secret key from Secrets Manager
(`polygossa/stripe-secret-key`) and saves the webhook's signing secret there (`polygossa/stripe-webhook-secret`);
neither is printed. Safe to run again: prices already there are kept, and the webhook is replaced (Stripe shows a
signing secret only once). Needs the AWS CLI signed in to the app's account.

```bash
node tools/stripe-setup.mjs                      # test mode, production's address
node tools/stripe-setup.mjs --site https://…     # another address
node tools/stripe-setup.mjs --live               # only with a live key, on purpose
```

## local-deploy.mjs: deploy main to production from this PC

Run it when production should get the latest main (`docs/acceptance/local-deploy.feature`). Merges are not deployed by
default ("cheap" mode, to save costs), and GitHub no longer deploys on merge.

```bash
node tools/local-deploy.mjs           # deploy the latest main on GitHub, unless it is already live
node tools/local-deploy.mjs --again   # deploy it even so (say, to retry after AWS had a problem)
```

It deploys from the PC's own checkout of main (`polygossa-deploy` in the main checkout's `.git` folder), so no
session's worktree changes, and takes the same turn as the local checks. It needs Docker Desktop running and the
`polygossa` AWS profile signed in (`aws login --profile polygossa`, 12 hours), and refuses if that profile is another
account than the `AWS_ACCOUNT_ID` repository variable. It runs `cdk deploy PolygossaStaging PolygossaQa`, then checks
the sign-in page and the languages list through the site, and marks main's commit "deploy production" on GitHub
(pending, then green or red); a green mark is how it knows main is already live. `AWS_CLI` and `GH` override where the
AWS and GitHub CLIs are.

**Pausing production** (`docs/acceptance/pause-production.feature`): merge `"paused": true` in `infra/cdk.json` and
deploy. The site becomes a coming-soon page, checked instead of the sign-in page. The database leaves a final snapshot:
find its name with `aws rds describe-db-snapshots --profile polygossa --snapshot-type manual`. To unpause, set
`"paused": false` and `"database-snapshot"` to that name, deploy, and leave the setting in place afterwards. The tool
refuses an unpause with no new snapshot named, and a changed snapshot under a running database, before touching
anything.

## import-videos.mjs: bulk-import curated YouTube videos

Fills Explore (and so the recommendations) with videos found across YouTube. Each video is imported into the
**community library**: owned by the library account that also owns the starter texts, shared publicly, with no plan
limits. Apart from that it's the same import as the Library form: captions, levelling, word timings, the AI category
and the AI check that it's fine to share.

```bash
# 1. Start the backend with a curator token (blank = the curator endpoints are switched off and answer 404)
CURATOR_TOKEN=some-long-secret ./gradlew :backend:bootRun

# 2. Run the tool with the same token
CURATOR_TOKEN=some-long-secret node tools/import-videos.mjs videos.txt
node tools/import-videos.mjs videos.txt --language es --dry-run   # check a list without importing
```

The list file holds one video per line: `<YouTube URL> [language] [category]`. `#` starts a comment.
Any URL form works (watch, youtu.be, shorts, embed, live). Languages and categories are the app's codes (`fr`,
`daily-life`, …). With no category, the AI picks one, or YouTube's own category is used when AI isn't configured.

```
# French, beginner
https://www.youtube.com/watch?v=AqxY-gvgiqM fr
https://youtu.be/XXXXXXXXXXX fr learners
```

Options: `--language` (for lines without one), `--dry-run`, `--delay <seconds>` (default 2),
`--backend <url>` (default `$BACKEND_URL` or http://localhost:8080) and `--token` (default `$CURATOR_TOKEN`).

**What happens to each line** (printed as it goes, then a summary):

| Outcome | Meaning |
|---|---|
| imported | Now in the community library. |
| already imported | The library already has this video, so nothing was changed and YouTube wasn't asked. Re-running a list is safe. |
| skipped | No captions in that language. |
| refused | The AI found it inappropriate to share (the reason is shown). |
| failed | YouTube doesn't have it, the AI review didn't answer, or some other error. |
| invalid | The line can't be read (bad URL, unknown language or category). The backend isn't asked. |
| not run | The run stopped before this line. |

The run stops early only when the token is rejected or the backend can't be reached (exit code 1). It writes two
files next to the list: `<list>.results.txt` has every line with its outcome as a comment, and `<list>.retry.txt` has
the skipped, failed and not-run lines. Both are list files, so they can be fed straight back in.

**Copy mode: from one backend to another** (`docs/acceptance/copy-videos.feature`). `--copy-from <url>` copies videos
already imported on another backend (say, local) instead of asking YouTube, which often blocks cloud servers. For
each line the tool reads the video's finished transcript, captions, title, category and length from the source (any
owner's copy there, a public one first, then the newest) and sends it to the target (`--backend`), which saves it in
its community library. The target works out words, level and timings itself and still runs the AI sharing check.
The source's token is `--from-token` (default `$SOURCE_CURATOR_TOKEN`). Outcomes read "copied" / "would copy"; a
video the source doesn't have in that language is "skipped". Messages that stop the run start with "source:" or
"target:".

Production has a curator token too: CDK generates it as the Secrets Manager entry `polygossa/curator-token`, and
the tool reaches production's backend through the website (`--backend https://<site>`). Pass it straight from the
AWS CLI so it is never shown:

```bash
SOURCE_CURATOR_TOKEN=local-secret \
CURATOR_TOKEN="$(aws secretsmanager get-secret-value --profile polygossa --secret-id polygossa/curator-token --query SecretString --output text)" \
node tools/import-videos.mjs list.txt --copy-from http://localhost:8080 --backend https://polygossa.com --dry-run
```

**Playlist mode** (`docs/acceptance/copy-playlist.feature`). `--playlist "<title>"` (with an optional
`--description`) imports nothing: it puts the list's videos, already in the community library, into a public playlist
owned by the library account, in list order. Running it again with the same title and language updates that playlist
(description, videos, order) instead of making a second one, and people who saved it keep it. Videos the library
doesn't have in the playlist's language are left out and listed with their lines; a list mixing languages is refused.
`--dry-run` says whether it would create or update the playlist. It doesn't go with `--copy-from`: copy the videos
first, then make the playlist.

**Transcribe mode: captions from the audio** (`docs/acceptance/transcribe-videos.feature`). `--transcribe` gives
videos with no captions in their language a word-timed transcript from OpenAI Whisper. It needs the local backend
started with `CURATOR_TOKEN` and `OPENAI_API_KEY`, and [yt-dlp](https://github.com/yt-dlp/yt-dlp)
(`winget install yt-dlp.yt-dlp`). For each line the tool first asks the backend for a quote. A video with captions is
imported from them as usual. One without captions has its audio downloaded on this PC by yt-dlp (small Opus audio,
about 0.4 MB a minute) and sent to the backend, which has Whisper transcribe it. The backend never downloads from
YouTube itself. Afterwards, `--copy-from` takes the finished video to production like any other.

YouTube now asks yt-dlp to sign in, so pass a browser that's signed in to YouTube: `--cookies-from-browser firefox`.
Chrome's and Edge's sign-ins can't be read on Windows; a `cookies.txt` export (`--cookies <file>`) works instead.
The downloads are made as that Google account, so keep the volume modest.

Whisper costs about $0.006 a minute. The backend refuses, before anything is downloaded or spent, a video over
`TRANSCRIPTION_MAX_MINUTES` (default 30), one whose length YouTube doesn't give, and any that would take total
transcription spending past `TRANSCRIPTION_BUDGET_USD` (default $10, counted from every Whisper call ever made on that
backend's database). Run `--dry-run` first: it lists each video's length and cost, and the total.

```bash
CURATOR_TOKEN=some-long-secret node tools/import-videos.mjs list.txt --transcribe --cookies-from-browser firefox --dry-run
CURATOR_TOKEN=some-long-secret node tools/import-videos.mjs list.txt --transcribe --cookies-from-browser firefox
```

New outcomes: **transcribed** (in the library with Whisper's transcript) and **would transcribe** (dry run, with
length and cost). Skipped now also covers too long, unknown length, over budget, no speech found and speech in another
language; failed covers a failed download (the yt-dlp error is shown) or Whisper not answering. The run stops if the
backend has no OpenAI key. `--transcribe` doesn't go with `--copy-from` or `--playlist`.

**Caveat when picking videos:** a line's language picks the caption track, not the audio. A video with *translated*
subtitles in that language is imported as that language. For example, an English song with fan-made German
subtitles comes in as German. Check that the video is actually spoken in the language you list.

Tests: `node --test "tools/**/*.test.mjs"`. Mutation testing uses the frontend's Stryker:
`frontend/node_modules/.bin/stryker run tools/stryker.config.mjs`, run from the repo root (in Git Bash, append
`/c/Windows/System32` to `PATH` first, as for `npm run mutate`).

## check-aws-signin.mjs: the AWS sign-in before the local backend starts

IntelliJ's Backend run configuration runs it first ("Check AWS sign-in", `docs/acceptance/aws-signin-before-launch.feature`):
when the `polygossa` profile isn't signed in, it opens the AWS sign-in in the browser and lets the backend start once
it succeeds. To add the step to your own Backend run configuration (git doesn't track that file's changes): Edit
Configurations → Backend → Before launch → + → Run Another Configuration → Check AWS sign-in.

```bash
node tools/check-aws-signin.mjs
```
