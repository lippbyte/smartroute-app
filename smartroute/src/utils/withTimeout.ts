// src/utils/withTimeout.ts
//
// Task H13.1: batas waktu untuk setiap fetch yang keluar dari app. Tanpa ini
// sebuah backend yang menggantung (bukan menolak) bikin spinner berputar
// selamanya — fetch() sendiri tidak punya timeout bawaan di RN maupun web.

export class RequestTimeoutError extends Error {
  constructor(
    message: string,
    public readonly timeoutMs: number,
  ) {
    super(message);
    this.name = "RequestTimeoutError";
  }
}

interface FetchWithTimeoutOptions extends Omit<RequestInit, "signal"> {
  timeoutMs: number;
  /** Pesan yang dilihat user kalau waktu habis — wajib, supaya tiap pemanggil
   *  menjelaskan operasinya sendiri ("Pencarian rute...", bukan "Request..."). */
  timeoutMessage: string;
  /** Signal milik pemanggil, mis. untuk membatalkan request lama saat user
   *  lanjut mengetik. Digabung dengan timer di bawah, tidak saling menimpa. */
  signal?: AbortSignal;
}

export async function fetchWithTimeout(
  url: string,
  { timeoutMs, timeoutMessage, signal: externalSignal, ...init }: FetchWithTimeoutOptions,
): Promise<Response> {
  const controller = new AbortController();
  // Dicatat sebagai flag, bukan disimpulkan dari bentuk error: di Hermes,
  // fetch yang di-abort tidak selalu melempar error bernama "AbortError"
  // (beda dari spec Fetch web) — pelajaran dari Task App-12, lihat catatan
  // di crowdService.searchStops.
  let timedOut = false;

  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const forwardAbort = () => controller.abort();
  if (externalSignal?.aborted) controller.abort();
  externalSignal?.addEventListener("abort", forwardAbort);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    // Pembatalan oleh pemanggil diteruskan apa adanya — pemanggil yang tahu
    // itu bukan kegagalan, cuma request usang.
    if (timedOut) throw new RequestTimeoutError(timeoutMessage, timeoutMs);
    throw err;
  } finally {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener("abort", forwardAbort);
  }
}
