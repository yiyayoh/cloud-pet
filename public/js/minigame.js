// 小游戏:左右移动宠物接住掉下来的零食,躲开西兰花
(function (root) {
  'use strict';

  const DURATION = 40;
  const GOOD = [
    { icon: '🍪', pts: 1 }, { icon: '🐟', pts: 1 }, { icon: '🍓', pts: 1 },
    { icon: '🍩', pts: 2 }, { icon: '⭐', pts: 3 },
  ];
  const BAD = { icon: '🥦', bad: true };

  function start({ species, wearing, style, onEnd }) {
    const overlay = document.getElementById('gameOverlay');
    const field = document.getElementById('mgField');
    const petEl = document.getElementById('mgPet');
    const scoreEl = document.getElementById('mgScore');
    const livesEl = document.getElementById('mgLives');
    const timeEl = document.getElementById('mgTime');
    const endEl = document.getElementById('mgEnd');

    petEl.innerHTML = PetSVG.build(species, { wearing, style });
    const svg = petEl.querySelector('svg');
    overlay.hidden = false;
    endEl.hidden = true;

    let score = 0;
    let lives = 3;
    let time = DURATION;
    let px = 0.5;
    let keyDir = 0;
    let items = [];
    let spawnIn = 0.6;
    let last = performance.now();
    let running = true;
    let exprTimer = null;

    const W = () => field.clientWidth;
    const H = () => field.clientHeight;

    function flash(expr) {
      svg.dataset.expr = expr;
      clearTimeout(exprTimer);
      exprTimer = setTimeout(() => { svg.dataset.expr = 'normal'; }, 450);
    }

    function hud() {
      scoreEl.textContent = score;
      livesEl.textContent = '❤️'.repeat(lives) + '🤍'.repeat(3 - lives);
      timeEl.textContent = Math.ceil(time);
    }

    function onMove(e) {
      const r = field.getBoundingClientRect();
      px = Math.max(0.08, Math.min(0.92, (e.clientX - r.left) / r.width));
    }
    function onKey(e) {
      if (e.key === 'ArrowLeft' || e.key === 'a') keyDir = e.type === 'keydown' ? -1 : 0;
      if (e.key === 'ArrowRight' || e.key === 'd') keyDir = e.type === 'keydown' ? 1 : 0;
    }
    field.addEventListener('pointermove', onMove);
    field.addEventListener('pointerdown', onMove);
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);

    function spawn() {
      const progress = 1 - time / DURATION;
      const kind = Math.random() < 0.2 + progress * 0.1 ? BAD : GOOD[Math.floor(Math.random() * (Math.random() < 0.15 ? GOOD.length : 3))];
      const node = document.createElement('div');
      node.className = 'mg-item';
      node.textContent = kind.icon;
      field.appendChild(node);
      items.push({ node, kind, x: 20 + Math.random() * (W() - 40), y: -30, vy: 130 + progress * 170 + Math.random() * 40 });
    }

    function popText(x, y, text, cls) {
      const n = document.createElement('div');
      n.className = `mg-pop ${cls}`;
      n.textContent = text;
      n.style.left = `${x}px`;
      n.style.top = `${y}px`;
      field.appendChild(n);
      n.addEventListener('animationend', () => n.remove());
    }

    function frame(ts) {
      if (!running) return;
      const dt = Math.min(0.05, (ts - last) / 1000);
      last = ts;
      time -= dt;
      px = Math.max(0.08, Math.min(0.92, px + keyDir * dt * 1.1));
      const petX = px * W();
      petEl.style.left = `${petX}px`;

      spawnIn -= dt;
      if (spawnIn <= 0) {
        spawn();
        spawnIn = Math.max(0.32, 0.8 - (1 - time / DURATION) * 0.45);
      }

      const catchTop = H() - 90;
      items = items.filter((it) => {
        it.y += it.vy * dt;
        it.node.style.transform = `translate(${it.x}px, ${it.y}px)`;
        if (it.y > catchTop && it.y < H() - 30 && Math.abs(it.x - petX) < 46) {
          it.node.remove();
          if (it.kind.bad) {
            lives--;
            flash('sad');
            Sound.sad();
            popText(it.x, it.y, '呸呸!', 'bad');
          } else {
            score += it.kind.pts;
            flash('eat');
            Sound.pop();
            popText(it.x, it.y, `+${it.kind.pts}`, 'good');
          }
          return false;
        }
        if (it.y > H()) {
          it.node.remove();
          return false;
        }
        return true;
      });

      hud();
      if (time <= 0 || lives <= 0) return finish();
      requestAnimationFrame(frame);
    }

    function finish() {
      running = false;
      items.forEach((it) => it.node.remove());
      items = [];
      field.removeEventListener('pointermove', onMove);
      field.removeEventListener('pointerdown', onMove);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      svg.dataset.expr = score > 0 ? 'happy' : 'sad';
      document.getElementById('mgCoins').textContent = score;
      endEl.hidden = false;
      document.getElementById('mgClose').onclick = () => {
        overlay.hidden = true;
        onEnd(score);
      };
    }

    hud();
    requestAnimationFrame((ts) => { last = ts; frame(ts); });
  }

  root.MiniGame = { start };
})(window);
