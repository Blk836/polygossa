import type { Metadata, Viewport } from "next";
import { Fraunces, Instrument_Sans, Literata } from "next/font/google";
import { cookies } from "next/headers";
import { CardLayoutProvider } from "@/components/card-layout-context";
import { ThemeProvider } from "@/components/theme-context";
import { BRAND } from "@/lib/brand";
import { CARD_LAYOUT_COOKIE, parseCardLayout } from "@/lib/card-layout";
import { appUrl } from "@/lib/site";
import { THEME_COOKIE, parseTheme, themeAttribute } from "@/lib/theme";
import "./globals.css";

const instrumentSans = Instrument_Sans({ variable: "--font-instrument-sans", subsets: ["latin", "latin-ext"] });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin", "latin-ext"], axes: ["SOFT", "opsz"] });
const literata = Literata({ variable: "--font-literata", subsets: ["latin", "latin-ext"] });

const SHARE_TITLE = `${BRAND}: learn a language from things you actually want to read`;
const DESCRIPTION =
  "Read stories, articles and YouTube videos in the language you're learning. Tap any word for its meaning, keep it, and watch the words you know add up. Free to start.";

export async function generateMetadata(): Promise<Metadata> {
  return {
    metadataBase: new URL(appUrl(process.env)),
    title: { default: `${BRAND} — learn languages by reading`, template: `%s · ${BRAND}` },
    description: DESCRIPTION,
    openGraph: { type: "website", siteName: BRAND, title: SHARE_TITLE, description: DESCRIPTION },
    twitter: { card: "summary_large_image", title: SHARE_TITLE, description: DESCRIPTION },
  };
}

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
      <head>
        <meta name="google" content="notranslate" />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <ThemeProvider initial={theme}>
          <CardLayoutProvider initial={cardLayout}>{children}</CardLayoutProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
