// Hari 1 Task 1/5/6: riwayat perjalanan & rating. Setiap query menyaring
// user_id — perjalanan milik akun lain diperlakukan seperti tidak ada.
import { randomUUID } from "node:crypto";
import type { z } from "zod";
import { db } from "../lib/db";
import type { RatingRequestSchema, TripCreateRequestSchema } from "../lib/validation";

type TripInput = z.infer<typeof TripCreateRequestSchema>;
type RatingInput = z.infer<typeof RatingRequestSchema>;

interface TripRow {
  id: string;
  user_id: string;
  client_ref: string | null;
  created_at: string;
  origin_label: string;
  destination_label: string;
  route_summary_json: string;
  predicted_min: number | null;
  predicted_max: number | null;
  actual_duration_min: number | null;
  duration_basis: "aktual" | "estimasi";
  fare_total: number;
  co2_estimate_g: number | null;
  // dari LEFT JOIN ratings
  stars: number | null;
  eta_accurate: number | null;
  transfer_risk_accurate: number | null;
  crowd_accurate: number | null;
  message: string | null;
  rated_at: string | null;
}

const SELECT_TRIPS = `
  SELECT t.*, r.stars, r.eta_accurate, r.transfer_risk_accurate, r.crowd_accurate, r.message,
         r.created_at AS rated_at
  FROM trips t LEFT JOIN ratings r ON r.trip_id = t.id`;

const toBool = (v: number | null) => (v === null ? null : v === 1);
const fromBool = (v: boolean | null | undefined) => (v === null || v === undefined ? null : v ? 1 : 0);

function toTrip(row: TripRow) {
  return {
    id: row.id,
    created_at: row.created_at,
    origin_label: row.origin_label,
    destination_label: row.destination_label,
    route_summary: JSON.parse(row.route_summary_json),
    predicted_min_range:
      row.predicted_min !== null && row.predicted_max !== null ? { min: row.predicted_min, max: row.predicted_max } : null,
    actual_duration_min: row.actual_duration_min,
    duration_basis: row.duration_basis,
    fare_total: row.fare_total,
    co2_estimate_g: row.co2_estimate_g,
    rating:
      row.stars === null
        ? null
        : {
            stars: row.stars,
            eta_accurate: toBool(row.eta_accurate),
            transfer_risk_accurate: toBool(row.transfer_risk_accurate),
            crowd_accurate: toBool(row.crowd_accurate),
            message: row.message,
            created_at: row.rated_at,
          },
  };
}

export type Trip = ReturnType<typeof toTrip>;

export function getTrip(userId: string, tripId: string): Trip | null {
  const row = db.prepare(`${SELECT_TRIPS} WHERE t.id = ? AND t.user_id = ?`).get(tripId, userId) as TripRow | undefined;
  return row ? toTrip(row) : null;
}

/** Idempoten per client_ref: kirim ulang yang sama mengembalikan entri lama. */
export function createTrip(userId: string, input: TripInput): { trip: Trip; created: boolean } {
  if (input.client_ref) {
    const existing = db
      .prepare("SELECT id FROM trips WHERE user_id = ? AND client_ref = ?")
      .get(userId, input.client_ref) as { id: string } | undefined;
    if (existing) return { trip: getTrip(userId, existing.id)!, created: false };
  }
  const id = randomUUID();
  db.prepare(
    `INSERT INTO trips (id, user_id, client_ref, created_at, origin_label, destination_label, route_summary_json,
       predicted_min, predicted_max, actual_duration_min, duration_basis, fare_total, co2_estimate_g)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    userId,
    input.client_ref ?? null,
    new Date().toISOString(),
    input.origin_label,
    input.destination_label,
    JSON.stringify(input.route_summary),
    input.predicted_min_range?.min ?? null,
    input.predicted_min_range?.max ?? null,
    input.actual_duration_min,
    input.duration_basis,
    input.fare_total,
    input.co2_estimate_g ?? null,
  );
  return { trip: getTrip(userId, id)!, created: true };
}

export function listTrips(userId: string, limit = 100): Trip[] {
  const rows = db
    .prepare(`${SELECT_TRIPS} WHERE t.user_id = ? ORDER BY t.created_at DESC LIMIT ?`)
    .all(userId, limit) as unknown as TripRow[];
  return rows.map(toTrip);
}

export class AlreadyRatedError extends Error {}

export function rateTrip(userId: string, tripId: string, input: RatingInput): Trip | null {
  if (!getTrip(userId, tripId)) return null;
  try {
    db.prepare(
      `INSERT INTO ratings (trip_id, stars, eta_accurate, transfer_risk_accurate, crowd_accurate, message, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      tripId,
      input.stars,
      fromBool(input.eta_accurate),
      fromBool(input.transfer_risk_accurate),
      fromBool(input.crowd_accurate),
      input.message ? input.message : null,
      new Date().toISOString(),
    );
  } catch (err) {
    if (err instanceof Error && /UNIQUE constraint failed: ratings\.trip_id/.test(err.message)) {
      throw new AlreadyRatedError();
    }
    throw err;
  }
  return getTrip(userId, tripId);
}
