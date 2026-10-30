// src/services/tokenStorage.ts
//
// Hari 1 Task 2: penyimpanan sesi login di perangkat. SATU-SATUNYA modul yang
// menyentuh token di penyimpanan lokal — layar & service lain lewat sini.
//
// TODO:verifikasi — keputusan Task 0 no. 1b: memakai AsyncStorage, yang
// TIDAK TERENKRIPSI (di Android berupa database SQLite biasa milik app; di
// web berupa localStorage). Dokumen task meminta expo-secure-store, tetapi
// itu modul native yang butuh build ulang Dev Client (dan tidak jalan di
// web). Saat pindah ke secure-store, cukup ganti isi tiga fungsi sesi di
// bawah; pemanggil tidak perlu berubah.
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AuthUser } from "./authService";

const SESSION_KEY = "smartroute.session.v1";
// Tamu yang sudah menekan "Lanjut sebagai tamu" tidak ditanya lagi setiap
// kali app dibuka (bukan data rahasia, tidak perlu dienkripsi).
const GUEST_KEY = "smartroute.guestChosen.v1";

export interface StoredSession {
  token: string;
  expires_at: string; // ISO 8601, dari backend
  // Salinan profil terakhir: app tetap bisa menampilkan nama pengguna saat
  // dibuka tanpa jaringan, sebelum GET /me sempat menjawab.
  user: AuthUser;
}

export async function loadSession(): Promise<StoredSession | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    return parsed?.token && parsed?.expires_at && parsed?.user ? parsed : null;
  } catch {
    // Isi rusak = anggap tidak ada sesi (pengguna cukup masuk lagi).
    return null;
  }
}

export async function saveSession(session: StoredSession): Promise<void> {
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export async function clearSession(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY);
}

export async function loadGuestChoice(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(GUEST_KEY)) === "1";
  } catch {
    return false;
  }
}

export async function saveGuestChoice(chosen: boolean): Promise<void> {
  if (chosen) await AsyncStorage.setItem(GUEST_KEY, "1");
  else await AsyncStorage.removeItem(GUEST_KEY);
}
