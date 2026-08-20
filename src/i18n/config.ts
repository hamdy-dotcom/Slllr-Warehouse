/**
 * Locale is carried in a cookie, not in the URL.
 *
 * The shelf is one warehouse in one place; a supplier and a Sllr buyer share
 * links to the same rows and should land on the same page whatever language
 * each of them reads it in. A `/ar` prefix would fork every URL for no gain.
 */
export const LOCALES = ["en", "ar"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_COOKIE = "sllr-locale";

/** Right-to-left locales. Only Arabic today. */
const RTL: readonly Locale[] = ["ar"];

export function isLocale(value: string | undefined): value is Locale {
  return LOCALES.includes(value as Locale);
}

export function dirOf(locale: string): "ltr" | "rtl" {
  return RTL.includes(locale as Locale) ? "rtl" : "ltr";
}

/** What each language calls itself — never translated. */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  ar: "العربية",
};

/** Short form for the switcher. */
export const LOCALE_SHORT: Record<Locale, string> = {
  en: "EN",
  ar: "ع",
};
