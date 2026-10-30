// src/constants/preferenceLabels.ts
//
// Hari 1 Task 3: label & teks preferensi — dipakai onboarding DAN Profil
// supaya keduanya selalu sama. Keputusan Task 0 no. 2a:
// - Label prioritas = label chip kriteria di layar hasil (Cepat/Murah/
//   Tenang, bukan "Nyaman").
// - Prioritas hanya disimpan + menjadi konteks TOTO; chip default di layar
//   hasil TETAP "Semua". Teks di sini tidak boleh menjanjikan penyesuaian
//   rute.
import type { AccessibilityNeed, AvoidableMode, Priority, WalkLimit } from "@/services/authService";

export const PRIORITY_OPTIONS: { value: Priority; label: string; description: string }[] = [
  { value: "cepat", label: "Cepat", description: "Waktu tempuh singkat paling penting bagi saya." },
  { value: "murah", label: "Murah", description: "Tarif rendah paling penting bagi saya." },
  { value: "tenang", label: "Tenang", description: "Perjalanan yang tidak padat paling penting bagi saya." },
  // Hari 2 Task 4. Bukan chip filter — hasil rute tetap ditampilkan seperti
  // biasa (lihat PRIORITY_NOTE); lencana "Sehat" di kartu berlaku untuk
  // semua pengguna, bukan karena preferensi ini.
  { value: "sehat", label: "Sehat", description: "Perjalanan yang lebih aktif dan minim paparan polusi penting bagi saya." },
];

export const WALK_LIMIT_OPTIONS: { value: WalkLimit; label: string; description: string }[] = [
  { value: "dekat", label: "Dekat", description: "Sesedikit mungkin jalan kaki." },
  { value: "sedang", label: "Sedang", description: "Jalan kaki beberapa menit tidak masalah." },
  { value: "jauh", label: "Jauh", description: "Tidak keberatan jalan kaki lebih lama." },
];

// Sama dengan chip moda di layar hasil.
export const AVOID_MODE_OPTIONS: { value: AvoidableMode; label: string }[] = [
  { value: "bus", label: "Bus" },
  { value: "krl", label: "KRL" },
  { value: "mrt", label: "MRT" },
  { value: "lrt", label: "LRT" },
];

export const ACCESSIBILITY_OPTIONS: { value: AccessibilityNeed; label: string }[] = [
  { value: "kursi_roda", label: "Pengguna kursi roda / mobilitas terbatas" },
  { value: "low_vision", label: "Tunanetra / low vision" },
  { value: "tunarungu", label: "Tunarungu / gangguan pendengaran" },
  { value: "kognitif", label: "Kognitif / neurodivergen" },
  { value: "lansia_anak", label: "Lansia / membawa anak" },
];

export const labelOf = <T extends string>(options: { value: T; label: string }[], value: T | null | undefined) =>
  options.find((o) => o.value === value)?.label ?? null;

// Catatan jujur — ditampilkan di tempat pengguna memilih.
export const PRIORITY_NOTE =
  "Disimpan di akun Anda dan dipakai TOTO untuk memahami kebutuhan Anda. Daftar hasil pencarian rute tetap ditampilkan seperti biasa.";
export const STORED_ONLY_NOTE =
  "Disimpan di akun Anda untuk pengembangan berikutnya. Saat ini belum mengubah hasil pencarian rute.";
export const ACCESSIBILITY_DEV_NOTE =
  "Penyesuaian rute untuk profil ini sedang dikembangkan. SmartRoute belum bisa menjamin rute yang ditampilkan aksesibel.";

// Status klaim di teks ini terhadap kode (diperbarui Hari 1 Task 4):
// - "tidak dikirim ke layanan AI (TOTO)": TERVERIFIKASI — uji
//   backend scripts/test-toto-privacy.mjs (P2) menangkap payload akhir ke
//   provider untuk akun dengan 5 kebutuhan aksesibilitas dan memastikan
//   tidak ada kode/label/kata aksesibilitas di dalamnya; backend hanya
//   mengirim nama panggilan + prioritas (routes/assistant.ts).
// - "bisa dihapus kapan saja di Profil": TERVERIFIKASI — DELETE
//   /me/accessibility mengosongkan kolom di database (uji T3d).
// TODO:verifikasi — tinggal KATA-KATA final oleh tim (disarankan ditinjau
// satu orang di luar tim). Bila teks diubah, klaimnya harus tetap benar
// terhadap dua poin di atas.
export const ACCESSIBILITY_CONSENT_TEXT =
  "Saya setuju SmartRoute menyimpan kebutuhan aksesibilitas yang saya pilih di akun saya, untuk mengembangkan rute yang lebih sesuai. " +
  "Data ini tidak dikirim ke layanan AI (TOTO) dan tidak dibagikan ke pihak lain. Saya bisa menghapusnya kapan saja di Profil.";
