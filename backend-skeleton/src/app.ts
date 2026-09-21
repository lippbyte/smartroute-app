import express from "express";
import healthRouter from "./routes/health";
import routesRouter from "./routes/routes";
import crowdReportsRouter from "./routes/crowdReports";
import assistantRouter from "./routes/assistant";
import stopsRouter from "./routes/stops";
import nearbyStopsRouter from "./routes/nearbyStops";
import allStopsRouter from "./routes/allStops";

const app = express();

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "*");
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

export default app;
