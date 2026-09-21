// src/routes/nearbyStops.ts
//
// Task Backend-11: GET /nearby-stops — daftar halte/stasiun 4 moda
// (TransJakarta, JakLingko/mikrotrans, MRT, LRT) terdekat dari satu titik.
// Murni info lokasi (proximity), BUKAN routing — lihat batasan eksplisit
// task & services/nearbyStops.ts untuk detail sumber datanya.
import { Router } from "express";
import {
  DEFAULT_RADIUS_M,
  findNearbyStops,
} from "../services/nearbyStops";
import { OtpGraphQLError, OtpUnavailableError } from "../lib/otpClient";

const router = Router();

// Jaga-jaga supaya user tidak bisa minta radius sangat besar yang
// ujung-ujungnya menyisir seluruh 7819 stop OTP2 percuma (haversine per
// stop murah, tapi tidak ada alasan mengizinkan radius tidak masuk akal
// untuk fitur "lihat yang deket").
const MAX_RADIUS_M = 5000;

function parseCoordinateParam(raw: unknown): number | null {
  if (typeof raw !== "string" || raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

router.get("/nearby-stops", async (req, res) => {
  const lat = parseCoordinateParam(req.query.lat);
  const lng = parseCoordinateParam(req.query.lng ?? req.query.lon);

  if (lat === null || lng === null || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({
      error: "invalid_request",
      message:
        "Query param 'lat' dan 'lng' (atau 'lon') wajib diisi, angka valid dalam rentang koordinat.",
    });
  }

  let radius = DEFAULT_RADIUS_M;
  if (typeof req.query.radius === "string" && req.query.radius.trim() !== "") {
    const parsedRadius = Number(req.query.radius);
    if (!Number.isFinite(parsedRadius) || parsedRadius <= 0) {
      return res.status(400).json({
        error: "invalid_request",
        message: "Query param 'radius' harus angka positif (meter).",
      });
    }
    radius = Math.min(parsedRadius, MAX_RADIUS_M);
  }

  try {
    const stops = await findNearbyStops(lat, lng, radius);
    return res.status(200).json(stops);
  } catch (err) {
    // TransJakarta/JakLingko datanya dari OTP2 — MRT/LRT statis tetap bisa
    // dijawab walau OTP2 lagi mati, tapi findNearbyStops() memang gagal
    // total saat ini kalau OTP2 tidak terjangkau (getAllOtpStops() dipanggil
    // duluan). Error jelas, bukan 500 generik, sama seperti endpoint lain
    // yang bergantung OTP2.
    if (err instanceof OtpUnavailableError) {
      return res.status(502).json({ error: "otp2_unavailable", message: err.message });
    }
    if (err instanceof OtpGraphQLError) {
      console.error("OTP2 GraphQL errors:", err.errors);
      return res.status(502).json({ error: "otp2_graphql_error", message: err.message });
    }
    console.error("Unexpected error in GET /nearby-stops:", err);
    return res.status(500).json({ error: "internal_error", message: "Terjadi kesalahan internal." });
  }
});

export default router;
