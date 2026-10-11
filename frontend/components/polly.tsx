import { useId } from "react";
import { Antennae, Extras, Face, Wings, type PollyMood } from "./polly-face";
import { Holding, type PollyProp } from "./polly-props";

export type { PollyMood } from "./polly-face";
export type { PollyProp } from "./polly-props";

const OUTLINE = { fill: "none", stroke: "var(--polly-line)" } as const;

function useClipId(): string {
  return `polly${useId().replace(/[^\w-]/g, "")}`;
}

function Body({ cy, rx, outline, stripes, stripeWidth }: { cy: number; rx: number; outline: number; stripes: string[]; stripeWidth: number }) {
  const clip = useClipId();
  return (
    <>
      <defs>
        <clipPath id={clip}><ellipse cx="60" cy={cy} rx={rx} ry="32" /></clipPath>
      </defs>
      <ellipse data-part="body" cx="60" cy={cy} rx={rx} ry="32" fill="var(--honey)" />
      <g data-part="stripes" clipPath={`url(#${clip})`} fill="none" stroke="var(--polly-line)" strokeWidth={stripeWidth}>
        {stripes.map((d) => <path key={d} d={d} />)}
      </g>
      <ellipse data-part="outline" cx="60" cy={cy} rx={rx} ry="32" {...OUTLINE} strokeWidth={outline} />
    </>
  );
}

function SmallPolly() {
  return (
    <>
      <ellipse data-part="wing" cx="26" cy="54" rx="16" ry="20" transform="rotate(-35 26 54)" fill="var(--polly-wing)" stroke="var(--polly-line)" strokeWidth="6" />
      <ellipse data-part="wing" cx="94" cy="54" rx="16" ry="20" transform="rotate(35 94 54)" fill="var(--polly-wing)" stroke="var(--polly-line)" strokeWidth="6" />
      <Body cy={78} rx={40} outline={6} stripes={["M14 92 Q60 108 106 92"]} stripeWidth={9} />
      <circle data-part="eye" cx="46" cy="72" r="7" fill="var(--polly-face)" />
      <circle data-part="eye" cx="74" cy="72" r="7" fill="var(--polly-face)" />
    </>
  );
}

function FullPolly({ mood, prop }: { mood: PollyMood; prop?: PollyProp }) {
  const held = prop ?? (mood === "proud" ? "drop" : null);
  return (
    <g transform={mood === "curious" ? "rotate(-10 60 74)" : undefined}>
      <Wings mood={mood} />
      <Antennae mood={mood} />
      <Body cy={74} rx={38} outline={3} stripes={["M16 79 Q60 95 104 79", "M16 90 Q60 106 104 90"]} stripeWidth={6} />
      <Face mood={mood} />
      {held && <Holding held={held} />}
      <Extras mood={mood} />
    </g>
  );
}

export function Polly({ mood = "happy", prop, size, label, className = "" }: {
  mood?: PollyMood;
  prop?: PollyProp;
  size?: "small";
  label?: string;
  className?: string;
}) {
  const name = label ? { role: "img", "aria-label": label } : { "aria-hidden": true };
  return (
    <svg
      viewBox={size ? "0 17 120 110" : "0 0 120 120"}
      data-polly={mood}
      data-polly-prop={size ? undefined : prop}
      data-polly-size={size}
      className={className}
      {...name}
    >
      {size ? <SmallPolly /> : <FullPolly mood={mood} prop={prop} />}
    </svg>
  );
}

export function HoneyJar({ wobbles }: { wobbles: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      data-testid="honey-jar"
      data-wobbles={wobbles}
      aria-hidden="true"
      className={`size-5 shrink-0 ${wobbles > 0 ? "jar-wobble" : ""}`}
    >
      <rect x="6" y="3" width="12" height="4" rx="1.5" fill="var(--polly-line)" />
      <path d="M7 7 h10 a3 3 0 0 1 3 3 v9 a3 3 0 0 1 -3 3 h-10 a3 3 0 0 1 -3 -3 v-9 a3 3 0 0 1 3 -3 z" fill="var(--card)" stroke="var(--polly-line)" strokeWidth="1.6" />
      <path d="M4.8 13 h14.4 v6 a2.2 2.2 0 0 1 -2.2 2.2 h-10 a2.2 2.2 0 0 1 -2.2 -2.2 z" fill="var(--honey)" />
    </svg>
  );
}
