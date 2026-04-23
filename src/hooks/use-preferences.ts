import { useEffect, useState } from "react";
import { getPreferences, subscribePreferences, updatePreferences, type AppPreferences } from "@/lib/app-preferences";

export function usePreferences() {
  const [prefs, setPrefs] = useState<AppPreferences>(() => getPreferences());

  useEffect(() => {
    const unsub = subscribePreferences(setPrefs);
    return () => {
      unsub();
    };
  }, []);

  return { prefs, update: updatePreferences };
}
