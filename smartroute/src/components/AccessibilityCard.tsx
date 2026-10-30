// Kartu Aksesibilitas di Profil. Hari 1 Task 3: data pribadi sensitif.
// - Isi/ubah selalu lewat AccessibilityForm dengan persetujuan yang
//   dicentang ULANG (persetujuan lama tidak dianggap berlaku untuk isi baru).
// - Hapus = DELETE /me/accessibility: kolom dikosongkan di backend, bukan
//   sekadar disembunyikan di app.
// Konfirmasi hapus dibuat inline (bukan Alert.alert — tombol Alert tidak
// jalan di web).
import AccessibilityForm, { canSaveAccessibility } from "@/components/form/AccessibilityForm";
import { FormMessage } from "@/components/form/FormField";
import PrimaryButton from "@/components/form/PrimaryButton";
import { ACCESSIBILITY_OPTIONS, labelOf } from "@/constants/preferenceLabels";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/services/apiClient";
import * as authService from "@/services/authService";
import type { AccessibilityNeed } from "@/services/authService";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import Text from "./Text";

export default function AccessibilityCard() {
  const { status, user, token, replaceUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [needs, setNeeds] = useState<AccessibilityNeed[]>([]);
  const [consent, setConsent] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status !== "signedIn" || !user || !token) return null;

  const saved = user.accessibility;

  const openEditor = () => {
    setNeeds(saved?.needs ?? []);
    setConsent(false);
    setError(null);
    setEditing(true);
  };

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal menghubungi server. Coba lagi.");
    } finally {
      setBusy(false);
    }
  };

  const save = () =>
    run(async () => {
      replaceUser(await authService.saveAccessibility(token, needs));
      setEditing(false);
    });

  const remove = () =>
    run(async () => {
      replaceUser(await authService.deleteAccessibility(token));
      setConfirmDelete(false);
    });

  return (
    <View className="bg-surface w-full px-5 py-4 rounded-2xl border border-line gap-3">
      <View className="flex-row items-center justify-between">
        <Text className="text-ink font-bold text-lg">Aksesibilitas</Text>
        <Pressable
          onPress={openEditor}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={saved ? "Ubah data aksesibilitas" : "Isi data aksesibilitas"}
          className="px-2 py-1.5"
        >
          <Text className="text-[15px] underline" weight="bold" style={{ color: "#0F3FC1" }}>
            {saved ? "Ubah" : "Isi"}
          </Text>
        </Pressable>
      </View>

      {saved ? (
        <View className="gap-1.5">
          {saved.needs.map((n) => (
            <View key={n} className="flex-row items-center gap-2">
              <Ionicons name="checkmark-circle" size={18} color="#065F46" />
              <Text className="text-ink text-[15px] flex-1">{labelOf(ACCESSIBILITY_OPTIONS, n) ?? n}</Text>
            </View>
          ))}
          <Text className="text-ink-2 text-xs mt-1">
            Disetujui {new Date(saved.consent_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}.
            Penyesuaian rute untuk profil ini sedang dikembangkan.
          </Text>
        </View>
      ) : (
        <Text className="text-ink-2 text-sm">Belum diisi. Opsional — hanya diisi bila Anda mau.</Text>
      )}

      {saved && !confirmDelete && (
        <Pressable
          onPress={() => setConfirmDelete(true)}
          accessibilityRole="button"
          className="flex-row items-center gap-1.5 self-start py-2"
          hitSlop={6}
        >
          <Ionicons name="trash-outline" size={18} color="#B91C1C" />
          <Text className="text-[15px]" weight="semibold" style={{ color: "#B91C1C" }}>
            Hapus data aksesibilitas
          </Text>
        </Pressable>
      )}

      {confirmDelete && (
        <View className="gap-2.5 rounded-xl p-3" style={{ backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FCA5A5" }}>
          <Text className="text-[15px]" style={{ color: "#7F1D1D" }}>
            Hapus semua data aksesibilitas dari akun Anda? Data akan dihapus dari server SmartRoute.
          </Text>
          <View className="flex-row gap-2">
            <View className="flex-1">
              <PrimaryButton label="Batal" variant="outline" onPress={() => setConfirmDelete(false)} disabled={busy} />
            </View>
            <View className="flex-1">
              <Pressable
                onPress={remove}
                disabled={busy}
                accessibilityRole="button"
                className="rounded-2xl items-center justify-center active:opacity-80"
                style={{ minHeight: 52, backgroundColor: "#B91C1C" }}
              >
                <Text className="text-base" weight="bold" style={{ color: "#FFFFFF" }}>
                  {busy ? "Menghapus…" : "Ya, hapus"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {error && !editing && <FormMessage tone="error" message={error} />}

      <Modal visible={editing} transparent animationType="fade" onRequestClose={() => setEditing(false)}>
        <View className="flex-1 justify-end" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <View className="bg-surface rounded-t-3xl" style={{ maxHeight: "90%" }}>
            <ScrollView
              contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 32 }}
              keyboardShouldPersistTaps="handled"
            >
              <Text className="text-ink text-xl" weight="bold" accessibilityRole="header">
                Kebutuhan aksesibilitas
              </Text>
              <AccessibilityForm needs={needs} onChangeNeeds={setNeeds} consent={consent} onChangeConsent={setConsent} />
              {error && <FormMessage tone="error" message={error} />}
              <PrimaryButton
                label={busy ? "Menyimpan…" : "Simpan"}
                onPress={save}
                loading={busy}
                disabled={!canSaveAccessibility(needs, consent)}
              />
              <PrimaryButton label="Batal" variant="outline" onPress={() => setEditing(false)} disabled={busy} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
