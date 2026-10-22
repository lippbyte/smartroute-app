// src/components/crowd/CrowdMapView.web.tsx
//
// Task App-03: bagian rendering peta versi web, dipindahkan apa adanya dari
// src/app/crowd-map.tsx (Task App-01 + perbaikan sumber tile Task App-02)
// supaya layar crowd-map.tsx jadi shared antar platform. Teknik yang dipakai
// tetap sama: Leaflet di dalam <iframe>, sama seperti NavigateMap.web.tsx.
//
// Satu-satunya perubahan perilaku dibanding App-02: format waktu laporan kini
// lewat formatReportedAt() bersama (lihat crowdLevel.ts) — outputnya identik
// dengan toLocaleString("id-ID") yang dipakai sebelumnya, tapi tidak lagi
// bergantung pada Intl sehingga sama persis dengan versi native.
import { CrowdOverviewStop } from "@/services/crowdService";
import { useEffect } from "react";
import { View } from "react-native";
import {
  LEVEL_COLOR,
  LEVEL_LABEL,
  formatReportedAt,
} from "./crowdLevel";
import type { CrowdMapViewProps } from "./types";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Task App-07: pesan dari dalam iframe (klik "Lapor di sini" di popup) ke
// parent — pola postMessage yang sama seperti NavigateMap.web.tsx pakai
// untuk FLY_TO/UPDATE_STATE, karena iframe srcDoc tidak bisa dipanggil
// langsung dari React di luar.
const REPORT_MESSAGE_TYPE = "CROWD_MAP_REPORT_STOP";

function buildMapHtml(stops: CrowdOverviewStop[]): string {
  const points = stops.map((s) => ({
    stopId: s.stop_id,
    lat: s.lat,
    lng: s.lng,
    color: LEVEL_COLOR[s.level],
    popupHtml:
      `<strong>${escapeHtml(s.name)}</strong><br/>` +
      `Kepadatan: <b>${LEVEL_LABEL[s.level]}</b><br/>` +
      `Laporan terakhir: ${escapeHtml(formatReportedAt(s.reported_at))}<br/>` +
      `<button class="report-btn" data-stop-id="${escapeHtml(s.stop_id)}">Lapor di sini</button>`,
  }));

  // Jakarta-wide default view — used only when there happen to be no points
  // to fit bounds to (caller already guards the true "no reports at all"
  // case with a dedicated empty state, but this keeps the map itself sane
  // if that ever changes).
  const fallbackCenter = { lat: -6.2088, lng: 106.8456 };

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <!-- OpenFreeMap tiles are vector tiles rendered via MapLibre GL; this
           bridge plugin lets them plug into Leaflet as a normal layer, so
           the rest of the map (L.map/L.circleMarker/L.featureGroup below)
           stays plain Leaflet. See Task App-02. -->
      <link rel="stylesheet" href="https://unpkg.com/maplibre-gl@2.4.0/dist/maplibre-gl.css" />
      <script src="https://unpkg.com/maplibre-gl@2.4.0/dist/maplibre-gl.js"></script>
      <script src="https://unpkg.com/@maplibre/maplibre-gl-leaflet@0.0.20/leaflet-maplibre-gl.js"></script>
      <style>
        html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #18181B; }
        .leaflet-popup-content { font-family: sans-serif; font-size: 13px; }
        /* Di bawah header layar (back + judul, top 56px + tinggi ~48px). */
        .leaflet-top.leaflet-right { top: 116px; }
        .leaflet-control-attribution {
          background: rgba(24, 24, 27, 0.75);
          color: #A1A1AA;
          font-size: 10px;
        }
        .leaflet-control-attribution a { color: #D4D4D8; }
        .report-btn {
          margin-top: 6px;
          width: 100%;
          background: #018959;
          color: #FFFFFF;
          border: none;
          border-radius: 6px;
          padding: 6px 0;
          font-size: 12px;
          font-weight: bold;
          cursor: pointer;
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        const map = L.map('map', { attributionControl: true, zoomControl: false }).setView(
          [${fallbackCenter.lat}, ${fallbackCenter.lng}], 11
        );

        // OpenFreeMap: free, no API key — replaces CartoDB's dark_all tiles,
        // which now require a key and render an "API KEY REQUIRED"
        // watermark instead of a map. Style URL mirrors the one already
        // proven working in the (shelved) dashboard's Map3DToggle.tsx.
        L.control.zoom({ position: 'topright' }).addTo(map);

        L.maplibreGL({
          style: 'https://tiles.openfreemap.org/styles/dark',
          attribution:
            'OpenFreeMap &copy; <a href="https://www.openmaptiles.org/" target="_blank">OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
        }).addTo(map);

        const points = ${JSON.stringify(points)};
        const markers = [];

        points.forEach((p) => {
          const marker = L.circleMarker([p.lat, p.lng], {
            radius: 10,
            color: '#FFFFFF',
            weight: 2,
            fillColor: p.color,
            fillOpacity: 0.9,
          }).addTo(map);
          marker.bindPopup(p.popupHtml);
          markers.push(marker);
        });

        // Delegasi satu listener untuk semua tombol "Lapor di sini" — popup
        // Leaflet dibuat/dihapus dari DOM tiap dibuka/ditutup, jadi listener
        // per-tombol tidak akan pernah nempel kalau dipasang lebih awal.
        map.on('popupopen', (e) => {
          const btn = e.popup.getElement().querySelector('.report-btn');
          if (!btn) return;
          btn.addEventListener('click', () => {
            window.parent.postMessage(
              { type: '${REPORT_MESSAGE_TYPE}', stopId: btn.dataset.stopId },
              '*',
            );
          });
        });

        // Task App-07: fitBounds butuh minimal 2 titik berbeda untuk
        // menghitung area yang valid — dengan cuma 1 titik, getBounds()
        // mengembalikan bounds berukuran nol dan fitBounds gagal diam-diam
        // (marker tidak pernah ter-render, tanpa error apa pun). Ini persis
        // kondisi yang terjadi di awal Skenario 2 (submit laporan PERTAMA
        // ke peta yang tadinya kosong) — makanya harus ditangani eksplisit,
        // bukan cuma "kasus langka".
        if (markers.length === 1) {
          map.setView([points[0].lat, points[0].lng], 15);
        } else if (markers.length > 1) {
          const group = L.featureGroup(markers);
          map.fitBounds(group.getBounds().pad(0.25));
        }
      </script>
    </body>
    </html>
  `;
}

export default function CrowdMapView({ stops, onReportStop }: CrowdMapViewProps) {
  useEffect(() => {
    if (!onReportStop) return;

    function handleMessage(event: MessageEvent) {
      if (event.data?.type !== REPORT_MESSAGE_TYPE) return;
      const stop = stops.find((s) => s.stop_id === event.data.stopId);
      if (stop) onReportStop!(stop);
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [stops, onReportStop]);

  return (
    <View style={{ flex: 1, backgroundColor: "#18181B" }}>
      <iframe
        srcDoc={buildMapHtml(stops)}
        style={{ width: "100%", height: "100%", border: "none", display: "block" }}
        title="Peta Kepadatan"
      />
    </View>
  );
}
