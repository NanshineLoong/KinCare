import { enUS, zhCN, type Locale } from "date-fns/locale";

export function dateFnsLocale(locale: string): Locale {
  return locale.toLowerCase().startsWith("en") ? enUS : zhCN;
}
