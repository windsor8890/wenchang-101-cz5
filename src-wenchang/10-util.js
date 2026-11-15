/* ============================================================================
 * 10-util.js — shared foundation for the Wenchang CZ-5 / Chang'e 7 dossier
 * Owner: Lead. All modules may use `T`, `U`, `MAT`, `SPEC`, `APP`, `FLAGS`, `Q`.
 * ==========================================================================*/
(function () {
  'use strict';

  const T = (window.T = window.THREE);
  const PI = Math.PI, TAU = PI * 2, DEG = PI / 180, RAD = 180 / PI;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const fract = (v) => v - Math.floor(v);
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const smoothstep = smooth;
  const easeInOut = (t) => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

  function rng(seed) {
    let s = seed >>> 0 || 1;
    const next = () => {
      s ^= s << 13; s >>>= 0;
      s ^= s >> 17;
      s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
    return {
      next,
      range: (a, b) => a + (b - a) * next(),
      int: (a, b) => Math.floor(a + (b - a + 1) * next()),
      pick: (arr) => arr[Math.floor(next() * arr.length)],
      chance: (p) => next() < p,
      gauss: (m, sd) => {
        let u = 0, v = 0; while (u === 0) u = next(); while (v === 0) v = next();
        return m + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
      }
    };
  }
  const hash2 = (x, y) => {
    let h = x * 374761393 + y * 668265263;
    h = (h ^ (h >> 13)) * 1274126177;
    return ((h ^ (h >> 16)) >>> 0) / 4294967296;
  };
  function vnoise2(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash2(xi, yi), b = hash2(xi + 1, yi);
    const c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
    return lerp(lerp(a, b, u), lerp(c, d, u), v);
  }
  function fbm2(x, y, oct = 4, lac = 2, gain = .5) {
    let a = .5, f = 1, s = 0;
    for (let i = 0; i < oct; i++) { s += a * vnoise2(x * f, y * f); f *= lac; a *= gain; }
    return s;
  }

  /* URL flags ---------------------------------------------------------------*/
  const Q = (window.__Q__ = window.__Q__ || (function () {
    const q = {};
    try {
      location.search.replace(/^\?/, '').split('&').forEach(kv => {
        if (!kv) return;
        const i = kv.indexOf('=');
        q[decodeURIComponent(i < 0 ? kv : kv.slice(0, i))] =
          i < 0 ? '1' : decodeURIComponent(kv.slice(i + 1));
      });
    } catch (e) { /* ignore */ }
    return q;
  })());
  const has = (k) => Object.prototype.hasOwnProperty.call(Q, k);
  const FLAGS = {
    instant: has('instant'), still: has('still'), raw: has('raw'), lq: has('lq') || has('low'),
    pr: has('pr') ? clamp(parseFloat(Q.pr) || 1, .4, 2) : null,
    only: has('only') ? Q.only.split(',').map(s => s.trim()).filter(Boolean) : null,
    noui: has('noui'), nolabels: has('nolabels'), noshadow: has('noshadow'),
    view: Q.view || null, mode: Q.mode || null,
    cut: has('cut') ? clamp(parseFloat(Q.cut) || 0, 0, 1) : null,
    time: Q.time || null, cam: Q.cam || null, t: has('t') ? parseFloat(Q.t) || 0 : null,
    debug: has('debug')
  };

  /* Scene constants ---------------------------------------------------------*/
  const SPEC = {
    pad: {
      deckY: 7.0,              // concrete hardstand top
      halfW: 39, halfD: 35,    // 78 x 70 m
      mlpTopY: 12.2,
      mlpHalf: 12,
      mlpHeight: 5.2
    },
    rocket: {
      baseY: 13.8,             // world y of nozzle exit plane
      height: 56.97,
      coreR: 2.5,
      fairingR: 2.6,
      boosterR: 1.675,
      boosterLen: 27.6,
      boosterBottom: 1.6,
      boosterTop: 29.2,
      boosterDist: 4.15,
      boosterAngles: [45, 135, 225, 315],
      stations: {
        base: 0, engineMount: 2.9, thrustTop: 4.4,
        lh2Bottom: 4.4, lh2Top: 16.2, commonTop: 17.0,
        loxTop: 29.4, s1Top: 33.16,
        s2Base: 33.16, s2EngineTop: 35.6, s2TankBottom: 35.6,
        s2Common: 39.4, s2TankTop: 43.4, s2Top: 44.70,
        fairingBase: 44.70, fairingBoatTop: 52.85, fairingTip: 56.97,
        yz2Base: 44.70, yz2Top: 49.60, adapterTop: 50.60,
        payloadBase: 50.60, payloadTop: 56.30
      }
    },
    tower: { x: -18.5, z: 0, w: 16, d: 16, top: 98.7, height: 91.7 },
    masts: [[-58, -52], [58, -52], [-58, 52], [58, 52]],
    sea: { coastlineX: 230 },
    color: {
      paper: 0xefe9dc, ink: 0x1a1e1d, red: 0xc43a24,
      sky: 0xbfd6dd, seaDeep: 0x1c5f6b, seaShallow: 0x56b8b2,
      concrete: 0x9a988e, foliage: 0x3f5c36
    }
  };
  SPEC.rocket.worldY = (localY) => SPEC.rocket.baseY + localY;
  SPEC.rocket.boosterPos = (i) => {
    const a = SPEC.rocket.boosterAngles[i] * DEG;
    return { x: Math.cos(a) * SPEC.rocket.boosterDist, z: Math.sin(a) * SPEC.rocket.boosterDist, angle: a };
  };

  const APP = (window.APP = window.APP || {
    scene: null, camera: null, renderer: null,
    modules: {}, parts: {}, partsOrder: [],
    cutables: [], explodables: [], timeables: [], updaters: [],
    actions: {}, views: [], quality: FLAGS.lq ? 'low' : 'high',
    cutPlane: null, ready: false
  });
  APP.modules = APP.modules || {};
  APP.parts = APP.parts || {};
  APP.partsOrder = APP.partsOrder || [];
  APP.cutables = APP.cutables || [];
  APP.explodables = APP.explodables || [];
  APP.timeables = APP.timeables || [];
  APP.updaters = APP.updaters || [];

  function reportError(msg) {
    const el = document.getElementById('err');
    if (el) { el.style.display = 'block'; el.textContent = String(msg); }
    console.error('[scene]', msg);
  }
  window.reportError = reportError;

  /* Canvas texture helpers --------------------------------------------------*/
  const CJK = '"Noto Sans SC","Microsoft YaHei UI","Microsoft YaHei","PingFang SC","DengXian",sans-serif';
  const SERIF = '"Noto Serif SC","Songti SC","STSong","SimSun",serif';

  function texCanvas(w, h, draw, opts) {
    opts = opts || {};
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    if (draw) draw(ctx, cv);
    const tex = new T.CanvasTexture(cv);
    if (opts.srgb !== false) tex.colorSpace = T.SRGBColorSpace;
    tex.anisotropy = 8;
    tex.wrapS = opts.wrapS || T.ClampToEdgeWrapping;
    tex.wrapT = opts.wrapT || T.ClampToEdgeWrapping;
    if (opts.repeat) tex.repeat.set(opts.repeat[0], opts.repeat[1]);
    if (opts.needsUpdate !== false) tex.needsUpdate = true;
    return { cv, ctx, tex };
  }

  function texText(text, o) {
    o = Object.assign({
      w: 1024, h: 256, size: 96, color: '#ffffff', bg: null,
      font: CJK, align: 'center', letterSpacing: 0, pad: 24, weight: '500',
      lineHeight: 1.15, vertical: false
    }, o || {});
    const lines = String(text).split('\n');
    const c = texCanvas(o.w, o.h, (ctx, cv) => {
      if (o.bg) { ctx.fillStyle = o.bg; ctx.fillRect(0, 0, cv.width, cv.height); }
      ctx.fillStyle = o.color;
      ctx.textAlign = o.align;
      ctx.textBaseline = 'middle';
      ctx.font = o.weight + ' ' + o.size + 'px ' + o.font;
      if (o.vertical) {
        const chars = String(text).split('');
        const gap = o.size * 1.08;
        const x = o.align === 'left' ? o.pad : (o.align === 'right' ? o.w - o.pad : o.w / 2);
        const y0 = (o.h - (chars.length - 1) * gap) / 2;
        chars.forEach((ch, i) => ctx.fillText(ch, x, y0 + i * gap));
      } else {
        const lh = o.size * o.lineHeight;
        const y0 = o.h / 2 - (lines.length - 1) * lh / 2;
        const x = o.align === 'left' ? o.pad : (o.align === 'right' ? o.w - o.pad : o.w / 2);
        lines.forEach((ln, i) => {
          if (o.letterSpacing) {
            let total = 0;
            for (const ch of ln) total += ctx.measureText(ch).width + o.letterSpacing;
            total -= o.letterSpacing;
            let cx = o.align === 'left' ? o.pad : (o.align === 'right' ? o.w - o.pad - total : (o.w - total) / 2);
            for (const ch of ln) {
              ctx.fillText(ch, cx, y0 + i * lh);
              cx += ctx.measureText(ch).width + o.letterSpacing;
            }
          } else {
            ctx.fillText(ln, x, y0 + i * lh);
          }
        });
      }
    }, { srgb: o.srgb });
    return o.returnObject ? c : c.tex;
  }

  function texNoise(size, o) {
    o = Object.assign({ scale: 6, oct: 4, contrast: 1, lo: 0, hi: 255, seed: 1, alpha: false }, o || {});
    const c = texCanvas(size, size, (ctx, cv) => {
      const img = ctx.createImageData(size, size);
      const r = rng(o.seed);
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        let n = fbm2(x / size * o.scale + r.range(0, .01), y / size * o.scale, o.oct);
        n = clamp((n - .5) * o.contrast + .5, 0, 1);
        const v = Math.round(lerp(o.lo, o.hi, n));
        const i = (y * size + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = o.alpha ? Math.round(n * 255) : 255;
      }
      ctx.putImageData(img, 0, 0);
    }, { srgb: !o.linear });
    c.tex.wrapS = c.tex.wrapT = T.RepeatWrapping;
    return c.tex;
  }

  function texRadial(size, stops) {
    stops = stops || [[0, 'rgba(255,255,255,1)'], [.35, 'rgba(255,255,255,.45)'], [1, 'rgba(255,255,255,0)']];
    return texCanvas(size, size, (ctx, cv) => {
      const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      stops.forEach(s => g.addColorStop(s[0], s[1]));
      ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
    }, { srgb: false }).tex;
  }

  function texGradient(w, h, stops, vertical) {
    return texCanvas(w, h, (ctx, cv) => {
      const g = vertical ? ctx.createLinearGradient(0, 0, 0, h) : ctx.createLinearGradient(0, 0, w, 0);
      stops.forEach(s => g.addColorStop(s[0], s[1]));
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }).tex;
  }

  function texStripe(w, h, o) {
    o = Object.assign({ a: '#e0a92a', b: '#1a1b1a', stripe: 32, angle: 45 }, o || {});
    return texCanvas(w, h, (ctx, cv) => {
      ctx.fillStyle = o.a; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = o.b;
      ctx.save(); ctx.translate(w / 2, h / 2); ctx.rotate(o.angle * DEG); ctx.translate(-w, -h);
      for (let x = 0; x < w * 3; x += o.stripe * 2) ctx.fillRect(x, -h, o.stripe, h * 4);
      ctx.restore();
    }).tex;
  }

  function texConcrete(o) {
    o = Object.assign({ size: 512, base: '#93928a', seed: 7, tone: .1 }, o || {});
    const seed = o.seed;
    const map = texCanvas(o.size, o.size, (ctx, cv) => {
      const r = rng(seed);
      ctx.fillStyle = o.base; ctx.fillRect(0, 0, o.size, o.size);
      const img = ctx.getImageData(0, 0, o.size, o.size);
      for (let y = 0; y < o.size; y++) for (let x = 0; x < o.size; x++) {
        let n = fbm2(x / o.size * 9 + 1, y / o.size * 9 + 3, 4) * .5 + fbm2(x / o.size * 47, y / o.size * 47, 2) * .2;
        const v = (n - .35) * 85 * o.tone * 4;
        const i = (y * o.size + x) * 4;
        img.data[i] = clamp(img.data[i] + v, 0, 255);
        img.data[i + 1] = clamp(img.data[i + 1] + v, 0, 255);
        img.data[i + 2] = clamp(img.data[i + 2] + v, 0, 255);
      }
      ctx.putImageData(img, 0, 0);
      // faint expansion joints
      ctx.strokeStyle = 'rgba(30,30,28,.22)'; ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, o.size - 2, o.size - 2);
      ctx.beginPath(); ctx.moveTo(o.size / 2, 0); ctx.lineTo(o.size / 2, o.size);
      ctx.moveTo(0, o.size / 2); ctx.lineTo(o.size, o.size / 2); ctx.stroke();
      // stains
      for (let i = 0; i < 26; i++) {
        const x = r.range(0, o.size), y = r.range(0, o.size), rad = r.range(8, 80);
        const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
        g.addColorStop(0, 'rgba(40,40,35,' + r.range(.02, .09) + ')');
        g.addColorStop(1, 'rgba(40,40,35,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.fill();
      }
    }).tex;
    map.wrapS = map.wrapT = T.RepeatWrapping;
    const bump = texNoise(256, { scale: 8, oct: 4, contrast: 1.4, lo: 80, hi: 200, seed: seed + 1 });
    bump.wrapS = bump.wrapT = T.RepeatWrapping;
    const rough = texNoise(256, { scale: 5, oct: 3, contrast: 1, lo: 150, hi: 235, seed: seed + 2 });
    rough.wrapS = rough.wrapT = T.RepeatWrapping;
    return { map, bump, rough };
  }

  /* Materials ---------------------------------------------------------------*/
  const MATS = {};
  const MAT = {
    get(name) {
      if (MATS[name]) return MATS[name];
      MATS[name] = U.matStandard({ color: 0x9a9a96, roughness: .7, metalness: .1 });
      return MATS[name];
    },
    set(name, m) { MATS[name] = m; return m; },
    has: (name) => !!MATS[name]
  };

  function matStandard(o) {
    const m = new T.MeshStandardMaterial(Object.assign({
      roughness: .72, metalness: .06
    }, o || {}));
    if (o && o.envMapIntensity !== undefined) m.envMapIntensity = o.envMapIntensity;
    return m;
  }
  const matMetal = (color, rough) => matStandard({ color, roughness: rough === undefined ? .42 : rough, metalness: .78, envMapIntensity: 1.1 });
  const matEmissive = (color, intensity) => new T.MeshStandardMaterial({ color: 0x111111, emissive: color, emissiveIntensity: intensity === undefined ? 1.6 : intensity, roughness: .6, metalness: 0 });
  const matBasic = (o) => new T.MeshBasicMaterial(Object.assign({ color: 0xffffff }, o || {}));
  const matGlass = (o) => new T.MeshPhysicalMaterial(Object.assign({
    color: 0x8fb8c4, roughness: .12, metalness: .1, transparent: true, opacity: .34,
    transmission: 0, side: T.DoubleSide, depthWrite: false
  }, o || {}));

  function defineMat(name, factory) {
    if (!MATS[name]) MATS[name] = factory();
    return MATS[name];
  }

  function initSharedMaterials() {
    defineMat('paintWhite', () => matStandard({ color: 0xecebe4, roughness: .48, metalness: .04, envMapIntensity: .75 }));
    defineMat('paintWarm', () => matStandard({ color: 0xe3dfd3, roughness: .5, metalness: .05, envMapIntensity: .7 }));
    defineMat('paintGrey', () => matStandard({ color: 0x9fa3a1, roughness: .55, metalness: .15 }));
    defineMat('paintDark', () => matStandard({ color: 0x3b4143, roughness: .55, metalness: .3 }));
    defineMat('steel', () => matMetal(0x9aa0a1, .42));
    defineMat('steelDark', () => matMetal(0x565d5f, .48));
    defineMat('steelLight', () => matMetal(0xc3c7c5, .38));
    defineMat('concrete', () => matStandard({ color: 0x96948a, roughness: .92, metalness: .02 }));
    defineMat('concretePale', () => matStandard({ color: 0xb4b0a3, roughness: .9, metalness: .02 }));
    defineMat('asphalt', () => matStandard({ color: 0x4b4d48, roughness: .95, metalness: .02 }));
    defineMat('hazard', () => matStandard({ color: 0xd2a52c, roughness: .7, metalness: .05 }));
    defineMat('goldMLI', () => matStandard({ color: 0xb99435, roughness: .3, metalness: .78, envMapIntensity: 1.2 }));
    defineMat('goldMLIDark', () => matStandard({ color: 0x7a5e20, roughness: .42, metalness: .65 }));
    defineMat('foilSilver', () => matStandard({ color: 0xc7cbca, roughness: .3, metalness: .65, envMapIntensity: 1.2 }));
    defineMat('nozzleMetal', () => matStandard({ color: 0x3d4143, roughness: .4, metalness: .88, envMapIntensity: 1.1 }));
    defineMat('nozzleInner', () => matStandard({ color: 0x24282a, roughness: .52, metalness: .8, side: T.DoubleSide }));
    defineMat('copper', () => matMetal(0x8a5a39, .36));
    defineMat('blackMatte', () => matStandard({ color: 0x17191a, roughness: .86, metalness: .08 }));
    defineMat('rubber', () => matStandard({ color: 0x141616, roughness: .92, metalness: .01 }));
    defineMat('blackGloss', () => matStandard({ color: 0x0e1011, roughness: .25, metalness: .45 }));
    defineMat('glowWarm', () => matEmissive(0xffd9a0, 2.4));
    defineMat('glowWhite', () => matEmissive(0xeef4ff, 2.2));
    defineMat('glowRed', () => matEmissive(0xff3524, 2.6));
    defineMat('glowAmber', () => matEmissive(0xffa028, 2.2));
    defineMat('glowGreen', () => matEmissive(0x64e08a, 2.0));
    defineMat('ocean', () => matStandard({ color: 0x1f6a74, roughness: .22, metalness: .2, envMapIntensity: 1.2 }));
    defineMat('foliage', () => matStandard({ color: 0x405c35, roughness: .88, metalness: 0 }));
    defineMat('foliageDark', () => matStandard({ color: 0x2e4728, roughness: .9, metalness: 0 }));
    defineMat('trunk', () => matStandard({ color: 0x5b4a38, roughness: .92 }));
    defineMat('sand', () => matStandard({ color: 0xc6b693, roughness: .95 }));
    defineMat('grass', () => matStandard({ color: 0x697a49, roughness: .95 }));
    defineMat('whiteHull', () => matStandard({ color: 0xf2f1ea, roughness: .42, metalness: .03 }));
    defineMat('tankWhite', () => matStandard({ color: 0xdcdcd5, roughness: .5, metalness: .06 }));
    defineMat('tankGold', () => matStandard({ color: 0xc1a052, roughness: .35, metalness: .55 }));
    defineMat('pipe', () => matStandard({ color: 0xb9b6a9, roughness: .45, metalness: .6 }));
    defineMat('pipeDark', () => matStandard({ color: 0x7b7f7c, roughness: .5, metalness: .65 }));
    defineMat('cable', () => matStandard({ color: 0x2b2e2d, roughness: .8 }));
    defineMat('redPaint', () => matStandard({ color: 0xb83424, roughness: .55, metalness: .05 }));
    defineMat('bluePaint', () => matStandard({ color: 0x3b5f73, roughness: .62, metalness: .08 }));
  }
  initSharedMaterials();

  /* Geometry helpers --------------------------------------------------------*/
  function group(name, parent) {
    const g = new T.Group(); if (name) g.name = name;
    if (parent) parent.add(g);
    return g;
  }

  function mesh(geo, mat, o) {
    o = o || {};
    const m = new T.Mesh(geo, mat);
    if (o.x !== undefined) m.position.x = o.x;
    if (o.y !== undefined) m.position.y = o.y;
    if (o.z !== undefined) m.position.z = o.z;
    if (o.rx) m.rotation.x = o.rx;
    if (o.ry) m.rotation.y = o.ry;
    if (o.rz) m.rotation.z = o.rz;
    if (o.sx !== undefined) m.scale.x = o.sx;
    if (o.sy !== undefined) m.scale.y = o.sy;
    if (o.sz !== undefined) m.scale.z = o.sz;
    if (o.cast) m.castShadow = true;
    if (o.receive) m.receiveShadow = true;
    if (o.renderOrder !== undefined) m.renderOrder = o.renderOrder;
    if (o.name) m.name = o.name;
    if (o.parent) o.parent.add(m);
    return m;
  }

  const boxMesh = (w, h, d, mat, o) => mesh(new T.BoxGeometry(w, h, d), mat, o);
  const planeMesh = (w, h, mat, o) => mesh(new T.PlaneGeometry(w, h), mat, o);
  function cylMesh(rt, rb, h, seg, mat, o) {
    return mesh(new T.CylinderGeometry(rt, rb, h, seg, 1, !!(o && o.openEnded)), mat, o);
  }
  function lathe(points, seg, o) {
    const pts = points.map(p => (p.isVector2 ? p : new T.Vector2(p[0], p[1])));
    return mesh(new T.LatheGeometry(pts, seg || 48), (o && o.mat) || MAT.get('paintWhite'), o || {});
  }
  function tube(points, radius, tubularSeg, radialSeg, mat, o) {
    const curve = new T.CatmullRomCurve3(points.map(p => (p.isVector3 ? p : new T.Vector3(p[0], p[1], p[2]))));
    const geo = new T.TubeGeometry(curve, tubularSeg || 32, radius, radialSeg || 8, false);
    return mesh(geo, mat || MAT.get('pipe'), o || {});
  }
  function torus(radius, tubeR, mat, o) {
    return mesh(new T.TorusGeometry(radius, tubeR, 12, 48), mat, o || {});
  }
  function ring(inner, outer, mat, o) {
    const shape = new T.Shape(); shape.absarc(0, 0, outer, 0, TAU, false);
    const hole = new T.Path(); hole.absarc(0, 0, inner, 0, TAU, true);
    shape.holes.push(hole);
    return mesh(new T.ExtrudeGeometry(shape, { depth: (o && o.depth) || .05, bevelEnabled: false, curveSegments: 40 }), mat, o || {});
  }
  function roundedBox(w, h, d, r, seg) {
    // small helper built from a rounded 2D shape extruded; r <= min/2
    const shape = new T.Shape();
    const x = -w / 2, y = -h / 2, rr = Math.min(r, w / 2, h / 2);
    shape.moveTo(x + rr, y);
    shape.lineTo(x + w - rr, y); shape.quadraticCurveTo(x + w, y, x + w, y + rr);
    shape.lineTo(x + w, y + h - rr); shape.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    shape.lineTo(x + rr, y + h); shape.quadraticCurveTo(x, y + h, x, y + h - rr);
    shape.lineTo(x, y + rr); shape.quadraticCurveTo(x, y, x + rr, y);
    const geo = new T.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false, curveSegments: seg || 4 });
    geo.translate(0, 0, -d / 2);
    return geo;
  }

  function instanced(geo, mat, list, o) {
    o = o || {};
    const im = new T.InstancedMesh(geo, mat, Math.max(1, list.length));
    const mtx = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), s = new T.Vector3(1, 1, 1), p = new T.Vector3();
    list.forEach((it, i) => {
      const pp = it.p || it.position || [0, 0, 0];
      p.set(pp[0], pp[1], pp[2]);
      const rr = it.r || it.rotation || [0, 0, 0];
      e.set(rr[0] || 0, rr[1] || 0, rr[2] || 0);
      q.setFromEuler(e);
      const ss = it.s || it.scale || 1;
      if (typeof ss === 'number') s.set(ss, ss, ss); else s.set(ss[0], ss[1], ss[2]);
      mtx.compose(p, q, s);
      im.setMatrixAt(i, mtx);
      if (o.colors && it.c) im.setColorAt(i, new T.Color(it.c));
    });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    if (o.cast) im.castShadow = true;
    if (o.receive) im.receiveShadow = true;
    if (o.name) im.name = o.name;
    if (o.parent) o.parent.add(im);
    return im;
  }

  function mergeGeometries(geos) {
    const nonIndexed = geos.filter(Boolean).map(g => g.index ? g.toNonIndexed() : g);
    if (!nonIndexed.length) return new T.BufferGeometry();
    const attrs = {};
    nonIndexed.forEach(g => Object.keys(g.attributes).forEach(k => { attrs[k] = true; }));
    const out = new T.BufferGeometry();
    Object.keys(attrs).forEach(name => {
      const itemSize = nonIndexed[0].attributes[name].itemSize;
      let total = 0;
      nonIndexed.forEach(g => { if (g.attributes[name]) total += g.attributes[name].count; });
      const arr = new Float32Array(total * itemSize);
      let off = 0;
      nonIndexed.forEach(g => {
        const a = g.attributes[name];
        if (!a) return;
        arr.set(a.array, off * itemSize);
        off += a.count;
      });
      out.setAttribute(name, new T.BufferAttribute(arr, itemSize));
    });
    return out;
  }

  function shadowize(obj, cast, receive) {
    obj.traverse(o => {
      if (!o.isMesh) return;
      if (cast !== undefined) o.castShadow = !!cast;
      if (receive !== undefined) o.receiveShadow = !!receive;
    });
    return obj;
  }

  /* Decals, sprites, text marks --------------------------------------------*/
  function decal(parent, tex, o) {
    o = Object.assign({ w: 2, h: 2, x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, opacity: 1, renderOrder: 2, transparent: true }, o || {});
    const mat = new T.MeshBasicMaterial({
      map: tex, transparent: o.transparent, opacity: o.opacity, depthWrite: false,
      side: T.DoubleSide, alphaTest: o.alphaTest || .02, toneMapped: o.toneMapped !== false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
    });
    const m = mesh(new T.PlaneGeometry(o.w, o.h), mat, o);
    m.castShadow = false; m.receiveShadow = false; m.renderOrder = o.renderOrder;
    if (parent) parent.add(m);
    return m;
  }

  function sprite(tex, color, size, opacity) {
    const mat = new T.SpriteMaterial({
      map: tex, color: color === undefined ? 0xffffff : color, transparent: true,
      opacity: opacity === undefined ? 1 : opacity, depthWrite: false,
      blending: T.AdditiveBlending, toneMapped: false
    });
    const s = new T.Sprite(mat);
    s.scale.set(size, size, 1);
    return s;
  }

  function textSprite(text, o) {
    o = Object.assign({ color: '#fff', size: 64, font: CJK, weight: '500', bg: null, pad: 24 }, o || {});
    const tex = texText(text, Object.assign({ returnObject: true }, o));
    const w = o.w || tex.cv.width, h = o.h || tex.cv.height;
    const mat = new T.SpriteMaterial({ map: tex.tex, transparent: true, depthWrite: false, toneMapped: false });
    const sp = new T.Sprite(mat);
    const scale = o.scale || 1;
    sp.scale.set(w / h * scale, scale, 1);
    return sp;
  }

  /* Tiny helpers -----------------------------------------------------------*/
  function getWorld(obj) {
    const v = new T.Vector3(); obj.getWorldPosition(v); return v;
  }
  function disposeGroup(g) {
    g.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
          if (m.map) m.map.dispose(); m.dispose();
        });
      }
    });
  }
  function anchorAt(x, y, z) {
    const v = new T.Vector3(x, y, z);
    return () => v.clone();
  }
  function anchorOf(obj) {
    return () => obj.getWorldPosition(new T.Vector3());
  }

  /* Public API --------------------------------------------------------------*/
  const U = {
    PI, TAU, DEG, RAD, clamp, lerp, smooth, smoothstep, fract, easeInOut,
    rng, hash2, vnoise2, fbm2,
    gen: texCanvas, texCanvas, texText, texNoise, texRadial, texGradient, texStripe, texConcrete,
    matStandard, matMetal, matEmissive, matBasic, matGlass, defineMat, initSharedMaterials,
    MAT, MATS,
    group, mesh, boxMesh, planeMesh, cylMesh, lathe, tube, torus, ring, roundedBox,
    instanced, mergeGeometries, shadowize, decal, sprite, textSprite,
    getWorld, disposeGroup, anchorAt, anchorOf, reportError,
    CJK, SERIF
  };
  window.U = U;
  window.MAT = MAT;
  window.SPEC = SPEC;
  window.FLAGS = FLAGS;
  window.Q = Q;
  window.reportError = reportError;

  // tiny sugar used by several modules
  window.PI = PI; window.TAU = TAU; window.DEG = DEG; window.RAD = RAD;
  window.clamp = clamp; window.lerp = lerp; window.smooth = smooth;
  window.smoothstep = smoothstep; window.fract = fract; window.easeInOut = easeInOut;
})();
