# PROJECT.md — 元素沙盒（Element Sandbox）

> 供 AI 助手快速判重与接手使用。读完本文件即可判断这是什么项目、做到哪了，无需通读代码。
> **判重要点：本项目是「落沙/元胞自动机物理沙盒」。与工作区内 `particle-life/`（粒子生命，连续空间吸引-排斥模拟）是完全独立的两个项目，互不引用、互不继承。**

## 项目名称
元素沙盒（Element Sandbox）—— GitHub 仓库名 `element-sandbox`

## 需求概述
来自飞哥 2026-10-03 的「自由创作」任务：
1. 自主选题并完整实现一个可运行、可演示的项目；
2. 制作 9:16 竖屏介绍视频（1–3 分钟，含项目简介 / 核心功能演示 / 最终效果，画面与字幕清晰）；
3. 全部产物（代码 + 视频 + 资源）推送到其 GitHub 新建公开仓库，附完善 README。

## 核心功能
- 像素级落沙物理模拟（元胞自动机），11 种可绘制元素 + 3 种反应副产物：
  沙 / 水 / 油 / 火 / 木头 / 石头 / 熔岩 / 酸液 / 盐 / 墙 / 橡皮；副产物：蒸汽 / 烟 / 盐水
- 元素反应：火蔓延烧木与油、水灭火产蒸汽、熔岩遇水成石 + 蒸汽、盐溶于水成盐水、盐水受热析盐、酸液腐蚀沙/木/石、油浮于水面（密度分层）
- 笔刷绘制（可调半径、快速划动插值）、暂停 / 单步 / 清空
- 3 个预设场景：火山岛、沙漠油田、水族箱
- HUD 实时显示 FPS 与细胞数；桌面端键盘快捷键（空格暂停，数字键换元素）
- `window.SANDBOX` 调试 API（注入 / 计数 / 步进），供自动化验证与录制脚本调用

## 技术选型
- **本体**：单文件 `index.html`，原生 Canvas 2D + TypedArray，零依赖、无构建步骤
- **验证 / 录制**：Playwright（Node，managed runtime，`NODE_PATH=C:\Users\m\.workbuddy\binaries\node\workspace\node_modules`）
- **视频后期**：ffmpeg（`D:\ffmpeg\bin`）转码 / 拼接 / 烧字幕（libass，Microsoft YaHei）
- **BGM**：numpy 合成环境音乐（managed python venv：`C:\Users\m\.workbuddy\binaries\python\envs\default`）

## 目录结构
```
element-sandbox/
├─ index.html            # 游戏本体（单文件，双击即玩）
├─ PROJECT.md            # 本文件
├─ README.md             # GitHub 用说明（背景/功能/运行/结构/展示）
├─ .gitignore            # 排除 video/raw 等大文件
├─ tools/
│  ├─ verify.js          # 9 项自动化验证（物理断言 + FPS + 截图）
│  ├─ record.js          # 5 场景演示录制（输出 video/raw/*.webm）
│  ├─ title.html         # 片头卡（截图后作视频第 1 段）
│  ├─ make_bgm.py        # BGM 合成（bgm.wav）
│  └─ build_video.py     # 视频组装管线（转码→拼接→字幕→混音）
├─ screenshots/          # 验证截图、片头卡、README 演示图
└─ video/
   ├─ element-sandbox-demo.mp4   # 最终竖屏视频（1080x1920，约 100s）
   └─ raw/               # 原始录制（不入库）
```

## 运行与验证
- 玩：直接双击 `index.html`（或任意静态服务器）
- 验证：`cd tools && node verify.js`（需上述 NODE_PATH）——9 项断言全过即正常
- 重建视频：先 `node record.js`，再 `python make_bgm.py` + `python build_video.py`

## 当前进度（2026-10-03）
- [x] 游戏本体完成，9/9 自动化验证通过，1080x1920 下 60 FPS
- [x] 5 场景录制完成（A 概念 / B 水族箱 / C 沙漠火 / D 火山 / E 酸雨）
- [x] 视频组装管线（片头 + 字幕 + BGM）
- [x] 最终视频质检通过（8 轮迭代：修字幕 MarginV 缩放、撒沙构图、酸雨字幕时轴、火焰节奏与附着性）
- [x] README + GitHub 推送完成：https://github.com/qw101233/element-sandbox
- **项目已交付。** 后续迭代只需改 index.html 后重跑 verify.js；改演示则改 record.js 后重跑录制+build_video.py

## 录制/调参血泪教训（改动前必读）
- libass 的 MarginV 按 PlayResY=288 缩放：真实像素 = MarginV/288*1920，写真实像素会把字幕推出画面外
- 火会上升：点火必须直接画在可燃物上，画在半空只会放烟花
- 笔刷半径是全局 UI 状态：脚本点火用 `SANDBOX.paint(x,y,E.FIRE,2)`，别用鼠标拖（半径 6 一碰就是几百个火细胞）
- 木头燃烧寿命（现 380-500 帧）必须 > 蔓延全屋时间，否则房子被"吃掉"而不是"处于火海"
- 火焰上移概率要低（现 0.12），高了整片火会飘走变成浮空余烬云
