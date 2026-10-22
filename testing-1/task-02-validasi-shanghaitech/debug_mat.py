"""Debug .mat file structure"""
import scipy.io as sio
import numpy as np

gt_file = 'ShanghaiTech/ShanghaiTech/part_B/test_data/ground-truth/GT_IMG_1.mat'
mat = sio.loadmat(gt_file)

print("Keys in .mat file:")
for key in mat.keys():
    if not key.startswith('__'):
        obj = mat[key]
        shape = obj.shape if hasattr(obj, 'shape') else 'N/A'
        print(f"  {key}: {type(obj).__name__} shape={shape}")

print("\nimage_info structure:")
info = mat['image_info']
print(f"  Type: {type(info)}")
print(f"  Shape: {info.shape}")
print(f"  Dtype: {info.dtype}")

if info.dtype.names:
    print(f"  Fields: {info.dtype.names}")
    print("\n  Field details:")
    for field in info.dtype.names:
        val = info[0, 0][field]
        print(f"    {field}:")
        print(f"      shape={val.shape}, dtype={val.dtype}")
        if val.size < 50:
            print(f"      value={val}")
        else:
            print(f"      value (first 5)={val.flatten()[:5]}")

# Try to extract count
print("\n\nAttempting to extract count:")
try:
    if 'number' in info.dtype.names:
        num = info[0, 0]['number'][0, 0]
        print(f"  From 'number' field: {num}")
except:
    print("  'number' field not found or error")

try:
    if 'location' in info.dtype.names:
        loc = info[0, 0]['location'][0, 0]
        print(f"  From 'location' field shape: {loc.shape} (count would be {len(loc)})")
except:
    print("  'location' field not found or error")
