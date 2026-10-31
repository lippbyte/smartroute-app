// Hari 4 Task 1: pesan GPS di layar navigasi (KODE ASLI utils/gpsNotice).
//
//   node --import ./scripts/test-support/register-stubs.mjs --import <tsx>/dist/loader.mjs scripts/test-gps-notice.mts
import { readFileSync } from "node:fs";
import { gpsIssueFromPermission, gpsNotice } from "../src/utils/gpsNotice";

let failures = 0;
let checks = 0;
function check(name: string, ok: boolean, detail = "") {
  checks++;
  if (!ok) failures++;
  console.log(`${ok ? "LULUS" : "GAGAL"}  ${name}${detail ? `  (${detail})` : ""}`);
}

// Status izin expo-location: granted | denied | undetermined.
check("G1 izin diberikan -> tanpa pesan", gpsIssueFromPermission("granted") === null && gpsNotice(gpsIssueFromPermission("granted")) === null);
check("G2 izin ditolak -> denied", gpsIssueFromPermission("denied") === "denied");
check("G3 izin belum diputuskan (dialog ditutup) -> denied", gpsIssueFromPermission("undetermined") === "denied");

const ONE_SENTENCE = /^[A-Z][^.!?]*[.]$/; // satu kalimat: satu tanda akhir, di ujung
const TECH = /gps|permission|expo|error|galat|null|undefined|http/i;
for (const issue of ["denied", "unavailable"] as const) {
  const msg = gpsNotice(issue) ?? "";
  check(`G4 ${issue}: satu kalimat singkat (<= 80 karakter)`, ONE_SENTENCE.test(msg) && msg.length <= 80, `${msg.length}: ${msg}`);
  check(`G5 ${issue}: tanpa istilah teknis`, !TECH.test(msg), msg);
  check(`G6 ${issue}: mengarahkan ke tombol langkah manual`, /tombol/.test(msg) && /langkah/.test(msg), msg);
}
check("G7 ditolak & gagal dibaca: pesan berbeda", gpsNotice("denied") !== gpsNotice("unavailable"));
check("G8 pesan ditolak menyebut izin", /^Izin lokasi ditolak/.test(gpsNotice("denied") ?? ""));
check("G9 tanpa masalah -> null (tidak ada pill kosong)", gpsNotice(null) === null);

// Pemasangan di layar (kode sumber): status izin dipetakan, galat baca posisi
// ditandai, pesan dirender di mode peta DAN diteruskan ke mode sederhana,
// dan disembunyikan begitu posisi ada.
const nav = readFileSync(new URL("../src/app/navigate.tsx", import.meta.url), "utf8");
const simpleView = readFileSync(new URL("../src/components/navigate/SimpleNavView.tsx", import.meta.url), "utf8");
check("W1 navigate: izin dipetakan lewat gpsIssueFromPermission, gagal baca -> 'unavailable'", /gpsIssueFromPermission\(status\)/.test(nav) && /setGpsIssue\("unavailable"\)/.test(nav));
check("W2 navigate: pesan hilang saat posisi ada", /const gpsMessage = userLocation \? null : gpsNotice\(gpsIssue\)/.test(nav));
check("W3 navigate: dirender di mode peta & diteruskan ke mode sederhana", /\{gpsMessage\}<\/Text>/.test(nav) && /notice=\{gpsMessage\}/.test(nav) && /\{notice\}/.test(simpleView));
check("W4 navigate: tidak ada lagi 'return' diam saat izin ditolak", !/if \(status !== "granted"\) return;/.test(nav));

check("jumlah cek >= 16", checks >= 16, `${checks}`);
console.log(failures === 0 ? `\nSemua ${checks} uji pesan GPS lulus.` : `\n${failures} uji GAGAL.`);
process.exitCode = failures ? 1 : 0;
