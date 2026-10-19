// 小狗的声音:全部用 WebAudio 现场合成
export function createSfx(isMuted) {
  let ctx = null;
  let noiseBuf = null;

  function ac() {
    if (isMuted()) return null;
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
      if (!noiseBuf) {
        noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      return ctx;
    } catch {
      return null;
    }
  }

  function env(c, node, t, attack, peak, decay) {
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    node.connect(g).connect(c.destination);
    return g;
  }

  function noise(c, t, dur, type, freq, q, peak, attack = 0.005) {
    const src = c.createBufferSource();
    src.buffer = noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    src.connect(f);
    env(c, f, t, attack, peak, dur);
    src.start(t, Math.random() * 0.5, dur + attack + 0.05);
    return f;
  }

  function tone(c, t, type, f0, f1, dur, peak) {
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1800;
    o.connect(lp);
    env(c, lp, t, 0.01, peak, dur);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  return {
    unlock() { ac(); },
    bark() {
      const c = ac(); if (!c) return;
      const t = c.currentTime;
      tone(c, t, 'sawtooth', 520, 230, 0.13, 0.22);
      tone(c, t, 'square', 780, 340, 0.1, 0.05);
      noise(c, t, 0.1, 'bandpass', 1300, 1.2, 0.12);
    },
    whine() {
      const c = ac(); if (!c) return;
      const t = c.currentTime;
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(820, t);
      o.frequency.linearRampToValueAtTime(1050, t + 0.25);
      o.frequency.linearRampToValueAtTime(760, t + 0.6);
      env(c, o, t, 0.05, 0.035, 0.55);
      o.start(t);
      o.stop(t + 0.7);
    },
    chew() {
      const c = ac(); if (!c) return;
      noise(c, c.currentTime, 0.05, 'bandpass', 2200, 2, 0.08);
    },
    kibble() {
      const c = ac(); if (!c) return;
      for (let i = 0; i < 14; i++) noise(c, c.currentTime + i * 0.035 + Math.random() * 0.02, 0.03, 'highpass', 3000, 1, 0.06);
    },
    squeak() {
      const c = ac(); if (!c) return;
      tone(c, c.currentTime, 'sine', 1300, 1900, 0.12, 0.06);
    },
    bounce() {
      const c = ac(); if (!c) return;
      noise(c, c.currentTime, 0.06, 'lowpass', 500, 1, 0.15);
    },
    bubble() {
      const c = ac(); if (!c) return;
      tone(c, c.currentTime, 'sine', 500 + Math.random() * 600, 1400, 0.06, 0.04);
    },
    splash() {
      const c = ac(); if (!c) return;
      noise(c, c.currentTime, 0.7, 'lowpass', 2500, 0.7, 0.12, 0.05);
    },
    shake() {
      const c = ac(); if (!c) return;
      const t = c.currentTime;
      for (let i = 0; i < 12; i++) noise(c, t + i * 0.1, 0.08, 'bandpass', 1800 + Math.random() * 1500, 0.8, 0.07);
    },
    yawn() {
      const c = ac(); if (!c) return;
      const t = c.currentTime;
      tone(c, t, 'triangle', 600, 260, 0.7, 0.06);
      noise(c, t, 0.6, 'bandpass', 900, 1.5, 0.03, 0.1);
    },
  };
}
