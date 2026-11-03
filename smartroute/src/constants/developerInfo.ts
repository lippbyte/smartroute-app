import { t } from "@/i18n";
// Isi layar "Tentang & Masukan" (app/about.tsx). Satu tempat — ganti isinya
// di sini saja.
//
// Hari 3 Task 4 (keputusan Khalifa): semua unsur acara/penilaian sebelumnya
// dihapus. Teks harus jujur: tidak ada klaim "real-time armada", "model
// prediktif penuh", atau kerja sama yang belum ada; simulasi dilabeli
// simulasi; data tidak lengkap dilabeli tidak lengkap. Jangan menampilkan
// logo/nama instansi atau operator sebagai MITRA — penyebutan sumber data
// cukup nama.

export const DEVELOPER_INFO = {
  teamName: "Problem Solver",
  members: [] as Array<{ name: string; role: string }>,
  // TODO:isi — kontak kemitraan resmi tim (email/nomor) dari Khalifa. JANGAN
  // dikarang; selama kosong, bagian "Kemitraan" TIDAK ditampilkan sama sekali
  // (Hari 4 Task 1 — dulu tampil "Kontak: segera tersedia").
  partnershipContact: "",
};

/** Bagian "Kemitraan" di layar Tentang hanya tampil bila kontak terisi. */
export function partnershipContactOrNull(contact: string = DEVELOPER_INFO.partnershipContact): string | null {
  const c = contact.trim();
  return c ? c : null;
}

// TODO:verifikasi — tagline final dari tim (sementara memakai tagline app).
export const TAGLINE = "Navigate Smarter. Travel Better.";
export const valueProposition = () => t("about.value");

// Batas kemampuan TOTO yang jujur, dipakai di layar Tentang, kartu Beranda, dan
// layar TOTO. Jawaban soal rute terbukti bisa keliru (laporan Hari 4).
export const totoScopeNote = () => t("toto.scopeNote");

// Catatan tetap di layar TOTO. Instruksi sistem sudah membatasi jawaban, tetapi
// uji berulang masih menemukan jawaban keliru (test-toto-live.mjs, laporan hotfix).
export const totoChatNote = () => t("toto.chatNote");

export const features = (): Array<{ icon: string; title: string; body: string }> => [
  { icon: "time-outline", title: t("about.feature.eta"), body: t("about.feature.eta.body") },
  { icon: "people-outline", title: t("about.feature.crowd"), body: t("about.feature.crowd.body") },
  { icon: "chatbubble-ellipses-outline", title: t("about.feature.toto"), body: totoScopeNote() },
  { icon: "leaf-outline", title: t("about.feature.carbon"), body: t("about.feature.carbon.body") },
  { icon: "accessibility-outline", title: t("about.feature.a11y"), body: t("about.feature.a11y.body") },
  { icon: "card-outline", title: t("about.feature.pass"), body: t("about.feature.pass.body") },
];

export const whatsNew = (): string[] => [t("about.new.account"), t("about.new.carbon"), t("about.new.a11y"), t("about.new.pass")];

// Status apa adanya per sumber (lihat backend/otp2-setup & services/*Fares.ts).
export const dataTransparency = (): Array<{ name: string; status: string }> => [
  { name: "TransJakarta (BRT, feeder, JakLingko)", status: t("about.data.tj") },
  { name: "KRL Commuter Line", status: t("about.data.krl") },
  { name: "MRT Jakarta", status: t("about.data.mrt") },
  { name: "LRT Jabodebek", status: t("about.data.lrt") },
  { name: t("about.data.crowd.name"), status: t("about.data.crowd") },
  { name: t("about.data.carbon.name"), status: t("about.data.carbon") },
  { name: t("about.data.air.name"), status: t("about.data.air") },
  { name: t("about.data.map.name"), status: t("about.data.map") },
];

export const prototypeStatus = () => t("about.status");

// Rencana, BUKAN fitur jadi.
export const roadmap = (): string[] => [t("about.road.fleet"), t("about.road.model"), t("about.road.payment"), t("about.road.jaki"), t("about.road.audit")];

export const partnershipText = () => t("about.partnership.body");
