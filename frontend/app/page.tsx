import Link from "next/link";
import { cookies } from "next/headers";
import { LinkButton, Logo } from "@/components/ui";
import { BRAND } from "@/lib/brand";
import { LANGUAGES } from "@/lib/languages";

const PLANS = [
  { name: "Free", price: "$0", items: ["5 imported texts", "500 saved words", "Basic dictionary", "Vocabulary export"] },
  {
    name: "Pro",
    price: "$8/mo or $60/yr",
    items: ["Unlimited texts & words", "Spaced repetition review", "Audio sync", "AI definitions & writing tutor"],
    highlight: true,
  },
  { name: "Classroom", price: "$4/student/mo", items: ["All Pro features", "Classes & join codes", "Assign texts", "Student progress"] },
];

const DEMO: { text: string; status?: "learning" | "known" | "ignored" }[] = [
  { text: "Todas", status: "known" }, { text: " " }, { text: "las", status: "known" }, { text: " " },
  { text: "mañanas", status: "learning" }, { text: ", " }, { text: "Lucía", status: "ignored" }, { text: " " },
  { text: "sale", status: "known" }, { text: " " }, { text: "de", status: "known" }, { text: " " },
  { text: "casa", status: "known" }, { text: " " }, { text: "y" , status: "known"}, { text: " " },
  { text: "camina" }, { text: " " }, { text: "hasta" , status: "known"}, { text: " " }, { text: "un", status: "known" },
  { text: " " }, { text: "pequeño", status: "learning" }, { text: " " }, { text: "café", status: "known" }, { text: "." },
];

export default async function Landing() {
  const signedIn = (await cookies()).has("lector_token");
  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5">
        <Logo className="text-3xl" />
        <nav className="flex items-center gap-2">
          {signedIn ? (
            <LinkButton href="/library">Open library</LinkButton>
          ) : (
            <>
              <LinkButton href="/login" variant="ghost">Sign in</LinkButton>
              <LinkButton href="/signup">Start reading free</LinkButton>
            </>
          )}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4">
        <section className="grid items-center gap-10 py-12 md:grid-cols-2 md:py-20">
          <div>
            <h1 className="font-display text-4xl leading-[1.1] font-semibold tracking-tight md:text-6xl">
              Learn a language by reading things you actually want to read.
            </h1>
            <p className="mt-5 text-lg text-muted">
              Paste an article, import a web page or subtitles, and start reading. Click any word for a definition —
              it&apos;s saved automatically, and you&apos;ll see it again in context until it sticks.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <LinkButton href="/signup" className="px-5 py-2.5 text-base">Start reading — it&apos;s free</LinkButton>
              <LinkButton href="#pricing" variant="secondary" className="px-5 py-2.5 text-base">Pricing</LinkButton>
            </div>
            <p className="mt-4 text-sm text-muted">{LANGUAGES.map((l) => l.native).join(" · ")}</p>
          </div>
          <div className="rounded-2xl border border-line bg-card p-6 shadow-sm">
            <p className="reading text-xl">
              {DEMO.map((t, i) =>
                t.status ? (
                  <span key={i} className={`w w-${t.status} ${t.text === "mañanas" ? "w-selected" : ""}`}>{t.text}</span>
                ) : t.text.trim() ? (
                  <span key={i} className="w w-new">{t.text}</span>
                ) : (
                  <span key={i}>{t.text}</span>
                ),
              )}
            </p>
            <div className="mt-4 rounded-xl border border-line bg-paper p-4 text-sm">
              <div className="flex items-baseline gap-2">
                <span className="font-reading text-lg font-semibold">mañanas</span>
                <span className="text-muted">/maˈɲanas/ · noun</span>
              </div>
              <p className="mt-1">mornings — plural of <em>mañana</em></p>
              <div className="mt-3 flex gap-2 text-xs">
                <span className="rounded-md bg-learning px-2 py-1">Learning</span>
                <span className="rounded-md border border-line px-2 py-1">Known</span>
                <span className="rounded-md border border-line px-2 py-1">Ignore</span>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted">
              <span><span className="mr-1 inline-block size-2.5 rounded-sm border border-line align-middle" />new</span>
              <span><span className="mr-1 inline-block size-2.5 rounded-sm bg-learning align-middle" />learning</span>
              <span><span className="mr-1 inline-block size-2.5 rounded-sm bg-known align-middle" />known</span>
              <span><span className="mr-1 inline-block size-2.5 rounded-sm bg-ignored align-middle" />ignored</span>
            </div>
          </div>
        </section>

        <section className="grid gap-4 py-10 md:grid-cols-4">
          {[
            ["Frictionless reading", "Click a word, see its meaning, keep reading. No tab-switching."],
            ["Vocabulary that sticks", "Every word you look up is saved with the sentence you met it in."],
            ["Your own content", "Articles, chapters, subtitles, lyrics — paste it or import a URL."],
            ["Visible progress", "Watch your known-word count climb and keep your review streak alive."],
          ].map(([title, body]) => (
            <div key={title} className="rounded-xl border border-line bg-card p-5">
              <h2 className="font-display text-lg font-semibold">{title}</h2>
              <p className="mt-1 text-sm text-muted">{body}</p>
            </div>
          ))}
        </section>

        <section id="pricing" className="py-14">
          <h2 className="text-center font-display text-4xl font-semibold tracking-tight">Simple pricing</h2>
          <p className="mt-2 text-center text-muted">500 saved words free — not 20.</p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {PLANS.map((p) => (
              <div key={p.name} className={`rounded-2xl border bg-card p-6 ${p.highlight ? "border-accent shadow-md" : "border-line"}`}>
                <h3 className="font-display text-xl font-semibold">{p.name}</h3>
                <p className="mt-1 text-2xl font-semibold">{p.price}</p>
                <ul className="mt-4 space-y-2 text-sm">
                  {p.items.map((i) => (
                    <li key={i} className="flex gap-2"><span className="text-rubric">✓</span>{i}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </main>
      <footer className="border-t border-line py-6 text-center text-sm text-muted">
        {BRAND} · <Link href="/signup" className="underline">Create an account</Link>
      </footer>
    </div>
  );
}
