// Info pengembang untuk lembar "Tentang & Masukan" (ikon pesan di halaman
// Akun). Satu tempat — ganti isinya di sini saja.
//
// TODO: verifikasi — nama tim, anggota, dan email kontak belum diberikan;
// jangan dikarang. Selama `feedbackEmail` kosong, tombol "Kirim Masukan"
// disembunyikan.
export const DEVELOPER_INFO = {
  teamName: "Problem Solver",
  event: "Lomba AI Innovation 2026",
  members: [] as Array<{ name: string; role: string }>,
  feedbackEmail: "",
};

// Sumber data yang benar-benar dipakai app (lihat backend/otp2-setup).
export const DATA_SOURCES = [
  "GTFS TransJakarta (BRT, feeder, JakLingko)",
  "Jadwal KRL Commuter Line",
  "Jadwal & tarif resmi MRT Jakarta",
  "Jadwal & tarif LRT Jabodebek",
  "OpenStreetMap & OpenFreeMap (peta)",
  "OpenTripPlanner 2 (mesin rute)",
];
