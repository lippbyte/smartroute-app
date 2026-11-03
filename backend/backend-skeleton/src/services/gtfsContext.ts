// Task Backend-06 (Bagian A): builds the static GTFS "knowledge" text handed
// to the LLM as system-prompt context — built once (memoized here; the
// underlying feed parse is itself memoized in gtfsFeed.ts and warmed at
// server startup, not per-request, per the task brief).
//
// Scope: general facts (fare tiers, operating hours) + the full route list
// (code, name, category, fare) — enough to answer the brief's example
// "standard" questions ("berapa tarif?", "naik koridor apa?") directly from
// route_long_name matching (e.g. "Blok M - Kota" IS route "1"'s long name).
// Per-stop exact departure times are NOT included (would be thousands of
// rows for negligible benefit) — the system prompt explicitly tells the LLM
// to say so rather than guess when asked for a level of detail this context
// doesn't have.
import { getRoutesInfo } from "../lib/gtfsFeed";

// TransJakarta's free-transfer window (Task Backend-03b) — same constant
// idea as routing.ts's FARE_PER_ITINERARY_IDR, restated here in prose for
// the LLM rather than imported, since this is display text, not logic.
const FREE_TRANSFER_HOURS = 3;

// Hotfix TOTO: TOTO hanya menyatakan tarif dasar TransJakarta reguler dan
// mengarahkan layanan khusus ke aplikasi resmi. Angka layanan khusus tidak
// dikirim ke LLM; data GTFS dan tarif di /routes tidak berubah. Dulu teks ini
// menyebut Transjabodetabek "premium/lebih mahal", bertentangan dengan GTFS.
// TODO:verifikasi tarif Royaltrans & Transjabodetabek ke sumber resmi operator:
// GTFS dan /routes sama (Transjabodetabek 18/18 Rp3.500, Royaltrans Rp20.000/
// Rp35.000; scripts/check-tj-special-fares.mjs), tetapi belum dicocokkan ke tarif
// resmi.
const REGULAR_BASE_FARE_IDR = 3500; // sama dengan FARE_PER_ITINERARY_IDR di routing.ts
const SPECIAL_SERVICE_CATEGORIES = new Set(["Royaltrans", "Transjabodetabek"]);

let cachedContextText: string | null = null;

function formatRouteLine(route: ReturnType<typeof getRoutesInfo>[number]): string {
  const fare = SPECIAL_SERVICE_CATEGORIES.has(route.desc)
    ? "tarif: cek aplikasi resmi"
    : route.fareIdr !== undefined
      ? `Rp${route.fareIdr.toLocaleString("id-ID")}`
      : "tarif tidak diketahui";
  return `${route.shortName}: ${route.longName} (${route.desc}) — ${fare}`;
}

export function getGtfsContextText(): string {
  if (cachedContextText) return cachedContextText;

  const routes = getRoutesInfo();
  const routeLines = routes.map(formatRouteLine).join("\n");

  cachedContextText =
    `DATA TRANSJAKARTA (dari feed GTFS statis resmi — jadwal terjadwal, bukan data real-time):\n\n` +
    `Kebijakan tarif: tarif dasar TransJakarta reguler Rp${REGULAR_BASE_FARE_IDR.toLocaleString("id-ID")} ` +
    `sekali tap-in, transfer gratis ke rute lain dalam ${FREE_TRANSFER_HOURS} jam sejak tap-in pertama. ` +
    `Layanan khusus (kategori "Royaltrans" dan "Transjabodetabek"): JANGAN menyebut angka tarifnya dan ` +
    `JANGAN menyebutnya lebih mahal, lebih murah, atau sama dengan tarif reguler; katakan tarifnya perlu ` +
    `dicek di aplikasi resmi TransJakarta. Kalau ditanya tarif TransJakarta secara umum, jawab hanya tarif ` +
    `dasar itu, lalu arahkan layanan khusus ke aplikasi resmi.\n\n` +
    `Jam operasional: mayoritas rute beroperasi sekitar pukul 05:00-22:00 WIB; beberapa rute ` +
    `beroperasi di jam berbeda (mis. layanan bandara). Ini adalah rentang umum dari jadwal feed, ` +
    `bukan jaminan jam pasti tiap rute.\n\n` +
    `DAFTAR RUTE (kode: nama — kategori — tarif):\n${routeLines}`;

  return cachedContextText;
}
