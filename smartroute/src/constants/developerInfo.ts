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
export const VALUE_PROPOSITION =
  "SmartRoute membantu warga Jabodetabek merencanakan perjalanan transportasi umum dengan perkiraan yang jujur: rentang waktu tempuh dan risiko transfer, bukan satu angka yang terlihat pasti.";

export const FEATURES: Array<{ icon: string; title: string; body: string }> = [
  { icon: "time-outline", title: "Rentang ETA & risiko transfer", body: "Waktu tempuh ditampilkan sebagai rentang, dengan penilaian risiko sambungan antarmoda." },
  { icon: "people-outline", title: "Laporan kepadatan", body: "Pengguna melaporkan halte yang padat; rekomendasi rute ikut menyesuaikan." },
  { icon: "chatbubble-ellipses-outline", title: "TOTO, asisten AI", body: "Tanya rute, halte terdekat, dan tarif; dijawab dari data transit, bukan dikarang." },
  { icon: "leaf-outline", title: "Jejak karbon & kualitas udara", body: "Estimasi CO₂ per rute dan info udara kota — selalu dilabeli estimasi beserta sumbernya." },
  { icon: "accessibility-outline", title: "Aksesibilitas", body: "Info status halte untuk kursi roda (dari data GTFS), tampilan mudah dibaca, peringatan teks + getar, dan mode sederhana." },
  { icon: "card-outline", title: "Trip Pass (simulasi)", body: "Tarif per bagian perjalanan dan simulasi saldo kartu — belum terhubung ke kartu atau bank sungguhan." },
];

export const WHATS_NEW: string[] = [
  "Akun, riwayat perjalanan, dan penilaian perjalanan",
  "Estimasi jejak karbon per rute dan info kualitas udara",
  "Info aksesibilitas halte, tampilan mudah dibaca, dan mode navigasi sederhana",
  "Trip Pass dengan simulasi saldo kartu",
];

// Status apa adanya per sumber (lihat backend/otp2-setup & services/*Fares.ts).
export const DATA_TRANSPARENCY: Array<{ name: string; status: string }> = [
  { name: "TransJakarta (BRT, feeder, JakLingko)", status: "GTFS resmi operator: rute, jadwal, tarif, dan status kursi roda halte (sebagian besar halte terisi)." },
  { name: "KRL Commuter Line", status: "Jadwal dirakit tim; tarif dari matriks tarif resmi operator. Data aksesibilitas stasiun belum ada." },
  { name: "MRT Jakarta", status: "Jadwal dirakit tim; tarif dari sumber sekunder dan masih diverifikasi ke sumber resmi. Data aksesibilitas stasiun belum ada." },
  { name: "LRT Jabodebek", status: "Jadwal dirakit tim; tarif dari matriks resmi operator (hari libur nasional belum dikenali). Data aksesibilitas stasiun belum ada." },
  { name: "Kepadatan", status: "Dari laporan pengguna, berlaku 15 menit — bukan sensor atau posisi armada." },
  { name: "Jejak karbon", status: "Estimasi dari faktor emisi publik; rincian di layar \"Tentang angka ini\"." },
  { name: "Kualitas udara", status: "IQAir, tingkat kota Jakarta (tampil bila datanya tersedia)." },
  { name: "Peta & mesin rute", status: "OpenStreetMap / OpenFreeMap dan OpenTripPlanner 2." },
];

export const PROTOTYPE_STATUS =
  "Prototipe siap-pilot. Pembayaran dan saldo kartu di Trip Pass masih SIMULASI, belum terhubung ke bank atau kartu asli.";

// Rencana, BUKAN fitur jadi.
export const ROADMAP: string[] = [
  "Data posisi armada real-time dari operator",
  "Model prediksi waktu tempuh dan kepadatan",
  "Integrasi pembayaran: pembacaan saldo dan top-up lewat kemitraan penerbit kartu",
  "Modul di dalam JAKI",
  "Audit aksesibilitas halte berbasis laporan komunitas",
];

export const PARTNERSHIP_TEXT =
  "Kami terbuka untuk pilot bersama operator transportasi, pemerintah daerah, dan penerbit kartu — termasuk integrasi pembacaan saldo dan top-up lewat kemitraan penerbit kartu.";
