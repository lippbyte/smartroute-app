// Task Backend-04: HTTP surface for crowd-sourced density reports.
// Task Backend-07 adds the GET /crowd-reports list below.
import { Router } from "express";
import { CrowdReportRequestSchema } from "../lib/validation";
import {
  recordCrowdReport,
  getAggregatedCrowdLevel,
  listActiveCrowdReports,
} from "../services/crowdDensity";
import { getOtpStopInfo, OtpGraphQLError, OtpUnavailableError } from "../lib/otpClient";

const router = Router();

router.post("/crowd-reports", (req, res) => {
  const parsedBody = CrowdReportRequestSchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json({
      error: "invalid_request",
      message:
        'Body harus berisi stop_id (string) dan level ("low" | "moderate" | "high").',
      details: parsedBody.error.flatten(),
    });
  }

  const report = recordCrowdReport(parsedBody.data.stop_id, parsedBody.data.level);

  return res.status(201).json({
    stop_id: report.stop_id,
    level: report.level,
    reported_at: report.reported_at.toISOString(),
  });
});

// Task Backend-07: map-overview list — every stop with an active (in-window)
// aggregate, for a Google-Maps-traffic-layer-style display. A distinct exact
// path from "/crowd-reports/:stop_id" below (no trailing segment), so Express
// can't confuse the two: a request to "/crowd-reports" simply doesn't match a
// route that requires a ":stop_id" segment, regardless of registration order.
//
// Stops with no active report are omitted entirely (never filled with a
// neutral/default level) — same no-fake-data principle as everywhere else in
// this service. Likewise, a report on file for a stop_id that isn't an
// actual OTP2 stop (nothing validates that on POST /crowd-reports) is
// dropped here rather than shown with a fabricated name/coordinate.
//
// Task Backend-08: stop identity (name/lat/lng) now comes from OTP2 itself
// (getOtpStopInfo) instead of gtfsFeed.ts's own stops.txt parse — that used
// to return a DIFFERENT id scheme than the gtfsId routing.ts matches crowd
// reports against internally, so a report submitted with the id this list
// showed never actually affected route recommendations. Single source of
// truth now, not a mapping table between two schemes (see task's explicit
// batasan).
router.get("/crowd-reports", async (_req, res) => {
  try {
    const reports = listActiveCrowdReports();
    const stops = await Promise.all(
      reports.map(async (report) => {
        const stopInfo = await getOtpStopInfo(report.stop_id);
        if (!stopInfo) return null;
        return {
          stop_id: report.stop_id,
          name: stopInfo.name,
          lat: stopInfo.lat,
          lng: stopInfo.lng,
          level: report.level,
          reported_at: report.reported_at.toISOString(),
        };
      }),
    );

    return res.status(200).json(stops.filter((stop) => stop !== null));
  } catch (err) {
    // Same error shapes/status codes as POST /routes (otpClient.ts) — this
    // endpoint now depends on OTP2 being reachable too, same as routing.
    if (err instanceof OtpUnavailableError) {
      return res.status(502).json({ error: "otp2_unavailable", message: err.message });
    }
    if (err instanceof OtpGraphQLError) {
      console.error("OTP2 GraphQL errors:", err.errors);
      return res.status(502).json({ error: "otp2_graphql_error", message: err.message });
    }
    console.error("Unexpected error in GET /crowd-reports:", err);
    return res.status(500).json({ error: "internal_error", message: "Terjadi kesalahan internal." });
  }
});

// Helper/debug endpoint — not consumed by POST /routes (which aggregates
// internally per candidate), just for manually verifying the aggregation
// logic against a single stop.
router.get("/crowd-reports/:stop_id", (req, res) => {
  const level = getAggregatedCrowdLevel(req.params.stop_id) ?? null;
  return res.status(200).json({ stop_id: req.params.stop_id, level });
});

export default router;
