// src/services/feedbackService.ts
//
// Hari 3 Task 4: kirim masukan (POST /feedback). Login opsional — bila
// pengguna masuk, token dikirim supaya masukan tertaut ke akun. Draf
// disimpan di perangkat (pola penilaian Hari 1) supaya tidak hilang saat
// jaringan gagal; client_ref yang sama dipakai saat kirim ulang -> tidak dobel.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { t, type TKey } from "@/i18n";
import { apiRequest } from "./apiClient";

const category = <T extends string>(value: T, label: TKey) => ({
  value,
  get label() {
    return t(label);
  },
});

export const FEEDBACK_CATEGORIES = [
  category("saran_fitur", "feedback.feature"),
  category("rute_tidak_tepat", "feedback.route"),
  category("tarif", "feedback.fare"),
  category("aksesibilitas", "feedback.a11y"),
  category("lainnya", "feedback.other"),
];
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number]["value"];

export const FEEDBACK_MAX = 500;

export interface FeedbackDraft {
  category: FeedbackCategory | null;
  message: string;
  client_ref: string;
}

const DRAFT_KEY = "smartroute.feedbackDraft.v1";

export const newFeedbackRef = () => `fb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export async function loadFeedbackDraft(): Promise<FeedbackDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as FeedbackDraft) : null;
  } catch {
    return null;
  }
}

export async function saveFeedbackDraft(draft: FeedbackDraft): Promise<void> {
  try {
    await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {}
}

export async function clearFeedbackDraft(): Promise<void> {
  try {
    await AsyncStorage.removeItem(DRAFT_KEY);
  } catch {}
}

export function sendFeedback(
  token: string | null,
  input: { category: FeedbackCategory; message: string; client_ref: string; app_version?: string },
): Promise<{ id: string; created_at: string; linked_to_account: boolean }> {
  return apiRequest("POST", "/feedback", {
    token,
    body: input,
    timeoutMessage: t("feedback.timeout"),
  });
}
