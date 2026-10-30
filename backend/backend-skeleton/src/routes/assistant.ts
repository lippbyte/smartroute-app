// Task Backend-06 (Bagian A): HTTP surface for the LLM wayfinding assistant.
// Hari 1 Task 4: wajib masuk (melindungi kredit OpenRouter) + batas per
// pengguna per jam & batas global harian (services/totoUsage.ts). Tamu
// ditolak di sini SEBELUM ada panggilan LLM; app menampilkan ajakan masuk.
import { Router } from "express";
import { authedUserId, requireAuth } from "../lib/auth";
import { tooManyRequests } from "../lib/respond";
import { AssistantAskRequestSchema, PRIORITIES } from "../lib/validation";
import { askAssistant, sanitizeNickname, type AssistantProfile } from "../services/assistant";
import { consumeTotoQuota } from "../services/totoUsage";
import { getUserById } from "../services/users";
import { OpenRouterConfigError, OpenRouterRequestError } from "../lib/openRouterClient";

const router = Router();

const minutesLabel = (sec: number) => `${Math.max(1, Math.ceil(sec / 60))} menit`;

router.post("/assistant/ask", requireAuth, async (req, res) => {
  const parsedBody = AssistantAskRequestSchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json({
      error: "invalid_request",
      message:
        "Body harus berisi question (string, tidak kosong). context opsional: " +
        "{ origin?: {lat,lng}, destination?: {lat,lng}, user_location?: {lat,lng} }. " +
        "history opsional: maks 10 item { role: 'user'|'assistant', content }.",
      details: parsedBody.error.flatten(),
    });
  }

  const user = getUserById(authedUserId(res));
  if (!user) return res.status(401).json({ error: "unauthorized", message: "Silakan masuk terlebih dahulu." });

  // Dicek & dicatat SEBELUM konteks dibangun dan LLM dipanggil.
  const quota = consumeTotoQuota(user.id, user.email);
  if (!quota.allowed) {
    return quota.reason === "daily_cap_reached"
      ? tooManyRequests(
          res,
          quota.retryAfterSec,
          "TOTO sudah menjawab banyak sekali pertanyaan hari ini dan sedang beristirahat. " +
            "Coba lagi besok ya. Pencarian rute tetap bisa dipakai seperti biasa.",
          "daily_cap_reached",
        )
      : tooManyRequests(
          res,
          quota.retryAfterSec,
          `Anda sudah bertanya ${quota.limit} kali dalam satu jam terakhir. ` +
            `Coba lagi dalam ${minutesLabel(quota.retryAfterSec)}.`,
          "hourly_limit_reached",
        );
  }

  // HANYA nama panggilan (dibersihkan) + prioritas. Bukan email, profil
  // aksesibilitas, riwayat perjalanan, atau ID.
  const priority = user.preferences.priority;
  const profile: AssistantProfile = {
    nickname: sanitizeNickname(user.name),
    priority: priority && (PRIORITIES as readonly string[]).includes(priority) ? priority : null,
  };

  try {
    const result = await askAssistant(
      parsedBody.data.question,
      parsedBody.data.context,
      parsedBody.data.history,
      profile
    );
    return res.status(200).json(result);
  } catch (err) {
    // Per the task brief: on any OpenRouter failure (missing config,
    // timeout, connection error, bad/empty response) — a clear 502 telling
    // the user the assistant is down, NEVER a fabricated fallback answer
    // and never a generic unlabeled 500.
    if (err instanceof OpenRouterConfigError || err instanceof OpenRouterRequestError) {
      console.error("Asisten LLM gagal:", err.message, err instanceof OpenRouterRequestError ? err.cause : undefined);
      return res.status(502).json({
        error: "assistant_unavailable",
        message: "Layanan asisten sedang tidak tersedia. Coba lagi sebentar lagi.",
      });
    }
    console.error("Unexpected error in POST /assistant/ask:", err);
    return res.status(500).json({ error: "internal_error", message: "Terjadi kesalahan internal." });
  }
});

export default router;
