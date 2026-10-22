// Task Backend-06 (Bagian A): HTTP surface for the LLM wayfinding assistant.
import { Router } from "express";
import { AssistantAskRequestSchema } from "../lib/validation";
import { askAssistant } from "../services/assistant";
import { OpenRouterConfigError, OpenRouterRequestError } from "../lib/openRouterClient";

const router = Router();

router.post("/assistant/ask", async (req, res) => {
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

  try {
    const result = await askAssistant(
      parsedBody.data.question,
      parsedBody.data.context,
      parsedBody.data.history
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
