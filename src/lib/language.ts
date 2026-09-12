export const SUPPORTED_LANGUAGES = ["ja", "en", "zh-CN", "zh-TW", "ko"] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<LanguageCode, string> = {
  ja: "日本語",
  en: "English",
  "zh-CN": "简体中文",
  "zh-TW": "繁體中文",
  ko: "한국어",
};

export function isSupportedLanguage(v: unknown): v is LanguageCode {
  return typeof v === "string" && (SUPPORTED_LANGUAGES as readonly string[]).includes(v);
}

/** ブラウザの言語タグ（例: "zh-HK", "en-US"）を対応言語コードへマッピングする */
function mapTag(tag: string): LanguageCode | null {
  const lower = tag.toLowerCase();
  if (lower === "zh" || lower.startsWith("zh-cn") || lower.startsWith("zh-sg") || lower === "zh-hans") return "zh-CN";
  if (
    lower.startsWith("zh-tw") ||
    lower.startsWith("zh-hk") ||
    lower.startsWith("zh-mo") ||
    lower === "zh-hant"
  )
    return "zh-TW";
  const base = lower.split("-")[0];
  if (isSupportedLanguage(base)) return base;
  return null;
}

/** ブラウザの言語設定から対応言語を推定する。対応する言語がなければ英語 */
export function detectDefaultLanguage(): LanguageCode {
  const candidates = typeof navigator !== "undefined" ? [...(navigator.languages ?? []), navigator.language].filter(Boolean) : [];
  for (const tag of candidates) {
    const mapped = mapTag(tag);
    if (mapped) return mapped;
  }
  return "en";
}
