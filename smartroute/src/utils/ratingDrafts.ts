// src/utils/ratingDrafts.ts
//
// Hari 1 Task 6: draf penilaian per perjalanan di perangkat. Disimpan setiap
// kali isian berubah, sehingga penilaian tidak hilang bila pengiriman gagal
// (jaringan putus, backend mati) — bahkan bila app ditutup. Dihapus hanya
// setelah server mengonfirmasi (201) atau menyatakan sudah dinilai (409).
// Bukan data rahasia (bintang + jawaban + pesan), jadi AsyncStorage biasa.
import AsyncStorage from "@react-native-async-storage/async-storage";

export type Answer = "ya" | "tidak" | null; // null = Lewati

export interface RatingDraft {
  stars: number | null;
  eta: Answer;
  transferRisk: Answer;
  crowd: Answer;
  message: string;
}

export const EMPTY_DRAFT: RatingDraft = { stars: null, eta: null, transferRisk: null, crowd: null, message: "" };

const key = (tripId: string) => `smartroute.ratingDraft.v1.${tripId}`;

export async function loadDraft(tripId: string): Promise<RatingDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(key(tripId));
    return raw ? { ...EMPTY_DRAFT, ...(JSON.parse(raw) as Partial<RatingDraft>) } : null;
  } catch {
    return null;
  }
}

export async function saveDraft(tripId: string, draft: RatingDraft): Promise<void> {
  try {
    await AsyncStorage.setItem(key(tripId), JSON.stringify(draft));
  } catch {
    // Penyimpanan lokal penuh/gagal: pengiriman tetap bisa dicoba.
  }
}

export async function clearDraft(tripId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key(tripId));
  } catch {}
}
