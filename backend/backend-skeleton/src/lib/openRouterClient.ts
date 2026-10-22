// Task Backend-06 (Bagian A): thin client for OpenRouter's chat completion
// API (OpenAI-compatible) — the ONLY place in this codebase that calls an
// LLM. Endpoint/request/response shape confirmed against OpenRouter's own
// docs before writing this (POST /api/v1/chat/completions, Bearer auth,
// `choices[0].message.content`, errors as `{ error: { code, message } }`) —
// not assumed, per the task brief's explicit instruction to check first.
//
// Model note: the task brief named `anthropic/claude-3-5-haiku`, but that
// model is no longer listed on OpenRouter (checked directly against
// GET https://openrouter.ai/api/v1/models before writing this — same
// "verify, don't assume" instruction). The current cheap/fast Haiku-tier
// model on OpenRouter is `anthropic/claude-haiku-4.5`, so that's the
// default here in the task's spirit ("murah & cepat"); still overridable
// via OPENROUTER_MODEL if a cheaper/faster tier becomes preferable later.
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "anthropic/claude-haiku-4.5";

// A hung request would otherwise block POST /assistant/ask indefinitely —
// 15s is generous for a short Q&A completion on a "fast" model tier, short
// enough that a demo audience isn't left staring at a spinner.
const REQUEST_TIMEOUT_MS = 15_000;

// Answers are meant to be short, direct wayfinding info, not an essay — caps
// completion length (and cost) accordingly. Untuk model reasoning, batas ini
// ikut mencakup token reasoning.
const MAX_ANSWER_TOKENS = 600;

// Hanya untuk model reasoning non-Anthropic (mis. z-ai/glm-5.3-flash, yang
// tanpa batas ini menghabiskan seluruh MAX_ANSWER_TOKENS untuk berpikir dan
// jawabannya kosong, serta menolak reasoning dimatikan). TIDAK dikirim ke
// Claude: di sana parameter ini menyalakan extended thinking (budget minimum
// 1024 & wajib temperature 1) — lebih lambat dan tidak dibutuhkan untuk Q&A
// singkat.
const MAX_REASONING_TOKENS = 150;

// Low temperature: this assistant must stay grounded in the GTFS context we
// hand it (see assistant.ts's system prompt), not invent plausible-sounding
// but wrong route/fare/schedule details — a low temperature biases toward
// the literal provided facts over creative phrasing.
const TEMPERATURE = 0.2;

export class OpenRouterConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpenRouterConfigError";
  }
}

export class OpenRouterRequestError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "OpenRouterRequestError";
  }
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenRouterErrorBody {
  error?: { code?: number | string; message?: string };
}

interface OpenRouterSuccessBody {
  choices?: Array<{ message?: { content?: string } }>;
}

export async function askOpenRouter(messages: ChatMessage[]): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new OpenRouterConfigError(
      "OPENROUTER_API_KEY belum di-set — lihat README untuk cara setup env var-nya."
    );
  }

  const model = process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL;

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: MAX_ANSWER_TOKENS,
        ...(model.startsWith("anthropic/")
          ? {}
          : { reasoning: { max_tokens: MAX_REASONING_TOKENS } }),
        temperature: TEMPERATURE,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === "AbortError";
    throw new OpenRouterRequestError(
      isTimeout
        ? `OpenRouter tidak merespons dalam ${REQUEST_TIMEOUT_MS}ms (timeout)`
        : `Tidak bisa menghubungi OpenRouter di ${OPENROUTER_URL}`,
      err
    );
  } finally {
    clearTimeout(timeoutHandle);
  }

  let body: OpenRouterSuccessBody & OpenRouterErrorBody;
  try {
    body = (await response.json()) as OpenRouterSuccessBody & OpenRouterErrorBody;
  } catch (err) {
    throw new OpenRouterRequestError("Respons OpenRouter bukan JSON yang valid", err);
  }

  if (!response.ok || body.error) {
    const detail = body.error?.message ?? `HTTP ${response.status} ${response.statusText}`;
    throw new OpenRouterRequestError(`OpenRouter mengembalikan error: ${detail}`);
  }

  const content = body.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim().length === 0) {
    throw new OpenRouterRequestError(
      "Respons OpenRouter tidak berisi jawaban yang valid (choices[0].message.content kosong)"
    );
  }

  return content.trim();
}
