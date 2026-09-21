# SmartRoute AI — Final Sprint Tasks (H13–14)
## Before Live Demo Sept 19

**Timeline:** 2 days  
**Critical path:** Timeout → Skenario Decision → Top-up → E2E verify  
**Team:** Lippable (timeout implementation), Account Owner (decision + billing), Bayu (E2E test)

---

## TASK H13.1: Add Timeout to All Frontend Services
**Owner:** Lippable (frontend engineer)  
**Duration:** 30 min — 1 hour  
**Priority:** **P0 BLOCKER** (infinite spinner if backend hangs)  
**Status:** Code pattern exists (crowdService), need to propagate to 4 services

### Current State
- ✅ `crowdService.ts` — has AbortController + 10s timeout
- ❌ `routeService.ts` — no timeout
- ❌ `assistantService.ts` — no timeout
- ❌ `nearbyStopsService.ts` — no timeout
- ❌ `mapService.ts` — no timeout

### What to Do

**Step 1: Create reusable timeout wrapper** (`src/utils/withTimeout.ts`)

```typescript
/**
 * Wraps fetch call with AbortController timeout
 * @param promise - fetch call or Promise
 * @param timeoutMs - timeout in milliseconds (default 10000 = 10s)
 * @param errorMessage - custom error message
 * @returns promise that rejects if timeout exceeded
 */
export const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number = 10000,
  errorMessage: string = 'Permintaan timeout'
): Promise<T> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const result = await promise;
    clearTimeout(timeoutId);
    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(errorMessage);
    }
    throw error;
  }
};

/**
 * Alternative: fetch with AbortController signal
 */
export const fetchWithTimeout = async (
  url: string,
  options: RequestInit & { timeout?: number } = {}
): Promise<Response> => {
  const { timeout = 10000, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};
```

**Step 2: Update each service**

**routeService.ts:**
```typescript
import { fetchWithTimeout } from '@/utils/withTimeout';

export const searchRoutes = async (query: RouteQuery): Promise<RouteResult> => {
  try {
    const response = await fetchWithTimeout('/api/routes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(query),
      timeout: 15000  // 15s for routing (slower than chat)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.json();
  } catch (error) {
    if (error instanceof Error && error.message.includes('timeout')) {
      throw new Error('Pencarian rute timeout — coba lagi atau periksa koneksi');
    }
    throw error;
  }
};
```

**assistantService.ts:**
```typescript
export const askAssistant = async (message: string): Promise<AssistantResponse> => {
  try {
    const response = await fetchWithTimeout('/api/assistant/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_message: message }),
      timeout: 20000  // 20s (LLM can be slow)
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  } catch (error) {
    if (error instanceof Error && error.message.includes('timeout')) {
      throw new Error('Asisten sibuk — coba pertanyaan yang lebih sederhana');
    }
    throw error;
  }
};
```

**nearbyStopsService.ts:**
```typescript
export const getNearbyStops = async (lat: number, lon: number): Promise<Stop[]> => {
  try {
    const response = await fetchWithTimeout('/api/nearby-stops', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat, lon }),
      timeout: 8000  // 8s (fast query)
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  } catch (error) {
    if (error instanceof Error && error.message.includes('timeout')) {
      throw new Error('Pencarian halte timeout');
    }
    throw error;
  }
};
```

**mapService.ts:**
```typescript
// If mapService does external API calls (Google Maps, etc.)
export const geocodeAddress = async (address: string) => {
  try {
    const response = await fetchWithTimeout('https://nominatim.openstreetmap.org/search', {
      method: 'GET',
      // ... other options
      timeout: 10000
    });
    // ...
  } catch (error) {
    if (error instanceof Error && error.message.includes('timeout')) {
      throw new Error('Geocoding timeout — coba lagi');
    }
    throw error;
  }
};
```

### Checklist

- [ ] `withTimeout.ts` created with both wrapper patterns
- [ ] `routeService.ts` updated with 15s timeout
- [ ] `assistantService.ts` updated with 20s timeout
- [ ] `nearbyStopsService.ts` updated with 8s timeout
- [ ] `mapService.ts` updated with appropriate timeout
- [ ] Error messages in Indonesian, user-friendly
- [ ] Test timeout manually: simulate slow backend (cURL with `sleep`) → should show error, not infinite spinner
- [ ] No console errors

### Test Scenario
```bash
# In one terminal, simulate slow backend
curl -X POST http://localhost:3001/api/routes \
  -H "Content-Type: application/json" \
  -d '...' \
  -o /dev/null \
  -w "%{http_code}\n"

# (add 5–10s delay in backend before responding)

# In app: should show timeout error after 15s, not hang forever
```

---

## TASK H13.2: Decide Skenario 2 Fate
**Owner:** Account Owner (decision maker)  
**Duration:** 5 min  
**Priority:** **P1 (nice-to-have)**  
**Context:** Kalideres→PGC is slow (18.4s) + crowd report doesn't change order (both candidates same route)

### Three Options

**Option A: Swap to Diverging Route Pair**
- Find rute where candidates actually branch (different halte)
- Example: **Pasar Baru → Lebak Bulus**
  - Candidate 1: via Koridor X
  - Candidate 2: via Koridor Y
  - Crowd report at halte X → Candidate 1 score down, order changes
- **Pro:** Demo promise fulfilled (order changes)
- **Con:** Need verify latency <15s + find 2 good candidates
- **Timeline:** 1–2 hours to find + test

**Option B: Keep Kalideres→PGC, Revise Narration**
- Keep scenario as-is
- Narration: "Skor turun 0.415 → 0.24, label 'Padat' muncul" (drop "urutan berubah")
- **Pro:** Zero dev work, already tested
- **Con:** Weaker demo (score change alone less impressive)

**Option C: Drop Skenario 2 Entirely**
- Demo only 2 skenario:
  - S1: Blok M → Kota (fast, shows basic routing)
  - S3: Grogol → Kp. Melayu (fast, shows crowd impact + transfers)
- Skip Kalideres (too slow, order doesn't change anyway)
- **Pro:** Tighter demo, faster (<5 min), less risk of issues
- **Con:** Lose one showcase of large route (4–5 transfers)

### Decision Matrix

| Criteria | Option A | Option B | Option C |
|----------|----------|----------|----------|
| Demo promise (order changes) | ✓ | ✗ | — |
| Dev effort | High (1–2h) | None | None |
| Live demo risk | Medium | Low | Low |
| Overall impression | Strong | Medium | Good |
| **Recommendation** | **If time** | **Default** | **If risk-averse** |

### DECISION

**Choose one (or Account Owner decides):**
- [ ] **Option A:** Go find diverging route (1–2 hours) — Lippable searches, tests latency
- [ ] **Option B:** Keep Kalideres, update narration (Bayu rewrites script)
- [ ] **Option C:** Drop Skenario 2, finalize 2-scenario demo (clean + fast)

**Once decided, update task notes + proceed.**

---

## TASK H13.3: Top-Up OpenRouter Credit
**Owner:** Account Owner (billing access)  
**Duration:** 5 min  
**Priority:** **P0 (financial risk)**  
**Status:** $1 budget allocated, $0.176 spent, $0.824 remaining

### Issue
- Live demo: 5–10 asisten queries = ~$0.05–0.10
- If extended Q&A or retry: risk credit run out mid-presentation
- Current monitoring: call count only (warn >20/hr), **no hard cap** — can overspend

### Action
1. Log into OpenRouter account (openrouter.ai)
2. Go to Billing → Add Credit
3. **Add $5–10 USD** (safety margin)
4. Verify new balance shows

### Verification
```bash
# Check API key still works after top-up
curl https://openrouter.ai/api/v1/auth/key \
  -H "Authorization: Bearer $OPENROUTER_API_KEY"
# Should return: {"data": {"name": "...", "limits": {...}}}
```

### Checklist
- [ ] Logged into OpenRouter account
- [ ] Credit added ($5–10)
- [ ] New balance visible (should be >$5)
- [ ] API key still works (curl test passes)
- [ ] Billing history shows top-up transaction

---

## TASK H13.4: Final E2E Test (Post-Timeout Implementation)
**Owner:** Bayu (QA) with Lippable (backend support)  
**Duration:** 30 min  
**Priority:** **P0 (go/no-go for demo)**  
**Dependencies:** Task H13.1 done (timeout implemented)

### Scenarios (3 routes)

**Skenario 1: Blok M → Kota**
- Search
- Wait for results
- Check: ETA range visible, transfer count, 1 kandidat
- Latency: should be <15s (was 19.1s, timeout now 15s)
- **Expected:** 1 result or timeout error
- **Pass:** Result within timeout OR graceful error

**Skenario 2: [TBD based on H13.2 decision]**
- If Option A: Test new route (Pasar Baru → Lebak Bulus)
- If Option B: Test Kalideres→PGC (expect slow but no spinner hang)
- If Option C: Skip

**Skenario 3: Grogol → Kp. Melayu**
- Search
- Check: 2 kandidat, transfer risk at key point
- Latency: ~2.1s (fast)
- Crowd report: submit "high" at one halte
- Check: score updates, crowd_level appears
- Latency: <3s
- **Pass:** All above, no spinner hang

### Test Conditions
- **Network:** Normal (not throttled)
- **Backend:** Running locally or accessible via IP
- **Frontend:** Cleared cache, fresh session
- **Monitor:** Browser DevTools Network tab (catch timeouts)

### Checklist
- [ ] S1: Search completes or timeout within 15s (not infinite spinner)
- [ ] S1: Error message clear if timeout
- [ ] S2: Passes (route-dependent)
- [ ] S3: All updates within <3s
- [ ] No console errors or warnings
- [ ] No network 500+ errors
- [ ] Spinner never runs >20s
- [ ] Test log saved (screenshots + timings)

### Test Report Template
```
Date: Sept 17, 20XX
Tester: Bayu

Skenario 1: Blok M → Kota
  Status: ✓ PASS / ✗ FAIL
  Latency: 12.3s (target: <15s)
  Result: 1 kandidat (91–105 min)
  Issues: None

Skenario 3: Grogol → Kp. Melayu
  Status: ✓ PASS / ✗ FAIL
  Latency: 2.1s
  Crowd report response: <1s
  Issues: None

Overall: ✓ DEMO READY
```

---

## CRITICAL PATH & Timeline

```
H13 (Today)
├─ Task H13.1: Timeout (30 min)
│  └─ Parallel: Test timeout behavior (10 min)
├─ Task H13.2: Skenario decision (5 min)
│  └─ If Option A: Find + test route (1–2 hours) — parallel with H13.1
│  └─ If Option B/C: No extra work
├─ Task H13.3: OpenRouter top-up (5 min)
└─ Task H13.4: Final E2E test (30 min)
   └─ Should pass all 3 skenario within timeout

TOTAL TIME: 1–3 hours (depends on H13.2 choice)

H14 (Hari-H)
├─ Morning: Dry-run demo (5–7 min)
│  └─ Record video fallback
└─ Afternoon: Go live
```

---

## GO/NO-GO DECISION BEFORE H14

**Demo is GO if:**
- ✅ All 3 skenario complete within timeout (no infinite spinner)
- ✅ OpenRouter credit confirmed >$1
- ✅ Narration matches actual behavior (no false promises)
- ✅ Video fallback recorded

**Demo is NO-GO if:**
- ❌ Timeout still not implemented (spinner can hang forever)
- ❌ OpenRouter credit depleted
- ❌ Skenario decision not made (confusion mid-demo)

---

## NEXT STEPS (for Account Owner)

1. **Read this entire doc** — understand 3 decisions needed
2. **Task H13.1:** Tell Lippable to start timeout NOW (30 min window)
3. **Task H13.2:** **Decide: A, B, or C** (answer immediately)
4. **Task H13.3:** Do billing top-up (while Lippable codes)
5. **Task H13.4:** Bayu runs final E2E test (post-timeout)
6. **Report:** Share go/no-go status by H14 morning

---

**Ready? Which task first?**
