import { selectClass } from "@/components/ui";
import { exampleWords } from "@/lib/anki-decks";
import type { NoteTypeSetup } from "@/lib/anki-note-types";

const SKIP = "";
const REASONS = { cloze: "Cloze cards test sentences, not single words.", "no-word": "Its cards show no written word." };

export function NoteTypeRow({ setup, onChange }: { setup: NoteTypeSetup; onChange: (setup: NoteTypeSetup) => void }) {
  const skipped = !setup.wordField;
  return (
    <li className="rounded-md bg-paper p-2.5 text-sm" data-testid="anki-note-type">
      <p className="font-medium">
        {setup.name} <span className="font-normal text-muted">· {setup.cards} {setup.cards === 1 ? "card" : "cards"}</span>
        {setup.isNew && <span className="ml-2 rounded bg-warn-soft px-1.5 py-0.5 text-xs">New: check its word field</span>}
      </p>
      <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
        <label>Word field
          <select aria-label="Word field" className={selectClass} value={setup.wordField ?? SKIP}
            onChange={(e) => onChange({ ...setup, wordField: e.target.value || undefined, skipReason: null, isNew: false })}>
            <option value={SKIP}>Skip these cards</option>
            {setup.fields.map((f) => <option key={f}>{f}</option>)}
          </select>
        </label>
        {!skipped && (
          <label>Meaning field
            <select aria-label="Meaning field" className={selectClass} value={setup.meaningField ?? ""}
              onChange={(e) => onChange({ ...setup, meaningField: e.target.value || undefined, isNew: false })}>
              <option value="">None</option>
              {setup.fields.map((f) => <option key={f}>{f}</option>)}
            </select>
          </label>
        )}
      </div>
      {skipped && setup.skipReason && <p className="mt-1 text-xs text-muted" data-testid="anki-skip-reason">{REASONS[setup.skipReason]}</p>}
      {!skipped && <p className="mt-1 text-muted" data-testid="anki-examples">Examples: {exampleWords(setup.sample, setup.wordField!).join(", ") || "none"}</p>}
    </li>
  );
}
