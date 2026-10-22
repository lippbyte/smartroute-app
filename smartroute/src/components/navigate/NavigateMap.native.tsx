// src/components/navigate/NavigateMap.native.tsx
//
// MapLibre + OpenFreeMap (tanpa API key) — lihat riwayat migrasi dari
// react-native-maps di Task Ops-02/App-03: Google Maps SDK butuh key yang
// tidak pernah ada, dan app crash begitu peta dibuka di device fisik.
//
// touchRotate/touchPitch sengaja mati (Task App-17/18): gestur 2 jari
// hampir selalu ikut memutar/memiringkan peta sedikit, memunculkan ikon
// kompas dan membuat geser peta terasa tidak presisi.
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  Marker,
  UserLocation,
  type CameraRef,
} from "@maplibre/maplibre-react-native";
import { Ionicons } from "@expo/vector-icons";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { NavigateMapHandle, NavigateMapProps } from "./navigateMapTypes";

export type { NavigateMapHandle, NavigateMapProps } from "./navigateMapTypes";

const OPENFREEMAP_DARK_STYLE = "https://tiles.openfreemap.org/styles/dark";

function boundsOf(coords: [number, number][]): [number, number, number, number] | null {
  if (!coords.length) return null;
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const [lng, lat] of coords) {
    w = Math.min(w, lng); e = Math.max(e, lng);
    s = Math.min(s, lat); n = Math.max(n, lat);
  }
  return [w, s, e, n];
}

const NavigateMap = forwardRef<NavigateMapHandle, NavigateMapProps>(
  (
    { segments, stops, activeLegIndex, focusCoords, userLocation, isFollowingUser, padding },
    ref,
  ) => {
    const cameraRef = useRef<CameraRef>(null);

    useImperativeHandle(ref, () => ({
      flyTo: (center: [number, number], zoom = 16) => {
        cameraRef.current?.easeTo({ center, zoom, duration: 800 });
      },
    }));

    // Ikuti GPS: pusatkan tiap update. Tidak mengikuti: bingkai leg aktif,
    // hanya saat leg berganti / mode ikuti dimatikan (bukan tiap GPS
    // bergerak), supaya user bebas menggeser peta.
    useEffect(() => {
      if (!isFollowingUser || !userLocation) return;
      cameraRef.current?.easeTo({
        center: [userLocation.longitude, userLocation.latitude],
        zoom: 16.5,
        duration: 600,
      });
    }, [isFollowingUser, userLocation]);

    useEffect(() => {
      if (isFollowingUser && userLocation) return;
      const b = boundsOf(focusCoords);
      if (!b) return;
      cameraRef.current?.fitBounds(b, {
        padding: { top: padding.top + 24, bottom: padding.bottom + 24, left: 40, right: 40 },
        duration: 800,
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeLegIndex, isFollowingUser]);

    const lines = useMemo<GeoJSON.FeatureCollection<GeoJSON.LineString>>(
      () => ({
        type: "FeatureCollection",
        features: segments.map((s, i) => ({
          type: "Feature",
          properties: { color: s.color, dashed: s.dashed, active: i === activeLegIndex },
          geometry: { type: "LineString", coordinates: s.coords },
        })),
      }),
      [segments, activeLegIndex],
    );

    const passStops = useMemo<GeoJSON.FeatureCollection<GeoJSON.Point>>(
      () => ({
        type: "FeatureCollection",
        features: stops
          .filter((s) => s.kind === "pass")
          .map((s) => ({
            type: "Feature",
            properties: { color: s.color },
            geometry: { type: "Point", coordinates: [s.lng, s.lat] },
          })),
      }),
      [stops],
    );

    if (segments.length === 0) return null;
    const start = segments[0].coords[0];
    const initialBounds = boundsOf(segments.flatMap((s) => s.coords));

    const widthExpr = ["case", ["get", "active"], 7, 5] as unknown as number;
    const opacityExpr = ["case", ["get", "active"], 1, 0.45] as unknown as number;

    return (
      <View style={styles.container}>
        <Map
          mapStyle={OPENFREEMAP_DARK_STYLE}
          style={styles.map}
          touchRotate={false}
          touchPitch={false}
          compass={false}
        >
          <Camera
            ref={cameraRef}
            initialViewState={
              initialBounds
                ? { bounds: initialBounds, padding: { top: 140, bottom: 260, left: 40, right: 40 } }
                : { center: start, zoom: 15 }
            }
          />

          <UserLocation animated />

          <GeoJSONSource id="navLegs" data={lines}>
            <Layer
              id="navLegsCasing"
              type="line"
              filter={["==", ["get", "dashed"], false]}
              layout={{ "line-cap": "round", "line-join": "round" }}
              paint={{ "line-color": "#0A0A0B", "line-width": 10, "line-opacity": opacityExpr }}
            />
            <Layer
              id="navLegsSolid"
              type="line"
              filter={["==", ["get", "dashed"], false]}
              layout={{ "line-cap": "round", "line-join": "round" }}
              paint={{
                "line-color": ["get", "color"] as unknown as string,
                "line-width": widthExpr,
                "line-opacity": opacityExpr,
              }}
            />
            <Layer
              id="navLegsWalk"
              type="line"
              filter={["==", ["get", "dashed"], true]}
              layout={{ "line-cap": "round", "line-join": "round" }}
              paint={{
                "line-color": "#D4D4D8",
                "line-width": widthExpr,
                "line-opacity": opacityExpr,
                "line-dasharray": [0.1, 2],
              }}
            />
          </GeoJSONSource>

          <GeoJSONSource id="navPassStops" data={passStops}>
            <Layer
              id="navPassStopsCircle"
              type="circle"
              paint={{
                "circle-radius": 4,
                "circle-color": "#18181B",
                "circle-stroke-width": 2,
                "circle-stroke-color": ["get", "color"] as unknown as string,
              }}
            />
          </GeoJSONSource>

          {/* Titik naik/turun/pindah moda + tujuan: Marker dengan label nama
              (jumlahnya sedikit, jadi aman sebagai view RN). */}
          {stops
            .filter((s) => s.kind !== "pass")
            .map((s, i) => (
              <Marker key={`stop-${i}`} id={`stop-${i}`} lngLat={[s.lng, s.lat]}>
                <View style={styles.stopWrap}>
                  {s.kind === "destination" ? (
                    <Ionicons name="location" size={28} color="#EF4444" />
                  ) : (
                    <View style={[styles.stopDot, { backgroundColor: s.color }]} />
                  )}
                  <Text style={styles.stopLabel} numberOfLines={1}>
                    {s.name}
                  </Text>
                </View>
              </Marker>
            ))}
        </Map>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#18181B" },
  // Eksplisit, bukan StyleSheet.absoluteFillObject — properti itu sudah
  // tidak ada di typing react-native 0.86 (lihat catatan Task App-03).
  map: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  stopWrap: { alignItems: "center" },
  stopDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  stopLabel: {
    fontFamily: "Plus-Jakarta-Sans",
    marginTop: 2,
    maxWidth: 160,
    color: "#F4F4F5",
    fontSize: 11,
    fontWeight: "600",
    backgroundColor: "rgba(24,24,27,0.9)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: "hidden",
  },
});

export default NavigateMap;
