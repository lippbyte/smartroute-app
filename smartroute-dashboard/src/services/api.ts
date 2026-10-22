// src/services/api.ts

const API_BASE_URL = "http://localhost:5000/api";

// ============================================================
// Tipe data sesuai bentuk yang dipakai komponen frontend
// (StationRankingCard.tsx, Map.tsx, StationDetail.tsx, dst)
// ============================================================
export interface StationData {
  id: string;
  name: string;
  coordinates: [number, number]; // [lat, lng]
  corridor: string;
  passenger_count: number;
  density_level: string;
  density_score: number;
  avg_dwell_time_sec: number;
  bus_arrival_eta_sec: number;
  status: string;
  ai_anomaly_flag: boolean;
}

export interface FleetData {
  unit_id: string;
  unit_name: string;
  transport_type: string;
  assigned_corridor: string;
  current_status: string;
  current_speed_kmh: number;
  passenger_capacity: number;
  current_load: number;
  last_lat: number;
  last_lng: number;
  last_updated: string;
}

// Bentuk mentah baris tabel `stations` dari Postgres (lihat stationController.js)
interface RawStationRow {
  id: string;
  name: string;
  coordinates: { x: number; y: number } | string | null; // kolom point Postgres
  route_or_line: string;
  passenger_count: number;
  density_level: string;
  density_score: string | number; // numeric(3,2) -> pg mengembalikan string
  avg_dwell_time_sec: number;
  next_arrival_eta_sec: number;
  status: string;
  ai_anomaly_flag: boolean;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

// Kolom `point` Postgres bisa datang sebagai objek {x, y} atau string "(x,y)"
// tergantung driver/parser. Fungsi ini menangani keduanya.
function parseCoordinates(raw: RawStationRow["coordinates"]): [number, number] {
  if (!raw) return [0, 0];

  if (typeof raw === "string") {
    const match = raw.replace(/[()]/g, "").split(",");
    const lng = parseFloat(match[0]);
    const lat = parseFloat(match[1]);
    return [lat, lng];
  }

  // Saat seeding, pointString disimpan sebagai (lng, lat) -> x = lng, y = lat
  return [raw.y, raw.x];
}

function mapStation(row: RawStationRow): StationData {
  return {
    id: row.id,
    name: row.name,
    coordinates: parseCoordinates(row.coordinates),
    corridor: row.route_or_line,
    passenger_count: row.passenger_count,
    density_level: row.density_level,
    density_score: typeof row.density_score === "string" ? parseFloat(row.density_score) : row.density_score,
    avg_dwell_time_sec: row.avg_dwell_time_sec,
    bus_arrival_eta_sec: row.next_arrival_eta_sec,
    status: row.status,
    ai_anomaly_flag: row.ai_anomaly_flag,
  };
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    throw new Error(`Request gagal (${res.status}): ${path}`);
  }

  const json: ApiResponse<T> = await res.json();

  if (!json.success) {
    throw new Error(json.message || `Request gagal: ${path}`);
  }

  return json.data;
}

// ============================================================
// STATIONS
// ============================================================
export async function getStations(): Promise<StationData[]> {
  const rows = await request<RawStationRow[]>("/stations");
  return rows.map(mapStation);
}

export async function getStationById(id: string): Promise<StationData> {
  const row = await request<RawStationRow>(`/stations/${id}`);
  return mapStation(row);
}

// ============================================================
// FLEETS (armada bus)
// ============================================================
export async function getFleets(): Promise<FleetData[]> {
  return request<FleetData[]>("/fleets");
}

// ============================================================
// FLAGS
// ============================================================
export type FlagType = "problematic" | "optimal";

export interface FlagPayload {
  station_id: string;
  flag_type: FlagType;
  severity_level?: string;
  notes?: string;
  flagged_by?: string;
}

// Bentuk baris dari flagController.js: SELECT sf.*, s.name as station_name, s.route_or_line
export interface FlagRow {
  id: number;
  station_id: string;
  flag_type: FlagType;
  severity_level: string | null;
  notes: string | null;
  flagged_by: string | null;
  created_at: string;
  active_flag: boolean; // Ini akan bernilai false untuk riwayat lama
  station_name: string;
  route_or_line: string;
  density_score?: number; // Opsional, tergantung apakah backend mengirimkannya
}

export async function getAllFlags(flagType?: FlagType): Promise<FlagRow[]> {
  const query = flagType ? `?flag_type=${flagType}` : "";
  // Panggil endpoint /flags/all sesuai route backend yang baru dibuat
  return request<FlagRow[]>(`/flags/all${query}`);
}

export async function createFlag(payload: FlagPayload): Promise<FlagRow> {
  return request<FlagRow>("/flags", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getActiveFlags(flagType?: FlagType): Promise<FlagRow[]> {
  const query = flagType ? `?flag_type=${flagType}` : "";
  return request<FlagRow[]>(`/flags${query}`);
}

export async function deactivateFlag(id: number): Promise<FlagRow> {
  return request<FlagRow>(`/flags/${id}/deactivate`, { method: "PUT" });
}