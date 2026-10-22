// Task App-07: backs the crowd-report UI's "cari halte" step — needs a real
// OTP2 gtfsId to submit against (Task Backend-08), which Nominatim-based
// search (App-06) can't provide since it doesn't know about GTFS stop
// identity at all.
import { Router } from "express";
import { searchOtpStops, OtpGraphQLError, OtpUnavailableError } from "../lib/otpClient";
import { searchStations } from "../services/stationSearch";

const router = Router();

const MIN_QUERY_LENGTH = 3;

router.get("/stops/search", async (req, res) => {
  const query = typeof req.query.q === "string" ? req.query.q.trim() : "";

  // Same reasoning as App-06's autocomplete guard: a query this short
  // against ~7800 stops returns too many irrelevant matches to be useful,
  // and it's needless load on OTP2 for every keystroke.
  if (query.length < MIN_QUERY_LENGTH) {
    return res.status(200).json([]);
  }

  try {
    const stops = await searchOtpStops(query);
    return res.status(200).json(stops);
  } catch (err) {
    if (err instanceof OtpUnavailableError) {
      return res.status(502).json({ error: "otp2_unavailable", message: err.message });
    }
    if (err instanceof OtpGraphQLError) {
      console.error("OTP2 GraphQL errors:", err.errors);
      return res.status(502).json({ error: "otp2_graphql_error", message: err.message });
    }
    console.error("Unexpected error in GET /stops/search:", err);
    return res.status(500).json({ error: "internal_error", message: "Terjadi kesalahan internal." });
  }
});

// Autocomplete asal/tujuan: halte/stasiun digabung per tempat (bukan per
// peron), dengan moda & rute yang melayani — lihat services/stationSearch.ts.
router.get("/stations/search", async (req, res) => {
  const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (query.length < MIN_QUERY_LENGTH) {
    return res.status(200).json([]);
  }
  try {
    return res.status(200).json(await searchStations(query));
  } catch (err) {
    if (err instanceof OtpUnavailableError || err instanceof OtpGraphQLError) {
      return res.status(502).json({ error: "otp2_unavailable", message: err.message });
    }
    console.error("Unexpected error in GET /stations/search:", err);
    return res.status(500).json({ error: "internal_error", message: "Terjadi kesalahan internal." });
  }
});

export default router;
