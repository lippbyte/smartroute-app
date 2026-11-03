// Task B: uji modul bahasa dan kamusnya, tanpa jaringan.
//
//   node --import ./scripts/test-support/register-stubs.mjs --import <tsx>/dist/loader.mjs scripts/test-i18n.mts
//
// Butuh ASYNC_STORAGE_FILE (AsyncStorage tiruan berbasis berkas) untuk uji
// "pilihan bertahan setelah app dibuka ulang": proses anak meniru pembukaan ulang.
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { en } from "../src/i18n/en";
import { id, type TKey } from "../src/i18n/id";
import { decimal, getLanguage, groupDigits, hydrateLanguage, LANGUAGE_OPTIONS, LANGUAGE_STORAGE_KEY, setLanguage, stopWord, t } from "../src/i18n";
import { formatCo2 } from "../src/utils/co2Format";
import { formatRupiah } from "../src/utils/currency";
import { formatDistance } from "../src/utils/navInstructions";
import { formatRange, formatTripDate } from "../src/utils/tripFormat";
import { formatReportedAt } from "../src/components/crowd/crowdLevel";

// Proses anak: membaca pilihan seperti saat app dibuka.
if (process.argv[2] === "child") {
  await hydrateLanguage();
  console.log(`bahasa=${getLanguage()} ${t("common.cancel")}`);
  process.exit(0);
}
// Proses anak: memilih bahasa lewat jalur yang sama dengan tombol di layar.
if (process.argv[2] === "choose") {
  setLanguage(process.argv[3] as "id" | "en");
  await new Promise((r) => setTimeout(r, 50));
  process.exit(0);
}

const require = createRequire(import.meta.url);
const ts = require("typescript");
const { renderableStrings } = await import("./scan-ui-text.mjs");

let failures = 0;
let checks = 0;
function check(name: string, ok: boolean, detail = "") {
  checks++;
  if (!ok) failures++;
  console.log(`${ok ? "LULUS" : "GAGAL"}  ${name}${detail ? `  (${detail})` : ""}`);
}

const ROOT = path.join(import.meta.dirname, "..");
const SRC = path.join(ROOT, "src");
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) return walk(p);
    return /\.(ts|tsx)$/.test(name) && !name.endsWith(".d.ts") ? [p] : [];
  });
const files = walk(SRC);
const rel = (p: string) => path.relative(ROOT, p).replace(/\\/g, "/");

// --- Kamus.
const idKeys = Object.keys(id) as TKey[];
const enKeys = Object.keys(en) as TKey[];
check("K1 kamus tidak kosong", idKeys.length >= 500, `${idKeys.length} kunci`);
check("K2 kunci id = en", idKeys.length === enKeys.length && idKeys.every((k) => k in en) && enKeys.every((k) => k in id), `${idKeys.length}/${enKeys.length}`);
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
const badParams = idKeys.filter((k) => placeholders(id[k]) !== placeholders(en[k]));
check("K3 placeholder setiap kunci sama di kedua kamus", badParams.length === 0, badParams.join(", "));
const empty = idKeys.filter((k) => !id[k].trim() || !en[k].trim());
check("K4 tidak ada teks kosong", empty.length === 0, empty.join(", "));
const SAME_OK = /^(a11y\.role\.transfer|unit\.)/;
const same = idKeys.filter((k) => id[k] === en[k] && !SAME_OK.test(k));
check("K5 teks Inggris memang diterjemahkan, bukan salinan Indonesia", same.length === 0, same.join(", "));

// --- t().
check("T1 bawaan Indonesia tanpa pilihan tersimpan", getLanguage() === "id" && t("common.cancel") === "Batal");
setLanguage("en");
check("T2 setelah pilih EN, teks Inggris", t("common.cancel") === "Cancel");
check("T3 parameter diisi", t("format.minutes", { n: 5 }) === "5 min");
const removed = (en as Record<string, string>)["common.cancel"];
delete (en as Record<string, string>)["common.cancel"];
check("T4 kunci EN yang hilang jatuh ke Indonesia", t("common.cancel") === "Batal", t("common.cancel"));
(en as Record<string, string>)["common.cancel"] = removed;
check("T5 kunci tak dikenal tidak menampilkan kunci mentah", t("tidak.ada" as TKey) === "");
check("T6 bahasa memakai namanya sendiri", LANGUAGE_OPTIONS.map((o) => o.label).join("|") === "Bahasa Indonesia|English");

// --- Format: angkanya sama, tanda baca mengikuti bahasa.
const digitsOf = (s: string) => s.replace(/\D/g, "");
setLanguage("id");
const rpId = formatRupiah(1234500);
const co2Id = formatCo2(1234);
const distId = formatDistance(1234);
const rangeId = formatRange({ min: 88, max: 102 });
const dateId = formatTripDate("2026-10-30T10:05:00.000Z");
const reportedId = formatReportedAt("2026-08-06T11:58:00.000Z");
const decId = decimal(1.5);
setLanguage("en");
const rpEn = formatRupiah(1234500);
const co2En = formatCo2(1234);
const distEn = formatDistance(1234);
const rangeEn = formatRange({ min: 88, max: 102 });
const dateEn = formatTripDate("2026-10-30T10:05:00.000Z");
const reportedEn = formatReportedAt("2026-08-06T11:58:00.000Z");
const decEn = decimal(1.5);
check("F1 rupiah tetap Rp, tanda ribuan mengikuti bahasa", rpId === "Rp 1.234.500" && rpEn === "Rp 1,234,500", `${rpId} / ${rpEn}`);
check("F2 angka rupiah tidak berubah", digitsOf(rpId) === digitsOf(rpEn) && digitsOf(rpId) === "1234500");
check("F3 desimal mengikuti bahasa", co2Id === "1,2 kg" && co2En === "1.2 kg" && distId === "1,2 km" && distEn === "1.2 km" && decId === "1,5" && decEn === "1.5", `${co2Id} / ${co2En}`);
check("F4 satuan menit", rangeId === "88–102 mnt" && rangeEn === "88–102 min");
check("F5 tanggal: nama hari & bulan mengikuti bahasa, angkanya sama", /Okt 2026/.test(dateId) && /Oct 2026/.test(dateEn) && digitsOf(dateId) === digitsOf(dateEn), `${dateId} / ${dateEn}`);
check("F6 jam laporan: titik di ID, titik dua di EN", /Agu 2026, \d\d\.58$/.test(reportedId) && /Aug 2026, \d\d:58$/.test(reportedEn), `${reportedId} / ${reportedEn}`);
check("F7 satuan halte Inggris mengikuti jumlah", stopWord(false, 1) === "stop" && stopWord(false, 2) === "stops" && stopWord(true, 3) === "stations");
check("F8 pengelompokan angka", groupDigits("3500") === "3,500");
setLanguage("id");
check("F9 kembali ke ID: format kembali", formatRupiah(3500) === "Rp 3.500" && stopWord(false, 2) === "halte");

// --- Pilihan bertahan setelah app dibuka ulang.
const store = path.join(tmpdir(), `smartroute-i18n-${process.pid}.json`);
const reopen = () =>
  execFileSync(process.execPath, [...process.execArgv, import.meta.filename, "child"], { env: { ...process.env, ASYNC_STORAGE_FILE: store }, encoding: "utf8" }).trim();
const choose = (lang: string) =>
  execFileSync(process.execPath, [...process.execArgv, import.meta.filename, "choose", lang], { env: { ...process.env, ASYNC_STORAGE_FILE: store }, stdio: "ignore" });
rmSync(store, { force: true });
check("S1 buka pertama, belum ada pilihan: Indonesia", reopen() === "bahasa=id Batal", reopen());
choose("en");
check("S2 pilihan EN bertahan setelah dibuka ulang", reopen() === "bahasa=en Cancel", reopen());
check("S2a pilihan tersimpan di kunci yang benar", JSON.parse(readFileSync(store, "utf8"))[LANGUAGE_STORAGE_KEY] === "en");
choose("id");
check("S3 kembali ke ID bertahan setelah dibuka ulang", reopen() === "bahasa=id Batal", reopen());
writeFileSync(store, JSON.stringify({ [LANGUAGE_STORAGE_KEY]: "fr" }));
check("S4 nilai asing diabaikan, tetap Indonesia", reopen() === "bahasa=id Batal", reopen());
rmSync(store, { force: true });

// --- Sumber.
const moduleSrc = readFileSync(path.join(SRC, "i18n", "index.ts"), "utf8");
check("A1 tanpa deteksi bahasa perangkat", !/expo-localization|navigator\.language|getLocales|I18nManager/.test(moduleSrc));
const pkg = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));
check("A2 tanpa paket native baru", !pkg.dependencies["expo-localization"] && !pkg.dependencies["i18next"]);
check("A3 Text.tsx tidak diubah untuk bahasa", !/i18n/.test(readFileSync(path.join(SRC, "components", "Text.tsx"), "utf8")));

// t() di tingkat modul membekukan teks pada bahasa saat modul dimuat.
const moduleLevel: string[] = [];
for (const f of files) {
  if (f.includes(`${path.sep}i18n${path.sep}`)) continue;
  const src = readFileSync(f, "utf8");
  if (!/\bt\(/.test(src)) continue;
  const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, f.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const visit = (node: any, inFn: boolean) => {
    const fn = inFn || ts.isFunctionLike(node);
    if (!fn && ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "t") {
      moduleLevel.push(`${rel(f)}:${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1}`);
    }
    ts.forEachChild(node, (c: any) => visit(c, fn));
  };
  visit(sf, false);
}
check("A4 t() tidak dipanggil di tingkat modul", moduleLevel.length === 0, moduleLevel.join(", "));

// Setiap kunci dipakai: kamus tidak menyimpan teks mati.
const literals = new Set<string>();
for (const f of files) {
  if (/i18n[\\/](id|en)\.ts$/.test(f)) continue;
  const src = readFileSync(f, "utf8");
  const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, f.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const visit = (node: any) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) literals.add(node.text);
    ts.forEachChild(node, visit);
  };
  visit(sf);
}
const dead = idKeys.filter((k) => !literals.has(k));
check("A5 setiap kunci kamus dipakai", dead.length === 0, dead.join(", "));

// --- Cakupan: layar dalam daftar Task B tidak menyisakan teks Indonesia buatan app.
const IN_SCOPE = [
  "src/app/(tabs)/account.tsx", "src/app/(tabs)/history.tsx", "src/app/(tabs)/index.tsx", "src/app/(tabs)/route/index.tsx", "src/app/(tabs)/route/[id].tsx",
  "src/app/about.tsx", "src/app/air-quality.tsx", "src/app/assistant.tsx", "src/app/login.tsx", "src/app/navigate.tsx", "src/app/onboarding.tsx", "src/app/register.tsx", "src/app/trip-pass.tsx", "src/app/trip/[id].tsx",
  "src/components/A11yInfoSheet.tsx", "src/components/AccessibilityCard.tsx", "src/components/AccountCard.tsx", "src/components/AirQualityCard.tsx", "src/components/AssistiveSettingsCard.tsx", "src/components/BadgeInfoSheet.tsx", "src/components/CustomTabBar.tsx", "src/components/DepartureTimeField.tsx", "src/components/HistoryCard.tsx", "src/components/LocationAutocompleteField.tsx", "src/components/PreferenceCard.tsx", "src/components/QuickLocationCard.tsx", "src/components/QuickLocationPickerModal.tsx", "src/components/RealTimeInfoCard.tsx", "src/components/RouteCard.tsx", "src/components/RouteDetailCard.tsx", "src/components/SimulationBanner.tsx", "src/components/TopNav.tsx",
  "src/app/crowd-map.tsx", "src/components/crowd/CrowdReportModal.tsx", "src/components/crowd/CrowdMapView.web.tsx", "src/components/crowd/CrowdMapView.native.tsx", "src/components/crowd/crowdLevel.ts", "src/services/crowdService.ts",
  "src/components/account/SideMenu.tsx", "src/components/form/AccessibilityForm.tsx", "src/components/form/FormField.tsx", "src/components/navigate/NavAlert.tsx", "src/components/navigate/NavBanner.tsx", "src/components/navigate/NavPanel.tsx", "src/components/navigate/SimpleNavView.tsx", "src/components/navigate/TripSummary.tsx", "src/components/transit/StopActionButtons.tsx", "src/components/trip/RatingSheet.tsx", "src/components/trip/TripBits.tsx",
  "src/constants/developerInfo.ts", "src/constants/preferenceLabels.ts", "src/utils/a11yDisplay.ts", "src/utils/assistiveSettings.ts", "src/utils/departureTime.ts", "src/utils/gpsNotice.ts", "src/utils/routeBadges.ts", "src/utils/simpleSteps.ts", "src/utils/tripFormat.ts",
];
const ID_WORDS = /\b(lapor|laporan|padat|lengang|yang|dengan|untuk|dari|atau|tidak|belum|sudah|masuk|daftar|keluar|lewati|simpan|batal|tutup|kembali|coba|lagi|halte|stasiun|jalan kaki|menit|mnt|tarif|saldo|riwayat|perjalanan|penilaian|kepadatan|akun|beranda|tujuan|berangkat|langkah|selesai|sekarang|hari ini|sumber|diperbarui|ketuk|pilih|cari|memuat|menyimpan|gratis|kartu|bantuan|tampilan)\b/i;
// Bukan teks tampilan: nilai logika, kunci penyimpanan, dan rute.
const NOT_UI = /^(\/|smartroute|#|CROWD_MAP_REPORT_STOP|<!DOCTYPE html>)|^(ya|tidak|pilih|selesai)$|^(kursi_roda|tidak_diketahui)$/;
const leftovers: string[] = [];
for (const r of IN_SCOPE) {
  const f = path.join(ROOT, r);
  for (const s of renderableStrings(f, readFileSync(f, "utf8"))) {
    if (ID_WORDS.test(s.text) && !NOT_UI.test(s.text)) leftovers.push(`${r}:${s.line} ${JSON.stringify(s.text.slice(0, 70))}`);
  }
}
check(`C1 ${IN_SCOPE.length} berkas dalam cakupan tanpa teks Indonesia tersisa`, leftovers.length === 0, leftovers.length ? `\n    ${leftovers.join("\n    ")}` : "0 temuan");

const MIN = 30;
check(`jumlah cek >= ${MIN}`, checks >= MIN, `${checks}`);
console.log(failures === 0 ? `\nSemua ${checks} uji bahasa lulus.` : `\n${failures} uji GAGAL.`);
process.exitCode = failures ? 1 : 0;
