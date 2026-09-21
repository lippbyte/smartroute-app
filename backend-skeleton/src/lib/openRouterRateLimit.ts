// Task Backend-06 (Bagian A): "rate-limit sanity" — per the task brief,
// this is visibility, not enforcement: log/alert if OpenRouter call volume
// looks abnormal, so nobody gets a surprise bill mid-demo. Deliberately does
// NOT block requests once the threshold is crossed — the brief asks to
// "catat" (record) and "set alert/log", not to reject calls; a hard cap
// would risk breaking the demo itself over a threshold that's just a sanity
// check, not a real budget enforcement mechanism.
const WINDOW_MS = 60 * 60 * 1000; // 1 jam — per task brief ("20 call dalam satu jam")
const ALERT_THRESHOLD = 20; // per task brief, exact number given

let callTimestamps: number[] = [];

// Call once per actual OpenRouter request attempt (see assistant.ts) —
// counts attempts, not just successes, since failed calls still cost
// nothing but hung/retried ones could still surprise-bill via provider-side
// partial charges; recording every attempt is the conservative choice.
export function recordOpenRouterCall(now: number = Date.now()): number {
  callTimestamps.push(now);
  callTimestamps = callTimestamps.filter((t) => now - t <= WINDOW_MS);

  const countInWindow = callTimestamps.length;
  console.log(`[assistant] OpenRouter call #${countInWindow} in the trailing 1-hour window`);
  if (countInWindow > ALERT_THRESHOLD) {
    console.warn(
      `[assistant] ALERT: ${countInWindow} panggilan ke OpenRouter dalam 1 jam terakhir ` +
        `(ambang batas sanity: ${ALERT_THRESHOLD}) — cek apakah ini traffic demo/testing yang ` +
        `wajar atau ada bug yang memanggil OpenRouter berulang-ulang.`
    );
  }
  return countInWindow;
}
