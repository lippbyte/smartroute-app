// src/components/transit/AllStopsMapView.tsx
//
// Shim resolusi modul — pola sama dengan CrowdMapView.tsx (Task App-03).
// Metro sendiri sudah memilih AllStopsMapView.web.tsx untuk web dan
// AllStopsMapView.native.tsx untuk Android/iOS berdasarkan ekstensi
// platform; file ini ada supaya TypeScript (yang tidak mengenal ekstensi
// platform) tetap punya modul untuk di-resolve dari import "./AllStopsMapView".
export { default } from "./AllStopsMapView.native";
export type {
  AllStopsMapViewHandle,
  AllStopsMapViewProps,
} from "./allStopsMapTypes";
