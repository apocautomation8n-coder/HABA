"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import {
  FormatPrefs,
  DEFAULT_FORMAT_PREFS,
  formatMoney as formatMoneyUtil,
  formatNumber as formatNumberUtil,
  parseNumber as parseNumberUtil,
  FormatNumberOptions,
} from "@/lib/formatPrefs";

export interface FormatPrefsContextType {
  currency: string;
  numberLocale: string;
  decimals: number;
  prefs: FormatPrefs;
  formatMoney: (amount: number | null | undefined, override?: Partial<FormatPrefs>) => string;
  formatNumber: (value: number | null | undefined, options?: FormatNumberOptions) => string;
  parseNumber: (
    input: string | number | null | undefined,
    override?: string | Partial<FormatPrefs>
  ) => number;
  setFormatPrefs: (prefs: Partial<FormatPrefs>) => void;
  reloadFormatPrefs: () => Promise<void>;
}

const FormatPrefsContext = createContext<FormatPrefsContextType | null>(null);

const STORAGE_KEY = "haba_format_prefs";

export function FormatPrefsProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefsState] = useState<FormatPrefs>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem(STORAGE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && typeof parsed.currency === "string") {
            return {
              currency: parsed.currency || DEFAULT_FORMAT_PREFS.currency,
              numberLocale: parsed.numberLocale || DEFAULT_FORMAT_PREFS.numberLocale,
              decimals:
                typeof parsed.decimals === "number"
                  ? parsed.decimals
                  : DEFAULT_FORMAT_PREFS.decimals,
            };
          }
        }
      } catch {
        // ignore
      }
    }
    return DEFAULT_FORMAT_PREFS;
  });

  const reloadFormatPrefs = useCallback(async () => {
    try {
      const res = await fetch("/api/user/profile");
      if (res.ok) {
        const data = await res.json();
        const p = data.profile;
        if (p) {
          const nextPrefs: FormatPrefs = {
            currency: p.currency || DEFAULT_FORMAT_PREFS.currency,
            numberLocale:
              p.number_locale || p.numberLocale || DEFAULT_FORMAT_PREFS.numberLocale,
            decimals:
              typeof p.decimals === "number" ? p.decimals : DEFAULT_FORMAT_PREFS.decimals,
          };
          setPrefsState(nextPrefs);
          if (typeof window !== "undefined") {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(nextPrefs));
          }
        }
      }
    } catch (err) {
      console.error("Error loading format preferences:", err);
    }
  }, []);

  useEffect(() => {
    reloadFormatPrefs();

    const handleCustomUpdate = () => {
      try {
        const cached = localStorage.getItem(STORAGE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && typeof parsed.currency === "string") {
            setPrefsState({
              currency: parsed.currency || DEFAULT_FORMAT_PREFS.currency,
              numberLocale: parsed.numberLocale || DEFAULT_FORMAT_PREFS.numberLocale,
              decimals:
                typeof parsed.decimals === "number"
                  ? parsed.decimals
                  : DEFAULT_FORMAT_PREFS.decimals,
            });
          }
        }
      } catch {
        // ignore
      }
    };

    window.addEventListener("haba-format-prefs-updated", handleCustomUpdate);
    window.addEventListener("storage", handleCustomUpdate);
    return () => {
      window.removeEventListener("haba-format-prefs-updated", handleCustomUpdate);
      window.removeEventListener("storage", handleCustomUpdate);
    };
  }, [reloadFormatPrefs]);

  const setFormatPrefs = useCallback((newPrefs: Partial<FormatPrefs>) => {
    setPrefsState((prev) => {
      const updated: FormatPrefs = {
        currency: newPrefs.currency || prev.currency,
        numberLocale: newPrefs.numberLocale || prev.numberLocale,
        decimals:
          typeof newPrefs.decimals === "number" ? newPrefs.decimals : prev.decimals,
      };
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent("haba-format-prefs-updated"));
      }
      return updated;
    });
  }, []);

  const formatMoney = useCallback(
    (amount: number | null | undefined, override?: Partial<FormatPrefs>) => {
      return formatMoneyUtil(amount, {
        currency: override?.currency || prefs.currency,
        numberLocale: override?.numberLocale || prefs.numberLocale,
        decimals:
          typeof override?.decimals === "number" ? override.decimals : prefs.decimals,
      });
    },
    [prefs]
  );

  const formatNumber = useCallback(
    (value: number | null | undefined, options?: FormatNumberOptions) => {
      return formatNumberUtil(value, options, prefs.numberLocale);
    },
    [prefs.numberLocale]
  );

  const parseNumber = useCallback(
    (
      input: string | number | null | undefined,
      override?: string | Partial<FormatPrefs>
    ) => {
      return parseNumberUtil(input, override || prefs);
    },
    [prefs]
  );

  const value = useMemo<FormatPrefsContextType>(
    () => ({
      currency: prefs.currency,
      numberLocale: prefs.numberLocale,
      decimals: prefs.decimals,
      prefs,
      formatMoney,
      formatNumber,
      parseNumber,
      setFormatPrefs,
      reloadFormatPrefs,
    }),
    [prefs, formatMoney, formatNumber, parseNumber, setFormatPrefs, reloadFormatPrefs]
  );

  return (
    <FormatPrefsContext.Provider value={value}>
      {children}
    </FormatPrefsContext.Provider>
  );
}

/**
 * Hook para consumir las preferencias de formato numérico y moneda de la usuaria activa.
 * Expone formatMoney(), formatNumber() y parseNumber().
 * Si se llama fuera de FormatPrefsProvider, tiene un fallback seguro con ARS / es-AR / 2.
 */
export function useFormatPrefs(): FormatPrefsContextType {
  const context = useContext(FormatPrefsContext);
  if (!context) {
    return {
      currency: DEFAULT_FORMAT_PREFS.currency,
      numberLocale: DEFAULT_FORMAT_PREFS.numberLocale,
      decimals: DEFAULT_FORMAT_PREFS.decimals,
      prefs: DEFAULT_FORMAT_PREFS,
      formatMoney: (amt, override) => formatMoneyUtil(amt, override),
      formatNumber: (val, opt) => formatNumberUtil(val, opt),
      parseNumber: (input, override) =>
        parseNumberUtil(input, override || DEFAULT_FORMAT_PREFS),
      setFormatPrefs: () => {},
      reloadFormatPrefs: async () => {},
    };
  }
  return context;
}
