// 3D 小狗的模型:用骨骼带动的身体 + 多层壳体毛发(shell fur)。
// 身体由几个光滑的椭球和胶囊拼成,毛发把接缝都盖住了;每个部件绑在一根骨头上,动画只需要转骨头。
import * as THREE from 'three';
import { mergeGeometries } from '../../vendor/three/addons/BufferGeometryUtils.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// 站立姿势下各关节的位置(米)。狗面朝 +Z,+X 是它的左边。
const JOINTS = {
  root: [V(0, 0.41, -0.12), null],
  spine: [V(0, 0.41, 0.05), 'root'],
  chest: [V(0, 0.42, 0.17), 'spine'],
  neck: [V(0, 0.48, 0.25), 'chest'],
  head: [V(0, 0.58, 0.32), 'neck'],
  jaw: [V(0, 0.59, 0.40), 'head'],
  earL: [V(0.088, 0.73, 0.35), 'head'],
  earR: [V(-0.088, 0.73, 0.35), 'head'],
  shoulderL: [V(0.09, 0.38, 0.2), 'chest'],
  elbowL: [V(0.09, 0.2, 0.22), 'shoulderL'],
  shoulderR: [V(-0.09, 0.38, 0.2), 'chest'],
  elbowR: [V(-0.09, 0.2, 0.22), 'shoulderR'],
  hipL: [V(0.105, 0.37, -0.2), 'root'],
  kneeL: [V(0.105, 0.2, -0.27), 'hipL'],
  hipR: [V(-0.105, 0.37, -0.2), 'root'],
  kneeR: [V(-0.105, 0.2, -0.27), 'hipR'],
  tail1: [V(0, 0.46, -0.33), 'root'],
  tail2: [V(0, 0.52, -0.42), 'tail1'],
  tail3: [V(0, 0.56, -0.5), 'tail2'],
};

const EYE_L = V(0.052, 0.672, 0.468);
const EYE_R = V(-0.052, 0.672, 0.468);
const NOSE = V(0, 0.628, 0.6);

const WHITE = new THREE.Color('#EEE8DE');
const CREAM = new THREE.Color('#CDB89C');
const PALE = new THREE.Color('#F4F0E9');

function ellipsoid(c, r, segs = [32, 24]) {
  const g = new THREE.SphereGeometry(1, segs[0], segs[1]);
  g.scale(r[0], r[1], r[2]);
  g.translate(c.x, c.y, c.z);
  return g;
}

function capsule(a, b, r) {
  const len = a.distanceTo(b);
  const g = new THREE.CapsuleGeometry(r, len, 8, 20);
  const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize());
  g.applyQuaternion(q);
  const m = a.clone().add(b).multiplyScalar(0.5);
  g.translate(m.x, m.y, m.z);
  return g;
}

function rotateAbout(g, pivot, euler) {
  g.translate(-pivot.x, -pivot.y, -pivot.z);
  g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(euler));
  g.translate(pivot.x, pivot.y, pivot.z);
  return g;
}

function mirrorX(v) {
  return V(-v.x, v.y, v.z);
}

// 每个部件:几何体、所属骨头、毛长系数、颜色
function parts() {
  const P = [];
  const add = (geo, bone, fur, color = WHITE) => P.push({ geo, bone, fur, color });
  const J = (n) => JOINTS[n][0];

  add(ellipsoid(V(0, 0.40, 0.0), [0.16, 0.16, 0.28]), 'spine', 1.0);
  add(ellipsoid(V(0, 0.41, 0.17), [0.15, 0.175, 0.15]), 'chest', 1.2);
  add(ellipsoid(V(0, 0.41, -0.2), [0.145, 0.155, 0.15]), 'root', 1.0);
  add(capsule(V(0, 0.47, 0.23), V(0, 0.58, 0.32), 0.096), 'neck', 1.3);

  add(ellipsoid(V(0, 0.665, 0.37), [0.115, 0.105, 0.12]), 'head', 0.85);
  add(ellipsoid(V(0, 0.62, 0.405), [0.105, 0.075, 0.09]), 'head', 0.95);
  add(ellipsoid(V(0, 0.612, 0.49), [0.06, 0.054, 0.115]), 'head', 0.6, PALE);
  add(ellipsoid(V(0, 0.578, 0.47), [0.046, 0.024, 0.09]), 'jaw', 0.55, PALE);

  for (const s of [1, -1]) {
    const L = s > 0 ? 'L' : 'R';
    const m = (v) => (s > 0 ? v : mirrorX(v));
    // 半垂的耳朵
    const ear = ellipsoid(m(V(0.138, 0.645, 0.35)), [0.022, 0.1, 0.045]);
    rotateAbout(ear, J(`ear${L}`), new THREE.Euler(0.18, 0, -0.16 * s));
    add(ear, `ear${L}`, 0.9, CREAM);
    // 前腿
    add(capsule(m(V(0.09, 0.38, 0.2)), m(V(0.09, 0.2, 0.22)), 0.055), `shoulder${L}`, 0.9);
    add(capsule(m(V(0.09, 0.2, 0.22)), m(V(0.09, 0.05, 0.22)), 0.042), `elbow${L}`, 0.7);
    add(ellipsoid(m(V(0.09, 0.03, 0.25)), [0.045, 0.03, 0.06]), `elbow${L}`, 0.5);
    // 后腿
    add(ellipsoid(m(V(0.105, 0.31, -0.21)), [0.07, 0.12, 0.1]), `hip${L}`, 1.0);
    add(capsule(m(V(0.105, 0.2, -0.27)), m(V(0.105, 0.05, -0.24)), 0.04), `knee${L}`, 0.7);
    add(ellipsoid(m(V(0.105, 0.03, -0.22)), [0.042, 0.03, 0.058]), `knee${L}`, 0.5);
  }

  add(capsule(J('tail1'), J('tail2'), 0.036), 'tail1', 1.5);
  add(capsule(J('tail2'), J('tail3'), 0.031), 'tail2', 1.7);
  add(capsule(J('tail3'), V(0, 0.57, -0.57), 0.025), 'tail3', 1.9);
  return P;
}

// 眼睛、鼻子、嘴角周围不长毛,不然会被毛盖住
function furMask(p) {
  const d = Math.min(p.distanceTo(EYE_L), p.distanceTo(EYE_R));
  const eye = THREE.MathUtils.clamp((d - 0.02) / 0.035, 0.12, 1);
  const nose = THREE.MathUtils.clamp((p.distanceTo(NOSE) - 0.02) / 0.03, 0.05, 1);
  return eye * nose;
}

// ---------- 毛发材质 ----------

export function createFurUniforms() {
  return {
    uLen: { value: 0.05 },
    uTime: { value: 0 },
    uDensity: { value: 430 },
    uWet: { value: 0 },
    uDirt: { value: 0 },
  };
}

function furMaterial(layer, shared) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.93, metalness: 0 });
  m.customProgramCacheKey = () => 'dog-fur';
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uLayer = { value: layer };
    Object.assign(shader.uniforms, shared);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uLayer, uLen, uTime, uWet;
        attribute float aFur;
        varying vec3 vFurPos;`)
      .replace('#include <skinning_vertex>', `#include <skinning_vertex>
        {
          float L = uLen * aFur * (1.0 - 0.62 * uWet);
          vec3 n = normalize(objectNormal);
          vec3 messy = vec3(sin(position.y * 37.0 + position.z * 23.0),
                            sin(position.z * 31.0 + position.x * 29.0),
                            cos(position.x * 41.0 + position.y * 17.0));
          vec3 d = n * uLayer * L + messy * uLayer * uLayer * L * 0.22;
          d.z -= uLayer * uLayer * L * 0.35;
          d.y -= uLayer * uLayer * L * (0.5 + 0.9 * uWet);
          d.xz += vec2(sin(uTime * 1.3 + position.x * 6.0), cos(uTime * 1.1 + position.z * 6.0)) * uLayer * uLayer * L * 0.08;
          transformed += d;
        }
        vFurPos = position;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uLayer, uDensity, uWet, uDirt;
        varying vec3 vFurPos;
        float fh(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
        float vnoise(vec3 p) {
          vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(fh(i), fh(i + vec3(1,0,0)), f.x), mix(fh(i + vec3(0,1,0)), fh(i + vec3(1,1,0)), f.x), f.y),
                     mix(mix(fh(i + vec3(0,0,1)), fh(i + vec3(1,0,1)), f.x), mix(fh(i + vec3(0,1,1)), fh(i + vec3(1,1,1)), f.x), f.y), f.z);
        }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          float clump = vnoise(vFurPos * 22.0);
          if (uLayer > 0.0) {
            vec3 p = vFurPos * uDensity;
            vec3 f = fract(p) - 0.5;
            float h = fh(floor(p)) * (0.5 + 0.7 * clump);
            if (h < uLayer || length(f.xy) + abs(f.z) * 0.35 > (1.0 - uLayer) * 0.58 + 0.03) discard;
          }
          diffuseColor.rgb *= mix(0.5, 1.03, pow(uLayer, 0.6)) * (0.92 + 0.12 * clump);
          float dirt = uDirt * smoothstep(0.45, 0.72, vnoise(vFurPos * 9.0));
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.7, 0.6, 0.46), dirt);
          diffuseColor.rgb *= 1.0 - 0.22 * uWet;
        }`);
  };
  return m;
}

// ---------- 组装 ----------

export function buildDog({ layers = 32 } = {}) {
  const bones = {};
  for (const [name, [pos, parent]] of Object.entries(JOINTS)) {
    const b = new THREE.Bone();
    b.name = name;
    b.position.copy(parent ? pos.clone().sub(JOINTS[parent][0]) : pos);
    bones[name] = b;
  }
  for (const [name, [, parent]] of Object.entries(JOINTS)) if (parent) bones[parent].add(bones[name]);
  const boneList = Object.values(bones);
  const index = Object.fromEntries(boneList.map((b, i) => [b.name, i]));

  const geos = parts().map(({ geo, bone, fur, color }) => {
    const n = geo.attributes.position.count;
    const skinIndex = new Uint16Array(n * 4);
    const skinWeight = new Float32Array(n * 4);
    const aFur = new Float32Array(n);
    const col = new Float32Array(n * 3);
    const p = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      skinIndex[i * 4] = index[bone];
      skinWeight[i * 4] = 1;
      p.fromBufferAttribute(geo.attributes.position, i);
      aFur[i] = fur * furMask(p);
      col.set([color.r, color.g, color.b], i * 3);
    }
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));
    geo.setAttribute('aFur', new THREE.Float32BufferAttribute(aFur, 1));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return geo;
  });
  const geometry = mergeGeometries(geos);

  const uniforms = createFurUniforms();
  const group = new THREE.Group();
  const base = new THREE.SkinnedMesh(geometry, furMaterial(0, uniforms));
  base.castShadow = true;
  base.frustumCulled = false;
  base.add(bones.root);
  group.add(base);
  base.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(boneList);
  base.bind(skeleton);

  const shells = [];
  for (let i = 1; i <= layers; i++) {
    const s = new THREE.SkinnedMesh(geometry, furMaterial(i / layers, uniforms));
    s.frustumCulled = false;
    s.bind(skeleton, base.bindMatrix);
    group.add(s);
    shells.push(s);
  }

  // 不长毛的部分:眼睛、鼻子、嘴、舌头
  const local = (bone, world) => world.clone().sub(JOINTS[bone][0]);
  const eyeMat = new THREE.MeshPhysicalMaterial({ color: '#1c0f07', roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05 });
  const eyes = [EYE_L, EYE_R].map((w) => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.0175, 24, 16), eyeMat);
    e.position.copy(local('head', w));
    e.scale.z = 0.7;
    bones.head.add(e);
    return e;
  });
  const nose = new THREE.Mesh(
    new THREE.SphereGeometry(1, 24, 16),
    new THREE.MeshPhysicalMaterial({ color: '#1a1414', roughness: 0.55, clearcoat: 0.35, clearcoatRoughness: 0.45 }),
  );
  nose.scale.set(0.021, 0.015, 0.016);
  nose.position.copy(local('head', NOSE));
  bones.head.add(nose);

  const mouth = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), new THREE.MeshStandardMaterial({ color: '#3a1616', roughness: 0.6 }));
  mouth.scale.set(0.042, 0.012, 0.08);
  mouth.position.copy(local('head', V(0, 0.594, 0.495)));
  bones.head.add(mouth);

  const tongue = new THREE.Mesh(
    new THREE.SphereGeometry(1, 20, 12),
    new THREE.MeshPhysicalMaterial({ color: '#E57D88', roughness: 0.35, clearcoat: 0.4 }),
  );
  tongue.scale.set(0.028, 0.007, 0.05);
  tongue.position.copy(local('jaw', V(0, 0.59, 0.505)));
  bones.jaw.add(tongue);

  // 点击检测用的隐形球
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  const hit = [
    ['head', V(0, 0.65, 0.41), 0.16],
    ['chest', V(0, 0.42, 0.17), 0.2],
    ['spine', V(0, 0.40, 0.0), 0.2],
    ['root', V(0, 0.40, -0.2), 0.19],
  ].map(([bone, w, r]) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), hitMat);
    m.position.copy(local(bone, w));
    m.userData.part = bone;
    bones[bone].add(m);
    return m;
  });

  return { group, base, shells, bones, uniforms, eyes, tongue, hit, joints: JOINTS };
}
