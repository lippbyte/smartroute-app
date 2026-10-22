"""
Mock validation script untuk testing tanpa actual ShanghaiTech dataset
Berguna untuk verify setup sebelum download dataset yang besar (~125MB)
"""

import logging
import json
from pathlib import Path
import csv
from typing import Dict, List
import random

import numpy as np

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


def generate_mock_results(sample_size: int = 15) -> List[Dict]:
    """
    Generate mock detection results untuk testing
    Simulates realistic YOLO11 detections vs ground truth comparison
    """

    results = []

    for idx in range(1, sample_size + 1):
        # Simulate actual count (ground truth) - vary between 5-80
        actual_count = np.random.poisson(lam=35) + 5

        # Simulate predicted count with some error
        # YOLO11 typically has ±10% error
        error_factor = np.random.normal(1.0, 0.08)  # mean 1.0, std 0.08
        predicted_count = max(0, int(actual_count * error_factor))

        # Calculate errors
        abs_error = abs(predicted_count - actual_count)
        pct_error = (abs_error / actual_count) * 100 if actual_count > 0 else 0

        result = {
            "image_name": f"IMG_{idx:03d}.jpg",
            "image_path": f"ShanghaiTech/part_B/test_data/images/IMG_{idx:03d}.jpg",
            "predicted_count": predicted_count,
            "actual_count": actual_count,
            "absolute_error": abs_error,
            "percentage_error": pct_error,
        }

        results.append(result)
        logger.info(
            f"Sample {idx:2d}: Pred={predicted_count:2d}, Actual={actual_count:2d}, "
            f"Error={abs_error:2d} ({pct_error:.2f}%)"
        )

    return results


def calculate_aggregate_metrics(results: List[Dict]) -> Dict:
    """Calculate aggregage error metrics"""

    abs_errors = [r["absolute_error"] for r in results]
    pct_errors = [r["percentage_error"] for r in results]
    predicted_counts = [r["predicted_count"] for r in results]
    actual_counts = [r["actual_count"] for r in results]

    metrics = {
        "MAE": float(np.mean(abs_errors)),
        "MAPE": float(np.mean(pct_errors)),
        "RMSE": float(np.sqrt(np.mean([e ** 2 for e in abs_errors]))),
        "predicted_mean": float(np.mean(predicted_counts)),
        "predicted_std": float(np.std(predicted_counts)),
        "actual_mean": float(np.mean(actual_counts)),
        "actual_std": float(np.std(actual_counts)),
        "total_samples": len(results),
    }

    return metrics


def save_mock_results(results: List[Dict], metrics: Dict):
    """Save mock results untuk reference"""

    output_dir = Path("results")
    output_dir.mkdir(parents=True, exist_ok=True)

    # Save CSV
    csv_file = output_dir / "mock_validation_results.csv"
    with open(csv_file, "w", newline="") as f:
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
        for result in results:
            writer.writerow(
                {
                    "image_name": result["image_name"],
                    "predicted_count": result["predicted_count"],
                    "actual_count": result["actual_count"],
                    "absolute_error": result["absolute_error"],
                    "percentage_error": f"{result['percentage_error']:.2f}%",
                }
            )

    logger.info(f"Mock results saved to: {csv_file}")

    # Save JSON
    json_file = output_dir / "mock_validation_results.json"
    with open(json_file, "w") as f:
        json.dump(
            {
                "metadata": {
                    "dataset": "ShanghaiTech Part B (MOCK DATA)",
                    "model": "yolo11n.pt",
                    "confidence_threshold": 0.5,
                    "sample_size": len(results),
                    "note": "This is mock data for testing setup only",
                },
                "aggregate_metrics": metrics,
                "per_image_results": results,
            },
            f,
            indent=2,
        )

    logger.info(f"Detailed mock results saved to: {json_file}")

    # Print summary
    print("\n" + "=" * 70)
    print("MOCK VALIDATION RESULTS (FOR SETUP TESTING ONLY)")
    print("=" * 70)
    print("")
    print("CONFIGURATION")
    print(f"  Model: yolo11n.pt")
    print(f"  Confidence Threshold: 0.5")
    print(f"  Samples: {metrics['total_samples']}")
    print("")
    print("AGGREGATE METRICS (Mock Data)")
    print(f"  MAE (Mean Absolute Error): {metrics['MAE']:.2f} orang")
    print(f"  MAPE (Mean Absolute Percentage Error): {metrics['MAPE']:.2f}%")
    print(f"  RMSE (Root Mean Squared Error): {metrics['RMSE']:.2f} orang")
    print("")
    print("PREDICTION STATISTICS")
    print(f"  Predicted Count - Mean: {metrics['predicted_mean']:.2f}")
    print(f"  Predicted Count - Std Dev: {metrics['predicted_std']:.2f}")
    print(f"  Actual Count - Mean: {metrics['actual_mean']:.2f}")
    print(f"  Actual Count - Std Dev: {metrics['actual_std']:.2f}")
    print("")
    print("=" * 70)
    print("NOTE: This is MOCK DATA for testing setup only!")
    print("Real validation requires actual ShanghaiTech dataset.")
    print("See DOWNLOAD_SHANGHAITECH.md for instructions.")
    print("=" * 70)


def main():
    """Main execution"""
    logger.info("=" * 70)
    logger.info("Mock Validation (Setup Test)")
    logger.info("=" * 70)
    logger.info("")
    logger.info("Generating mock detection results...")
    logger.info("")

    # Generate mock results
    results = generate_mock_results(sample_size=15)

    # Calculate metrics
    metrics = calculate_aggregate_metrics(results)

    # Save results
    logger.info("")
    save_mock_results(results, metrics)

    logger.info("")
    logger.info("✓ Mock validation complete!")
    logger.info("  Check results/ folder for outputs")
    logger.info("")
    logger.info("Next step: Download actual ShanghaiTech dataset & run real validation")
    logger.info("  See: DOWNLOAD_SHANGHAITECH.md")


if __name__ == "__main__":
    main()
