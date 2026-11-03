// src/i18n/index.ts
//
// Task B: bahasa Indonesia (bawaan) dan Inggris, tanpa pustaka dan tanpa modul
// native. Bahasa tidak dideteksi dari perangkat; pilihan pengguna disimpan di
// AsyncStorage.
//
// t() sengaja fungsi modul biasa, supaya teks di luar komponen (pesan galat,
// instruksi navigasi, label daftar) ikut satu kamus. Karena itu:
// - t() hanya dipanggil saat render atau saat peristiwa terjadi, tidak pernah di
//   tingkat modul. Daftar konstan memakai getter. scripts/test-i18n.mts menjaga ini.
// - Berganti bahasa memasang ulang navigator lewat key di app/_layout.tsx. React
//   Compiler menyimpan hasil pemanggilan fungsi per komponen, jadi tanpa pemasangan
//   ulang teks lama bisa tetap tampil.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";
import { en } from "./en";
import { id, type TKey } from "./id";

export type { TKey };
export type Language = "id" | "en";

export const LANGUAGE_STORAGE_KEY = "smartroute.language.v1";

// Nama bahasa selalu ditulis dalam bahasanya sendiri.
export const LANGUAGE_OPTIONS: ReadonlyArray<{ value: Language; label: string }> = [
  { value: "id", label: "Bahasa Indonesia" },
  { value: "en", label: "English" },
];

const DICTIONARIES: Record<Language, Partial<Record<TKey, string>>> = { id, en };

let current: Language = "id";
const listeners = new Set<() => void>();

function apply(next: Language): void {
  if (next === current) return;
  current = next;
  listeners.forEach((listener) => listener());
}

export function getLanguage(): Language {
  return current;
}

export function setLanguage(next: Language): void {
  apply(next);
  AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, next).catch(() => {});
}

/** Baca pilihan tersimpan. Nilai asing diabaikan, bahasa tetap Indonesia. */
export async function hydrateLanguage(): Promise<void> {
  try {
    const saved = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved === "id" || saved === "en") apply(saved);
  } catch {
    // Penyimpanan tidak terbaca: tetap Indonesia.
  }
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Bahasa aktif untuk komponen. SSR selalu Indonesia. */
export function useLanguage(): Language {
  return useSyncExternalStore(subscribe, getLanguage, () => "id");
}

/**
 * Teks untuk kunci kamus. Kunci yang hilang di kamus aktif jatuh ke Indonesia.
 * Kunci yang tidak ada sama sekali menjadi string kosong, bukan kunci mentah.
 */
export function t(key: TKey, params?: Record<string, string | number>): string {
  const template = DICTIONARIES[current][key] ?? id[key] ?? "";
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

// --- Format angka & tanggal. Tanpa Intl: lihat utils/currency.ts. ---------

/** 3500 -> "3.500" (ID) atau "3,500" (EN). Menerima deret angka tanpa tanda. */
export function groupDigits(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, current === "en" ? "," : ".");
}

/** 1.5 -> "1,5" (ID) atau "1.5" (EN). Angkanya sendiri tidak berubah. */
export function decimal(value: number | string): string {
  const text = String(value);
  return current === "en" ? text : text.replace(".", ",");
}

const MONTHS_SHORT: Record<Language, readonly string[]> = {
  id: ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};
const MONTHS_LONG: Record<Language, readonly string[]> = {
  id: ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};
const DAYS_SHORT: Record<Language, readonly string[]> = {
  id: ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"],
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
};

export const monthShort = (index: number) => MONTHS_SHORT[current][index];
export const monthLong = (index: number) => MONTHS_LONG[current][index];
export const dayShort = (index: number) => DAYS_SHORT[current][index];
export const localeTag = () => (current === "en" ? "en-US" : "id-ID");

/** "halte"/"stasiun" (ID) atau "stop(s)"/"station(s)" menurut jumlah (EN). */
export function stopWord(isRail: boolean, count = 1): string {
  if (isRail) return t(count === 1 ? "unit.station" : "unit.stations");
  return t(count === 1 ? "unit.stop" : "unit.stops");
}
