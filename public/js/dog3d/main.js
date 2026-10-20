// 3D 小狗:互动、行为和界面
import * as THREE from 'three';
import { createScene } from './scene.js';
import { buildDog } from './model.js';
import { Animator } from './animator.js';
import { createSfx } from './sfx.js';

const G = window.Game;
const SAVE_KEY = 'cloud-pet:dog3d';
const $ = (s) => document.querySelector(s);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];

const canvas = $('#stage');
const isMobile = matchMedia('(pointer: coarse)').matches;
const { renderer, scene, camera, controls, lights, resize: sceneResize } = createScene(canvas);
const dog = buildDog({ layers: isMobile ? 22 : 32 });
scene.add(dog.group);
const anim = new Animator(dog);
const sfx = createSfx(() => window.Sound?.muted);

// ---------- 存档 ----------
let state = load();
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    return s ? G.normalize(s) : null;
  } catch {
    return null;
  }
}
function save() {
  if (!state) return;
  state.savedAt = Date.now();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch {}
}

// ---------- 道具:球、饭碗 ----------
const ball = new THREE.Mesh(
  new THREE.SphereGeometry(0.036, 24, 16),
  new THREE.MeshStandardMaterial({ color: '#D5E64A', roughness: 0.85 }),
);
ball.castShadow = true;
ball.visible = false;
scene.add(ball);
const ballVel = new THREE.Vector3();
let ballMoving = false;

const bowl = new THREE.Group();
{
  const pts = [[0, 0], [0.1, 0], [0.115, 0.01], [0.12, 0.055], [0.108, 0.058], [0.098, 0.02], [0, 0.02]].map(([x, y]) => new THREE.Vector2(x, y));
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 48), new THREE.MeshPhysicalMaterial({ color: '#6E9BC9', roughness: 0.25, clearcoat: 0.8 }));
  body.castShadow = true;
  body.receiveShadow = true;
  bowl.add(body);
  const food = new THREE.Group();
  const kibble = new THREE.MeshStandardMaterial({ color: '#8A5A2E', roughness: 0.8 });
  for (let i = 0; i < 40; i++) {
    const k = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), kibble);
    const r = Math.sqrt(Math.random()) * 0.085;
    const a = Math.random() * Math.PI * 2;
    k.position.set(Math.cos(a) * r, 0.03 + Math.random() * 0.02, Math.sin(a) * r);
    food.add(k);
  }
  food.visible = false;
  bowl.add(food);
  bowl.userData.food = food;
}
bowl.position.set(-0.75, 0, 0.35);
scene.add(bowl);

// 身体下面一块柔和的接触阴影,让小狗"站"在地上
const contact = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grd.addColorStop(0, 'rgba(40,25,15,.55)');
  grd.addColorStop(0.5, 'rgba(40,25,15,.22)');
  grd.addColorStop(1, 'rgba(40,25,15,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 1;
  scene.add(m);
  return m;
})();
const lowPoses = { sit: 0.6, paw: 0.6, scratch: 0.6, lie: 1, sleep: 1 };
let contactK = 0;
function updateContactShadow() {
  const g = dog.group;
  contactK += ((lowPoses[anim.pose] || 0) - contactK) * 0.1;
  contact.position.set(g.position.x, 0.004, g.position.z);
  contact.rotation.z = g.rotation.y;
  const s = g.scale.x;
  contact.scale.set((0.42 + 0.12 * contactK) * s, (0.78 + 0.1 * contactK) * s, 1);
  contact.material.opacity = 0.55 + 0.35 * contactK;
}

// 泡泡和水珠
const fxGroup = new THREE.Group();
scene.add(fxGroup);
const foamMat = new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.3, transparent: true, opacity: 0.92 });
const dropMat = new THREE.MeshPhysicalMaterial({ color: '#DDEFFF', roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.7 });
const particles = [];

// ---------- 行为调度 ----------
const CANCEL = Symbol('cancel');
let task = null;
let busy = false;

function run(name, fn) {
  if (task) task.cancel = true;
  const t = { name, cancel: false };
  task = t;
  anim.scratching = false;
  anim.chew = false;
  return fn(t)
    .catch((e) => { if (e !== CANCEL) console.error(e); })
    .finally(() => { if (task === t) task = null; });
}

function wait(ms, t) {
  return new Promise((res, rej) => setTimeout(() => (t?.cancel ? rej(CANCEL) : res()), ms));
}

let move = null; // { target: fn -> Vector3, speed, stop, resolve, reject, t }
function moveTo(getTarget, speed, stop, t) {
  return new Promise((resolve, reject) => {
    move = { getTarget: typeof getTarget === 'function' ? getTarget : () => getTarget, speed, stop, resolve, reject, t };
  });
}

function faceTowards(point, t) {
  return new Promise((resolve, reject) => {
    move = { faceOnly: true, getTarget: () => point, resolve, reject, t, speed: 0, stop: 0 };
  });
}

async function standUp(t) {
  if (anim.pose !== 'stand') {
    anim.setPose('stand');
    await wait(450, t);
  }
}

function heading() {
  return dog.group.rotation.y;
}

function updateMove(dt) {
  if (!move) {
    anim.v.walk = Math.max(0, anim.v.walk - dt * 4);
    return;
  }
  if (move.t?.cancel) {
    const m = move;
    move = null;
    m.reject(CANCEL);
    return;
  }
  const p = dog.group.position;
  const target = move.getTarget();
  const dx = target.x - p.x;
  const dz = target.z - p.z;
  const dist = Math.hypot(dx, dz);
  const want = Math.atan2(dx, dz);
  let diff = want - heading();
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  dog.group.rotation.y = Math.atan2(Math.sin(heading() + THREE.MathUtils.clamp(diff, -dt * 5, dt * 5)), Math.cos(heading() + THREE.MathUtils.clamp(diff, -dt * 5, dt * 5)));
  if (move.faceOnly) {
    if (Math.abs(diff) < 0.05) { const m = move; move = null; m.resolve(); }
    anim.v.walk = Math.max(0, anim.v.walk - dt * 4);
    return;
  }
  if (dist <= move.stop + 0.015) {
    const m = move;
    move = null;
    m.resolve();
    return;
  }
  // 快到了就放慢,没对准方向就先转身,不然会绕着目标打转
  const align = Math.max(0, Math.cos(diff)) ** 2;
  const arrive = THREE.MathUtils.clamp((dist - move.stop) / 0.3, 0.2, 1);
  const step = Math.min(dist - move.stop, move.speed * align * arrive * dt);
  p.x += Math.sin(heading()) * step;
  p.z += Math.cos(heading()) * step;
  p.x = THREE.MathUtils.clamp(p.x, -1.6, 1.6);
  p.z = THREE.MathUtils.clamp(p.z, -1.4, 1.2);
  anim.v.walk = THREE.MathUtils.lerp(anim.v.walk, (move.speed / 0.7) * Math.max(0.3, align * arrive), 1 - Math.exp(-8 * dt));
}

// 镜头前方的地面位置(狗把球叼回来的地方)。出发时算好就固定,不跟着镜头变
function homePoint() {
  const t = controls.target;
  const dir = new THREE.Vector3(camera.position.x - t.x, 0, camera.position.z - t.z).normalize();
  const p = new THREE.Vector3(t.x * 0.3, 0, t.z * 0.3).addScaledVector(dir, 0.5);
  p.x = THREE.MathUtils.clamp(p.x, -1.2, 1.2);
  p.z = THREE.MathUtils.clamp(p.z, -1.0, 1.0);
  return p;
}

// ---------- 动作 ----------
function lookAtCamera(weight = 0.85) {
  anim.lookAt.copy(camera.position);
  anim.set('look', weight);
}

function happy(level = 1) {
  anim.set('wag', 0.35 + 0.25 * level);
  anim.set('wagFreq', 2.5 + 2.5 * level);
  anim.set('ears', 0.4);
}

function calm() {
  anim.set('wag', 0.2);
  anim.set('wagFreq', 1.4);
  anim.set('ears', 0);
  anim.set('tilt', 0);
  anim.set('eyes', 1);
  anim.set('lean', 0);
  anim.set('headDown', 0);
  anim.set('tongue', 0);
  anim.pant = false;
  if (!anim.chew) anim.set('jaw', 0);
}

async function bark(t, times = 1) {
  for (let i = 0; i < times; i++) {
    anim.set('jaw', 0.75);
    anim.set('ears', 0.8);
    sfx.bark();
    await wait(140, t);
    anim.set('jaw', 0);
    await wait(170, t);
  }
}

function doSit() {
  return run('sit', async (t) => {
    await faceTowards(camera.position, t);
    anim.setPose('sit');
    lookAtCamera();
    happy(0.6);
    await wait(500, t);
    calm();
  });
}

function doLie() {
  return run('lie', async (t) => {
    await faceTowards(camera.position, t);
    anim.setPose('lie');
    lookAtCamera(0.7);
    await wait(600, t);
    calm();
  });
}

function doPaw() {
  return run('paw', async (t) => {
    await faceTowards(camera.position, t);
    if (anim.pose !== 'sit') {
      anim.setPose('sit');
      await wait(600, t);
    }
    lookAtCamera();
    anim.setPose('paw');
    happy(1);
    toast(pick(['握手!它把小爪子搭了上来', '好乖,爪子软软的']));
    await wait(1800, t);
    anim.setPose('sit');
    await wait(700, t);
    calm();
  });
}

function doScratch() {
  return run('scratch', async (t) => {
    if (anim.pose !== 'sit') {
      anim.setPose('sit');
      await wait(600, t);
    }
    anim.setPose('scratch');
    anim.set('look', 0);
    anim.set('eyes', 0.35);
    await wait(500, t);
    anim.scratching = true;
    await wait(1800, t);
    anim.scratching = false;
    anim.setPose('sit');
    anim.set('eyes', 1);
    await wait(400, t);
    anim.lean = 0;
    lookAtCamera();
  });
}

function doSniffAround() {
  return run('sniff', async (t) => {
    await standUp(t);
    const p = new THREE.Vector3(rand(-1, 1), 0, rand(-0.9, 0.6));
    anim.set('look', 0);
    anim.set('headDown', 0.75);
    await moveTo(p, 0.35, 0.05, t);
    await wait(rand(800, 1800), t);
    anim.set('headDown', 0);
    lookAtCamera();
  });
}

function doWander() {
  return run('wander', async (t) => {
    await standUp(t);
    const p = new THREE.Vector3(rand(-0.9, 0.9), 0, rand(-0.6, 0.6));
    anim.set('look', 0.2);
    anim.lookAt.set(p.x, 0.3, p.z);
    await moveTo(p, 0.5, 0.05, t);
    lookAtCamera();
    await faceTowards(camera.position, t);
  });
}

function doComeHere() {
  return run('come', async (t) => {
    await standUp(t);
    happy(0.8);
    lookAtCamera();
    await moveTo(homePoint(), 0.9, 0.05, t);
    await faceTowards(camera.position, t);
    anim.setPose('sit');
    await wait(600, t);
  });
}

// ---------- 摸摸 / 戳戳 ----------
let petting = null;

function onPet(dx) {
  if (state.sleeping) return;
  petting.dist += dx;
  if (petting.dist - petting.last < 70) return;
  petting.last = petting.dist;
  const r = G.stroke(state, Date.now());
  if (r.coin) toast('它好开心,金币 +1');
  after(r);
  spawnHeart(petting.x, petting.y);
  if (Math.random() < 0.25) sfx.whine();
}

function startPetting(e, part) {
  controls.enabled = false;
  petting = { part, dist: 0, last: 0, x: e.clientX, y: e.clientY, t0: performance.now(), moved: 0 };
  if (lastHit) pressFur(lastHit.point);
  if (state.sleeping || busy) return;
  // 正在走动、闻东西之类的就停下来让你摸;坐着、趴着就保持姿势
  if (task && !['sit', 'lie', 'paw'].includes(task.name)) {
    task.cancel = true;
    task = null;
  }
  anim.set('eyes', 0.3);
  anim.set('tilt', part === 'head' ? rand(-0.35, 0.35) : 0.12);
  anim.set('lean', part === 'head' ? 0 : 0.1);
  happy(1);
  lookAtCamera(0.5);
}

function endPetting() {
  controls.enabled = true;
  handOn = false;
  if (!petting) return;
  const tap = petting.moved < 10 && performance.now() - petting.t0 < 350;
  petting = null;
  if (state.sleeping) {
    if (tap) toast(pick(['它睡得正香,打了个小呼噜', '嘘……它翻了个身继续睡']));
    return;
  }
  if (tap) {
    calm();
    const r = Math.random();
    if (r < 0.4) run('tap', async (t) => { lookAtCamera(); anim.set('tilt', pick([-0.45, 0.45])); anim.set('ears', 0.7); await wait(900, t); calm(); });
    else if (r < 0.75) run('tap', async (t) => { lookAtCamera(); happy(1); await bark(t, pick([1, 2])); await wait(600, t); calm(); });
    else run('tap', async (t) => { await standUp(t); happy(1.2); lookAtCamera(); anim.pant = true; anim.set('tongue', 1); await wait(1600, t); calm(); });
    return;
  }
  setTimeout(() => { if (!petting) { anim.set('eyes', 1); anim.set('tilt', 0); anim.set('lean', 0); } }, 400);
}

// ---------- 喂饭 ----------
function doFeed() {
  if (state.sleeping) return toast('它在睡觉呢');
  return run('feed', async (t) => {
    busy = true;
    try {
      bowl.userData.food.visible = true;
      sfx.kibble();
      await standUp(t);
      anim.set('ears', 0.7);
      happy(1);
      anim.lookAt.copy(bowl.position);
      anim.set('look', 0.6);
      const reason = G.canFeed(state, 'rice');
      await moveTo(() => bowl.position, 0.9, 0.5, t);
      await faceTowards(bowl.position, t);
      anim.set('look', 0);
      anim.set('headDown', 1);
      await wait(600, t);
      if (reason === 'full') {
        await wait(700, t);
        anim.set('headDown', 0);
        toast('它闻了闻……现在还不饿');
        calm();
        lookAtCamera();
        return;
      }
      anim.chew = true;
      for (let i = 0; i < 10; i++) {
        sfx.chew();
        await wait(260, t);
      }
      anim.chew = false;
      bowl.userData.food.visible = false;
      after(G.feed(state, 'rice'));
      anim.set('jaw', 0.25);
      anim.set('tongue', 1);
      await wait(500, t);
      anim.set('headDown', 0);
      anim.set('tongue', 0);
      anim.set('jaw', 0);
      lookAtCamera();
      await faceTowards(camera.position, t);
      happy(1);
      toast(pick(['吃得干干净净!', '舔了舔嘴巴,心满意足']));
      await wait(1200, t);
      calm();
    } finally {
      anim.chew = false;
      busy = false;
    }
  });
}

// ---------- 扔球 ----------
let ballMode = false;

function throwBall(point) {
  if (state.stats.energy < 10) return toast('它累了,趴着不想动');
  if (busy) return;
  const start = camera.position.clone().add(new THREE.Vector3(0, -0.35, 0)).lerp(point, 0.12);
  scene.attach(ball);
  ball.position.copy(start);
  ball.visible = true;
  const T = 0.75;
  ballVel.set((point.x - start.x) / T, 0, (point.z - start.z) / T);
  ballVel.y = (point.y + 0.036 - start.y + 0.5 * 9.8 * T * T) / T;
  ballMoving = true;
  sfx.squeak();
  fetch();
}

function updateBall(dt) {
  if (!ballMoving) return;
  ballVel.y -= 9.8 * dt;
  ball.position.addScaledVector(ballVel, dt);
  const r = 0.036;
  if (ball.position.y < r) {
    ball.position.y = r;
    if (Math.abs(ballVel.y) > 0.6) sfx.bounce();
    ballVel.y = Math.abs(ballVel.y) * 0.5;
    ballVel.x *= 0.75;
    ballVel.z *= 0.75;
    if (ballVel.y < 0.35) ballVel.y = 0;
  }
  if (ball.position.y <= r + 0.001 && ballVel.y === 0) {
    ballVel.x *= 1 - Math.min(1, 2.2 * dt);
    ballVel.z *= 1 - Math.min(1, 2.2 * dt);
    if (Math.hypot(ballVel.x, ballVel.z) < 0.02) ballMoving = false;
  }
  ball.rotation.x += ballVel.z * dt * 25;
  ball.rotation.z -= ballVel.x * dt * 25;
  // 球不会滚出小狗够得着的范围
  const lim = { x: [-1.3, 1.3], z: [-1.1, 0.95] };
  for (const k of ['x', 'z']) {
    const [lo, hi] = lim[k];
    if (ball.position[k] < lo || ball.position[k] > hi) {
      ball.position[k] = THREE.MathUtils.clamp(ball.position[k], lo, hi);
      ballVel[k] *= -0.5;
    }
  }
}

function fetch() {
  return run('fetch', async (t) => {
    busy = true;
    try {
      anim.set('ears', 0.9);
      happy(1.4);
      anim.lookAt.copy(ball.position);
      anim.set('look', 0.6);
      await standUp(t);
      anim.pant = true;
      anim.set('tongue', 0.7);
      // 追着球跑,直到球停下并且到嘴边
      const giveUp = performance.now() + 9000;
      await moveTo(() => ball.position, 1.7, 0.42, t);
      while (ballMoving && performance.now() < giveUp) await moveTo(() => ball.position, 1.4, 0.42, t);
      ballMoving = false;
      await moveTo(() => ball.position, 1.0, 0.42, t);
      anim.pant = false;
      anim.set('tongue', 0);
      await faceTowards(ball.position, t);
      anim.set('look', 0);
      anim.set('headDown', 1);
      anim.set('jaw', 0.6);
      await wait(450, t);
      dog.bones.jaw.attach(ball);
      ball.position.set(0, -0.012, 0.13);
      anim.set('jaw', 0.28);
      anim.set('headDown', 0);
      sfx.squeak();
      await wait(250, t);
      anim.lookAt.copy(camera.position);
      anim.set('look', 0.5);
      await moveTo(homePoint(), 1.2, 0.04, t);
      await faceTowards(camera.position, t);
      anim.setPose('sit');
      await wait(500, t);
      anim.set('jaw', 0.6);
      await wait(150, t);
      scene.attach(ball);
      ballVel.set(rand(-0.2, 0.2), 0, 0.3);
      ballMoving = true;
      anim.set('jaw', 0);
      lookAtCamera();
      happy(1.4);
      anim.pant = true;
      anim.set('tongue', 1);
      after(G.playBall(state));
      await wait(1800, t);
      calm();
    } finally {
      busy = false;
      anim.pant = false;
    }
  });
}

// ---------- 洗澡 ----------
function doBath() {
  if (state.sleeping) return toast('它在睡觉呢');
  if (state.stats.clean >= 99) return toast('它已经香喷喷的了');
  return run('bath', async (t) => {
    busy = true;
    try {
      await standUp(t);
      await faceTowards(camera.position, t);
      anim.set('ears', -0.5);
      anim.set('wag', 0.05);
      anim.set('eyes', 0.4);
      sfx.splash();
      // 毛被打湿、塌下来
      const wet = dog.uniforms.uWet;
      for (let i = 0; i < 20; i++) { wet.value = Math.min(1, wet.value + 0.05); await wait(40, t); }
      const foam = [];
      for (let i = 0; i < 46; i++) {
        const bone = pick(['spine', 'chest', 'root', 'neck', 'head']);
        const m = new THREE.Mesh(new THREE.SphereGeometry(rand(0.012, 0.03), 10, 8), foamMat);
        const dir = new THREE.Vector3(rand(-1, 1), rand(0.2, 1), rand(-1, 1)).normalize();
        const r = bone === 'head' ? 0.11 : 0.15;
        m.position.copy(dir.multiplyScalar(r)).add(bone === 'head' ? new THREE.Vector3(0, 0.08, 0.05) : new THREE.Vector3(0, 0, 0));
        dog.bones[bone].add(m);
        foam.push(m);
        if (i % 4 === 0) { sfx.bubble(); await wait(60, t); }
      }
      while (state.stats.clean < 100) G.scrub(state);
      await wait(900, t);
      for (const m of foam) m.removeFromParent();
      toast('冲干净啦,它要甩水了!');
      await wait(300, t);
      anim.shake = 1.4;
      sfx.shake();
      const origin = new THREE.Vector3();
      for (let i = 0; i < 70; i++) {
        dog.bones.spine.getWorldPosition(origin);
        const d = new THREE.Mesh(new THREE.SphereGeometry(rand(0.004, 0.009), 6, 4), dropMat);
        d.position.copy(origin).add(new THREE.Vector3(rand(-0.15, 0.15), rand(0, 0.2), rand(-0.2, 0.2)));
        fxGroup.add(d);
        particles.push({ m: d, v: new THREE.Vector3(rand(-2, 2), rand(0.5, 2.2), rand(-2, 2)), life: 1.2 });
      }
      for (let i = 0; i < 30; i++) { wet.value = Math.max(0.15, wet.value - 0.03); await wait(50, t); }
      anim.set('eyes', 1);
      happy(1);
      lookAtCamera();
      after();
      for (let i = 0; i < 30; i++) { wet.value = Math.max(0, wet.value - 0.01); await wait(80, t); }
      calm();
    } finally {
      busy = false;
    }
  });
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    if (p.ripple) {
      p.life -= dt;
      p.ripple.scale.setScalar(1 + (0.6 - p.life) * 5);
      p.ripple.material.opacity = Math.max(0, p.life / 0.6) * 0.7;
      if (p.life <= 0) {
        p.ripple.removeFromParent();
        particles.splice(i, 1);
      }
      continue;
    }
    p.v.y -= 9.8 * dt;
    p.m.position.addScaledVector(p.v, dt);
    p.life -= dt;
    if (p.m.position.y < 0.005 || p.life <= 0) {
      p.m.removeFromParent();
      particles.splice(i, 1);
    }
  }
}

// ---------- 睡觉 ----------
function setNight(on) {
  const k = on ? 0.25 : 1;
  lights.sun.intensity = 2.6 * k;
  lights.sun.color.set(on ? '#AFC0FF' : '#FFE7C7');
  lights.hemi.intensity = 0.9 * (on ? 0.4 : 1);
  renderer.toneMappingExposure = on ? 0.6 : 1.05;
  scene.environmentIntensity = on ? 0.15 : 0.45;
  scene.background.set(on ? '#5E5A6E' : '#E9D9C6');
  scene.fog.color.copy(scene.background);
  document.body.classList.toggle('night', on);
}

function doSleep() {
  if (state.sleeping) {
    G.wake(state);
    setNight(false);
    after();
    return run('wake', async (t) => {
      anim.set('eyes', 1);
      anim.setPose('lie');
      await wait(700, t);
      anim.setPose('stand');
      happy(0.8);
      lookAtCamera();
      sfx.yawn();
      anim.set('jaw', 0.9);
      await wait(700, t);
      anim.set('jaw', 0);
      calm();
    });
  }
  const r = G.sleep(state);
  if (!r.ok) {
    toast('它精神着呢,还不想睡');
    return run('nope', async (t) => { lookAtCamera(); anim.set('tilt', 0.4); await wait(800, t); calm(); });
  }
  after();
  return run('sleep', (t) => goToSleep(t));
}

async function goToSleep(t) {
  await standUp(t);
  await moveTo(new THREE.Vector3(0, 0, 0), 0.5, 0.05, t);
  anim.setPose('lie');
  anim.set('look', 0);
  sfx.yawn();
  anim.set('jaw', 0.9);
  await wait(800, t);
  anim.set('jaw', 0);
  anim.setPose('sleep');
  anim.set('eyes', 0.05);
  anim.set('wag', 0);
  anim.set('ears', -0.2);
  setNight(true);
}

// ---------- 自己玩 ----------
function idle() {
  setTimeout(idle, rand(4500, 8500));
  if (!state || task || petting || busy || ballMode || state.sleeping || document.hidden) return;
  // 刚跟它互动过,就乖乖待着看你,不马上自己跑开
  if (performance.now() - lastInteract < 9000) return;
  const m = G.mood(state);
  const r = Math.random();
  if (m.need && r < 0.5) {
    const lines = {
      hunger: '它跑到饭碗边上,眼巴巴地看着你',
      energy: '它打了个大哈欠,看起来困了',
      clean: '它毛有点脏了,一直在挠',
      happy: '它叼着尾巴转圈,想让你陪它玩',
    };
    toast(lines[m.need.key]);
    if (m.need.key === 'hunger') {
      run('beg', async (t) => {
        await standUp(t);
        await moveTo(() => bowl.position, 0.6, 0.55, t);
        await faceTowards(camera.position, t);
        anim.setPose('sit');
        lookAtCamera();
        sfx.whine();
      });
    } else if (m.need.key === 'clean') doScratch();
    else if (m.need.key === 'energy') doLie();
    else doComeHere();
    return;
  }
  if (r < 0.2) doWander();
  else if (r < 0.35) doSniffAround();
  else if (r < 0.5) doScratch();
  else if (r < 0.62) doSit();
  else if (r < 0.7) doComeHere();
  else if (r < 0.78 && state.stats.energy < 50) doLie();
  else {
    run('look', async (t) => {
      anim.lookAt.set(rand(-2, 2), rand(0.3, 1.2), rand(-1, 2));
      anim.set('look', 0.8);
      anim.set('ears', 0.5);
      await wait(1200, t);
      lookAtCamera();
      anim.set('ears', 0);
    });
  }
}

// ---------- 指针 ----------
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

function setRay(e) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
}

let lastHit = null;
function hitDog(e) {
  setRay(e);
  const hits = raycaster.intersectObjects(dog.hit, false);
  lastHit = hits[0] || null;
  return lastHit?.object.userData.part || null;
}

// 手摸到的位置传给毛发着色器,毛会顺着手被压下去
const handLocal = new THREE.Vector3();
const handPrev = new THREE.Vector3();
let handOn = false;
function pressFur(point) {
  dog.base.updateMatrixWorld();
  handLocal.copy(point);
  dog.base.worldToLocal(handLocal);
  // 手按在毛的表面,往身体里收一点
  const u = dog.uniforms;
  if (handOn) {
    const dir = handLocal.clone().sub(handPrev);
    if (dir.lengthSq() > 1e-6) u.uHandDir.value.lerp(dir.normalize(), 0.5).normalize();
  }
  handPrev.copy(handLocal);
  u.uHand.value.x = handLocal.x;
  u.uHand.value.y = handLocal.y;
  u.uHand.value.z = handLocal.z;
  handOn = true;
}

let downAt = null;
let lastInteract = 0;
window.addEventListener('pointerdown', (e) => {
  lastInteract = performance.now();
  if (e.target !== canvas || !state) return;
  sfx.unlock();
  const part = hitDog(e);
  if (part) {
    startPetting(e, part);
    return;
  }
  downAt = { x: e.clientX, y: e.clientY, t: performance.now() };
}, { capture: true });

window.addEventListener('pointermove', (e) => {
  if (petting) {
    const d = Math.hypot(e.clientX - petting.x, e.clientY - petting.y);
    petting.moved += d;
    petting.x = e.clientX;
    petting.y = e.clientY;
    if (hitDog(e)) {
      pressFur(lastHit.point);
      onPet(d);
    } else {
      handOn = false;
    }
  } else if (!task && !state?.sleeping) {
    // 不忙的时候,眼睛跟着手指/鼠标
    setRay(e);
    const p = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.8), p)) {
      anim.lookAt.copy(p);
      anim.set('look', 0.85);
      lastPointer = performance.now();
    }
  }
});

let lastPointer = 0;
window.addEventListener('pointerup', (e) => {
  if (petting) return endPetting();
  if (!downAt) return;
  const tap = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 8 && performance.now() - downAt.t < 400;
  downAt = null;
  if (!tap || e.target !== canvas) return;
  setRay(e);
  const p = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(floorPlane, p)) return;
  p.x = THREE.MathUtils.clamp(p.x, -1.2, 1.2);
  p.z = THREE.MathUtils.clamp(p.z, -1.0, 0.85);
  if (ballMode) throwBall(p);
  else callTo(p);
});

// 点地板:它会跑过去,在那儿坐下看着你
function callTo(p) {
  if (!state || state.sleeping || busy) return;
  spawnRipple(p);
  run('call', async (t) => {
    await standUp(t);
    happy(0.9);
    anim.set('ears', 0.7);
    anim.lookAt.set(p.x, 0.2, p.z);
    anim.set('look', 0.5);
    await moveTo(p, 0.8, 0.05, t);
    lookAtCamera();
    await faceTowards(camera.position, t);
    anim.setPose('sit');
    await wait(700, t);
    calm();
  });
}

const rippleMat = new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.7, depthWrite: false });
function spawnRipple(p) {
  const r = new THREE.Mesh(new THREE.RingGeometry(0.03, 0.045, 32), rippleMat.clone());
  r.rotation.x = -Math.PI / 2;
  r.position.set(p.x, 0.006, p.z);
  scene.add(r);
  particles.push({ ripple: r, life: 0.6 });
}
window.addEventListener('pointercancel', () => { if (petting) endPetting(); downAt = null; });

// ---------- 界面 ----------
function spawnHeart(x, y) {
  const h = document.createElement('div');
  h.className = 'heart';
  h.textContent = pick(['♥', '♥', '❤']);
  h.style.left = `${x + rand(-14, 14)}px`;
  h.style.top = `${y - 10}px`;
  document.body.appendChild(h);
  h.addEventListener('animationend', () => h.remove());
}

function toast(text) {
  const el = $('#toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('show'), 2600);
}

function after(r) {
  if (r?.levelUp) toast(`🎉 ${state.name} 长大了,现在是「${r.levelUp.name}」`);
  renderHud();
  save();
}

function renderHud() {
  if (!state) return;
  $('#name').textContent = state.name;
  $('#stage-name').textContent = G.stage(state).name;
  $('#coins').textContent = state.coins;
  for (const k of ['hunger', 'happy', 'clean', 'energy']) {
    const v = state.stats[k];
    const bar = $(`#bar-${k}`);
    bar.style.width = `${v}%`;
    bar.className = v < 25 ? 'low' : v < 55 ? 'mid' : '';
  }
  $('#btn-sleep').innerHTML = state.sleeping ? '<span>☀️</span>叫醒' : '<span>🌙</span>睡觉';
  for (const b of document.querySelectorAll('.actions button')) {
    if (b.id !== 'btn-sleep') b.disabled = state.sleeping;
  }
  dog.uniforms.uDirt.value = state.stats.clean < 60 ? (60 - state.stats.clean) / 60 : 0;
  const st = G.stage(state);
  const s = { baby: 0.8, kid: 0.9, adult: 1 }[st.id] || 1;
  dog.group.scale.setScalar(s);
}

function setBallMode(on) {
  ballMode = on;
  $('#ballbar').hidden = !on;
  $('#btn-ball').classList.toggle('active', on);
}

function bindUi() {
  $('#btn-feed').onclick = () => { setBallMode(false); doFeed(); };
  $('#btn-ball').onclick = () => {
    if (state.stats.energy < 10) return toast('它累了,趴着不想动');
    setBallMode(!ballMode);
    if (ballMode) {
      toast('点一下地板,把球扔出去');
      run('ready', async (t) => { await standUp(t); lookAtCamera(); happy(1.2); anim.set('ears', 0.9); await bark(t, 1); });
    }
  };
  $('#ball-done').onclick = () => setBallMode(false);
  $('#btn-bath').onclick = () => { setBallMode(false); doBath(); };
  $('#btn-sit').onclick = () => doSit();
  $('#btn-paw').onclick = () => doPaw();
  $('#btn-lie').onclick = () => doLie();
  $('#btn-sleep').onclick = () => { setBallMode(false); doSleep(); };
  $('#btn-sound').onclick = () => { $('#btn-sound').textContent = window.Sound.toggle() ? '🔇' : '🔊'; };
  $('#btn-sound').textContent = window.Sound?.muted ? '🔇' : '🔊';
  $('#name-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('#name-input').value.trim() || '小白';
    const now = Date.now();
    state = G.create(name, 'dog', now);
    G.hatch(state, now);
    $('#welcome').hidden = true;
    save();
    renderHud();
    run('hello', async (t) => { await wait(300, t); happy(1.4); lookAtCamera(); await bark(t, 2); calm(); });
  });
}

// ---------- 主循环 ----------
const clock = new THREE.Clock();
function frame() {
  const raw = clock.getDelta();
  step(Math.min(0.05, raw), clock.elapsedTime);
  controls.update();
  renderer.render(scene, camera);
  watchPerf(raw);
}

// 手机上太卡就自动降低毛发层数和分辨率
let quality = 2;
const perf = { frames: 0, time: 0, skip: 30 };
function setQuality(q) {
  quality = q;
  const keepEvery = q === 2 ? 1 : q === 1 ? 2 : 3;
  dog.shells.forEach((s, i) => { s.visible = (i + 1) % keepEvery === 0 || i === dog.shells.length - 1; });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, q === 2 ? 2 : q === 1 ? 1.5 : 1));
  sceneResize();
}
function watchPerf(dt) {
  if (quality === 0 || document.hidden) return;
  if (perf.skip > 0) { perf.skip--; return; }
  perf.frames++;
  perf.time += dt;
  if (perf.frames < 90) return;
  const avg = perf.time / perf.frames;
  perf.frames = 0;
  perf.time = 0;
  perf.skip = 30;
  if (avg > 1 / 38) setQuality(quality - 1);
}

// 切到后台就不画了,省电
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    renderer.setAnimationLoop(null);
  } else {
    clock.getDelta();
    renderer.setAnimationLoop(frame);
  }
});

// 镜头跟着小狗走,手机竖屏也不会跑出画面
const camGoal = new THREE.Vector3();
function followDog(dt) {
  const p = dog.group.position;
  camGoal.set(p.x * 0.85, 0.33, p.z * 0.85 + 0.05);
  const k = 1 - Math.exp(-2.2 * dt);
  const dx = (camGoal.x - controls.target.x) * k;
  const dz = (camGoal.z - controls.target.z) * k;
  controls.target.x += dx;
  controls.target.z += dz;
  camera.position.x += dx;
  camera.position.z += dz;
}

function step(dt, t) {
  followDog(dt);
  const hand = dog.uniforms.uHand.value;
  hand.w += ((handOn ? 1 : 0) - hand.w) * (1 - Math.exp(-(handOn ? 14 : 3) * dt));
  updateContactShadow();
  updateMove(dt);
  updateBall(dt);
  updateParticles(dt);
  if (!task && !petting && performance.now() - lastPointer > 2500 && !state?.sleeping) {
    anim.lookAt.lerp(camera.position, 1 - Math.exp(-2 * dt));
  }
  anim.update(dt, t);
}

function tickLoop() {
  if (state) {
    const r = G.tick(state, Date.now());
    if (r.wokeUp) {
      setNight(false);
      toast(`${state.name} 睡饱了,伸了个懒腰`);
      run('woke', async (t) => { anim.set('eyes', 1); anim.setPose('stand'); await wait(500, t); happy(1); lookAtCamera(); });
    }
    renderHud();
    save();
  }
  setTimeout(tickLoop, 5000);
}

function boot() {
  bindUi();
  dog.group.position.set(0, 0, 0);
  dog.group.rotation.y = Math.atan2(camera.position.x, camera.position.z);
  lookAtCamera();
  if (state) {
    const r = G.tick(state, Date.now());
    const claimed = G.claimDaily(state, Date.now());
    renderHud();
    if (state.sleeping) {
      anim.setPose('sleep');
      anim.v.eyes = anim.v.eyesT = 0.05;
      setNight(true);
    } else if (r.hours > 0.3) {
      setTimeout(() => {
        toast(r.hours > 3 ? `你离开了 ${Math.round(r.hours)} 个小时,${state.name} 一看到你就冲过来了` : `${state.name} 摇着尾巴迎接你`);
        doComeHere();
      }, 600);
    }
    if (claimed) setTimeout(() => toast(`每日签到 +${claimed} 金币`), 3500);
    save();
  } else {
    $('#welcome').hidden = false;
  }
  $('#loading').hidden = true;
  renderer.setAnimationLoop(frame);
  tickLoop();
  setTimeout(idle, 5000);
}

boot();

// 调试用(截图脚本会用到)
window.__dog = dog;
window.__anim = anim;
window.__three = { scene, camera, controls, renderer };
window.__api = { get task() { return task?.name; }, get ballMoving() { return ballMoving; }, get move() { return move && { faceOnly: !!move.faceOnly, stop: move.stop }; }, step, homePoint, run, doSit, doLie, doPaw, doScratch, doFeed, doBath, doSleep, throwBall, setBallMode, get state() { return state; } };
