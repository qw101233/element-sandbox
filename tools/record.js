/* 元素沙盒 · 演示视频录制：5 个场景 -> video/raw/*.webm */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const URL = "file:///" + encodeURI("D:/work buddy/ai空间/AI自由创作/element-sandbox/index.html").replace(/^\//, "");
const OUT = "D:/work buddy/ai空间/AI自由创作/element-sandbox/video/raw";
fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) if (f.endsWith(".webm")) fs.unlinkSync(OUT + "/" + f);

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function newScene(browser) {
  const ctx = await browser.newContext({
    viewport: { width: 1080, height: 1920 },
    recordVideo: { dir: OUT, size: { width: 1080, height: 1920 } },
  });
  const page = await ctx.newPage();
  page.on("pageerror", e => console.error("PAGEERROR:", e.message));
  await page.goto(URL);
  await page.waitForTimeout(2500);
  return { ctx, page };
}
async function closeScene(s) {
  await s.page.waitForTimeout(300);
  await s.ctx.close();
}

/* 网格坐标 -> 页面坐标 */
async function c2p(page, gx, gy) {
  return page.evaluate(([gx, gy]) => {
    const r = document.getElementById("cv").getBoundingClientRect();
    const [W, H] = SANDBOX.dims();
    return [r.left + gx / W * r.width, r.top + gy / H * r.height];
  }, [gx, gy]);
}
/* 按住笔刷沿路径拖动 */
async function dragPath(page, pts, stepMs = 28) {
  const [x0, y0] = await c2p(page, pts[0][0], pts[0][1]);
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  for (let i = 1; i < pts.length; i++) {
    const [px, py] = await c2p(page, pts[i][0], pts[i][1]);
    await page.mouse.move(px, py);
    await sleep(stepMs);
  }
  await page.mouse.up();
}
const chip = async (page, e) => page.click(`.chip[data-e="${e}"]`);
const preset = async (page, p) => page.click(`.preset[data-p="${p}"]`);

(async () => {
  const browser = await chromium.launch();
  const T0 = Date.now();

  /* ---------- 场景 A：概念 —— 手撒沙与水 ---------- */
  let s = await newScene(browser);
  let dims = await s.page.evaluate(() => SANDBOX.dims());
  let [W, H] = dims;
  // 沙：两条 S 形弧线（压低位置，落地快、不悬空）
  const arc1 = [], arc2 = [];
  for (let x = W * 0.12; x <= W * 0.88; x += 3) {
    arc1.push([x, H * 0.52 + Math.sin(x * 0.09) * H * 0.02]);
    arc2.push([W - x, H * 0.62 + Math.sin(x * 0.07 + 1) * H * 0.02]);
  }
  await dragPath(s.page, arc1);
  await dragPath(s.page, arc2);
  await sleep(2500);
  // 水：中部横线，落在沙丘上汇聚
  await chip(s.page, 3);
  const wl = [];
  for (let x = W * 0.15; x <= W * 0.85; x += 4) wl.push([x, H * 0.30]);
  await dragPath(s.page, wl);
  await sleep(5500);
  await closeScene(s);

  /* ---------- 场景 B：水族箱 —— 盐溶 · 油浮 ---------- */
  s = await newScene(browser);
  await preset(s.page, "tank");
  await sleep(7000);                       // 盐堆在水中溶解
  await chip(s.page, 4);                   // 油
  [W, H] = await s.page.evaluate(() => SANDBOX.dims());
  const oil = [];
  for (let x = W * 0.16; x <= W * 0.84; x += 4) oil.push([x, H * 0.40]);
  await dragPath(s.page, oil);
  await sleep(8000);                       // 油穿过空气落在水面、浮起
  await closeScene(s);

  /* ---------- 场景 C：沙漠油田 —— 火烧木屋 · 浇水灭火 ---------- */
  s = await newScene(browser);
  await preset(s.page, "desert");
  await sleep(2500);
  [W, H] = await s.page.evaluate(() => SANDBOX.dims());
  await chip(s.page, 5);                   // 火
  // 精确对准小木屋屋顶（与 index.html 预设同款公式）：火会上升，必须直接画在木屋上
  const fbx = (W * 0.2) | 0;
  const surf = sx => (H * 0.72 + Math.sin(sx * 0.09) * H * 0.03 + Math.sin(sx * 0.023 + 2) * H * 0.05) | 0;
  const fby = Math.max(surf(fbx), surf(fbx + 22), surf(fbx + 44));
  // API 精确点火：屋顶右侧一个小着火点（半径 2），让火自己蔓延。
  // （鼠标拖动的笔刷半径是 6，一点下去就是几百个火细胞，屋子会瞬间烧没）
  await s.page.evaluate(([x, y]) => SANDBOX.paint(x, y, SANDBOX.E.FIRE, 2), [fbx + 34, fby - 35]);
  await sleep(15000);                      // 火势沿屋顶与墙体蔓延
  await chip(s.page, 3);                   // 水
  const rain = [];
  for (let x = W * 0.06; x <= W * 0.5; x += 5) rain.push([x, H * 0.10 + (x % 13)]);
  await dragPath(s.page, rain);
  await sleep(8000);                       // 蒸汽腾起，火灭
  await closeScene(s);

  /* ---------- 场景 D：火山岛 —— 熔岩入海 ---------- */
  s = await newScene(browser);
  await preset(s.page, "volcano");
  await sleep(27000);                      // 熔岩自行溢出、入海、成石
  await closeScene(s);

  /* ---------- 场景 E：酸雨蚀岩 + 终曲 ---------- */
  s = await newScene(browser);
  await preset(s.page, "volcano");
  await sleep(12000);                      // 先让熔岩开始流动
  [W, H] = await s.page.evaluate(() => SANDBOX.dims());
  await chip(s.page, 11);                  // 酸
  const acid = [];
  for (let x = W * 0.2; x <= W * 0.8; x += 3) acid.push([x, H * 0.08 + Math.sin(x * 0.11) * H * 0.015]);
  await dragPath(s.page, acid, 22);
  await sleep(9000);                       // 酸雨落山，岩石消融
  await closeScene(s);

  await browser.close();

  /* 改名：按落盘时间对应场景顺序 */
  const files = fs.readdirSync(OUT).filter(f => f.endsWith(".webm")).map(f => ({
    f, t: fs.statSync(path.join(OUT, f)).mtimeMs,
  })).sort((a, b) => a.t - b.t);
  const names = ["A-concept", "B-tank", "C-desert", "D-volcano", "E-acid"];
  files.forEach((x, i) => {
    if (i < names.length) {
      fs.renameSync(path.join(OUT, x.f), path.join(OUT, names[i] + ".webm"));
      console.log("saved:", names[i]);
    }
  });
  console.log("total time:", ((Date.now() - T0) / 1000).toFixed(0) + "s");
})().catch(e => { console.error(e); process.exit(1); });
