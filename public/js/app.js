// 界面与互动:摸摸、戳戳、拖食物喂、搓泡泡洗澡、扔球、睡觉、商店
(function () {
  'use strict';

  const G = window.Game;
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => [...document.querySelectorAll(sel)];
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const el = {
    adoptView: $('#adoptView'), gameView: $('#gameView'),
    speciesGrid: $('#speciesGrid'), petName: $('#petName'),
    scene: $('#scene'), petWrap: $('#petWrap'), petMotion: $('#petMotion'), petScale: $('#petScale'),
    bubble: $('#bubble'), fx: $('#fx'), ball: $('#ball'), sponge: $('#sponge'),
    hint: $('#hint'), modeBar: $('#modeBar'), modeText: $('#modeText'),
    coins: $('#coins'), toast: $('#toast'),
  };

  let state = null;
  let mode = null;            // null | 'bath' | 'ball' | 'game'
  let panel = null;           // 当前展开的面板
  let shopTab = 'food';
  let builtKey = '';          // 当前 SVG 对应的外观,变了才重画
  let tempExpr = null;        // 临时表情 { expr, until }
  let petX = 50;              // 宠物位置(场景宽度百分比)
  let walking = false;
  let busy = false;           // 正在播放吃东西、扔球等动画
  let lastInteract = 0;
  let lastPointer = 0;
  let poke = { n: 0, t: 0 };
  let eggTaps = 0;
  let selectedSpecies = 'cat';
  let selectedStyle = 'cute';

  const FOOD_LINES = {
    rice: ['饭团真香~', '吧唧吧唧', '吃饱饱!'],
    apple: ['脆脆甜甜!', '咔嚓咔嚓~'],
    milk: ['咕嘟咕嘟~', '喝完精神多了!'],
    fish: ['是小鱼干!!最爱了!', '呜哇好好吃!'],
    cake: ['蛋糕!!今天是什么好日子~', '甜到心里了~'],
  };
  const IDLE_LINES = ['今天也要开开心心~', '(哼着小曲)', '摸摸我的头嘛~', '嘿嘿', '你在干嘛呀?', '我想吃小鱼干!', '陪我玩一会儿?', '你今天好看!'];
  const POKE_LINES = ['嘿嘿~', '干嘛呀~', '痒痒!', '你好呀!', '嗯?', '咕~'];

  // ---------- 存档 ----------
  function save(remote = true) {
    if (state) state.savedAt = Date.now();
    Store.save(state, { remote });
  }

  // ---------- 渲染 ----------
  function render() {
    el.adoptView.hidden = !!state;
    el.gameView.hidden = !state;
    if (!state) return renderAdopt();
    renderPet();
    renderHud();
  }

  function renderAdopt() {
    $$('#styleTabs button').forEach((b) => b.classList.toggle('active', b.dataset.style === selectedStyle));
    el.speciesGrid.innerHTML = '';
    for (const [id, sp] of Object.entries(G.SPECIES)) {
      const b = document.createElement('button');
      b.className = 'species-card' + (id === selectedSpecies ? ' selected' : '');
      b.innerHTML = PetSVG.build(id, { style: selectedStyle }) + `<span>${sp.name}</span>`;
      b.onclick = () => {
        selectedSpecies = id;
        Sound.pop();
        renderAdopt();
      };
      el.speciesGrid.appendChild(b);
    }
  }

  function renderHud() {
    const st = G.stage(state);
    const next = G.nextStage(state);
    $('#hudName').textContent = state.name;
    const inBox = PetSVG.hatchKind(state.species, state.style) === 'box';
    $('#hudStage').textContent = st.id === 'egg' && inBox ? '纸箱' : st.name;
    const days = G.ageDays(state, Date.now());
    $('#hudAge').textContent = state.hatchedAt ? (days === 0 ? '今天出生' : `${days} 天大`) : (inBox ? '躲在纸箱里' : '等待破壳');
    const styleBtn = $('#styleBtn');
    styleBtn.hidden = false;
    styleBtn.textContent = state.style === 'real' ? '🎨 Q 版' : '🎨 写实';
    el.coins.textContent = state.coins;

    $('#xpWrap').hidden = !state.hatchedAt;
    if (next) {
      const pct = ((state.xp - st.xp) / (next.xp - st.xp)) * 100;
      $('#xpBar').style.width = `${pct}%`;
      $('#xpText').textContent = `成长 ${state.xp - st.xp}/${next.xp - st.xp} → ${next.name}`;
    } else {
      $('#xpBar').style.width = '100%';
      $('#xpText').textContent = '已经长大啦 ✨';
    }

    for (const key in state.stats) {
      const v = state.stats[key];
      const bar = $(`#bar-${key}`);
      bar.style.width = `${v}%`;
      bar.className = v < 25 ? 'low' : v < 55 ? 'mid' : '';
    }

    $('#sleepLabel').textContent = state.sleeping ? '起床' : '睡觉';
    $('#sleepIcon').textContent = state.sleeping ? '☀️' : '🌙';
    for (const b of $$('[data-act]')) {
      b.disabled = !state.hatchedAt || (state.sleeping && !['sleep', 'shop'].includes(b.dataset.act));
      b.classList.toggle('active', b.dataset.act === panel || b.dataset.act === mode);
    }
    updateHint();
  }

  function renderPet() {
    const st = G.stage(state);
    const key = [state.species, state.style, st.id, JSON.stringify(state.wearing)].join('|');
    if (key !== builtKey) {
      builtKey = key;
      el.petScale.innerHTML = st.id === 'egg'
        ? PetSVG.egg(state.species, state.style)
        : PetSVG.build(state.species, { style: state.style, wearing: state.wearing, shell: st.id === 'baby' && !state.wearing.head });
    }
    el.petWrap.style.setProperty('--scale', st.scale);
    if (st.id === 'egg') {
      $$('.egg-svg .crack').forEach((c, i) => c.classList.toggle('on', i < eggTaps));
    } else {
      const dirt = state.stats.clean < 60 ? (60 - state.stats.clean) / 60 : 0;
      svg().style.setProperty('--dirt', dirt.toFixed(2));
      applyExpr();
    }
    el.scene.classList.toggle('night', !!state.sleeping);
    el.scene.classList.toggle('stinky', !!state.hatchedAt && state.stats.clean < 20);
  }

  function updateHint() {
    let text = '';
    if (!state.hatchedAt) {
      text = PetSVG.hatchKind(state.species, state.style) === 'box'
        ? '纸箱在动……轻轻点点,看看里面是谁 📦'
        : '轻轻点蛋蛋,帮它破壳吧 🥚';
    }
    else if (state.sleeping) text = '嘘……它在睡觉,精力会慢慢恢复';
    else if (!mode && !panel) text = '用手指在它身上来回摸摸,或者戳它一下~';
    el.hint.textContent = text;
  }

  // ---------- 表情、说话、特效 ----------
  const svg = () => el.petScale.querySelector('svg');
  const isPetSvg = () => svg()?.classList.contains('pet-svg');

  function applyExpr() {
    if (!isPetSvg()) return;
    let expr = G.mood(state).expr;
    if (tempExpr && Date.now() < tempExpr.until && !state.sleeping) expr = tempExpr.expr;
    svg().dataset.expr = expr;
  }

  function setExpr(expr, ms) {
    tempExpr = { expr, until: Date.now() + ms };
    applyExpr();
    clearTimeout(setExpr.timer);
    setExpr.timer = setTimeout(applyExpr, ms + 20);
  }

  function say(text, ms = 2600) {
    el.bubble.textContent = text;
    el.bubble.classList.remove('show');
    void el.bubble.offsetWidth;
    el.bubble.classList.add('show');
    clearTimeout(say.timer);
    say.timer = setTimeout(() => el.bubble.classList.remove('show'), ms);
    Sound.blip();
  }

  function bump(cls) {
    const m = el.petMotion;
    m.classList.remove('hop', 'squish', 'wobble', 'shake', 'nope', 'spin');
    void m.offsetWidth;
    m.classList.add(cls);
    clearTimeout(bump.timer);
    bump.timer = setTimeout(() => m.classList.remove(cls), 950);
  }

  function toast(text) {
    el.toast.textContent = text;
    el.toast.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.toast.classList.remove('show'), 2400);
  }

  function sceneXY(cx, cy) {
    const r = el.scene.getBoundingClientRect();
    return [cx - r.left, cy - r.top];
  }

  // 宠物身上某一点(按 SVG 外框比例)在场景里的坐标
  function petPoint(fx, fy) {
    const r = svg().getBoundingClientRect();
    return sceneXY(r.left + r.width * fx, r.top + r.height * fy);
  }

  function mouthClient() {
    const r = svg().getBoundingClientRect();
    return [r.left + r.width * 0.5, r.top + r.height * Number(svg().dataset.mouthY || 0.67)];
  }

  function spawn(cls, x, y, html = '', opts = {}) {
    const p = document.createElement('div');
    p.className = `particle ${cls}`;
    p.innerHTML = html;
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    p.style.setProperty('--dx', `${opts.dx ?? rand(-30, 30)}px`);
    p.style.setProperty('--dy', `${opts.dy ?? -80}px`);
    p.style.setProperty('--rot', `${rand(-40, 40)}deg`);
    if (opts.delay) p.style.animationDelay = `${opts.delay}ms`;
    if (opts.style) Object.assign(p.style, opts.style);
    el.fx.appendChild(p);
    if (!opts.stay) p.addEventListener('animationend', () => p.remove());
    return p;
  }

  function hearts(n = 1) {
    for (let i = 0; i < n; i++) {
      const [x, y] = petPoint(rand(0.3, 0.7), rand(0.2, 0.4));
      spawn('heart', x, y, pick(['💗', '💕', '💖']), { delay: i * 130 });
    }
  }

  function sparkles(n = 6) {
    for (let i = 0; i < n; i++) {
      const [x, y] = petPoint(rand(0.1, 0.9), rand(0.15, 0.85));
      spawn('sparkle', x, y, '✨', { delay: i * 80 });
    }
  }

  function confetti() {
    const colors = ['#FF8A65', '#FFD54F', '#81C784', '#64B5F6', '#BA68C8', '#FF8FB1'];
    const [x, y] = petPoint(0.5, 0.3);
    for (let i = 0; i < 30; i++) {
      spawn('confetti', x, y, '', {
        dx: rand(-170, 170), dy: rand(-140, 140),
        style: { background: pick(colors) }, delay: rand(0, 120),
      });
    }
  }

  function coinPop(n) {
    const [x, y] = petPoint(0.5, 0.1);
    spawn('coin', x, y, `<i class="coin-ico"></i>+${n}`, { dx: 0, dy: -60 });
    el.coins.parentElement.classList.remove('bump');
    void el.coins.offsetWidth;
    el.coins.parentElement.classList.add('bump');
    Sound.coin();
  }

  // 眼睛跟着手指/鼠标转
  function lookAt(cx, cy) {
    if (!isPetSvg()) return;
    const r = svg().getBoundingClientRect();
    const dx = cx - (r.left + r.width / 2);
    const dy = cy - (r.top + r.height * 0.56);
    const d = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, d / 120) * 4.5;
    look((dx / d) * k, (dy / d) * k);
  }

  function look(x, y) {
    if (!isPetSvg()) return;
    const k = Number(svg().dataset.look || 1);
    x *= k;
    y *= k;
    if (el.petScale.classList.contains('flip')) x = -x;
    for (const g of svg().querySelectorAll('.eyes-look')) g.style.transform = `translate(${x}px, ${y}px)`;
  }

  function overPet(e, pad = 0) {
    if (!svg()) return false;
    const r = svg().getBoundingClientRect();
    const ix = r.width * 0.12 - pad;
    const iy = r.height * 0.15 - pad;
    return e.clientX > r.left + ix && e.clientX < r.right - ix && e.clientY > r.top + iy && e.clientY < r.bottom;
  }

  function walkTo(x, speed = 30) {
    x = Math.max(14, Math.min(86, x));
    const d = Math.abs(x - petX);
    if (d < 1) return Promise.resolve();
    el.petScale.classList.toggle('flip', x < petX);
    const dur = (d / speed) * 1000;
    el.petWrap.style.transition = `left ${dur}ms linear`;
    el.petWrap.style.left = `${x}%`;
    petX = x;
    el.petMotion.classList.add('walking');
    walking = true;
    return wait(dur).then(() => {
      el.petMotion.classList.remove('walking');
      walking = false;
    });
  }

  function celebrate(stage) {
    render();
    Sound.levelup();
    confetti();
    bump('spin');
    setExpr('happy', 2500);
    say(`我长大啦!现在是${stage.name}了~`, 3500);
    toast(`🎉 ${state.name} 成长为「${stage.name}」!`);
  }

  // 每次互动之后统一收尾
  function after(result) {
    lastInteract = Date.now();
    if (result?.levelUp) celebrate(result.levelUp);
    renderPet();
    renderHud();
    save();
  }

  // ---------- 领养与破壳 ----------
  function adopt() {
    const name = el.petName.value.trim() || '小团子';
    state = G.create(name, selectedSpecies, Date.now(), selectedStyle);
    eggTaps = 0;
    builtKey = '';
    save();
    render();
    Sound.pop();
    toast(PetSVG.hatchKind(state.species, state.style) === 'box' ? `领养成功!${name} 躲在纸箱里呢` : `领养成功!${name} 还在蛋里哦`);
  }

  async function tapEgg() {
    if (busy) return;
    eggTaps++;
    Sound.poke();
    bump('wobble');
    renderPet();
    const [x, y] = petPoint(rand(0.3, 0.7), rand(0.3, 0.6));
    spawn('sparkle', x, y, '✨');
    if (eggTaps < 4) return;

    busy = true;
    await wait(450);
    G.hatch(state, Date.now());
    builtKey = '';
    render();
    Sound.levelup();
    confetti();
    setExpr('surprised', 900);
    bump('hop');
    say('……?', 900);
    await wait(1000);
    setExpr('happy', 2000);
    say(`你好呀!我是${state.name},请多多关照~`, 3800);
    hearts(3);
    save();
    busy = false;
    setTimeout(claimDaily, 2500);
  }

  function claimDaily() {
    const bonus = G.claimDaily(state, Date.now());
    if (!bonus) return;
    toast(`每日签到 +${bonus} 金币 🎁`);
    coinPop(bonus);
    renderHud();
    save();
  }

  // ---------- 摸摸、戳戳、搓澡、扔球(场景里的手势) ----------
  function onScenePointerDown(e) {
    if (!state || mode === 'game') return;
    lastInteract = Date.now();
    if (!state.hatchedAt) {
      if (overPet(e, 20)) tapEgg();
      return;
    }
    if (mode === 'ball' && !overPet(e)) return throwBall(e);

    const onPet = overPet(e);
    if (!onPet && mode !== 'bath') return;
    e.preventDefault();

    const start = { x: e.clientX, y: e.clientY, t: Date.now() };
    let last = { x: e.clientX, y: e.clientY };
    let dist = 0;
    let acc = 0;

    const move = (ev) => {
      const d = Math.hypot(ev.clientX - last.x, ev.clientY - last.y);
      last = { x: ev.clientX, y: ev.clientY };
      dist += d;
      acc += d;
      if (!overPet(ev)) return;
      if (mode === 'bath') {
        if (acc > 32) { acc = 0; scrub(ev); }
      } else if (!state.sleeping && dist > 12 && acc > 50) {
        acc = 0;
        stroke();
      }
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      if (onPet && mode !== 'bath' && dist < 12 && Date.now() - start.t < 450) pokePet();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }

  function stroke() {
    const r = G.stroke(state, Date.now());
    if (!r.ok) return;
    setExpr('love', 900);
    hearts(1);
    Sound.pop();
    if (r.coin) coinPop(r.coin);
    if (Math.random() < 0.1) say(pick(['呼噜呼噜~', '好舒服~', '再摸摸~', '最喜欢你了!', '嘿嘿嘿']));
    after(r);
  }

  function pokePet() {
    if (busy) return;
    if (state.sleeping) {
      bump('squish');
      say(pick(['Zzz…', '呼……再睡五分钟', '(翻了个身)', '唔……小鱼干……']));
      return;
    }
    const now = Date.now();
    poke.n = now - poke.t < 1500 ? poke.n + 1 : 1;
    poke.t = now;
    Sound.poke();
    bump('squish');
    clearTimeout(poke.timer);

    if (poke.n >= 5) {
      poke.n = 0;
      setExpr('angry', 2000);
      say(pick(['哼!不许再戳了!', '再戳我就生气啦!', '讨厌~ 戳疼了啦']));
      el.petScale.classList.toggle('flip');
      Sound.sad();
      return;
    }
    setExpr('surprised', 450);
    poke.timer = setTimeout(() => setExpr('happy', 900), 450);
    if (poke.n === 1 || Math.random() < 0.4) say(pick(POKE_LINES), 1600);
    lastInteract = now;
  }

  // ---------- 喂食 ----------
  function renderFood() {
    const box = $('#foodList');
    box.innerHTML = '';
    for (const [id, f] of Object.entries(G.FOODS)) {
      const n = state.food[id] || 0;
      if (f.price > 0 && !n) continue;
      const b = document.createElement('button');
      b.className = 'food-item';
      b.innerHTML = `<span class="ico">${f.icon}</span><span>${f.name}</span><span class="ct">${f.price ? `×${n}` : '无限'}</span>`;
      b.addEventListener('pointerdown', (e) => dragFood(e, id));
      b.addEventListener('click', (e) => { if (e.detail === 0) giveFood(id, null); }); // 键盘
      box.appendChild(b);
    }
    const more = document.createElement('button');
    more.className = 'food-item';
    more.innerHTML = '<span class="ico">🛍️</span><span>去买</span><span class="ct">更多好吃的</span>';
    more.onclick = () => openPanel('shop');
    box.appendChild(more);
  }

  function dragFood(e, id) {
    if (busy) return;
    e.preventDefault();
    const ghost = document.createElement('div');
    ghost.className = 'drag-food';
    ghost.textContent = G.FOODS[id].icon;
    document.body.appendChild(ghost);
    const place = (x, y) => { ghost.style.left = `${x}px`; ghost.style.top = `${y}px`; };
    place(e.clientX, e.clientY);

    const sx = e.clientX;
    const sy = e.clientY;
    let moved = false;
    const move = (ev) => {
      if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > 8) moved = true;
      place(ev.clientX, ev.clientY);
      lookAt(ev.clientX, ev.clientY);
      lastPointer = Date.now();
      if (moved && overPet(ev, 50) && !state.sleeping) setExpr('yum', 300);
    };
    const up = (ev) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      if (!moved || overPet(ev, 40)) giveFood(id, ghost);
      else {
        ghost.classList.add('drop');
        setTimeout(() => ghost.remove(), 300);
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }

  async function giveFood(id, ghost) {
    if (busy) { ghost?.remove(); return; }
    busy = true;
    lastInteract = Date.now();
    if (!ghost) {
      ghost = document.createElement('div');
      ghost.className = 'drag-food';
      ghost.textContent = G.FOODS[id].icon;
      const r = $('#foodList').getBoundingClientRect();
      ghost.style.left = `${r.left + 40}px`;
      ghost.style.top = `${r.top + 30}px`;
      document.body.appendChild(ghost);
      await wait(20);
    }
    const [mx, my] = mouthClient();
    ghost.style.transition = 'left .35s ease-in, top .35s ease-in, transform .35s';
    ghost.style.left = `${mx}px`;
    ghost.style.top = `${my}px`;
    ghost.style.transform = 'translate(-50%, -50%) scale(.7)';

    const reason = G.canFeed(state, id);
    if (reason) {
      await wait(350);
      ghost.classList.add('drop');
      setTimeout(() => ghost.remove(), 300);
      if (reason === 'full') {
        bump('nope');
        say(pick(['吃不下啦~ 肚子圆滚滚了', '饱饱的,等会儿再吃~']));
      } else if (reason === 'sleeping') {
        say('Zzz……');
      }
      busy = false;
      return;
    }

    setExpr('yum', 500);
    await wait(370);
    ghost.remove();
    const r = G.feed(state, id);
    setExpr('eat', 1400);
    for (let i = 0; i < 4; i++) {
      setTimeout(() => {
        Sound.chomp();
        const [x, y] = petPoint(0.5, 0.7);
        spawn('crumb', x + rand(-10, 10), y, '', { dx: rand(-40, 40) });
      }, i * 300);
    }
    await wait(1400);
    hearts(2);
    bump('hop');
    say(pick(FOOD_LINES[id] || ['好好吃!']));
    busy = false;
    renderFood();
    after(r);
  }

  // ---------- 洗澡 ----------
  function startBath() {
    if (state.stats.clean >= 100) {
      say('我已经香喷喷啦~');
      bump('hop');
      return;
    }
    enterMode('bath', '🧽 按住拿海绵在它身上搓一搓');
    say(pick(['要洗澡澡了吗?', '水不要太烫哦~']));
    walkTo(50, 60);
  }

  function scrub(ev) {
    const r = G.scrub(state);
    const [x, y] = sceneXY(ev.clientX, ev.clientY);
    for (let i = 0; i < 2; i++) {
      spawn('foam', x + rand(-16, 16), y + rand(-14, 14), '', { stay: true, style: { '--size': `${rand(14, 28)}px` } });
    }
    Sound.bubble();
    setExpr('love', 600);
    if (Math.random() < 0.08) say(pick(['好舒服~', '泡泡!', '那里痒痒~']));
    after(r);
    if (r.done) finishBath();
  }

  async function finishBath() {
    exitMode();
    const foam = $$('.particle.foam');
    foam.forEach((f, i) => setTimeout(() => {
      f.classList.add('pop');
      f.addEventListener('animationend', () => f.remove());
    }, i * 15));
    bump('shake');
    await wait(500);
    if (state.stats.clean >= 100) {
      sparkles(8);
      setExpr('happy', 1500);
      say('洗得香喷喷!✨');
    } else {
      say('下次再洗干净一点~');
    }
  }

  // ---------- 扔球 ----------
  function startBall() {
    const reason = G.canPlayGame(state);
    if (state.stats.energy < 10 || reason === 'sleeping') {
      say('我好累,玩不动了……');
      setExpr('sleep', 1200);
      return;
    }
    enterMode('ball', '⚽ 点一下地板,把球扔过去');
    say('来玩球吧!', 1800);
    bump('hop');
  }

  async function throwBall(e) {
    if (busy) return;
    const W = el.scene.clientWidth;
    const H = el.scene.clientHeight;
    const [x] = sceneXY(e.clientX, e.clientY);
    const tx = Math.max(W * 0.14, Math.min(W * 0.86, x));
    const floorY = H - 34;
    if (state.stats.energy < 10) {
      say('呼……玩累了,歇会儿');
      setExpr('sleep', 1200);
      return exitMode();
    }
    busy = true;
    el.ball.hidden = false;
    const fromX = W / 2;
    el.ball.animate([
      { transform: `translate(${fromX}px, ${H + 30}px)` },
      { transform: `translate(${(fromX + tx) / 2}px, ${floorY - 150}px) rotate(360deg)`, offset: 0.5 },
      { transform: `translate(${tx}px, ${floorY}px) rotate(720deg)` },
    ], { duration: 650, easing: 'ease-out', fill: 'forwards' });
    look(tx > (petX / 100) * W ? 4 : -4, -3);
    setExpr('surprised', 500);
    await wait(380);
    say(pick(['我来啦!', '追追追!', '看我的!']), 1200);
    await walkTo((tx / W) * 100, 70);
    const dir = tx > W / 2 ? -1 : 1;
    el.ball.animate([
      { transform: `translate(${tx}px, ${floorY}px)` },
      { transform: `translate(${tx + dir * 50}px, ${floorY - 60}px) rotate(200deg)`, offset: 0.4 },
      { transform: `translate(${tx + dir * 90}px, ${floorY}px) rotate(400deg)` },
    ], { duration: 600, easing: 'ease-out', fill: 'forwards' });
    bump('hop');
    Sound.pop();
    const r = G.playBall(state);
    setExpr('happy', 1300);
    hearts(2);
    busy = false;
    after(r);
  }

  // ---------- 小游戏 ----------
  function startMinigame() {
    const reason = G.canPlayGame(state);
    if (reason) {
      say(reason === 'tired' ? '我好累,先让我睡一觉嘛' : 'Zzz……');
      return;
    }
    closePanel();
    mode = 'game';
    MiniGame.start({
      species: state.species,
      wearing: state.wearing,
      style: state.style,
      onEnd(score) {
        mode = null;
        const r = G.finishGame(state, score);
        if (r.coins) coinPop(r.coins);
        setExpr('happy', 1500);
        bump('hop');
        say(r.coins ? `赚到 ${r.coins} 个金币!一起去买好吃的吧~` : '下次一定能接到!');
        after(r);
      },
    });
  }

  // ---------- 睡觉 ----------
  function toggleSleep() {
    if (state.sleeping) {
      G.wake(state);
      bump('hop');
      say(state.stats.energy > 70 ? '早上好!精神满满~' : '唔……还有点困……');
    } else {
      const r = G.sleep(state);
      if (!r.ok) {
        bump('nope');
        say('我还不困呢!再玩一会儿嘛');
        return;
      }
      closePanel();
      exitMode();
      walkTo(50, 40);
      say('晚安~ 做个好梦', 2000);
    }
    after();
  }

  // ---------- 商店 ----------
  function renderShop() {
    $$('#panel-shop .tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === shopTab));
    const list = $('#shopList');
    list.innerHTML = '';
    const catalog = shopTab === 'food' ? G.FOODS : G.ITEMS;
    for (const [id, it] of Object.entries(catalog)) {
      if (!it.price) continue;
      const card = document.createElement('div');
      card.className = 'shop-item';
      const desc = shopTab === 'food'
        ? Object.entries(it.effect).map(([k, v]) => `${G.STAT_NAMES[k]}+${v}`).join(' ')
        : { head: '头饰', face: '脸部', neck: '颈部' }[it.slot];
      card.innerHTML = `<span class="ico">${it.icon}</span><b>${it.name}</b><small>${desc}</small>`;
      const btn = document.createElement('button');
      btn.className = 'btn';
      const owned = shopTab === 'item' && state.items.includes(id);
      if (owned) {
        const on = state.wearing[it.slot] === id;
        btn.textContent = on ? '脱下' : '穿上';
        btn.classList.toggle('on', on);
        btn.onclick = () => wear(id);
      } else {
        const have = shopTab === 'food' && state.food[id] ? `(有 ${state.food[id]})` : '';
        btn.innerHTML = `<i class="coin-ico"></i>${it.price} 购买${have}`;
        btn.disabled = state.coins < it.price;
        btn.onclick = () => buy(id);
      }
      card.appendChild(btn);
      list.appendChild(card);
    }
  }

  function buy(id) {
    const kind = shopTab === 'food' ? 'food' : 'item';
    const r = G.buy(state, kind, id);
    if (!r.ok) return;
    Sound.coin();
    const it = kind === 'food' ? G.FOODS[id] : G.ITEMS[id];
    toast(`买到了 ${it.icon} ${it.name}!`);
    if (kind === 'item') {
      wear(id);
    } else {
      bump('hop');
      say(pick(['哇!是给我的吗?', '看起来好好吃!']));
    }
    after();
    renderShop();
  }

  function wear(id) {
    const r = G.toggleWear(state, id);
    if (!r.ok) return;
    renderPet();
    bump('hop');
    if (r.wearing) {
      sparkles(5);
      hearts(1);
      setExpr('happy', 1400);
      say(pick(['好看吗?', '我是不是超可爱~', '嘿嘿,新造型!']));
    } else {
      say('换回原来的样子~');
    }
    after();
    renderShop();
  }

  // ---------- 画风 ----------
  function switchStyle() {
    if (!state || busy) return;
    state.style = state.style === 'real' ? 'cute' : 'real';
    render();
    Sound.pop();
    if (state.hatchedAt) {
      bump('spin');
      sparkles(6);
      say(state.style === 'real' ? '换个样子~ 认得出我吗?' : '变回 Q 版啦!');
    }
    toast(`已切换到${G.STYLES[state.style]}画风`);
    after();
  }

  // ---------- 面板与模式 ----------
  function openPanel(name) {
    if (panel === name) return closePanel();
    exitMode();
    panel = name;
    for (const p of $$('.panel')) p.hidden = p.id !== `panel-${name}`;
    if (name === 'feed') renderFood();
    if (name === 'shop') renderShop();
    renderHud();
  }

  function closePanel() {
    panel = null;
    for (const p of $$('.panel')) p.hidden = true;
    if (state) renderHud();
  }

  function enterMode(name, text) {
    closePanel();
    mode = name;
    el.scene.classList.add(`mode-${name}`);
    el.modeText.textContent = text;
    el.modeBar.hidden = false;
    el.sponge.hidden = name !== 'bath';
    renderHud();
  }

  function exitMode() {
    if (!mode || mode === 'game') return;
    el.scene.classList.remove(`mode-${mode}`);
    mode = null;
    el.modeBar.hidden = true;
    el.sponge.hidden = true;
    el.ball.hidden = true;
    renderHud();
  }

  // ---------- 循环:时间流逝、眨眼、闲逛、打呼 ----------
  function tickLoop() {
    if (state) {
      const r = G.tick(state, Date.now());
      if (r.wokeUp) {
        bump('hop');
        say('睡饱啦!早上好~');
      }
      renderPet();
      renderHud();
      save(false);
    }
    setTimeout(tickLoop, 5000);
  }

  function blinkLoop() {
    if (isPetSvg()) {
      const s = svg();
      s.classList.add('blink');
      setTimeout(() => s.classList.remove('blink'), 130);
      if (Math.random() < 0.25) {
        setTimeout(() => s.classList.add('blink'), 260);
        setTimeout(() => s.classList.remove('blink'), 390);
      }
    }
    setTimeout(blinkLoop, rand(2200, 5200));
  }

  function idleLoop() {
    setTimeout(idleLoop, rand(4000, 8000));
    if (!state?.hatchedAt || mode || busy || walking || state.sleeping || document.hidden) return;
    if (Date.now() - lastInteract < 3000) return;

    const m = G.mood(state);
    const hour = new Date().getHours();
    const r = Math.random();
    if (m.need && r < 0.45) {
      say(m.need.line, 3000);
      bump(m.expr === 'sad' ? 'nope' : 'hop');
    } else if (r < 0.5) {
      walkTo(rand(18, 82));
    } else if (r < 0.62) {
      bump('hop');
      setExpr('happy', 800);
    } else if (r < 0.72 && (state.stats.energy < 50 || hour >= 22 || hour < 6)) {
      setExpr('sleep', 1300);
      say(hour >= 22 || hour < 6 ? '好晚了……哈~欠' : '哈~欠');
    } else if (r < 0.85) {
      say(pick(IDLE_LINES));
    } else if (Date.now() - lastPointer > 3000) {
      look(rand(-4, 4), rand(-3, 2));
    }
  }

  function zzzLoop() {
    if (state?.sleeping && isPetSvg()) {
      const [x, y] = petPoint(0.72, 0.3);
      spawn('zzz', x, y, pick(['z', 'Z', 'z']));
    }
    setTimeout(zzzLoop, 1400);
  }

  function skyLoop() {
    const h = new Date().getHours();
    el.scene.classList.toggle('dark-sky', h >= 19 || h < 6);
    setTimeout(skyLoop, 60_000);
  }

  // ---------- 账号 ----------
  function renderAccount() {
    const btn = $('#accountBtn');
    btn.hidden = !Store.serverAvailable;
    btn.textContent = Store.loggedIn ? `☁️ ${Store.user}` : '登录同步';
  }

  async function onAuthSubmit(e) {
    e.preventDefault();
    const kind = e.submitter?.value || 'login';
    const form = e.target;
    $('#authError').textContent = '';
    try {
      await Store.auth(kind, form.username.value.trim(), form.password.value);
      $('#authDialog').close();
      form.reset();
      await syncAfterLogin();
      toast('已登录,宠物会自动同步到云端 ☁️');
    } catch (err) {
      $('#authError').textContent = err.message;
    }
    renderAccount();
  }

  async function syncAfterLogin() {
    const remote = await Store.loadRemote();
    if (remote && state && remote.bornAt !== state.bornAt) {
      const useRemote = confirm(`云端已经住着「${remote.name}」了。\n确定:切换到「${remote.name}」\n取消:用本机的「${state.name}」覆盖云端`);
      if (useRemote) state = remote;
    } else if (remote && (!state || (remote.savedAt || 0) > (state.savedAt || 0))) {
      state = remote;
    }
    if (state) {
      state = G.normalize(state);
      G.tick(state, Date.now());
    }
    Store.save(state, { remote: true, now: true });
    builtKey = '';
    render();
  }

  // 切回页面时看看别的设备有没有更新过
  async function refreshFromCloud() {
    if (!Store.loggedIn || busy || mode) return;
    try {
      const remote = await Store.loadRemote();
      if (remote && (!state || (remote.savedAt || 0) > (state.savedAt || 0) + 1000)) {
        state = G.normalize(remote);
        G.tick(state, Date.now());
        builtKey = '';
        render();
      }
    } catch {}
  }

  // ---------- 事件绑定 ----------
  function bind() {
    $('#adoptBtn').onclick = adopt;
    for (const b of $$('#styleTabs button')) {
      b.onclick = () => { selectedStyle = b.dataset.style; Sound.pop(); renderAdopt(); };
    }
    $('#styleBtn').onclick = switchStyle;
    el.petName.addEventListener('keydown', (e) => { if (e.key === 'Enter') adopt(); });

    el.scene.addEventListener('pointerdown', onScenePointerDown);
    el.scene.addEventListener('pointermove', (e) => {
      if (mode !== 'bath') return;
      const [x, y] = sceneXY(e.clientX, e.clientY);
      el.sponge.style.transform = `translate(${x}px, ${y}px)`;
    });
    window.addEventListener('pointermove', (e) => {
      lastPointer = Date.now();
      if (!busy || mode === 'ball') lookAt(e.clientX, e.clientY);
    });

    for (const b of $$('[data-act]')) {
      b.onclick = () => {
        Sound.blip();
        const act = b.dataset.act;
        if (act === 'sleep') return toggleSleep();
        if (act === 'bath') {
          if (mode === 'bath') return finishBath();
          return startBath();
        }
        openPanel(act);
      };
    }
    $('#playBall').onclick = startBall;
    $('#playGame').onclick = startMinigame;
    $('#modeDone').onclick = () => (mode === 'bath' ? finishBath() : exitMode());
    for (const t of $$('#panel-shop .tabs button')) {
      t.onclick = () => { shopTab = t.dataset.tab; renderShop(); };
    }

    $('#releaseBtn').onclick = () => {
      if (!confirm(`真的要和 ${state.name} 说再见吗?它会很想你的……`)) return;
      state = null;
      exitMode();
      closePanel();
      Store.save(null, { remote: true, now: true });
      $('#styleBtn').hidden = true;
      render();
    };

    const soundBtn = $('#soundBtn');
    soundBtn.textContent = Sound.muted ? '🔇' : '🔊';
    soundBtn.onclick = () => { soundBtn.textContent = Sound.toggle() ? '🔇' : '🔊'; };

    $('#accountBtn').onclick = async () => {
      if (Store.loggedIn) {
        if (!confirm(`退出账号 ${Store.user}?(本机仍会保留一份存档)`)) return;
        await Store.logout();
        renderAccount();
        toast('已退出登录');
      } else {
        $('#authError').textContent = '';
        $('#authDialog').showModal();
      }
    };
    $('#authForm').addEventListener('submit', onAuthSubmit);
    $('#authCancel').onclick = () => $('#authDialog').close();

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) refreshFromCloud();
    });
  }

  // ---------- 启动 ----------
  async function boot() {
    bind();
    await Store.init();
    renderAccount();

    const local = Store.loadLocal();
    state = local ? G.normalize(local) : null;
    if (Store.loggedIn) {
      try {
        const remote = await Store.loadRemote();
        if (remote && (!state || (remote.savedAt || 0) >= (state.savedAt || 0))) state = G.normalize(remote);
      } catch {}
    }

    let report = { hours: 0 };
    if (state) report = G.tick(state, Date.now());
    render();
    skyLoop();
    tickLoop();
    blinkLoop();
    idleLoop();
    zzzLoop();

    if (state?.hatchedAt) {
      const h = report.hours;
      let msg = '';
      if (h > 24) msg = `你终于回来啦!我等了你 ${Math.floor(h / 24)} 天……`;
      else if (h > 3) msg = `你离开了 ${Math.round(h)} 个小时,好想你!`;
      else if (h > 0.3) msg = '欢迎回来~';
      if (report.wokeUp) msg += (msg ? ' ' : '') + '我刚睡醒~';
      if (msg) {
        setTimeout(() => {
          say(msg, 3500);
          setExpr('happy', 1500);
          bump('hop');
          hearts(2);
        }, 700);
      }
      setTimeout(claimDaily, msg ? 2600 : 900);
    }
  }

  boot();
})();
