# Task 01b: Validasi dengan Video Nyata — Tools & Framework

Folder ini berisi semua tools dan templates untuk melakukan validasi Task 01 dengan video nyata.

## 📁 Contents

- **VALIDATION_GUIDE.md** — Panduan lengkap merekam video, validate, dan calibrate
- **manual_validation_template.md** — Template untuk manual validation (copy-paste dan isi)
- **analyze_validation.py** — Script untuk analyze hasil dan suggest calibration
- **README.md** — File ini

## 🚀 Quick Start

### 1️⃣ Rekam Video Nyata

Ikuti panduan di `VALIDATION_GUIDE.md` § "Panduan Merekam Video"

**Checklist:**
- [ ] Duration 30s - 2 min
- [ ] 10-40 orang dalam frame
- [ ] Ada pergerakan (masuk/keluar frame)
- [ ] Cukup terang
- [ ] Sudut agak dari atas (seperti CCTV)
- [ ] Simpan ke `../sample_videos/video_nyata.mp4`

### 2️⃣ Process Video dengan Model

```bash
# Dari folder task-01-model0-mini
cd ..

# Run detection
python test_video.py sample_videos/video_nyata.mp4

# Output tersimpan di:
# - results/full_results.json (detail per-frame)
# - results/summary.json (aggregate statistics)
```

### 3️⃣ Manual Validation

1. **Copy template:**
   ```bash
   cp validation_tools/manual_validation_template.md validation_report_video_nyata.md
   ```

2. **Isi template sesuai panduan:**
   - Hitung manual di 3-5 waktu berbeda
   - Verifikasi tracking untuk 2-3 individu
   - Verifikasi entered/exited
   - Assess crowd density

3. **Save report:**
   ```bash
   # Rename sesuai tanggal/lokasi
   mv validation_report_video_nyata.md validation_report_[DATE]_[LOCATION].md
   ```

### 4️⃣ Analyze & Calibrate

```bash
# Optional: Use analysis script
cd validation_tools
python analyze_validation.py

# Input path ke full_results.json dan manual checks
# Script akan suggest threshold calibration
```

### 5️⃣ Update Configuration

Edit `config.py` berdasarkan hasil:

```python
# Sebelum (default):
CROWD_DENSITY_THRESHOLDS = {
    "rendah": {"min": 0, "max": 10},
    "sedang": {"min": 10, "max": 25},
    "tinggi": {"min": 25, "max": float("inf")}
}

# Sesudah (calibrated):
CROWD_DENSITY_THRESHOLDS = {
    "rendah": {"min": 0, "max": 12},    # ← Update sesuai observasi
    "sedang": {"min": 12, "max": 30},   # ← Update
    "tinggi": {"min": 30, "max": float("inf")}  # ← Update
}
```

### 6️⃣ Update README

Add actual processing time to `README.md`:

```markdown
## Processing Performance

**Measured (Real Video Validation):**
- Video duration: 60 seconds
- Video resolution: 1920x1080
- Processing time: 240 seconds (4 minutes)
- Processing speed: 0.25x real-time on CPU

(Update dari estimasi sebelumnya: "2-4 menit")
```

---

## 📋 Workflow Diagram

```
1. Record Real Video (30s-2min, 10-40 people)
        ↓
2. Run: python test_video.py video_nyata.mp4
        ↓
   Outputs: full_results.json, summary.json
        ↓
3. Manual Validation (fill template, ~20 min)
        ↓
   - Count manual at 3+ timestamps
   - Check tracking consistency
   - Verify entered/exited
        ↓
4. Analyze Results
        ↓
   python validation_tools/analyze_validation.py
        ↓
5. Calibrate config.py
        ↓
6. Update README.md with actual performance
        ↓
✅ Task 01 Complete!
```

---

## 🎯 Success Criteria

✅ **Detection Accuracy:**
- Average error <15% for normal crowd density (10-40 people)
- Result: ____%

✅ **Tracking Consistency:**
- 2-3 individuals tracked with consistent track_id throughout video
- Result: ___% consistent

✅ **Entered/Exited:**
- Model entered/exited within reasonable range of manual count
- Result: ___% error

✅ **Configuration:**
- Thresholds calibrated based on real video data
- Updated: [ ] Yes [ ] No

✅ **Documentation:**
- README updated with actual processing times
- Updated: [ ] Yes [ ] No

✅ **Report:**
- Validation report saved and archived
- File: ___________________________

---

## 📊 Expected Results (Based on Task 02)

**For normal crowd density (10-40 people):**
- Expected detection error: 10-30%
- Expected tracking accuracy: 70-90%
- Expected entered/exited accuracy: 60-80%

**Note:** Higher errors expected for very crowded scenes (>50 people), which is out of spec anyway.

---

## 🔧 Troubleshooting

### "Model detection very slow (>10x real-time)"
→ Normal for CPU. If critical:
  - Use lower resolution video
  - Or consider GPU support (edit detector.py device setting)

### "Tracking ID keeps changing (poor consistency)"
→ Check if crowd density exceeds 40 people
→ This is known limitation; reduce video density if possible

### "Entered/exited numbers way off"
→ Could indicate people entering/exiting repeatedly
→ Manually inspect full_results.json for per-frame details

### "Can't decide on calibration thresholds"
→ Use analyze_validation.py script (interactive)
→ Or manually plot manual_counts vs assigned crowd levels

---

## 📞 Related Documentation

- `VALIDATION_GUIDE.md` — Detailed instructions for recording and validation
- `manual_validation_template.md` — Fillable template for manual validation
- `../README.md` — Main project documentation
- `../config.py` — Configuration file (thresholds to update)
- `../test_video.py` — Main detection script

---

## ✅ Acceptance Criteria Checklist

After completing validation, verify:

- [ ] Real video recorded (not dummy/synthetic)
- [ ] Model ran without errors on video
- [ ] Manual validation template filled with 3+ data points
- [ ] Detection accuracy measured (error %)
- [ ] Tracking verified for 2-3 individuals
- [ ] Entered/exited verified manually
- [ ] Thresholds calibrated in config.py
- [ ] Actual processing time measured and documented
- [ ] Validation report saved
- [ ] README.md updated with measured performance
- [ ] Task 01 status marked as COMPLETE

---

**Status:** 🟢 **Ready to Execute** (framework complete, awaiting video recording)

**Next Step:** Record video nyata sesuai spec, then follow workflow di atas.
