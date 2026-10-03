# -*- coding: utf-8 -*-
"""元素沙盒 · BGM 合成：环境音垫 + 五声音阶点缀 + 开头气声，输出 bgm.wav"""
import numpy as np
import wave, os

SR = 44100
DUR = 150.0
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "bgm.wav")

t = np.arange(int(SR * DUR)) / SR

def adsr(n, a, d, s, r, sl=0.6):
    env = np.ones(n)
    na, nd, nr = int(a * SR), int(d * SR), int(r * SR)
    na = min(na, n); nd = min(nd, n - na); nr = min(nr, n - na - nd)
    env[:na] = np.linspace(0, 1, na)
    env[na:na + nd] = np.linspace(1, sl, nd)
    env[na + nd:n - nr] = sl
    env[n - nr:] = np.linspace(sl, 0, nr)
    return env

mix = np.zeros_like(t)

# --- 底垫：Am9 (A1 A2 C3 E3 B3) 缓慢呼吸 ---
pad_notes = [55.0, 110.0, 130.81, 164.81, 246.94]
for i, f in enumerate(pad_notes):
    lfo = 0.5 + 0.5 * np.sin(2 * np.pi * (0.05 + i * 0.013) * t + i)
    mix += 0.05 * np.sin(2 * np.pi * f * t + i * 0.7) * (0.4 + 0.6 * lfo)
# 轻微失谐加厚
mix += 0.02 * np.sin(2 * np.pi * 110.5 * t) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.07 * t + 1))

# --- 点缀：A 小调五声随机落点 ---
penta = [220.0, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25]
rng = np.random.default_rng(7)
for st in np.arange(6, DUR - 4, 3.7):
    if rng.random() < 0.35:
        continue
    f = penta[rng.integers(0, len(penta))]
    n = int(1.6 * SR)
    tt = np.arange(n) / SR
    seg = 0.055 * np.sin(2 * np.pi * f * tt) * np.exp(-2.8 * tt)
    i0 = int(st * SR)
    mix[i0:i0 + n] += seg

# --- 开头 4s 气声渐入（片头卡用） ---
n0 = int(4.5 * SR)
noise = rng.standard_normal(n0)
noise = np.convolve(noise, np.ones(400) / 400, mode="same")   # 粗略低通
mix[:n0] += noise * adsr(n0, 2.0, 1.0, 0.0, 1.5, 0.0) * 0.5

# 整体淡入淡出 + 归一
mix *= adsr(len(mix), 1.2, 0.5, 0.0, 4.0, 0.9)
mix /= max(1e-9, np.abs(mix).max())
mix *= 0.82

stereo = np.stack([mix, np.roll(mix, int(0.011 * SR))], axis=1)   # 微延迟出宽度
pcm = (stereo * 32767).astype(np.int16)
with wave.open(OUT, "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print("bgm:", OUT, f"{DUR:.0f}s")
