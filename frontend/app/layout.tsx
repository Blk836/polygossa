import type { Metadata, Viewport } from "next";
import { Fraunces, Instrument_Sans, Literata } from "next/font/google";
import { cookies } from "next/headers";
import { CardLayoutProvider } from "@/components/card-layout-context";
import { ThemeProvider } from "@/components/theme-context";
import { BRAND } from "@/lib/brand";
import { CARD_LAYOUT_COOKIE, parseCardLayout } from "@/lib/card-layout";
import { THEME_COOKIE, parseTheme, themeAttribute } from "@/lib/theme";
import "./globals.css";

const instrumentSans = Instrument_Sans({ variable: "--font-instrument-sans", subsets: ["latin", "latin-ext"] });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin", "latin-ext"], axes: ["SOFT", "opsz"] });
const literata = Literata({ variable: "--font-literata", subsets: ["latin", "latin-ext"] });

export const metadata: Metadata = {
  title: { default: `${BRAND} — learn languages by reading`, template: `%s · ${BRAND}` },
  description:
    "Read authentic content in the language you're learning. Click any word for a definition, save it, and watch your vocabulary grow.",
  // With translate="no" below: browser translation rewrites text React rendered and crashes the page (and translating
  // a lesson defeats the point). Chrome otherwise offers it whenever a lesson makes the page read as another language.
  other: { google: "notranslate" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f1e7" },
    { media: "(prefers-color-scheme: dark)", color: "#141729" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const jar = await cookies();
  const theme = parseTheme(jar.get(THEME_COOKIE)?.value);
  const cardLayout = parseCardLayout(jar.get(CARD_LAYOUT_COOKIE)?.value);
  return (
    <html
      lang="en"
      translate="no"
      data-theme={themeAttribute(theme)}
      className={`${instrumentSans.variable} ${fraunces.variable} ${literata.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <ThemeProvider initial={theme}>
          <CardLayoutProvider initial={cardLayout}>{children}</CardLayoutProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
