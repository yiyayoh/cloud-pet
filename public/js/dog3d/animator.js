// 骨骼动画:姿势之间平滑过渡,再叠加摇尾巴、看人、呼吸、走路、甩水等程序动画
import * as THREE from 'three';

// 各姿势相对站姿的骨骼旋转(弧度)和身体下沉量
export const POSES = {
  stand: { rootY: 0, bones: {} },
  feed: {
    rootY: -0.045,
    bones: {
      root: [0.06, 0, 0],
      shoulderL: [-0.55, 0, 0], shoulderR: [-0.55, 0, 0],
      elbowL: [1.05, 0, 0], elbowR: [1.05, 0, 0],
      hipL: [0.25, 0, 0], hipR: [0.25, 0, 0],
      kneeL: [-0.45, 0, 0], kneeR: [-0.45, 0, 0],
      neck: [0.55, 0, 0], head: [-0.25, 0, 0],
    },
  },
  sit: {
    rootY: -0.165,
    bones: {
      root: [-0.6, 0, 0],
      shoulderL: [0.6, 0, 0], shoulderR: [0.6, 0, 0],
      hipL: [-0.95, 0, -0.1], hipR: [-0.95, 0, 0.1],
      kneeL: [2.1, 0, 0], kneeR: [2.1, 0, 0],
      neck: [0.3, 0, 0], head: [0.25, 0, 0],
      tail1: [1.0, 0, 0], tail2: [0.3, 0, 0],
    },
  },
  paw: {
    rootY: -0.165,
    bones: {
      root: [-0.6, 0, 0],
      shoulderL: [0.6, 0, 0], shoulderR: [-0.75, 0, -0.15],
      elbowR: [0.5, 0, 0],
      hipL: [-0.95, 0, -0.1], hipR: [-0.95, 0, 0.1],
      kneeL: [2.1, 0, 0], kneeR: [2.1, 0, 0],
      neck: [0.3, 0, 0], head: [0.15, 0, -0.15],
      tail1: [1.0, 0, 0], tail2: [0.3, 0, 0],
    },
  },
  scratch: {
    rootY: -0.165,
    bones: {
      root: [-0.6, 0, -0.08],
      shoulderL: [0.6, 0, 0], shoulderR: [0.6, 0, 0],
      hipL: [-2.35, 0.1, 0.6], hipR: [-0.95, 0, 0.1],
      kneeL: [1.5, 0, 0], kneeR: [2.1, 0, 0],
      neck: [0.25, 0.35, 0.25], head: [0.2, 0.2, 0.45],
      tail1: [1.0, 0, 0], tail2: [0.3, 0, 0],
    },
  },
  lie: {
    rootY: -0.215,
    bones: {
      shoulderL: [-1.4, 0, 0.05], shoulderR: [-1.4, 0, -0.05],
      elbowL: [0.15, 0, 0], elbowR: [0.15, 0, 0],
      hipL: [-1.35, 0, -0.35], hipR: [-1.35, 0, 0.35],
      kneeL: [2.5, 0, 0], kneeR: [2.5, 0, 0],
      neck: [-0.1, 0, 0], head: [0.15, 0, 0],
      tail1: [1.1, 0.4, 0], tail2: [0.2, 0.3, 0],
    },
  },
  sleep: {
    rootY: -0.225,
    bones: {
      root: [0, 0, 0.12],
      shoulderL: [-1.4, 0, 0.05], shoulderR: [-1.4, 0, -0.05],
      elbowL: [0.15, 0, 0], elbowR: [0.15, 0, 0],
      hipL: [-1.35, 0, -0.35], hipR: [-1.35, 0, 0.35],
      kneeL: [2.5, 0, 0], kneeR: [2.5, 0, 0],
      neck: [0.6, 0.3, 0], head: [0.4, 0.15, 0.2],
      tail1: [1.2, 0.9, 0], tail2: [0.3, 0.8, 0], tail3: [0, 0.5, 0],
    },
  },
};

const ease = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

export class Animator {
  constructor(dog) {
    this.dog = dog;
    this.b = dog.bones;
    this.rootBaseY = this.b.root.position.y;
    this.cur = {};
    for (const name in this.b) this.cur[name] = [0, 0, 0];
    this.pose = 'stand';
    this.rootY = 0;
    this.v = {
      wag: 0.25, wagT: 0.25, wagFreq: 1.6, wagFreqT: 1.6,
      jaw: 0, jawT: 0, tongue: 0, tongueT: 0,
      eyes: 1, eyesT: 1, ears: 0, earsT: 0,
      tilt: 0, tiltT: 0, headDown: 0, headDownT: 0,
      look: 0, lookT: 0.8, walk: 0, lean: 0, leanT: 0,
    };
    this.lookAt = new THREE.Vector3(0, 0.6, 2);
    this.pant = false;
    this.chew = false;
    this.shake = 0;
    this.scratching = false;
    this.phase = 0;
    this.blinkIn = 2;
    this.blink = 0;
    this._tmp = new THREE.Vector3();
  }

  setPose(name) {
    this.pose = name;
  }

  set(key, value) {
    this.v[`${key}T`] = value;
  }

  update(dt, t) {
    const { b, v } = this;
    const target = POSES[this.pose];
    const rate = this.pose === 'stand' ? 7 : 5;

    for (const k of Object.keys(v)) {
      if (k.endsWith('T')) continue;
      if (`${k}T` in v) v[k] = ease(v[k], v[`${k}T`], k === 'jaw' ? 18 : 8, dt);
    }
    if (this.pant) v.jawT = 0.32 + 0.12 * Math.sin(t * 13);
    if (this.chew) v.jawT = 0.15 + 0.25 * Math.max(0, Math.sin(t * 11));

    for (const name in b) {
      const goal = target.bones[name] || [0, 0, 0];
      const c = this.cur[name];
      for (let i = 0; i < 3; i++) c[i] = ease(c[i], goal[i], rate, dt);
      b[name].rotation.set(c[0], c[1], c[2]);
    }
    this.rootY = ease(this.rootY, target.rootY, rate, dt);

    // 呼吸
    const breath = Math.sin(t * (this.pose === 'sleep' ? 1.6 : 3.2));
    b.chest.rotation.x += breath * 0.012;
    let y = this.rootY + breath * 0.002;

    // 走路/跑步
    if (v.walk > 0.01) {
      this.phase += dt * (6 + v.walk * 6);
      const s = Math.sin(this.phase);
      const a = 0.55 * Math.min(1, v.walk);
      b.shoulderL.rotation.x += s * a;
      b.shoulderR.rotation.x -= s * a;
      b.hipL.rotation.x -= s * a * 0.9;
      b.hipR.rotation.x += s * a * 0.9;
      b.elbowL.rotation.x += Math.max(0, -Math.cos(this.phase)) * a * 1.1;
      b.elbowR.rotation.x += Math.max(0, Math.cos(this.phase)) * a * 1.1;
      b.kneeL.rotation.x -= Math.max(0, Math.cos(this.phase)) * a * 0.6;
      b.kneeR.rotation.x -= Math.max(0, -Math.cos(this.phase)) * a * 0.6;
      y += Math.abs(Math.sin(this.phase)) * 0.014 * Math.min(1, v.walk);
      b.root.rotation.x += Math.sin(this.phase * 2) * 0.03 * v.walk;
    }
    b.root.position.y = this.rootBaseY + y;

    // 摇尾巴
    v.wagFreq = ease(v.wagFreq, v.wagFreqT, 4, dt);
    this.wagPhase = (this.wagPhase || 0) + dt * v.wagFreq * Math.PI * 2;
    const w = Math.sin(this.wagPhase) * v.wag;
    b.tail1.rotation.y += w;
    b.tail2.rotation.y += Math.sin(this.wagPhase - 0.7) * v.wag * 0.8;
    b.tail3.rotation.y += Math.sin(this.wagPhase - 1.4) * v.wag * 0.6;
    b.tail1.rotation.x -= v.wag * 0.25;

    // 看向目标(默认看镜头)
    if (v.look > 0.01) {
      const local = this.dog.group.worldToLocal(this._tmp.copy(this.lookAt));
      const dx = local.x;
      const dz = local.z - 0.4;
      const dy = local.y - 0.62 - this.rootY;
      const yaw = THREE.MathUtils.clamp(Math.atan2(dx, Math.max(0.05, dz)), -1.1, 1.1);
      const pitch = THREE.MathUtils.clamp(Math.atan2(dy, Math.hypot(dx, dz)), -0.6, 0.7);
      b.neck.rotation.y += yaw * 0.4 * v.look;
      b.head.rotation.y += yaw * 0.55 * v.look;
      b.head.rotation.x -= pitch * 0.7 * v.look;
    }
    b.head.rotation.z += v.tilt;
    b.neck.rotation.x += v.headDown * 0.95;
    b.head.rotation.x += v.headDown * 0.45;
    b.spine.rotation.z += v.lean;
    b.chest.rotation.z += v.lean * 0.6;

    // 嘴、舌头
    b.jaw.rotation.x = v.jaw * 0.5;
    const tg = this.dog.tongue;
    tg.scale.z = 0.05 * (1 + 0.7 * v.tongue);
    tg.position.z = this._tongueZ ?? (this._tongueZ = tg.position.z);
    tg.position.z += 0.03 * v.tongue;
    tg.position.y = (this._tongueY ?? (this._tongueY = tg.position.y)) - 0.012 * v.tongue;

    // 耳朵:正值竖起,走路时会甩
    const flop = Math.sin(this.phase * 2) * 0.12 * Math.min(1, v.walk);
    b.earL.rotation.z += v.ears * 0.45 + flop;
    b.earR.rotation.z -= v.ears * 0.45 + flop;
    b.earL.rotation.x -= v.ears * 0.2;
    b.earR.rotation.x -= v.ears * 0.2;

    // 挠痒痒:后腿快速抖动
    if (this.scratching) {
      b.hipL.rotation.x += Math.sin(t * 26) * 0.18;
      b.kneeL.rotation.x += Math.sin(t * 26 + 0.5) * 0.25;
    }

    // 甩水
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
      const env = Math.sin(Math.min(1, this.shake / 1.4) * Math.PI);
      const s = Math.sin(t * 30);
      b.root.rotation.z += s * 0.25 * env;
      b.spine.rotation.z -= s * 0.35 * env;
      b.chest.rotation.z += s * 0.3 * env;
      b.neck.rotation.z -= s * 0.35 * env;
      b.head.rotation.z += s * 0.3 * env;
      b.earL.rotation.z += s * 0.8 * env;
      b.earR.rotation.z += s * 0.8 * env;
    }

    // 眨眼
    this.blinkIn -= dt;
    if (this.blinkIn <= 0) {
      this.blink = 0.14;
      this.blinkIn = 2 + Math.random() * 4;
    }
    this.blink = Math.max(0, this.blink - dt);
    const open = Math.max(0.06, v.eyes * (this.blink > 0 ? 0.1 : 1));
    for (const e of this.dog.eyes) e.scale.y = open;

    this.dog.uniforms.uTime.value = t;
  }
}
