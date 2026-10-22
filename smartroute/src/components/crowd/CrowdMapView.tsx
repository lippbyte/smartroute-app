// src/components/crowd/CrowdMapView.tsx
//
// Task App-03: shim resolusi modul, pola yang sama dengan
// NavigateMap.tsx. Metro sendiri sudah memilih CrowdMapView.web.tsx untuk web
// dan CrowdMapView.native.tsx untuk Android/iOS berdasarkan ekstensi
// platform; file ini ada supaya TypeScript (yang tidak mengenal ekstensi
// platform) tetap punya modul untuk di-resolve dari import "./CrowdMapView".
export { default } from "./CrowdMapView.native";
export type { CrowdMapViewProps } from "./types";
