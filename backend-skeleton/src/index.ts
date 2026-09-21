// Loads backend-skeleton/.env (OPENROUTER_API_KEY etc.) into process.env —
// must run before anything reads those vars. See README for setup.
import "dotenv/config";
import app from "./app";
import { preloadGtfsFeed } from "./lib/gtfsFeed";
import { preloadStopClusters } from "./services/stopClusters";

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

// Task Backend-05/06: parse the static GTFS feed once at startup (headway
// lookup + the assistant's route list both need it) rather than lazily on
// whichever request happens to need it first.
preloadGtfsFeed();

// Klaster peron untuk agregasi laporan kepadatan per halte. Tidak menahan
// startup: kalau OTP2 belum siap, dicoba ulang di latar belakang, dan selama
// itu laporan dihitung per peron seperti sebelumnya.
preloadStopClusters();

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
