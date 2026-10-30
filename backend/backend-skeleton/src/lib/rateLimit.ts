// Hari 1: pembatas laju sliding-window di memori — login per IP (Task 1)
// dan pertanyaan TOTO per pengguna (Task 4). Berbeda dari
// openRouterRateLimit.ts yang hanya mencatat log: yang ini MENOLAK, dengan
// pesan jelas dan Retry-After, bukan pemblokiran diam-diam.
//
// Di memori saja (hilang saat restart) — cukup untuk satu instance backend
// demo. TODO:verifikasi kalau nanti backend dijalankan lebih dari satu
// instance, penghitungnya harus pindah ke penyimpanan bersama.
export class SlidingWindowLimiter {
  private hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  /** Catat satu percobaan. `allowed: false` kalau percobaan ini melewati batas. */
  hit(key: string, now: number = Date.now()): { allowed: boolean; retryAfterSec: number } {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return { allowed: false, retryAfterSec: Math.ceil((recent[0] + this.windowMs - now) / 1000) };
    }
    recent.push(now);
    this.hits.set(key, recent);
    return { allowed: true, retryAfterSec: 0 };
  }
}
