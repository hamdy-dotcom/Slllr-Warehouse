import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic, Poppins } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";

import { dirOf } from "@/i18n/config";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-poppins",
  display: "swap",
});

/**
 * Poppins has no Arabic coverage, so Arabic gets its own face at the same four
 * weights. Both are declared on `<html>` and `globals.css` picks between them
 * on `lang`, which keeps the swap to one CSS variable.
 *
 * Not preloaded: an English page never renders a glyph from it, and the Arabic
 * page fetches it as soon as the first Arabic run is laid out.
 */
const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-plex-arabic",
  display: "swap",
  preload: false,
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return {
    title: t("app.name"),
    description: t("dashboard.lede"),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      dir={dirOf(locale)}
      className={`${poppins.variable} ${plexArabic.variable}`}
    >
      <body className="bg-bg text-ink antialiased">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
