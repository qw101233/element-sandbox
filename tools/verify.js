/* 元素沙盒 · 基础运行验证：加载 -> 物理断言 -> 截图 */
const { chromium } = require("playwright");

const URL = "file:///" + encodeURI("D:/work buddy/ai空间/AI自由创作/element-sandbox/index.html").replace(/^\//, "");
const SHOT = "D:/work buddy/ai空间/AI自由创作/element-sandbox/screenshots";

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  const errors = [];
  page.on("pageerror", e => errors.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text()); });

  await page.goto(URL);
  await page.waitForTimeout(1500);

  const S = expr => page.evaluate(expr);
  let pass = 0, fail = 0;
  const check = (name, ok, info = "") => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${info ? "  (" + info + ")" : ""}`);
    ok ? pass++ : fail++;
  };

  const dims = await S("SANDBOX.dims()");
  check("网格已建立", dims[0] > 100 && dims[1] > 100, `W=${dims[0]} H=${dims[1]}`);

  /* 1. 沙子下落并堆积 */
  await S("SANDBOX.paint(SANDBOX.dims()[0]>>1, 10, SANDBOX.E.SAND, 8)");
  await S("SANDBOX.step(120)");
  const sandTop = await S("SANDBOX.count(SANDBOX.E.SAND)");
  check("沙子注入并可计数", sandTop > 150, `sand=${sandTop}`);
  const sandBottom = await page.evaluate(() => {
    const [W, H] = SANDBOX.dims();
    SANDBOX.paint(W >> 1, H - 6, SANDBOX.E.SAND, 4);   // 底部参照
    SANDBOX.step(5);
    return SANDBOX.count(SANDBOX.E.SAND);
  });
  check("沙子 120 帧后仍在网格中（未丢失）", sandBottom > sandTop, `before=${sandTop} after=${sandBottom}`);

  /* 2. 水下落 + 水平扩散 */
  await S("SANDBOX.preset('blank')");
  await S("SANDBOX.paint(SANDBOX.dims()[0]>>1, 10, SANDBOX.E.WATER, 10)");
  await S("SANDBOX.step(150)");
  const waterCnt = await S("SANDBOX.count(SANDBOX.E.WATER)");
  check("水注入并流动", waterCnt > 180, `water=${waterCnt}`);

  /* 3. 火烧木头 -> 木头减少，可能产生烟 */
  await S("SANDBOX.preset('blank')");
  await page.evaluate(() => {
    const [W, H] = SANDBOX.dims();
    for (let y = H >> 1; y < (H >> 1) + 30; y++) for (let x = W >> 1; x < (W >> 1) + 8; x++) SANDBOX.paint(x, y, SANDBOX.E.WOOD, 0);
    SANDBOX.paint((W >> 1) + 4, (H >> 1) - 3, SANDBOX.E.FIRE, 3);
  });
  const wood0 = await S("SANDBOX.count(SANDBOX.E.WOOD)");
  await S("SANDBOX.step(600)");   // 木头设计为慢燃（每格 6-8s），给足蔓延时间
  const wood1 = await S("SANDBOX.count(SANDBOX.E.WOOD)");
  check("火蔓延烧掉木头", wood1 < wood0, `wood ${wood0} -> ${wood1}`);

  /* 4. 熔岩遇水 -> 生成石头/蒸汽 */
  await S("SANDBOX.preset('volcano')");
  await S("SANDBOX.step(400)");
  const counts = await S("SANDBOX.countAll()");
  const stone = counts[7] || 0, steam = counts[8] || 0;   // 7=STONE 8=STEAM
  check("火山岛：熔岩入海生成石头/蒸汽", stone > 0 && steam >= 0, `stone=${stone} steam=${steam}`);
  await page.screenshot({ path: SHOT + "/verify-volcano.png" });

  /* 5. 酸蚀石头 */
  await S("SANDBOX.preset('blank')");
  await page.evaluate(() => {
    const [W, H] = SANDBOX.dims();
    for (let x = 0; x < W; x++) for (let y = H - 8; y < H; y++) SANDBOX.paint(x, y, SANDBOX.E.STONE, 0);
    SANDBOX.paint(W >> 1, H - 20, SANDBOX.E.ACID, 8);
  });
  const stone0 = await S("SANDBOX.count(SANDBOX.E.STONE)");
  await S("SANDBOX.step(400)");
  const stone1 = await S("SANDBOX.count(SANDBOX.E.STONE)");
  check("酸液腐蚀石头", stone1 < stone0, `stone ${stone0} -> ${stone1}`);

  /* 6. 运行帧率（非暂停状态跑 2 秒） */
  await S("SANDBOX.preset('volcano')");
  await S("SANDBOX.setPaused(false)");
  await page.waitForTimeout(2000);
  const fps = await S("SANDBOX.fps()");
  check("实时帧率 ≥ 30", fps >= 30, `fps=${fps}`);
  await page.screenshot({ path: SHOT + "/verify-live.png" });

  check("无 JS 报错", errors.length === 0, errors.join(" | ").slice(0, 200));

  await browser.close();
  console.log(`\n== ${pass} 通过 / ${fail} 失败 ==`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
