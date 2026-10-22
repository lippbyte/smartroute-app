import { Ionicons } from "@expo/vector-icons";
import { Ref } from "react";
import { Pressable, View } from "react-native";
import LocationAutocompleteField, {
  LocationAutocompleteFieldHandle,
} from "./LocationAutocompleteField";
import Text from "./Text";
import { PlaceSuggestion } from "@/utils/geocode";

interface RouteCardProps {
  origin: string;
  destination: string;
  onOriginChange: (value: string) => void;
  onDestinationChange: (value: string) => void;
  /**
   * Perluasan Task App-21 (fitur "Tujuan Cepat"): dipakai Beranda memanggil
   * blur() secara imperative tepat setelah mengisi field ini dari luar
   * (bukan dari user mengetik) — lihat catatan lengkap di
   * LocationAutocompleteFieldHandle.
   */
  destinationFieldRef?: Ref<LocationAutocompleteFieldHandle>;
  onOriginSelect?: (suggestion: PlaceSuggestion) => void;
  onDestinationSelect?: (suggestion: PlaceSuggestion) => void;
  /** Tombol tukar asal <-> tujuan. */
  onSwap?: () => void;
}

export default function RouteCard({
  origin,
  destination,
  onOriginChange,
  onDestinationChange,
  destinationFieldRef,
  onOriginSelect,
  onDestinationSelect,
  onSwap,
}: RouteCardProps) {
  return (
    <View
      className="w-full bg-surface-2 px-4 py-4 rounded-xl gap-2.5"
      // Dropdown saran lokasi di dalam kartu ini absolute & meluber ke bawah,
      // menimpa area DepartureTimeField yang di Beranda adalah sibling
      // BERIKUTNYA — tanpa zIndex di sini, sibling itu selalu menang (urutan
      // render), zIndex di dalam LocationAutocompleteField cuma berlaku antar
      // anak kartu ini, bukan lintas kartu.
      style={{ zIndex: 10 }}
    >
      <Text className="text-ink-2 text-md">Dari</Text>
      <LocationAutocompleteField
        value={origin}
        onChange={onOriginChange}
        onSelectPlace={onOriginSelect}
        placeholder="Lokasi Anda"
      />
      <View className="flex-row gap-4 items-center">
        <View className="flex-1 h-[2px] rounded-xl bg-line"></View>
        <Pressable
          onPress={onSwap}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Tukar asal dan tujuan"
          className="p-1 rounded-full active:bg-line"
        >
          <Ionicons name="swap-vertical" size={24} color="#404040" />
        </Pressable>
      </View>
      <Text className="text-ink-2 text-md">Tujuan</Text>
      <LocationAutocompleteField
        ref={destinationFieldRef}
        value={destination}
        onChange={onDestinationChange}
        onSelectPlace={onDestinationSelect}
        placeholder="Tujuan Anda"
      />
    </View>
  );
}
