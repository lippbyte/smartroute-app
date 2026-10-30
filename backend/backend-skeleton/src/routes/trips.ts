// Hari 1 Task 1/5/6: riwayat perjalanan & rating — wajib masuk. Tamu tidak
// punya riwayat di server (migrasi riwayat tamu -> akun di luar cakupan).
import { Router } from "express";
import { authedUserId, requireAuth } from "../lib/auth";
import { invalidRequest } from "../lib/respond";
import { RatingRequestSchema, TripCreateRequestSchema } from "../lib/validation";
import { AlreadyRatedError, createTrip, getTrip, listTrips, rateTrip } from "../services/trips";

const router = Router();

const TRIP_NOT_FOUND = { error: "trip_not_found", message: "Perjalanan tidak ditemukan." };

router.post("/trips", requireAuth, (req, res) => {
  const parsed = TripCreateRequestSchema.safeParse(req.body);
  if (!parsed.success) return invalidRequest(res, parsed.error, "Data perjalanan tidak valid.");
  try {
    const { trip, created } = createTrip(authedUserId(res), parsed.data);
    return res.status(created ? 201 : 200).json(trip);
  } catch (err) {
    console.error("Unexpected error in POST /trips:", err);
    return res.status(500).json({ error: "internal_error", message: "Terjadi kesalahan internal." });
  }
});

router.get("/trips", requireAuth, (_req, res) => {
  return res.status(200).json(listTrips(authedUserId(res)));
});

router.get("/trips/:id", requireAuth, (req, res) => {
  const trip = getTrip(authedUserId(res), String(req.params.id));
  return trip ? res.status(200).json(trip) : res.status(404).json(TRIP_NOT_FOUND);
});

router.post("/trips/:id/rating", requireAuth, (req, res) => {
  const parsed = RatingRequestSchema.safeParse(req.body);
  if (!parsed.success) return invalidRequest(res, parsed.error, "Penilaian tidak valid.");
  try {
    const trip = rateTrip(authedUserId(res), String(req.params.id), parsed.data);
    return trip ? res.status(201).json(trip) : res.status(404).json(TRIP_NOT_FOUND);
  } catch (err) {
    if (err instanceof AlreadyRatedError) {
      return res.status(409).json({
        error: "already_rated",
        message: "Perjalanan ini sudah dinilai. Penilaian hanya bisa dikirim sekali.",
      });
    }
    console.error("Unexpected error in POST /trips/:id/rating:", err);
    return res.status(500).json({ error: "internal_error", message: "Terjadi kesalahan internal." });
  }
});

export default router;
