import type { ReactNode } from "react";

const STEPS = [
  ["Pick something you'd read anyway", "Start with a story from the library, paste an article, import a web page or a book, or drop in a YouTube link."],
  ["Tap the words you don't know", "A definition, pronunciation and example appear on the spot. Every word you look up is saved with its sentence."],
  ["Watch them turn into known words", "Turn the page and the words you didn't need count as known, so your total climbs as you read. Pro adds short reviews that bring saved words back just before you'd forget them."],
] as const;

export function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-20 border-y border-line bg-card/60">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 md:py-20">
        <SectionHeading eyebrow="How it works" title="Reading is the lesson." />
        <ol className="mt-10 grid gap-6 md:grid-cols-3">
          {STEPS.map(([title, body], i) => (
            <li key={title} className="relative rounded-2xl border border-line bg-card p-6">
              <span className="font-display text-5xl font-semibold text-rubric/80">{i + 1}</span>
              <h3 className="mt-3 font-display text-xl font-semibold">{title}</h3>
              <p className="mt-2 text-muted">{body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function SectionHeading({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-sm font-semibold tracking-wide text-rubric uppercase">{eyebrow}</p>
      <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight md:text-5xl">{title}</h2>
      {children && <p className="mt-4 text-lg text-muted">{children}</p>}
    </div>
  );
}

interface FeatureProps {
  title: string;
  body: string;
  points: string[];
  visual: ReactNode;
  flip?: boolean;
  /** Only on the Pro plan: says so beside the title. */
  pro?: boolean;
}

function Feature({ title, body, points, visual, flip, pro }: FeatureProps) {
  return (
    <div className="grid items-center gap-8 md:grid-cols-2 md:gap-14">
      <div className={flip ? "md:order-2" : ""}>
        <h3 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
          {title}
          {pro && <span className="ml-3 inline-block translate-y-[-0.2em] rounded-full bg-accent-soft px-2.5 py-0.5 align-middle font-sans text-sm font-semibold tracking-normal text-accent">Pro</span>}
        </h3>
        <p className="mt-3 text-lg text-muted">{body}</p>
        <ul className="mt-5 space-y-2">
          {points.map((p) => (
            <li key={p} className="flex gap-2.5"><span className="mt-0.5 text-good" aria-hidden>✓</span>{p}</li>
          ))}
        </ul>
      </div>
      <div className={`rounded-2xl border border-line bg-card p-6 shadow-sm ${flip ? "md:order-1" : ""}`} aria-hidden>
        {visual}
      </div>
    </div>
  );
}

const LIBRARY = [
  ["A1", "bg-good-soft text-good", "Un día en el mercado", "cover-food", "1% new words · Easy"],
  ["B1", "bg-warn-soft text-warn", "La historia del chocolate", "cover-history", "7% new words · Stretch"],
  ["B2", "bg-warn-soft text-warn", "Noticias de la semana", "cover-news", "14% new words · Hard"],
] as const;

const LibraryVisual = (
  <div className="space-y-3">
    {LIBRARY.map(([level, tone, title, cover, stat]) => (
      <div key={title} className="flex items-center gap-3 rounded-xl border border-line bg-paper p-2.5">
        <div className={`cover ${cover} size-12 shrink-0 rounded-lg`} />
        <div className="min-w-0">
          <p className="truncate font-reading font-semibold">{title}</p>
          <p className="text-xs text-muted"><span className={`mr-2 rounded px-1.5 py-0.5 font-semibold ${tone}`}>{level}</span>{stat}</p>
        </div>
      </div>
    ))}
  </div>
);

const VideoVisual = (
  <div>
    <div className="relative grid aspect-video place-items-center rounded-xl border border-line" style={{ background: "var(--cover-travel)" }}>
      <span className="grid size-14 place-items-center rounded-full bg-card pl-1 text-2xl text-rubric shadow-md">▶</span>
      <div className="absolute inset-x-3 bottom-3 h-1 rounded-full bg-card/70"><div className="h-full w-2/5 rounded-full bg-rubric" /></div>
    </div>
    <p className="reading mt-4 text-lg">
      <span className="w w-known">Hoy</span> <span className="w w-known">vamos</span> <span className="w w-known">a</span>{" "}
      <span className="w w-speaking w-new">cocinar</span> <span className="w w-learning">paella</span>{" "}
      <span className="w w-known">con</span> <span className="w w-new">mariscos</span>.
    </p>
  </div>
);

const ReviewVisual = (
  <div className="text-center">
    <p className="text-xs font-medium tracking-wide text-muted uppercase">Review · 12 due</p>
    <p className="mt-4 font-reading text-3xl font-semibold">mariscos</p>
    <p className="mt-2 text-muted">seafood</p>
    <p className="reading mx-auto mt-3 max-w-xs text-sm italic text-muted">“Hoy vamos a cocinar paella con mariscos.”</p>
    <div className="mt-5 grid grid-cols-3 gap-2 text-sm">
      <span className="rounded-lg bg-bad-soft py-2 font-medium text-bad">Forgot</span>
      <span className="rounded-lg bg-warn-soft py-2 font-medium text-warn">Hard</span>
      <span className="rounded-lg bg-good-soft py-2 font-medium text-good">Easy</span>
    </div>
  </div>
);

const GROWTH = [18, 24, 31, 35, 44, 52, 58, 67, 75, 82, 90, 100];

const ProgressVisual = (
  <div>
    <div className="flex items-baseline justify-between">
      <p><span className="font-display text-4xl font-semibold">1,284</span> <span className="text-muted">known words</span></p>
      <p className="rounded-full bg-warn-soft px-2.5 py-1 text-sm font-medium text-warn">🔥 9-day streak</p>
    </div>
    <div className="mt-6 flex h-28 items-end gap-1.5">
      {GROWTH.map((h, i) => <div key={i} className="flex-1 rounded-t bg-accent/80" style={{ height: `${h}%` }} />)}
    </div>
    <p className="mt-3 text-sm text-muted">216 words to your next milestone: 1,500</p>
  </div>
);

export function Features() {
  return (
    <section id="features" className="scroll-mt-20 mx-auto w-full max-w-6xl space-y-20 px-4 py-16 md:space-y-28 md:py-24">
      <SectionHeading eyebrow="Features" title="Everything between “I can't read this” and “I just did.”" />
      <Feature
        title="A library at your level, or bring your own"
        body="Every text shows how many of its words are new to you, so you can pick something that stretches you without drowning you."
        points={[
          "A starter story in every language, and a shared library of texts and videos",
          "“Just right for you” suggestions: things where you already know 90–98% of the words",
          "Paste text, import a web article, or a whole EPUB or PDF book",
          "CEFR level estimate on every text",
        ]}
        visual={LibraryVisual}
      />
      <Feature
        flip
        title="Watch YouTube with subtitles you can click"
        body="Import a video and its captions become an interactive transcript. Words light up as they're spoken; tap one to look it up without losing your place."
        points={["Video beside the transcript, synced word by word", "Replay or loop a sentence, slow it down", "Upload your own audio to read along (Pro)"]}
        visual={VideoVisual}
      />
      <Feature
        pro
        title="Reviews that fit in a coffee break"
        body="Spaced repetition brings each word back right before you'd forget it, with the sentence you first met it in."
        points={["Easy, Hard or Forgot: the schedule adapts to you", "Save whole sentences to review, too", "Export to Anki or CSV any time, on every plan"]}
        visual={ReviewVisual}
      />
      <Feature
        flip
        title="Progress you can see"
        body="Your known-word count is the honest measure of how much you can read. Watch it grow, keep your streak alive, and hit the next milestone."
        points={["Daily streak and goal", "Known words per language, week over week", "A 12-week activity calendar"]}
        visual={ProgressVisual}
      />
    </section>
  );
}
