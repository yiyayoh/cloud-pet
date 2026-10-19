// 云养宠物:纯前端版本,数据保存在 localStorage
const STORAGE_KEY = 'cloud-pet:v1';
const SPECIES = ['🐱', '🐶', '🐰', '🐹', '🐼', '🦊', '🐧', '🐥'];

// 每小时各属性下降的点数(满值 100)
const DECAY_PER_HOUR = { hunger: 8, happy: 6, clean: 4, energy: 5 };

const ACTIONS = {
  feed:  { hunger: +30, clean: -5,  msg: '吃得好香!' },
  play:  { happy: +25, energy: -15, hunger: -5, msg: '玩得好开心!' },
  bath:  { clean: +40, happy: -5,  msg: '香喷喷的~' },
  sleep: { energy: +50, msg: 'Zzz...' },
};

const $ = (id) => document.getElementById(id);
const clamp = (n) => Math.max(0, Math.min(100, n));

let pet = load();
let selectedSpecies = SPECIES[0];

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pet));
  } catch {}
}

// 根据上次更新时间计算离线期间的属性衰减
function tick() {
  if (!pet) return;
  const now = Date.now();
  const hours = (now - pet.updatedAt) / 3_600_000;
  for (const key in DECAY_PER_HOUR) {
    pet.stats[key] = clamp(pet.stats[key] - DECAY_PER_HOUR[key] * hours);
  }
  pet.updatedAt = now;
  save();
}

function adopt() {
  const name = $('petName').value.trim() || '小团子';
  const now = Date.now();
  pet = {
    name,
    species: selectedSpecies,
    bornAt: now,
    updatedAt: now,
    stats: { hunger: 80, happy: 80, clean: 80, energy: 80 },
  };
  save();
  render();
}

function act(type) {
  tick();
  const effect = ACTIONS[type];
  for (const key in pet.stats) {
    if (effect[key]) pet.stats[key] = clamp(pet.stats[key] + effect[key]);
  }
  save();
  render(effect.msg);
  const el = $('pet');
  el.classList.remove('bounce');
  void el.offsetWidth;
  el.classList.add('bounce');
}

function moodText() {
  const s = pet.stats;
  if (s.hunger < 20) return '肚子好饿……';
  if (s.energy < 20) return '好困,想睡觉';
  if (s.clean < 20) return '身上脏脏的';
  if (s.happy < 20) return '有点无聊,陪我玩嘛';
  const avg = (s.hunger + s.happy + s.clean + s.energy) / 4;
  return avg > 70 ? '今天超开心!' : '还不错~';
}

function ageText() {
  const days = Math.floor((Date.now() - pet.bornAt) / 86_400_000);
  return days === 0 ? '今天出生' : `${days} 天大`;
}

function render(message) {
  $('adopt').classList.toggle('hidden', !!pet);
  $('home').classList.toggle('hidden', !pet);
  if (!pet) return renderAdopt();

  $('nameLabel').textContent = pet.name;
  $('ageLabel').textContent = ageText();
  $('pet').textContent = pet.species;
  $('pet').classList.toggle('sleeping', pet.stats.energy < 20);
  $('mood').textContent = message || moodText();

  for (const key in pet.stats) {
    const v = pet.stats[key];
    const bar = $(`bar-${key}`);
    bar.style.width = `${v}%`;
    bar.className = v < 25 ? 'low' : v < 55 ? 'mid' : '';
  }
}

function renderAdopt() {
  const box = $('species');
  box.innerHTML = '';
  for (const s of SPECIES) {
    const b = document.createElement('button');
    b.textContent = s;
    b.classList.toggle('selected', s === selectedSpecies);
    b.onclick = () => { selectedSpecies = s; renderAdopt(); };
    box.appendChild(b);
  }
}

$('adoptBtn').onclick = adopt;
$('releaseBtn').onclick = () => {
  if (!confirm(`确定要和 ${pet.name} 说再见吗?`)) return;
  pet = null;
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
  render();
};
document.querySelectorAll('[data-act]').forEach((b) => {
  b.onclick = () => act(b.dataset.act);
});

tick();
render();
setInterval(() => { tick(); render(); }, 10_000);
