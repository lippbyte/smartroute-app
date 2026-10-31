// src/app/about.tsx
//
// Hari 3 Task 4: layar "Tentang & Masukan" — menggantikan lembar
// DeveloperInfoSheet. Tanpa unsur acara/penilaian sebelumnya. Isi teks di
// constants/developerInfo.ts (jujur: simulasi dilabeli, data tidak lengkap
// dilabeli, roadmap ditulis sebagai rencana). Versi dari konfigurasi app.
//
// Form masukan: POST /feedback (login opsional — tertaut ke akun bila
// masuk). Draf disimpan di perangkat setiap kali isian berubah; jaringan
// gagal -> draf bertahan dan bisa dikirim ulang (client_ref sama -> tidak dobel).
import { FormMessage } from "@/components/form/FormField";
import PrimaryButton from "@/components/form/PrimaryButton";
import ScreenBackground from "@/components/ScreenBackground";
import Text from "@/components/Text";
import {
  DATA_TRANSPARENCY,
  DEVELOPER_INFO,
  FEATURES,
  PARTNERSHIP_TEXT,
  partnershipContactOrNull,
  PROTOTYPE_STATUS,
  ROADMAP,
  TAGLINE,
  VALUE_PROPOSITION,
  WHATS_NEW,
} from "@/constants/developerInfo";
import { useAuth } from "@/context/AuthContext";
import { ApiError, NETWORK_ERROR_MESSAGE } from "@/services/apiClient";
import {
  clearFeedbackDraft,
  FEEDBACK_CATEGORIES,
  FEEDBACK_MAX,
  type FeedbackCategory,
  type FeedbackDraft,
  loadFeedbackDraft,
  newFeedbackRef,
  saveFeedbackDraft,
  sendFeedback,
} from "@/services/feedbackService";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { ReactNode, useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from "react-native";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="bg-surface rounded-2xl p-4 gap-2.5 border border-line">
      <Text className="text-ink text-base" weight="bold" accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

const Bullet = ({ children }: { children: ReactNode }) => (
  <View className="flex-row gap-2">
    <Text className="text-ink-2 text-sm">•</Text>
    <Text className="text-ink-2 text-sm flex-1" style={{ lineHeight: 20 }}>
      {children}
    </Text>
  </View>
);

export default function AboutScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const version = Constants.expoConfig?.version ?? "-";
  const partnershipContact = partnershipContactOrNull();

  const [draft, setDraft] = useState<FeedbackDraft>({ category: null, message: "", client_ref: newFeedbackRef() });
  const [restored, setRestored] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    loadFeedbackDraft().then((d) => {
      if (d && (d.message || d.category)) {
        setDraft(d);
        setRestored(true);
      }
    });
  }, []);

  const update = (patch: Partial<FeedbackDraft>) => {
    setSent(false);
    setDraft((prev) => {
      const next = { ...prev, ...patch };
      void saveFeedbackDraft(next);
      return next;
    });
  };

  const canSend = !!draft.category && draft.message.trim().length > 0 && !sending;

  const submit = async () => {
    if (!draft.category || !draft.message.trim()) return;
    setSending(true);
    setError(null);
    await saveFeedbackDraft(draft);
    try {
      await sendFeedback(token, { category: draft.category, message: draft.message.trim(), client_ref: draft.client_ref, app_version: version });
      await clearFeedbackDraft();
      setDraft({ category: null, message: "", client_ref: newFeedbackRef() });
      setRestored(false);
      setSent(true);
    } catch (err) {
      if (err instanceof ApiError && (err.isNetwork || err.status >= 500)) {
        setError(`${err.code === "timeout" ? err.message : NETWORK_ERROR_MESSAGE} Masukan Anda tersimpan sebagai draf di perangkat ini — ketuk "Kirim masukan" lagi kapan saja.`);
      } else {
        setError(err instanceof ApiError ? err.message : "Masukan belum terkirim. Draf Anda tetap tersimpan.");
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <ScreenBackground>
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ paddingTop: 56, paddingBottom: 48, paddingHorizontal: 20, gap: 14 }} keyboardShouldPersistTaps="handled">
          <View className="flex-row items-center gap-3">
            <Pressable
              onPress={() => (router.canGoBack() ? router.back() : router.navigate("/"))}
              accessibilityRole="button"
              accessibilityLabel="Kembali"
              className="bg-surface p-2.5 rounded-full border border-line"
            >
              <Ionicons name="arrow-back" size={20} color="#0A0A0A" />
            </Pressable>
            <Text className="text-2xl font-bold text-white" accessibilityRole="header">
              Tentang & Masukan
            </Text>
          </View>

          <View className="gap-1.5 px-1">
            <Text className="text-white text-xl" weight="bold">
              SmartRoute AI — {TAGLINE}
            </Text>
            <Text className="text-sm" style={{ color: "#E2E8F0", lineHeight: 20 }}>
              {VALUE_PROPOSITION}
            </Text>
          </View>

          <Section title="Fitur utama">
            {FEATURES.map((f) => (
              <View key={f.title} className="flex-row gap-3 items-start">
                <Ionicons name={f.icon as keyof typeof Ionicons.glyphMap} size={20} color="#0F3FC1" style={{ marginTop: 1 }} />
                <View className="flex-1 gap-0.5">
                  <Text className="text-ink text-sm" weight="semibold">
                    {f.title}
                  </Text>
                  <Text className="text-ink-2 text-sm" style={{ lineHeight: 19 }}>
                    {f.body}
                  </Text>
                </View>
              </View>
            ))}
          </Section>

          <Section title={`Versi ${version} · yang baru`}>
            {WHATS_NEW.map((w) => (
              <Bullet key={w}>{w}</Bullet>
            ))}
            <Text className="text-ink-2 text-xs">Dikembangkan oleh tim {DEVELOPER_INFO.teamName}.</Text>
          </Section>

          <Section title="Transparansi data">
            {DATA_TRANSPARENCY.map((d) => (
              <View key={d.name} className="gap-0.5">
                <Text className="text-ink text-sm" weight="semibold">
                  {d.name}
                </Text>
                <Text className="text-ink-2 text-sm" style={{ lineHeight: 19 }}>
                  {d.status}
                </Text>
              </View>
            ))}
            <Pressable onPress={() => router.push("/co2-info")} accessibilityRole="link" hitSlop={6} className="self-start">
              <Text className="text-sm underline" weight="semibold" style={{ color: "#0F3FC1" }}>
                Faktor emisi & sumbernya: Tentang angka ini
              </Text>
            </Pressable>
          </Section>

          <Section title="Status prototipe">
            <Text className="text-ink-2 text-sm" style={{ lineHeight: 20 }}>
              {PROTOTYPE_STATUS}
            </Text>
            <Text className="text-ink text-sm mt-1" weight="semibold">
              Rencana pengembangan (belum tersedia)
            </Text>
            {ROADMAP.map((r) => (
              <Bullet key={r}>{r}</Bullet>
            ))}
          </Section>

          {/* Hari 4 Task 1: tanpa kontak resmi, ajakan kemitraan tidak
              ditampilkan sama sekali (dulu ada teks cadangan). */}
          {partnershipContact && (
            <Section title="Kemitraan">
              <Text className="text-ink-2 text-sm" style={{ lineHeight: 20 }}>
                {PARTNERSHIP_TEXT}
              </Text>
              <Text className="text-ink text-sm" weight="semibold">
                Kontak: {partnershipContact}
              </Text>
            </Section>
          )}

          <Section title="Kirim masukan">
            <Text className="text-ink-2 text-sm">
              Ceritakan rute yang kurang tepat, tarif yang berbeda, atau fitur yang Anda butuhkan.
              {token ? " Masukan akan tertaut ke akun Anda." : " Bisa dikirim tanpa akun."}
            </Text>
            {restored && <Text className="text-ink-2 text-xs">Draf sebelumnya dipulihkan.</Text>}
            <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup" accessibilityLabel="Kategori masukan">
              {FEEDBACK_CATEGORIES.map((c) => {
                const selected = draft.category === c.value;
                return (
                  <Pressable
                    key={c.value}
                    onPress={() => update({ category: c.value as FeedbackCategory })}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    accessibilityLabel={c.label}
                    className="rounded-full px-4 justify-center active:opacity-80"
                    style={{ minHeight: 44, backgroundColor: selected ? "#0F3FC1" : "#FFFFFF", borderWidth: 1.5, borderColor: selected ? "#0F3FC1" : "#737373" }}
                  >
                    <Text className="text-sm" weight="semibold" style={{ color: selected ? "#FFFFFF" : "#0A0A0A" }}>
                      {c.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <TextInput
              value={draft.message}
              onChangeText={(t) => update({ message: t.slice(0, FEEDBACK_MAX) })}
              maxLength={FEEDBACK_MAX}
              multiline
              placeholder="Tulis masukan Anda…"
              placeholderTextColor="#737373"
              accessibilityLabel="Pesan masukan, maksimal 500 karakter"
              className="font-jakarta text-ink text-base bg-white rounded-xl px-4 py-3"
              style={{ minHeight: 110, textAlignVertical: "top", borderWidth: 1, borderColor: "#737373" }}
            />
            <Text className="text-ink-2 text-xs text-right">
              {draft.message.length}/{FEEDBACK_MAX}
            </Text>
            {error && <FormMessage tone="error" message={error} />}
            {sent && (
              <View className="flex-row items-center gap-2" accessibilityLiveRegion="polite">
                <Ionicons name="checkmark-circle" size={18} color="#065F46" />
                <Text className="text-sm" weight="semibold" style={{ color: "#065F46" }}>
                  Terima kasih, masukan Anda sudah kami terima.
                </Text>
              </View>
            )}
            <PrimaryButton
              label={sending ? "Mengirim…" : "Kirim masukan"}
              onPress={submit}
              loading={sending}
              disabled={!canSend}
              accessibilityHint={canSend ? undefined : "Pilih kategori dan tulis pesan terlebih dahulu."}
            />
          </Section>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}
