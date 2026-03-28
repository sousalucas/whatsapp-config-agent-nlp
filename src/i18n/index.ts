import { createRequire } from "module";

const require = createRequire(import.meta.url);

const locales: Record<string, Record<string, string>> = {
  en: require("./en.json"),
  pt: require("./pt.json"),
};

let currentLocale = "en";

export function setLocale(locale: string): void {
  if (!locales[locale]) {
    console.warn(`Unsupported locale "${locale}", falling back to "en"`);
    currentLocale = "en";
    return;
  }
  currentLocale = locale;
}

export function getLocale(): string {
  return currentLocale;
}

export function getSupportedLocales(): string[] {
  return Object.keys(locales);
}

export function t(key: string, replacements?: Record<string, string>): string {
  let str = locales[currentLocale]?.[key] || locales["en"]?.[key] || key;
  if (replacements) {
    for (const [k, v] of Object.entries(replacements)) {
      str = str.replaceAll(`{{${k}}}`, v);
    }
  }
  return str;
}
