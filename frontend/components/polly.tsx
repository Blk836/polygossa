export type PollyMood = "happy" | "sleepy" | "cheering";

const LINE = { fill: "none", stroke: "var(--polly-line)", strokeWidth: 3, strokeLinecap: "round" } as const;
const FACE = { fill: "none", stroke: "var(--polly-face)", strokeWidth: 3, strokeLinecap: "round" } as const;
const WING = { fill: "var(--polly-wing)", stroke: "var(--polly-line)", strokeWidth: 3 } as const;

function Wings({ mood }: { mood: PollyMood }) {
  const up = mood === "cheering";
  const [tilt, y, x] = up ? [55, 40, 22] : [35, 50, 24];
  return (
    <>
      <ellipse cx={x} cy={y} rx="15" ry="22" transform={`rotate(-${tilt} ${x} ${y})`} {...WING} />
      <ellipse cx={120 - x} cy={y} rx="15" ry="22" transform={`rotate(${tilt} ${120 - x} ${y})`} {...WING} />
    </>
  );
}

function Antennae() {
  return (
    <>
      <path d="M50 44 Q46 28 38 22" {...LINE} />
      <path d="M70 44 Q74 28 82 22" {...LINE} />
      <circle cx="38" cy="22" r="4.5" fill="var(--polly-line)" />
      <circle cx="82" cy="22" r="4.5" fill="var(--polly-line)" />
    </>
  );
}

function Face({ mood }: { mood: PollyMood }) {
  if (mood === "sleepy") {
    return (
      <>
        <path d="M42 65 Q47 69 52 65" {...FACE} />
        <path d="M68 65 Q73 69 78 65" {...FACE} />
        <ellipse cx="60" cy="76" rx="3" ry="2.5" fill="var(--polly-face)" />
      </>
    );
  }
  if (mood === "cheering") {
    return (
      <>
        <path d="M42 67 Q47 60 52 67" {...FACE} />
        <path d="M68 67 Q73 60 78 67" {...FACE} />
        <path d="M52 72 Q60 84 68 72 Z" fill="var(--polly-face)" stroke="var(--polly-face)" strokeWidth="2" strokeLinejoin="round" />
      </>
    );
  }
  return (
    <>
      <circle cx="47" cy="66" r="4.5" fill="var(--polly-face)" />
      <circle cx="73" cy="66" r="4.5" fill="var(--polly-face)" />
      <circle cx="48.5" cy="64.5" r="1.5" fill="var(--polly-wing)" />
      <circle cx="74.5" cy="64.5" r="1.5" fill="var(--polly-wing)" />
      <path d="M54 74 Q60 79 66 74" {...FACE} strokeWidth="2.5" />
    </>
  );
}

export function Polly({ mood = "happy", label, className = "" }: { mood?: PollyMood; label?: string; className?: string }) {
  const name = label ? { role: "img", "aria-label": label } : { "aria-hidden": true };
  return (
    <svg viewBox="0 0 120 120" data-polly={mood} className={className} {...name}>
      <Wings mood={mood} />
      <Antennae />
      <ellipse cx="60" cy="74" rx="38" ry="32" fill="var(--honey)" stroke="var(--polly-line)" strokeWidth="3" />
      <path d="M26 86 Q60 97 94 86" {...LINE} strokeWidth="7" />
      <path d="M37 98 Q60 106 83 98" {...LINE} strokeWidth="7" />
      {mood !== "sleepy" && (
        <>
          <ellipse cx="39" cy="76" rx="5" ry="3" fill="var(--polly-cheek)" opacity="0.6" />
          <ellipse cx="81" cy="76" rx="5" ry="3" fill="var(--polly-cheek)" opacity="0.6" />
        </>
      )}
      <Face mood={mood} />
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
