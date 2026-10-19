// 用 WebAudio 合成的小音效,不需要音频文件
(function (root) {
  'use strict';

  const KEY = 'cloud-pet:muted';
  let ctx = null;
  let muted = false;
  try { muted = localStorage.getItem(KEY) === '1'; } catch {}

  function tone(freq, dur, { type = 'sine', vol = 0.12, to = null, delay = 0 } = {}) {
    if (muted) return;
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
      const t = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch {}
  }

  root.Sound = {
    poke: () => tone(620, 0.12, { to: 980, vol: 0.14 }),
    pop: () => tone(880, 0.08, { type: 'triangle', to: 1400, vol: 0.1 }),
    blip: () => tone(700 + Math.random() * 300, 0.06, { vol: 0.05, to: 1000 }),
    chomp: () => tone(240, 0.07, { type: 'square', to: 150, vol: 0.05 }),
    bubble: () => tone(500 + Math.random() * 500, 0.06, { to: 1200, vol: 0.06 }),
    coin: () => { tone(988, 0.08, { type: 'square', vol: 0.05 }); tone(1319, 0.14, { type: 'square', vol: 0.05, delay: 0.08 }); },
    sad: () => tone(400, 0.25, { type: 'triangle', to: 250, vol: 0.08 }),
    levelup: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, { type: 'triangle', vol: 0.1, delay: i * 0.11 })),
    get muted() { return muted; },
    toggle() {
      muted = !muted;
      try { localStorage.setItem(KEY, muted ? '1' : '0'); } catch {}
      return muted;
    },
  };
})(window);
