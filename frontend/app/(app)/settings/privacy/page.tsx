import type { Metadata } from "next";
import { DeleteAccountSection } from "@/components/settings/delete-account-section";
import { buttonClass } from "@/components/ui";

export const metadata: Metadata = { title: "Privacy" };

/** Settings' Privacy tab (gdpr.feature): a copy of all the account's data, and deleting the account. */
export default function PrivacyPage() {
  return (
    <div className="space-y-6">
      <div role="group" aria-label="Your data" className="rounded-xl border border-line bg-card p-5">
        <h2 className="font-semibold">Your data</h2>
        <p className="mt-0.5 text-sm text-muted">
          A copy of everything stored about your account (profile, texts, words, reviews, progress, writing, playlists,
          classes and forum posts) as one JSON file.
        </p>
        <div className="mt-3">
          {/* A plain link: the file comes straight from the server as a download. */}
          <a href="/api/me/export" download className={buttonClass("secondary")}>Download my data</a>
        </div>
      </div>
      <DeleteAccountSection />
    </div>
  );
}
