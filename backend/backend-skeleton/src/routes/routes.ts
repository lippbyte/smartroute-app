import { Router } from "express";
import { RoutesRequestSchema, RouteRecommendationSchema } from "../lib/validation";
import { computeRouteRecommendation } from "../services/routing";
import { NoStopNearbyError } from "../lib/errors";
import { OtpGraphQLError, OtpUnavailableError } from "../lib/otpClient";
import { routingUnavailable } from "../lib/respond";

const router = Router();

router.post("/routes", async (req, res) => {
  const parsedBody = RoutesRequestSchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json({
      error: "invalid_request",
      message:
        "Body harus berisi origin dan destination, masing-masing { lat, lng } yang valid. " +
        "departure_time opsional, kalau diisi harus ISO 8601 dengan offset zona waktu (mis. 2026-09-10T20:17:00+07:00). " +
        'accessibility opsional, hanya ["kursi_roda"].',
      details: parsedBody.error.flatten(),
    });
  }

  try {
    const recommendation = await computeRouteRecommendation(
      parsedBody.data.origin,
      parsedBody.data.destination,
      parsedBody.data.departure_time,
      parsedBody.data.modes,
      parsedBody.data.accessibility
    );

    // Belt-and-suspenders: even though we built this object ourselves, it
    // was built from OTP2 data — validate against the official contract
    // before it leaves the process, per the AC ("kalau OTP2 mengembalikan
    // sesuatu yang tidak terduga, endpoint harus menolak dengan error yang
    // jelas, bukan meneruskan data yang rusak ke frontend").
    const parsedResponse = RouteRecommendationSchema.safeParse(recommendation);
    if (!parsedResponse.success) {
      console.error(
        "RouteRecommendation gagal validasi skema sebelum dikirim:",
        parsedResponse.error.flatten()
      );
      return res.status(500).json({
        error: "internal_schema_mismatch",
        message:
          "Hasil olahan OTP2 tidak sesuai skema RouteRecommendation — ditolak, bukan diteruskan rusak.",
      });
    }

    return res.status(200).json(parsedResponse.data);
  } catch (err) {
    if (err instanceof NoStopNearbyError) {
      return res.status(422).json({ error: "no_nearby_stop", message: err.message });
    }
    if (err instanceof OtpUnavailableError) return routingUnavailable(res, err, "POST /routes", "otp2_unavailable");
    if (err instanceof OtpGraphQLError) return routingUnavailable(res, err, "POST /routes", "otp2_graphql_error");
    console.error("Unexpected error in POST /routes:", err);
    return res.status(500).json({ error: "internal_error", message: "Terjadi kesalahan internal." });
  }
});

export default router;
