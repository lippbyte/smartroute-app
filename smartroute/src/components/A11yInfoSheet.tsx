// src/components/A11yInfoSheet.tsx
//
// Hari 3 Task 2: rincian info aksesibilitas kursi roda satu rute — titik
// naik/turun/transfer dan statusnya menurut data GTFS. Bahasa: "tercatat"
// (bukan klaim fakta), tanpa jaminan.
import PrimaryButton from "@/components/form/PrimaryButton";
import Text from "@/components/Text";
import { legModeFromBackend, LEG_MODES } from "@/components/transit/legModes";
import type { RouteItem } from "@/type";
import { Ionicons } from "@expo/vector-icons";
import { Modal, ScrollView, View } from "react-native";
import { t } from "@/i18n";

const ROLE: Record<string, string> = {
  get naik() {
    return t("a11y.role.board");
  },
  get turun() {
    return t("a11y.role.alight");
  },
  get transfer() {
    return t("a11y.role.transfer");
  },
};
const STATUS: Record<string, { text: string; icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  bisa: {
    get text() {
      return t("a11y.status.yes");
    },
    icon: "checkmark-circle",
    color: "#065F46",
  },
  tidak_bisa: {
    get text() {
      return t("a11y.status.no");
    },
    icon: "close-circle",
    color: "#B91C1C",
  },
  tidak_diketahui: {
    get text() {
      return t("a11y.status.unknown");
    },
    icon: "help-circle",
    color: "#404040",
  },
};

export default function A11yInfoSheet({ route, onClose }: { route: RouteItem | null; onClose: () => void }) {
  const info = route?.accessibility;
  return (
    <Modal visible={!!info} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 justify-end" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
        <View className="bg-surface rounded-t-3xl" style={{ maxHeight: "85%" }}>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 32 }}>
            <Text className="text-ink text-xl" weight="bold" accessibilityRole="header">
              {t("assistive.showA11yInfo.label")}
            </Text>
            {info && (
              <>
                <Text className="text-ink-2 text-sm" style={{ lineHeight: 20 }}>
                  {info.summary}
                </Text>
                <View className="gap-2">
                  {info.points.map((p, i) => {
                    const s = STATUS[p.status];
                    return (
                      <View
                        key={`${p.stop_id ?? p.name}-${i}`}
                        className="flex-row items-start gap-2.5 bg-white rounded-xl p-3 border border-line"
                        accessible
                        accessibilityLabel={t("a11y.pointLabel", { role: ROLE[p.role], place: p.name, mode: LEG_MODES[legModeFromBackend(p.mode)].label, status: s.text })}
                      >
                        <Ionicons name={s.icon} size={20} color={s.color} style={{ marginTop: 1 }} />
                        <View className="flex-1 gap-0.5">
                          <Text className="text-ink text-[15px]" weight="semibold">
                            {ROLE[p.role]} · {p.name}
                          </Text>
                          <Text className="text-xs" style={{ color: s.color }}>
                            {s.text} · {LEG_MODES[legModeFromBackend(p.mode)].label}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                  {info.points.length === 0 && <Text className="text-ink-2 text-sm">{t("a11y.noPoints")}</Text>}
                </View>
                <Text className="text-ink-2 text-xs" style={{ lineHeight: 18 }}>
                  {t("a11y.sheetNote")}
                </Text>
              </>
            )}
            <PrimaryButton label={t("common.close")} onPress={onClose} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
