import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal-page";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = { title: "Terms of service" };

/** The terms of service (draft, gdpr.feature). */
export default function TermsPage() {
  return (
    <LegalPage title="Terms of service" updated="October 2026">
      <p>
        These terms are an agreement between you and [company name, address] for using {BRAND}. By creating an
        account you accept them, together with the <Link href="/privacy" className="underline">privacy policy</Link>.
      </p>

      <h2>Your account</h2>
      <p>
        You need to be at least [16] years old, or have a parent&apos;s or teacher&apos;s permission. Keep your sign-in
        to yourself; you&apos;re responsible for what happens in your account. You can delete it at any time in
        Settings › Privacy.
      </p>

      <h2>What you add</h2>
      <p>
        Texts, audio, words, writing and posts you add stay yours. You give us the permission we need to store them
        and show them to you, and, when you share a text, playlist or post, to show it to other learners. Only add
        content you have the right to use. Shared content is public to other learners until you remove it.
      </p>

      <h2>What&apos;s not allowed</h2>
      <ul>
        <li>Content that infringes someone&apos;s copyright or other rights, or that is illegal, hateful or harassing.</li>
        <li>Spam, scraping, or trying to break, overload or get around the service&apos;s limits and security.</li>
      </ul>
      <p>
        We may remove content or suspend accounts that break these rules. To report content that infringes your
        rights, write to [takedown contact] with the link and what it infringes; we&apos;ll act promptly.
      </p>

      <h2>Plans and payment</h2>
      <p>
        The Free plan is free. Paid plans, when they launch, renew each [month/year] until you cancel; prices include
        VAT. You can cancel at any time and keep access until the end of the period you paid for. [Refund terms, and
        the EU right of withdrawal.]
      </p>

      <h2>AI features</h2>
      <p>
        Explanations, feedback and recommendations made by AI can be wrong. Use them as a study aid, not as an
        authority.
      </p>

      <h2>The service</h2>
      <p>
        We work to keep {BRAND} available and your data safe, but the service is provided as it is, and features may
        change. Some features rely on other services (for example YouTube captions and dictionaries) that can stop
        working. To the extent the law allows, our liability is limited to [the amount you paid in the last 12
        months]; nothing here limits rights you have as a consumer.
      </p>

      <h2>Changes and law</h2>
      <p>
        We&apos;ll tell you in the app before changes to these terms apply. These terms are governed by the law of
        [country]; as a consumer you keep the protection of the law where you live.
      </p>
    </LegalPage>
  );
}
