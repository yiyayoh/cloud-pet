// 无显卡环境下给 3D 小狗截图、跑互动流程,用来自查改动效果。
// 用法:
//   1. 先启动站点:  PORT=3124 npm start
//   2. 截一张图:    node tools/snapshot-dog.cjs out.png
//      指定姿势:    node tools/snapshot-dog.cjs out.png --pose sit
//      指定机位:    node tools/snapshot-dog.cjs out.png --cam 0.3,0.68,1.0 --target 0,0.58,0.33
//      跑一段流程:  node tools/snapshot-dog.cjs out.png --action doFeed --ms 5000
// 依赖 playwright(npm i -D playwright),Chromium 用 SwiftShader 软件渲染,所以很慢。
// 原理:页面加载后停掉 requestAnimationFrame 循环,用 window.__api.step() 按真实时间推进逻辑,
// 只在最后渲染一帧并从 canvas 导出。连续渲染在软件模式下太慢,会让 page.screenshot 超时。
'use strict';

const fs = require('node:fs');
const { chromium } = require('playwright');

const args = process.argv.slice(2);
const out = args[0] || 'dog.png';
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const url = opt('url', 'http://localhost:3124/dog.html');
const pose = opt('pose', null);
const action = opt('action', null);
const ms = Number(opt('ms', '0'));
const cam = opt('cam', null);
const target = opt('target', null);
const size = opt('size', '900x700').split('x').map(Number);

(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: size[0], height: size[1] } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  // 预置一只成年小狗的存档,跳过起名弹窗
  await page.addInitScript(() => {
    const n = Date.now();
    localStorage.setItem('cloud-pet:dog3d', JSON.stringify({
      name: '小白', species: 'dog', bornAt: n, hatchedAt: n, updatedAt: n, lastDaily: 'skip', xp: 500,
      stats: { hunger: 70, happy: 80, clean: 90, energy: 80 },
    }));
  });
  await page.goto(url);
  await page.waitForFunction(() => window.__api, null, { timeout: 60000 });
  await page.evaluate(() => window.__three.renderer.setAnimationLoop(null));

  if (pose) {
    await page.evaluate((p) => {
      window.__anim.setPose(p);
      for (let i = 0; i < 150; i++) window.__anim.update(1 / 60, i / 60);
    }, pose);
  }
  if (action) await page.evaluate((a) => { window.__api[a](); }, action);
  if (ms) {
    await page.evaluate(async (dur) => {
      let t = performance.now() / 1000;
      const end = performance.now() + dur;
      while (performance.now() < end) {
        await new Promise((r) => setTimeout(r, 30));
        const now = performance.now() / 1000;
        window.__api.step(Math.min(0.05, now - t), now);
        t = now;
      }
    }, ms);
  }

  const dataUrl = await page.evaluate(([c, tg]) => {
    const t = window.__three;
    if (c) t.camera.position.set(...c.split(',').map(Number));
    if (tg) t.controls.target.set(...tg.split(',').map(Number));
    t.controls.update();
    t.renderer.render(t.scene, t.camera);
    return t.renderer.domElement.toDataURL('image/png');
  }, [cam, target]);
  fs.writeFileSync(out, Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log(`已保存 ${out}`, errors.length ? `\n页面错误:\n${errors.join('\n')}` : '(无页面错误)');
  await browser.close();
})();
