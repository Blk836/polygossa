import { spawn as nodeSpawn } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const FORMAT = "249/250/wa[ext=webm]/wa";
const MISSING = "yt-dlp not found: install it (winget install yt-dlp.yt-dlp) or pass --yt-dlp <path>";

export function makeDownloader({ ytDlp = "yt-dlp", cookies, cookiesFromBrowser, spawn = nodeSpawn, tmp = tmpdir() }) {
  const signIn = cookies ? ["--cookies", cookies] : cookiesFromBrowser ? ["--cookies-from-browser", cookiesFromBrowser] : [];
  const common = ["--quiet", "--no-warnings", "--no-playlist", "--js-runtimes", `node:${process.execPath}`, ...signIn];

  async function download(url) {
    const dir = mkdtempSync(join(tmp, "polygossa-audio-"));
    try {
      const { failure } = await run(spawn, ytDlp, [...common, "-f", FORMAT, "-o", join(dir, "audio.%(ext)s"), url]);
      if (failure) {
        return { error: failure };
      }
      const file = readdirSync(dir).find((name) => name.startsWith("audio."));
      return file ? { bytes: readFileSync(join(dir, file)), filename: file } : { error: "yt-dlp saved no audio" };
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  download.duration = async (url) => {
    const { failure, stdout } = await run(spawn, ytDlp, [...common, "--skip-download", "--print", "duration", url]);
    const seconds = Math.round(Number(stdout.trim()));
    return failure || !(seconds > 0) ? null : seconds;
  };

  return download;
}

function run(spawn, command, args) {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => resolve({ failure: error.code === "ENOENT" ? MISSING : error.message, stdout }));
    child.on("close", (code) => resolve({ failure: code === 0 ? null : lastLine(stderr) || `yt-dlp exited with ${code}`, stdout }));
  });
}

function lastLine(text) {
  return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).at(-1) ?? "";
}
