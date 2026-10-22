// Klaster halte: peron-peron dari SATU halte fisik yang di GTFS tercatat
// sebagai stop terpisah. Contoh nyatanya: "Monumen Nasional" punya enam
// stop_id berjarak <15 m satu sama lain, dan pencarian halte di UI
// menampilkan keenamnya dengan nama identik. Laporan kepadatan yang masuk ke
// peron yang "salah" dulu tidak berpengaruh ke rute yang lewat peron
// sebelahnya — presenter demo punya peluang 4 banding 6 untuk gagal.
//
// Dua stop masuk satu klaster kalau: feed-nya sama, namanya sama (setelah
// dinormalisasi), DAN berjarak <= CLUSTER_RADIUS_M. Syarat jarak mencegah halte
// senama yang berjauhan ikut tergabung; syarat feed mencegah fasilitas beda
// operator (mis. halte TJ vs stasiun MRT bernama sama) saling menimpa, karena
// antreannya memang terpisah. Lihat scripts/audit-stop-clusters.ts.
import { getAllOtpStops, type OtpStop } from "../lib/otpClient";

// ASUMSI, bukan temuan data: peron senama dalam 100 m dianggap berbagi satu
// antrean. Hanya Flyover Jatinegara (98 m) dan Grogol Reformasi (83 m) yang
// hasilnya berbeda dengan radius 50 m — lihat "Known limitations" di README.
export const CLUSTER_RADIUS_M = 100;

const RETRY_MS = 30_000;

export function normalizeStopName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** "1:G00042" -> "1". OTP2 memberi prefiks id feed pada setiap gtfsId. */
export function feedOf(gtfsId: string): string {
  const idx = gtfsId.indexOf(":");
  return idx === -1 ? "" : gtfsId.slice(0, idx);
}

export function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const r = 6371000;
  const p1 = (a.lat * Math.PI) / 180;
  const p2 = (b.lat * Math.PI) / 180;
  const dp = p2 - p1;
  const dl = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

/**
 * @returns gtfsId -> seluruh anggota klasternya (termasuk dirinya sendiri).
 *   Stop tanpa pasangan tidak dimasukkan; pemanggil memperlakukannya sebagai
 *   klaster satu anggota.
 */
export function buildStopClusters(stops: OtpStop[], radiusM: number): Map<string, string[]> {
  const groups = new Map<string, OtpStop[]>();
  for (const s of stops) {
    const key = `${feedOf(s.gtfsId)}|${normalizeStopName(s.name)}`;
    const g = groups.get(key);
    if (g) g.push(s);
    else groups.set(key, [s]);
  }

  const index = new Map<string, string[]>();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    // Union-find di dalam satu grup senama. Grupnya kecil (paling banyak
    // belasan peron), jadi perbandingan berpasangan tidak jadi masalah.
    const parent = group.map((_, i) => i);
    const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        if (haversineM(group[i], group[j]) <= radiusM) parent[find(i)] = find(j);
      }
    }
    const byRoot = new Map<number, string[]>();
    group.forEach((s, i) => {
      const root = find(i);
      const members = byRoot.get(root);
      if (members) members.push(s.gtfsId);
      else byRoot.set(root, [s.gtfsId]);
    });
    for (const members of byRoot.values()) {
      if (members.length < 2) continue;
      for (const id of members) index.set(id, members);
    }
  }
  return index;
}

let clusterIndex: Map<string, string[]> | null = null;

/**
 * Anggota klaster dari sebuah stop, termasuk dirinya sendiri. Selama indeks
 * belum termuat (OTP2 belum siap saat backend start), jatuh ke perilaku lama:
 * hanya stop itu sendiri — laporan tetap berfungsi, cuma belum digabung.
 */
export function clusterMembersOf(stopId: string): string[] {
  return clusterIndex?.get(stopId) ?? [stopId];
}

async function loadStopClusters(): Promise<void> {
  const stops = await getAllOtpStops();
  clusterIndex = buildStopClusters(stops, CLUSTER_RADIUS_M);
  const clusters = new Set(clusterIndex.values()).size;
  console.log(
    `[stopClusters] ${clusters} klaster peron (${clusterIndex.size} stop) dari ${stops.length} stop, radius ${CLUSTER_RADIUS_M} m`
  );
}

/**
 * Dipanggil sekali saat startup. OTP2 sering belum siap ketika backend
 * menyala (graph masih dimuat), jadi dicoba ulang sampai berhasil, tanpa
 * pernah menahan startup server.
 */
export function preloadStopClusters(): void {
  loadStopClusters().catch((err) => {
    console.warn(
      `[stopClusters] gagal memuat daftar halte dari OTP2 (${err?.message ?? err}); coba lagi ${RETRY_MS / 1000} detik lagi`
    );
    setTimeout(preloadStopClusters, RETRY_MS);
  });
}
