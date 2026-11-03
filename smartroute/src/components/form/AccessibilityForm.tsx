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
  accessibilityConsentText,
  accessibilityDevNote,
  ACCESSIBILITY_OPTIONS,
} from "@/constants/preferenceLabels";
import type { AccessibilityNeed } from "@/services/authService";
import { View } from "react-native";
import { t } from "@/i18n";

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
      <FormMessage tone="info" message={accessibilityDevNote()} />
      <View className="gap-1" accessibilityLabel={t("a11yCard.needs")}>
        {ACCESSIBILITY_OPTIONS.map((o) => (
          <CheckboxRow key={o.value} label={o.label} checked={needs.includes(o.value)} onPress={() => toggle(o.value)} />
        ))}
      </View>
      <View className="gap-1.5">
        <Text className="text-ink-2 text-[15px]" weight="semibold">
          {t("a11yCard.consent")}
        </Text>
        <CheckboxRow label={accessibilityConsentText()} checked={consent} onPress={() => onChangeConsent(!consent)} emphasis />
        {needs.length > 0 && !consent && (
          <Text className="text-sm" style={{ color: "#B91C1C" }}>
            {t("a11yCard.consentHint")}
          </Text>
        )}
      </View>
    </View>
  );
}
