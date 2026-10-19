// 宠物的核心规则:属性衰减、成长、金币与道具。不碰 DOM,浏览器和 Node 测试都能用。
(function (root) {
  'use strict';

  const HOUR = 3_600_000;
  const DAY = 86_400_000;

  // 醒着时每小时下降的点数(满值 100)
  const DECAY = { hunger: 6, happy: 5, clean: 3, energy: 4 };
  // 睡着时下降得慢,精力反而会恢复
  const SLEEP_DECAY = { hunger: 2, happy: 0, clean: 1 };
  const SLEEP_ENERGY_GAIN = 25;

  const DAILY_BONUS = 20;
  const STROKE_COIN_DAILY_CAP = 30;
  const STROKE_XP_DAILY_CAP = 150;

  const SPECIES = {
    cat: { name: '猫咪' },
    dog: { name: '小狗' },
    rabbit: { name: '兔兔' },
    hamster: { name: '仓鼠' },
    panda: { name: '熊猫' },
    fox: { name: '狐狸' },
    penguin: { name: '企鹅' },
    chick: { name: '小鸡' },
  };

  const STAGES = [
    { id: 'baby', name: '幼崽', xp: 0, scale: 0.72 },
    { id: 'kid', name: '少年', xp: 120, scale: 0.86 },
    { id: 'adult', name: '成年', xp: 400, scale: 1 },
  ];
  const EGG = { id: 'egg', name: '蛋', xp: 0, scale: 0.8 };

  // price 为 0 的食物不限量
  const FOODS = {
    rice: { name: '饭团', icon: '🍙', price: 0, effect: { hunger: 20 } },
    apple: { name: '苹果', icon: '🍎', price: 5, effect: { hunger: 15, happy: 5 } },
    milk: { name: '牛奶', icon: '🥛', price: 8, effect: { hunger: 15, energy: 15 } },
    fish: { name: '小鱼干', icon: '🐟', price: 12, effect: { hunger: 35, happy: 10 } },
    cake: { name: '草莓蛋糕', icon: '🍰', price: 25, effect: { hunger: 25, happy: 30 } },
  };

  const ITEMS = {
    bow: { name: '蝴蝶结', icon: '🎀', slot: 'head', price: 50 },
    flower: { name: '小雏菊', icon: '🌼', slot: 'head', price: 40 },
    partyhat: { name: '派对帽', icon: '🥳', slot: 'head', price: 60 },
    crown: { name: '小王冠', icon: '👑', slot: 'head', price: 200 },
    glasses: { name: '圆眼镜', icon: '👓', slot: 'face', price: 80 },
    scarf: { name: '红围巾', icon: '🧣', slot: 'neck', price: 60 },
    bell: { name: '小铃铛', icon: '🔔', slot: 'neck', price: 70 },
  };

  const STAT_NAMES = { hunger: '饱食', happy: '心情', clean: '清洁', energy: '精力' };

  const clamp = (v) => Math.max(0, Math.min(100, v));

  function dateKey(t) {
    const d = new Date(t);
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  }

  const STYLES = { cute: 'Q 版', real: '写实' };

  function create(name, species, now, style = 'cute') {
    return {
      version: 2,
      name,
      species,
      style: STYLES[style] ? style : 'cute',
      bornAt: now,
      hatchedAt: null,
      updatedAt: now,
      savedAt: now,
      xp: 0,
      coins: 30,
      stats: { hunger: 80, happy: 80, clean: 90, energy: 80 },
      sleeping: false,
      food: { fish: 1 },
      items: [],
      wearing: { head: null, face: null, neck: null },
      daily: { date: null, strokes: 0, strokeCoins: 0 },
      lastDaily: null,
    };
  }

  // 补齐旧数据或残缺数据里缺的字段
  function normalize(s) {
    const base = create(s.name || '小团子', SPECIES[s.species] ? s.species : 'cat', s.bornAt || Date.now());
    const out = Object.assign({}, base, s);
    out.species = base.species;
    out.style = STYLES[s.style] ? s.style : 'cute';
    out.stats = Object.assign({}, base.stats, s.stats);
    out.wearing = Object.assign({ head: null, face: null, neck: null }, s.wearing);
    out.daily = Object.assign({ date: null, strokes: 0, strokeCoins: 0 }, s.daily);
    out.food = Object.assign({}, s.food);
    out.items = Array.isArray(s.items) ? s.items.filter((id) => ITEMS[id]) : [];
    return out;
  }

  function stage(s) {
    if (!s.hatchedAt) return EGG;
    let cur = STAGES[0];
    for (const st of STAGES) if (s.xp >= st.xp) cur = st;
    return cur;
  }

  function nextStage(s) {
    if (!s.hatchedAt) return null;
    const i = STAGES.indexOf(stage(s));
    return STAGES[i + 1] || null;
  }

  function hatch(s, now) {
    s.hatchedAt = now;
    s.updatedAt = now;
  }

  function applyEffect(s, effect) {
    for (const k in effect) s.stats[k] = clamp(s.stats[k] + effect[k]);
  }

  function decay(s, rates, hours) {
    for (const k in rates) s.stats[k] = clamp(s.stats[k] - rates[k] * hours);
  }

  // 按距离上次更新的时长结算属性;离线期间也照样算
  function tick(s, now) {
    const hours = Math.max(0, (now - s.updatedAt) / HOUR);
    s.updatedAt = now;
    if (!s.hatchedAt || hours === 0) return { hours, wokeUp: false };

    let remaining = hours;
    let wokeUp = false;
    if (s.sleeping) {
      const toFull = (100 - s.stats.energy) / SLEEP_ENERGY_GAIN;
      const t = Math.min(remaining, toFull);
      decay(s, SLEEP_DECAY, t);
      s.stats.energy = clamp(s.stats.energy + SLEEP_ENERGY_GAIN * t);
      remaining -= t;
      if (remaining > 0 || s.stats.energy >= 99.999) {
        s.sleeping = false;
        wokeUp = true;
      }
    }
    decay(s, DECAY, remaining);
    return { hours, wokeUp };
  }

  function addXp(s, n) {
    const before = stage(s);
    s.xp += n;
    const after = stage(s);
    return after !== before ? after : null;
  }

  function resetDaily(s, now) {
    const key = dateKey(now);
    if (s.daily.date !== key) s.daily = { date: key, strokes: 0, strokeCoins: 0 };
  }

  function claimDaily(s, now) {
    if (!s.hatchedAt) return 0;
    const key = dateKey(now);
    if (s.lastDaily === key) return 0;
    s.lastDaily = key;
    s.coins += DAILY_BONUS;
    return DAILY_BONUS;
  }

  function canFeed(s, id) {
    const f = FOODS[id];
    if (!f) return 'unknown';
    if (s.sleeping) return 'sleeping';
    if (f.price > 0 && !(s.food[id] > 0)) return 'none';
    if (s.stats.hunger >= 95) return 'full';
    return null;
  }

  function feed(s, id) {
    const reason = canFeed(s, id);
    if (reason) return { ok: false, reason };
    const f = FOODS[id];
    const wasHungry = s.stats.hunger < 40;
    applyEffect(s, f.effect);
    if (f.price > 0 && --s.food[id] <= 0) delete s.food[id];
    return { ok: true, levelUp: addXp(s, wasHungry ? 5 : 3) };
  }

  // 抚摸:每次心情 +2,每摸 8 下给 1 金币(每天有上限)
  function stroke(s, now) {
    if (s.sleeping) return { ok: false, reason: 'sleeping' };
    resetDaily(s, now);
    s.daily.strokes++;
    applyEffect(s, { happy: 2 });
    let coin = 0;
    if (s.daily.strokes % 8 === 0 && s.daily.strokeCoins < STROKE_COIN_DAILY_CAP) {
      s.coins++;
      s.daily.strokeCoins++;
      coin = 1;
    }
    const giveXp = s.daily.strokes % 3 === 0 && s.daily.strokes <= STROKE_XP_DAILY_CAP;
    return { ok: true, coin, levelUp: giveXp ? addXp(s, 1) : null };
  }

  function scrub(s) {
    if (s.stats.clean >= 100) return { ok: false, reason: 'clean', done: true };
    applyEffect(s, { clean: 5 });
    return { ok: true, done: s.stats.clean >= 100, levelUp: addXp(s, 1) };
  }

  function playBall(s) {
    if (s.sleeping) return { ok: false, reason: 'sleeping' };
    if (s.stats.energy < 10) return { ok: false, reason: 'tired' };
    applyEffect(s, { happy: 10, energy: -6, hunger: -3 });
    return { ok: true, levelUp: addXp(s, 3) };
  }

  function canPlayGame(s) {
    if (s.sleeping) return 'sleeping';
    if (s.stats.energy < 15) return 'tired';
    return null;
  }

  function finishGame(s, score) {
    const coins = Math.max(0, Math.min(200, Math.floor(score) || 0));
    s.coins += coins;
    applyEffect(s, { happy: 15, energy: -12, hunger: -6 });
    return { coins, levelUp: addXp(s, 6) };
  }

  function sleep(s) {
    if (s.sleeping) return { ok: false, reason: 'sleeping' };
    if (s.stats.energy >= 90) return { ok: false, reason: 'notTired' };
    s.sleeping = true;
    return { ok: true };
  }

  function wake(s) {
    s.sleeping = false;
    return { ok: true };
  }

  function buy(s, kind, id) {
    const it = kind === 'food' ? FOODS[id] : ITEMS[id];
    if (!it || !(it.price > 0)) return { ok: false, reason: 'unknown' };
    if (kind === 'item' && s.items.includes(id)) return { ok: false, reason: 'owned' };
    if (s.coins < it.price) return { ok: false, reason: 'coins' };
    s.coins -= it.price;
    if (kind === 'food') s.food[id] = (s.food[id] || 0) + 1;
    else s.items.push(id);
    return { ok: true };
  }

  function toggleWear(s, id) {
    const it = ITEMS[id];
    if (!it || !s.items.includes(id)) return { ok: false };
    const on = s.wearing[it.slot] === id;
    s.wearing[it.slot] = on ? null : id;
    return { ok: true, wearing: !on };
  }

  const NEEDS = [
    ['hunger', '肚子咕咕叫了,想吃东西~'],
    ['energy', '好困呀……想睡觉'],
    ['clean', '身上黏黏的,想洗澡澡'],
    ['happy', '好无聊,陪我玩嘛'],
  ];

  // 当前的基础表情,以及最迫切的需求
  function mood(s) {
    if (s.sleeping) return { expr: 'sleep', need: null };
    let need = null;
    for (const [key, line] of NEEDS) {
      if (s.stats[key] < 30 && (!need || s.stats[key] < s.stats[need.key])) need = { key, line };
    }
    return { expr: need && s.stats[need.key] < 15 ? 'sad' : 'normal', need };
  }

  function ageDays(s, now) {
    return Math.floor((now - (s.hatchedAt || s.bornAt)) / DAY);
  }

  const Game = {
    SPECIES, STYLES, STAGES, FOODS, ITEMS, STAT_NAMES, DAILY_BONUS,
    create, normalize, stage, nextStage, hatch, tick, claimDaily,
    canFeed, feed, stroke, scrub, playBall, canPlayGame, finishGame,
    sleep, wake, buy, toggleWear, mood, ageDays,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Game;
  else root.Game = Game;
})(this);
