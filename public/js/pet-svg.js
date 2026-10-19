// 用 SVG 画出软乎乎的团子宠物。表情靠根节点的 data-expr 切换(见 style.css)。
(function (root) {
  'use strict';

  const OUT = '#4a3a33';
  const SW = 'stroke="#4a3a33" stroke-width="3.5" stroke-linejoin="round"';

  const PALETTE = {
    cat:     { body: '#FFC48C', dark: '#EE9A55', inner: '#FFB3B3', belly: '#FFE6CC' },
    dog:     { body: '#F6DDBB', dark: '#B7835A', inner: '#F7B7A3', belly: '#FFF4E3' },
    rabbit:  { body: '#FFF7F7', dark: '#EED3D8', inner: '#FFB7C8', belly: '#FFFFFF' },
    hamster: { body: '#F9C77E', dark: '#E3A24F', inner: '#FFB7A8', belly: '#FFF4E0' },
    panda:   { body: '#FFFFFF', dark: '#3B3B42', inner: '#5C5C66', belly: '#F2F2F2' },
    fox:     { body: '#FFA266', dark: '#DE7234', inner: '#FFE1CC', belly: '#FFF6EE' },
    penguin: { body: '#56668A', dark: '#3E4A66', inner: '#FFA94D', belly: '#FFFFFF' },
    chick:   { body: '#FFE27A', dark: '#F5C542', inner: '#FFA43D', belly: '#FFF4BF' },
  };
  const BEAKED = { chick: true, penguin: true };

  const BODY = 'M100 50 C150 50 176 92 176 136 C176 171 145 183 100 183 C55 183 24 171 24 136 C24 92 50 50 100 50 Z';

  const mirror = (svg) => `<g transform="translate(200 0) scale(-1 1)">${svg}</g>`;

  function ears(sp, c) {
    switch (sp) {
      case 'cat': {
        const e = `<path d="M40 96 L50 30 L96 58 Z" fill="${c.body}" ${SW}/><path d="M54 76 L56 46 L80 60 Z" fill="${c.inner}"/>`;
        return { back: e + mirror(e) };
      }
      case 'fox': {
        const e = `<path d="M38 98 L44 18 L98 58 Z" fill="${c.body}" ${SW}/><path d="M52 74 L50 36 L78 58 Z" fill="${c.inner}"/>`;
        return { back: e + mirror(e) };
      }
      case 'rabbit': {
        const e = `<g transform="rotate(-12 76 44)"><ellipse cx="76" cy="40" rx="15" ry="38" fill="${c.body}" ${SW}/><ellipse cx="76" cy="44" rx="7" ry="27" fill="${c.inner}"/></g>`;
        return { back: e + mirror(e) };
      }
      case 'hamster': {
        const e = `<circle cx="52" cy="68" r="18" fill="${c.body}" ${SW}/><circle cx="53" cy="69" r="9" fill="${c.inner}"/>`;
        return { back: e + mirror(e) };
      }
      case 'panda': {
        const e = `<circle cx="50" cy="66" r="20" fill="${c.dark}" ${SW}/>`;
        return { back: e + mirror(e) };
      }
      case 'dog': {
        const e = `<ellipse cx="36" cy="102" rx="17" ry="33" transform="rotate(18 36 102)" fill="${c.dark}" ${SW}/>`;
        return { front: e + mirror(e) };
      }
      case 'chick':
        return { back: `<path d="M97 54 C88 36 98 26 104 34 C108 24 120 28 113 42 C110 48 105 52 100 54 Z" fill="${c.body}" ${SW}/>` };
      case 'penguin':
        return { back: `<path d="M96 54 C92 40 102 34 106 40 C108 46 104 52 100 54 Z" fill="${c.body}" ${SW}/>` };
      default:
        return {};
    }
  }

  function markings(sp, c) {
    switch (sp) {
      case 'cat':
        return `<path d="M100 58 v13 M86 60 l3 11 M114 60 l-3 11" stroke="${c.dark}" stroke-width="4" stroke-linecap="round"/>`
          + `<ellipse cx="100" cy="162" rx="40" ry="18" fill="${c.belly}"/>`;
      case 'dog':
        return `<ellipse cx="126" cy="108" rx="18" ry="16" fill="${c.dark}" opacity=".45"/>`
          + `<ellipse cx="100" cy="162" rx="40" ry="18" fill="${c.belly}"/>`;
      case 'panda': {
        const p = `<ellipse cx="74" cy="112" rx="17" ry="20" transform="rotate(25 74 112)" fill="${c.dark}"/>`;
        return p + mirror(p);
      }
      case 'fox':
        return `<path d="M54 122 Q100 102 146 122 Q146 168 100 172 Q54 168 54 122 Z" fill="${c.belly}"/>`;
      case 'hamster':
        return `<ellipse cx="100" cy="150" rx="52" ry="32" fill="${c.belly}"/>`;
      case 'penguin':
        return `<path d="M100 80 C122 68 156 86 156 124 C156 158 130 174 100 174 C70 174 44 158 44 124 C44 86 78 68 100 80 Z" fill="${c.belly}"/>`;
      case 'chick':
        return `<ellipse cx="100" cy="164" rx="36" ry="14" fill="${c.belly}"/>`;
      default:
        return `<ellipse cx="100" cy="162" rx="40" ry="18" fill="${c.belly}" opacity=".8"/>`;
    }
  }

  function eyes(sp) {
    const fill = sp === 'panda' ? '#151517' : '#2d2420';
    const one = (x) => `<g transform="translate(${x} 112)">
      <g class="eyes-look"><g class="eye-open">
        <ellipse rx="9" ry="11" fill="${fill}"/>
        <circle cx="-3" cy="-4" r="3.8" fill="#fff"/><circle cx="3.2" cy="4.2" r="1.7" fill="#fff"/>
      </g></g>
      <path class="eye-happy" d="M-9 3 Q0 -9 9 3" fill="none" stroke="${sp === 'panda' ? '#fff' : OUT}" stroke-width="4" stroke-linecap="round"/>
      <path class="eye-closed" d="M-9 -1 Q0 7 9 -1" fill="none" stroke="${sp === 'panda' ? '#fff' : OUT}" stroke-width="4" stroke-linecap="round"/>
    </g>`;
    return `<g class="eyes">${one(76)}${one(124)}</g>`;
  }

  function mouth(sp, c) {
    if (BEAKED[sp]) {
      const closed = `d="M90 126 Q100 121 110 126 L100 138 Z" fill="${c.inner}" ${SW}`;
      const open = `<path d="M89 123 Q100 117 111 123 L100 130 Z" fill="${c.inner}" ${SW}/><path d="M92 134 L108 134 L100 143 Z" fill="${c.inner}" ${SW}/>`;
      return `<path class="mouth-normal" ${closed}/><path class="mouth-sad" ${closed}/>`
        + `<g class="mouth-open">${open}</g><g class="mouth-o">${open}</g>`;
    }
    const line = `fill="none" stroke="${OUT}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"`;
    return `<path class="mouth-normal" d="M90 130 q5 6 10 0 q5 6 10 0" ${line}/>`
      + `<g class="mouth-open"><path d="M88 129 Q100 152 112 129 Z" fill="#7a3333" ${SW}/><ellipse cx="100" cy="140" rx="6" ry="3.5" fill="#ff9090"/></g>`
      + `<path class="mouth-sad" d="M91 139 q9 -9 18 0" ${line}/>`
      + `<ellipse class="mouth-o" cx="100" cy="134" rx="5" ry="6" fill="#7a3333" stroke="${OUT}" stroke-width="2.5"/>`;
  }

  const FACE_EXTRAS = `
    <g class="brows-sad" stroke="${OUT}" stroke-width="3.5" stroke-linecap="round"><path d="M64 98 L84 92"/><path d="M136 98 L116 92"/></g>
    <g class="brows-angry" stroke="${OUT}" stroke-width="3.5" stroke-linecap="round"><path d="M64 92 L85 99"/><path d="M136 92 L115 99"/></g>
    <path class="tear" d="M68 124 q-6 9 0 12 q6 -3 0 -12 z" fill="#86CCFF" stroke="#5aa8e0" stroke-width="1.5"/>
    <g class="angry-mark" stroke="#ff5c5c" stroke-width="4" stroke-linecap="round" fill="none">
      <path d="M146 66 q6 4 12 0"/><path d="M146 78 q6 -4 12 0"/><path d="M146 66 q-4 6 0 12"/><path d="M158 66 q4 6 0 12"/>
    </g>`;

  const DIRT = `<g class="dirt" fill="#8B6B4A">
      <ellipse cx="62" cy="92" rx="7" ry="4.5" opacity=".55"/><ellipse cx="140" cy="152" rx="9" ry="5" opacity=".5"/>
      <circle cx="128" cy="76" r="4" opacity=".5"/><ellipse cx="54" cy="156" rx="6" ry="4" opacity=".5"/><circle cx="150" cy="104" r="3" opacity=".45"/>
    </g>
    <g class="stink" fill="none" stroke="#9bbf6a" stroke-width="3" stroke-linecap="round">
      <path d="M60 40 q-6 -8 0 -16 q6 -8 0 -16"/><path d="M140 38 q-6 -8 0 -16 q6 -8 0 -16"/>
    </g>`;

  const SHELL = `<path d="M66 70 C66 34 134 34 134 70 L126 60 L117 71 L108 60 L100 71 L92 60 L83 71 L74 60 Z" fill="#FFFBF0" ${SW}/>`
    + `<circle cx="88" cy="50" r="4" fill="#FFD8A8"/><circle cx="114" cy="46" r="3" fill="#FFD8A8"/>`;

  const ACCESSORIES = {
    bow: `<g transform="translate(142 64) rotate(18)">
        <path d="M0 0 L-20 -13 Q-25 0 -20 13 Z" fill="#FF7AA8" ${SW}/><path d="M0 0 L20 -13 Q25 0 20 13 Z" fill="#FF7AA8" ${SW}/>
        <circle r="6.5" fill="#FF4F8B" ${SW}/></g>`,
    flower: `<g transform="translate(60 66)">
        ${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="0" cy="-10" rx="6.5" ry="9" transform="rotate(${a})" fill="#fff" stroke="${OUT}" stroke-width="2.5"/>`).join('')}
        <circle r="6.5" fill="#FFD43B" stroke="${OUT}" stroke-width="2.5"/></g>`,
    partyhat: `<path d="M78 60 L100 6 L122 60 Z" fill="#7AD3FF" ${SW}/>
        <path d="M86 42 L114 42 M92 26 L108 26" stroke="#fff" stroke-width="5" stroke-linecap="round"/>
        <circle cx="100" cy="7" r="7" fill="#FFD43B" ${SW}/>`,
    crown: `<path d="M72 60 L76 26 L89 43 L100 20 L111 43 L124 26 L128 60 Z" fill="#FFD43B" ${SW}/>
        <circle cx="100" cy="48" r="5" fill="#FF6B9A" stroke="${OUT}" stroke-width="2"/><circle cx="84" cy="51" r="3.5" fill="#7AD3FF"/><circle cx="116" cy="51" r="3.5" fill="#7AD3FF"/>`,
    glasses: `<g fill="rgba(255,255,255,.18)" stroke="${OUT}" stroke-width="3.5">
        <circle cx="76" cy="112" r="16"/><circle cx="124" cy="112" r="16"/></g>
        <path d="M92 110 Q100 104 108 110" fill="none" stroke="${OUT}" stroke-width="3.5"/>`,
    scarf: `<path d="M40 146 Q100 170 160 146 L162 160 Q100 186 38 160 Z" fill="#FF6B6B" ${SW}/>
        <path d="M122 168 L128 196 L144 192 L136 164 Z" fill="#FF6B6B" ${SW}/>
        <path d="M60 156 v8 M80 162 v8 M100 165 v8" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7"/>`,
    bell: `<path d="M48 148 Q100 168 152 148" fill="none" stroke="#FF5C7A" stroke-width="7" stroke-linecap="round"/>
        <path d="M48 148 Q100 168 152 148" fill="none" stroke="${OUT}" stroke-width="1.5" opacity=".5"/>
        <circle cx="100" cy="166" r="9" fill="#FFD43B" ${SW}/><path d="M95 168 h10" stroke="${OUT}" stroke-width="2.5" stroke-linecap="round"/>`,
  };

  function accessories(wearing = {}) {
    return ['neck', 'face', 'head']
      .map((slot) => (wearing[slot] && ACCESSORIES[wearing[slot]]) || '')
      .join('');
  }

  function build(species, opts = {}) {
    const c = PALETTE[species] || PALETTE.cat;
    const e = ears(species, c);
    const foot = BEAKED[species] ? c.inner : c.dark;
    return `<svg class="pet-svg sp-${species}" viewBox="0 0 200 200" data-expr="normal" aria-hidden="true">
      <g class="pet-body">
        ${e.back || ''}
        <ellipse class="arm arm-l" cx="30" cy="142" rx="14" ry="11" fill="${c.body}" ${SW}/>
        <ellipse class="arm arm-r" cx="170" cy="142" rx="14" ry="11" fill="${c.body}" ${SW}/>
        <ellipse cx="74" cy="181" rx="15" ry="8" fill="${foot}" ${SW}/>
        <ellipse cx="126" cy="181" rx="15" ry="8" fill="${foot}" ${SW}/>
        <path d="${BODY}" fill="${c.body}" ${SW}/>
        ${markings(species, c)}
        ${DIRT}
        <ellipse class="cheek" cx="58" cy="130" rx="10" ry="6" fill="#FF8FA3"/>
        <ellipse class="cheek" cx="142" cy="130" rx="10" ry="6" fill="#FF8FA3"/>
        ${eyes(species)}
        ${mouth(species, c)}
        ${FACE_EXTRAS}
        ${e.front || ''}
        ${opts.shell ? SHELL : ''}
        ${accessories(opts.wearing)}
      </g>
    </svg>`;
  }

  function egg(species) {
    const c = PALETTE[species] || PALETTE.cat;
    const crack = `fill="none" stroke="${OUT}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"`;
    return `<svg class="egg-svg" viewBox="0 0 200 200" aria-hidden="true">
      <path d="M100 28 C142 28 162 96 162 132 C162 166 134 186 100 186 C66 186 38 166 38 132 C38 96 58 28 100 28 Z" fill="#FFFBF0" ${SW}/>
      <circle cx="76" cy="92" r="11" fill="${c.body}"/><circle cx="128" cy="124" r="15" fill="${c.body}"/>
      <circle cx="84" cy="154" r="8" fill="${c.body}"/><circle cx="120" cy="68" r="6" fill="${c.body}"/>
      <path class="crack crack-1" d="M64 116 l12 9 l9 -11 l11 11" ${crack}/>
      <path class="crack crack-2" d="M96 125 l9 -9 l11 11 l11 -9 l9 7" ${crack}/>
      <path class="crack crack-3" d="M56 144 l14 -7 l10 9 l12 -11 l14 7 l12 -6 l10 6" ${crack}/>
    </svg>`;
  }

  root.PetSVG = { build, egg, PALETTE };
})(window);
