# SmartRoute AI — Task Cards (H10–14)
## Integration Sprint → Final Rehearsal

**Project:** SmartRoute AI (Dishub AI Competition)  
**Deadline:** Sept 19, 2026 (H14)  
**Current State:** App-23 splash ✓ | TransJakarta OTP2 ✓ | KRL data ready (Excel) | Chat asisten awaiting integration  
**Team:** Bayu (AI/data), Lippable (backend/frontend), Amelia & Rakkan (UX), Khalifa (monitoring)

---

## TRACK 1: KRL Data Integration (H10–12)
**Owner:** Bayu (lead) + Lippable (backend support)  
**Impact:** Adds second mode (KRL + TransJakarta multi-modal), raises demo differentiation  
**Blocker:** OTP2 recompile time + graph validation

### Task 1.1: Excel → GTFS Conversion (Stops & Routes)
**Assignee:** Bayu  
**Duration:** 4–6 hours  
**Dependencies:** Data_KRL_JABODETABEK.xlsx (done)

**Description:**
Convert KRL Jabodetabek Excel sheets to standard GTFS format:
- **Stasiun sheet** → `stops.txt` (85 stations)
  - Columns: `stop_id` (code), `stop_code`, `stop_name`, `stop_lat`, `stop_lon`, `stop_url`
  - Missing lat/lon: queue for batch geocoding (Nominatim or public KRL API)
  - Format name: "Title Case", consistent with TransJakarta stops

- **Daftar Kereta sheet** → `routes.txt` (KRL lines)
  - Extract unique `route_id` (lintas code), `route_short_name`, `route_long_name`, `route_color` (from data)
  - Expected ~7–9 lines (Jabodetabek network only)

**Checklist:**
- [ ] Stops.txt generated, 85 rows (excluding header), all required columns filled
- [ ] Routes.txt generated, all Jabodetabek lines listed with color codes
- [ ] Lat/lon missing for N stations — flagged for geocoding (list them)
- [ ] Naming consistency verified (Title Case, no extra spaces)
- [ ] Files saved to `otp/graphs/jakarta/krl/` folder locally

**Output:** `stops.txt`, `routes.txt`, geocoding queue list

---

### Task 1.2: Trips & Stop Times (Schedule Data)
**Assignee:** Bayu  
**Duration:** 6–8 hours  
**Dependencies:** Task 1.1 done, Detail Perhentian + Daftar Kereta sheets

**Description:**
Convert kereta & jadwal to GTFS schedule:
- **Daftar Kereta sheet** → `trips.txt` (1.000 kereta)
  - Columns: `route_id`, `trip_id` (No. KA), `trip_headsign` (tujuan akhir), `shape_id` (optional for demo)
  - Note: ~4% rute ≠ perhentian start/end — keep as-is for transparency

- **Detail Perhentian sheet** → `stop_times.txt` (16.475 perhentian)
  - Columns: `trip_id`, `stop_sequence`, `stop_id`, `arrival_time`, `departure_time`
  - **CRITICAL:** Handle midnight case — rows with `(+1)` → convert to next-day format
    - Example: `23:55 (+1)` → `23:55:00` on previous day's trip (OTP2 handles overnight in graph)
  - Verify `stop_id` matches `stops.txt` stop_id
  - Sort by trip_id, then stop_sequence

**Checklist:**
- [ ] Trips.txt generated, 1.000 rows, all required columns
- [ ] Stop_times.txt generated, 16.475 rows, all required columns
- [ ] Midnight handling verified (pick 5 random overnight kereta, check times)
- [ ] Stop_id cross-reference OK (no missing/mismatched IDs)
- [ ] Files saved to `otp/graphs/jakarta/krl/`
- [ ] GTFS validator run (if available): no critical errors

**Output:** `trips.txt`, `stop_times.txt`

**QA Note:** Jadwal per Stasiun sheet (17.490 rows) is supplementary validation; don't use as source of truth — Detail Perhentian is canonical.

---

### Task 1.3: Geocoding Missing Lat/Lon (Batch)
**Assignee:** Bayu or Lippable  
**Duration:** 2–3 hours  
**Dependencies:** Task 1.1 (list of N stations missing lat/lon)

**Description:**
Fill missing lat/lon for KRL stasiun via batch geocoding:
- Use Nominatim (free, no key) or PT KCI public API (if available)
- Query: `"{station_name} KRL Jakarta"` → get lat/lon
- Fallback: Manual lookup from Google Maps / PT KCI website for critical stations (Bekasi, Tanah Abang, Kota, etc.)

**Checklist:**
- [ ] Batch geocode query built (Python script or curl loop)
- [ ] All missing lat/lon filled or manually assigned
- [ ] Lat/lon sanity check (rough bounding box: -6.4 to -6.0 lat, 106.6 to 107.1 lon for Jabodetabek)
- [ ] Updated `stops.txt` with complete lat/lon
- [ ] File saved to `otp/graphs/jakarta/krl/`

**Output:** Updated `stops.txt` with no missing lat/lon

---

### Task 1.4: OTP2 Graph Recompile & Validation
**Assignee:** Lippable (backend)  
**Duration:** 1–2 hours (mostly waiting for OTP2 build)  
**Dependencies:** Tasks 1.1–1.3 done, GTFS files in `otp/graphs/jakarta/krl/`

**Description:**
Rebuild OTP2 graph with both TransJakarta + KRL GTFS:
- Folder structure:
  ```
  otp/graphs/jakarta/
  ├── transjakarta/       (existing)
  │   ├── stops.txt
  │   ├── routes.txt
  │   ├── trips.txt
  │   └── stop_times.txt
  └── krl/                (new)
      ├── stops.txt
      ├── routes.txt
      ├── trips.txt
      └── stop_times.txt
  ```

- Recompile:
  ```bash
  docker-compose down
  # Verify both GTFS folders exist
  docker-compose up -d otp2
  # Wait ~2–3 min for graph build
  docker logs otp2 | grep -i "graph|error"
  ```

- Validation:
  - Check no graph build errors
  - Test OTP2 GraphQL endpoint alive: `curl http://localhost:8080/otp/routers/default/index/graphql`

**Checklist:**
- [ ] Both GTFS folders present and verified
- [ ] `docker-compose up` runs without error
- [ ] OTP2 build completes (check logs for "graph built" or equiv)
- [ ] GraphQL endpoint responsive
- [ ] No critical errors in logs

**Output:** OTP2 graph ready for routing queries

---

### Task 1.5: E2E Test — 3 Skenario Routing
**Assignee:** Lippable (backend) + QA  
**Duration:** 2–3 hours  
**Dependencies:** Task 1.4 done, frontend connected to backend

**Description:**
Test KRL routing end-to-end across three scenarios:

**Scenario 1: TransJakarta Only (Baseline)**
- Route: **Blok M → Kota**
- Expected: TransJakarta corridor, ~30–40 min, 1–2 transfers
- Verify: Route found, ETA range shown, transfer risk calculated

**Scenario 2: KRL Only (New)**
- Route: **Bekasi Stasiun → Jakarta Kota** (or Tanah Abang)
- Expected: Single KRL trip, ~40–50 min, no transfers
- Verify: KRL route appears in results, correct stops, ETA range

**Scenario 3: Multi-Modal (KRL + TransJakarta)**
- Route: **Bekasi Stasiun → Blok M**
  - Take KRL Bekasi → Tanah Abang
  - Transfer to TransJakarta feeder Tanah Abang → Blok M
- Expected: Multi-leg trip, combined fare estimate, transfer risk HIGH at Tanah Abang
- Verify: Both modes in route, transfer point flagged, ETA realistic

**Checklist:**
- [ ] Scenario 1: Route found, no errors
- [ ] Scenario 2: Route found, KRL mode identified
- [ ] Scenario 3: Multi-modal route found, transfer point shown
- [ ] All three scenarios return ETA range (not single number)
- [ ] Transfer risk indicator working
- [ ] Chat asisten can parse results correctly (for next task)
- [ ] No console errors

**QA Notes:**
- If any scenario fails, log OTP2 error + revert to TransJakarta-only mode gracefully
- If Grogol station causes issues (missing tarif/jadwal), mark as known limitation for demo disclaimer

**Output:** Test report (pass/fail + screenshots for each scenario)

---

## TRACK 2: Chat Asisten + LLM Integration (H11–12)
**Owner:** Bayu (LLM integration) + Lippable (API plumbing)  
**Impact:** Differentiator from JAKI/JakLingko, personalized wayfinding  
**Dependencies:** Track 1 done OR parallelizable (backend routing API stable)

### Task 2.1: LLM Setup & Context Injection
**Assignee:** Bayu  
**Duration:** 3–4 hours  
**Dependencies:** API key (Claude/OpenAI), rate limiting budget confirmed

**Description:**
Set up LLM API integration with GTFS context:

1. **API Setup**
   - Choose: Claude API (via Anthropic) or OpenAI GPT-4
   - Confirm: Budget allocated, rate limits OK for demo (~50–100 queries safely)
   - Store: API key in `.env` (never commit)

2. **Context Injection**
   - Build system prompt template:
     ```
     You are a helpful transit asisten for Jakarta public transportation.
     You have access to these modes: TransJakarta, KRL Jabodetabek.
     
     [INJECTED DATA]
     - Available stations: {stations_list}
     - Available routes: {routes_list}
     - Key tariffs: {fare_samples}
     - Current time: {now}
     
     Answer questions about routes, fares, schedules.
     If unsure, ask for clarification.
     ```

   - Data to inject dynamically:
     - Station list (from stops.txt) — 85 KRL + TransJakarta stops
     - Route list (from routes.txt) — line names + colors
     - Sample fares (from tarif sheet) — e.g., "Bekasi to Jakarta: Rp 15.000 by KRL"
     - Current time (for schedule relevance)

3. **Error Handling**
   - Timeout: 10 sec max per query → fallback "Please ask simpler question"
   - Rate limit hit: Queue query or show "Service busy, try again"
   - Malformed query: Route to dedicated error handler

**Checklist:**
- [ ] LLM API key validated and stored in `.env`
- [ ] System prompt template written & tested
- [ ] Context injection pipeline built (reads GTFS → injects to prompt)
- [ ] Timeout + rate limit handling in place
- [ ] Backend endpoint `/api/chat` ready to receive POST (user_message, context_mode)

**Output:** Backend endpoint `/api/chat` working, system prompt finalized

---

### Task 2.2: Chat UI Integration (Frontend)
**Assignee:** Lippable (frontend) or Amelia (if chat UI not yet built)  
**Duration:** 2–3 hours  
**Dependencies:** Task 2.1 done, chat UI skeleton exists OR build from scratch

**Description:**
Connect chat UI to backend LLM endpoint:

1. **Frontend Chat Component** (if not already done)
   - Input field: user question
   - Send button
   - Message history (user messages + asisten responses)
   - Loading indicator during API call
   - Error state (show if backend fails)

2. **API Integration**
   - On send: POST to `/api/chat` with `{ user_message, context_mode: "routing" | "general" }`
   - On response: Display asisten message in chat
   - Handle errors gracefully (show error banner, not crash)

3. **Context Modes**
   - **"routing"**: Inject full GTFS context (stations, routes, tariffs)
   - **"general"**: Minimal context (just mode names, no detailed data)
   - Toggle via settings or auto-detect from query keywords

4. **Accessibility**
   - Chat input: proper keyboard handling (Enter = send, Shift+Enter = newline)
   - Screen reader friendly (aria labels for buttons, message list)
   - Mobile-first: chat accessible on small screens

**Checklist:**
- [ ] Chat UI component built (or verified existing)
- [ ] API POST call working, receives asisten response
- [ ] Message history renders correctly
- [ ] Loading indicator appears during API call
- [ ] Error state handled gracefully
- [ ] Context injection visible in responses (e.g., asisten mentions stations by name)
- [ ] Mobile layout OK
- [ ] No console errors

**Output:** Chat UI connected to `/api/chat`, ready for QA testing

---

### Task 2.3: Test 5 Skenario Tanya-Jawab
**Assignee:** Bayu + QA  
**Duration:** 2–3 hours  
**Dependencies:** Tasks 2.1 & 2.2 done

**Description:**
Verify asisten answers correctly on 5 pre-rehearsal scenarios:

**Skenario 1: Basic Routing Question**
- **Input:** "Naik apa dari Blok M ke Kota?"
- **Expected:** "Naik TransJakarta Koridor 1, sekitar 30–40 menit, atau...Rp 3.500"
- **Criteria:** Mentions mode, ETA range, fare, alternatives

**Skenario 2: KRL Specific**
- **Input:** "Berapa lama naik KRL dari Bekasi ke Jakarta Kota?"
- **Expected:** "KRL dari Bekasi Stasiun ke Jakarta Kota sekitar 40–50 menit, tarif Rp 15.000"
- **Criteria:** Correct station names, realistic time, correct fare

**Skenario 3: Multi-Modal Advice**
- **Input:** "Saya di Bekasi, mau ke Blok M, gimana caranya?"
- **Expected:** "Naik KRL ke Tanah Abang, lalu TransJakarta ke Blok M. Total ~2 jam, Rp 18.500."
- **Criteria:** Suggests transfer point, combined fare, total time

**Skenario 4: Ambiguous Query**
- **Input:** "Berapa jauh dari sini?"
- **Expected:** Asisten asks for clarification ("Di mana Anda sekarang? Mau ke mana?")
- **Criteria:** Doesn't hallucinate, asks for details

**Skenario 5: Contextual Follow-up**
- **Input:** (after Skenario 1) "Lebih cepat apa yang tadi?"
- **Expected:** Asisten refers back to previous route, suggests faster alternatives
- **Criteria:** Maintains conversation context, makes sense

**Checklist:**
- [ ] Skenario 1: Correct answer, mentions all key details
- [ ] Skenario 2: Correct KRL info (stations, time, fare)
- [ ] Skenario 3: Multi-modal suggestion sensible
- [ ] Skenario 4: Handles ambiguity gracefully (doesn't guess)
- [ ] Skenario 5: Context maintained
- [ ] All 5 scenarios scored ≥80% correct per QA rubric
- [ ] Response times <10 sec average
- [ ] No API errors logged

**QA Rubric:**
- 100%: Answer complete, factually correct, contextually relevant
- 80%: Answer mostly correct, 1 minor detail wrong or unclear phrasing
- 60%: Partial answer, missing context or clear error
- <60%: Wrong answer or incomprehensible

**Output:** Test report (5 scenarios × results), failing scenarios fixed or escalated

---

## TRACK 3: Final Polish & Rehearsal (H12–14)
**Owner:** All (collective focus)  
**Impact:** Demo success on H14, no surprises on stage  
**Dependencies:** Tracks 1 & 2 mostly done

### Task 3.1: Full E2E Integration Test
**Assignee:** Lippable + QA  
**Duration:** 2–3 hours  
**Dependencies:** All features connected (routing, chat, crowd report, notifications)

**Description:**
End-to-end test: user starts app → searches route → reads chat → reports crowd → gets notification.

**Flow:**
1. Launch app → splash screen plays, home screen appears
2. User enters: origin "Blok M", destination "Kota" → autocomplete suggestions appear
3. User selects → route search fires
4. Results show: TransJakarta route + KRL alternative, ETA range, fare, transfer risk
5. User opens chat → asks "lebih murah mana kedua rute ini?" → asisten answers with fare comparison
6. User navigates to Blok M halte → crowd report modal appears
7. User reports "SEDANG PENUH" → modal closes, report stored
8. User clicks "START NAVIGATION" → departure time ISO formatted, ETA countdown starts
9. User approaches halte (simulated 75m) → arrival notification fires
10. No errors, no console logs, smooth transitions

**Checklist:**
- [ ] App launch → splash → home (no freeze)
- [ ] Autocomplete works (both origin & dest)
- [ ] Route search returns results (TransJakarta + KRL)
- [ ] Chat responds without error
- [ ] Crowd report submission works
- [ ] Navigation countdown starts
- [ ] Arrival notification triggers (or simulated correctly)
- [ ] All screens mobile-friendly
- [ ] No console errors or warnings

**Output:** E2E test report (pass/fail, screenshots, video if possible)

---

### Task 3.2: Dry-Run Demo (5–7 min)
**Assignee:** PM + demo team (Bayu or Lippable + Amelia/Rakkan for narration)  
**Duration:** 1–2 hours (including rehearsal + feedback loops)  
**Dependencies:** Task 3.1 pass, all features stable

**Description:**
Full dress rehearsal of live demo for Dishub judges:

**Demo Script (5–7 min):**
1. **Problem statement** (1 min): Show Jakarta transit adoption stats, waiting time sensitivity data
2. **SmartRoute AI intro** (1 min): Show app home screen, highlight 3 unique features
3. **Feature 1: Reliable ETA** (1.5 min):
   - Search Blok M → Kota
   - Show ETA range (not single number), transfer risk at key point
   - Mention: reduces waiting time uncertainty (Gaduh et al. 2023 research)
4. **Feature 2: Multi-Modal + KRL** (1.5 min):
   - Search Bekasi → Blok M
   - Show multi-modal route (KRL + TransJakarta)
   - Ask chat: "lebih hemat mana?" → asisten compares fares
5. **Feature 3: Crowdsourcing** (1 min):
   - Click crowd report → submit kepadatan
   - Show real-time update on results
6. **Closing** (0.5 min): "Reduces waiting time 15–25%, increases ridership 3–7%"

**Dry-Run Checklist:**
- [ ] Script rehearsed, timing confirmed (5–7 min exactly)
- [ ] All 3 features demo'd without error
- [ ] Chat asisten responds in <5 sec
- [ ] No app crashes or frozen screens
- [ ] Narration clear, confident (voice + slides if any)
- [ ] Transitions smooth between screens
- [ ] Camera/projector tested (if live demo)

**Output:** Rehearsal video (7 min max), feedback notes, timing log

---

### Task 3.3: Video Fallback Recording
**Assignee:** Lippable or Amelia (screen recorder)  
**Duration:** 1 hour  
**Dependencies:** Task 3.2 done (script + timing finalized)

**Description:**
Record 7-min demo video as fallback if live demo fails on stage:

1. **Recording Setup**
   - Screen recorder (OBS, ScreenFlow, or built-in)
   - Audio: Clear narration + app sounds
   - Resolution: 1080p min (for projector compatibility)
   - File: MP4 H.264, <500 MB

2. **Recording Steps**
   - Open app on real device (or simulator)
   - Follow Task 3.2 demo script exactly
   - Do 2–3 takes, pick best one (no stutters, clear audio)
   - Edit: Add intro title + closing slide if needed
   - Upload: Google Drive shared with team (with backup on local)

3. **Playback Checklist**
   - Audio synced with video
   - All features visible (not too fast)
   - Timestamps: intro 0:00, Feature 1 at 1:00, Feature 2 at 2:30, Feature 3 at 4:00, closing 5:30
   - File plays on standard projector (test beforehand)

**Checklist:**
- [ ] Video recorded, no major glitches
- [ ] Audio clear and intelligible
- [ ] Duration 5–7 min
- [ ] File format & size OK for playback
- [ ] Uploaded to backup location (Google Drive + local USB)
- [ ] Tested playback on projector-type setup (or laptop)

**Output:** Video file + playback verification

---

### Task 3.4: P0 Checklist Verification
**Assignee:** QA (Khalifa or designated)  
**Duration:** 1–2 hours  
**Dependencies:** All tasks above done

**Description:**
Final verification that all P0 requirements from PRD are met before presentation:

**P0 Checklist (from PRD):**
- [ ] **P0.1** GTFS + OTP2 routing: 3 rute nyata bekerja tanpa gagal
  - Blok M → Kota ✓
  - Kalideres → PGC ✓
  - Grogol → Kampung Melayu ✓

- [ ] **P0.2** Input asal-tujuan autocomplete: <2 detik response
  - Tested on 3G+ network? Acceptable latency?

- [ ] **P0.3** Hasil rute dengan ETA range + biaya + transfer count
  - All 3 routes show range, not single number? ✓
  - Biaya muncul? ✓
  - Transfer count clear? ✓

- [ ] **P0.4** Indikator risiko transfer di transfer point
  - Risk level (rendah/sedang/tinggi) visible? ✓
  - Heuristik berbasis headway working?

- [ ] **P0.5** Mode toggle (Komuter vs Wisatawan)
  - Toggle visible? ✓
  - UI/instruksi depth changes? ✓

- [ ] **P0.6** Chat asisten: 5/5 skenario correct
  - Scenario 1–5 all ≥80% from Task 2.3? ✓

- [ ] **P0.7** Lapor kepadatan: submit + visibility
  - Report button clickable? ✓
  - Report saved & visible immediately? ✓
  - Affects route scoring? (nice-to-have, not critical)

- [ ] **P0.8** UI aksesibel (WCAG AA min)
  - Contrast OK? ✓
  - Font readable? ✓
  - ≤3 tap/klik to complete core flow ("cari rute")? ✓

- [ ] **P0.9** Web app mobile-first, no install
  - Works from link on any browser? ✓
  - Tested on phone simulator + real device? ✓
  - Fast enough for live demo? ✓

**Issues Found** → Create hotfix tasks, prioritize by impact

**Checklist:**
- [ ] All 9 P0 items marked ✓ or escalated with mitigation
- [ ] Critical issues fixed (no P0 failures)
- [ ] Nice-to-have issues noted for post-demo
- [ ] Team signed off on readiness

**Output:** P0 verification report (ready/not ready + risk assessment)

---

### Task 3.5: Device Testing & Final Stabilization
**Assignee:** QA + Lippable  
**Duration:** 1–2 hours  
**Dependencies:** Task 3.4 pass

**Description:**
Test app on real devices (or comprehensive simulator testing) to catch mobile-specific bugs:

**Test Devices:**
- iPhone (iOS 15+) or iPad simulator
- Android (API 30+) simulator
- Mobile browser: Safari, Chrome
- Network conditions: 4G, LTE, WiFi

**Test Scenarios:**
1. **Slow network** (throttle to 3G): app still responsive, autocomplete queues gracefully
2. **Orientation change** (portrait ↔ landscape): layout reflows, chat history preserved
3. **Background/foreground** (simulate app backgrounding): notifications still work on return
4. **Low battery mode**: app functions, no visual glitches
5. **Offline then online**: graceful degradation (not crash)

**Checklist:**
- [ ] Tested on ≥2 iOS devices/simulators
- [ ] Tested on ≥2 Android devices/simulators
- [ ] Chrome & Safari mobile tested
- [ ] Slow network (3G): autocomplete responsive
- [ ] Orientation change: no layout breaks
- [ ] App backgrounding: no crashes
- [ ] Offline handling: graceful (error message, not crash)
- [ ] Performance: <3 sec initial load, <1 sec route search

**Issues Found** → Log severity, prioritize by stage impact (demo-breaking vs. nice-to-fix)

**Output:** Device test report (platform × scenario matrix), critical bugs fixed

---

### Task 3.6: Presentation Prep (Slides + Narrative)
**Assignee:** PM (Bayu or Amelia) + Khalifa  
**Duration:** 2–3 hours  
**Dependencies:** All above done (features locked, demo stable)

**Description:**
Prepare presentation materials for live stage (if required by competition):

**Slide Deck (if required):**
1. **Title slide**: SmartRoute AI, team name, problem
2. **Problem statement**: Stats on Jakarta transit adoption, waiting time sensitivity
3. **Solution overview**: 3 key features (reliable ETA, multi-modal, crowdsourcing)
4. **Feature 1: Reliable ETA** — show screenshot, mention research backing
5. **Feature 2: Multi-Modal** — show TransJakarta + KRL integration
6. **Feature 3: Crowdsourcing** — show crowd report mechanism
7. **Business model**: B2G/B2B, revenue streams
8. **Implementation**: Modular architecture, scalability
9. **Impact metrics**: 15–25% wait time reduction, 3–7% ridership increase
10. **Q&A & Contact**

**Narrative (per slide, ~30 sec each):**
- Clear, confident delivery
- Avoid jargon or explain quickly (judges may not be technical)
- Link each feature back to problem statement (waiting time = key lever)

**Backup Materials:**
- Printed one-pagers (if judges want to take home)
- Contact info + GitHub link (if judges ask for code)
- FAQ doc (anticipate "how will you handle X?" questions)

**Checklist:**
- [ ] Deck complete, ≤10 slides
- [ ] Narrative rehearsed (speak time ~5–7 min)
- [ ] Slide animations/transitions don't distract
- [ ] Key metrics highlighted
- [ ] Contact info on last slide
- [ ] Backup video link embedded (or USB backup)

**Output:** Presentation deck (PDF/PPTX), speaker notes, FAQ doc

---

## SUMMARY TABLE: Task Dependencies & Timeline

| Task | Assignee | Duration | Start | End | Blocker? | Output |
|------|----------|----------|-------|-----|----------|--------|
| 1.1: Excel→GTFS | Bayu | 4–6h | H10 | H10 | No | stops.txt, routes.txt |
| 1.2: Trips/Stop Times | Bayu | 6–8h | H10 | H11 | 1.1 | trips.txt, stop_times.txt |
| 1.3: Geocoding | Bayu/Lippable | 2–3h | H10 | H11 | 1.1 (list) | Updated stops.txt |
| 1.4: OTP2 Rebuild | Lippable | 1–2h | H11 | H11 | 1.1–1.3 | Ready OTP2 graph |
| 1.5: E2E Test 3x | Lippable/QA | 2–3h | H11 | H12 | 1.4 | Test report |
| 2.1: LLM Setup | Bayu | 3–4h | H11 | H11 | API key | `/api/chat` endpoint |
| 2.2: Chat UI | Lippable | 2–3h | H11 | H12 | 2.1 | Chat UI connected |
| 2.3: Test 5 Scenarios | Bayu/QA | 2–3h | H12 | H12 | 2.1–2.2 | Test report |
| 3.1: Full E2E Test | Lippable/QA | 2–3h | H12 | H13 | 1.5, 2.3 | E2E test report |
| 3.2: Dry-Run Demo | PM+team | 1–2h | H13 | H13 | 3.1 | Video + timing log |
| 3.3: Video Fallback | Lippable | 1h | H13 | H13 | 3.2 | MP4 file + backup |
| 3.4: P0 Checklist | QA | 1–2h | H13 | H14 | All above | Readiness report |
| 3.5: Device Testing | QA | 1–2h | H13 | H14 | 3.1 | Device test report |
| 3.6: Presentation Prep | PM | 2–3h | H13 | H14 | 3.1–3.2 | Deck + speaker notes |

---

## CRITICAL PATH (Minimum → Demo Ready by H14)

**Must-Complete in Order:**
1. **H10–11:** Task 1.1 → 1.2 → 1.3 (Excel → GTFS)
2. **H11:** Task 1.4 (OTP2 rebuild)
3. **H11–12:** Task 1.5 (E2E routing test) + Task 2.1–2.2 (Chat setup)
4. **H12:** Task 2.3 (Chat test) + Task 3.1 (Full E2E)
5. **H13:** Task 3.2 (Dry-run) + Task 3.3 (Video backup)
6. **H14:** Task 3.4–3.6 (Final checks + prep)

**Parallelizable (to save time):**
- Task 1.3 (geocoding) can run in parallel with 1.2
- Task 2.1–2.2 can run in parallel with 1.4–1.5 (don't depend)
- Task 3.5 (device testing) can start H13 morning

**Risk Mitigation:**
- If Task 1.4 (OTP2 rebuild) slow: keep TransJakarta-only demo as fallback (still works, shows TransJakarta routing ✓)
- If Task 2.3 (chat) fails: fallback to pre-canned chat responses (less impressive, but demo completes)
- If Task 3.1 (E2E) finds bugs: prioritize by "can demo without it?" (routing > chat > crowd report)

---

## How to Use This Task List with Claude Code Workflow

**Recommended Process:**

1. **PM reads all tasks** → Pick prioritized subset for H10 (don't overload team)
2. **For each task:**
   - Paste task block into Claude Code PM agent
   - PM agent generates **SDD** (technical spec) + subtasks
   - SDD goes to backend-engineer or ui-engineer as needed
   - Backend-engineer/ui-engineer generates **code** + **tests**
   - QA-reviewer verifies checklist items

3. **Example: Task 1.1 (Excel → GTFS)**
   ```
   PM: "Run Task 1.1: Excel → GTFS Conversion (Stops & Routes)"
   Claude Code PM agent:
   - Generates SDD with data schema (stops.txt format)
   - Flags that Bayu needs to do this
   - Creates subtasks: data mapping, validation
   
   Backend agent (if Bayu unavailable):
   - Can script Python conversion (if data provided)
   - Generates GTFS validator script
   ```

4. **Track progress:**
   - Update checklist ✓ as each item completes
   - Move blocking tasks to top if delays
   - Daily standup: which task blocked by what?

---

**Questions for Zaky before executing:**

1. Should PM route tasks to specific Claude Code subagent (backend vs. ui), or just broadcast to whole team?
2. Is Bayu ready to start Task 1.1 H10 morning, or does he need prep time?
3. Do you want daily standup sync (morning + evening) or just H14 checkpoint?
4. Fallback if OTP2 rebuild takes >2 hours: proceed with TransJakarta-only demo, or delay to H12?

---

**Ready to execute?** Zaky biarin PM briefing tim with tasks, atau ada yg perlu di-adjust dulu?
