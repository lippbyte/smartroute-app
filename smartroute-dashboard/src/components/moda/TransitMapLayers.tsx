import { useEffect, useMemo, useRef, useState } from "react";
import type { ExpressionSpecification, GeoJSONSource, MapGeoJSONFeature, StyleSpecification } from "maplibre-gl";
import { useMap } from "@/components/ui/map";
import type { ModeKey, Network, Vehicle } from "@/simulation/types";
import { MODE_META } from "./modaMeta";

const V_SRC = "moda-vehicles";
const R_SRC = "moda-routes";
const S_SRC = "moda-stops";
const LAYER = {
  routes: "moda-routes-line",
  stopsRail: "moda-stops-rail",
  stopsBus: "moda-stops-bus",
  vehicles: "moda-vehicles-dot",
  selected: "moda-vehicles-selected",
};
const BASEMAP_TIMEOUT_MS = 8000;

const FALLBACK_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: "latar", type: "background", paint: { "background-color": "#101114" } }],
};

function colorByMode(): ExpressionSpecification {
  const stops = MODE_META.flatMap((m) => [m.key, m.color]);
  return ["match", ["get", "mode"], ...stops, "#888888"] as unknown as ExpressionSpecification;
}

function modeFilter(enabled: Set<ModeKey>, property: "mode" | "modes"): ExpressionSpecification {
  const keys = [...enabled];
  if (property === "mode") return ["in", ["get", "mode"], ["literal", keys]];
  // `modes` berisi daftar moda dipisah koma, karena satu halte bisa dilalui banyak moda.
  return ["any", false, ...keys.map((k) => ["in", k, ["get", "modes"]])] as unknown as ExpressionSpecification;
}

interface Props {
  network: Network;
  vehicles: Vehicle[];
  enabled: Set<ModeKey>;
  selectedVehicleId: string | null;
  onSelectVehicle: (id: string | null) => void;
  onSelectStop: (id: string | null) => void;
  onBasemapFailed: () => void;
}

export default function TransitMapLayers({
  network,
  vehicles,
  enabled,
  selectedVehicleId,
  onSelectVehicle,
  onSelectStop,
  onBasemapFailed,
}: Props) {
  const { map, isLoaded } = useMap();
  const [ready, setReady] = useState(false);
  const handlers = useRef({ onSelectVehicle, onSelectStop });
  handlers.current = { onSelectVehicle, onSelectStop };

  const staticData = useMemo(() => {
    const routes: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: network.patterns.map((p) => ({
        type: "Feature",
        properties: { mode: p.mode },
        geometry: { type: "LineString", coordinates: p.shape },
      })),
    };
    const modesAtStop = new Map<string, Set<string>>();
    for (const p of network.patterns) {
      for (const id of p.stopIds) {
        if (!modesAtStop.has(id)) modesAtStop.set(id, new Set());
        modesAtStop.get(id)!.add(p.mode);
      }
    }
    const railKeys = new Set(MODE_META.filter((m) => m.rail).map((m) => m.key as string));
    const stops: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: network.stops.map((s) => {
        const modes = [...(modesAtStop.get(s.id) ?? [])];
        return {
          type: "Feature",
          properties: { id: s.id, modes: modes.join(","), rail: modes.some((m) => railKeys.has(m)) },
          geometry: { type: "Point", coordinates: [s.lon, s.lat] },
        };
      }),
    };
    return { routes, stops };
  }, [network]);

  // Peta dasar berasal dari layanan luar. Kalau gagal, jaringan tetap tampil di
  // atas latar polos, bukan layar kosong.
  useEffect(() => {
    if (!map || isLoaded) return;
    const timer = window.setTimeout(() => {
      if (map.loaded() || map.isStyleLoaded()) return;
      map.setStyle(FALLBACK_STYLE, { diff: false });
      onBasemapFailed();
    }, BASEMAP_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [map, isLoaded, onBasemapFailed]);

  useEffect(() => {
    if (!map || !isLoaded) return;
    map.addSource(R_SRC, { type: "geojson", data: staticData.routes });
    map.addSource(S_SRC, { type: "geojson", data: staticData.stops });
    map.addSource(V_SRC, { type: "geojson", data: { type: "FeatureCollection", features: [] } });

    const color = colorByMode();
    map.addLayer({
      id: LAYER.routes,
      type: "line",
      source: R_SRC,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": color,
        "line-width": ["interpolate", ["linear"], ["zoom"], 9, 0.8, 14, 2.5],
        "line-opacity": ["match", ["get", "mode"], ["mrt", "lrt_jabodebek", "krl"], 0.75, 0.22],
      },
    });
    map.addLayer({
      id: LAYER.stopsBus,
      type: "circle",
      source: S_SRC,
      minzoom: 13.5,
      filter: ["==", ["get", "rail"], false],
      paint: { "circle-radius": 2.5, "circle-color": "#d4d4d8", "circle-opacity": 0.75 },
    });
    map.addLayer({
      id: LAYER.stopsRail,
      type: "circle",
      source: S_SRC,
      filter: ["==", ["get", "rail"], true],
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 2, 14, 5],
        "circle-color": "#ffffff",
        "circle-stroke-color": "#101114",
        "circle-stroke-width": 1,
      },
    });
    map.addLayer({
      id: LAYER.vehicles,
      type: "circle",
      source: V_SRC,
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 2.2, 13, 4.5, 16, 8],
        "circle-color": color,
        "circle-stroke-color": "#101114",
        "circle-stroke-width": 0.6,
      },
    });
    map.addLayer({
      id: LAYER.selected,
      type: "circle",
      source: V_SRC,
      filter: ["==", ["get", "id"], ""],
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 7, 16, 13],
        "circle-color": "rgba(0,0,0,0)",
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 2,
      },
    });

    const clickable = [LAYER.vehicles, LAYER.stopsRail, LAYER.stopsBus];
    const onClick = (e: { point: { x: number; y: number } }) => {
      const pad = 8;
      const found: MapGeoJSONFeature[] = map.queryRenderedFeatures(
        [
          [e.point.x - pad, e.point.y - pad],
          [e.point.x + pad, e.point.y + pad],
        ],
        { layers: clickable },
      );
      const vehicle = found.find((f) => f.layer.id === LAYER.vehicles);
      const stop = found.find((f) => f.layer.id !== LAYER.vehicles);
      handlers.current.onSelectVehicle(vehicle ? String(vehicle.properties.id) : null);
      handlers.current.onSelectStop(!vehicle && stop ? String(stop.properties.id) : null);
    };
    const pointer = () => {
      map.getCanvas().style.cursor = "pointer";
    };
    const unpointer = () => {
      map.getCanvas().style.cursor = "";
    };
    map.on("click", onClick);
    for (const id of clickable) {
      map.on("mouseenter", id, pointer);
      map.on("mouseleave", id, unpointer);
    }
    setReady(true);

    return () => {
      setReady(false);
      if (!map.getStyle()) return;
      map.off("click", onClick);
      for (const id of clickable) {
        map.off("mouseenter", id, pointer);
        map.off("mouseleave", id, unpointer);
      }
      for (const id of Object.values(LAYER)) if (map.getLayer(id)) map.removeLayer(id);
      for (const id of [V_SRC, S_SRC, R_SRC]) if (map.getSource(id)) map.removeSource(id);
    };
  }, [map, isLoaded, staticData]);

  useEffect(() => {
    if (!map || !ready) return;
    map.setFilter(LAYER.routes, modeFilter(enabled, "mode"));
    map.setFilter(LAYER.stopsRail, ["all", ["==", ["get", "rail"], true], modeFilter(enabled, "modes")]);
    map.setFilter(LAYER.stopsBus, ["all", ["==", ["get", "rail"], false], modeFilter(enabled, "modes")]);
  }, [map, ready, enabled]);

  useEffect(() => {
    if (!map || !ready) return;
    const source = map.getSource(V_SRC) as GeoJSONSource | undefined;
    source?.setData({
      type: "FeatureCollection",
      features: vehicles
        .filter((v) => enabled.has(v.mode))
        .map((v) => ({
          type: "Feature",
          properties: { id: v.id, mode: v.mode },
          geometry: { type: "Point", coordinates: [v.lon, v.lat] },
        })),
    });
  }, [map, ready, vehicles, enabled]);

  useEffect(() => {
    if (!map || !ready) return;
    map.setFilter(LAYER.selected, ["==", ["get", "id"], selectedVehicleId ?? ""]);
  }, [map, ready, selectedVehicleId]);

  return null;
}
