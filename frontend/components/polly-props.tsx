import type { ReactNode } from "react";

export type PollyProp = "book" | "headphones" | "pencil" | "flashcards";
type Held = PollyProp | "drop";
type Point = [x: number, y: number];

const ARM = { fill: "none", stroke: "var(--polly-line)", strokeWidth: 4, strokeLinecap: "round" } as const;
const EDGE = { stroke: "var(--polly-line)", strokeWidth: 2.5, strokeLinejoin: "round" } as const;

function Book() {
  return (
    <>
      <g fill="var(--card)" {...EDGE}>
        <path d="M60 90 Q51 85 40 87 L40 106 Q51 104 60 109 Z" />
        <path d="M60 90 Q69 85 80 87 L80 106 Q69 104 60 109 Z" />
      </g>
      <path d="M45 93 Q51 92 56 94 M45 98 Q51 97 56 99 M64 94 Q69 92 75 93 M64 99 Q69 97 75 98"
        fill="none" stroke="var(--polly-line)" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
    </>
  );
}

function Headphones() {
  return (
    <>
      <path d="M24 70 Q20 34 60 34 Q100 34 96 70" fill="none" stroke="var(--polly-line)" strokeWidth="5" strokeLinecap="round" />
      {[15, 90].map((x) => (
        <g key={x}>
          <rect x={x} y="60" width="15" height="24" rx="6" fill="var(--polly-line)" />
          <rect x={x + 4.5} y="64" width="6" height="16" rx="3" fill="var(--polly-wing)" />
        </g>
      ))}
      <path d="M105 22 L105 6 L115 3 L115 18" fill="none" stroke="var(--polly-line)" strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="102" cy="22" r="3.5" fill="var(--polly-line)" />
      <circle cx="112" cy="18" r="3.5" fill="var(--polly-line)" />
    </>
  );
}

function Pencil() {
  return (
    <g transform="rotate(35 82 96)" strokeWidth="2" stroke="var(--polly-line)" strokeLinejoin="round">
      <rect x="78" y="74" width="8" height="28" fill="var(--accent-soft)" />
      <rect x="78" y="68" width="8" height="6" rx="1.5" fill="var(--polly-cheek)" />
      <path d="M78 102 L86 102 L82 110 Z" fill="var(--card)" />
      <path d="M80.8 107.6 L82 110 L83.2 107.6 Z" fill="var(--polly-line)" stroke="none" />
    </g>
  );
}

function Flashcards() {
  return (
    <>
      <rect x="46" y="80" width="40" height="27" rx="3" transform="rotate(8 66 93)" fill="var(--accent-soft)" {...EDGE} />
      <rect x="36" y="82" width="46" height="27" rx="3" fill="var(--card)" {...EDGE} />
      <path d="M44 92 H70 M44 99 H62" stroke="var(--polly-line)" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
    </>
  );
}

function HoneyDrop() {
  return (
    <>
      <path d="M60 82 C56 89 50 94 50 100 A10 10 0 0 0 70 100 C70 94 64 89 60 82 Z" fill="var(--polly-drop)" {...EDGE} />
      <ellipse cx="55.5" cy="99" rx="2" ry="3.5" fill="var(--polly-shine)" />
    </>
  );
}

const RESTING: [string, string] = ["M27 88 Q32 99 46 100", "M93 88 Q88 99 74 100"];

const HOLDS: Record<Held, { arms: [string, string]; hands: [Point, Point]; Item: () => ReactNode }> = {
  drop: { arms: ["M26 84 Q28 98 49 99", "M94 84 Q92 98 71 99"], hands: [[49, 99], [71, 99]], Item: HoneyDrop },
  book: { arms: ["M26 84 Q28 96 40 98", "M94 84 Q92 96 80 98"], hands: [[40, 98], [80, 98]], Item: Book },
  headphones: { arms: RESTING, hands: [[46, 100], [74, 100]], Item: Headphones },
  pencil: { arms: ["M26 84 Q30 99 46 100", "M94 84 Q94 96 82 96"], hands: [[46, 100], [82, 96]], Item: Pencil },
  flashcards: { arms: ["M26 84 Q26 94 36 96", "M94 84 Q92 94 82 96"], hands: [[36, 96], [82, 96]], Item: Flashcards },
};

export function Holding({ held }: { held: Held }) {
  const { arms, hands, Item } = HOLDS[held];
  return (
    <g data-part="prop">
      {arms.map((d) => <path key={d} data-part="arm" d={d} {...ARM} />)}
      <Item />
      {hands.map(([x, y]) => (
        <circle key={`${x},${y}`} data-part="hand" cx={x} cy={y} r="4.5" fill="var(--honey)" stroke="var(--polly-line)" strokeWidth="2.5" />
      ))}
    </g>
  );
}
