// TOTO dua bahasa, tanpa memanggil LLM.
//   npx tsx scripts/test-toto-language.mts
import { languageDirective, NEARBY_INTENT, resolveReplyLanguage, type ReplyLanguage } from "../src/services/assistantLanguage";

let failed = 0;
let total = 0;
function check(name: string, ok: boolean, detail = "") {
  total++;
  if (!ok) failed++;
  console.log(`${ok ? "LULUS" : "GAGAL"}  ${name}${detail ? `  (${detail})` : ""}`);
}

const LANGUAGE_CASES: Array<[string, ReplyLanguage | undefined, ReplyLanguage]> = [
  // Bahasa pertanyaan jelas: mengalahkan bahasa aplikasi, ke dua arah.
  ["How much is the TransJakarta fare?", "id", "en"],
  ["What time does TransJakarta start operating?", "id", "en"],
  ["How do I get from Blok M to Kota?", "id", "en"],
  ["Where is the nearest MRT station?", "id", "en"],
  ["How do I get to Jalan Sudirman?", "id", "en"],
  ["Berapa tarif TransJakarta?", "en", "id"],
  ["Jam berapa TransJakarta mulai beroperasi?", "en", "id"],
  ["dari Blok M ke Kota naik apa?", "en", "id"],
  ["Stasiun MRT terdekat di mana?", "en", "id"],
  // Tidak jelas: mengikuti bahasa aplikasi.
  ["MRT Bundaran HI?", "en", "en"],
  ["MRT Bundaran HI?", "id", "id"],
  ["Stasiun Manggarai?", "en", "en"],
  ["Stasiun Manggarai?", "id", "id"],
  ["Monas", "en", "en"],
  ["Monas", "id", "id"],
  // Aplikasi lama yang belum mengirim bahasa tetap berfungsi.
  ["How much is the fare?", undefined, "en"],
  ["Berapa tarifnya?", undefined, "id"],
  ["Monas", undefined, "id"],
];
for (const [question, app, expected] of LANGUAGE_CASES) {
  const got = resolveReplyLanguage(question, app);
  check(`bahasa "${question}" (aplikasi: ${app ?? "-"}) -> ${expected}`, got === expected, got);
}

const NEARBY: Array<[string, boolean]> = [
  ["Where is the nearest MRT station?", true],
  ["What's the closest bus stop?", true],
  ["Any stops nearby?", true],
  ["Which station is near me?", true],
  ["How far is the station?", true],
  ["halte terdekat di mana?", true],
  ["gimana jalan ke sana?", true],
  ["How much is the TransJakarta fare?", false],
  ["Berapa tarif TransJakarta?", false],
  ["What time does TransJakarta start operating?", false],
];
for (const [question, expected] of NEARBY) {
  check(`kartu halte "${question}" -> ${expected}`, NEARBY_INTENT.test(question) === expected);
}

const en = languageDirective("en", "en");
check("EN: memerintahkan bahasa Inggris", /ENTIRE reply in English/.test(en));
check("EN + UI Inggris: label tombol Inggris", en.includes('"Find Best Route"') && en.includes('"Walk here"'));
check("EN + UI Inggris: tanpa label Indonesia", !en.includes("Cari Rute Terbaik") && !en.includes("Jalan ke sini"));

const enOnId = languageDirective("en", "id");
check("EN + UI Indonesia: label sesuai layar pengguna", enOnId.includes('"Cari Rute Terbaik"'));

const id = languageDirective("id", "id");
check("ID: memerintahkan Bahasa Indonesia", /SELURUH jawaban dalam Bahasa Indonesia/.test(id));
check("ID + UI Indonesia: label tombol Indonesia", id.includes('"Cari Rute Terbaik"') && id.includes('"Berangkat dari sini"'));
check("ID + UI Indonesia: tanpa label Inggris", !id.includes("Find Best Route"));
check("Aplikasi lama: label mengikuti bahasa jawaban", languageDirective("en").includes('"Find Best Route"'));

console.log(failed ? `\n${failed} dari ${total} uji GAGAL.` : `\nSemua ${total} uji bahasa TOTO lulus.`);
process.exit(failed ? 1 : 0);
