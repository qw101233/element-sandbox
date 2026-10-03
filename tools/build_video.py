# -*- coding: utf-8 -*-
"""元素沙盒 · 视频后期：片头卡 + 分段转码(裁加载/变速/淡入淡出) -> 拼接 -> 烧字幕 -> 混 BGM"""
import subprocess, os, json

FF = r"D:\ffmpeg\bin\ffmpeg.exe"
FP = r"D:\ffmpeg\bin\ffprobe.exe"
ROOT = r"D:\work buddy\ai空间\AI自由创作\element-sandbox"
RAW = os.path.join(ROOT, "video", "raw")
TMP = r"C:\Users\m\AppData\Local\Temp\esvid"     # 无空格路径，避开 subtitles filter 转义坑
TITLE_PNG = os.path.join(ROOT, "screenshots", "title.png")
BGM = os.path.join(ROOT, "tools", "bgm.wav")
FINAL = os.path.join(ROOT, "video", "element-sandbox-demo.mp4")
os.makedirs(TMP, exist_ok=True)

# (源文件, 跳过开头s, 保留时长s, 速度)  —— 跳过开头 = 裁掉页面加载期
SCENES = [
    ("A-concept.webm", 2.8, 13.5, 1.0),
    ("B-tank.webm",    2.8, 15.5, 1.0),
    ("C-desert.webm",  2.8, 25.0, 1.0),
    ("D-volcano.webm", 2.8, 24.0, 1.2),
    ("E-acid.webm",    2.8, 22.0, 1.15),
]

def probe(path):
    out = subprocess.check_output([FP, "-v", "quiet", "-print_format", "json", "-show_format", path])
    return float(json.loads(out)["format"]["duration"])

def run(cmd):
    r = subprocess.run(cmd, capture_output=True)
    if r.returncode != 0:
        raise RuntimeError(r.stderr.decode("utf-8", "ignore")[-2000:])

clips = []

# ---------- 0. 片头卡 ----------
title_clip = os.path.join(TMP, "c_title.mp4")
run([FF, "-y", "-loop", "1", "-t", "4.5", "-i", TITLE_PNG,
     "-vf", "fps=30,scale=1080:1920:flags=lanczos,fade=t=in:st=0:d=0.8,fade=t=out:st=3.7:d=0.8",
     "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", title_clip])
clips.append((title_clip, probe(title_clip)))
print(f"[clip title] {clips[-1][1]:.2f}s", flush=True)

# ---------- 1. 场景分段 ----------
for i, (src, ss, keep, speed) in enumerate(SCENES):
    inp = os.path.join(RAW, src)
    dst = os.path.join(TMP, f"c{i}.mp4")
    dur = min(keep, probe(inp) - ss)
    outdur = dur / speed
    vf = (f"setpts={1/speed:.6f}*PTS,fps=30,"
          f"scale=1080:1920:flags=lanczos,"
          f"fade=t=in:st=0:d=0.4,fade=t=out:st={outdur-0.4:.2f}:d=0.4")
    run([FF, "-y", "-ss", f"{ss}", "-t", f"{dur:.2f}", "-i", inp,
         "-vf", vf, "-an", "-c:v", "libx264", "-preset", "medium",
         "-crf", "20", "-pix_fmt", "yuv420p", dst])
    clips.append((dst, probe(dst)))
    print(f"[clip {i}] {src} -> {clips[-1][1]:.2f}s", flush=True)

# ---------- 2. 拼接 ----------
concat_list = os.path.join(TMP, "list.txt")
with open(concat_list, "w") as f:
    for p, _ in clips:
        f.write(f"file '{p}'\n")
merged = os.path.join(TMP, "merged.mp4")
run([FF, "-y", "-f", "concat", "-safe", "0", "-i", concat_list, "-c", "copy", merged])
print(f"[merged] {probe(merged):.2f}s", flush=True)

# ---------- 3. 字幕（clips[0] 是片头，无字幕；场景字幕时间按变速折算） ----------
SPEEDS = [1.0, 1.0, 1.0, 1.0, 1.2, 1.15]   # 片头 + 5 场景
SRT = {
    1: [(0.5, 4.5, "如果每一粒沙子，都遵守物理定律？"),
        (4.7, 9.3, "11 种元素 · 每个像素都在实时求解"),
        (9.5, 13.2, "没有脚本，没有动画——全是算出来的")],
    2: [(0.5, 5.8, "盐入水即溶——清水变成了盐水"),
        (6.2, 11.2, "再倒点油：密度不同，油永远浮在水上"),
        (11.5, 15.2, "每一层，都是密度在排队")],
    3: [(0.5, 4.8, "沙漠深处，有一座小木屋"),
        (5.0, 10.8, "火苗窜起来的瞬间，失控了"),
        (11.0, 16.8, "浇水——蒸汽腾起，浓烟滚滚"),
        (17.0, 24.5, "火灭了。物理不讲情面，但讲因果")],
    4: [(0.5, 5.0, "火山岛：熔岩溢出山口"),
        (5.3, 10.8, "熔岩入海，蒸汽升腾"),
        (11.0, 15.8, "冷却之后，它变成新的陆地"),
        (16.0, 19.5, "这片海岸，每一帧都在生长")],
    5: [(0.5, 9.3, "故事还没完——酸雨要来了"),
        (10.0, 14.6, "酸雨落下——石头也扛不住"),
        (14.8, 17.3, "腐蚀、冒烟、瓦解"),
        (17.5, 18.9, "元素沙盒 · 单文件，零依赖，打开就玩")],
}
def ts(t):
    h = int(t // 3600); m = int(t % 3600 // 60); s = int(t % 60); ms = int((t % 1) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

srt_path = os.path.join(TMP, "subs.srt")
idx, entries = 1, []
for si, (_, dur) in enumerate(clips):
    if si not in SRT:
        continue
    off = sum(d for _, d in clips[:si])
    sp = SPEEDS[si]
    for a, b, text in SRT[si]:
        a2, b2 = a / sp, b / sp
        if a2 >= dur - 0.2: continue
        entries.append(f"{idx}\n{ts(off + a2)} --> {ts(off + min(b2, dur - 0.1))}\n{text}\n")
        idx += 1
with open(srt_path, "w", encoding="utf-8") as f:
    f.write("\n".join(entries))
print(f"[srt] {idx-1} 条字幕", flush=True)

# ---------- 4. 烧字幕 + 混 BGM ----------
# 字幕放在画布下方、控制面板上方。注意：libass 按 PlayResY=288 缩放 MarginV，
# 真实像素 = MarginV/288*1920。64 ≈ 距底 427px（面板高约 380px）
style = ("FontName=Microsoft YaHei,FontSize=14,PrimaryColour=&H00FFFFFF,"
         "OutlineColour=&HC0000000,BorderStyle=1,Outline=2,Shadow=0,MarginV=64")
srt_ff = srt_path.replace("\\", "/").replace(":", "\\:")
run([FF, "-y", "-i", merged, "-i", BGM,
     "-vf", f"subtitles='{srt_ff}':force_style='{style}'",
     "-map", "0:v", "-map", "1:a",
     "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
     "-c:a", "aac", "-b:a", "128k", "-shortest", FINAL])
dur = probe(FINAL)
size = os.path.getsize(FINAL) / 1024 / 1024
print(f"[final] {FINAL}  {dur:.2f}s  {size:.1f}MB", flush=True)
print("DONE")
