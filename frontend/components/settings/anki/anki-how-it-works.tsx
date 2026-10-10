const RULES = [
  "Cards that are mature in Anki (next review 21+ days away) make the word known here.",
  "Cards you are still learning in Anki make the word learning here; cards never reviewed don't count.",
  "Anki only ever moves a word up: forgetting a card in Anki doesn't make a known word unknown.",
  "If you change a word yourself here, Anki leaves it alone until that card changes again.",
  "Words from your Anki decks that you haven't met here yet are added to your words.",
  "Words you review in Anki leave the Review tab here, so you never review the same word twice.",
  "Reviews on your phone count once Anki desktop has synced them, and Anki desktop is open here.",
  "Sync runs when the app opens, then every 15 minutes while it's open on a computer. Practice → Words shows it, with Sync now.",
];

export function AnkiHowItWorks({ open, freePlan }: { open: boolean; freePlan: boolean }) {
  return (
    <details open={open} className="group rounded-xl border border-line bg-card p-5" data-testid="anki-how-it-works">
      <summary className="cursor-pointer font-semibold">{open ? "How Anki sync works" : "How it works"}</summary>
      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm">
        {RULES.map((rule) => <li key={rule}>{rule}</li>)}
        {freePlan && <li>On the Free plan, new learning words count toward your saved-word limit.</li>}
      </ul>
    </details>
  );
}
