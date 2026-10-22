// src/routes/allStops.ts
//
// Perluasan dari Task App-15 (diminta user langsung): GET /all-stops —
// SEMUA halte/stasiun 4 moda se-Jakarta, tanpa filter jarak dari satu titik
// (beda dari GET /nearby-stops, routes/nearbyStops.ts). Dipakai layar peta
// "semua halte" di frontend — bisa mengembalikan ribuan baris (JakLingko
// saja ~7200 titik), jadi frontend WAJIB pakai clustering di peta, bukan
// marker satu-satu.
import { Router } from "express";
import { ALL_MODES, findAllStops } from "../services/allStops";
import { TransitMode } from "../services/nearbyStops";
import { OtpGraphQLError, OtpUnavailableError } from "../lib/otpClient";

const router = Router();

function parseModes(raw: unknown): TransitMode[] | undefined | "invalid" {
  if (typeof raw !== "string" || raw.trim() === "") return undefined;
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (parts.length === 0) return "invalid";
  for (const p of parts) {
    if (!ALL_MODES.includes(p as TransitMode)) return "invalid";
  }
  return parts as TransitMode[];
}

router.get("/all-stops", async (req, res) => {
  const modes = parseModes(req.query.modes);
  if (modes === "invalid") {
    return res.status(400).json({
      error: "invalid_request",
      message: `Query param 'modes' (opsional, dipisah koma) harus salah satu/gabungan dari: ${ALL_MODES.join(", ")}.`,
    });
  }

  try {
    const stops = await findAllStops(modes);
    return res.status(200).json(stops);
  } catch (err) {
    // Sama seperti /nearby-stops: kalau transjakarta/jaklingko diminta (jadi
    // OTP2 disentuh) dan OTP2 lagi mati, seluruh request gagal — mrt/lrt
    // statis tidak dicoba dipisah-tampilkan karena frontend selalu minta
    // gabungan dalam satu request, bukan per-moda.
    if (err instanceof OtpUnavailableError) {
      return res.status(502).json({ error: "otp2_unavailable", message: err.message });
    }
    if (err instanceof OtpGraphQLError) {
      console.error("OTP2 GraphQL errors:", err.errors);
      return res.status(502).json({ error: "otp2_graphql_error", message: err.message });
    }
    console.error("Unexpected error in GET /all-stops:", err);
    return res.status(500).json({ error: "internal_error", message: "Terjadi kesalahan internal." });
  }
});

export default router;
