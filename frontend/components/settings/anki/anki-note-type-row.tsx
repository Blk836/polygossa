import { selectClass } from "@/components/ui";
import { exampleWords } from "@/lib/anki-decks";
import type { NoteTypeSetup } from "@/lib/anki-note-types";

const REASONS = { cloze: "Cloze cards test sentences, not single words.", "no-word": "Its cards show no written word." };

function FieldChoices({ setup, onChange }: { setup: NoteTypeSetup; onChange: (setup: NoteTypeSetup) => void }) {
  return (
    <fieldset disabled={setup.skip} className="mt-1.5 grid gap-2 disabled:opacity-50 sm:grid-cols-2">
      <label>Word field
        <select aria-label="Word field" className={selectClass} value={setup.wordField}
          onChange={(e) => onChange({ ...setup, wordField: e.target.value, isNew: false })}>
          {setup.fields.map((f) => <option key={f}>{f}</option>)}
        </select>
      </label>
      <label>Meaning field
        <select aria-label="Meaning field" className={selectClass} value={setup.meaningField ?? ""}
          onChange={(e) => onChange({ ...setup, meaningField: e.target.value || undefined, isNew: false })}>
          <option value="">None</option>
          {setup.fields.map((f) => <option key={f}>{f}</option>)}
        </select>
      </label>
      <p className="text-muted sm:col-span-2" data-testid="anki-examples">Examples: {exampleWords(setup.sample, setup.wordField).join(", ") || "none"}</p>
    </fieldset>
  );
}

export function NoteTypeRow({ setup, onChange }: { setup: NoteTypeSetup; onChange: (setup: NoteTypeSetup) => void }) {
  return (
    <li className="rounded-md bg-paper p-2.5 text-sm" data-testid="anki-note-type">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">
          {setup.name} <span className="font-normal text-muted">· {setup.cards} {setup.cards === 1 ? "card" : "cards"}</span>
          {setup.isNew && <span className="ml-2 rounded bg-warn-soft px-1.5 py-0.5 text-xs">New: check its word field</span>}
        </p>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={setup.skip} onChange={(e) => onChange({ ...setup, skip: e.target.checked, isNew: false })} />
          Skip these cards
        </label>
      </div>
      {setup.skip && setup.skipReason && <p className="mt-1 text-xs text-muted" data-testid="anki-skip-reason">{REASONS[setup.skipReason]}</p>}
      <FieldChoices setup={setup} onChange={onChange} />
    </li>
  );
}
