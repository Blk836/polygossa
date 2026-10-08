import { LinkButton } from "@/components/ui";
import { signupHref } from "@/lib/landing";
import { LEARNING_LANGUAGES } from "@/lib/languages";
import { SectionHeading } from "./features";
import { LanguagePicker } from "./hero";

const PLANS = [
  {
    name: "Free",
    price: "$0",
    note: "forever",
    cta: "Start free",
    items: [
      "The whole shared library",
      "5 imported texts or videos",
      "500 saved words (known words are unlimited)",
      "Recommendations at your level",
      "Dictionary, progress and streaks",
      "Bring your words from LingQ or Readlang",
      "Anki & CSV export",
    ],
  },
  {
    name: "Pro",
    price: "$8",
    note: "/month",
    yearly: "or $60 a year ($5 a month)",
    cta: "Start free, upgrade any time",
    items: [
      "Everything in Free",
      "Unlimited imports, books and saved words",
      "Spaced repetition review",
      "Audio sync for your own recordings",
      "AI definitions, translations and writing tutor",
    ],
    highlight: true,
  },
  {
    name: "Classroom",
    price: "$4",
    note: "/student/month",
    cta: "Set up a class",
    items: ["Everything in Pro for every student", "Classes with join codes", "Assign texts and videos", "See each student's progress"],
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="scroll-mt-20 border-y border-line bg-card/60">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 md:py-24">
        <SectionHeading eyebrow="Pricing" title="Start free. Upgrade when you're hooked.">
          The free plan isn&apos;t a trial: read the whole library for as long as you like. Go Pro when you want
          unlimited imports and words, and reviews that make them stick.
        </SectionHeading>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {PLANS.map((p) => (
            <div
              key={p.name}
              className={`relative flex flex-col rounded-2xl border bg-card p-6 ${p.highlight ? "border-accent shadow-lg ring-1 ring-accent" : "border-line"}`}
            >
              {p.highlight && (
                <span className="absolute -top-3 left-6 rounded-full bg-rubric px-2.5 py-0.5 text-xs font-semibold text-accent-ink">Recommended</span>
              )}
              <h3 className="font-display text-xl font-semibold">{p.name}</h3>
              <p className="mt-2"><span className="font-display text-4xl font-semibold">{p.price}</span> <span className="text-sm text-muted">{p.note}</span></p>
              {p.yearly && <p className="mt-1 text-sm font-medium text-good">{p.yearly}</p>}
              <ul className="mt-5 flex-1 space-y-2.5 text-sm">
                {p.items.map((i) => <li key={i} className="flex gap-2"><span className="text-good" aria-hidden>✓</span>{i}</li>)}
              </ul>
              <LinkButton href={signupHref()} variant={p.highlight ? "primary" : "secondary"} className="mt-6 w-full py-2.5">{p.cta}</LinkButton>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const FAQ: [string, string][] = [
  ["Is it really free?", "Yes. The free plan has no time limit and needs no card: read the whole shared library, import 5 texts or videos of your own and keep up to 500 words in your learning list. Words you mark as known never count."],
  ["Do I need to be a beginner, or an advanced learner?", "Either works. Every text shows its estimated level and how many of its words are new to you, so beginners can start with a short story and advanced learners can read the news or watch YouTube."],
  ["Which languages can I learn?", `${LEARNING_LANGUAGES.map((l) => l.name).join(", ").replace(/, ([^,]*)$/, " and $1")}. Definitions are in English; if English isn't your first language, words show a translation into your own language too, where the dictionary has one.`],
  ["How is this different from a lesson app?", "There's no fixed course and no drills. You read and watch things you picked, and the words you learn are the ones that came up. You meet them again in other texts, which is how they stick."],
  ["I already use LingQ or Readlang. Can I bring my words?", "Yes. On the Words page, choose Import words: LingQ with your personal API key, Readlang from its word-list export. Your known words come with you, so your count doesn't start at zero."],
  ["Can I use my own content?", "Yes. Paste any text, import a web article by its address, add a YouTube video, or upload a subtitle file. Pro adds your own audio, synced to the text."],
  ["Can I read books?", "Yes. Import an EPUB or a PDF and each chapter becomes a text, in order, in a playlist of its own. On the free plan each chapter counts toward your 5 imports, so a long book needs Pro."],
  ["Is there an app?", "It runs in the browser on your phone, tablet or computer, so there's nothing to install. Your place in every text is saved, so you can start on the laptop and carry on from your phone."],
  ["Can I take my vocabulary with me?", "Any time. Export your words to Anki or CSV, on every plan."],
];

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-20 mx-auto w-full max-w-3xl px-4 py-16 md:py-24">
      <SectionHeading eyebrow="FAQ" title="Before you sign up" />
      <div className="mt-10 divide-y divide-line rounded-2xl border border-line bg-card">
        {FAQ.map(([q, a]) => (
          <details key={q} className="group px-5 py-1 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-medium">
              {q}
              <span className="text-xl text-muted transition group-open:rotate-45" aria-hidden>+</span>
            </summary>
            <p className="pb-5 text-muted">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="px-4 pb-16 md:pb-24">
      <div className="mx-auto w-full max-w-6xl rounded-3xl bg-accent px-6 py-14 text-center text-accent-ink md:px-12 md:py-20">
        <h2 className="font-display text-3xl font-semibold tracking-tight md:text-5xl">Your first page is two minutes away.</h2>
        <p className="mx-auto mt-4 max-w-xl text-lg opacity-85">Pick a language, read something you enjoy, and watch the words you know add up.</p>
        <div className="mt-8 flex justify-center"><LanguagePicker tone="inverse" /></div>
        <LinkButton href={signupHref()} variant="secondary" className="mt-8 px-6 py-3 text-base">Start reading free</LinkButton>
        <p className="mt-3 text-sm opacity-80">Free plan, no credit card</p>
      </div>
    </section>
  );
}
