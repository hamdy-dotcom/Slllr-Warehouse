import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale } from "./config";

export default getRequestConfig(async () => {
  const store = await cookies();
  const stored = store.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(stored) ? stored : DEFAULT_LOCALE;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    // Numbers, currency, and dates stay Latin in both locales — the warehouse
    // reads them side by side with SKUs and codes all day.
    formats: {
      number: { integer: { maximumFractionDigits: 0 } },
    },
  };
});
