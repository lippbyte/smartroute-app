// src/components/transit/AllStopsMapView.web.tsx
//
// Perluasan Task App-15 (diminta user langsung) — versi web, pola sama
// persis dengan CrowdMapView.web.tsx (Leaflet di dalam <iframe>). Beda
// utama: dengan ribuan titik (JakLingko ~7200), L.circleMarker satu-satu
// tanpa clustering akan bikin tab browser lag berat — jadi pakai plugin
// Leaflet.markercluster (unpkg, sama kelas sumber daya dengan
// maplibre-gl-leaflet yang sudah dipakai CrowdMapView.web.tsx) untuk
// clustering sisi-client, paralel dengan clustering sisi-native
// (GeoJSONSource cluster prop) di AllStopsMapView.native.tsx.
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { View } from "react-native";
import { MODE_COLOR, MODE_LABEL, MODE_SHORT_LABEL } from "./transitMode";
import type {
  AllStopsMapViewHandle,
  AllStopsMapViewProps,
} from "./allStopsMapTypes";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const JAKARTA_CENTER = { lat: -6.2088, lng: 106.8456 };

function buildMapHtml(stops: AllStopsMapViewProps["stops"]): string {
  const points = stops.map((s) => ({
    lat: s.lat,
    lng: s.lng,
    mode: s.mode,
    color: MODE_COLOR[s.mode],
    shortLabel: MODE_SHORT_LABEL[s.mode],
    popupHtml: `<strong>${escapeHtml(s.name)}</strong><br/>${escapeHtml(MODE_LABEL[s.mode])}`,
  }));

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <link rel="stylesheet" href="https://unpkg.com/maplibre-gl@2.4.0/dist/maplibre-gl.css" />
      <script src="https://unpkg.com/maplibre-gl@2.4.0/dist/maplibre-gl.js"></script>
      <script src="https://unpkg.com/@maplibre/maplibre-gl-leaflet@0.0.20/leaflet-maplibre-gl.js"></script>
      <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css" />
      <script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"></script>
      <style>
        html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #18181B; }
        .leaflet-popup-content { font-family: sans-serif; font-size: 13px; }
        /* Di bawah header (back + judul) DAN kolom cari halte (top 112px + ~48px). */
        .leaflet-top.leaflet-right { top: 172px; }
        .leaflet-control-attribution {
          background: rgba(24, 24, 27, 0.75);
          color: #A1A1AA;
          font-size: 10px;
        }
        .leaflet-control-attribution a { color: #D4D4D8; }
        /* Cluster bubble default plugin ini kuning/oranye terang, bentrok
           dengan tema gelap app — dicat ulang pakai warna aksen app supaya
           konsisten dengan cluster bubble versi native (#018959). */
        .stop-cluster-icon {
          background: rgba(0, 135, 90, 0.85);
          border: 2px solid #FFFFFF;
          border-radius: 50%;
          color: #FFFFFF;
          font-weight: bold;
          font-size: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
        }
        /* Titik individual (bukan cluster) — lingkaran warna per moda +
           kode huruf (TJ/JL/M/L, lihat MODE_SHORT_LABEL di transitMode.ts),
           padanan L.divIcon dari SymbolLayer teks di versi native supaya
           tampilannya konsisten di kedua platform. */
        .stop-icon {
          border: 2px solid #FFFFFF;
          border-radius: 50%;
          color: #FFFFFF;
          font-weight: bold;
          font-size: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          box-sizing: border-box;
        }
        .user-dot {
          width: 16px; height: 16px; background: #3B82F6; border-radius: 50%;
          border: 3px solid white; box-shadow: 0 0 0 6px rgba(59,130,246,0.25);
          box-sizing: border-box;
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        // maxZoom WAJIB diisi eksplisit di sini — BUKAN soal maplibre-gl-
        // leaflet (CrowdMapView.web.tsx/NavigateMap.web.tsx tidak butuh ini
        // sama sekali, dikonfirmasi lewat A/B test langsung), tapi plugin
        // Leaflet.markercluster (L.markerClusterGroup di bawah, cuma dipakai
        // di file INI karena cuma di sini titiknya bisa ribuan) yang
        // menghitung ambang declustering berbasis zoom secara internal dan
        // melempar persis pesan error ini kalau map.getMaxZoom() tidak
        // terhingga — menghentikan SISA script di block ini (termasuk kode
        // pembuatan marker/cluster yang jalan setelahnya), jadi sebelum ini
        // ditambahkan peta cuma nampilkan ubin kosong tanpa satupun marker.
        const map = L.map('map', { attributionControl: true, zoomControl: false, maxZoom: 19 }).setView(
          [${JAKARTA_CENTER.lat}, ${JAKARTA_CENTER.lng}], 11
        );

        L.control.zoom({ position: 'topright' }).addTo(map);

        L.maplibreGL({
          style: 'https://tiles.openfreemap.org/styles/dark',
          attribution:
            'OpenFreeMap &copy; <a href="https://www.openmaptiles.org/" target="_blank">OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
        }).addTo(map);

        const points = ${JSON.stringify(points)};

        // radius 60px (default plugin 80) — dengan JakLingko sepadat ini,
        // radius default menggabungkan terlalu agresif di zoom rendah
        // sampai kelihatan cuma 1-2 gelembung raksasa menutupi separuh
        // kota; 60 masih mengelompokkan (perlu untuk performa) tapi
        // sebaran per-area tetap kebaca begitu mulai zoom in.
        const clusterGroup = L.markerClusterGroup({
          maxClusterRadius: 60,
          iconCreateFunction: (cluster) => {
            const count = cluster.getChildCount();
            const label = count >= 1000 ? Math.round(count / 100) / 10 + 'k' : String(count);
            return L.divIcon({
              html: '<div class="stop-cluster-icon">' + label + '</div>',
              className: '',
              iconSize: [
                count >= 2000 ? 44 : count >= 500 ? 38 : count >= 50 ? 32 : 26,
                count >= 2000 ? 44 : count >= 500 ? 38 : count >= 50 ? 32 : 26,
              ],
            });
          },
        });

        points.forEach((p) => {
          // divIcon (bukan circleMarker polos) supaya kode huruf per-moda
          // (TJ/JL/M/L) kelihatan di dalam lingkarannya — padanan
          // SymbolLayer teks di versi native, lihat catatan .stop-icon di
          // atas.
          const icon = L.divIcon({
            html:
              '<div class="stop-icon" style="background:' + p.color + '">' +
              p.shortLabel + '</div>',
            className: '',
            iconSize: [18, 18],
            iconAnchor: [9, 9],
          });
          const marker = L.marker([p.lat, p.lng], { icon });
          marker.bindPopup(p.popupHtml);
          clusterGroup.addLayer(marker);
        });

        map.addLayer(clusterGroup);

        // Fitur cari-nama-halte (all-stops-map.tsx): pola FLY_TO postMessage
        // sama persis dengan NavigateMap.web.tsx.
        let userMarker = null;
        window.addEventListener('message', (e) => {
          const d = e.data;
          if (!d) return;
          if (d.type === 'FLY_TO') {
            map.flyTo([d.lat, d.lng], d.zoom || 16, { duration: 0.8 });
          } else if (d.type === 'USER_LOCATION') {
            const ll = [d.latitude, d.longitude];
            if (!userMarker) {
              const icon = L.divIcon({ html: '<div class="user-dot"></div>', className: '', iconSize: [16, 16], iconAnchor: [8, 8] });
              userMarker = L.marker(ll, { icon, zIndexOffset: 2000, interactive: false }).addTo(map);
            } else userMarker.setLatLng(ll);
          }
        });
      </script>
    </body>
    </html>
  `;
}

const AllStopsMapView = forwardRef<AllStopsMapViewHandle, AllStopsMapViewProps>(
  ({ stops, userLocation }, ref) => {
    const iframeRef = useRef<HTMLIFrameElement | null>(null);

    // Dikirim ulang juga di onLoad: toggle moda memuat ulang dokumen iframe
    // dan marker lokasi di dokumen lama ikut hilang.
    const postUserLocation = () => {
      if (!userLocation) return;
      iframeRef.current?.contentWindow?.postMessage(
        { type: "USER_LOCATION", latitude: userLocation.latitude, longitude: userLocation.longitude },
        "*",
      );
    };

    useEffect(postUserLocation, [userLocation]);
    // Target terakhir yang diminta. Memilih halte dari moda yang chip-nya
    // masih mati akan MENYALAKAN moda itu -> daftar stops berubah -> srcDoc
    // dibangun ulang -> dokumen iframe dimuat ULANG. Pesan FLY_TO yang
    // dikirim tepat setelah itu sampai sebelum listener di dokumen baru
    // terpasang, jadi hilang begitu saja dan peta tidak pernah pindah
    // (dilaporkan user 23 Sep 2026). Targetnya disimpan lalu dikirim ulang
    // di onLoad.
    const pendingFly = useRef<{ lat: number; lng: number; zoom: number; at: number } | null>(null);

    const postFly = (target: { lat: number; lng: number; zoom: number }) => {
      iframeRef.current?.contentWindow?.postMessage({ type: "FLY_TO", ...target }, "*");
    };

    useImperativeHandle(ref, () => ({
      flyTo: (coordinate, zoom = 16) => {
        const target = { lat: coordinate.lat, lng: coordinate.lng, zoom };
        pendingFly.current = { ...target, at: Date.now() };
        postFly(target);
      },
    }));

    // srcDoc dibangun ulang cuma kalau daftar stops berubah (toggle moda),
    // bukan tiap render — sama alasan dengan useMemo di versi native.
    const html = useMemo(() => buildMapHtml(stops), [stops]);

    return (
      <View style={{ flex: 1, backgroundColor: "#18181B" }}>
        <iframe
          ref={iframeRef as any}
          srcDoc={html}
          onLoad={() => {
            postUserLocation();
            // Hanya target yang benar-benar baru (bukan sisa pencarian lama
            // saat user cuma toggle chip moda).
            const target = pendingFly.current;
            if (target && Date.now() - target.at < 8000) {
              postFly({ lat: target.lat, lng: target.lng, zoom: target.zoom });
            }
          }}
          style={{ width: "100%", height: "100%", border: "none", display: "block" }}
          title="Peta Semua Halte"
        />
      </View>
    );
  },
);

export default AllStopsMapView;
