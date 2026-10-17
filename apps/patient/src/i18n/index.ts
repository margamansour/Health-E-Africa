import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { sw } from "./sw";

// English text is used as the translation key, so English needs no file.
// Any string missing from the Kiswahili file falls back to English.
export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "sw", label: "Kiswahili" },
] as const;

function initialLanguage(): string {
  try {
    const saved = localStorage.getItem("lang");
    if (saved) return saved;
  } catch {
    /* storage blocked */
  }
  return navigator.language?.toLowerCase().startsWith("sw") ? "sw" : "en";
}

void i18n.use(initReactI18next).init({
  resources: { sw: { translation: sw } },
  lng: initialLanguage(),
  fallbackLng: "en",
  keySeparator: false,
  nsSeparator: false,
  interpolation: { escapeValue: false },
  returnEmptyString: false,
});

i18n.on("languageChanged", (lng) => {
  document.documentElement.lang = lng;
  try {
    localStorage.setItem("lang", lng);
  } catch {
    /* storage blocked */
  }
});

export default i18n;
