// src/components/form/AccessibilityForm.tsx
//
// Hari 1 Task 3: pilihan kebutuhan aksesibilitas + persetujuan eksplisit —
// dipakai di langkah onboarding dan di Profil (ubah). Data pribadi sensitif:
// tombol simpan baru aktif setelah minimal satu kebutuhan DAN kotak
// persetujuan dicentang. Hari 1 hanya menyimpan; tidak menjanjikan rute
// aksesibel.
import { CheckboxRow } from "@/components/form/ChoiceControls";
import { FormMessage } from "@/components/form/FormField";
import Text from "@/components/Text";
import {
  ACCESSIBILITY_CONSENT_TEXT,
  ACCESSIBILITY_DEV_NOTE,
  ACCESSIBILITY_OPTIONS,
} from "@/constants/preferenceLabels";
import type { AccessibilityNeed } from "@/services/authService";
import { View } from "react-native";

interface Props {
  needs: AccessibilityNeed[];
  onChangeNeeds: (needs: AccessibilityNeed[]) => void;
  consent: boolean;
  onChangeConsent: (consent: boolean) => void;
}

export function canSaveAccessibility(needs: AccessibilityNeed[], consent: boolean): boolean {
  return needs.length > 0 && consent;
}

export default function AccessibilityForm({ needs, onChangeNeeds, consent, onChangeConsent }: Props) {
  const toggle = (need: AccessibilityNeed) =>
    onChangeNeeds(needs.includes(need) ? needs.filter((n) => n !== need) : [...needs, need]);

  return (
    <View className="gap-4">
      <FormMessage tone="info" message={ACCESSIBILITY_DEV_NOTE} />
      <View className="gap-1" accessibilityLabel="Kebutuhan aksesibilitas">
        {ACCESSIBILITY_OPTIONS.map((o) => (
          <CheckboxRow key={o.value} label={o.label} checked={needs.includes(o.value)} onPress={() => toggle(o.value)} />
        ))}
      </View>
      <View className="gap-1.5">
        <Text className="text-ink-2 text-[15px]" weight="semibold">
          Persetujuan
        </Text>
        <CheckboxRow label={ACCESSIBILITY_CONSENT_TEXT} checked={consent} onPress={() => onChangeConsent(!consent)} emphasis />
        {needs.length > 0 && !consent && (
          <Text className="text-sm" style={{ color: "#B91C1C" }}>
            Centang persetujuan di atas untuk menyimpan data ini.
          </Text>
        )}
      </View>
    </View>
  );
}
