// 写实画风:真实的身体比例、毛发质感、渐变明暗和真实的眼睛。
// 和 Q 版共用同一套 class 名(eye-open、mouth-open、arm、dirt……),所以表情和互动不用改。
(function (root) {
  'use strict';

  let seq = 0;

  // ---------- 通用部件 ----------

  function defs(u, c, fuzz = 3.5) {
    return `<defs>
      <radialGradient id="fur-${u}" cx="42%" cy="28%" r="80%">
        <stop offset="0" stop-color="${c.light}"/><stop offset=".5" stop-color="${c.fur}"/><stop offset="1" stop-color="${c.dark}"/>
      </radialGradient>
      <radialGradient id="soft-${u}" cx="45%" cy="30%" r="75%">
        <stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="${c.belly}"/>
      </radialGradient>
      <radialGradient id="iris-${u}" cx="50%" cy="45%" r="55%">
        <stop offset="0" stop-color="${c.iris}"/><stop offset="1" stop-color="${c.irisDark}"/>
      </radialGradient>
      <filter id="fuzz-${u}" x="-15%" y="-15%" width="130%" height="130%">
        <feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="4"/>
        <feDisplacementMap in="SourceGraphic" scale="${fuzz}" xChannelSelector="R" yChannelSelector="G"/>
      </filter>
    </defs>`;
  }

  // 杏仁形眼睛:眼珠在眼眶里转(clip 住),高光不动
  function eye(u, i, x, y, o) {
    const { rx, ry } = o;
    const almond = `M${-rx} 0 Q0 ${-ry * 1.35} ${rx} 0 Q0 ${ry * 1.35} ${-rx} 0Z`;
    const lid = o.lid || '#2a1d14';
    let inner;
    if (o.pupil === 'bead') {
      inner = `<ellipse rx="${rx}" ry="${ry}" fill="url(#iris-${u})"/>`;
    } else {
      const pupil = o.pupil === 'slit'
        ? `<ellipse rx="${rx * 0.17}" ry="${ry * 0.95}" fill="#0b0806"/>`
        : `<circle r="${Math.min(rx, ry) * 0.55}" fill="#0b0806"/>`;
      inner = `<circle r="${Math.max(rx, ry) * 0.92}" fill="url(#iris-${u})"/>${pupil}`;
    }
    return `<g transform="translate(${x} ${y}) rotate(${o.rot || 0})">
      <clipPath id="ec-${u}-${i}"><path d="${almond}"/></clipPath>
      <g class="eye-open">
        <path d="${almond}" fill="#120c08"/>
        <g clip-path="url(#ec-${u}-${i})"><g class="eyes-look">${inner}</g></g>
        <path d="${almond}" fill="none" stroke="${lid}" stroke-width="1.6"/>
        <ellipse cx="${-rx * 0.3}" cy="${-ry * 0.35}" rx="${rx * 0.28}" ry="${ry * 0.24}" fill="#fff" opacity=".92"/>
        <circle cx="${rx * 0.38}" cy="${ry * 0.3}" r="${rx * 0.11}" fill="#fff" opacity=".6"/>
      </g>
      <path class="eye-happy" d="M${-rx} ${ry * 0.2} Q0 ${-ry * 0.9} ${rx} ${ry * 0.2}" fill="none" stroke="${lid}" stroke-width="2.4" stroke-linecap="round"/>
      <path class="eye-closed" d="M${-rx} 0 Q0 ${ry * 0.7} ${rx} 0" fill="none" stroke="${lid}" stroke-width="2.4" stroke-linecap="round"/>
    </g>`;
  }

  function eyes(u, a, o) {
    const [[lx, ly], [rx, ry]] = a.eyes;
    const rot = o.rot || 0;
    return `<g class="eyes">${eye(u, 0, lx, ly, { ...o, rot })}${eye(u, 1, rx, ry, { ...o, rot: -rot })}</g>`;
  }

  function mouth(x, y, o = {}) {
    const ln = o.line || '#3a2418';
    const w = o.w || 7;
    const line = `fill="none" stroke="${ln}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"`;
    const teeth = o.teeth
      ? '<rect x="-3.3" y=".6" width="3" height="4.2" rx=".8" fill="#fff"/><rect x=".3" y=".6" width="3" height="4.2" rx=".8" fill="#fff"/>'
      : '';
    const tongue = o.longTongue
      ? '<path d="M-4.8 3 Q-5.5 16 0 17 Q5.5 16 4.8 3Z" fill="#E7727F"/><path d="M0 5 V13" stroke="#C9545F" stroke-width="1"/>'
      : `<ellipse cx="0" cy="${w * 0.75}" rx="${w * 0.45}" ry="2.4" fill="#E7727F"/>`;
    return `<g transform="translate(${x} ${y})">
      <path d="M0 -4 V0" ${line}/>
      <path class="mouth-normal" d="M${-w} 1.5 Q${-w / 2} 4 0 0 Q${w / 2} 4 ${w} 1.5" ${line}/>
      <g class="mouth-open"><path d="M${-w} 0 Q0 ${w * 1.5} ${w} 0 Q0 2 ${-w} 0Z" fill="#4a1d1d"/>${tongue}${teeth}</g>
      <path class="mouth-sad" d="M${-w} 5 Q0 -0.5 ${w} 5" ${line}/>
      <ellipse class="mouth-o" cx="0" cy="4" rx="${w * 0.38}" ry="${w * 0.5}" fill="#4a1d1d"/>
    </g>`;
  }

  function beak(x, y, o) {
    const closed = `<path d="M-6 -1 Q0 -4.5 6 -1 L0 ${o.len}Z" fill="${o.color}" stroke="${o.edge}" stroke-width=".8"/>`
      + `<path d="M-5 -1 Q0 -3.5 5 -1" fill="none" stroke="${o.base}" stroke-width="1.8"/>`;
    const open = `<path d="M-6 -2 Q0 -5.5 6 -2 L0 ${o.len * 0.6}Z" fill="${o.color}" stroke="${o.edge}" stroke-width=".8"/>`
      + `<path d="M-4.5 ${o.len * 0.6 + 2} L4.5 ${o.len * 0.6 + 2} L0 ${o.len + 4}Z" fill="${o.color}" stroke="${o.edge}" stroke-width=".8"/>`
      + `<path d="M-3.5 ${o.len * 0.55} L3.5 ${o.len * 0.55} L0 ${o.len * 0.6 + 3}Z" fill="#6a2a2a"/>`;
    return `<g transform="translate(${x} ${y})">
      <g class="mouth-normal">${closed}</g><g class="mouth-sad">${closed}</g>
      <g class="mouth-open">${open}</g><g class="mouth-o">${open}</g>
    </g>`;
  }

  function whiskers(x, y, color, opacity = 0.8) {
    const side = (s) => [-3, 1, 5].map((dy, i) =>
      `<path d="M${x + s * 4} ${y + i * 2} Q${x + s * 26} ${y + dy - 2} ${x + s * (44 - i * 4)} ${y + dy * 1.6}"/>`).join('');
    return `<g fill="none" stroke="${color}" stroke-width=".9" stroke-linecap="round" opacity="${opacity}">${side(-1)}${side(1)}</g>`;
  }

  // 眉毛、眼泪、生气符号、腮红:按眼睛位置摆
  function faceExtras(a, color) {
    const [[lx, ly], [rx]] = a.eyes;
    const r = a.eyeR;
    const by = ly - r * 1.6;
    const [hx, hy, hr] = a.head;
    const mx = hx + hr * 0.72 - 152;
    const my = hy - hr * 0.75 - 72;
    return `
      <g class="brows-sad" stroke="${color}" stroke-width="2.2" stroke-linecap="round" opacity=".8">
        <path d="M${lx - r} ${by + 3} L${lx + r * 0.8} ${by - 2}"/><path d="M${rx + r} ${by + 3} L${rx - r * 0.8} ${by - 2}"/></g>
      <g class="brows-angry" stroke="${color}" stroke-width="2.4" stroke-linecap="round" opacity=".85">
        <path d="M${lx - r} ${by - 2} L${lx + r * 0.9} ${by + 3}"/><path d="M${rx + r} ${by - 2} L${rx - r * 0.9} ${by + 3}"/></g>
      <path class="tear" d="M${lx - 1} ${ly + r + 2} q-4 7 0 9 q4 -2 0 -9z" fill="#9AD3FF" stroke="#6ab0e6" stroke-width="1"/>
      <g class="angry-mark" transform="translate(${mx} ${my})" stroke="#ff5c5c" stroke-width="3.5" stroke-linecap="round" fill="none">
        <path d="M146 66 q6 4 12 0"/><path d="M146 78 q6 -4 12 0"/><path d="M146 66 q-4 6 0 12"/><path d="M158 66 q4 6 0 12"/></g>
      <ellipse class="cheek" cx="${lx - r * 0.6}" cy="${ly + r * 2}" rx="${r * 1.1}" ry="${r * 0.6}" fill="#F29C9C" fill-opacity=".45"/>
      <ellipse class="cheek" cx="${rx + r * 0.6}" cy="${ly + r * 2}" rx="${r * 1.1}" ry="${r * 0.6}" fill="#F29C9C" fill-opacity=".45"/>`;
  }

  // 装扮按 Q 版的坐标画好,再按头部/脖子位置缩放过去
  function accessories(wearing = {}, a, lineColor) {
    const ACC = root.PetSVG.parts.ACCESSORIES;
    const map = (svg, [cx, cy, k], [qx, qy]) =>
      `<g transform="translate(${cx - qx * k} ${cy - qy * k}) scale(${k})">${svg}</g>`;
    let out = '';
    if (wearing.neck && ACC[wearing.neck]) out += map(ACC[wearing.neck], [a.neck[0], a.neck[1], a.neck[2] / 60], [100, 157]);
    if (wearing.face === 'glasses') {
      const [[lx, ly], [rx, ry]] = a.eyes;
      const r = Math.max(a.eyeR * 1.7, 8);
      out += `<g fill="rgba(255,255,255,.15)" stroke="${lineColor}" stroke-width="2"><circle cx="${lx}" cy="${ly}" r="${r}"/><circle cx="${rx}" cy="${ry}" r="${r}"/></g>`
        + `<path d="M${lx + r} ${ly - 1} Q${(lx + rx) / 2} ${ly - 5} ${rx - r} ${ry - 1}" fill="none" stroke="${lineColor}" stroke-width="2"/>`;
    }
    if (wearing.head && ACC[wearing.head]) out += map(ACC[wearing.head], [a.head[0], a.head[1], a.head[2] / 76], [100, 112]);
    return out;
  }

  // 前腿(左),右腿镜像
  const LEG = 'M80 126 C79 148 78 168 79 182 Q80 189 89 189 Q97 189 97 182 L98 134Z';
  const PANDA_LEG = 'M75 122 C74 148 73 168 74 182 Q75 189 88 189 Q99 189 99 182 L100 130Z';
  const mirror = (svg) => `<g transform="translate(200 0) scale(-1 1)">${svg}</g>`;
  const paw = (fill, toe) => `<ellipse cx="88" cy="185" rx="10" ry="5" fill="${fill}"/>`
    + `<path d="M85 183 v4 M89 183 v4.5 M93 183 v4" stroke="${toe}" stroke-width=".8" opacity=".6"/>`;

  // ---------- 各物种 ----------

  const SPECIES = {
    cat(u) {
      const c = { fur: '#E2A05C', light: '#F8DDB8', dark: '#A9622A', belly: '#F7E6CF', iris: '#B8D658', irisDark: '#5C7E22' };
      const a = { head: [100, 78, 44], eyes: [[83, 78], [117, 78]], eyeR: 9, neck: [100, 112, 28], mouthY: 0.48 };
      const F = `fill="url(#fur-${u})" filter="url(#fuzz-${u})"`;
      const stripes = 'stroke="#9A5320" stroke-linecap="round" opacity=".55" fill="none"';
      const ear = `<path d="M64 70 L58 26 Q60 22 64 25 L94 52Z" ${F}/><path d="M67 63 L63 33 L88 53Z" fill="#E7A3A0"/>`
        + '<path d="M66 58 l6 -6 M68 62 l8 -5" stroke="#fff" stroke-width="1" opacity=".7"/>';
      return {
        c, a,
        back: `<g class="tail" style="transform-origin:146px 182px">
            <path d="M146 182 C176 184 190 160 182 132 C179 122 170 118 166 124" fill="none" stroke="${c.fur}" stroke-width="13" stroke-linecap="round" filter="url(#fuzz-${u})"/>
            <path d="M146 182 C176 184 190 160 182 132 C179 122 170 118 166 124" fill="none" stroke="#9A5320" stroke-width="13" stroke-dasharray="5 9" opacity=".45"/></g>`,
        body: `<path d="M72 106 C52 118 40 150 44 176 Q46 188 62 188 L138 188 Q154 188 156 176 C160 150 148 118 128 106Z" ${F}/>
          <ellipse cx="57" cy="166" rx="20" ry="20" ${F}/><ellipse cx="143" cy="166" rx="20" ry="20" ${F}/>
          <path d="M42 158 q8 -5 15 1 M44 170 q8 -5 15 1" ${stripes} stroke-width="3"/>${mirror(`<path d="M42 158 q8 -5 15 1 M44 170 q8 -5 15 1" ${stripes} stroke-width="3"/>`)}
          <path d="M84 108 C80 130 86 150 100 156 C114 150 120 130 116 108Z" fill="url(#soft-${u})" filter="url(#fuzz-${u})"/>
          <path d="${LEG}" ${F}/>${paw(c.belly, '#9A5320')}${mirror(`<path d="${LEG}" ${F}/>${paw(c.belly, '#9A5320')}`)}`,
        head: `${ear}${mirror(ear)}
          <ellipse cx="100" cy="80" rx="44" ry="37" ${F}/>
          <path d="M100 46 v12 M90 48 l3 11 M110 48 l-3 11 M86 58 q-8 2 -12 8 M114 58 q8 2 12 8" ${stripes} stroke-width="2.6"/>
          <path d="M58 84 h12 M60 92 h10" ${stripes} stroke-width="2.2"/>${mirror(`<path d="M58 84 h12 M60 92 h10" ${stripes} stroke-width="2.2"/>`)}
          <ellipse cx="93" cy="95" rx="9" ry="6.5" fill="${c.belly}"/><ellipse cx="107" cy="95" rx="9" ry="6.5" fill="${c.belly}"/>
          <ellipse cx="100" cy="103" rx="7" ry="4" fill="${c.belly}"/>`,
        face: eyes(u, a, { rx: 9, ry: 6.5, rot: 10, pupil: 'slit' })
          + '<path d="M95.5 88 Q100 86 104.5 88 L100 93Z" fill="#E08C8C" stroke="#B5645F" stroke-width=".8"/>'
          + mouth(100, 93, { w: 6 }) + whiskers(100, 96, '#fff', 0.85),
        brow: '#8A4A1C',
      };
    },

    dog(u) {
      const c = { fur: '#D9A55E', light: '#F3D9A8', dark: '#A86F31', belly: '#F4DFB8', iris: '#8B5A2B', irisDark: '#3B210E' };
      const a = { head: [100, 78, 45], eyes: [[82, 76], [118, 76]], eyeR: 7.5, neck: [100, 114, 30], mouthY: 0.5 };
      const F = `fill="url(#fur-${u})" filter="url(#fuzz-${u})"`;
      const ear = `<path d="M62 60 C44 60 36 92 46 112 C52 122 66 116 68 100 C70 86 72 68 62 60Z" fill="#B47A38" filter="url(#fuzz-${u})"/>`;
      return {
        c, a,
        back: `<path class="tail" style="transform-origin:150px 178px" d="M150 178 C174 176 186 154 178 128" fill="none" stroke="${c.fur}" stroke-width="12" stroke-linecap="round" filter="url(#fuzz-${u})"/>`,
        body: `<path d="M70 106 C48 118 38 150 42 176 Q44 188 62 188 L138 188 Q156 188 158 176 C162 150 152 118 130 106Z" ${F}/>
          <ellipse cx="55" cy="166" rx="21" ry="20" ${F}/><ellipse cx="145" cy="166" rx="21" ry="20" ${F}/>
          <path d="M82 108 C78 132 86 152 100 158 C114 152 122 132 118 108Z" fill="url(#soft-${u})" filter="url(#fuzz-${u})"/>
          <path d="${LEG}" ${F}/>${paw(c.belly, '#8A5A28')}${mirror(`<path d="${LEG}" ${F}/>${paw(c.belly, '#8A5A28')}`)}`,
        head: `<ellipse cx="100" cy="80" rx="45" ry="39" ${F}/>
          <ellipse cx="100" cy="98" rx="21" ry="15" fill="url(#soft-${u})"/>
          <circle cx="90" cy="99" r=".9" fill="#7a5a3a"/><circle cx="93" cy="102" r=".9" fill="#7a5a3a"/><circle cx="110" cy="99" r=".9" fill="#7a5a3a"/><circle cx="107" cy="102" r=".9" fill="#7a5a3a"/>`,
        front: `${ear}${mirror(ear)}`,
        face: eyes(u, a, { rx: 7.5, ry: 7, pupil: 'round' })
          + '<path d="M90 88 Q100 82 110 88 Q109 95 100 97 Q91 95 90 88Z" fill="#2B201B"/><ellipse cx="96" cy="87" rx="3" ry="1.4" fill="#fff" opacity=".45"/>'
          + mouth(100, 100, { w: 8, longTongue: true }),
        brow: '#8A5A28',
      };
    },

    rabbit(u) {
      const c = { fur: '#B49A80', light: '#E9DCCB', dark: '#7A624C', belly: '#F1E8DE', iris: '#5A3A22', irisDark: '#1E120A' };
      const a = { head: [100, 80, 38], eyes: [[80, 78], [120, 78]], eyeR: 7.5, neck: [100, 112, 26], mouthY: 0.49 };
      const F = `fill="url(#fur-${u})" filter="url(#fuzz-${u})"`;
      const ear = `<g transform="rotate(-10 84 62)"><ellipse cx="84" cy="34" rx="11" ry="32" ${F}/><ellipse cx="84" cy="36" rx="6" ry="25" fill="#E3B1AA"/></g>`;
      const leg = 'M86 150 C84 165 84 178 86 184 Q88 189 94 189 Q99 189 98 182 L98 152Z';
      return {
        c, a,
        back: `<circle class="tail" style="transform-origin:154px 176px" cx="154" cy="176" r="10" fill="#F4EFE8" filter="url(#fuzz-${u})"/>`,
        body: `<path d="M64 110 C42 120 34 160 44 182 Q48 189 62 189 L138 189 Q152 189 156 182 C166 160 158 120 136 110Z" ${F}/>
          <ellipse cx="60" cy="166" rx="26" ry="22" ${F}/><ellipse cx="140" cy="166" rx="26" ry="22" ${F}/>
          <ellipse cx="100" cy="138" rx="20" ry="24" fill="url(#soft-${u})" filter="url(#fuzz-${u})"/>
          <path d="${leg}" ${F}/>${mirror(`<path d="${leg}" ${F}/>`)}`,
        head: `${ear}${mirror(ear)}
          <ellipse cx="100" cy="82" rx="38" ry="33" ${F}/>
          <ellipse cx="78" cy="94" rx="14" ry="10" fill="${c.light}" opacity=".8"/><ellipse cx="122" cy="94" rx="14" ry="10" fill="${c.light}" opacity=".8"/>
          <ellipse cx="100" cy="99" rx="10" ry="7" fill="${c.belly}"/>`,
        face: eyes(u, a, { rx: 7.5, ry: 8, pupil: 'round' })
          + '<path d="M96 90 Q100 88 104 90 L100 94Z" fill="#D99A98"/>'
          + mouth(100, 97, { w: 5, teeth: true }) + whiskers(100, 96, '#5a4a3c', 0.55),
        brow: '#6A5440',
      };
    },

    hamster(u) {
      const c = { fur: '#D9A262', light: '#F2C990', dark: '#A8692E', belly: '#FBF3E6', iris: '#3a2418', irisDark: '#000000' };
      const a = { head: [100, 102, 62], eyes: [[78, 96], [122, 96]], eyeR: 6, neck: [100, 142, 40], mouthY: 0.55 };
      const F = `fill="url(#fur-${u})" filter="url(#fuzz-${u})"`;
      const ear = `<circle cx="62" cy="62" r="13" ${F}/><circle cx="62" cy="63" r="8" fill="#E9B0A6"/>`;
      return {
        c, a,
        back: `${ear}${mirror(ear)}`,
        body: `<path d="M100 54 C142 54 166 92 166 132 C166 170 140 188 100 188 C60 188 34 170 34 132 C34 92 58 54 100 54Z" ${F}/>
          <path d="M100 108 C136 108 154 136 152 160 C150 180 128 188 100 188 C72 188 50 180 48 160 C46 136 64 108 100 108Z" fill="url(#soft-${u})" filter="url(#fuzz-${u})"/>
          <ellipse cx="80" cy="186" rx="10" ry="4" fill="#EBB3A9"/><ellipse cx="120" cy="186" rx="10" ry="4" fill="#EBB3A9"/>`,
        head: `<ellipse cx="100" cy="70" rx="14" ry="7" fill="${c.dark}" opacity=".14" filter="url(#fuzz-${u})"/>
          <ellipse cx="68" cy="118" rx="20" ry="16" fill="url(#soft-${u})" filter="url(#fuzz-${u})"/>
          <ellipse cx="132" cy="118" rx="20" ry="16" fill="url(#soft-${u})" filter="url(#fuzz-${u})"/>
          <ellipse cx="86" cy="150" rx="6" ry="4" fill="#EBB3A9"/><ellipse cx="114" cy="150" rx="6" ry="4" fill="#EBB3A9"/>
          <path d="M83 148 v3 M86 147.5 v3.5 M89 148 v3 M111 148 v3 M114 147.5 v3.5 M117 148 v3" stroke="#B57A70" stroke-width=".7"/>`,
        face: eyes(u, a, { rx: 6, ry: 6.5, pupil: 'bead' })
          + '<path d="M97 106 Q100 104 103 106 L100 109Z" fill="#E59A96"/>'
          + mouth(100, 111, { w: 4.5, teeth: true }) + whiskers(100, 110, '#5a3e28', 0.45),
        brow: '#8A5424',
      };
    },

    panda(u) {
      const c = { fur: '#F2F0EA', light: '#FFFFFF', dark: '#C9C6BE', belly: '#FBF8F1', iris: '#5a3a26', irisDark: '#1a0f08' };
      const a = { head: [100, 78, 46], eyes: [[81, 83], [119, 83]], eyeR: 5, neck: [100, 114, 30], mouthY: 0.49 };
      const F = `fill="url(#fur-${u})" filter="url(#fuzz-${u})"`;
      const B = `fill="#1F1F23" filter="url(#fuzz-${u})"`;
      const patch = `<path d="M80 68 C68 70 63 86 69 96 C75 104 90 97 92 85 C93 75 88 67 80 68Z" fill="#1F1F23"/>`;
      return {
        c, a,
        back: `<circle class="tail" style="transform-origin:152px 178px" cx="152" cy="178" r="7" ${F}/>
          <circle cx="64" cy="50" r="15" ${B}/><circle cx="136" cy="50" r="15" ${B}/>`,
        body: `<path d="M68 104 C44 118 36 152 42 178 Q46 189 64 189 L136 189 Q154 189 158 178 C164 152 156 118 132 104Z" ${F}/>
          <ellipse cx="54" cy="170" rx="21" ry="18" ${B}/><ellipse cx="146" cy="170" rx="21" ry="18" ${B}/>
          <path d="M56 120 C72 104 128 104 144 120 C148 130 140 138 132 134 L118 128 C110 124 90 124 82 128 L68 134 C60 138 52 130 56 120Z" ${B}/>
          <path d="${PANDA_LEG}" ${B}/>${mirror(`<path d="${PANDA_LEG}" ${B}/>`)}`,
        head: `<ellipse cx="100" cy="80" rx="46" ry="40" ${F}/>${patch}${mirror(patch)}
          <ellipse cx="100" cy="98" rx="17" ry="12" fill="${c.belly}"/>`,
        face: eyes(u, a, { rx: 5, ry: 5.5, pupil: 'round', lid: '#d8d8d8' })
          + '<path d="M93 90 Q100 86 107 90 Q105 96 100 97 Q95 96 93 90Z" fill="#1F1F23"/>'
          + mouth(100, 99, { w: 5 }),
        brow: '#d8d8d8',
      };
    },

    fox(u) {
      const c = { fur: '#D7692C', light: '#F0A065', dark: '#9C4314', belly: '#F8F0E6', iris: '#F2B444', irisDark: '#9C5A12' };
      const a = { head: [100, 74, 46], eyes: [[84, 76], [116, 76]], eyeR: 8, neck: [100, 127, 26], mouthY: 0.57 };
      const F = `fill="url(#fur-${u})" filter="url(#fuzz-${u})"`;
      const W = `fill="url(#soft-${u})" filter="url(#fuzz-${u})"`;
      const ear = `<path d="M64 64 L54 16 Q57 12 62 16 L94 48Z" ${F}/><path d="M54 16 Q57 12 62 16 L67 32 L57 31Z" fill="#2E221D"/>`
        + '<path d="M66 58 L60 27 L86 48Z" fill="#F3E2D2"/>';
      const sock = `<path d="M79 165 Q88 158 97.5 165 L97 182 Q97 189 89 189 Q80 189 79 182Z" fill="#3A2A22" filter="url(#fuzz-${u})"/>`;
      return {
        c, a,
        back: `<g class="tail" style="transform-origin:140px 178px">
            <path d="M138 182 C176 188 196 150 182 116 C176 104 164 104 166 118 C170 140 160 160 134 166Z" ${F}/>
            <path d="M182 116 C176 104 164 104 166 118 C168 127 177 129 182 116Z" ${W}/></g>`,
        body: `<path d="M74 104 C54 118 44 150 46 176 Q48 188 64 188 L136 188 Q152 188 154 176 C156 150 146 118 126 104Z" ${F}/>
          <ellipse cx="59" cy="168" rx="18" ry="18" ${F}/><ellipse cx="141" cy="168" rx="18" ry="18" ${F}/>
          <path d="M82 106 C78 128 86 150 100 158 C114 150 122 128 118 106Z" ${W}/>
          <path d="${LEG}" ${F}/>${sock}${mirror(`<path d="${LEG}" ${F}/>${sock}`)}`,
        head: `${ear}${mirror(ear)}
          <path d="M100 46 C128 46 146 64 146 80 C146 92 136 100 124 104 L106 116 Q100 120 94 116 L76 104 C64 100 54 92 54 80 C54 64 72 46 100 46Z" ${F}/>
          <path d="M56 84 C62 98 78 104 92 112 Q100 118 108 112 C122 104 138 98 144 84 C134 92 120 92 110 98 Q100 104 90 98 C80 92 66 92 56 84Z" ${W}/>
          <path d="M78 81 Q85 88 90 96 M122 81 Q115 88 110 96" stroke="#7A3510" stroke-width="1.5" fill="none" opacity=".45"/>`,
        face: eyes(u, a, { rx: 8, ry: 5.5, rot: 12, pupil: 'slit' })
          + '<path d="M95 110 Q100 107 105 110 Q103 115 100 115 Q97 115 95 110Z" fill="#2E221D"/>'
          + mouth(100, 116, { w: 5 }) + whiskers(100, 114, '#3a2a22', 0.5),
        brow: '#7A3510',
      };
    },

    penguin(u) {
      const c = { fur: '#30333C', light: '#4D5260', dark: '#15161A', belly: '#ECECE8', iris: '#4a3634', irisDark: '#120c0c' };
      const a = { head: [100, 62, 42], eyes: [[84, 62], [116, 62]], eyeR: 4, neck: [100, 96, 34], mouthY: 0.38 };
      const F = `fill="url(#fur-${u})" filter="url(#fuzz-${u})"`;
      const foot = '<path d="M76 183 q-9 6 -1 7 h15 q4 -4 -3 -8Z" fill="#E7A3A0"/>';
      return {
        c, a,
        back: `<path class="arm arm-l" d="M52 98 C36 118 32 146 36 162 C44 152 52 134 58 116Z" ${F}/>
          <path class="arm arm-r" d="M148 98 C164 118 168 146 164 162 C156 152 148 134 142 116Z" ${F}/>
          ${foot}${mirror(foot)}`,
        body: `<path d="M100 32 C134 32 152 72 154 116 C156 160 138 188 100 188 C62 188 44 160 46 116 C48 72 66 32 100 32Z" ${F}/>
          <path d="M100 80 C126 80 140 106 140 138 C140 170 124 186 100 186 C76 186 60 170 60 138 C60 106 74 80 100 80Z" fill="url(#soft-${u})" filter="url(#fuzz-${u})"/>`,
        head: '<circle cx="84" cy="62" r="7.5" fill="#fff"/><circle cx="116" cy="62" r="7.5" fill="#fff"/>',
        face: eyes(u, a, { rx: 4, ry: 4.2, pupil: 'bead', lid: '#555' })
          + beak(100, 72, { color: '#2C2020', edge: '#120c0c', base: '#C0533A', len: 10 }),
        brow: '#e0e0e0',
      };
    },

    chick(u) {
      const c = { fur: '#F5CF4A', light: '#FFF2A8', dark: '#D9A52A', belly: '#FFF6C8', iris: '#2a2a2a', irisDark: '#000000' };
      const a = { head: [100, 84, 32], eyes: [[86, 82], [114, 82]], eyeR: 4.5, neck: [100, 116, 28], mouthY: 0.46 };
      const F = `fill="url(#fur-${u})" filter="url(#fuzz-${u})"`;
      return {
        c, a, fuzz: 6,
        back: '<path d="M88 170 V186 M112 170 V186" stroke="#E39A3A" stroke-width="4" stroke-linecap="round"/>'
          + '<path d="M79 189 L88 186 L97 189 M88 186 V191 M103 189 L112 186 L121 189 M112 186 V191" stroke="#E39A3A" stroke-width="2.6" stroke-linecap="round" fill="none"/>',
        body: `<ellipse cx="100" cy="140" rx="46" ry="40" ${F}/>
          <ellipse cx="100" cy="150" rx="28" ry="24" fill="url(#soft-${u})" filter="url(#fuzz-${u})"/>
          <path class="arm arm-l" d="M60 124 C46 134 46 156 58 164 C66 154 68 138 64 124Z" fill="${c.dark}" filter="url(#fuzz-${u})"/>
          <path class="arm arm-r" d="M140 124 C154 134 154 156 142 164 C134 154 132 138 136 124Z" fill="${c.dark}" filter="url(#fuzz-${u})"/>`,
        head: `<circle cx="100" cy="84" r="32" ${F}/>
          <path d="M96 54 q-3 -9 4 -11 M101 53 q2 -10 9 -8 M98 54 q-8 -6 -10 0" stroke="${c.fur}" stroke-width="4" stroke-linecap="round" fill="none" filter="url(#fuzz-${u})"/>`,
        face: eyes(u, a, { rx: 4.5, ry: 5, pupil: 'bead' })
          + beak(100, 91, { color: '#EE9A34', edge: '#C0701E', base: '#F5B04E', len: 8 }),
        brow: '#A87A10',
      };
    },
  };

  function build(species, opts = {}) {
    const u = `r${++seq}`;
    const d = (SPECIES[species] || SPECIES.cat)(u);
    const { DIRT } = root.PetSVG.parts;
    return `<svg class="pet-svg real sp-${species}" viewBox="0 0 200 200" data-expr="normal" data-look=".45" data-mouth-y="${d.a.mouthY}" aria-hidden="true">
      ${defs(u, d.c, d.fuzz)}
      <g class="pet-body">
        ${d.back || ''}
        ${d.body}
        ${d.head}
        ${DIRT}
        ${d.face}
        ${faceExtras(d.a, d.brow)}
        ${d.front || ''}
        ${accessories(opts.wearing, d.a, '#3a2a22')}
      </g>
    </svg>`;
  }

  // 鸟类:写实的蛋;其他:纸箱,点几下慢慢探出头来
  function egg(species) {
    const u = `r${++seq}`;
    if (species === 'chick' || species === 'penguin') {
      const shell = species === 'chick' ? ['#FFFDF7', '#E9DCC4'] : ['#F7F8F2', '#D9DCCF'];
      const crack = 'fill="none" stroke="#6b5a48" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
      return `<svg class="egg-svg" viewBox="0 0 200 200" aria-hidden="true">
        <defs><radialGradient id="egg-${u}" cx="38%" cy="30%" r="80%"><stop offset="0" stop-color="${shell[0]}"/><stop offset="1" stop-color="${shell[1]}"/></radialGradient></defs>
        <path d="M100 34 C138 34 156 98 156 132 C156 164 130 184 100 184 C70 184 44 164 44 132 C44 98 62 34 100 34Z" fill="url(#egg-${u})"/>
        <g fill="#BFAE96" opacity=".5"><circle cx="80" cy="88" r="2"/><circle cx="122" cy="110" r="1.6"/><circle cx="92" cy="140" r="1.8"/><circle cx="118" cy="72" r="1.3"/><circle cx="70" cy="128" r="1.4"/></g>
        <path class="crack crack-1" d="M66 116 l10 7 l8 -9 l10 9" ${crack}/>
        <path class="crack crack-2" d="M96 123 l8 -8 l10 9 l10 -8 l8 6" ${crack}/>
        <path class="crack crack-3" d="M58 142 l13 -6 l9 8 l11 -10 l13 6 l11 -5 l9 5" ${crack}/>
      </svg>`;
    }
    const d = (SPECIES[species] || SPECIES.cat)(u);
    const fur = d.c.fur;
    const peekEars = {
      cat: `<path d="M82 92 L84 70 L96 86Z" fill="${fur}"/><path d="M118 92 L116 70 L104 86Z" fill="${fur}"/>`,
      fox: `<path d="M80 92 L80 64 L96 86Z" fill="${fur}"/><path d="M120 92 L120 64 L104 86Z" fill="${fur}"/>`,
      rabbit: `<ellipse cx="90" cy="68" rx="6" ry="20" fill="${fur}"/><ellipse cx="110" cy="68" rx="6" ry="20" fill="${fur}"/>`,
      hamster: `<circle cx="86" cy="88" r="7" fill="${fur}"/><circle cx="114" cy="88" r="7" fill="${fur}"/>`,
      panda: '<circle cx="84" cy="86" r="8" fill="#1F1F23"/><circle cx="116" cy="86" r="8" fill="#1F1F23"/>',
      dog: `<ellipse cx="80" cy="92" rx="7" ry="11" fill="#B47A38"/><ellipse cx="120" cy="92" rx="7" ry="11" fill="#B47A38"/>`,
    }[species] || '';
    const head = species === 'panda' ? '#F2F0EA' : fur;
    return `<svg class="egg-svg box" viewBox="0 0 200 200" aria-hidden="true">
      <defs><filter id="fz-${u}"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2"/><feDisplacementMap in="SourceGraphic" scale="3" xChannelSelector="R" yChannelSelector="G"/></filter></defs>
      <path d="M48 96 L100 82 L152 96 L100 110Z" fill="#D9AE74"/>
      <path d="M100 82 V110" stroke="#B98955" stroke-width="1.5"/>
      <g class="crack crack-1">
        <path d="M50 96 L100 83 L150 96 L100 109Z" fill="#4A3320"/>
        <path d="M48 96 L100 110 L86 124 L34 108Z" fill="#E2BA82"/>
        <path d="M152 96 L100 110 L114 124 L166 108Z" fill="#D2A66C"/>
      </g>
      <g class="crack crack-2" filter="url(#fz-${u})">${peekEars}</g>
      <g class="crack crack-3">
        <ellipse cx="100" cy="100" rx="22" ry="13" fill="${head}" filter="url(#fz-${u})"/>
        <circle cx="91" cy="99" r="3.6" fill="#1a120c"/><circle cx="109" cy="99" r="3.6" fill="#1a120c"/>
        <circle cx="90" cy="98" r="1.2" fill="#fff"/><circle cx="108" cy="98" r="1.2" fill="#fff"/>
      </g>
      <path d="M48 96 L100 110 L100 182 L48 164Z" fill="#C99A62"/>
      <path d="M100 110 L152 96 L152 164 L100 182Z" fill="#B5864F"/>
      <path d="M48 96 L100 110 L152 96" fill="none" stroke="#A97A44" stroke-width="1.5"/>
      <path d="M68 101 L68 170" stroke="#E8D3A8" stroke-width="8" opacity=".55"/>
      <g fill="#8A5E30" opacity=".55" transform="translate(126 136) rotate(-12)">
        <ellipse cx="0" cy="4" rx="6" ry="5"/><circle cx="-6" cy="-4" r="2.4"/><circle cx="-2" cy="-7" r="2.4"/><circle cx="3" cy="-7" r="2.4"/><circle cx="7" cy="-3" r="2.4"/>
      </g>
    </svg>`;
  }

  root.PetReal = { build, egg };
})(window);
