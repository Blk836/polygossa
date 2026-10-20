export function makeTranscriber({ client, download, duration = download.duration }) {
  async function quoted(entry) {
    const quote = await client.quoteTranscription(entry);
    if (quote.outcome !== "unknown_length" || !duration) {
      return { quote };
    }
    const seconds = await duration(entry.url);
    return seconds ? { quote: await client.quoteTranscription(entry, seconds), seconds } : { quote };
  }

  return {
    async importVideo(entry, dryRun) {
      const { quote, seconds } = await quoted(entry);
      if (quote.outcome === "has_captions") {
        return client.importVideo(entry, dryRun);
      }
      if (quote.outcome === "already_imported") {
        return { outcome: "already imported", reason: "", title: quote.title ?? "" };
      }
      if (quote.outcome !== "would_transcribe") {
        return { outcome: quote.outcome === "failed" ? "failed" : "skipped", reason: quote.message ?? quote.outcome, title: "" };
      }
      const cost = { seconds: quote.durationSeconds, costUsd: quote.costUsd };
      if (dryRun) {
        return { outcome: "would transcribe", reason: `${clock(cost.seconds)}, about ${money(cost.costUsd)}`, title: "", ...cost };
      }
      const audio = await download(entry.url);
      if (audio.error) {
        return { outcome: "failed", reason: `audio download failed: ${audio.error}`, title: "" };
      }
      return { ...(await client.transcribe(entry, audio, seconds)), ...cost };
    },
  };
}

export function money(usd) {
  return `$${(Math.round(usd * 100 + 1e-6) / 100).toFixed(2)}`;
}

function clock(seconds) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
