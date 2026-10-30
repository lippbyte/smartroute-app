// Hari 3 Task 1: info aksesibilitas kursi roda per kandidat — opsi C
// (keputusan Khalifa): ANOTASI saja. Tidak menyaring, tidak mengurutkan,
// tidak memakai preferensi routing kursi roda OTP2.
//
// Yang dinilai HANYA titik naik, turun, dan transfer (ujung leg transit),
// dari wheelchair_boarding GTFS halte/stasiun, plus wheelchair_accessible
// perjalanan. Leg jalan kaki TIDAK dinilai (= tidak diketahui).
//
// Data saat ini (audit Hari 3 Task 0a): TransJakarta 96,9% halte terisi
// (0,8% bisa, 96,1% tidak bisa); KRL/MRT/LRT 0%; data perjalanan 0% di semua
// feed. Karena itu "tinggi" praktis tidak tercapai — tetap dihitung di sini,
// tetapi app TIDAK menampilkannya selama data perjalanan 0%.
//
// Bahasa: selalu "tercatat ... (menurut data GTFS)", bukan klaim fakta.
import type { OtpItinerary, OtpLeg } from "../lib/otpClient";

export type PointStatus = "bisa" | "tidak_bisa" | "tidak_diketahui";
export type AccessibilityConfidence = "tinggi" | "sedang" | "rendah" | "tidak_diketahui";

export interface AccessibilityPoint {
  /** gtfsId halte/stasiun; null bila ujung leg bukan halte GTFS. */
  stop_id: string | null;
  name: string;
  role: "naik" | "turun" | "transfer";
  mode: string;
  status: PointStatus;
}

export interface AccessibilityAssessment {
  accessibility_confidence: AccessibilityConfidence;
  accessibility_summary: string;
  accessibility_points: AccessibilityPoint[];
  /** Data perjalanan/armada: semua tercatat, sebagian, atau tidak ada. */
  accessibility_trip_data: "lengkap" | "sebagian" | "tidak_ada";
  accessibility_basis: "data_gtfs";
}

const toStatus = (v: string | null | undefined): PointStatus =>
  v === "POSSIBLE" ? "bisa" : v === "NOT_POSSIBLE" ? "tidak_bisa" : "tidak_diketahui";

export function assessAccessibility(it: OtpItinerary): AccessibilityAssessment {
  const transit = it.legs.filter((l) => l.mode !== "WALK");

  // Titik: naik di leg transit pertama, turun di leg terakhir, sisanya
  // transfer. Ujung leg yang berurutan di halte yang sama (turun lalu naik
  // di tempat yang sama) dihitung SEKALI.
  const points: Array<AccessibilityPoint & { key: string }> = [];
  transit.forEach((leg: OtpLeg, i) => {
    const ends: Array<[OtpLeg["from"], AccessibilityPoint["role"]]> = [
      [leg.from, i === 0 ? "naik" : "transfer"],
      [leg.to, i === transit.length - 1 ? "turun" : "transfer"],
    ];
    for (const [place, role] of ends) {
      const key = place.stop?.gtfsId ?? `${place.lat},${place.lon}`;
      if (points.at(-1)?.key === key) continue;
      points.push({
        key,
        stop_id: place.stop?.gtfsId ?? null,
        name: place.name,
        role,
        mode: leg.mode,
        status: toStatus(place.stop?.wheelchairBoarding),
      });
    }
  });

  const tripStatuses = transit.map((l) => toStatus(l.trip?.wheelchairAccessible));
  const knownTrips = tripStatuses.filter((s) => s !== "tidak_diketahui").length;
  const tripData = transit.length > 0 && knownTrips === transit.length ? "lengkap" : knownTrips > 0 ? "sebagian" : "tidak_ada";

  const notPossible = points.filter((p) => p.status === "tidak_bisa");
  const unknown = points.filter((p) => p.status === "tidak_diketahui");

  let confidence: AccessibilityConfidence;
  if (transit.length === 0) confidence = "tidak_diketahui";
  else if (notPossible.length > 0 || tripStatuses.includes("tidak_bisa")) confidence = "rendah";
  else if (unknown.length > 0) confidence = "tidak_diketahui";
  else if (tripStatuses.every((s) => s === "bisa")) confidence = "tinggi";
  else confidence = "sedang";

  const parts: string[] = [];
  if (transit.length === 0) {
    parts.push("Rute ini hanya jalan kaki; jalur jalan kaki belum dinilai");
  } else {
    if (notPossible.length) {
      parts.push(
        `${notPossible.length} dari ${points.length} titik naik/turun/transfer tercatat tidak bisa diakses kursi roda (menurut data GTFS): ${notPossible.map((p) => p.name).join(", ")}`,
      );
    }
    if (unknown.length) parts.push(`${unknown.length} titik tanpa data aksesibilitas`);
    const ok = points.length - notPossible.length - unknown.length;
    if (ok) parts.push(`${ok} titik tercatat bisa diakses kursi roda (menurut data GTFS)`);
    parts.push(tripData === "tidak_ada" ? "Data aksesibilitas armada tidak tersedia" : `Data armada ${tripData}`);
    if (it.legs.some((l) => l.mode === "WALK")) parts.push("Jalur jalan kaki belum dinilai");
  }

  return {
    accessibility_confidence: confidence,
    accessibility_summary: `${parts.join(". ")}.`,
    accessibility_points: points.map(({ key: _key, ...p }) => p),
    accessibility_trip_data: tripData,
    accessibility_basis: "data_gtfs",
  };
}
