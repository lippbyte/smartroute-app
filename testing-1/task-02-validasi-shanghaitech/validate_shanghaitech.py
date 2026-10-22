"""
Task 02: Validasi Akurasi Deteksi — ShanghaiTech Part B

Script untuk melakukan sanity-check terhadap akurasi deteksi YOLO11 pretrained
menggunakan dataset publik ShanghaiTech Part B dengan ground truth berlabel.

Perbandingan: prediksi YOLO11 vs actual count dari .mat ground truth
"""

import logging
import sys
import json
from pathlib import Path
from typing import Dict, List, Tuple, Optional
import csv

import numpy as np
from ultralytics import YOLO

from config import (
    YOLO_MODEL,
    PERSON_CLASS_ID,
    CONFIDENCE_THRESHOLD,
    SHANGHAITECH_TEST_IMAGES_PATH,
    SHANGHAITECH_GROUND_TRUTH_PATH,
    SAMPLE_SIZE,
    RESULTS_DIR,
    OUTPUT_CSV,
    OUTPUT_JSON,
    OUTPUT_SUMMARY,
    LOG_LEVEL,
)

# Setup logging
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


class ShanghaiTechValidator:
    """Validator untuk ShanghaiTech Part B dataset"""

    def __init__(self):
        """Initialize validator dengan YOLO11 model"""
        self.model = None
        self.results = []
        self.errors = []
        self._load_model()

    def _load_model(self):
        """Load YOLO11 model"""
        try:
            logger.info(f"Loading YOLO11 model: {YOLO_MODEL}")
            self.model = YOLO(YOLO_MODEL)
            logger.info(
                f"Model loaded successfully. "
                f"Using confidence threshold: {CONFIDENCE_THRESHOLD}"
            )
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            raise

    def _read_shanghaitech_ground_truth(self, gt_file: Path) -> int:
        """
        Read ShanghaiTech ground truth .mat file dan return jumlah kepala

        Args:
            gt_file: Path ke file .mat ground truth

        Returns:
            Jumlah kepala (orang) yang ter-annotasi
        """
        try:
            import scipy.io as sio

            mat = sio.loadmat(str(gt_file))

            # ShanghaiTech .mat format (nested cell arrays):
            # Structure: image_info[0,0][0,0] = numpy.void((coords_array, count_array))
            # Can be indexed as: inner[0] = coords, inner[1] = count [[num]]
            if "image_info" in mat:
                image_info = mat["image_info"]

                try:
                    # Navigate through nested (1,1) arrays to numpy.void object
                    nested = image_info[0, 0]  # (1,1) array
                    inner = nested[0, 0]  # numpy.void with 2 elements

                    # Access tuple elements via indexing on numpy.void
                    # inner[0] = coordinates array, inner[1] = count array
                    count_array = inner[1]
                    if isinstance(count_array, np.ndarray):
                        count = int(count_array[0, 0]) if count_array.size > 0 else 0
                        return count
                except Exception as e:
                    logger.debug(f"Error extracting count from {gt_file}: {e}")
                    pass

                # Fallback: count from coordinates array
                try:
                    nested = image_info[0, 0]
                    inner = nested[0, 0]
                    coords = inner[0]
                    if isinstance(coords, np.ndarray) and len(coords.shape) == 2:
                        return int(coords.shape[0])
                except Exception:
                    pass

            return 0

        except Exception as e:
            logger.error(f"Error reading {gt_file}: {e}")
            return -1  # Error indicator

    def _detect_people_in_image(self, image_path: Path) -> int:
        """
        Run YOLO11 detection pada image dan return jumlah orang terdeteksi

        Args:
            image_path: Path ke image file

        Returns:
            Jumlah orang yang terdeteksi
        """
        try:
            if not image_path.exists():
                logger.error(f"Image not found: {image_path}")
                return -1

            # Run detection
            results = self.model(
                str(image_path),
                classes=[PERSON_CLASS_ID],
                conf=CONFIDENCE_THRESHOLD,
                verbose=False,
            )

            # Count detections
            if results and len(results) > 0:
                num_detections = len(results[0].boxes)
            else:
                num_detections = 0

            return num_detections

        except Exception as e:
            logger.error(f"Error detecting in {image_path}: {e}")
            return -1

    def _calculate_errors(
        self, predicted: int, actual: int
    ) -> Dict[str, float]:
        """
        Calculate error metrics

        Args:
            predicted: Jumlah orang yang diprediksi
            actual: Jumlah orang yang sebenarnya (ground truth)

        Returns:
            Dictionary dengan berbagai error metrics
        """
        errors = {
            "absolute_error": abs(predicted - actual),
            "percentage_error": (
                ((abs(predicted - actual) / actual) * 100) if actual > 0 else 0
            ),
        }

        return errors

    def validate_sample(
        self, sample_size: Optional[int] = None
    ) -> List[Dict]:
        """
        Validate sampel images dari ShanghaiTech

        Args:
            sample_size: Jumlah sampel yang di-process (default: dari config)

        Returns:
            List of validation results per image
        """
        if sample_size is None:
            sample_size = SAMPLE_SIZE

        # Verify paths exist
        if not SHANGHAITECH_TEST_IMAGES_PATH.exists():
            logger.error(
                f"ShanghaiTech test images path not found: {SHANGHAITECH_TEST_IMAGES_PATH}"
            )
            logger.info("Please download ShanghaiTech Part B manually to ShanghaiTech/ folder")
            return []

        if not SHANGHAITECH_GROUND_TRUTH_PATH.exists():
            logger.error(
                f"ShanghaiTech ground truth path not found: {SHANGHAITECH_GROUND_TRUTH_PATH}"
            )
            return []

        # Get list of test images
        image_extensions = {".jpg", ".jpeg", ".png", ".bmp", ".tiff"}
        image_files = [
            f
            for f in sorted(SHANGHAITECH_TEST_IMAGES_PATH.iterdir())
            if f.suffix.lower() in image_extensions
        ]

        if not image_files:
            logger.error(f"No images found in {SHANGHAITECH_TEST_IMAGES_PATH}")
            return []

        # Limit to sample size
        image_files = image_files[:sample_size]
        logger.info(f"Processing {len(image_files)} sample images...")

        # Process each image
        results = []
        for idx, image_path in enumerate(image_files, 1):
            logger.info(f"[{idx}/{len(image_files)}] Processing {image_path.name}...")

            # Detect people
            predicted_count = self._detect_people_in_image(image_path)

            # Read ground truth
            # Note: ShanghaiTech ground truth files have "GT_" prefix
            gt_filename = "GT_" + image_path.stem + ".mat"
            gt_path = SHANGHAITECH_GROUND_TRUTH_PATH / gt_filename
            actual_count = self._read_shanghaitech_ground_truth(gt_path)

            # Calculate errors
            if predicted_count >= 0 and actual_count >= 0:
                error_metrics = self._calculate_errors(predicted_count, actual_count)
            else:
                error_metrics = {
                    "absolute_error": None,
                    "percentage_error": None,
                }

            # Build result
            result = {
                "image_name": image_path.name,
                "image_path": str(image_path),
                "predicted_count": predicted_count,
                "actual_count": actual_count,
                "absolute_error": error_metrics["absolute_error"],
                "percentage_error": error_metrics["percentage_error"],
            }

            results.append(result)
            logger.debug(
                f"  Predicted: {predicted_count}, Actual: {actual_count}, "
                f"Error: {error_metrics['absolute_error']}"
            )

        self.results = results
        return results

    def calculate_aggregate_metrics(self) -> Dict[str, float]:
        """
        Calculate aggregate error metrics dari semua results

        Returns:
            Dictionary dengan agregat MAE, MAPE, RMSE
        """
        if not self.results:
            return {}

        # Filter valid results (tidak ada error indicator)
        valid_results = [
            r
            for r in self.results
            if r["predicted_count"] >= 0 and r["actual_count"] >= 0
        ]

        if not valid_results:
            logger.warning("No valid results to calculate metrics")
            return {}

        abs_errors = [r["absolute_error"] for r in valid_results]
        pct_errors = [
            r["percentage_error"]
            for r in valid_results
            if r["percentage_error"] is not None
        ]

        metrics = {}

        # MAE (Mean Absolute Error)
        if abs_errors:
            mae = np.mean(abs_errors)
            metrics["MAE"] = float(mae)
            logger.info(f"Mean Absolute Error (MAE): {mae:.2f} orang")

        # MAPE (Mean Absolute Percentage Error)
        if pct_errors:
            mape = np.mean(pct_errors)
            metrics["MAPE"] = float(mape)
            logger.info(f"Mean Absolute Percentage Error (MAPE): {mape:.2f}%")

        # RMSE (Root Mean Squared Error)
        if abs_errors:
            rmse = np.sqrt(np.mean([e ** 2 for e in abs_errors]))
            metrics["RMSE"] = float(rmse)
            logger.info(f"Root Mean Squared Error (RMSE): {rmse:.2f} orang")

        # Min, Max, Mean predictions
        predicted_counts = [r["predicted_count"] for r in valid_results]
        actual_counts = [r["actual_count"] for r in valid_results]

        metrics["predicted_mean"] = float(np.mean(predicted_counts))
        metrics["predicted_std"] = float(np.std(predicted_counts))
        metrics["actual_mean"] = float(np.mean(actual_counts))
        metrics["actual_std"] = float(np.std(actual_counts))
        metrics["total_samples"] = len(valid_results)

        return metrics

    def save_results_csv(self, filepath: Path):
        """Save results to CSV file"""
        try:
            filepath.parent.mkdir(parents=True, exist_ok=True)

            with open(filepath, "w", newline="") as f:
                writer = csv.DictWriter(
                    f,
                    fieldnames=[
                        "image_name",
                        "predicted_count",
                        "actual_count",
                        "absolute_error",
                        "percentage_error",
                    ],
                )
                writer.writeheader()
                for result in self.results:
                    writer.writerow(
                        {
                            "image_name": result["image_name"],
                            "predicted_count": result["predicted_count"],
                            "actual_count": result["actual_count"],
                            "absolute_error": result["absolute_error"],
                            "percentage_error": (
                                f"{result['percentage_error']:.2f}%"
                                if result["percentage_error"] is not None
                                else "N/A"
                            ),
                        }
                    )

            logger.info(f"Results saved to CSV: {filepath}")
        except Exception as e:
            logger.error(f"Error saving CSV: {e}")

    def save_results_json(self, filepath: Path):
        """Save detailed results to JSON file"""
        try:
            filepath.parent.mkdir(parents=True, exist_ok=True)

            data = {
                "metadata": {
                    "dataset": "ShanghaiTech Part B",
                    "model": YOLO_MODEL,
                    "confidence_threshold": CONFIDENCE_THRESHOLD,
                    "sample_size": len(self.results),
                },
                "aggregate_metrics": self.calculate_aggregate_metrics(),
                "per_image_results": self.results,
            }

            with open(filepath, "w") as f:
                json.dump(data, f, indent=2)

            logger.info(f"Detailed results saved to JSON: {filepath}")
        except Exception as e:
            logger.error(f"Error saving JSON: {e}")

    def print_summary(self, output_file: Optional[Path] = None):
        """Print dan save summary ke file"""
        if not self.results:
            logger.warning("No results to summarize")
            return

        metrics = self.calculate_aggregate_metrics()

        summary_lines = [
            "=" * 70,
            "SHANGHAITECH PART B - YOLO11 DETECTION VALIDATION SUMMARY",
            "=" * 70,
            "",
            "CONFIGURATION",
            f"  Model: {YOLO_MODEL}",
            f"  Confidence Threshold: {CONFIDENCE_THRESHOLD}",
            f"  Samples Processed: {metrics.get('total_samples', 0)}",
            "",
            "AGGREGATE ERROR METRICS",
            f"  MAE (Mean Absolute Error): {metrics.get('MAE', 'N/A'):.2f} orang"
            if "MAE" in metrics
            else f"  MAE: N/A",
            f"  MAPE (Mean Absolute Percentage Error): {metrics.get('MAPE', 'N/A'):.2f}%"
            if "MAPE" in metrics
            else f"  MAPE: N/A",
            f"  RMSE (Root Mean Squared Error): {metrics.get('RMSE', 'N/A'):.2f} orang"
            if "RMSE" in metrics
            else f"  RMSE: N/A",
            "",
            "PREDICTION STATISTICS",
            f"  Predicted Count - Mean: {metrics.get('predicted_mean', 'N/A'):.2f}",
            f"  Predicted Count - Std Dev: {metrics.get('predicted_std', 'N/A'):.2f}",
            f"  Actual Count - Mean: {metrics.get('actual_mean', 'N/A'):.2f}",
            f"  Actual Count - Std Dev: {metrics.get('actual_std', 'N/A'):.2f}",
            "",
            "SAMPLE RESULTS (First 10)",
            "-" * 70,
        ]

        # Add sample results
        for idx, result in enumerate(self.results[:10], 1):
            summary_lines.append(
                f"{idx}. {result['image_name']}"
            )
            summary_lines.append(
                f"   Predicted: {result['predicted_count']}, "
                f"Actual: {result['actual_count']}, "
                f"Error: {result['absolute_error']} "
                f"({result['percentage_error']:.2f}%)" if result['percentage_error'] is not None else "N/A"
            )

        summary_lines.extend(
            [
                "",
                "=" * 70,
                "IMPORTANT NOTES",
                "=" * 70,
                "✓ This validation tests DETECTION ACCURACY only (per-image, static).",
                "✓ ShanghaiTech provides no temporal data — cannot validate tracking,",
                "  entered/exited counts, or crowd_status changes over time.",
                "✓ Video validation from Task 01 is STILL REQUIRED for full assessment.",
                "✓ Results here are for confidence_threshold calibration only.",
                "=" * 70,
            ]
        )

        summary_text = "\n".join(summary_lines)

        # Print to console
        print("\n" + summary_text)

        # Save to file if requested
        if output_file:
            try:
                output_file.parent.mkdir(parents=True, exist_ok=True)
                with open(output_file, "w") as f:
                    f.write(summary_text)
                logger.info(f"Summary saved to: {output_file}")
            except Exception as e:
                logger.error(f"Error saving summary: {e}")


def main():
    """Main execution"""
    logger.info("=" * 70)
    logger.info("Task 02: ShanghaiTech Part B Validation")
    logger.info("=" * 70)

    # Check if scipy is available
    try:
        import scipy.io
    except ImportError:
        logger.error("scipy is required but not installed. Run: pip install scipy")
        sys.exit(1)

    # Create validator
    validator = ShanghaiTechValidator()

    # Run validation
    logger.info("")
    logger.info("Starting validation on ShanghaiTech Part B sample...")
    validator.validate_sample()

    # Save results
    logger.info("")
    logger.info("Saving results...")
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    validator.save_results_csv(OUTPUT_CSV)
    validator.save_results_json(OUTPUT_JSON)

    # Print summary
    logger.info("")
    validator.print_summary(OUTPUT_SUMMARY)

    logger.info("")
    logger.info(f"✓ Validation complete!")
    logger.info(f"  Results: {OUTPUT_CSV}")
    logger.info(f"  Detailed: {OUTPUT_JSON}")
    logger.info(f"  Summary: {OUTPUT_SUMMARY}")


if __name__ == "__main__":
    main()
