import type { ReactNode } from "react";

export type PollyMood = "happy" | "sleepy" | "cheering" | "curious" | "thinking" | "proud" | "sorry";

export const LINE = { fill: "none", stroke: "var(--polly-line)", strokeWidth: 3, strokeLinecap: "round" } as const;
const FACE = { fill: "none", stroke: "var(--polly-face)", strokeWidth: 3, strokeLinecap: "round" } as const;
const WING = { fill: "var(--polly-wing)", stroke: "var(--polly-line)", strokeWidth: 3 } as const;

const WING_POSE: Partial<Record<PollyMood, [tilt: number, y: number, x: number]>> = { cheering: [55, 40, 22], sorry: [18, 60, 24] };

export function Wings({ mood }: { mood: PollyMood }) {
  const [tilt, y, x] = WING_POSE[mood] ?? [35, 50, 24];
  return (
    <>
      <ellipse data-part="wing" cx={x} cy={y} rx="15" ry="22" transform={`rotate(-${tilt} ${x} ${y})`} {...WING} />
      <ellipse data-part="wing" cx={120 - x} cy={y} rx="15" ry="22" transform={`rotate(${tilt} ${120 - x} ${y})`} {...WING} />
    </>
  );
}

type Antenna = [path: string, x: number, y: number];
const ANTENNAE: Partial<Record<PollyMood, [Antenna, Antenna]>> = {
  curious: [["M50 44 Q46 28 38 22", 38, 22], ["M70 44 Q73 33 79 30 Q85 28 90 33", 90, 34]],
  sorry: [["M50 44 Q44 31 33 31", 33, 31], ["M70 44 Q76 31 87 31", 87, 31]],
};
const STRAIGHT: [Antenna, Antenna] = [["M50 44 Q46 28 38 22", 38, 22], ["M70 44 Q74 28 82 22", 82, 22]];

export function Antennae({ mood }: { mood: PollyMood }) {
  return (
    <>
      {(ANTENNAE[mood] ?? STRAIGHT).map(([d, x, y]) => (
        <g key={d} data-part="antenna">
          <path d={d} {...LINE} />
          <circle cx={x} cy={y} r="4.5" fill="var(--polly-line)" />
        </g>
      ))}
    </>
  );
}

function Eye({ x, y, r = 4.5, shine = true }: { x: number; y: number; r?: number; shine?: boolean }) {
  return (
    <>
      <circle data-part="eye" cx={x} cy={y} r={r} fill="var(--polly-face)" />
      {shine && <circle cx={x + r / 3} cy={y - r / 3} r={r / 3} fill="var(--polly-wing)" />}
    </>
  );
}

function Mouth({ d, width = 2.5 }: { d: string; width?: number }) {
  return <path data-part="mouth" d={d} {...FACE} strokeWidth={width} />;
}

function ClosedEyes({ y, bend }: { y: number; bend: number }) {
  return <path data-part="eye" d={`M42 ${y} Q47 ${y + bend} 52 ${y} M68 ${y} Q73 ${y + bend} 78 ${y}`} {...FACE} />;
}

const FACES: Record<PollyMood, () => ReactNode> = {
  happy: () => (
    <>
      <Eye x={47} y={66} /><Eye x={73} y={66} />
      <Mouth d="M54 74 Q60 79 66 74" />
    </>
  ),
  sleepy: () => (
    <>
      <ClosedEyes y={65} bend={4} />
      <ellipse data-part="mouth" cx="60" cy="76" rx="3" ry="2.5" fill="var(--polly-face)" />
    </>
  ),
  cheering: () => (
    <>
      <ClosedEyes y={67} bend={-7} />
      <path data-part="mouth" d="M52 72 Q60 84 68 72 Z" fill="var(--polly-face)" stroke="var(--polly-face)" strokeWidth="2" strokeLinejoin="round" />
    </>
  ),
  curious: () => (
    <>
      <path data-part="brow" d="M66 55 Q73 50 80 55" {...FACE} strokeWidth="2.5" />
      <Eye x={47} y={66} /><Eye x={73} y={65} r={6} />
      <ellipse data-part="mouth" cx="61" cy="77" rx="3" ry="3.5" fill="var(--polly-face)" />
    </>
  ),
  thinking: () => (
    <>
      <Eye x={50} y={63} /><Eye x={76} y={63} />
      <Mouth d="M55 77 Q60 75 66 76" />
    </>
  ),
  proud: () => (
    <>
      <ClosedEyes y={66} bend={-6} />
      <Mouth d="M53 72 Q60 78 67 72" />
    </>
  ),
  sorry: () => (
    <>
      <path data-part="brow" d="M41 61 L51 57 M69 57 L79 61" {...FACE} strokeWidth="2.5" />
      <Eye x={46} y={67} r={4} shine={false} /><Eye x={74} y={67} r={4} shine={false} />
      <Mouth d="M52 80 Q56 76 60 80 Q64 84 68 80" />
    </>
  ),
};

const CHEEK_Y: Partial<Record<PollyMood, number | null>> = { sleepy: null, sorry: null, proud: 74, curious: 77 };

export function Face({ mood }: { mood: PollyMood }) {
  const cheekY = CHEEK_Y[mood] === undefined ? 76 : CHEEK_Y[mood];
  const Features = FACES[mood];
  return (
    <>
      {cheekY !== null && [39, 81].map((x) => (
        <ellipse key={x} data-part="cheek" cx={x} cy={cheekY} rx="5" ry="3" fill="var(--polly-cheek)" opacity="0.6" />
      ))}
      <Features />
    </>
  );
}

const EXTRAS: Partial<Record<PollyMood, () => ReactNode>> = {
  thinking: () => (
    <g data-part="thought" className="polly-think" fill="var(--polly-wing)" stroke="var(--polly-line)" strokeWidth="2">
      <circle cx="99" cy="18" r="3" />
      <circle cx="109" cy="6" r="5" />
    </g>
  ),
  proud: () => (
    <path data-part="sparkle" d="M12 4 L14.5 11.5 L22 14 L14.5 16.5 L12 24 L9.5 16.5 L2 14 L9.5 11.5 Z"
      fill="var(--honey)" stroke="var(--polly-line)" strokeWidth="1.5" strokeLinejoin="round" />
  ),
  sorry: () => (
    <path data-part="sweat" d="M89 45 C87 50 85 52 85 55 A4 4 0 0 0 93 55 C93 52 91 50 89 45 Z"
      fill="var(--polly-wing)" stroke="var(--polly-line)" strokeWidth="2" strokeLinejoin="round" />
  ),
};

export function Extras({ mood }: { mood: PollyMood }) {
  const Extra = EXTRAS[mood];
  return Extra ? <Extra /> : null;
}
