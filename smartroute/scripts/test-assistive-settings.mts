// Hari 3 Task 2: uji bantuan aksesibilitas dengan KODE ASLI app.
//
// Jalankan dari smartroute/ (backend :3000):
//   node --import ./scripts/test-support/register-stubs.mjs --import <tsx>/dist/loader.mjs scripts/test-assistive-settings.mts
import { fetchRealRoutes, adaptToLegacyShape } from "../src/services/routeService";
import { a11yBanner, confidenceDisplay } from "../src/utils/a11yDisplay";
import { ASSISTIVE_KEYS, EASY_READ_SCALE, easyReadStyle, effectiveSettings, SUGGESTED_BY } from "../src/utils/assistiveSettings";
import { plainStep } from "../src/utils/simpleSteps";

const AT = "2026-09-21T07:30:00+07:00";
const S1 = [{ lat: -6.2444643, lng: 106.7981332 }, { lat: -6.1355, lng: 106.8165 }] as const;
let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "LULUS" : "GAGAL"}  ${name}${detail ? `  (${detail})` : ""}`);
}

// --- 1. Bawaan mati; usulan dari profil; pilihan pengguna menang.
const none = effectiveSettings({}, []);
check("S1 tanpa profil & tanpa pilihan: SEMUA bantuan mati", ASSISTIVE_KEYS.every((k) => !none[k].on && !none[k].suggested));
for (const key of ASSISTIVE_KEYS) {
  const need = SUGGESTED_BY[key];
  const s = effectiveSettings({}, [need]);
  const others = ASSISTIVE_KEYS.filter((k) => k !== key).every((k) => !s[k].on);
  check(`S2 profil '${need}' -> hanya '${key}' diusulkan aktif`, s[key].on && s[key].suggested && others);
}
const off = effectiveSettings({ easyRead: false }, ["low_vision"]);
check("S3 pengguna mematikan usulan -> mati, bukan 'diusulkan'", !off.easyRead.on && !off.easyRead.suggested);
const on = effectiveSettings({ simpleNav: true }, []);
check("S4 pengguna menyalakan tanpa profil -> nyala", on.simpleNav.on && !on.simpleNav.suggested);

// --- 2. Tampilan mudah dibaca: skala & kontras (rasio WCAG dihitung).
const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const scaled = easyReadStyle({ fontSize: 12, lineHeight: 16, color: "#737373", fontWeight: "700" });
check(`S5 huruf & tinggi baris diskalakan x${EASY_READ_SCALE}`, scaled.fontSize === 13.8 && scaled.lineHeight === 18.4 && scaled.fontWeight === "700", JSON.stringify(scaled));
for (const [from, bg] of [["#737373", "#F8FAFC"], ["#404040", "#F8FAFC"], ["#A3A3A3", "#FFFFFF"], ["#94A3B8", "#FFFFFF"]] as const) {
  const to = easyReadStyle({ color: from }).color as string;
  const before = contrast(from, bg);
  const after = contrast(to, bg);
  check(`S6 kontras ${from} -> ${to}: ${before.toFixed(1)}:1 -> ${after.toFixed(1)}:1 (naik & >= 4,5 AA)`, after > before && after >= 4.5);
}
check("S7 warna di luar daftar (putih/biru brand) tidak diubah", easyReadStyle({ color: "#FFFFFF" }).color === "#FFFFFF" && easyReadStyle({ color: "#0F3FC1" }).color === "#0F3FC1");

// --- 3. Tampilan tingkat & banner.
check(
  "S8 'tinggi' TIDAK ditampilkan selama data armada tidak lengkap",
  !/armada tercatat bisa/.test(confidenceDisplay({ confidence: "tinggi", summary: "", points: [], trip_data: "tidak_ada" }).label),
);
check("S9 'tinggi' tampil hanya bila data armada lengkap", /armada tercatat bisa/.test(confidenceDisplay({ confidence: "tinggi", summary: "", points: [], trip_data: "lengkap" }).label));
const low = { accessibility: { confidence: "rendah" as const, summary: "", points: [], trip_data: "tidak_ada" as const } };
const unk = { accessibility: { confidence: "tidak_diketahui" as const, summary: "", points: [], trip_data: "tidak_ada" as const } };
check("S10 semua kandidat rendah -> banner terus terang", !!a11yBanner([low, low, low]).allLow && /tercatat tidak bisa diakses kursi roda \(menurut data GTFS\)/.test(a11yBanner([low]).allLow!));
check("S11 campuran -> tidak ada banner 'semua rendah'", a11yBanner([low, unk]).allLow === null);

// --- 4. Request yang BENAR-BENAR dikirim app (fetch dicegat).
const sent: string[] = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
  if (String(url).endsWith("/routes")) sent.push(String(init?.body));
  return realFetch(url as string, init);
}) as typeof fetch;
const resOff = await fetchRealRoutes(S1[0], S1[1], AT, undefined, false);
const resOn = await fetchRealRoutes(S1[0], S1[1], AT, undefined, true);
globalThis.fetch = realFetch;
check(
  "S12 bantuan mati: body request PERSIS seperti Hari 2 (origin, destination, departure_time saja)",
  JSON.stringify(Object.keys(JSON.parse(sent[0]))) === '["origin","destination","departure_time"]',
  sent[0],
);
check('S13 bantuan nyala: body membawa accessibility ["kursi_roda"]', JSON.stringify(JSON.parse(sent[1]).accessibility) === '["kursi_roda"]');
check("S14 bantuan mati: tidak ada info aksesibilitas di RouteItem", adaptToLegacyShape(resOff).routes.every((r) => r.accessibility === undefined));
const realBanner = a11yBanner(adaptToLegacyShape(resOn).routes);
check("S15 data S1 asli: banner umum ada; 'semua rendah' sesuai data", !!realBanner.general, realBanner.allLow ? "semua rendah" : "tidak semua rendah");

// --- 5. Kalimat langkah lugas (mode sederhana & peringatan).
const walk = plainStep({ mode: "Walk", from: "A", to: "Halte Blok M", distance_m: 700 }, false);
const ride = plainStep({ mode: "TransJakarta", service: "1", headsign: "Kota", from: "Blok M", to: "Kota", stops_passed: [{ name: "x", lat: 0, lng: 0 }] }, false);
const inside = plainStep({ mode: "MRT", from: "Blok M", to: "Bundaran HI" }, false, { onBoard: true, stopsRemaining: 3 });
const lastWalk = plainStep({ mode: "Walk", from: "Halte Kota", to: "Kota", distance_m: 300 }, true);
check("S16 jalan kaki: 'Jalan kaki ke <tujuan>' + jarak", walk.title === "Jalan kaki ke Halte Blok M" && /700 m/.test(walk.detail), `${walk.title} / ${walk.detail}`);
check("S17 naik: 'Naik <moda> arah <arah>' + naik/turun di mana", ride.title === "Naik TransJakarta 1 arah Kota" && /Naik di Blok M\. Turun di Kota \(2 halte\)/.test(ride.detail), `${ride.title} / ${ride.detail}`);
check("S18 di dalam kendaraan: 'Turun di <stasiun>' + sisa stasiun", inside.title === "Turun di Bundaran HI" && /3 stasiun/.test(inside.detail), `${inside.title} / ${inside.detail}`);
check("S19 langkah terakhir menyebut tujuan", /tujuan: Kota/.test(lastWalk.title), lastWalk.title);

console.log(failures === 0 ? "\nSemua uji bantuan aksesibilitas lulus." : `\n${failures} uji GAGAL.`);
process.exitCode = failures ? 1 : 0;
