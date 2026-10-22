// src/utils/quickLocations.ts
//
// Perluasan Task App-21 (diminta user langsung): "Tujuan Cepat" (Kantor/
// Kampus/Rumah) di Beranda sebelumnya murni dekoratif — onPress tidak
// pernah diisi. Ini penyimpanan lokal (AsyncStorage, persisten antar
// sesi) untuk lokasi yang user simpan sendiri per slot, dipakai untuk isi
// cepat field "Tujuan" — baik untuk pemakaian sehari-hari maupun untuk
// testing app cepat (alasan eksplisit user), tanpa perlu ketik ulang nama
// tempat tiap kali.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Coordinate } from "./geocode";

export type QuickLocationSlot = "kantor" | "kampus" | "rumah";

export interface SavedQuickLocation {
  label: string;
  coordinate: Coordinate;
}

const STORAGE_KEY_PREFIX = "smartroute:quickLocation:";

function storageKey(slot: QuickLocationSlot): string {
  return `${STORAGE_KEY_PREFIX}${slot}`;
}

/**
 * Ambil SEMUA slot sekaligus (3x AsyncStorage.getItem, semua slot selalu
 * dibaca bareng saat Beranda dibuka) — lebih ringkas daripada pemanggil
 * memanggil getQuickLocation() tiga kali terpisah.
 */
export async function getAllQuickLocations(): Promise<
  Record<QuickLocationSlot, SavedQuickLocation | null>
> {
  const slots: QuickLocationSlot[] = ["kantor", "kampus", "rumah"];
  const entries = await Promise.all(
    slots.map(async (slot) => {
      try {
        const raw = await AsyncStorage.getItem(storageKey(slot));
        return [slot, raw ? (JSON.parse(raw) as SavedQuickLocation) : null] as const;
      } catch (error) {
        // Data korup/tidak bisa di-parse -> perlakukan sebagai "belum
        // diisi", bukan crash Beranda gara-gara satu slot rusak.
        console.error(`Gagal membaca lokasi cepat "${slot}":`, error);
        return [slot, null] as const;
      }
    }),
  );
  return Object.fromEntries(entries) as Record<
    QuickLocationSlot,
    SavedQuickLocation | null
  >;
}

export async function saveQuickLocation(
  slot: QuickLocationSlot,
  location: SavedQuickLocation,
): Promise<void> {
  await AsyncStorage.setItem(storageKey(slot), JSON.stringify(location));
}

export async function removeQuickLocation(
  slot: QuickLocationSlot,
): Promise<void> {
  await AsyncStorage.removeItem(storageKey(slot));
}
