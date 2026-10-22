"""
Analyze validation results dan suggest calibration based on manual vs model comparison
"""

import json
import sys
from pathlib import Path
from typing import Dict, List, Tuple
import statistics

def load_results(json_path: str) -> Dict:
    """Load model results from JSON file"""
    with open(json_path, 'r') as f:
        return json.load(f)

def get_count_at_frame(results: List[Dict], frame_id: int) -> int:
    """Get passenger count at specific frame ID"""
    for result in results:
        if result['frame']['frame_id'] == frame_id:
            return result['passenger_count']['current']
    return None

def get_crowd_level_at_frame(results: List[Dict], frame_id: int) -> str:
    """Get crowd level at specific frame ID"""
    for result in results:
        if result['frame']['frame_id'] == frame_id:
            return result['crowd_status']['level']
    return None

def analyze_detection_accuracy(manual_checks: List[Tuple[int, int]]) -> Dict:
    """
    Analyze detection accuracy from manual vs model comparison

    Args:
        manual_checks: List of (frame_id, manual_count) tuples
        results: Model results from full_results.json

    Returns:
        Dictionary with accuracy metrics
    """
    return {
        "total_checks": len(manual_checks),
        "checks": manual_checks
    }

def interactive_analysis():
    """Interactive analysis of validation results"""
    print("="*70)
    print("VALIDATION ANALYSIS TOOL")
    print("="*70)
    print()

    # Ask for paths
    results_path = input("Path to full_results.json: ").strip()

    try:
        results = load_results(results_path)['per_image_results'] if 'per_image_results' in load_results(results_path) else load_results(results_path)
    except FileNotFoundError:
        print(f"Error: File not found: {results_path}")
        return
    except json.JSONDecodeError:
        print(f"Error: Invalid JSON file: {results_path}")
        return

    print(f"✓ Loaded {len(results)} frame results")
    print()

    # Manual checks
    print("Enter manual validation data")
    print("Format: frame_id manual_count")
    print("(or just press Enter when done)")
    print()

    manual_checks = []
    while True:
        try:
            user_input = input(f"Manual check #{len(manual_checks)+1}: ").strip()
            if not user_input:
                break

            parts = user_input.split()
            if len(parts) != 2:
                print("Invalid format. Please enter: frame_id manual_count")
                continue

            frame_id = int(parts[0])
            manual_count = int(parts[1])

            # Get model prediction for this frame
            model_count = get_count_at_frame(results, frame_id)
            if model_count is None:
                print(f"  Warning: Frame {frame_id} not found in results")
                continue

            manual_checks.append({
                "frame_id": frame_id,
                "manual_count": manual_count,
                "model_count": model_count,
                "absolute_error": abs(manual_count - model_count),
                "percentage_error": (abs(manual_count - model_count) / manual_count * 100) if manual_count > 0 else 0
            })

            print(f"  ✓ Manual: {manual_count}, Model: {model_count}, Error: {abs(manual_count - model_count)} ({(abs(manual_count - model_count) / manual_count * 100):.1f}%)")

        except ValueError:
            print("Invalid input. Please enter numbers.")
            continue

    if not manual_checks:
        print("No manual checks entered. Exiting.")
        return

    print()
    print("="*70)
    print("ACCURACY ANALYSIS")
    print("="*70)
    print()

    # Analyze accuracy
    abs_errors = [c["absolute_error"] for c in manual_checks]
    pct_errors = [c["percentage_error"] for c in manual_checks]

    print(f"Total manual checks: {len(manual_checks)}")
    print(f"Average absolute error: {statistics.mean(abs_errors):.2f} orang")
    print(f"Average percentage error: {statistics.mean(pct_errors):.2f}%")
    print(f"Min error: {min(pct_errors):.2f}%")
    print(f"Max error: {max(pct_errors):.2f}%")
    print(f"Median error: {statistics.median(pct_errors):.2f}%")

    # Assessment
    print()
    avg_pct = statistics.mean(pct_errors)
    if avg_pct < 10:
        print("✓ Assessment: EXCELLENT (error <10%)")
    elif avg_pct < 20:
        print("✓ Assessment: GOOD (error 10-20%)")
    elif avg_pct < 50:
        print("✓ Assessment: ACCEPTABLE (error 20-50%)")
    else:
        print("⚠ Assessment: NEEDS ATTENTION (error >50%)")

    print()
    print("Per-check breakdown:")
    print("-"*70)
    for check in manual_checks:
        print(f"Frame {check['frame_id']:4d}: Manual={check['manual_count']:3d}, "
              f"Model={check['model_count']:3d}, "
              f"Error={check['absolute_error']:3d} ({check['percentage_error']:6.2f}%)")

    # Crowd level analysis
    print()
    print("="*70)
    print("CROWD LEVEL MAPPING")
    print("="*70)
    print()

    # Group by crowd level
    levels = {}
    for check in manual_checks:
        level = get_crowd_level_at_frame(results, check['frame_id']) if hasattr(results[0], '__getitem__') else None
        if level not in levels:
            levels[level] = []
        levels[level].append(check['manual_count'])

    print("Observed crowd levels vs person count:")
    for level in sorted(levels.keys()):
        counts = levels[level]
        min_count = min(counts)
        max_count = max(counts)
        avg_count = statistics.mean(counts)
        print(f"  {level:8s}: {min_count:3d} - {max_count:3d} orang (avg: {avg_count:5.1f})")

    print()
    print("="*70)
    print("CALIBRATION RECOMMENDATIONS")
    print("="*70)
    print()

    # Suggest thresholds
    if levels:
        all_counts = []
        for counts in levels.values():
            all_counts.extend(counts)

        all_counts.sort()
        print(f"Based on observed densities (n={len(all_counts)} checks):")
        print()

        # Suggest simple thresholds
        low_threshold = int(all_counts[len(all_counts)//3])
        mid_threshold = int(all_counts[2*len(all_counts)//3])

        print(f"Current thresholds (from config.py):")
        print(f"  rendah: 0-10")
        print(f"  sedang: 10-25")
        print(f"  tinggi: 25+")
        print()
        print(f"Suggested update based on data:")
        print(f"  rendah: 0-{low_threshold}")
        print(f"  sedang: {low_threshold}-{mid_threshold}")
        print(f"  tinggi: {mid_threshold}+")
        print()
        print("To apply: Edit config.py CROWD_DENSITY_THRESHOLDS")

    # Save report
    save_report = input("\nSave detailed report to file? (y/n): ").strip().lower()
    if save_report == 'y':
        report_path = input("Report filename (default: validation_analysis.txt): ").strip()
        if not report_path:
            report_path = "validation_analysis.txt"

        with open(report_path, 'w') as f:
            f.write("VALIDATION ANALYSIS REPORT\n")
            f.write("="*70 + "\n\n")
            f.write(f"Total checks: {len(manual_checks)}\n")
            f.write(f"Average error: {statistics.mean(pct_errors):.2f}%\n")
            f.write(f"Assessment: {'EXCELLENT' if statistics.mean(pct_errors) < 10 else 'GOOD' if statistics.mean(pct_errors) < 20 else 'ACCEPTABLE' if statistics.mean(pct_errors) < 50 else 'NEEDS ATTENTION'}\n\n")

            f.write("Per-check results:\n")
            for check in manual_checks:
                f.write(f"Frame {check['frame_id']}: Manual={check['manual_count']}, "
                       f"Model={check['model_count']}, Error={check['percentage_error']:.2f}%\n")

        print(f"✓ Report saved to {report_path}")

if __name__ == "__main__":
    interactive_analysis()
