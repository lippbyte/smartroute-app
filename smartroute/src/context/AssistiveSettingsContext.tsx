// src/context/AssistiveSettingsContext.tsx
//
// Hari 3 Task 2: pengaturan bantuan aksesibilitas (lihat
// utils/assistiveSettings.ts). Usulan dibaca dari profil aksesibilitas
// pengguna yang masuk; pilihan pengguna disimpan di perangkat. Tidak ada
// panggilan ke server dari sini.
import { useAuth } from "@/context/AuthContext";
import {
  type AssistiveChoices,
  type AssistiveKey,
  effectiveSettings,
  type EffectiveSetting,
} from "@/utils/assistiveSettings";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "smartroute.assistive.v1";

interface AssistiveContextValue {
  settings: Record<AssistiveKey, EffectiveSetting>;
  /** Pilihan eksplisit pengguna (disimpan di perangkat). */
  setChoice: (key: AssistiveKey, on: boolean) => void;
  /** Kembalikan ke usulan profil (hapus pilihan eksplisit). */
  resetChoice: (key: AssistiveKey) => void;
}

const AssistiveContext = createContext<AssistiveContextValue | null>(null);

export function AssistiveSettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [choices, setChoices] = useState<AssistiveChoices>({});

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => raw && setChoices(JSON.parse(raw) as AssistiveChoices))
      .catch(() => {});
  }, []);

  const persist = useCallback((next: AssistiveChoices) => {
    setChoices(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const value = useMemo<AssistiveContextValue>(
    () => ({
      settings: effectiveSettings(choices, user?.accessibility?.needs ?? []),
      setChoice: (key, on) => persist({ ...choices, [key]: on }),
      resetChoice: (key) => {
        const { [key]: _removed, ...rest } = choices;
        persist(rest);
      },
    }),
    [choices, user, persist],
  );

  return <AssistiveContext.Provider value={value}>{children}</AssistiveContext.Provider>;
}

/** Aman dipakai di luar provider (mis. komponen yang dirender saat uji):
 *  semua bantuan dianggap mati. */
export function useAssistive(): AssistiveContextValue {
  const ctx = useContext(AssistiveContext);
  return (
    ctx ?? {
      settings: effectiveSettings({}, []),
      setChoice: () => {},
      resetChoice: () => {},
    }
  );
}
