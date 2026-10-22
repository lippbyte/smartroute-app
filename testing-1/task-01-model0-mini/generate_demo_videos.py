"""
Task Model0-03: Validasi Video + Visual Output (Pretrained, Tanpa Fine-Tuning)

Jalankan YOLO11 pretrained + ByteTrack ke semua video di sample_videos/,
hasilkan video mp4 dengan overlay:
  - Bounding box per orang terdeteksi
  - Track ID di atas box (konsisten selama orang itu di frame)
  - Counter jumlah orang saat ini (pojok kiri atas)

Selain video, script ini juga menghitung statistik tracking sederhana per video
(dipakai untuk menulis catatan kualitas tracking secara objektif, bukan tebak-tebakan):
  - jumlah unique track ID vs rata-rata orang per frame (id_turnover_ratio)
  - proporsi track yang "flicker" (hidup < 10 frame lalu hilang -> indikasi ID putus)
  - jumlah lonjakan count antar-frame yang besar (indikasi deteksi hilang-muncul)

TIDAK mengubah bobot/model apa pun -- murni pretrained yolo11n.pt + bytetrack.yaml
seperti yang sudah dipakai di Task 01/01c.
"""

import json
import logging
import time
from pathlib import Path

import cv2
from ultralytics import YOLO

from config import YOLO_MODEL, PERSON_CLASS_ID, CONFIDENCE_THRESHOLD

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

SAMPLE_DIR = Path("sample_videos")
OUT_DIR = Path("results/demo_videos")
MAX_OUTPUT_WIDTH = 1280  # downscale video besar (4K) supaya proses & file output tidak berat -- demo tetap jelas dibaca

VIDEO_EXTS = {".mp4", ".mov", ".avi", ".mkv"}


def resize_keep_aspect(frame, max_width):
    h, w = frame.shape[:2]
    if w <= max_width:
        return frame
    scale = max_width / w
    return cv2.resize(frame, (max_width, int(h * scale)), interpolation=cv2.INTER_AREA)


def process_one_video(video_path: Path, model: YOLO):
    name = video_path.stem
    out_path = OUT_DIR / f"{name}.mp4"
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    cap = cv2.VideoCapture(str(video_path))
    src_fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    src_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    src_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    cap.release()

    if src_w > MAX_OUTPUT_WIDTH:
        scale = MAX_OUTPUT_WIDTH / src_w
        out_w, out_h = MAX_OUTPUT_WIDTH, int(src_h * scale)
    else:
        out_w, out_h = src_w, src_h

    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(str(out_path), fourcc, src_fps, (out_w, out_h))

    track_info = {}  # track_id -> {"first": frame_idx, "last": frame_idx, "n": count}
    counts_per_frame = []
    frame_idx = 0
    t0 = time.time()

    results_gen = model.track(
        source=str(video_path),
        classes=[PERSON_CLASS_ID],
        conf=CONFIDENCE_THRESHOLD,
        persist=True,
        tracker="bytetrack.yaml",
        stream=True,
        verbose=False,
        device="cpu",
    )

    for r in results_gen:
        frame = r.orig_img.copy()
        person_count = 0

        if r.boxes is not None:
            for box in r.boxes:
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                tid = int(box.id[0]) if box.id is not None else -1
                conf = float(box.conf[0])
                person_count += 1

                if tid not in track_info:
                    track_info[tid] = {"first": frame_idx, "last": frame_idx, "n": 0}
                track_info[tid]["last"] = frame_idx
                track_info[tid]["n"] += 1

                cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                label = f"ID {tid}" if tid != -1 else "ID ?"
                (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
                cv2.rectangle(frame, (x1, max(0, y1 - th - 8)), (x1 + tw + 6, y1), (0, 255, 0), -1)
                cv2.putText(frame, label, (x1 + 3, max(12, y1 - 5)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 2)

        counts_per_frame.append(person_count)

        # Counter pojok kiri atas
        counter_text = f"Orang saat ini: {person_count}"
        (tw, th), _ = cv2.getTextSize(counter_text, cv2.FONT_HERSHEY_SIMPLEX, 0.9, 2)
        cv2.rectangle(frame, (5, 5), (15 + tw, 20 + th), (0, 0, 0), -1)
        cv2.putText(frame, counter_text, (10, 15 + th),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 255, 255), 2)

        if frame.shape[1] > MAX_OUTPUT_WIDTH:
            frame = resize_keep_aspect(frame, MAX_OUTPUT_WIDTH)
        # Guard: pastikan ukuran match writer (kadang orig_img beda 1px karena decode)
        if frame.shape[1] != out_w or frame.shape[0] != out_h:
            frame = cv2.resize(frame, (out_w, out_h))

        writer.write(frame)
        frame_idx += 1

    writer.release()
    elapsed = time.time() - t0

    # --- Statistik stabilitas tracking ---
    n_frames = frame_idx
    unique_ids = [tid for tid in track_info if tid != -1]
    avg_count = sum(counts_per_frame) / n_frames if n_frames else 0
    max_count = max(counts_per_frame) if counts_per_frame else 0

    lifetimes = [v["n"] for k, v in track_info.items() if k != -1]
    avg_lifetime_frames = sum(lifetimes) / len(lifetimes) if lifetimes else 0
    flicker_tracks = sum(1 for lt in lifetimes if lt < 10)
    flicker_ratio = flicker_tracks / len(lifetimes) if lifetimes else 0

    id_turnover_ratio = (len(unique_ids) / avg_count) if avg_count > 0 else 0

    jumps = 0
    for i in range(1, len(counts_per_frame)):
        if abs(counts_per_frame[i] - counts_per_frame[i - 1]) >= 3:
            jumps += 1
    jump_rate = jumps / n_frames if n_frames else 0

    stats = {
        "video": video_path.name,
        "output_mp4": str(out_path).replace("\\", "/"),
        "source_resolution": f"{src_w}x{src_h}",
        "output_resolution": f"{out_w}x{out_h}",
        "fps": round(src_fps, 1),
        "frames_processed": n_frames,
        "processing_time_sec": round(elapsed, 1),
        "avg_person_count": round(avg_count, 2),
        "max_person_count": max_count,
        "unique_track_ids": len(unique_ids),
        "avg_track_lifetime_frames": round(avg_lifetime_frames, 1),
        "avg_track_lifetime_sec": round(avg_lifetime_frames / src_fps, 2) if src_fps else 0,
        "flicker_ratio": round(flicker_ratio, 3),
        "id_turnover_ratio": round(id_turnover_ratio, 2),
        "big_count_jump_rate": round(jump_rate, 3),
    }
    return stats


def main():
    videos = sorted([p for p in SAMPLE_DIR.iterdir() if p.suffix.lower() in VIDEO_EXTS])
    logger.info(f"Found {len(videos)} videos to process")

    model = YOLO(YOLO_MODEL)
    all_stats = []

    for i, v in enumerate(videos, 1):
        logger.info(f"[{i}/{len(videos)}] Processing {v.name} ...")
        try:
            stats = process_one_video(v, model)
            all_stats.append(stats)
            logger.info(f"  done in {stats['processing_time_sec']}s -> {stats['output_mp4']}")
        except Exception as e:
            logger.error(f"  FAILED on {v.name}: {e}", exc_info=True)
            all_stats.append({"video": v.name, "error": str(e)})

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    stats_path = OUT_DIR / "_stats_summary.json"
    with open(stats_path, "w") as f:
        json.dump(all_stats, f, indent=2)
    logger.info(f"Stats summary saved to {stats_path}")


if __name__ == "__main__":
    main()
