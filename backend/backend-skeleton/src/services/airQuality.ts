// Hari 2 Task 2: kualitas udara tingkat kota Jakarta dari IQAir (AirVisual
// API v2, endpoint /city — paket gratis "Community": data tingkat kota).
//
// - Cache 15 menit di server; semua pengguna memakai satu hasil, dan
//   permintaan bersamaan saat cache kedaluwarsa hanya memicu SATU panggilan
//   (single-flight).
// - Nilai terakhir yang sukses disimpan di DB sebagai cadangan: bila IQAir
//   gagal/kena batas/kunci salah -> nilai itu dikembalikan dengan
//   stale: true. Belum pernah sukses -> available: false (bukan galat).
// - Pagar pemakaian di BAWAH batas paket gratis (5/menit, 500/hari):
//   maks. 4 panggilan per 60 detik dan 480 per 24 jam, dihitung di DB.
//   Setelah gagal, tunggu RETRY_MS sebelum mencoba lagi (bukan tiap request).
// - Kunci (IQAIR_API_KEY) dikirim sebagai query string ke IQAir, jadi URL
//   panggilan TIDAK PERNAH di-log.
import { db } from "../lib/db";

const IQAIR_URL = process.env.IQAIR_URL || "https://api.airvisual.com/v2/city"; // IQAIR_URL hanya untuk uji
// TODO:verifikasi penulisan kota/provinsi/negara yang dikenali IQAir —
// cek dengan GET /v2/cities?state=Jakarta&country=Indonesia begitu kunci ada.
const LOCATION = { city: "Jakarta", state: "Jakarta", country: "Indonesia" };

const envMs = (name: string, fallback: number) => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};
// Dua override di bawah HANYA untuk uji (scripts/test-air-quality.mjs).
const CACHE_MS = envMs("AIR_QUALITY_CACHE_MS", 15 * 60 * 1000);
const RETRY_MS = envMs("AIR_QUALITY_RETRY_MS", 60 * 1000);
const FETCH_TIMEOUT_MS = 8_000;
const MAX_PER_MINUTE = 4; // batas gratis 5
const MAX_PER_DAY = 480; // batas gratis 500

export type AqiCategoryKey = "baik" | "sedang" | "sensitif" | "tidak_sehat" | "sangat_tidak_sehat" | "berbahaya";

// Ambang AQI AS (US EPA).
const CATEGORIES: Array<{ max: number; key: AqiCategoryKey; label: string }> = [
  { max: 50, key: "baik", label: "Baik" },
  { max: 100, key: "sedang", label: "Sedang" },
  { max: 150, key: "sensitif", label: "Tidak sehat bagi kelompok sensitif" },
  { max: 200, key: "tidak_sehat", label: "Tidak sehat" },
  { max: 300, key: "sangat_tidak_sehat", label: "Sangat tidak sehat" },
  { max: Infinity, key: "berbahaya", label: "Berbahaya" },
];

export function categorize(aqiUs: number): { key: AqiCategoryKey; label: string } {
  const c = CATEGORIES.find((x) => aqiUs <= x.max)!;
  return { key: c.key, label: c.label };
}

const POLLUTANTS: Record<string, string> = { p2: "PM2.5", p1: "PM10", o3: "Ozon (O₃)", n2: "NO₂", s2: "SO₂", co: "CO" };

/** Cuaca kota dari respons IQAir yang sama. Nilai yang tidak valid menjadi null. */
interface Weather {
  temp_c: number | null;
  humidity_pct: number | null;
  wind_ms: number | null;
  wind_deg: number | null;
  pressure_hpa: number | null;
  observed_at: string | null;
}

const numberOrNull = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

interface Reading {
  aqi_us: number;
  category: string;
  category_key: AqiCategoryKey;
  pollutant_main: string | null;
  /** Waktu pengukuran menurut IQAir (ISO). */
  observed_at: string | null;
  /** Waktu backend berhasil mengambil data (ISO). */
  fetched_at: string;
  /** undefined hanya pada nilai lama di DB, sebelum cuaca disimpan. */
  weather?: Weather | null;
}

export type AirQualityResponse =
  | ({ available: true; stale: boolean; source: "IQAir"; city: string } & Reading)
  | { available: false; source: "IQAir"; reason: "not_configured" | "unavailable" };

let memo: { reading: Reading; fetchedAtMs: number } | null = null;
let lastFailureMs = 0;
let inFlight: Promise<boolean> | null = null;

function loadPersisted(): void {
  if (memo) return;
  const row = db.prepare("SELECT payload_json, fetched_at FROM air_quality_last WHERE id = 1").get() as
    | { payload_json: string; fetched_at: number }
    | undefined;
  if (row) memo = { reading: JSON.parse(row.payload_json) as Reading, fetchedAtMs: row.fetched_at };
}

/** Pagar pemakaian: boleh memanggil IQAir sekarang? */
function withinQuota(now: number): boolean {
  const minute = (db.prepare("SELECT COUNT(*) AS c FROM iqair_calls WHERE called_at > ?").get(now - 60_000) as { c: number }).c;
  const day = (db.prepare("SELECT COUNT(*) AS c FROM iqair_calls WHERE called_at > ?").get(now - 86_400_000) as { c: number }).c;
  return minute < MAX_PER_MINUTE && day < MAX_PER_DAY;
}

/** Satu panggilan ke IQAir. true = sukses & cache diperbarui. */
async function refresh(): Promise<boolean> {
  const key = process.env.IQAIR_API_KEY;
  if (!key) return false;
  const now = Date.now();
  if (now - lastFailureMs < RETRY_MS || !withinQuota(now)) return false;

  db.prepare("INSERT INTO iqair_calls (called_at) VALUES (?)").run(now);
  db.prepare("DELETE FROM iqair_calls WHERE called_at < ?").run(now - 2 * 86_400_000);

  const url = `${IQAIR_URL}?${new URLSearchParams({ ...LOCATION, key })}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    const body = (await res.json().catch(() => null)) as {
      status?: string;
      data?: {
        message?: string;
        current?: {
          pollution?: { aqius?: number; mainus?: string; ts?: string };
          weather?: { ts?: string; tp?: unknown; hu?: unknown; ws?: unknown; wd?: unknown; pr?: unknown };
        };
      };
    } | null;
    const pollution = body?.data?.current?.pollution;
    const weather = body?.data?.current?.weather;
    if (!res.ok || body?.status !== "success" || typeof pollution?.aqius !== "number") {
      // Tanpa URL (berisi kunci): hanya status & pesan galat IQAir.
      console.warn(`[air-quality] IQAir gagal: HTTP ${res.status} ${body?.data?.message ?? ""}`.trim());
      lastFailureMs = Date.now();
      return false;
    }
    const cat = categorize(pollution.aqius);
    const reading: Reading = {
      aqi_us: pollution.aqius,
      category: cat.label,
      category_key: cat.key,
      pollutant_main: pollution.mainus ? (POLLUTANTS[pollution.mainus] ?? pollution.mainus) : null,
      observed_at: pollution.ts ?? null,
      fetched_at: new Date().toISOString(),
      weather: weather
        ? {
            temp_c: numberOrNull(weather.tp),
            humidity_pct: numberOrNull(weather.hu),
            wind_ms: numberOrNull(weather.ws),
            wind_deg: numberOrNull(weather.wd),
            pressure_hpa: numberOrNull(weather.pr),
            observed_at: weather.ts ?? null,
          }
        : null,
    };
    memo = { reading, fetchedAtMs: Date.now() };
    db.prepare(
      "INSERT INTO air_quality_last (id, payload_json, fetched_at) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET payload_json = excluded.payload_json, fetched_at = excluded.fetched_at",
    ).run(JSON.stringify(reading), memo.fetchedAtMs);
    return true;
  } catch (err) {
    console.warn(`[air-quality] IQAir tidak terjangkau: ${err instanceof Error ? err.name : "galat"}`);
    lastFailureMs = Date.now();
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function getAirQuality(): Promise<AirQualityResponse> {
  loadPersisted();
  // Nilai lama di DB belum memuat cuaca: ambil ulang sekali, tetap lewat pagar pemakaian.
  const fresh = memo && memo.reading.weather !== undefined && Date.now() - memo.fetchedAtMs < CACHE_MS;
  if (!fresh) {
    inFlight ??= refresh().finally(() => {
      inFlight = null;
    });
    await inFlight;
  }
  if (!memo) {
    return { available: false, source: "IQAir", reason: process.env.IQAIR_API_KEY ? "unavailable" : "not_configured" };
  }
  return {
    available: true,
    source: "IQAir",
    city: LOCATION.city,
    ...memo.reading,
    weather: memo.reading.weather ?? null,
    stale: Date.now() - memo.fetchedAtMs >= CACHE_MS,
  };
}
