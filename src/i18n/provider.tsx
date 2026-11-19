"use client";

import * as React from "react";
import en, { type Dictionary } from "./en";
import bn from "./bn";

export type Language = "en" | "bn";

export const LANGUAGES: { value: Language; label: string }[] = [
  { value: "en", label: "English" },
  { value: "bn", label: "বাংলা" },
];

const DICTIONARIES: Record<Language, Dictionary> = { en, bn };

export type TranslateParams = Record<string, string | number>;

/**
 * Resolve a dot path against a dictionary.
 *
 * Returns `undefined` when the path does not exist, so the caller can decide
 * what to render rather than printing "undefined" in the UI.
 */
export function resolve(
  dictionary: Dictionary,
  path: string,
): string | undefined {
  const segments = path.split(".");
  let current: unknown = dictionary;

  for (const segment of segments) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }

  return typeof current === "string" ? current : undefined;
}

/** Replace `{name}` placeholders with the supplied parameters. */
export function interpolate(
  template: string,
  params: TranslateParams = {},
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = params[key];
    return value === undefined ? match : String(value);
  });
}

export interface I18nContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (path: string, params?: TranslateParams) => string;
  dictionary: Dictionary;
}

const I18nContext = React.createContext<I18nContextValue | null>(null);

const LANGUAGE_STORAGE_KEY = "mediqueue.language.v1";

function readStoredLanguage(): Language {
  if (typeof window === "undefined") return "en";
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return stored === "bn" ? "bn" : "en";
  } catch {
    return "en";
  }
}

/**
 * The language store.
 *
 * The active language lives outside React so it can be read with
 * `useSyncExternalStore`. That keeps the provider free of a `setState` inside
 * an effect, which the React Compiler rejects.
 */
let currentLanguage: Language = "en";
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): Language {
  return currentLanguage;
}

/** The server always renders English. */
function getServerSnapshot(): Language {
  return "en";
}

function applyLanguage(next: Language) {
  currentLanguage = next;
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
  } catch {
    // Storage can be unavailable in private mode — the language still applies
    // for the current session.
  }
  document.documentElement.lang = next;
  emit();
}

/**
 * Read the persisted language once on the client.
 *
 * Called from the provider's effect so the first client render already shows
 * the stored language instead of flashing English.
 */
export function hydrateLanguage() {
  if (typeof window === "undefined") return;
  currentLanguage = readStoredLanguage();
  document.documentElement.lang = currentLanguage;
}

export function I18nProvider({
  children,
  initialLanguage,
}: {
  children: React.ReactNode;
  initialLanguage?: Language;
}) {
  const language = React.useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  React.useEffect(() => {
    if (initialLanguage) {
      applyLanguage(initialLanguage);
      return;
    }
    hydrateLanguage();
    emit();
  }, [initialLanguage]);

  const setLanguage = React.useCallback((next: Language) => {
    applyLanguage(next);
  }, []);

  const value = React.useMemo<I18nContextValue>(() => {
    const dictionary = DICTIONARIES[language];

    return {
      language,
      setLanguage,
      dictionary,
      t: (path: string, params?: TranslateParams) => {
        const template = resolve(dictionary, path) ?? resolve(en, path) ?? path;
        return params ? interpolate(template, params) : template;
      },
    };
  }, [language, setLanguage]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Access the translation function. */
export function useTranslation(): I18nContextValue {
  const context = React.useContext(I18nContext);
  if (!context) {
    throw new Error("useTranslation must be used inside an I18nProvider");
  }
  return context;
}

/** Convenience hook for components that only need the translate function. */
export function useT() {
  return useTranslation().t;
}
