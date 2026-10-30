import express, { type NextFunction, type Request, type Response } from "express";
import healthRouter from "./routes/health";
import routesRouter from "./routes/routes";
import crowdReportsRouter from "./routes/crowdReports";
import assistantRouter from "./routes/assistant";
import stopsRouter from "./routes/stops";
import nearbyStopsRouter from "./routes/nearbyStops";
import allStopsRouter from "./routes/allStops";
import authRouter from "./routes/auth";
import meRouter from "./routes/me";
import tripsRouter from "./routes/trips";

const app = express();

// HP mengakses lewat tunnel ngrok (proxy di loopback): tanpa ini req.ip
// selalu 127.0.0.1, jadi batas login per IP akan dibagi semua pengguna.
app.set("trust proxy", "loopback");

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  // "*" menurut spesifikasi CORS TIDAK mencakup Authorization — wajib
  // disebut eksplisit supaya app web bisa mengirim token sesi (Hari 1).
  res.header("Access-Control-Allow-Headers", "*, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

app.use(express.json());
app.use(healthRouter);
app.use(routesRouter);
app.use(crowdReportsRouter);
app.use(assistantRouter);
app.use(stopsRouter);
app.use(nearbyStopsRouter);
app.use(allStopsRouter);
app.use(authRouter);
app.use(meRouter);
app.use(tripsRouter);

// Penutup: galat yang lolos (mis. body JSON rusak dari express.json)
// dibalas JSON tanpa stack trace — default Express mengirim halaman HTML
// berisi stack trace di luar mode production.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const status = (err as { status?: number }).status;
  if (status === 400 || (err as { type?: string }).type === "entity.parse.failed") {
    return res.status(400).json({ error: "invalid_json", message: "Body permintaan bukan JSON yang valid." });
  }
  if (status === 413) {
    return res.status(413).json({ error: "payload_too_large", message: "Body permintaan terlalu besar." });
  }
  console.error("Unhandled error:", err);
  return res.status(500).json({ error: "internal_error", message: "Terjadi kesalahan internal." });
});

export default app;
