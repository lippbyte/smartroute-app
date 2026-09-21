// Loads backend-skeleton/.env (OPENROUTER_API_KEY etc.) into process.env —
// must run before anything reads those vars. See README for setup.
import "dotenv/config";
import app from "./app";
import { preloadGtfsFeed } from "./lib/gtfsFeed";

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

// Task Backend-05/06: parse the static GTFS feed once at startup (headway
// lookup + the assistant's route list both need it) rather than lazily on
// whichever request happens to need it first.
preloadGtfsFeed();

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
