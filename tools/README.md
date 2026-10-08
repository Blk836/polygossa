# tools/

Command-line tools for the team, not part of the app. Plain Node (no packages of their own).

`ci-checks.mjs` is CI's, not the team's: it decides which checks a pull request needs from the files it changes
(`.github/workflows/ci.yml`, `docs/acceptance/ci.feature`).

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

**Caveat when picking videos:** a line's language picks the caption track, not the audio. A video with *translated*
subtitles in that language is imported as that language. For example, an English song with fan-made German
subtitles comes in as German. Check that the video is actually spoken in the language you list.

Tests: `node --test "tools/**/*.test.mjs"`. Mutation testing uses the frontend's Stryker:
`frontend/node_modules/.bin/stryker run tools/stryker.config.mjs`, run from the repo root (in Git Bash, append
`/c/Windows/System32` to `PATH` first, as for `npm run mutate`).
