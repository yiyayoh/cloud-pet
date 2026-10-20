// 场景:暖色房间、木地板、窗光和柔和阴影
import * as THREE from 'three';
import { OrbitControls } from '../../vendor/three/addons/OrbitControls.js';
import { RoomEnvironment } from '../../vendor/three/addons/RoomEnvironment.js';

function woodTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const g = c.getContext('2d');
  const planks = 6;
  for (let i = 0; i < planks; i++) {
    const h = 512 / planks;
    const base = 150 + Math.random() * 25;
    g.fillStyle = `rgb(${base + 40},${base},${base - 45})`;
    g.fillRect(0, i * h, 512, h);
    for (let k = 0; k < 40; k++) {
      g.strokeStyle = `rgba(90,55,25,${0.04 + Math.random() * 0.06})`;
      g.lineWidth = 1 + Math.random() * 2;
      const y = i * h + Math.random() * h;
      g.beginPath();
      g.moveTo(0, y);
      g.bezierCurveTo(170, y + Math.random() * 6 - 3, 340, y + Math.random() * 6 - 3, 512, y);
      g.stroke();
    }
    g.fillStyle = 'rgba(60,35,15,.35)';
    g.fillRect(0, i * h, 512, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 3);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function rugTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 10, 128, 128, 128);
  grd.addColorStop(0, '#C9786A');
  grd.addColorStop(0.75, '#B86A5C');
  grd.addColorStop(0.8, '#E8C9A8');
  grd.addColorStop(0.86, '#B86A5C');
  grd.addColorStop(1, '#A65C50');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4000; i++) {
    g.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 1, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#E9D9C6');
  scene.fog = new THREE.Fog('#E9D9C6', 4, 9);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.45;

  const camera = new THREE.PerspectiveCamera(36, 1, 0.05, 30);
  camera.position.set(0.75, 0.8, 2.15);

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 0.33, 0.05);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 0.9;
  controls.maxDistance = 3.2;
  controls.minPolarAngle = 0.35;
  controls.maxPolarAngle = 1.45;
  controls.update();

  const hemi = new THREE.HemisphereLight('#FFF4E6', '#8A6A4A', 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#FFE7C7', 2.6);
  sun.position.set(1.6, 2.8, 1.8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -1.5;
  sun.shadow.camera.right = 1.5;
  sun.shadow.camera.top = 1.5;
  sun.shadow.camera.bottom = -1.5;
  sun.shadow.radius = 6;
  sun.shadow.bias = -0.0005;
  scene.add(sun);
  const rim = new THREE.DirectionalLight('#CFE0FF', 0.7);
  rim.position.set(-2, 1.5, -2);
  scene.add(rim);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 12),
    new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.75 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const rug = new THREE.Mesh(
    new THREE.CircleGeometry(0.85, 64),
    new THREE.MeshStandardMaterial({ map: rugTexture(), roughness: 1 }),
  );
  rug.rotation.x = -Math.PI / 2;
  rug.position.y = 0.003;
  rug.receiveShadow = true;
  scene.add(rug);

  // 背后的墙
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(12, 5), new THREE.MeshStandardMaterial({ color: '#EADBC8', roughness: 1 }));
  wall.position.set(0, 2.5, -2.2);
  wall.receiveShadow = true;
  scene.add(wall);

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < h ? 54 : 36;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  return { renderer, scene, camera, controls, lights: { hemi, sun, rim }, floor, resize };
}
