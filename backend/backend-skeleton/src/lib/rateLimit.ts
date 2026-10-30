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

  private recent(key: string, now: number): number[] {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length) this.hits.set(key, recent);
    else this.hits.delete(key);
    return recent;
  }

  /** Catat satu percobaan. `allowed: false` kalau percobaan ini melewati batas. */
  hit(key: string, now: number = Date.now()): { allowed: boolean; retryAfterSec: number } {
    const blocked = this.check(key, now);
    if (!blocked.allowed) return blocked;
    this.record(key, now);
    return blocked;
  }

  /** Cek tanpa mencatat — untuk pola "hanya kegagalan yang dihitung"
   *  (login): check() dulu, record() hanya bila percobaan gagal. */
  check(key: string, now: number = Date.now()): { allowed: boolean; retryAfterSec: number } {
    const recent = this.recent(key, now);
    if (recent.length >= this.limit) {
      return { allowed: false, retryAfterSec: Math.ceil((recent[0] + this.windowMs - now) / 1000) };
    }
    return { allowed: true, retryAfterSec: 0 };
  }

  record(key: string, now: number = Date.now()): void {
    const recent = this.recent(key, now);
    recent.push(now);
    this.hits.set(key, recent);
  }

  reset(key: string): void {
    this.hits.delete(key);
  }
}
