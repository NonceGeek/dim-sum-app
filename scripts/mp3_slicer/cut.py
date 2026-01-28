#!/usr/bin/env python3
import os, re, hashlib, subprocess, argparse
import srt

WIN_RESERVED = {
    "CON","PRN","AUX","NUL",
    *(f"COM{i}" for i in range(0,10)),
    *(f"LPT{i}" for i in range(0,10)),
}

def to_seconds(td):
    return td.total_seconds()

def sanitize_filename(text: str) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    # Windows 禁止字符：<>:"/\|?*  + 控制字符
    text = re.sub(r'[<>:"/\\\\|?*]', "_", text)
    text = re.sub(r"[\x00-\x1f]", "", text)
    # Windows 不允许结尾是空格或点
    text = text.rstrip(" .")
    if not text:
        text = "EMPTY"
    # Windows 设备保留名（大小写不敏感）
    if text.upper() in WIN_RESERVED:
        text = "_" + text
    return text

def truncate_utf8_bytes(s: str, max_bytes: int) -> str:
    b = s.encode("utf-8")
    if len(b) <= max_bytes:
        return s
    b = b[:max_bytes]
    return b.decode("utf-8", errors="ignore").rstrip(" .")

def unique_name(base: str, used: set, idx: int) -> str:
    if base not in used:
        used.add(base)
        return base
    h = hashlib.sha1(f"{idx}-{base}".encode("utf-8")).hexdigest()[:8]
    name = f"{base}__{idx:06d}_{h}"
    if name not in used:
        used.add(name)
        return name
    k = 2
    while True:
        cand = f"{name}_{k}"
        if cand not in used:
            used.add(cand)
            return cand
        k += 1

def cut_by_srt(mp3_path, srt_path, out_dir="segments", padding=0.05, out_ext="wav",
               max_name_bytes=200, sr=16000):
    # Use SRT filename (without extension) as subdirectory
    srt_basename = os.path.splitext(os.path.basename(srt_path))[0]
    out_dir = os.path.join(out_dir, srt_basename)
    os.makedirs(out_dir, exist_ok=True)

    with open(srt_path, "r", encoding="utf-8-sig") as f:
        subs = list(srt.parse(f.read()))

    used = set()

    for idx, sub in enumerate(subs, 1):
        start = max(0.0, to_seconds(sub.start) - padding)
        end = max(start, to_seconds(sub.end) + padding)

        base = sanitize_filename(sub.content)
        base = truncate_utf8_bytes(base, max_name_bytes)
        base = unique_name(base, used, idx)
        out_path = os.path.join(out_dir, f"{base}.{out_ext}")

        cmd = [
            "ffmpeg", "-y",
            "-ss", f"{start:.3f}",
            "-to", f"{end:.3f}",
            "-i", mp3_path,
            "-vn",
            "-ac", "1", "-ar", str(sr),
            out_path
        ]
        subprocess.run(cmd, check=True)

def main():
    p = argparse.ArgumentParser(
        description="Cut MP3 into sentence-level clips using SRT, naming files by subtitle text."
    )
    p.add_argument("mp3", help="Path to input .mp3 (or other audio file)")
    p.add_argument("srt", help="Path to input .srt subtitle file")
    p.add_argument("-o", "--out-dir", default="segments", help="Output directory (default: segments)")
    p.add_argument("--padding", type=float, default=0.05, help="Seconds to pad before/after each segment (default: 0.05)")
    p.add_argument("--sr", type=int, default=16000, help="Output sample rate (default: 16000)")
    p.add_argument("--ext", default="wav", help="Output audio extension/format (default: wav)")
    p.add_argument("--max-name-bytes", type=int, default=200, help="Max UTF-8 bytes for filename base (default: 200)")
    args = p.parse_args()

    cut_by_srt(
        mp3_path=args.mp3,
        srt_path=args.srt,
        out_dir=args.out_dir,
        padding=args.padding,
        out_ext=args.ext,
        max_name_bytes=args.max_name_bytes,
        sr=args.sr,
    )

if __name__ == "__main__":
    main()