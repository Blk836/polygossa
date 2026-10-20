import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makeDownloader } from "./audio.mjs";

const URL = "https://youtu.be/AAAAAAAAAAA";

function fakeSpawn(behave) {
  const calls = [];
  const spawn = (command, args) => {
    calls.push({ command, args });
    const child = new EventEmitter();
    child.stderr = new EventEmitter();
    queueMicrotask(() => behave(child, args));
    return child;
  };
  return { spawn, calls };
}

function outputDir(args) {
  return args[args.indexOf("-o") + 1].replace(/[\\/]audio\.%\(ext\)s$/, "");
}

test("yt-dlp downloads small Opus audio with the browser sign-in, and the file comes back", async () => {
  let dir;
  const { spawn, calls } = fakeSpawn((child, args) => {
    dir = outputDir(args);
    writeFileSync(join(dir, "audio.webm"), "opus-bytes");
    child.emit("close", 0);
  });
  const download = makeDownloader({ ytDlp: "yt-dlp", cookiesFromBrowser: "firefox", spawn, tmp: tmpdir() });
  const audio = await download(URL);
  assert.equal(audio.filename, "audio.webm");
  assert.equal(audio.bytes.toString(), "opus-bytes");
  const { command, args } = calls[0];
  assert.equal(command, "yt-dlp");
  assert.equal(args.at(-1), URL);
  assert.equal(args[args.indexOf("-f") + 1], "249/250/wa[ext=webm]/wa");
  assert.equal(args[args.indexOf("--cookies-from-browser") + 1], "firefox");
  assert.match(args[args.indexOf("--js-runtimes") + 1], /^node:/);
  assert.ok(args.includes("--no-playlist"));
  assert.equal(existsSync(dir), false);
});

test("a cookies file is passed instead when given", async () => {
  const { spawn, calls } = fakeSpawn((child, args) => {
    writeFileSync(join(outputDir(args), "audio.m4a"), "x");
    child.emit("close", 0);
  });
  const cookies = join(mkdtempSync(join(tmpdir(), "cookies-")), "youtube.txt");
  await makeDownloader({ ytDlp: "yt-dlp", cookies, spawn, tmp: tmpdir() })(URL);
  assert.equal(calls[0].args[calls[0].args.indexOf("--cookies") + 1], cookies);
  assert.equal(calls[0].args.includes("--cookies-from-browser"), false);
});

test("yt-dlp failing gives its last error line", async () => {
  const { spawn } = fakeSpawn((child) => {
    child.stderr.emit("data", Buffer.from("WARNING: something\nERROR: [youtube] AAAAAAAAAAA: Private video\n"));
    child.emit("close", 1);
  });
  assert.deepEqual(await makeDownloader({ ytDlp: "yt-dlp", spawn, tmp: tmpdir() })(URL),
    { error: "ERROR: [youtube] AAAAAAAAAAA: Private video" });
});

test("yt-dlp missing says how to install it", async () => {
  const { spawn } = fakeSpawn((child) => child.emit("error", Object.assign(new Error("spawn"), { code: "ENOENT" })));
  const result = await makeDownloader({ ytDlp: "yt-dlp", spawn, tmp: tmpdir() })(URL);
  assert.match(result.error, /yt-dlp not found/);
  assert.match(result.error, /winget install yt-dlp\.yt-dlp/);
});

test("yt-dlp finishing without a file is an error", async () => {
  const { spawn } = fakeSpawn((child) => child.emit("close", 0));
  assert.deepEqual(await makeDownloader({ ytDlp: "yt-dlp", spawn, tmp: tmpdir() })(URL),
    { error: "yt-dlp saved no audio" });
});
