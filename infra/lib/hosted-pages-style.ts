import type * as cognito from "aws-cdk-lib/aws-cognito";

/**
 * Cognito's hosted sign-in pages in the app's look (docs/acceptance/cognito-login.feature): the theme's colours
 * (frontend/app/globals.css) in light and dark mode, following the device like the app, and the wordmark as the
 * form's logo. Only these settings are given; Cognito keeps its own for the rest.
 */

/** The app's theme tokens, light and dark (globals.css), as Cognito's rrggbbaa. */
const THEME = {
  paper: ["f6f1e7", "141729"],
  card: ["fffcf6", "1c2036"],
  ink: ["1d2033", "ede6d6"],
  muted: ["625f6b", "a3a2b8"],
  line: ["e3dac8", "2e3352"],
  accent: ["26336b", "aab6f2"],
  accentInk: ["fffcf6", "141729"],
  rubric: ["b8401f", "ff8c66"],
} as const;

type Token = keyof typeof THEME;
const light = (t: Token) => `${THEME[t][0]}ff`;
const dark = (t: Token) => `${THEME[t][1]}ff`;

/** Settings for both modes, from a function naming tokens for one mode. */
function modes<T>(pick: (c: (t: Token) => string) => T) {
  return { lightMode: pick(light), darkMode: pick(dark) };
}

export function styleSettings() {
  const button = (c: (t: Token) => string) => ({
    defaults: { backgroundColor: c("accent"), textColor: c("accentInk") },
    hover: { backgroundColor: c("ink"), textColor: c("card") },
    active: { backgroundColor: c("ink"), textColor: c("card") },
  });
  return {
    categories: { global: { colorSchemeMode: "DYNAMIC" } },
    components: {
      pageBackground: { image: { enabled: false }, ...modes((c) => ({ color: c("paper") })) },
      form: {
        ...modes((c) => ({ backgroundColor: c("card"), borderColor: c("line") })),
        logo: { enabled: true, location: "CENTER", position: "TOP", formInclusion: "IN" },
      },
      primaryButton: modes(button),
      pageText: modes((c) => ({ headingColor: c("ink"), bodyColor: c("ink"), descriptionColor: c("muted") })),
    },
    componentClasses: {
      link: modes((c) => ({ defaults: { textColor: c("accent") }, hover: { textColor: c("rubric") } })),
      focusState: modes((c) => ({ borderColor: c("accent") })),
      input: modes((c) => ({ defaults: { backgroundColor: c("card"), borderColor: c("line") }, placeholderColor: c("muted") })),
    },
  };
}

/** The wordmark (the brand and a dot, like the app's Logo) as an SVG, for one mode. */
function wordmark(brand: string, ink: string, rubric: string): string {
  const width = 24 + brand.length * 20;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="48" viewBox="0 0 ${width} 48">`
    + `<text x="${width / 2}" y="35" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif"`
    + ` font-size="34" font-weight="600" fill="#${ink}">${brand}<tspan fill="#${rubric}">.</tspan></text></svg>`;
}

export function styleAssets(brand: string): cognito.CfnManagedLoginBranding.AssetTypeProperty[] {
  return (["LIGHT", "DARK"] as const).map((colorMode, i) => ({
    category: "FORM_LOGO",
    colorMode,
    extension: "SVG",
    bytes: Buffer.from(wordmark(brand, THEME.ink[i], THEME.rubric[i]), "utf8").toString("base64"),
  }));
}
