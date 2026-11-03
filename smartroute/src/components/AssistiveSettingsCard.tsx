// Kartu "Tampilan & bantuan" di Profil — Hari 3 Task 2. Untuk semua
// pengguna (termasuk tamu): pengaturan tersimpan di perangkat, bukan di
// server. Bantuan yang aktif karena profil aksesibilitas ditandai
// "diusulkan dari profil"; profil tersimpan tidak pernah diubah dari sini.
import Text from "@/components/Text";
import { UNAVAILABLE_ASSISTIVE, useAssistive } from "@/context/AssistiveSettingsContext";
import { assistiveWorkingSummary, visibleAssistiveItems } from "@/utils/assistiveSettings";
import { Pressable, Switch, View } from "react-native";
import { t } from "@/i18n";

// Hari 4 Task 1: tanpa bantuan yang tidak ditawarkan di platform ini.
const ITEMS = visibleAssistiveItems(UNAVAILABLE_ASSISTIVE);

export default function AssistiveSettingsCard() {
  const { settings, setChoice } = useAssistive();

  return (
    <View className="bg-surface w-full px-5 py-4 rounded-2xl border border-line gap-1">
      <Text className="text-ink font-bold text-lg" accessibilityRole="header">
        {t("assistive.title")}
      </Text>
      <Text className="text-ink-2 text-xs">{t("assistive.savedHere")}</Text>

      {ITEMS.map(({ key, label, description }, i) => {
        const s = settings[key];
        return (
          <Pressable
            key={key}
            onPress={() => setChoice(key, !s.on)}
            accessibilityRole="switch"
            accessibilityState={{ checked: s.on }}
            accessibilityLabel={label}
            accessibilityHint={description}
            className={`flex-row items-center gap-3 py-3 ${i < ITEMS.length - 1 ? "border-b border-line" : ""}`}
            style={{ minHeight: 56 }}
          >
            <View className="flex-1 gap-0.5">
              <Text className="text-ink text-[15px]" weight="semibold">
                {label}
              </Text>
              <Text className="text-ink-2 text-xs" style={{ lineHeight: 17 }}>
                {description}
              </Text>
              {s.suggested && (
                <Text className="text-xs" weight="semibold" style={{ color: "#065F46" }}>
                  {t("assistive.suggested")}
                </Text>
              )}
            </View>
            <Switch
              value={s.on}
              onValueChange={(v) => setChoice(key, v)}
              trackColor={{ false: "#A3A3A3", true: "#0F3FC1" }}
              thumbColor="#FFFFFF"
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
          </Pressable>
        );
      })}

      <View className="rounded-xl p-3 mt-2 gap-1" style={{ backgroundColor: "#F4F4F0" }}>
        <Text className="text-ink text-xs" weight="bold">
          {t("assistive.working")}
        </Text>
        <Text className="text-ink-2 text-xs" style={{ lineHeight: 17 }}>
          {assistiveWorkingSummary(UNAVAILABLE_ASSISTIVE)}
        </Text>
        <Text className="text-ink text-xs mt-1" weight="bold">
          {t("assistive.developing")}
        </Text>
        <Text className="text-ink-2 text-xs" style={{ lineHeight: 17 }}>
          {t("assistive.developingBody")}
        </Text>
      </View>
    </View>
  );
}
