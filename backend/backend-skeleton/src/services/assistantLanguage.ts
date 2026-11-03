// TOTO dua bahasa: jawaban mengikuti bahasa pertanyaan. Bahasa ditentukan di
// sini, bukan ditebak LLM, lalu diperintahkan di bagian paling akhir instruksi
// sistem. Pertanyaan pendek atau berisi nama tempat saja ("MRT Bundaran HI?")
// tidak punya cukup petunjuk, jadi memakai bahasa aktif aplikasi.
export type ReplyLanguage = "id" | "en";

const EN_WORDS = new Set(
  ("how much many what when where which who why is are was the do does did can could should would will " +
    "to from at of for in on with and or my me get go going take nearest closest near nearby far " +
    "fare fares price cost costs route routes stop stops station stations time hours open close start " +
    "operate operating schedule walk walking hello thanks thank please help need want you your tell " +
    "show this that there here").split(" "),
);

const ID_WORDS = new Set(
  ("berapa apa apakah mana dimana di ke dari naik turun tarif harga biaya ongkos halte stasiun terdekat " +
    "dekat jam kapan bagaimana gimana kenapa mengapa yang dan atau saya aku kamu ini itu tolong terima " +
    "kasih makasih halo mau ingin bisa dengan untuk ada tidak nggak gak jalan kaki rute lama buka tutup " +
    "mulai berhenti beroperasi jadwal sini sana siapa perlu pergi cara").split(" "),
);

// Selisih kata minimal supaya bahasa pertanyaan dianggap jelas. Satu kata saja
// bisa berasal dari nama tempat ("Stasiun Manggarai", "Jalan Sudirman").
const CLEAR_MARGIN = 2;

export function resolveReplyLanguage(question: string, appLanguage?: ReplyLanguage): ReplyLanguage {
  const words = question.toLowerCase().match(/[\p{L}']+/gu) ?? [];
  const en = words.filter((w) => EN_WORDS.has(w)).length;
  const id = words.filter((w) => ID_WORDS.has(w)).length;
  const diff = en - id;
  if (diff >= CLEAR_MARGIN) return "en";
  if (diff <= -CLEAR_MARGIN) return "id";
  if (appLanguage) return appLanguage;
  return diff > 0 ? "en" : "id";
}

// Label mengikuti tampilan aplikasi yang sedang dilihat pengguna, yang bisa
// berbeda dari bahasa pertanyaannya.
const UI_LABELS: Record<ReplyLanguage, { from: string; to: string; search: string; walk: string; depart: string }> = {
  id: { from: "Dari", to: "Tujuan", search: "Cari Rute Terbaik", walk: "Jalan ke sini", depart: "Berangkat dari sini" },
  en: { from: "From", to: "To", search: "Find Best Route", walk: "Walk here", depart: "Depart from here" },
};

export function languageDirective(reply: ReplyLanguage, appLanguage?: ReplyLanguage): string {
  const l = UI_LABELS[appLanguage ?? reply];
  if (reply === "en") {
    return (
      "\n\nBAHASA JAWABAN: English. Write the ENTIRE reply in English, including any greeting, even though " +
      "the data above and earlier messages may be in Indonesian. Never mix languages. Keep stop, station, " +
      "and route names exactly as in the data, and translate generic words such as \"garis lurus\" " +
      `(straight line). The app shows these labels, quote them exactly: fields "${l.from}" and "${l.to}", ` +
      `button "${l.search}" on the home screen, stop buttons "${l.walk}" and "${l.depart}".`
    );
  }
  return (
    "\n\nBAHASA JAWABAN: Bahasa Indonesia. Tulis SELURUH jawaban dalam Bahasa Indonesia, termasuk sapaan, " +
    "meskipun pesan sebelumnya berbahasa lain. Jangan mencampur bahasa. Aplikasi menampilkan label berikut, " +
    `kutip persis: kolom "${l.from}" dan "${l.to}", tombol "${l.search}" di Beranda, tombol halte ` +
    `"${l.walk}" dan "${l.depart}".`
  );
}

// "halte terdekat", "nearest station", "gimana jalan ke sana", dst. Pertanyaan
// yang butuh tombol aksi halte di app dan rute jalan kaki ke halte terdekat.
export const NEARBY_INTENT =
  /terdekat|paling dekat|dekat (sini|saya|aku|lokasi)|di ?sekitar|sekitar (sini|saya|aku)|lokasi (saya|aku|ku)|posisi (saya|aku|ku)|jalan kaki|ke ?sana|halte mana|stasiun mana|nearest|closest|nearby|near (me|here|my)|close to (me|here)|around (me|here)|how far|walk(ing)? (to|there)|which (stop|station)|my (location|position)/i;
