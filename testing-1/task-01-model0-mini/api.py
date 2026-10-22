"""
FastAPI application untuk deteksi kepadatan YOLO11
Menyediakan endpoint untuk proses video dan ambil hasil deteksi
"""

import logging
import os
from pathlib import Path
from typing import Optional, List, Dict, Any
import json

from fastapi import FastAPI, File, UploadFile, Query, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
import uvicorn

from detector import DensityDetector
from config import (
    API_HOST,
    API_PORT,
    API_RELOAD,
    DEFAULT_CAMERA_ID,
    DEFAULT_LOCATION,
    CROWD_DENSITY_THRESHOLDS,
)

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

# Initialize FastAPI app
app = FastAPI(
    title="SmartRoute AI - Model 0 Mini (Deteksi Kepadatan YOLO11)",
    description="API untuk deteksi dan pelacakan jumlah orang dari video menggunakan YOLO11",
    version="1.0.0",
)

# Initialize detector (akan di-lazy load saat pertama kali dipakai)
detector: Optional[DensityDetector] = None

# Storage untuk hasil deteksi (dalam praktik, gunakan database)
detection_results_cache: Dict[str, List[Dict[str, Any]]] = {}


def get_detector() -> DensityDetector:
    """Lazy load detector instance"""
    global detector
    if detector is None:
        logger.info("Initializing DensityDetector...")
        detector = DensityDetector()
    return detector


class CrowdStatusResponse(BaseModel):
    """Response schema untuk detection result"""

    timestamp: str
    camera_id: str
    location: Dict[str, str]
    frame: Dict[str, int]
    detections: List[Dict[str, Any]]
    passenger_count: Dict[str, int]
    crowd_status: Dict[str, Any]


class DetectionSummary(BaseModel):
    """Summary statistics dari deteksi"""

    total_frames: int
    average_person_count: float
    max_person_count: int
    min_person_count: int
    dominant_crowd_level: str
    level_distribution: Dict[str, int]


@app.get("/health", tags=["System"])
async def health_check():
    """Health check endpoint"""
    return {
        "status": "ok",
        "service": "SmartRoute AI - Model 0 Mini",
        "version": "1.0.0",
    }


@app.get("/config", tags=["Configuration"])
async def get_configuration():
    """Get current configuration untuk threshold kepadatan dan parameter lainnya"""
    return {
        "crowd_density_thresholds": CROWD_DENSITY_THRESHOLDS,
        "max_occupancy_capacity": 100,  # Dari config
        "default_camera_id": DEFAULT_CAMERA_ID,
        "default_location": DEFAULT_LOCATION,
    }


@app.post("/detect", tags=["Detection"], response_model=List[CrowdStatusResponse])
async def detect_from_video(
    file: UploadFile = File(...),
    camera_id: Optional[str] = Query(None),
    location_station: Optional[str] = Query(None),
    location_mode: Optional[str] = Query(None),
    location_zone: Optional[str] = Query(None),
):
    """
    Deteksi kepadatan orang dari video yang diupload

    **Request:**
    - `file`: Video file (mp4, avi, mov, dll)
    - `camera_id`: ID kamera (optional, default dari config)
    - `location_station`: Nama stasiun (optional)
    - `location_mode`: Mode transportasi (optional)
    - `location_zone`: Zona lokasi (optional)

    **Response:**
    - Array of frame-by-frame detection results sesuai schema JSON yang ditentukan
    """
    try:
        # Validate file extension
        allowed_extensions = {".mp4", ".avi", ".mov", ".mkv", ".flv", ".wmv"}
        file_ext = Path(file.filename).suffix.lower()
        if file_ext not in allowed_extensions:
            raise HTTPException(
                status_code=400,
                detail=f"File type '{file_ext}' not supported. Allowed: {allowed_extensions}",
            )

        # Save uploaded file temporarily
        temp_dir = Path("temp_uploads")
        temp_dir.mkdir(exist_ok=True)
        temp_video_path = temp_dir / file.filename

        with open(temp_video_path, "wb") as buffer:
            contents = await file.read()
            buffer.write(contents)

        logger.info(f"Video saved: {temp_video_path}")

        # Prepare location metadata
        location = DEFAULT_LOCATION.copy()
        if location_station:
            location["station"] = location_station
        if location_mode:
            location["transport_mode"] = location_mode
        if location_zone:
            location["zone"] = location_zone

        # Get detector dan process video
        det = get_detector()
        results = det.process_video(
            str(temp_video_path), camera_id=camera_id, location=location
        )

        # Cache results
        result_id = f"{camera_id or DEFAULT_CAMERA_ID}_{Path(file.filename).stem}"
        detection_results_cache[result_id] = results

        logger.info(f"Detection completed. Results cached as: {result_id}")

        # Clean up temp file
        try:
            os.remove(temp_video_path)
        except Exception as e:
            logger.warning(f"Failed to delete temp file: {e}")

        return results

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Detection error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/detect/local", tags=["Detection"], response_model=List[CrowdStatusResponse])
async def detect_from_local_video(
    video_path: str = Query(..., description="Path ke video file lokal"),
    camera_id: Optional[str] = Query(None),
    location_station: Optional[str] = Query(None),
    location_mode: Optional[str] = Query(None),
    location_zone: Optional[str] = Query(None),
):
    """
    Deteksi kepadatan orang dari video lokal yang sudah tersimpan

    **Query Parameters:**
    - `video_path`: Path absolute atau relative ke file video
    - `camera_id`: ID kamera (optional)
    - `location_station`: Nama stasiun (optional)
    - `location_mode`: Mode transportasi (optional)
    - `location_zone`: Zona lokasi (optional)

    **Response:**
    - Array of frame-by-frame detection results
    """
    try:
        # Validate path
        video_file = Path(video_path)
        if not video_file.exists():
            raise HTTPException(
                status_code=404,
                detail=f"Video file not found: {video_path}",
            )

        # Prepare location metadata
        location = DEFAULT_LOCATION.copy()
        if location_station:
            location["station"] = location_station
        if location_mode:
            location["transport_mode"] = location_mode
        if location_zone:
            location["zone"] = location_zone

        # Get detector dan process video
        det = get_detector()
        results = det.process_video(
            str(video_path), camera_id=camera_id, location=location
        )

        # Cache results
        result_id = f"{camera_id or DEFAULT_CAMERA_ID}_{video_file.stem}"
        detection_results_cache[result_id] = results

        logger.info(f"Detection completed. Results cached as: {result_id}")
        return results

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Detection error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/results/{result_id}/summary", tags=["Results"], response_model=DetectionSummary)
async def get_detection_summary(result_id: str):
    """
    Ambil summary statistics dari hasil deteksi yang sudah di-cache

    **Path Parameters:**
    - `result_id`: ID hasil deteksi (dari response detection endpoint)

    **Response:**
    - Summary statistics: average count, max count, dominant level, dll
    """
    if result_id not in detection_results_cache:
        raise HTTPException(
            status_code=404,
            detail=f"Result ID not found: {result_id}. Cache tersedia: {list(detection_results_cache.keys())}",
        )

    results = detection_results_cache[result_id]
    det = get_detector()
    summary = det.process_video_summary(results)

    return summary


@app.get("/results/{result_id}/frames", tags=["Results"])
async def get_detection_frames(
    result_id: str,
    frame_id: Optional[int] = Query(None, description="Specific frame ID (optional)"),
    limit: Optional[int] = Query(
        None, description="Limit jumlah frames yang di-return (default: semua)"
    ),
):
    """
    Ambil frame-by-frame detection results

    **Query Parameters:**
    - `frame_id`: Ambil specific frame saja (optional)
    - `limit`: Batasi jumlah frames yang di-return (optional)

    **Response:**
    - Array of detection results per frame atau single frame result
    """
    if result_id not in detection_results_cache:
        raise HTTPException(
            status_code=404,
            detail=f"Result ID not found: {result_id}",
        )

    results = detection_results_cache[result_id]

    # Filter by frame_id jika diberikan
    if frame_id is not None:
        filtered = [r for r in results if r["frame"]["frame_id"] == frame_id]
        if not filtered:
            raise HTTPException(
                status_code=404,
                detail=f"Frame ID {frame_id} not found in results",
            )
        return filtered[0]

    # Apply limit
    if limit is not None:
        results = results[:limit]

    return results


@app.delete("/results/{result_id}", tags=["Results"])
async def delete_detection_result(result_id: str):
    """
    Hapus cached detection result

    **Path Parameters:**
    - `result_id`: ID hasil deteksi yang akan dihapus
    """
    if result_id not in detection_results_cache:
        raise HTTPException(
            status_code=404,
            detail=f"Result ID not found: {result_id}",
        )

    del detection_results_cache[result_id]
    return {"message": f"Result {result_id} deleted successfully"}


@app.get("/results", tags=["Results"])
async def list_cached_results():
    """List semua cached detection results yang tersedia"""
    return {
        "cached_results": list(detection_results_cache.keys()),
        "total_cached": len(detection_results_cache),
    }


def run_api(host: str = API_HOST, port: int = API_PORT, reload: bool = API_RELOAD):
    """Start FastAPI server"""
    logger.info(f"Starting API server on {host}:{port}")
    uvicorn.run(app, host=host, port=port, reload=reload)


if __name__ == "__main__":
    run_api()
