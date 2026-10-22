"""
Generate visual output (videos with bounding boxes) untuk semua videos
"""
import subprocess
import sys
from pathlib import Path

VIDEOS = [
    "sample_videos/5bdbb24e753306fc180cf00c699773ae.mp4",
    "sample_videos/10287402-sd_540_960_30fps.mp4",
    "sample_videos/12492823_960_540_30fps.mp4",
    "sample_videos/19085074-uhd_2160_3840_60fps.mp4",
    "sample_videos/12752510_3840_2160_60fps.mp4",
    "sample_videos/13827811_3840_2160_30fps.mp4",
    "sample_videos/11724798-uhd_3840_2160_30fps.mp4",
]

def generate_visual(video_path: str) -> bool:
    """Generate visual output untuk single video"""
    video_file = Path(video_path)
    if not video_file.exists():
        print(f"SKIP: {video_path}")
        return False

    size_mb = video_file.stat().st_size / 1024 / 1024
    print(f"\nGenerating visual: {video_file.name} ({size_mb:.1f} MB)")

    try:
        import sys
        python_exe = sys.executable
        result = subprocess.run(
            [python_exe, "test_video.py", str(video_path), "--save-visual"],
            capture_output=True,
            text=True,
            timeout=1800
        )

        if result.returncode == 0:
            print(f"  ✓ Visual output generated")
            return True
        else:
            print(f"  ERROR: {result.stderr[:200]}")
            return False

    except subprocess.TimeoutExpired:
        print(f"  TIMEOUT")
        return False
    except Exception as e:
        print(f"  ERROR: {e}")
        return False

def main():
    print("=" * 60)
    print("GENERATING VISUAL OUTPUT FOR ALL VIDEOS")
    print("=" * 60)

    success = 0
    failed = 0

    for video in VIDEOS:
        if generate_visual(video):
            success += 1
        else:
            failed += 1

    print("\n" + "=" * 60)
    print(f"DONE: {success} success, {failed} failed")
    print("=" * 60)

if __name__ == "__main__":
    main()
