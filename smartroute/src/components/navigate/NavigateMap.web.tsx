// src/components/navigate/NavigateMap.web.tsx
//
// Leaflet di dalam iframe (srcDoc). Dokumen iframe dibangun SEKALI (lazy
// useState) — Task App-19: srcDoc yang berubah membuat browser me-reload
// seluruh peta (ubin di-fetch ulang, pan/zoom user hilang). Semua perubahan
// sesudahnya (leg aktif, posisi GPS, bingkai kamera) dikirim lewat
// postMessage.
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { View } from "react-native";
import type { NavigateMapHandle, NavigateMapProps } from "./navigateMapTypes";

export type { NavigateMapHandle, NavigateMapProps } from "./navigateMapTypes";

function escapeForScript(value: unknown): string {
  // JSON di dalam <script>: cegah "</script>" di nama halte memutus tag.
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

const NavigateMap = forwardRef<NavigateMapHandle, NavigateMapProps>(
  (
    { segments, stops, activeLegIndex, focusCoords, userLocation, isFollowingUser, padding },
    ref,
  ) => {
    const iframeRef = useRef<HTMLIFrameElement | null>(null);

    const post = (message: unknown) =>
      iframeRef.current?.contentWindow?.postMessage(message, "*");

    useImperativeHandle(ref, () => ({
      flyTo: (center: [number, number], zoom = 16) => {
        post({ type: "FLY_TO", lat: center[1], lng: center[0], zoom });
      },
    }));

    // Kunci bingkai: kamera hanya dibingkai ulang saat leg aktif berganti
    // atau mode ikuti-GPS dimatikan — bukan tiap update GPS, supaya user
    // tetap bisa menggeser peta dengan bebas.
    const focusKey = `${activeLegIndex}-${isFollowingUser ? 1 : 0}`;
    const latestState = useRef<unknown>(null);
    latestState.current = {
      type: "UPDATE_STATE",
      activeLegIndex,
      userLocation: userLocation ?? null,
      isFollowingUser: !!isFollowingUser,
      focusCoords,
      focusKey,
      padding,
    };

    useEffect(() => {
      post(latestState.current);
      // focusCoords turunan dari activeLegIndex — sudah terwakili focusKey.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeLegIndex, userLocation, isFollowingUser, focusKey, padding.top, padding.bottom]);

    const [leafletHtml] = useState(() => {
      if (segments.length === 0) return "";
      const lines = segments.map((s) => ({
        latlngs: s.coords.map((c) => [c[1], c[0]]),
        color: s.color,
        dashed: s.dashed,
      }));
      const first = segments[0].coords[0];

      return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <!-- OpenFreeMap (vector tiles, tanpa API key) lewat bridge MapLibre ->
       Leaflet. Lihat Task App-02. -->
  <link rel="stylesheet" href="https://unpkg.com/maplibre-gl@2.4.0/dist/maplibre-gl.css" />
  <script src="https://unpkg.com/maplibre-gl@2.4.0/dist/maplibre-gl.js"></script>
  <script src="https://unpkg.com/@maplibre/maplibre-gl-leaflet@0.0.20/leaflet-maplibre-gl.js"></script>
  <style>
    html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #18181B; }
    .leaflet-control-attribution { background: rgba(24,24,27,0.75); color: #A1A1AA; font-size: 10px; }
    .leaflet-control-attribution a { color: #D4D4D8; }
    .stop-label {
      background: rgba(24,24,27,0.92); color: #F4F4F5; border: 1px solid rgba(255,255,255,0.15);
      border-radius: 6px; font: 600 11px system-ui, sans-serif; padding: 2px 6px; box-shadow: none;
    }
    .stop-label.pass { font-weight: 500; color: #D4D4D8; }
    .stop-label::before { display: none; }
    .user-dot {
      width: 16px; height: 16px; background: #3B82F6; border-radius: 50%;
      border: 3px solid white; box-shadow: 0 0 0 6px rgba(59,130,246,0.25);
    }
    .dest-pin { font-size: 26px; line-height: 26px; filter: drop-shadow(0 1px 2px rgba(0,0,0,.6)); }
  </style>
</head>
<body>
<div id="map"></div>
<script>
  const map = L.map('map', { zoomControl: false, attributionControl: true })
    .setView([${first[1]}, ${first[0]}], 15);
  L.maplibreGL({
    style: 'https://tiles.openfreemap.org/styles/dark',
    attribution: 'OpenFreeMap &copy; <a href="https://www.openmaptiles.org/" target="_blank">OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
  }).addTo(map);

  const lines = ${escapeForScript(lines)};
  const stops = ${escapeForScript(stops)};

  // Garis tepi gelap di bawah garis moda supaya tetap terbaca di atas
  // jalan-jalan peta gelap.
  const casings = lines.map((l) => L.polyline(l.latlngs, {
    color: '#0A0A0B', weight: 9, opacity: 0.9, lineCap: 'round', lineJoin: 'round',
  }).addTo(map));
  const polylines = lines.map((l) => L.polyline(l.latlngs, {
    color: l.color, weight: 6, lineCap: 'round', lineJoin: 'round',
    dashArray: l.dashed ? '1 10' : null,
  }).addTo(map));

  const all = L.featureGroup(polylines);
  if (lines.length) map.fitBounds(all.getBounds(), { padding: [40, 40] });

  const passMarkers = [];
  stops.forEach((s) => {
    if (s.kind === 'destination') {
      const icon = L.divIcon({ html: '<div class="dest-pin">📍</div>', className: '', iconSize: [26, 26], iconAnchor: [13, 24] });
      L.marker([s.lat, s.lng], { icon, zIndexOffset: 1000 }).addTo(map)
        .bindTooltip(s.name, { permanent: true, direction: 'top', offset: [0, -22], className: 'stop-label' });
      return;
    }
    const isPass = s.kind === 'pass';
    const m = L.circleMarker([s.lat, s.lng], {
      radius: isPass ? 4 : 7,
      color: isPass ? s.color : '#FFFFFF',
      weight: isPass ? 2 : 3,
      fillColor: isPass ? '#18181B' : s.color,
      fillOpacity: 1,
    }).addTo(map);
    m.bindTooltip(s.name, {
      permanent: !isPass, direction: 'right', offset: [8, 0],
      className: 'stop-label' + (isPass ? ' pass' : ''),
    });
    if (isPass) passMarkers.push({ m, s });
  });

  // Nama halte yang dilewati ikut tampil saat diperbesar (zoom >= 16),
  // supaya tidak menumpuk di zoom jauh.
  function updatePassLabels() {
    const show = map.getZoom() >= 16;
    passMarkers.forEach(({ m }) => show ? m.openTooltip() : m.closeTooltip());
  }
  map.on('zoomend', updatePassLabels);

  let userMarker = null;
  let lastFocusKey = null;

  function applyActive(active) {
    polylines.forEach((p, i) => {
      const on = i === active;
      p.setStyle({ opacity: on ? 1 : 0.45, weight: on ? 7 : 5 });
      casings[i].setStyle({ opacity: on ? 0.9 : 0.4 });
      if (on) { casings[i].bringToFront(); p.bringToFront(); }
    });
  }

  window.addEventListener('message', (e) => {
    const d = e.data;
    if (!d) return;
    if (d.type === 'FLY_TO') {
      map.flyTo([d.lat, d.lng], d.zoom || 16, { duration: 0.8 });
      return;
    }
    if (d.type !== 'UPDATE_STATE') return;
    applyActive(d.activeLegIndex);
    if (d.userLocation) {
      const ll = [d.userLocation.latitude, d.userLocation.longitude];
      if (!userMarker) {
        const icon = L.divIcon({ html: '<div class="user-dot"></div>', className: '', iconSize: [16, 16], iconAnchor: [8, 8] });
        userMarker = L.marker(ll, { icon, zIndexOffset: 2000 }).addTo(map);
      } else userMarker.setLatLng(ll);
    }
    const pad = { paddingTopLeft: [40, d.padding.top + 20], paddingBottomRight: [40, d.padding.bottom + 20] };
    if (d.isFollowingUser && d.userLocation) {
      map.flyTo([d.userLocation.latitude, d.userLocation.longitude], Math.max(map.getZoom(), 16), { duration: 0.6 });
    } else if (d.focusKey !== lastFocusKey && d.focusCoords && d.focusCoords.length) {
      const b = L.latLngBounds(d.focusCoords.map((c) => [c[1], c[0]]));
      map.flyToBounds(b, Object.assign({ duration: 0.8, maxZoom: 17 }, pad));
    }
    lastFocusKey = d.focusKey;
  });
</script>
</body>
</html>`;
    });

    if (!leafletHtml) return null;

    return (
      <View style={{ flex: 1, backgroundColor: "#18181B" }}>
        <iframe
          ref={iframeRef as any}
          srcDoc={leafletHtml}
          // Pesan pertama bisa terkirim sebelum dokumen iframe siap — kirim
          // ulang state terakhir begitu dokumen selesai dimuat.
          onLoad={() => post(latestState.current)}
          style={{ width: "100%", height: "100%", border: "none", display: "block" }}
          title="Peta navigasi rute"
        />
      </View>
    );
  },
);

export default NavigateMap;
