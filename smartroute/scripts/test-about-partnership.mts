// Hari 4 Task 1: ajakan kemitraan di layar Tentang disembunyikan rapi selama
// kontak resmi kosong (dulu tampil "Kontak: segera tersedia").
//
//   node --import ./scripts/test-support/register-stubs.mjs --import <tsx>/dist/loader.mjs scripts/test-about-partnership.mts
import { readFileSync } from "node:fs";
import { DEVELOPER_INFO, partnershipContactOrNull } from "../src/constants/developerInfo";

let failures = 0;
let checks = 0;
function check(name: string, ok: boolean, detail = "") {
  checks++;
  if (!ok) failures++;
  console.log(`${ok ? "LULUS" : "GAGAL"}  ${name}${detail ? `  (${detail})` : ""}`);
}

check("K1 kontak kosong / spasi -> null (bagian disembunyikan)", partnershipContactOrNull("") === null && partnershipContactOrNull("   ") === null);
check("K2 kontak terisi -> ditampilkan apa adanya (dipangkas)", partnershipContactOrNull("  kemitraan@contoh.test ") === "kemitraan@contoh.test");
check(
  "K3 nilai sekarang: kontak resmi belum diisi -> bagian Kemitraan tidak tampil",
  DEVELOPER_INFO.partnershipContact === "" && partnershipContactOrNull() === null,
  "TODO:isi menunggu Khalifa",
);

const about = readFileSync(new URL("../src/app/about.tsx", import.meta.url), "utf8");
check("K4 layar: Section Kemitraan hanya dirender bila kontak ada", /\{partnershipContact && \(\s*<Section title="Kemitraan">/.test(about));
check("K5 layar: tidak ada lagi teks cadangan 'segera tersedia'", !/segera tersedia/i.test(about));
check("K6 layar: kontak dibaca lewat partnershipContactOrNull()", /const partnershipContact = partnershipContactOrNull\(\)/.test(about));

check("jumlah cek >= 6", checks >= 6, `${checks}`);
console.log(failures === 0 ? `\nSemua ${checks} uji bagian Kemitraan lulus.` : `\n${failures} uji GAGAL.`);
process.exitCode = failures ? 1 : 0;
