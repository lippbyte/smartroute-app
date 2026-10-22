"""
Modul deteksi kepadatan menggunakan YOLO11 + ByteTrack tracking
Mendeteksi dan melacak jumlah orang dari video lokal
"""

import json
from pathlib import Path
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Tuple
import logging

import cv2
from ultralytics import YOLO

from config import (
    YOLO_MODEL,
    TRACKER_CONFIG,
    PERSON_CLASS_ID,
    CONFIDENCE_THRESHOLD,
    CROWD_DENSITY_THRESHOLDS,
    MAX_OCCUPANCY_CAPACITY,
    PROCESS_EVERY_N_FRAMES,
    INCLUDE_DETECTION_DETAILS,
    DEFAULT_CAMERA_ID,
    DEFAULT_LOCATION,
)

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)


class DensityDetector:
    """
    Detector kepadatan orang menggunakan YOLO11 dan ByteTrack tracking
    """

    def __init__(self, model_path: str = YOLO_MODEL, device: str = "cpu"):
        """
        Inisialisasi detector dengan model YOLO11

        Args:
            model_path: Path ke model YOLO11 (default: yolo11n.pt)
            device: Device untuk inference (cpu, cuda, mps, dll)
        """
        self.device = device
        self.model = None
        self._load_model(model_path)
        self.track_ids_current = set()  # Track IDs di frame sekarang
        self.track_ids_previous = set()  # Track IDs di frame sebelumnya

    def _load_model(self, model_path: str):
        """Load YOLO11 model"""
        try:
            logger.info(f"Loading YOLO11 model: {model_path} on device: {self.device}")
            self.model = YOLO(model_path)
            logger.info("Model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            raise

    def _calculate_occupancy_percentage(self, person_count: int) -> int:
        """
        Hitung persentase occupancy berdasarkan kapasitas maksimal area

        Args:
            person_count: Jumlah orang terdeteksi

        Returns:
            Persentase occupancy (0-100+)
        """
        occupancy = int((person_count / MAX_OCCUPANCY_CAPACITY) * 100)
        return min(occupancy, 150)  # Cap at 150% untuk overfull

    def _get_crowd_level(self, person_count: int) -> str:
        """
        Tentukan level kepadatan berdasarkan jumlah orang

        Args:
            person_count: Jumlah orang terdeteksi

        Returns:
            Level kepadatan: "rendah", "sedang", atau "tinggi"
        """
        thresholds = CROWD_DENSITY_THRESHOLDS
        if person_count <= thresholds["rendah"]["max"]:
            return "rendah"
        elif person_count <= thresholds["sedang"]["max"]:
            return "sedang"
        else:
            return "tinggi"

    def _calculate_person_entries_exits(self) -> Tuple[int, int]:
        """
        Hitung jumlah orang masuk/keluar dengan membandingkan track IDs

        Note: Implementasi sederhana - untuk MVP, bisa disederhanakan lebih lanjut
        """
        entered = len(self.track_ids_current - self.track_ids_previous)
        exited = len(self.track_ids_previous - self.track_ids_current)
        return entered, exited

    def process_video(
        self,
        video_path: str,
        camera_id: Optional[str] = None,
        location: Optional[Dict] = None,
        save_visual: bool = False,
    ) -> List[Dict[str, Any]]:
        """
        Proses video dan deteksi orang per frame

        Args:
            video_path: Path ke file video
            camera_id: ID kamera (default dari config)
            location: Metadata lokasi (default dari config)
            save_visual: Simpan video output dengan bounding box & track ID (default: False)

        Returns:
            List of detection results per frame sesuai schema JSON yang ditentukan
        """
        if camera_id is None:
            camera_id = DEFAULT_CAMERA_ID
        if location is None:
            location = DEFAULT_LOCATION

        # Validasi file video
        video_file = Path(video_path)
        if not video_file.exists():
            raise FileNotFoundError(f"Video file not found: {video_path}")

        results = []
        frame_id = 0
        person_track_history = {}  # Track history untuk hitung entered/exited

        try:
            logger.info(f"Starting video processing: {video_path}")

            # Open video dengan OpenCV untuk metadata
            cap = cv2.VideoCapture(str(video_path))
            if not cap.isOpened():
                raise ValueError(f"Cannot open video file: {video_path}")

            frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            fps = cap.get(cv2.CAP_PROP_FPS)
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

            logger.info(
                f"Video info - Resolution: {frame_width}x{frame_height}, "
                f"FPS: {fps}, Total frames: {total_frames}"
            )

            # Tracking dengan YOLO model.track()
            # Note: model.track() otomatis menggunakan ByteTrack dari Ultralytics
            track_kwargs = {
                "source": str(video_path),
                "classes": [PERSON_CLASS_ID],  # Hanya deteksi person
                "conf": CONFIDENCE_THRESHOLD,
                "persist": True,  # Persist track IDs across frames
                "verbose": False,
                "device": self.device,  # Ensure consistent device
            }

            # Add visual output if requested
            if save_visual:
                track_kwargs["save"] = True
                track_kwargs["project"] = "results/visual_output"
                track_kwargs["name"] = Path(video_path).stem
                logger.info("Visual output enabled - saving to results/visual_output/")

            tracks = self.model.track(**track_kwargs)

            frame_idx = 0
            for track_result in tracks:
                if frame_idx % PROCESS_EVERY_N_FRAMES != 0:
                    frame_idx += 1
                    continue

                # Use frame_idx directly (Results.info not available in current ultralytics version)
                frame_id = frame_idx

                # Get timestamp untuk frame ini (estimasi berdasarkan frame rate)
                timestamp = datetime.now(timezone.utc)
                if fps > 0:
                    seconds_offset = frame_id / fps
                    # Untuk demo, gunakan waktu sekarang (dalam praktik bisa dari metadata video)

                # Extract detections dari result
                detections = []
                person_count = 0
                current_track_ids = set()

                if track_result.boxes is not None:
                    boxes = track_result.boxes
                    for idx, box in enumerate(boxes):
                        try:
                            # Extract info dari box
                            track_id = int(box.id[0]) if box.id is not None else None
                            confidence = float(box.conf[0])
                            x1, y1, x2, y2 = box.xyxy[0]
                            bbox_width = int(x2 - x1)
                            bbox_height = int(y2 - y1)

                            current_track_ids.add(track_id)
                            person_count += 1

                            # Update track history
                            if track_id not in person_track_history:
                                person_track_history[track_id] = {
                                    "first_seen": frame_id,
                                    "last_seen": frame_id,
                                }
                            person_track_history[track_id]["last_seen"] = frame_id

                            # Build detection object (jika include details)
                            if INCLUDE_DETECTION_DETAILS:
                                detection = {
                                    "track_id": track_id,
                                    "class": "person",
                                    "confidence": round(confidence, 2),
                                    "bounding_box": {
                                        "x": int(x1),
                                        "y": int(y1),
                                        "width": bbox_width,
                                        "height": bbox_height,
                                    },
                                }
                                detections.append(detection)

                        except Exception as e:
                            logger.warning(f"Error processing box {idx}: {e}")
                            continue

                # Calculate entered/exited (simplified: baru muncul/hilang)
                entered = len(current_track_ids - self.track_ids_previous)
                exited = len(self.track_ids_previous - current_track_ids)

                self.track_ids_previous = current_track_ids.copy()

                # Calculate crowd status
                crowd_level = self._get_crowd_level(person_count)
                occupancy_percentage = self._calculate_occupancy_percentage(person_count)

                # Build result frame sesuai schema
                frame_result = {
                    "timestamp": timestamp.isoformat(),
                    "camera_id": camera_id,
                    "location": location,
                    "frame": {
                        "frame_id": frame_id,
                        "width": frame_width,
                        "height": frame_height,
                    },
                    "detections": detections if INCLUDE_DETECTION_DETAILS else [],
                    "passenger_count": {
                        "current": person_count,
                        "entered": entered,
                        "exited": exited,
                    },
                    "crowd_status": {
                        "level": crowd_level,
                        "occupancy_percentage": occupancy_percentage,
                    },
                }

                results.append(frame_result)

                # Log progress setiap 30 frame
                if frame_id % 30 == 0:
                    logger.info(
                        f"Frame {frame_id}: {person_count} people, "
                        f"Level: {crowd_level}, Occupancy: {occupancy_percentage}%"
                    )

                frame_idx += 1

            cap.release()
            logger.info(f"Video processing completed. Total frames processed: {len(results)}")

        except Exception as e:
            logger.error(f"Error processing video: {e}")
            raise

        return results

    def process_video_summary(
        self, results: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Generate summary statistics dari hasil deteksi

        Args:
            results: List of frame results dari process_video()

        Returns:
            Dictionary dengan summary statistics
        """
        if not results:
            return {
                "total_frames": 0,
                "average_person_count": 0,
                "max_person_count": 0,
                "min_person_count": 0,
                "dominant_crowd_level": "rendah",
            }

        person_counts = [r["passenger_count"]["current"] for r in results]
        crowd_levels = [r["crowd_status"]["level"] for r in results]

        # Count occurrence of each level
        level_counts = {"rendah": 0, "sedang": 0, "tinggi": 0}
        for level in crowd_levels:
            level_counts[level] = level_counts.get(level, 0) + 1

        dominant_level = max(level_counts, key=level_counts.get)

        summary = {
            "total_frames": len(results),
            "average_person_count": round(sum(person_counts) / len(person_counts), 2),
            "max_person_count": max(person_counts),
            "min_person_count": min(person_counts),
            "dominant_crowd_level": dominant_level,
            "level_distribution": level_counts,
        }

        return summary
