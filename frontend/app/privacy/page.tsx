import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal-page";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = { title: "Privacy policy" };

export default function PrivacyPolicyPage() {
  return (
    <LegalPage title="Privacy policy" updated="October 2026">
      <p>
        {BRAND} is a language-learning reader. This policy explains what we keep about you, why, who helps us run the
        service, and how to see, take or delete your data. The service is run by [company name, address], the data
        controller. Questions: [contact email].
      </p>

      <h2>What we keep</h2>
      <ul>
        <li><strong>Your account:</strong> email address, display name, profile photo if you add one, the languages
          you learn and speak, your goals, time zone and settings.</li>
        <li><strong>What you do in the app:</strong> texts and audio you import, words and phrases you save with your
          notes, reviews, reading and listening progress, writing you submit, playlists, classes, forum posts, and
          likes.</li>
        <li><strong>Signing in:</strong> your sign-in is handled by AWS Cognito, which keeps your email and a secure
          hash of your password (we never see the password), or your Google identity if you sign in with Google.</li>
        <li><strong>Technical logs:</strong> server logs with request details, kept for one month to keep the service
          running and secure.</li>
      </ul>

      <h2>Why (legal basis)</h2>
      <ul>
        <li>To provide the service you signed up for (performance of a contract): your account and everything you
          create in it.</li>
        <li>To keep the service secure and working (legitimate interest): logs, abuse prevention, moderation
          records.</li>
        <li>Paid plans, when they launch: billing records we must keep by law (legal obligation).</li>
      </ul>

      <h2>Who processes it, and where</h2>
      <ul>
        <li><strong>Amazon Web Services, Ireland (EU):</strong> hosting, database, file storage, sign-in (Cognito) and
          the emails Cognito sends (codes, password resets), and logs.</li>
        <li><strong>Google:</strong> only if you choose Sign in with Google (your Google sign-in), and YouTube, which
          plays the videos you watch. YouTube&apos;s player is loaded from YouTube and may set its own cookies and see
          your IP address when a video plays.</li>
        <li><strong>OpenAI (United States):</strong> the AI features (writing feedback, explanations, recommendations)
          send the text involved to OpenAI: your writing, the word or sentence being explained, and texts being
          imported or shared. Your vocabulary is never sent. The transfer is covered by [the EU Standard Contractual
          Clauses / OpenAI&apos;s data processing addendum].</li>
        <li><strong>Dictionaries (Free Dictionary API, Wiktionary):</strong> our server sends only the word you look
          up, never anything about you.</li>
        <li><strong>Stripe:</strong> payments, once paid plans launch.</li>
      </ul>
      <p>We don&apos;t sell your data or use it for advertising.</p>

      <h2>Cookies</h2>
      <p>
        We use only cookies the service needs: to keep you signed in (and, for ten minutes, to finish signing in), and
        to remember your theme and layout. Cognito sets its own cookies on its sign-in pages. We use no analytics or
        advertising cookies. YouTube may set cookies when you play a video (see above).
      </p>

      <h2>How long we keep it</h2>
      <p>
        Until you delete your account. Deleting it removes your data at once, including texts you shared with the
        community; copies in our database backups disappear as the backups expire (within [14] days). Logs are kept
        for one month.
      </p>

      <h2>Your rights</h2>
      <ul>
        <li><strong>See and take your data:</strong> <Link href="/settings/privacy" className="underline">Settings ›
          Privacy</Link> downloads all of it as one file.</li>
        <li><strong>Correct it:</strong> change your profile in Settings.</li>
        <li><strong>Delete it:</strong> Settings › Privacy deletes your account and everything in it.</li>
        <li><strong>Object or ask questions:</strong> write to [contact email]. You can also complain to your data
          protection authority (in Ireland, the Data Protection Commission).</li>
      </ul>

      <h2>Changes</h2>
      <p>If this policy changes in a way that matters, we&apos;ll tell you in the app before it applies.</p>
    </LegalPage>
  );
}
