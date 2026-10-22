"""
Batch test script untuk semua video di sample_videos
"""
import json
import subprocess
import sys
from pathlib import Path
from datetime import datetime

# Videos to test
VIDEOS = [
    "sample_videos/5bdbb24e753306fc180cf00c699773ae.mp4",
    "sample_videos/10287402-sd_540_960_30fps.mp4",
    "sample_videos/12492823_960_540_30fps.mp4",
    "sample_videos/19085074-uhd_2160_3840_60fps.mp4",
    "sample_videos/12752510_3840_2160_60fps.mp4",
    "sample_videos/13827811_3840_2160_30fps.mp4",
    "sample_videos/11724798-uhd_3840_2160_30fps.mp4",
]

RESULTS_FILE = "batch_results.json"

def test_video(video_path: str) -> dict:
    """Test single video and return stats"""
    video_file = Path(video_path)
    if not video_file.exists():
        print(f"SKIP: {video_path} (not found)")
        return None

    print(f"\nTesting: {video_file.name} ({video_file.stat().st_size / 1024 / 1024:.1f} MB)")

    try:
        # Run test without visual output for speed
        # Use venv python
        import sys
        python_exe = sys.executable
        result = subprocess.run(
            [python_exe, "test_video.py", str(video_path)],
            capture_output=True,
            text=True,
            timeout=1800  # 30 min timeout
        )

        if result.returncode != 0:
            print(f"  ERROR: {result.stderr[:200]}")
            return None

        # Parse results
        try:
            results_data = json.load(open("results/full_results.json"))

            # Count tracking stats
            total_frames_with_people = len([f for f in results_data if f['detections']])
            frames_with_ids = len([f for f in results_data if any(d['track_id'] is not None for d in f['detections'])])

            all_track_ids = set()
            for f in results_data:
                for d in f['detections']:
                    if d['track_id'] is not None:
                        all_track_ids.add(d['track_id'])

            person_counts = [len(f['detections']) for f in results_data if f['detections']]

            stats = {
                "video": video_file.name,
                "size_mb": round(video_file.stat().st_size / 1024 / 1024, 1),
                "total_frames": len(results_data),
                "frames_with_people": total_frames_with_people,
                "avg_people": round(sum(person_counts) / len(person_counts), 2) if person_counts else 0,
                "max_people": max(person_counts) if person_counts else 0,
                "track_id_success_rate": round(frames_with_ids * 100 / max(1, total_frames_with_people), 1),
                "unique_track_ids": len(all_track_ids),
                "status": "OK"
            }

            print(f"  ✓ {stats['frames_with_people']} frames, {stats['avg_people']} avg people, {stats['track_id_success_rate']}% track success")
            return stats

        except Exception as e:
            print(f"  ERROR parsing results: {e}")
            return None

    except subprocess.TimeoutExpired:
        print(f"  TIMEOUT (>30min)")
        return None
    except Exception as e:
        print(f"  ERROR: {e}")
        return None

def main():
    print("=" * 60)
    print("BATCH VIDEO TESTING")
    print("=" * 60)

    all_results = []

    for video in VIDEOS:
        stats = test_video(video)
        if stats:
            all_results.append(stats)

    # Save batch results
    with open(RESULTS_FILE, "w") as f:
        json.dump({
            "timestamp": datetime.now().isoformat(),
            "total_videos": len(all_results),
            "results": all_results
        }, f, indent=2)

    # Print summary
    print("\n" + "=" * 60)
    print("BATCH SUMMARY")
    print("=" * 60)
    for stats in all_results:
        print(f"{stats['video']:40} | {stats['frames_with_people']:4} frames | {stats['avg_people']:5.2f} avg | {stats['track_id_success_rate']:5.1f}% track")

    print(f"\nResults saved to: {RESULTS_FILE}")

if __name__ == "__main__":
    main()
