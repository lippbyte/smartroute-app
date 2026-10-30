// Hari 2 Task 2: GET /air-quality — publik (tanpa login). Tidak pernah 500:
// kegagalan provider -> nilai terakhir (stale: true) atau available: false.
import { Router } from "express";
import { getAirQuality } from "../services/airQuality";

const router = Router();

router.get("/air-quality", async (_req, res) => {
  try {
    return res.status(200).json(await getAirQuality());
  } catch (err) {
    console.error("Unexpected error in GET /air-quality:", err instanceof Error ? err.message : err);
    return res.status(200).json({ available: false, source: "IQAir", reason: "unavailable" });
  }
});

export default router;
