import Link from "next/link";
import { LinkButton, Logo } from "@/components/ui";
import { signupHref } from "@/lib/landing";
import { LEARNING_LANGUAGES } from "@/lib/languages";
import { DemoReader } from "./demo-reader";

const NAV = [
  ["See it in action", "#watch"],
  ["How it works", "#how"],
  ["Features", "#features"],
  ["Pricing", "#pricing"],
  ["FAQ", "#faq"],
] as const;

export function LandingHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-paper/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-6 px-4 py-3">
        <Link href="/" aria-label="Home"><Logo className="text-2xl md:text-3xl" /></Link>
        <nav className="hidden gap-5 text-sm text-muted md:flex" aria-label="Sections">
          {NAV.map(([label, href]) => <a key={href} href={href} className="hover:text-ink">{label}</a>)}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {signedIn ? (
            <LinkButton href="/library">Open library</LinkButton>
          ) : (
            <>
              <LinkButton href="/login" variant="ghost">Sign in</LinkButton>
              <LinkButton href={signupHref()}>Start free</LinkButton>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

/** "I want to learn…" chips: each starts sign-up with that language chosen. */
export function LanguagePicker({ tone = "plain" }: { tone?: "plain" | "inverse" }) {
  const chip = tone === "inverse"
    ? "border-accent-ink/30 text-accent-ink hover:bg-accent-ink/10"
    : "border-line bg-card text-ink hover:border-accent hover:bg-accent-soft";
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Languages">
      {LEARNING_LANGUAGES.map((l) => (
        <li key={l.code}>
          <Link href={signupHref(l.code)} className={`inline-flex rounded-full border px-3.5 py-1.5 font-reading text-sm transition ${chip}`} title={`Learn ${l.name}`}>
            {l.native}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function Hero() {
  return (
    <section className="relative">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 [&>*]:min-w-0 pb-16 pt-10 md:pt-16 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:pb-24">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-3 py-1 text-xs font-medium text-muted">
            <span className="size-1.5 rounded-full bg-rubric" /> {LEARNING_LANGUAGES.length} languages · free to start
          </p>
          <h1 className="mt-5 font-display text-[2.6rem] leading-[1.05] font-semibold tracking-tight md:text-6xl">
            Learn a language from things you actually <em className="text-rubric">want</em> to read.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted">
            Stories, articles and YouTube videos in the language you&apos;re learning. Tap any word to see what it
            means. It&apos;s saved with the sentence you found it in, and every page you read makes the next one easier.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <LinkButton href={signupHref()} className="px-6 py-3 text-base">Start reading free</LinkButton>
            <a href="#how" className="px-2 py-3 text-sm font-medium text-accent underline-offset-4 hover:underline">See how it works ↓</a>
          </div>
          <p className="mt-3 text-sm text-muted">Free plan, no credit card · Set up in two minutes</p>
          <div className="mt-8">
            <p className="mb-2.5 text-sm font-medium">I want to learn…</p>
            <LanguagePicker />
          </div>
        </div>
        <div>
          <p className="mb-3 text-center text-sm text-muted lg:text-left">
            <span className="font-medium text-rubric">Try it now.</span> No account needed.
          </p>
          <DemoReader />
        </div>
      </div>
    </section>
  );
}
