// src/components/crowd/CrowdMapView.native.tsx
//
// Task App-03: versi native (Android/iOS) dari peta kepadatan, memakai
// @maplibre/maplibre-react-native v11 — komponen <Map>/<Camera>/<Marker>
// (v11 mengganti <MapView> milik v10; nama & bentuk props di sini mengikuti
// type definitions paket yang benar-benar terpasang, v11.3.8).
//
// Sumber tile: OpenFreeMap, style yang sama persis dengan versi web setelah
// Task App-02 — gratis dan tanpa API key. Ini sengaja BUKAN react-native-maps
// (yang dipakai NavigateMap.native.tsx): react-native-maps memakai Google Maps
// SDK di Android, yang butuh android.config.googleMaps.apiKey — dan key itu
// belum ada di app.json.
import { CrowdOverviewStop } from "@/services/crowdService";
import {
  Camera,
  Map,
  Marker,
  type InitialViewState,
} from "@maplibre/maplibre-react-native";
import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Text from "@/components/Text";
import { LEVEL_COLOR, LEVEL_LABEL, formatReportedAt } from "./crowdLevel";
import type { CrowdMapViewProps } from "./types";

const OPENFREEMAP_DARK_STYLE = "https://tiles.openfreemap.org/styles/dark";

// Dipakai kalau semua laporan kebetulan berada di satu titik yang sama (atau
// cuma ada satu laporan) — bounds dengan luas nol bikin kamera tidak punya
// zoom yang masuk akal untuk dihitung.
const SINGLE_POINT_ZOOM = 14;

function buildInitialViewState(stops: CrowdOverviewStop[]): InitialViewState {
  if (stops.length === 0) {
    // Jakarta-wide, sama seperti fallback versi web. Praktisnya tidak
    // tercapai karena pemanggil sudah menyaring daftar kosong.
    return { center: [106.8456, -6.2088], zoom: 11 };
  }

  const lngs = stops.map((s) => s.lng);
  const lats = stops.map((s) => s.lat);
  const west = Math.min(...lngs);
  const east = Math.max(...lngs);
  const south = Math.min(...lats);
  const north = Math.max(...lats);

  // Bounds "tipis" (satu titik, atau semua titik nyaris berimpit) tidak layak
  // di-fit — jatuhkan ke center + zoom tetap.
  const isDegenerate = east - west < 1e-6 && north - south < 1e-6;
  if (isDegenerate) {
    return { center: [west, south], zoom: SINGLE_POINT_ZOOM };
  }

  return {
    bounds: [west, south, east, north],
    // Menyisakan ruang untuk header layar di atas dan legenda + kartu info
    // di bawah, supaya marker terluar tidak tertutup keduanya.
    padding: { top: 120, right: 56, bottom: 200, left: 56 },
  };
}

export default function CrowdMapView({ stops, onReportStop }: CrowdMapViewProps) {
  const [selected, setSelected] = useState<CrowdOverviewStop | null>(null);

  // Kamera hanya perlu posisi awal — perhitungan ulang tiap render tidak
  // diinginkan (dan initialViewState memang cuma dibaca sekali oleh Camera).
  const initialViewState = useMemo(() => buildInitialViewState(stops), [stops]);

  return (
    <View style={styles.container}>
      <Map
        mapStyle={OPENFREEMAP_DARK_STYLE}
        style={styles.map}
        // Task App-17/App-18 (ditemukan di NavigateMap.native.tsx, dipasang
        // di sini juga untuk konsistensi — akar masalahnya sama: satu
        // gestur 2-jari MapLibre default ditafsirkan sebagai
        // pan+zoom+rotate+pitch sekaligus): touchRotate=false mencegah
        // ikon kompas (bentuk lingkaran) muncul tiba-tiba tiap peta sedikit
        // berputar dari gestur pinch-zoom yang tidak sinkron sempurna;
        // touchPitch=false mencegah gestur pan/pinch tiba-tiba memiringkan
        // tampilan 3D yang app ini tidak pernah pakai. Peta kepadatan cuma
        // butuh pan+zoom, tidak pernah butuh rotasi/tilt manual.
        touchRotate={false}
        touchPitch={false}
        compass={false}
        // Tap di area kosong peta menutup kartu info yang sedang terbuka.
        onPress={() => setSelected(null)}
      >
        <Camera initialViewState={initialViewState} />

        {stops.map((stop) => {
          const isSelected = selected?.stop_id === stop.stop_id;
          return (
            <Marker
              key={stop.stop_id}
              id={stop.stop_id}
              lngLat={[stop.lng, stop.lat]}
              onPress={(event) => {
                // Tanpa ini, tap di marker "bubbling" ke onPress milik <Map>
                // di atas (didokumentasikan di API-nya sendiri untuk event
                // dari child) — akibatnya selected langsung di-null-kan lagi
                // pada gesture yang sama, dan kartu info tidak pernah
                // kelihatan kepencet. Ditemukan lewat tes langsung di HP.
                event.stopPropagation();
                setSelected(stop);
              }}
            >
              <View
                style={[
                  styles.marker,
                  {
                    backgroundColor: LEVEL_COLOR[stop.level],
                    width: isSelected ? 26 : 20,
                    height: isSelected ? 26 : 20,
                    borderRadius: isSelected ? 13 : 10,
                  },
                ]}
              />
            </Marker>
          );
        })}
      </Map>

      {selected && (
        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Text style={styles.infoTitle}>{selected.name}</Text>
            <Pressable
              onPress={() => setSelected(null)}
              hitSlop={12}
              accessibilityLabel="Tutup info halte"
            >
              <Ionicons name="close" size={18} color="#737373" />
            </Pressable>
          </View>

          <View style={styles.infoLevelRow}>
            <View
              style={[
                styles.infoLevelDot,
                { backgroundColor: LEVEL_COLOR[selected.level] },
              ]}
            />
            <Text style={styles.infoLevelText}>
              Kepadatan: {LEVEL_LABEL[selected.level]}
            </Text>
          </View>

          <Text style={styles.infoMeta}>
            Laporan terakhir: {formatReportedAt(selected.reported_at)}
          </Text>

          {onReportStop && (
            <Pressable
              onPress={() => {
                const stop = selected;
                setSelected(null);
                onReportStop(stop);
              }}
              style={styles.reportButton}
            >
              <Ionicons name="megaphone-outline" size={14} color="#FFFFFF" />
              <Text style={styles.reportButtonText}>Lapor di sini</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#18181B",
  },
  // Ditulis eksplisit, bukan StyleSheet.absoluteFillObject: properti itu
  // sudah tidak ada di typing react-native 0.86 (lihat catatan Task App-03 —
  // NavigateMap.native.tsx masih memakainya dan karena itu gagal typecheck).
  map: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  marker: {
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  // Duduk di atas legenda layar (yang ada di bottom: 32) supaya keduanya
  // tidak saling menutupi.
  infoCard: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 96,
    backgroundColor: "rgba(39, 39, 42, 0.97)",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
  },
  infoHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  infoTitle: {
    flex: 1,
    color: "#FAFAFA",
    fontWeight: "bold",
    fontSize: 15,
  },
  infoLevelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  infoLevelDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#FFFFFF",
  },
  infoLevelText: {
    color: "#404040",
    fontSize: 13,
  },
  infoMeta: {
    color: "#737373",
    fontSize: 12,
  },
  reportButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#018959",
    borderRadius: 10,
    paddingVertical: 9,
    marginTop: 4,
  },
  reportButtonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 13,
  },
});
