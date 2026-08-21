// src/i18n/index.ts
// i18next initialization with automatic browser language detection
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import hi from './locales/hi.json';
import te from './locales/te.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import bn from './locales/bn.json';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English',    nativeLabel: 'English' },
  { code: 'hi', label: 'Hindi',      nativeLabel: 'हिन्दी' },
  { code: 'te', label: 'Telugu',     nativeLabel: 'తెలుగు' },
  { code: 'bn', label: 'Bengali',    nativeLabel: 'বাংলা' },
  { code: 'es', label: 'Spanish',    nativeLabel: 'Español' },
  { code: 'fr', label: 'French',     nativeLabel: 'Français' },
];

export function getLanguageCode(displayName?: string): string {
  if (!displayName) return 'en';
  const name = displayName.toLowerCase();
  if (name.includes('hindi') || name.includes('हिन्दी')) return 'hi';
  if (name.includes('telugu') || name.includes('తెలుగు')) return 'te';
  if (name.includes('bengali') || name.includes('বাংলা')) return 'bn';
  if (name.includes('spanish') || name.includes('español')) return 'es';
  if (name.includes('french') || name.includes('français')) return 'fr';
  return 'en';
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      hi: { translation: hi },
      te: { translation: te },
      bn: { translation: bn },
      es: { translation: es },
      fr: { translation: fr },
    },
    fallbackLng: 'en',
    debug: false,
    interpolation: {
      escapeValue: false, // React already escapes
    },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'hemoscan_language',
    },
  });

export default i18n;
