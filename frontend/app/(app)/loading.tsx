// Shown the moment a tab is clicked, while the page comes from the server (docs/acceptance/instant-tabs.feature).
// Having this file is also what lets Next.js prefetch the app's pages, so a click switches at once.
export default function Loading() {
  return (
    <div data-testid="page-loading" aria-busy="true" aria-label="Loading page" className="motion-safe:animate-pulse">
      <div className="mb-6 space-y-2">
        <div className="h-7 w-48 rounded-md bg-line" />
        <div className="h-4 w-72 max-w-full rounded-md bg-line/60" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-40 rounded-xl border border-line bg-card" />
        ))}
      </div>
    </div>
  );
}
