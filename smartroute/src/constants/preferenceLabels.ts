// src/constants/preferenceLabels.ts
//
// Hari 1 Task 3: label & teks preferensi — dipakai onboarding DAN Profil
// supaya keduanya selalu sama. Keputusan Task 0 no. 2a:
// - Label prioritas = label chip kriteria di layar hasil (Cepat/Murah/
//   Tenang, bukan "Nyaman").
// - Prioritas hanya disimpan + menjadi konteks TOTO; chip default di layar
//   hasil TETAP "Semua". Teks di sini tidak boleh menjanjikan penyesuaian
//   rute.
import { t, type TKey } from "@/i18n";
import type { AccessibilityNeed, AvoidableMode, Priority, WalkLimit } from "@/services/authService";

const choice = <T extends string>(value: T, label: TKey, description: TKey) => ({
  value,
  get label() {
    return t(label);
  },
  get description() {
    return t(description);
  },
});
const labelled = <T extends string>(value: T, label: TKey) => ({
  value,
  get label() {
    return t(label);
  },
});

export const PRIORITY_OPTIONS: { value: Priority; label: string; description: string }[] = [
  choice("cepat", "pref.cepat", "pref.cepat.body"),
  choice("murah", "pref.murah", "pref.murah.body"),
  choice("tenang", "pref.tenang", "pref.tenang.body"),
  // Hari 2 Task 4. Bukan chip filter — hasil rute tetap ditampilkan seperti
  // biasa (lihat PRIORITY_NOTE); lencana "Sehat" di kartu berlaku untuk
  // semua pengguna, bukan karena preferensi ini.
  choice("sehat", "pref.sehat", "pref.sehat.body"),
];

export const WALK_LIMIT_OPTIONS: { value: WalkLimit; label: string; description: string }[] = [
  choice("dekat", "pref.dekat", "pref.dekat.body"),
  choice("sedang", "pref.sedang", "pref.sedang.body"),
  choice("jauh", "pref.jauh", "pref.jauh.body"),
];

// Sama dengan chip moda di layar hasil.
export const AVOID_MODE_OPTIONS: { value: AvoidableMode; label: string }[] = [
  { value: "bus", label: "Bus" },
  { value: "krl", label: "KRL" },
  { value: "mrt", label: "MRT" },
  { value: "lrt", label: "LRT" },
];

export const ACCESSIBILITY_OPTIONS: { value: AccessibilityNeed; label: string }[] = [
  labelled("kursi_roda", "a11y.kursi_roda"),
  labelled("low_vision", "a11y.low_vision"),
  labelled("tunarungu", "a11y.tunarungu"),
  labelled("kognitif", "a11y.kognitif"),
  labelled("lansia_anak", "a11y.lansia_anak"),
];

export const labelOf = <T extends string>(options: { value: T; label: string }[], value: T | null | undefined) =>
  options.find((o) => o.value === value)?.label ?? null;

// Catatan jujur — ditampilkan di tempat pengguna memilih.
export const priorityNote = () => t("pref.note.priority");
export const storedOnlyNote = () => t("pref.note.storedOnly");
// Hari 3: diperbarui — sebagian bantuan sudah bekerja (lihat kartu
// "Tampilan & bantuan" di Profil), penyesuaian RUTE belum.
export const accessibilityDevNote = () => t("pref.note.a11yDev");

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
export const accessibilityConsentText = () => t("pref.note.a11yConsent");
