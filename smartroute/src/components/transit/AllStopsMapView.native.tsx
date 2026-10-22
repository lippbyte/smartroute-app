// src/components/transit/AllStopsMapView.native.tsx
//
// Perluasan Task App-15 (diminta user langsung): peta SEMUA halte se-Jakarta
// (bisa ribuan titik, terutama JakLingko ~7200) — beda dari CrowdMapView
// yang cuma menampilkan halte dengan laporan aktif (biasanya puluhan).
// Marker satu-satu untuk jumlah sebesar ini akan bikin app lag berat (tiap
// <Marker> MapLibre RN adalah native view sendiri) — jadi WAJIB pakai
// clustering sisi-GPU dari GeoJSONSource (cluster/clusterRadius/
// clusterMaxZoom props, didukung native, lihat
// node_modules/@maplibre/maplibre-react-native/src/components/sources/
// geojson-source/GeoJSONSource.tsx), bukan clustering manual di JS.
import { MODE_COLOR, MODE_SHORT_LABEL } from "./transitMode";
import type {
  AllStopsMapViewHandle,
  AllStopsMapViewProps,
} from "./allStopsMapTypes";
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  UserLocation,
  type CameraRef,
  type GeoJSONSourceRef,
} from "@maplibre/maplibre-react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Text from "@/components/Text";
import StopActionButtons from "./StopActionButtons";
import { MODE_ICON, MODE_LABEL, TransitMode } from "./transitMode";

const OPENFREEMAP_DARK_STYLE = "https://tiles.openfreemap.org/styles/dark";

// Jakarta-wide, sama seperti fallback CrowdMapView.native.tsx — dengan
// ribuan titik yang praktis "menyelimuti" seluruh kota, fit-bounds per
// render tidak perlu (dan tidak murah untuk dihitung ulang tiap toggle
// moda); satu view tetap yang sudah mencakup Jabodetabek cukup.
const JAKARTA_CENTER: [number, number] = [106.8456, -6.2088];
const INITIAL_ZOOM = 10.5;

// WAJIB di-set eksplisit di SETIAP Layer type="symbol" di file ini.
// MapLibre butuh glyph SDF untuk merender teks, dan kalau `text-font` tidak
// diisi, defaultnya "Open Sans Regular,Arial Unicode MS Regular" — font itu
// TIDAK ADA di endpoint glyphs OpenFreeMap (style yang dipakai app ini),
// jadi request `/fonts/Open%20Sans%20Regular,.../0-255.pbf` balas 404,
// render thread MapLibre gagal, dan AKIBATNYA SELURUH marker di source ini
// tidak tampil sama sekali — bukan cuma teksnya, lingkaran cluster &
// titik individualnya pun ikut hilang. Ini akar masalah bug "halte tidak
// muncul di peta" yang dilaporkan saat testing device fisik; ketahuan dari
// 2 baris ERROR MapLibre Native di log Metro. "Noto Sans Regular"/"Noto
// Sans Bold" adalah yang benar-benar tersedia di
// https://tiles.openfreemap.org/fonts/... (dicek langsung: 200, dan
// "Noto Sans Regular" memang satu-satunya font stack yang dipakai style
// dark bawaan OpenFreeMap sendiri).
const GLYPH_FONT = ["Noto Sans Bold"];

const SOURCE_ID = "allStops";
const CLUSTER_LAYER_ID = "allStopsClusters";
const CLUSTER_COUNT_LAYER_ID = "allStopsClusterCount";
const UNCLUSTERED_LAYER_ID = "allStopsUnclustered";
const UNCLUSTERED_LABEL_LAYER_ID = "allStopsUnclusteredLabel";

interface SelectedStop {
  name: string;
  mode: TransitMode;
  lat: number;
  lng: number;
}

function buildGeoJson(stops: AllStopsMapViewProps["stops"]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: stops.map((stop) => ({
      type: "Feature",
      properties: { name: stop.name, mode: stop.mode },
      geometry: { type: "Point", coordinates: [stop.lng, stop.lat] },
    })),
  };
}

const AllStopsMapView = forwardRef<AllStopsMapViewHandle, AllStopsMapViewProps>(
  ({ stops, bottomInset = 0, userLocation }, ref) => {
  const cameraRef = useRef<CameraRef>(null);
  const sourceRef = useRef<GeoJSONSourceRef>(null);
  const [selected, setSelected] = useState<SelectedStop | null>(null);

  useImperativeHandle(ref, () => ({
    flyTo: (coordinate, zoom = 16) => {
      cameraRef.current?.easeTo({
        center: [coordinate.lng, coordinate.lat],
        zoom,
        duration: 800,
      });
    },
  }));

  // GeoJSON dibangun ulang cuma kalau daftar stops-nya sendiri berubah
  // (misal toggle moda) — bukan tiap render.
  const geojson = useMemo(() => buildGeoJson(stops), [stops]);

  return (
    <View style={styles.container}>
      <Map
        mapStyle={OPENFREEMAP_DARK_STYLE}
        style={styles.map}
        // Task App-17/App-18 — lihat catatan identik di
        // NavigateMap.native.tsx & CrowdMapView.native.tsx: matikan
        // rotate/tilt via gestur supaya pan 2-jari terasa presisi
        // (tidak diam-diam ikut memutar/memiringkan) dan ikon kompas
        // tidak muncul tiba-tiba. Peta ini murni untuk melihat sebaran
        // halte — tidak pernah butuh rotasi/tilt manual.
        touchRotate={false}
        touchPitch={false}
        compass={false}
        onPress={() => setSelected(null)}
      >
        <Camera
          ref={cameraRef}
          initialViewState={{ center: JAKARTA_CENTER, zoom: INITIAL_ZOOM }}
        />

        <GeoJSONSource
          ref={sourceRef}
          id={SOURCE_ID}
          data={geojson}
          cluster
          clusterRadius={50}
          clusterMaxZoom={14}
          onPress={async (event) => {
            event.stopPropagation();
            const feature = event.nativeEvent.features?.[0];
            if (!feature || feature.geometry.type !== "Point") return;
            const coords = feature.geometry.coordinates as [number, number];

            if (feature.properties?.cluster) {
              // Tap cluster: zoom ke level minimum yang memecahnya jadi
              // cluster lebih kecil / titik individual, bukan sekadar
              // zoom-in tetap — supaya konsisten di semua level kepadatan
              // (JakLingko yang sangat rapat vs MRT yang jarang).
              const clusterId = feature.properties.cluster_id as number;
              try {
                const expansionZoom =
                  await sourceRef.current?.getClusterExpansionZoom(clusterId);
                cameraRef.current?.easeTo({
                  center: coords,
                  zoom: (expansionZoom ?? INITIAL_ZOOM + 2) + 0.5,
                  duration: 500,
                });
              } catch {
                cameraRef.current?.easeTo({ center: coords, zoom: INITIAL_ZOOM + 3, duration: 500 });
              }
              setSelected(null);
              return;
            }

            setSelected({
              name: String(feature.properties?.name ?? "Halte"),
              mode: feature.properties?.mode as TransitMode,
              lat: coords[1],
              lng: coords[0],
            });
          }}
        >
          <Layer
            id={CLUSTER_LAYER_ID}
            type="circle"
            filter={["has", "point_count"]}
            paint={{
              "circle-color": "#018959",
              "circle-opacity": 0.85,
              "circle-stroke-width": 2,
              "circle-stroke-color": "#FFFFFF",
              // Cluster besar (banyak JakLingko menumpuk) dapat radius
              // lebih besar supaya kepadatannya kelihatan sekilas, bukan
              // cuma dari angka teksnya.
              "circle-radius": [
                "step",
                ["get", "point_count"],
                14,
                50,
                18,
                500,
                24,
                2000,
                30,
              ],
            }}
          />
          <Layer
            id={CLUSTER_COUNT_LAYER_ID}
            type="symbol"
            filter={["has", "point_count"]}
            layout={{
              "text-field": ["get", "point_count_abbreviated"],
              "text-size": 12,
              // WAJIB diisi eksplisit — lihat catatan GLYPH_FONT di atas.
              "text-font": GLYPH_FONT,
            }}
            paint={{ "text-color": "#FFFFFF" }}
          />
          <Layer
            id={UNCLUSTERED_LAYER_ID}
            type="circle"
            filter={["!", ["has", "point_count"]]}
            paint={{
              "circle-color": [
                "match",
                ["get", "mode"],
                "transjakarta",
                MODE_COLOR.transjakarta,
                "jaklingko",
                MODE_COLOR.jaklingko,
                "mrt",
                MODE_COLOR.mrt,
                "lrt",
                MODE_COLOR.lrt,
                "#9CA3AF",
              ],
              // Radius dinaikkan dari 6 ke 9 (dibanding versi sebelum ikon)
              // supaya kode huruf di layer label bawah muat kebaca di dalam
              // lingkarannya, bukan cuma nempel di pinggir.
              "circle-radius": 9,
              "circle-stroke-width": 1.5,
              "circle-stroke-color": "#FFFFFF",
            }}
          />
          {/* Kode huruf per moda (TJ/JL/M/L) di atas lingkaran warna —
              lihat MODE_SHORT_LABEL di transitMode.ts untuk alasan kenapa
              bukan Ionicons langsung (MapLibre native tidak bisa render
              font-icon React di dalam style layer). */}
          <Layer
            id={UNCLUSTERED_LABEL_LAYER_ID}
            type="symbol"
            filter={["!", ["has", "point_count"]]}
            layout={{
              "text-field": [
                "match",
                ["get", "mode"],
                "transjakarta",
                MODE_SHORT_LABEL.transjakarta,
                "jaklingko",
                MODE_SHORT_LABEL.jaklingko,
                "mrt",
                MODE_SHORT_LABEL.mrt,
                "lrt",
                MODE_SHORT_LABEL.lrt,
                "",
              ],
              "text-size": 9,
              // WAJIB diisi eksplisit — lihat catatan GLYPH_FONT di atas.
              "text-font": GLYPH_FONT,
              "text-allow-overlap": true,
              "text-ignore-placement": true,
            }}
            paint={{ "text-color": "#FFFFFF" }}
          />
        </GeoJSONSource>

        {/* Dirender setelah source halte supaya titik biru tidak tertimbun
            cluster; hanya kalau izin lokasi sudah diberikan. */}
        {userLocation && <UserLocation animated />}
      </Map>

      {selected && (
        // bottomInset = tinggi baris chip filter milik layar (diukur
        // dinamis di all-stops-map.tsx) + jarak nafas 12px, supaya kartu
        // ini duduk PERSIS di atasnya dan tidak saling menimpa — bug UI
        // yang dilaporkan saat testing device fisik.
        <View style={[styles.infoCard, { bottom: 32 + bottomInset + 12 }]}>
          <View style={styles.infoHeader}>
            <View
              style={[styles.infoIconWrap, { backgroundColor: `${MODE_COLOR[selected.mode]}33` }]}
            >
              <Ionicons name={MODE_ICON[selected.mode]} size={18} color={MODE_COLOR[selected.mode]} />
            </View>
            <View style={styles.infoTextWrap}>
              <Text style={styles.infoTitle} numberOfLines={2}>
                {selected.name}
              </Text>
              <Text style={[styles.infoMode, { color: MODE_COLOR[selected.mode] }]}>
                {MODE_LABEL[selected.mode]}
              </Text>
            </View>
            <Pressable
              onPress={() => setSelected(null)}
              hitSlop={12}
              accessibilityLabel="Tutup info halte"
            >
              <Ionicons name="close" size={18} color="#737373" />
            </Pressable>
          </View>
          <StopActionButtons stop={selected} userLocation={userLocation ?? null} />
        </View>
      )}
    </View>
  );
  },
);

export default AllStopsMapView;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#18181B",
  },
  map: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  infoCard: {
    position: "absolute",
    left: 20,
    right: 20,
    // `bottom` di-override inline pakai bottomInset — lihat pemakaiannya.
    backgroundColor: "rgba(39, 39, 42, 0.97)",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  infoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  infoIconWrap: {
    padding: 8,
    borderRadius: 10,
  },
  infoTextWrap: {
    flex: 1,
    gap: 2,
  },
  infoTitle: {
    color: "#FAFAFA",
    fontWeight: "bold",
    fontSize: 14,
  },
  infoMode: {
    fontSize: 12,
    fontWeight: "bold",
  },
});
