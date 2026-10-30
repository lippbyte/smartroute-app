// src/context/AuthContext.tsx
//
// Hari 1 Task 2: status login seluruh app.
//   loading   — membaca sesi tersimpan (sekali saat app dibuka)
//   signedOut — belum masuk & belum memilih tamu -> layar Masuk
//   guest     — tamu: semua fitur inti tetap jalan (login BUKAN syarat
//               mencari rute — aturan main no. 1)
//   signedIn  — masuk; token dipakai untuk riwayat, rating, TOTO
//
// Sesi dipulihkan dari salinan lokal SEGERA (tanpa menunggu jaringan),
// lalu dicek ke GET /me di latar belakang: kalau server bilang token tidak
// berlaku -> kembali ke Masuk dengan pesan jelas. Kalau jaringan putus,
// sesi lokal tetap dipakai (pengguna tidak dikeluarkan hanya karena offline).
import * as authService from "@/services/authService";
import { ApiError, setSessionInvalidHandler } from "@/services/apiClient";
import * as tokenStorage from "@/services/tokenStorage";
import type { AuthUser, RegisterInput } from "@/services/authService";
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type AuthStatus = "loading" | "signedOut" | "guest" | "signedIn";

const SESSION_EXPIRED_NOTICE = "Sesi Anda sudah berakhir. Silakan masuk lagi.";

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  token: string | null;
  /** Pesan untuk layar Masuk (mis. sesi berakhir); null bila tidak ada. */
  notice: string | null;
  clearNotice: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: RegisterInput) => Promise<void>;
  continueAsGuest: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Ganti salinan profil setelah PUT /me/... berhasil. */
  replaceUser: (user: AuthUser) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [session, setSession] = useState<tokenStorage.StoredSession | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const expireSession = useCallback(async (message: string) => {
    await tokenStorage.clearSession();
    await tokenStorage.saveGuestChoice(false);
    setSession(null);
    setNotice(message);
    setStatus("signedOut");
  }, []);

  // Pulihkan sesi saat app dibuka.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await tokenStorage.loadSession();
      if (cancelled) return;
      if (stored && new Date(stored.expires_at).getTime() > Date.now()) {
        setSession(stored);
        setStatus("signedIn");
        try {
          const fresh = await authService.fetchMe(stored.token);
          if (cancelled) return;
          const updated = { ...stored, user: fresh };
          setSession(updated);
          await tokenStorage.saveSession(updated);
        } catch {
          // 401 sudah ditangani onSessionInvalid; galat jaringan: tetap
          // pakai salinan lokal.
        }
        return;
      }
      if (stored) {
        await expireSession(SESSION_EXPIRED_NOTICE);
        return;
      }
      setStatus((await tokenStorage.loadGuestChoice()) ? "guest" : "signedOut");
    })();
    return () => {
      cancelled = true;
    };
  }, [expireSession]);

  // Token ditolak server di tengah pemakaian (kedaluwarsa / dicabut).
  useEffect(() => {
    setSessionInvalidHandler(() => {
      void expireSession(SESSION_EXPIRED_NOTICE);
    });
    return () => setSessionInvalidHandler(null);
  }, [expireSession]);

  const startSession = useCallback(async (res: authService.SessionResponse) => {
    const next = { token: res.token, expires_at: res.expires_at, user: res.user };
    await tokenStorage.saveSession(next);
    await tokenStorage.saveGuestChoice(false);
    setSession(next);
    setNotice(null);
    setStatus("signedIn");
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user: session?.user ?? null,
      token: session?.token ?? null,
      notice,
      clearNotice: () => setNotice(null),
      signIn: async (email, password) => startSession(await authService.login(email.trim(), password)),
      signUp: async (input) => startSession(await authService.register({ ...input, email: input.email.trim() })),
      continueAsGuest: async () => {
        await tokenStorage.saveGuestChoice(true);
        setNotice(null);
        setStatus("guest");
      },
      signOut: async () => {
        const token = session?.token;
        await tokenStorage.clearSession();
        await tokenStorage.saveGuestChoice(false);
        setSession(null);
        setNotice(null);
        setStatus("signedOut");
        // Cabut token di server; kalau offline, token lama kedaluwarsa
        // sendiri sesuai masa berlakunya (salinan lokal sudah dihapus).
        if (token) authService.logout(token).catch((err: unknown) => {
          if (!(err instanceof ApiError)) console.warn("Logout gagal:", err);
        });
      },
      replaceUser: (user) => {
        setSession((prev) => {
          if (!prev) return prev;
          const next = { ...prev, user };
          void tokenStorage.saveSession(next);
          return next;
        });
      },
    }),
    [status, session, notice, startSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth harus dipakai di dalam <AuthProvider>.");
  return ctx;
}
