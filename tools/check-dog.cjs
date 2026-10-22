// 3D 互动回归:先 npm start,再 node tools/check-dog.cjs [http://localhost:3000/dog.html]
// 与 snapshot-dog.cjs 共用 playwright;无显卡时只推进逻辑,不连续渲染。
// 可用 BROWSER_PATH 指定本机 Chrome,否则使用 Playwright 的 Chromium。
'use strict';

const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const url = process.argv[2] || 'http://localhost:3000/dog.html';
const browserOptions = {
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  ...(process.env.BROWSER_PATH ? { executablePath: process.env.BROWSER_PATH } : {}),
};

async function openDog(browser, { fresh = false, mobile = false } = {}) {
  const context = await browser.newContext({
    viewport: mobile ? { width: 320, height: 568 } : { width: 900, height: 700 },
    isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1,
  });
  await context.addInitScript(({ fresh }) => {
    // 此脚本会在刷新时再次运行,测试存档只在不存在时创建。
    if (!fresh && !localStorage.getItem('cloud-pet:dog3d')) {
      const n = Date.now();
      localStorage.setItem('cloud-pet:dog3d', JSON.stringify({
        name: '回归测试', species: 'dog', bornAt: n, hatchedAt: n, updatedAt: n,
        xp: 500, stats: { hunger: 60, happy: 60, clean: 40, energy: 65 },
      }));
    }
    localStorage.setItem('cloud-pet:v2', 'Q版存档保持原样');
    const raf = window.requestAnimationFrame.bind(window);
    const caf = window.cancelAnimationFrame.bind(window);
    window.requestAnimationFrame = () => 0;
    window.cancelAnimationFrame = () => {};
    const timer = setInterval(() => {
      if (!window.__three) return;
      window.__three.renderer.setAnimationLoop(null);
      window.requestAnimationFrame = raf;
      window.cancelAnimationFrame = caf;
      clearInterval(timer);
      let prev = performance.now();
      window.__checkTick = setInterval(() => {
        const now = performance.now();
        window.__api.step(Math.min(0.05, (now - prev) / 1000), now / 1000);
        window.__three.controls.update();
        window.__three.scene.updateMatrixWorld(true);
        prev = now;
      }, 16);
    }, 1);
  }, { fresh });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url);
  await page.waitForFunction(() => window.__api);
  return { page, context, errors };
}

const idle = (page) => page.waitForFunction(() => !__api.task && !__api.move, null, { timeout: 25000, polling: 20 });
const foamCount = (page) => page.evaluate(() => Object.values(__dog.bones)
  .reduce((n, b) => n + b.children.filter((c) => c.isMesh && c.material?.opacity === 0.92).length, 0));
const ballInfo = (page) => page.evaluate(() => {
  let ball;
  __three.scene.traverse((o) => { if (o.geometry?.parameters?.radius === 0.036) ball = o; });
  return { attached: ball.parent.isBone === true, y: ball.position.y };
});

(async () => {
  const browser = await chromium.launch(browserOptions);
  let checks = 0;
  const passed = (name) => { checks++; console.log(`通过: ${name}`); };
  try {
    const { page, context, errors } = await openDog(browser);
    await page.locator('#btn-bath').click();
    await page.waitForFunction(() => __dog.uniforms.uWet.value > 0.95);
    assert.equal(await page.locator('#btn-sit').isDisabled(), true);
    const head = await page.evaluate(() => {
      const h = __dog.hit.find((h) => h.userData.part === 'head');
      const v = h.getWorldPosition(__dog.group.position.clone()).project(__three.camera);
      return { x: (v.x + 1) * innerWidth / 2, y: (1 - v.y) * innerHeight / 2 };
    });
    await page.mouse.click(head.x, head.y);
    assert.equal(await page.evaluate(() => __api.task), 'bath');
    passed('洗澡时轻点小狗不会取消洗澡,动作按钮受保护');

    await page.waitForFunction(() => Object.values(__dog.bones)
      .some((b) => b.children.some((c) => c.material?.opacity === 0.92)));
    await page.evaluate(() => { __api.doSit(); }); // 强制取消,验证真正的收尾而非只靠禁用按钮。
    await idle(page);
    assert.equal(await foamCount(page), 0);
    assert.equal(await page.evaluate(() => __dog.uniforms.uWet.value), 0);
    assert.equal(await page.locator('#btn-feed').isDisabled(), false);
    passed('强制中断洗澡后,泡泡、湿毛和忙碌状态全部清理');

    await page.evaluate(() => { __api.doBath(); });
    await page.waitForFunction(() => __dog.uniforms.uWet.value > 0.2);
    await page.evaluate(() => { __api.doFeed(); });
    await page.waitForTimeout(100);
    assert.equal(await page.locator('#btn-sit').isDisabled(), true);
    assert.equal(await foamCount(page), 0);
    await page.waitForFunction(() => __anim.chew);
    const feeding = await page.evaluate(() => {
      const p = __dog.mouthPoint.getWorldPosition(__dog.group.position.clone());
      return { y: p.y, distance: Math.hypot(p.x + 0.75, p.z - 0.35) };
    });
    assert.ok(feeding.y >= 0.035 && feeding.y <= 0.095, JSON.stringify(feeding));
    assert.ok(feeding.distance < 0.085, JSON.stringify(feeding));
    passed('成年狗进食时嘴部能够贴近碗内食物');
    await idle(page);
    assert.ok(await page.evaluate(() => __api.state.stats.hunger > 79));
    assert.equal(await page.locator('#btn-sit').isDisabled(), false);
    passed('新喂饭任务不会被旧洗澡任务的 finally 解锁或干扰');

    await page.locator('#btn-bath').click();
    await idle(page);
    assert.ok(await page.evaluate(() => __api.state.stats.clean > 99.9));
    assert.equal(await foamCount(page), 0);
    assert.equal(await page.evaluate(() => __dog.uniforms.uWet.value), 0);
    passed('正常洗澡完成后清洁值、泡泡和干燥状态正确');

    await page.locator('#btn-ball').click();
    await idle(page);
    await page.mouse.click(180, 520);
    await page.waitForFunction(() => __dog.bones.jaw.children.some((c) => c.geometry?.parameters?.radius === 0.036), null, { timeout: 20000, polling: 16 });
    assert.equal(await page.locator('#btn-sit').isDisabled(), true);
    await page.evaluate(() => { __api.doSit(); });
    await idle(page);
    await page.waitForFunction(() => !__api.ballMoving, null, { timeout: 5000 });
    const dropped = await ballInfo(page);
    assert.equal(dropped.attached, false);
    assert.ok(Math.abs(dropped.y - 0.036) < 0.002);
    passed('强制中断叼球后,球脱离嘴部并落地');

    const before = await page.evaluate(() => ({ ...__api.state.stats }));
    await page.mouse.click(740, 505);
    await page.waitForFunction(() => __api.task === 'fetch');
    await idle(page);
    const after = await page.evaluate(() => ({ ...__api.state.stats }));
    assert.ok(after.energy < before.energy - 5.9 && after.energy > before.energy - 6.2);
    assert.ok(after.happy > before.happy + 9.8);
    assert.equal((await ballInfo(page)).attached, false);
    passed('正常捡球可以返回、放下球并结算奖励');
    await page.locator('#ball-done').click();
    await page.locator('#btn-sleep').click();
    await idle(page);
    assert.equal(await page.evaluate(() => __api.state.sleeping && document.body.classList.contains('night')), true);
    await page.locator('#btn-sleep').click();
    await idle(page);
    assert.equal(await page.evaluate(() => __api.state.sleeping || document.body.classList.contains('night')), false);
    assert.equal(await page.locator('#btn-feed').isDisabled(), false);
    passed('正常睡觉、叫醒和按钮解锁不受动作保护影响');
    assert.equal(await page.evaluate(() => localStorage.getItem('cloud-pet:v2')), 'Q版存档保持原样');
    assert.deepEqual(errors, []);
    await context.close();

    const first = await openDog(browser, { fresh: true, mobile: true });
    await first.page.locator('#name-input').fill('新来的小狗');
    await first.page.locator('#name-form button').tap();
    assert.equal(await first.page.evaluate(() => __api.state.coins), 50);
    const targets = await first.page.locator('.actions button').evaluateAll((bs) => bs.map((b) => {
      const r = b.getBoundingClientRect();
      return { width: r.width, height: r.height, bottom: r.bottom };
    }));
    assert.ok(targets.every((r) => r.width >= 44 && r.height >= 44 && r.bottom <= 568));
    passed('320 像素窄屏所有按钮的可点区域至少 44×44');
    await idle(first.page);
    await first.page.locator('#btn-feed').tap();
    await first.page.waitForFunction(() => __anim.chew);
    const babyFeeding = await first.page.evaluate(() => {
      const p = __dog.mouthPoint.getWorldPosition(__dog.group.position.clone());
      return { y: p.y, distance: Math.hypot(p.x + 0.75, p.z - 0.35) };
    });
    assert.ok(babyFeeding.y >= 0.025 && babyFeeding.y <= 0.095, JSON.stringify(babyFeeding));
    assert.ok(babyFeeding.distance < 0.085, JSON.stringify(babyFeeding));
    await idle(first.page);
    passed('幼崽进食也能贴近饭碗');
    await first.page.reload();
    await first.page.waitForFunction(() => window.__api);
    assert.equal(await first.page.evaluate(() => __api.state.coins), 50);
    passed('首次领养立即签到,刷新不重复领取');
    assert.deepEqual(first.errors, []);
    await first.context.close();

    const narrow = await openDog(browser, { mobile: true });
    await narrow.page.locator('#btn-ball').tap();
    await idle(narrow.page);
    await narrow.page.evaluate(() => {
      window.__checkFraming = [];
      window.__checkFrameTimer = setInterval(() => {
        if (__api.task !== 'fetch') return;
        const p = __dog.nose.getWorldPosition(__dog.group.position.clone()).project(__three.camera);
        window.__checkFraming.push({ x: p.x, y: p.y });
      }, 16);
    });
    for (const x of [40, 280]) {
      await narrow.page.touchscreen.tap(x, 410);
      await narrow.page.waitForFunction(() => __api.task === 'fetch');
      await idle(narrow.page);
    }
    const framing = await narrow.page.evaluate(() => {
      clearInterval(window.__checkFrameTimer);
      return window.__checkFraming;
    });
    assert.ok(framing.length > 30);
    assert.ok(framing.every((p) => Math.abs(p.x) < 1 && Math.abs(p.y) < 1));
    assert.deepEqual(narrow.errors, []);
    passed('320 像素窄屏左右追球过程中口鼻保持在画面内');
    await narrow.context.close();
    console.log(`3D 回归完成: ${checks} 项通过`);
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exitCode = 1; });
