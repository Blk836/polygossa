const RENAMED = { imported: "copied", "would import": "would copy" };

export function makeCopier({ source, target }) {
  return {
    async importVideo(entry, dryRun) {
      const exported = await source.exportVideo(entry);
      if (exported.missing !== undefined) {
        return { outcome: "skipped", reason: `not on the source: ${exported.missing}`, title: "" };
      }
      if (exported.failed !== undefined) {
        return { outcome: "failed", reason: `source: ${exported.failed}`, title: "" };
      }
      const result = await target.copyVideo(exported.video, dryRun);
      return { ...result, outcome: RENAMED[result.outcome] ?? result.outcome };
    },
  };
}
