// src/utils/tripPassWallet.ts
//
// Hari 3 Task 3: saldo kartu DEMO untuk Trip Pass — SIMULASI.
// - Tersimpan di perangkat saja (AsyncStorage), BUKAN server.
// - Tidak ada panggilan jaringan, tidak ada koneksi bank, tidak ada pembacaan
//   kartu asli (NFC), tidak ada uang sungguhan.
// Logika murni dipisah dari penyimpanan supaya bisa diuji
// (scripts/test-trip-pass.mts).
import AsyncStorage from "@react-native-async-storage/async-storage";

export const WALLET_KEY = "smartroute.tripPassDemo.v1";
export const DEFAULT_BALANCE = 10_000;
export const MAX_BALANCE = 2_000_000; // batas wajar untuk simulasi
export const TOPUP_OPTIONS = [10_000, 20_000, 50_000, 100_000] as const;

export type BalanceStatus = { status: "cukup"; remaining: number } | { status: "kurang"; shortfall: number };

export function checkBalance(balance: number, total: number): BalanceStatus {
  return balance >= total ? { status: "cukup", remaining: balance - total } : { status: "kurang", shortfall: total - balance };
}

/** Saldo baru setelah top-up simulasi; null bila nominal tidak ada di
 *  pilihan atau melewati batas saldo simulasi. */
export function applyTopUp(balance: number, amount: number): number | null {
  if (!(TOPUP_OPTIONS as readonly number[]).includes(amount)) return null;
  const next = balance + amount;
  return next > MAX_BALANCE ? null : next;
}

export type BalanceInput = { ok: true; value: number } | { ok: false; reason: "negative" | "invalid" };

/**
 * "25.000" / "25000" / "Rp 25.000" -> 25000. Hari 4 Task 1: tanda minus di
 * depan angka ("-5000", "Rp -5.000", minus Unicode) DITOLAK sebagai negatif —
 * dulu semua non-digit dibuang sehingga "-5000" diam-diam menjadi 5000.
 */
export function validateBalanceInput(text: string): BalanceInput {
  const firstDigit = text.search(/\d/);
  const prefix = firstDigit === -1 ? text : text.slice(0, firstDigit);
  if (/[-−–]/.test(prefix)) return { ok: false, reason: "negative" };
  const digits = text.replace(/[^\d]/g, "");
  if (!digits || digits.length > 9) return { ok: false, reason: "invalid" };
  const n = Number(digits);
  return Number.isInteger(n) && n >= 0 && n <= MAX_BALANCE ? { ok: true, value: n } : { ok: false, reason: "invalid" };
}

/** Seperti validateBalanceInput, null bila tidak valid. */
export function parseBalanceInput(text: string): number | null {
  const r = validateBalanceInput(text);
  return r.ok ? r.value : null;
}

export async function loadBalance(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(WALLET_KEY);
    const n = raw == null ? NaN : Number(JSON.parse(raw).balance);
    return Number.isInteger(n) && n >= 0 && n <= MAX_BALANCE ? n : DEFAULT_BALANCE;
  } catch {
    return DEFAULT_BALANCE;
  }
}

export async function saveBalance(balance: number): Promise<void> {
  await AsyncStorage.setItem(WALLET_KEY, JSON.stringify({ balance }));
}
