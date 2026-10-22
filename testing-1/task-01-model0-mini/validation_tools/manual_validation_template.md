# Manual Validation Report Template

**Video:** ___________________  
**Date Recorded:** ___________________  
**Duration:** ___________________  
**Location:** ___________________  
**Recorded by:** ___________________  

---

## 📊 Part 1: Manual Count Comparison

Pilih 3-5 waktu berbeda di video, hitung jumlah orang secara manual dan bandingkan dengan model.

### Manual Counting at Different Timestamps

| Timestamp | Manual Count | Model Predicted | Absolute Error | % Error | Notes |
|-----------|--------------|-----------------|-----------------|---------|--------|
| 00:00:05  | ___          | ___             | ___             | ___     | |
| 00:00:15  | ___          | ___             | ___             | ___     | |
| 00:00:25  | ___          | ___             | ___             | ___     | |
| 00:00:35  | ___          | ___             | ___             | ___     | |
| 00:00:45  | ___          | ___             | ___             | ___     | |

**Summary:**
- Total checks: ___
- Average error: ___ orang
- Average % error: ___ %
- Min error: ___ %
- Max error: ___ %

**Assessment:** 
- [ ] Error <10% — Excellent ✓
- [ ] Error 10-20% — Good ✓
- [ ] Error 20-50% — Acceptable (depends on density)
- [ ] Error >50% — Needs attention

---

## 👁️ Part 2: Tracking Verification

Pilih 2-3 individu di video dan verifikasi apakah `track_id` mereka konsisten.

### Individual 1

**Visual ID:** _________________________________  
(Contoh: "Orang berkaos biru di sisi kanan")

**Time visible (approx):** From 00:00:___ to 00:00:___

**Track ID checks:**
| Frame ID | Timestamp | Track ID | Consistent? |
|----------|-----------|----------|-------------|
| ___ | 00:00:___ | ___ | [ ] Yes / [ ] No |
| ___ | 00:00:___ | ___ | [ ] Yes / [ ] No |
| ___ | 00:00:___ | ___ | [ ] Yes / [ ] No |
| ___ | 00:00:___ | ___ | [ ] Yes / [ ] No |
| ___ | 00:00:___ | ___ | [ ] Yes / [ ] No |

**Assessment:** 
- [ ] Consistent throughout (100% accuracy) ✓
- [ ] Mostly consistent with 1-2 jumps (80-90% accuracy)
- [ ] Frequent ID changes (poor tracking)

---

### Individual 2

**Visual ID:** _________________________________

**Time visible (approx):** From 00:00:___ to 00:00:___

**Track ID checks:**
| Frame ID | Timestamp | Track ID | Consistent? |
|----------|-----------|----------|-------------|
| ___ | 00:00:___ | ___ | [ ] Yes / [ ] No |
| ___ | 00:00:___ | ___ | [ ] Yes / [ ] No |
| ___ | 00:00:___ | ___ | [ ] Yes / [ ] No |
| ___ | 00:00:___ | ___ | [ ] Yes / [ ] No |
| ___ | 00:00:___ | ___ | [ ] Yes / [ ] No |

**Assessment:** 
- [ ] Consistent throughout ✓
- [ ] Mostly consistent with minor jumps
- [ ] Frequent ID changes (poor tracking)

---

### Individual 3 (Optional)

**Visual ID:** _________________________________

**Time visible (approx):** From 00:00:___ to 00:00:___

**Track ID checks:**
| Frame ID | Timestamp | Track ID | Consistent? |
|----------|-----------|----------|-------------|
| ___ | 00:00:___ | ___ | [ ] Yes / [ ] No |
| ___ | 00:00:___ | ___ | [ ] Yes / [ ] No |
| ___ | 00:00:___ | ___ | [ ] Yes / [ ] No |
| ___ | 00:00:___ | ___ | [ ] Yes / [ ] No |

**Assessment:** 
- [ ] Consistent throughout ✓
- [ ] Mostly consistent with minor jumps
- [ ] Frequent ID changes

---

**Overall Tracking Summary:**
- Individuals tracked: ___/3
- Consistent tracking: ___/3 (___%)
- Assessment: [ ] Excellent [ ] Good [ ] Acceptable [ ] Poor

---

## ➡️➡️ Part 3: Entered/Exited Verification

Count berapa orang yang benar-benar masuk/keluar frame selama video.

### Manual Count

**Focus edge:** [ ] Left | [ ] Right | [ ] Top | [ ] Bottom

**Manual observation:**
- Initial people in frame: ___
- People entered during video: ___
- People exited during video: ___
- Final people in frame: ___

**Verification:**
- Initial + Entered - Exited = Final
- ___ + ___ - ___ = ___  ✓ (should match)

### Model Output

From `results/summary.json`:
- Model entered: ___
- Model exited: ___

### Comparison

| Metric | Manual | Model | Difference | % Error |
|--------|--------|-------|------------|---------|
| Entered | ___ | ___ | ___ | ___% |
| Exited | ___ | ___ | ___ | ___% |

**Assessment:**
- [ ] Match perfectly (0-5% error) ✓
- [ ] Close match (5-20% error) ✓
- [ ] Reasonable estimate (20-50% error)
- [ ] Significant mismatch (>50% error)

---

## 📈 Part 4: Crowd Density Assessment

Based on observations in video:

**What density level does this video represent?**
- [ ] Low (1-10 people, sparse) — Good for testing baseline
- [ ] Medium (10-25 people, some crowding) — Good for typical halte/stasiun
- [ ] High (25-50 people, noticeable crowding) — Challenging but realistic
- [ ] Very High (>50 people, very crowded) — Beyond typical halte, known to fail

**Recommended threshold calibration:**

Current config:
```python
CROWD_DENSITY_THRESHOLDS = {
    "rendah": {"min": 0, "max": 10},
    "sedang": {"min": 10, "max": 25},
    "tinggi": {"min": 25, "max": float("inf")}
}
```

**Observation in video:**
- When frame had ~___ people → appeared as "rendah" density
- When frame had ~___ people → appeared as "sedang" density
- When frame had ~___ people → appeared as "tinggi" density

**Suggested update:**
```python
CROWD_DENSITY_THRESHOLDS = {
    "rendah": {"min": 0, "max": ___},
    "sedang": {"min": ___, "max": ___},
    "tinggi": {"min": ___, "max": float("inf")}
}
```

---

## ⏱️ Part 5: Processing Performance

**Video specifications:**
- Duration: ___ seconds
- Resolution: ___ x ___ pixels
- Frame rate: ___ FPS

**Processing metrics:**
- Model loading time: ___ seconds
- Video processing time: ___ seconds
- Total processing time: ___ seconds
- Processing speed: ___ seconds video / ___ seconds processing = ___x real-time

**Assessment:**
- Fast (<1x real-time on CPU): ___ seconds processing
- Normal (1-5x real-time on CPU): ___ seconds processing
- Slow (>5x real-time on CPU): ___ seconds processing

---

## 📋 Part 6: Overall Assessment

### What Worked Well ✓

- [ ] Detection accuracy
- [ ] Tracking consistency
- [ ] Entered/exited counting
- [ ] Crowd density level assignment
- [ ] Processing speed acceptable

List specific successes:
1. ___________________________
2. ___________________________
3. ___________________________

### Areas for Improvement 🔧

- [ ] Detection misses some people
- [ ] Tracking has ID jumps
- [ ] Entered/exited count off
- [ ] Crowd density levels need adjustment
- [ ] Processing too slow

List specific issues:
1. ___________________________
2. ___________________________
3. ___________________________

### Recommendations 💡

1. ___________________________
2. ___________________________
3. ___________________________

---

## ✅ Sign-Off

**Validator Name:** ___________________  
**Date of Validation:** ___________________  
**Status:** [ ] Passed | [ ] Passed with Notes | [ ] Needs Revision  

**Overall Result:**
- [ ] Ready for production (detection + tracking both acceptable)
- [ ] Acceptable for demo with caveats noted
- [ ] Needs further tuning before deployment

**Notes:**
```
[Tulis catatan general di sini]
```

---

**Next Step:** Update `config.py` dengan calibrated thresholds dan update `README.md` dengan actual processing times
