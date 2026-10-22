// scripts/scrape-mrt.ts
//
// Task Backend-12: scrape data MRT Jakarta dari API tidak resmi
// https://github.com/reksamamur/mrt-jakarta-api SEKALI-JALAN, simpan sebagai
// JSON statis di src/data/mrtSchedulesEstimates.json. Terpisah dari runtime
// backend Express (pola sama seperti otp2-setup/scripts/download-gtfs.sh) —
// dijalankan manual lewat `npm run scrape:mrt`, TIDAK pernah dipanggil dari
// app.ts. Backend yang jalan saat demo tidak boleh bergantung ke API pihak
// ketiga ini secara live (proyek hobi kecil di Railway, uptime tidak
// terjamin).
//
// STATUS PER VERIFIKASI 2026-09-19: base URL resmi di README repo
// (https://mrt-jakarta-api-production.up.railway.app/v1) mengembalikan
// 404 "Application not found" dari Railway (x-railway-fallback: true) di
// SEMUA endpoint — bukan 404 dari aplikasinya, tapi tanda proyek Railway-nya
// sudah tidak ter-deploy sama sekali. Skrip ini ditulis mengikuti skema
// response yang didokumentasikan di README repo (dicross-check ke
// mrt-doc-api.vercel.app, sama persis), TAPI BELUM PERNAH berhasil
// dijalankan sampai selesai terhadap API yang benar-benar hidup. Kalau
// dijalankan dan API masih/kembali mati, skrip akan gagal jelas (exit
// non-zero) di panggilan pertama — jangan diasumsikan berhasil tanpa cek
// exit code dan isi file output.
//
// Cakupan scraping (sesuai batasan task):
//   1. GET /stations                              — semua stasiun
//   2. GET /station/{id}/schedules                 — jadwal weekday/weekend
//   3. GET /station/{id}/estimates/{id2}            — estimasi waktu+tarif,
//      SEMUA kombinasi (bukan permutasi) pasangan stasiun — wajar untuk 13
//      stasiun (~78 kombinasi).
// SENGAJA TIDAK men-scrape:
//   - /schedules/now dan /schedules/{timestamp} — turunan dari jadwal
//     mentah di atas, bisa dihitung backend sendiri kalau dibutuhkan.
//   - /retail dan /facilities — di luar cakupan task (tidak menambah nilai
//     ke hasil rute).
//
// Kalau struktur response API berubah dari yang didokumentasikan, skrip ini
// throw error jelas dan TIDAK menulis file output — supaya tidak ada yang
// tanpa sadar memakai data yang salah/using stale assumption.

import { writeFile } from "node:fs/promises";
import path from "node:path";

const BASE_URL =
  process.env.MRT_API_BASE_URL?.replace(/\/+$/, "") ??
  "https://mrt-jakarta-api-production.up.railway.app/v1";
const DELAY_MS = Number(process.env.MRT_SCRAPE_DELAY_MS ?? 400);
const MAX_RETRIES = 3;
const OUTPUT_PATH = path.resolve(__dirname, "../src/data/mrtSchedulesEstimates.json");

interface ApiEnvelope<T> {
  status: string;
  code: number;
  data: T;
  message: string;
}

interface ApiStation {
  nid: string;
  title: string;
  catatan: string | null;
  isbig: number;
  path: string;
  peta_lokalitas?: string;
  banner?: string;
  urutan: number;
}

interface ApiScheduleEntry {
  location: string;
  times: {
    weekdays: string[];
    weekends: string[];
  };
}

interface ApiEstimate {
  stasiun_nid: string;
  tarif: string;
  waktu: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson<T>(url: string): Promise<ApiEnvelope<T>> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 429) {
        const backoff = 1000 * attempt;
        console.warn(`  [429 rate limited] ${url} — retry in ${backoff}ms (attempt ${attempt}/${MAX_RETRIES})`);
        await sleep(backoff);
        continue;
      }
      const text = await res.text();
      let body: unknown;
      try {
        body = JSON.parse(text);
      } catch {
        throw new Error(
          `Response bukan JSON valid dari ${url} (HTTP ${res.status}). Body (dipotong): ${text.slice(0, 300)}`,
        );
      }
      if (!res.ok) {
        throw new Error(
          `HTTP ${res.status} dari ${url}: ${JSON.stringify(body).slice(0, 300)}`,
        );
      }
      const envelope = body as Partial<ApiEnvelope<T>>;
      if (envelope.status !== "success" || envelope.data === undefined) {
        throw new Error(
          `Struktur response tidak sesuai dokumentasi dari ${url}: ${JSON.stringify(body).slice(0, 300)}. ` +
            `API mungkin sudah berubah struktur — verifikasi ulang manual sebelum lanjut, JANGAN asumsikan data lama masih valid.`,
        );
      }
      return envelope as ApiEnvelope<T>;
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_RETRIES) {
        console.warn(`  [gagal, attempt ${attempt}/${MAX_RETRIES}] ${url}: ${(err as Error).message}`);
        await sleep(500 * attempt);
      }
    }
  }
  throw new Error(`Gagal fetch ${url} setelah ${MAX_RETRIES} percobaan: ${(lastErr as Error)?.message ?? lastErr}`);
}

function combinations<T>(items: T[]): [T, T][] {
  const pairs: [T, T][] = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      pairs.push([items[i], items[j]]);
    }
  }
  return pairs;
}

async function main() {
  console.log(`Base URL: ${BASE_URL}`);
  console.log("Step 1/3: GET /stations ...");
  const stationsResp = await fetchJson<ApiStation[]>(`${BASE_URL}/stations`);
  const stations = stationsResp.data;
  if (!Array.isArray(stations) || stations.length === 0) {
    throw new Error("Response /stations kosong atau bukan array — cek manual, jangan lanjut scraping.");
  }
  console.log(`  OK: ${stations.length} stasiun ditemukan.`);
  await sleep(DELAY_MS);

  console.log("Step 2/3: GET /station/{id}/schedules untuk tiap stasiun ...");
  const schedules: Record<string, ApiScheduleEntry[]> = {};
  for (const station of stations) {
    console.log(`  - ${station.nid} (${station.title})`);
    const resp = await fetchJson<ApiScheduleEntry[]>(`${BASE_URL}/station/${station.nid}/schedules`);
    schedules[station.nid] = resp.data;
    await sleep(DELAY_MS);
  }

  console.log("Step 3/3: GET /station/{id}/estimates/{id2} untuk semua kombinasi pasangan stasiun ...");
  const pairs = combinations(stations);
  console.log(`  ${pairs.length} kombinasi pasangan (dari ${stations.length} stasiun).`);
  const estimates: Array<{ fromNid: string; toNid: string; waktuMenit: number; tarifRupiah: number }> = [];
  for (const [a, b] of pairs) {
    console.log(`  - ${a.nid} -> ${b.nid}`);
    const resp = await fetchJson<ApiEstimate>(`${BASE_URL}/station/${a.nid}/estimates/${b.nid}`);
    estimates.push({
      fromNid: a.nid,
      toNid: resp.data.stasiun_nid,
      waktuMenit: Number(resp.data.waktu),
      tarifRupiah: Number(resp.data.tarif),
    });
    await sleep(DELAY_MS);
  }

  const output = {
    scrapedAt: new Date().toISOString(),
    sourceApiBaseUrl: BASE_URL,
    sourceRepo: "https://github.com/reksamamur/mrt-jakarta-api",
    stations: stations.map((s) => ({
      nid: s.nid,
      title: s.title,
      urutan: s.urutan,
    })),
    schedules,
    estimates,
  };

  await writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2) + "\n", "utf-8");
  console.log(`\nOK: data ditulis ke ${OUTPUT_PATH}`);
  console.log(`  ${stations.length} stasiun, ${Object.keys(schedules).length} jadwal, ${estimates.length} estimasi.`);
}

main().catch((err) => {
  console.error("\nSCRAPING GAGAL — file output TIDAK ditulis (data lama, kalau ada, tidak diubah):");
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
