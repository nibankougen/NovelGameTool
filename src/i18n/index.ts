import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { readLocalStorage, LANG_LS_KEY } from "../lib/storage";
import { detectDefaultLanguage, isSupportedLanguage } from "../lib/language";
import { ja } from "./locales/ja";
import { en } from "./locales/en";
import { zhCN } from "./locales/zh-CN";
import { zhTW } from "./locales/zh-TW";
import { ko } from "./locales/ko";

const stored = readLocalStorage<string>(LANG_LS_KEY);
const initialLanguage = isSupportedLanguage(stored) ? stored : detectDefaultLanguage();

void i18next.use(initReactI18next).init({
  resources: {
    ja: { translation: ja },
    en: { translation: en },
    "zh-CN": { translation: zhCN },
    "zh-TW": { translation: zhTW },
    ko: { translation: ko },
  },
  lng: initialLanguage,
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

function applyHtmlLang(lng: string) {
  document.documentElement.lang = lng;
}
applyHtmlLang(initialLanguage);
i18next.on("languageChanged", applyHtmlLang);

export default i18next;
