"""
Test script untuk modul deteksi kepadatan YOLO11
Dapat menjalankan deteksi tanpa server API (standalone)
"""

import json
import logging
from pathlib import Path
from typing import Optional
import sys
import argparse

from detector import DensityDetector
from config import DEFAULT_CAMERA_ID, DEFAULT_LOCATION, CROWD_DENSITY_THRESHOLDS

logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)


def test_detector_with_video(
    video_path: str,
    output_json_path: Optional[str] = None,
    output_summary_path: Optional[str] = None,
    save_visual: bool = False,
):
    """
    Test detector dengan video file

    Args:
        video_path: Path ke video file
        output_json_path: Path untuk menyimpan full JSON results (optional)
        output_summary_path: Path untuk menyimpan summary JSON (optional)
        save_visual: Simpan video output dengan bounding box & track ID (default: False)
    """

    video_file = Path(video_path)
    if not video_file.exists():
        logger.error(f"Video file not found: {video_path}")
        return False

    try:
        # Initialize detector
        logger.info("=" * 60)
        logger.info("Initializing DensityDetector...")
        logger.info("=" * 60)
        detector = DensityDetector(device="cpu")

        # Process video
        logger.info("=" * 60)
        logger.info(f"Processing video: {video_path}")
        if save_visual:
            logger.info("Visual output ENABLED - will save video with bounding boxes")
        logger.info("=" * 60)
        results = detector.process_video(
            str(video_file),
            camera_id=DEFAULT_CAMERA_ID,
            location=DEFAULT_LOCATION,
            save_visual=save_visual,
        )

        if not results:
            logger.warning("No results returned from detector")
            return False

        # Generate summary
        logger.info("=" * 60)
        logger.info("Generating summary...")
        logger.info("=" * 60)
        summary = detector.process_video_summary(results)

        # Print summary
        print("\n" + "=" * 60)
        print("DETECTION SUMMARY")
        print("=" * 60)
        print(f"Total frames processed: {summary['total_frames']}")
        print(f"Average person count: {summary['average_person_count']}")
        print(f"Max person count: {summary['max_person_count']}")
        print(f"Min person count: {summary['min_person_count']}")
        print(f"Dominant crowd level: {summary['dominant_crowd_level']}")
        print(f"Level distribution: {summary['level_distribution']}")
        print("=" * 60)

        # Print sample frames (first 5)
        print("\nSAMPLE FRAMES (First 5):")
        print("=" * 60)
        for i, result in enumerate(results[:5]):
            print(f"\nFrame {i + 1}:")
            print(f"  Frame ID: {result['frame']['frame_id']}")
            print(f"  People count: {result['passenger_count']['current']}")
            print(f"  Crowd level: {result['crowd_status']['level']}")
            print(f"  Occupancy: {result['crowd_status']['occupancy_percentage']}%")
            print(f"  Entered: {result['passenger_count']['entered']}")
            print(f"  Exited: {result['passenger_count']['exited']}")

        # Save full results to JSON jika diminta
        if output_json_path:
            output_file = Path(output_json_path)
            output_file.parent.mkdir(parents=True, exist_ok=True)
            with open(output_file, "w") as f:
                json.dump(results, f, indent=2)
            logger.info(f"Full results saved to: {output_file}")

        # Save summary to JSON jika diminta
        if output_summary_path:
            output_file = Path(output_summary_path)
            output_file.parent.mkdir(parents=True, exist_ok=True)
            with open(output_file, "w") as f:
                json.dump(summary, f, indent=2)
            logger.info(f"Summary saved to: {output_file}")

        return True

    except Exception as e:
        logger.error(f"Error during testing: {e}", exc_info=True)
        return False


def test_config():
    """Test dan print configuration"""
    logger.info("=" * 60)
    logger.info("CONFIGURATION")
    logger.info("=" * 60)
    print(f"Crowd density thresholds:")
    for level, range_dict in CROWD_DENSITY_THRESHOLDS.items():
        print(
            f"  {level}: {range_dict['min']}-{range_dict['max']} orang"
        )
    print(f"\nDefault camera ID: {DEFAULT_CAMERA_ID}")
    print(f"Default location: {DEFAULT_LOCATION}")
    print("=" * 60 + "\n")


def create_dummy_video(output_path: str, duration: int = 5, fps: int = 30):
    """
    Create dummy video file untuk testing (jika video sample tidak tersedia)

    Args:
        output_path: Path untuk menyimpan video
        duration: Durasi video dalam detik
        fps: Frames per second
    """
    try:
        import cv2
        import numpy as np

        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)

        logger.info(f"Creating dummy video: {output_path}")

        # Video properties
        frame_width = 1920
        frame_height = 1080
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")

        writer = cv2.VideoWriter(
            str(output_file),
            fourcc,
            fps,
            (frame_width, frame_height),
        )

        # Generate frames (simple colored frames)
        total_frames = duration * fps
        for frame_num in range(total_frames):
            # Create a colored frame
            frame = np.zeros((frame_height, frame_width, 3), dtype=np.uint8)

            # Change color gradually
            hue = int((frame_num / total_frames) * 180)
            frame[:] = (hue, 255, 255)  # HSV-like effect

            # Add text
            cv2.putText(
                frame,
                f"Test Frame {frame_num + 1}",
                (100, 100),
                cv2.FONT_HERSHEY_SIMPLEX,
                2,
                (255, 255, 255),
                3,
            )

            writer.write(frame)

        writer.release()
        logger.info(f"Dummy video created: {output_file}")
        return str(output_file)

    except Exception as e:
        logger.error(f"Failed to create dummy video: {e}")
        return None


if __name__ == "__main__":
    # Parse command line arguments
    parser = argparse.ArgumentParser(description="Test YOLO11 detection on video")
    parser.add_argument("video", nargs="?", help="Path to video file (optional)")
    parser.add_argument(
        "--save-visual",
        action="store_true",
        help="Save video output with bounding boxes and track IDs"
    )
    args = parser.parse_args()

    # Test configuration
    test_config()

    # Get video path dari argument atau gunakan dummy
    if args.video:
        video_path = args.video
    else:
        # Create dummy video untuk testing
        logger.info("No video file provided. Creating dummy video for testing...")
        video_path = create_dummy_video("sample_videos/test_video.mp4", duration=2, fps=15)

        if not video_path:
            logger.error("Failed to create dummy video")
            sys.exit(1)

    # Run test
    output_json = "results/full_results.json"
    output_summary = "results/summary.json"

    success = test_detector_with_video(
        video_path,
        output_json_path=output_json,
        output_summary_path=output_summary,
        save_visual=args.save_visual,
    )

    if success:
        logger.info("✓ Test completed successfully!")
        logger.info(f"  Results saved to: {output_json}")
        logger.info(f"  Summary saved to: {output_summary}")
        sys.exit(0)
    else:
        logger.error("✗ Test failed!")
        sys.exit(1)
