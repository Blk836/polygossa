import { ImageResponse } from "next/og";
import { BRAND } from "@/lib/brand";

// The picture chat apps and social sites show for a shared link: the promise, beside a line of the reader with its
// word colours (the light theme's paper, ink and rubric from globals.css; an image can't use CSS variables).

export const alt = `${BRAND}: learn a language from things you actually want to read`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PAPER = "#f6f1e7";
const INK = "#1d2033";
const MUTED = "#5d6075";
const RUBRIC = "#b8401f";
const NEW = "#cfe0fb";
const LEARNING = "#fbe7a1";

const LINE: [string, string | null][] = [
  ["Cada", null], ["mañana", NEW], ["Lucía", null], ["camina", LEARNING], ["hasta", NEW], ["un", null],
  ["pequeño", NEW], ["café", null], ["cerca", NEW], ["del", null], ["mar.", NEW],
];

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: PAPER, color: INK }}>
        <div style={{ display: "flex", fontSize: 44, fontWeight: 700 }}>
          {BRAND}<span style={{ color: RUBRIC }}>.</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 76, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>
            Learn a language from things you actually want to read.
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 40, fontSize: 38 }}>
            {LINE.map(([word, bg], i) => (
              <span key={i} style={{ background: bg ?? "transparent", borderRadius: 8, padding: "2px 8px" }}>{word}</span>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 28, color: MUTED }}>
          Stories, articles and YouTube · tap any word for its meaning · free to start
        </div>
      </div>
    ),
    size,
  );
}
