from datasets import load_dataset, Audio
from pathlib import Path
import shutil

repo_id = "alvanlii/cantonese-radio"
split = "train"
audio_col = "audio"  # 你的音频列名，可能叫 "audio" / "speech" 等
idx = 2 # 你要下载的那条样本索引

# Use streaming=True to avoid downloading all parquet files upfront
# This only downloads the data you actually access
ds = load_dataset(repo_id, split=split, streaming=True)
ds = ds.cast_column(audio_col, Audio(decode=False))  # 返回 {"path":..., "bytes":...}

# Iterate through the streaming dataset to reach the desired index
# Only downloads the parquet files needed to reach this index
ds_iter = iter(ds)
for i in range(idx + 1):
    item = next(ds_iter)
    if i == idx:
        a = item[audio_col]
        break

out_dir = Path("out_audio")
out_dir.mkdir(exist_ok=True)

src_path = a.get("path") or f"{idx}.audio"
suffix = Path(src_path).suffix if src_path else ".bin"
out_path = out_dir / f"{idx}{suffix}"

if a.get("bytes") is not None:
    out_path.write_bytes(a["bytes"])   # 直接落盘为原始音频文件（wav/flac/mp3/opus…）
else:
    # bytes=None 说明音频是外部文件，datasets 已把它下载到本地缓存，path 指向缓存文件
    shutil.copy(src_path, out_path)

print("saved:", out_path)
