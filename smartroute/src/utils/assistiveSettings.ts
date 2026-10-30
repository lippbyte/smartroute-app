// src/utils/assistiveSettings.ts
//
// Hari 3 Task 2: pengaturan bantuan aksesibilitas di perangkat. Fungsi murni
// (diuji di scripts/test-assistive-settings.mts).
//
// Prinsip:
// - SEMUA bawaan MATI -> pengguna tanpa profil aksesibilitas melihat app
//   persis seperti Hari 2.
// - Bila profil punya kebutuhan terkait, bantuan itu DIUSULKAN (aktif)
//   sampai pengguna memilih sendiri; pilihan pengguna selalu menang.
// - Pilihan disimpan di perangkat saja (AsyncStorage). Profil di server
//   TIDAK pernah diubah dari sini.
import type { AccessibilityNeed } from "@/services/authService";
import type { TextStyle } from "react-native";

export type AssistiveKey = "showA11yInfo" | "easyRead" | "bigAlerts" | "simpleNav" | "emphasizeWalk";

/** Pilihan eksplisit pengguna; undefined = ikuti usulan profil. */
export type AssistiveChoices = Partial<Record<AssistiveKey, boolean>>;

export const SUGGESTED_BY: Record<AssistiveKey, AccessibilityNeed> = {
  showA11yInfo: "kursi_roda",
  easyRead: "low_vision",
  bigAlerts: "tunarungu",
  simpleNav: "kognitif",
  emphasizeWalk: "lansia_anak",
};

export const ASSISTIVE_KEYS = Object.keys(SUGGESTED_BY) as AssistiveKey[];

export interface EffectiveSetting {
  on: boolean;
  /** true = nilai berasal dari usulan profil, bukan pilihan pengguna. */
  suggested: boolean;
}

export function effectiveSettings(choices: AssistiveChoices, needs: readonly AccessibilityNeed[]): Record<AssistiveKey, EffectiveSetting> {
  const out = {} as Record<AssistiveKey, EffectiveSetting>;
  for (const key of ASSISTIVE_KEYS) {
    const explicit = choices[key];
    const suggested = needs.includes(SUGGESTED_BY[key]);
    out[key] = explicit === undefined ? { on: suggested, suggested } : { on: explicit, suggested: false };
  }
  return out;
}

// --- Tampilan mudah dibaca: skala huruf + kontras lebih tinggi. -----------

export const EASY_READ_SCALE = 1.15;

// Warna teks sekunder dinaikkan kontrasnya (semua tetap >= AA di latar
// terang #F8FAFC/#FFFFFF): muted #737373 (~4.6:1) -> #404040 (~10:1),
// ink-2 #404040 -> #262626 (~15:1), placeholder abu #A3A3A3 -> #525252.
// Teks putih/berwarna di latar gelap tidak diubah.
const CONTRAST_MAP: Record<string, string> = {
  "#737373": "#404040",
  "#404040": "#262626",
  "#a3a3a3": "#525252",
  "#94a3b8": "#475569",
};

/** Terapkan skala & kontras pada style teks yang sudah diratakan. */
export function easyReadStyle(style: TextStyle): TextStyle {
  const next: TextStyle = { ...style };
  if (typeof next.fontSize === "number") next.fontSize = Math.round(next.fontSize * EASY_READ_SCALE * 10) / 10;
  if (typeof next.lineHeight === "number") next.lineHeight = Math.round(next.lineHeight * EASY_READ_SCALE * 10) / 10;
  if (typeof next.color === "string") {
    const mapped = CONTRAST_MAP[next.color.toLowerCase()];
    if (mapped) next.color = mapped;
  }
  return next;
}
