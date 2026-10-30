// src/app/onboarding.tsx
//
// Hari 1 Task 3: onboarding preferensi, tepat setelah Daftar. Tiga langkah,
// SEMUA bisa dilewati (per langkah atau sekaligus), dan semuanya bisa
// diubah lagi di Profil.
//   1. Prioritas (Cepat/Murah/Tenang) — disimpan + konteks TOTO; chip
//      default di layar hasil tetap "Semua" (keputusan 2a).
//   2. Batas jalan kaki & moda yang dihindari — hanya disimpan.
//   3. Aksesibilitas (opsional) — persetujuan eksplisit, hanya disimpan,
//      bisa dihapus (DELETE /me/accessibility).
// Preferensi disimpan saat langkah 2 selesai; aksesibilitas saat langkah 3
// disimpan. Melewati = tidak ada panggilan ke server untuk langkah itu.
import AccessibilityForm, { canSaveAccessibility } from "@/components/form/AccessibilityForm";
import AuthScreenLayout from "@/components/form/AuthScreenLayout";
import { OptionCard, ToggleChip } from "@/components/form/ChoiceControls";
import { FormMessage } from "@/components/form/FormField";
import PrimaryButton from "@/components/form/PrimaryButton";
import Text from "@/components/Text";
import {
  AVOID_MODE_OPTIONS,
  PRIORITY_NOTE,
  PRIORITY_OPTIONS,
  STORED_ONLY_NOTE,
  WALK_LIMIT_OPTIONS,
} from "@/constants/preferenceLabels";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/services/apiClient";
import * as authService from "@/services/authService";
import type { AccessibilityNeed, AvoidableMode, Priority, WalkLimit } from "@/services/authService";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";

const STEPS = [
  { title: "Apa yang paling penting?", subtitle: "Pilih satu. Boleh dilewati." },
  { title: "Jalan kaki & moda", subtitle: "Semua pertanyaan di langkah ini opsional." },
  { title: "Kebutuhan aksesibilitas", subtitle: "Opsional. Hanya diisi bila Anda mau." },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { token, replaceUser } = useAuth();

  const [step, setStep] = useState(0);
  const [priority, setPriority] = useState<Priority | null>(null);
  const [walkLimit, setWalkLimit] = useState<WalkLimit | null>(null);
  const [avoidModes, setAvoidModes] = useState<AvoidableMode[]>([]);
  const [needs, setNeeds] = useState<AccessibilityNeed[]>([]);
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dibuka dari Profil (Daftar dari mode tamu) -> kembali ke sana; dari
  // layar Masuk saat app dibuka -> Beranda.
  const finish = () => (router.canGoBack() ? router.back() : router.replace("/"));

  const run = async (action: () => Promise<void>) => {
    if (!token) return finish(); // seharusnya tidak terjadi: onboarding hanya setelah Daftar
    setSaving(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal menyimpan. Coba lagi, atau lewati langkah ini.");
    } finally {
      setSaving(false);
    }
  };

  const savePreferences = (p: { priority: Priority | null; walk_limit: WalkLimit | null; avoid_modes: AvoidableMode[] }) =>
    run(async () => {
      // Tidak ada yang dipilih sama sekali = tidak perlu memanggil server.
      if (p.priority || p.walk_limit || p.avoid_modes.length) {
        replaceUser(await authService.updatePreferences(token!, p));
      }
      setStep(2);
    });

  const next = () => {
    setError(null);
    if (step === 0) setStep(1);
    else if (step === 1) void savePreferences({ priority, walk_limit: walkLimit, avoid_modes: avoidModes });
    else
      void run(async () => {
        replaceUser(await authService.saveAccessibility(token!, needs));
        finish();
      });
  };

  const skipStep = () => {
    setError(null);
    if (step === 0) {
      setPriority(null);
      setStep(1);
    } else if (step === 1) {
      setWalkLimit(null);
      setAvoidModes([]);
      void savePreferences({ priority, walk_limit: null, avoid_modes: [] });
    } else finish();
  };

  // Prioritas yang sudah dikonfirmasi lewat "Lanjut" (langkah 1) tetap
  // disimpan; pilihan di langkah yang sedang terbuka dianggap dilewati.
  const skipAll = () => {
    if (step === 1 && priority) {
      void run(async () => {
        replaceUser(await authService.updatePreferences(token!, { priority, walk_limit: null, avoid_modes: [] }));
        finish();
      });
    } else finish();
  };

  const toggleMode = (m: AvoidableMode) =>
    setAvoidModes((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));

  const isLast = step === STEPS.length - 1;
  const nextDisabled = isLast && !canSaveAccessibility(needs, consent);

  return (
    <AuthScreenLayout title={STEPS[step].title} subtitle={STEPS[step].subtitle}>
      <View className="flex-row items-center justify-between">
        <Text className="text-ink-2 text-sm" weight="semibold" accessibilityLiveRegion="polite">
          Langkah {step + 1} dari {STEPS.length}
        </Text>
        <Pressable onPress={skipAll} disabled={saving} hitSlop={10} accessibilityRole="button" accessibilityHint="Lewati semua pertanyaan. Bisa diisi nanti di Profil.">
          <Text className="text-[15px] underline" weight="bold" style={{ color: "#0F3FC1" }}>
            Lewati semua
          </Text>
        </Pressable>
      </View>
      <View className="flex-row gap-1.5" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {STEPS.map((_, i) => (
          <View key={i} className="flex-1 h-1.5 rounded-full" style={{ backgroundColor: i <= step ? "#0F3FC1" : "#D4D4D4" }} />
        ))}
      </View>

      {step === 0 && (
        <View className="gap-3" accessibilityRole="radiogroup">
          {PRIORITY_OPTIONS.map((o) => (
            <OptionCard
              key={o.value}
              label={o.label}
              description={o.description}
              selected={priority === o.value}
              onPress={() => setPriority(priority === o.value ? null : o.value)}
            />
          ))}
          <Text className="text-ink-2 text-sm">{PRIORITY_NOTE}</Text>
        </View>
      )}

      {step === 1 && (
        <View className="gap-5">
          <View className="gap-3" accessibilityRole="radiogroup">
            <Text className="text-ink text-base" weight="bold">
              Batas jalan kaki
            </Text>
            {WALK_LIMIT_OPTIONS.map((o) => (
              <OptionCard
                key={o.value}
                label={o.label}
                description={o.description}
                selected={walkLimit === o.value}
                onPress={() => setWalkLimit(walkLimit === o.value ? null : o.value)}
              />
            ))}
          </View>
          <View className="gap-3">
            <Text className="text-ink text-base" weight="bold">
              Moda yang ingin dihindari
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {AVOID_MODE_OPTIONS.map((o) => (
                <ToggleChip key={o.value} label={o.label} selected={avoidModes.includes(o.value)} onPress={() => toggleMode(o.value)} />
              ))}
            </View>
          </View>
          <Text className="text-ink-2 text-sm">{STORED_ONLY_NOTE}</Text>
        </View>
      )}

      {step === 2 && <AccessibilityForm needs={needs} onChangeNeeds={setNeeds} consent={consent} onChangeConsent={setConsent} />}

      {error && <FormMessage tone="error" message={error} />}

      <View className="gap-3">
        <PrimaryButton
          label={saving ? "Menyimpan…" : isLast ? "Simpan" : "Lanjut"}
          onPress={next}
          loading={saving}
          disabled={nextDisabled}
          accessibilityHint={nextDisabled ? "Pilih minimal satu kebutuhan dan centang persetujuan untuk menyimpan." : undefined}
        />
        <PrimaryButton label={isLast ? "Lewati, jangan simpan" : "Lewati langkah ini"} variant="outline" onPress={skipStep} disabled={saving} />
      </View>
    </AuthScreenLayout>
  );
}
