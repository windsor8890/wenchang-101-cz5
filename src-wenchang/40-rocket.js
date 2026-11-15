/* ============================================================================
 * 40-rocket.js — CZ-5 (长征五号 · 遥十四 / 嫦娥七号) exterior
 * Owner: rocket.  Write scope: this file only.
 *
 * Contents: core stage 1 (tail + LH2/LOX tanks + forward skirt/interstage),
 * stage 2 shell, payload fairing (two clamshell halves, ⌀5.4 m boat-tail + ogive),
 * 4 × boosters (X layout at 45/135/225/315°, ⌀3.35 × 27.6 m),
 * 2 × YF-77 + 8 × YF-100 engine bells with ribbed cooling tubes,
 * procedural paint skins (panel seams, raceways, frost, soot, thermal bands,
 * booster checker bands) and a marking atlas (PRC flag / CHN / CASC badges /
 * 中国航天 vertical / CZ-5 / 嫦娥七号 / serials / fairing separation stripes),
 * cutaway shell clipping on APP.cutPlane with live warm-red cut edge ribbons,
 * booster ghosting in cut mode, and vertical stage separation (setExplode).
 *
 * Shell motion (matches Lead/interior/payload contract):
 *   stage 1 + engines fixed; stage 2 shell +4.0 m; fairing shell +14.0 m;
 *   boosters +2.0 m radial, +0.8 m up.  Payload / YZ-2 are owned elsewhere.
 * The plane constant is animated by 90-boot.js — this module only reads it.
 * ==========================================================================*/
(function () {
  'use strict';

  window.buildRocket = function (APP) {
    const T = window.THREE, U = window.U, SPEC = window.SPEC;
    const PI = Math.PI, TAU = PI * 2, DEG = PI / 180;
    const R = SPEC.rocket, ST = R.stations;
    const BASE = R.baseY;
    const cutPlane = APP.cutPlane;

    const CORE_R = 2.5;          // core / stage-2 diameter 5.0 m
    const FAIR_R = 2.6;          // fairing diameter 5.2 m
    const BOOST_R = 1.675;       // booster diameter 3.35 m
    const BOOST_D = R.boosterDist; // 4.15 m centre distance

    const group = U.group('rocket');
    group.position.set(0, BASE, 0);
    APP.scene.add(group);

    /* ======================================================================
     * 0. small maths helpers
     * ====================================================================*/
    const clamp = U.clamp, lerp = U.lerp, smoothstep = U.smoothstep, rng = U.rng;

    /* ======================================================================
     * 1. geometry builders
     * ====================================================================*/

    // surface of revolution.  profile: [[radius, y], ...] listed bottom → top.
    // analytic normals; u = fraction around, v = fraction of the y span.
    function revolve(profile, opts) {
      opts = opts || {};
      const seg = opts.seg || 64;
      const th0 = opts.th0 === undefined ? 0 : opts.th0;
      const thL = opts.thL === undefined ? TAU : opts.thL;
      const uStart = opts.uStart === undefined ? 0 : opts.uStart;
      const uLen = opts.uLen === undefined ? 1 : opts.uLen;
      const P = profile.length;
      const y0 = profile[0][1], y1 = profile[P - 1][1];
      const span = (y1 - y0) || 1;
      const pos = [], nor = [], uv = [];
      for (let j = 0; j < P; j++) {
        const y = profile[j][1];
        const r = Math.max(0, profile[j][0]);
        const a = profile[Math.max(0, j - 1)], b = profile[Math.min(P - 1, j + 1)];
        let dr = b[0] - a[0], dy = b[1] - a[1];
        const L = Math.hypot(dr, dy) || 1;
        const nr = dy / L, ny = -dr / L;
        const v = (y - y0) / span;
        for (let i = 0; i <= seg; i++) {
          const th = th0 + thL * (i / seg);
          const c = Math.cos(th), s = Math.sin(th);
          pos.push(r * c, y, r * s);
          nor.push(nr * c, ny, nr * s);
          uv.push(uStart + uLen * (i / seg), v);
        }
      }
      const idx = [];
      for (let j = 0; j < P - 1; j++) {
        for (let i = 0; i < seg; i++) {
          const a = j * (seg + 1) + i, b = a + 1, c = a + seg + 1, d = c + 1;
          idx.push(a, c, b, b, c, d);
        }
      }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
      g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      g.computeBoundingSphere();
      return g;
    }

    // flat annular plate with circular holes, lying in XZ at height y0 (thickness up)
    function plateWithHoles(r, thick, holes, y0) {
      const shape = new T.Shape();
      shape.absarc(0, 0, r, 0, TAU, false);
      (holes || []).forEach(h => {
        const p = new T.Path();
        p.absarc(h[0], h[1], h[2], 0, TAU, true);
        shape.holes.push(p);
      });
      const g = new T.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false, curveSegments: 40 });
      g.rotateX(-PI / 2);
      g.translate(0, y0, 0);
      return g;
    }

    // push a coloured box / cylinder / cone segment (between two points) into a merge list
    function pushBox(list, w, h, d, color, x, y, z, rx, ry, rz) {
      const g = new T.BoxGeometry(w, h, d);
      if (rx) g.rotateX(rx);
      if (ry) g.rotateY(ry);
      if (rz) g.rotateZ(rz);
      g.translate(x || 0, y || 0, z || 0);
      list.push({ geo: g, color: color });
    }
    function pushCyl(list, rt, rb, h, seg, color, x, y, z, rx, ry, rz, open) {
      const g = new T.CylinderGeometry(rt, rb, h, seg || 14, 1, !!open);
      if (rx) g.rotateX(rx);
      if (ry) g.rotateY(ry);
      if (rz) g.rotateZ(rz);
      g.translate(x || 0, y || 0, z || 0);
      list.push({ geo: g, color: color });
    }
    // cylinder whose base sits at `from`, pointing at `to`
    function pushStrut(list, color, from, to, rBase, rTip, seg) {
      const a = new T.Vector3(from[0], from[1], from[2]);
      const b = new T.Vector3(to[0], to[1], to[2]);
      const dir = b.clone().sub(a);
      const len = dir.length();
      if (len < 1e-4) return;
      const g = new T.CylinderGeometry(rTip, rBase, len, seg || 10, 1, false);
      g.translate(0, len / 2, 0);
      const q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), dir.normalize());
      const m = new T.Matrix4().compose(a, q, new T.Vector3(1, 1, 1));
      g.applyMatrix4(m);
      list.push({ geo: g, color: color });
    }
    function pushTube(list, color, pts, radius, seg, radSeg) {
      const curve = new T.CatmullRomCurve3(pts.map(p => new T.Vector3(p[0], p[1], p[2])));
      const g = new T.TubeGeometry(curve, seg || 20, radius, radSeg || 6, false);
      list.push({ geo: g, color: color });
    }

    // a ring of small bolt heads on the barrel surface
    function pushBolts(list, color, radius, y, count, boltR, boltH) {
      const rr = boltR || 0.036, hh = boltH || 0.028;
      for (let i = 0; i < count; i++) {
        const a = (i + 0.5) / count * TAU;
        pushCyl(list, rr, rr, hh, 6, color, Math.cos(a) * radius, y, Math.sin(a) * radius, PI / 2, PI / 2 - a, 0, false);
      }
    }
    // raised access door on the barrel
    function pushDoor(list, color, radius, theta, y, w, h) {
      const box = new T.BoxGeometry(w, h, 0.04);
      box.applyMatrix4(new T.Matrix4().compose(
        new T.Vector3(Math.cos(theta) * radius, y, Math.sin(theta) * radius),
        new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), -theta),
        new T.Vector3(1, 1, 1)
      ));
      list.push({ geo: box, color: color });
      // frame
      const fr = new T.BoxGeometry(w + 0.08, h + 0.08, 0.025);
      fr.applyMatrix4(new T.Matrix4().compose(
        new T.Vector3(Math.cos(theta) * (radius - 0.008), y, Math.sin(theta) * (radius - 0.008)),
        new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), -theta),
        new T.Vector3(1, 1, 1)
      ));
      list.push({ geo: fr, color: 0xb3afa2 });
    }

    // merge a list of {geo, color} into one vertex-coloured mesh
    function mergeColored(list, mat, opts) {
      if (!list.length) return null;
      const geos = [];
      for (let k = 0; k < list.length; k++) {
        const it = list[k];
        let g = it.geo.index ? it.geo.toNonIndexed() : it.geo;
        if (!g.attributes.uv) {
          g.setAttribute('uv', new T.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
        }
        const n = g.attributes.position.count;
        const col = new T.Color(it.color);
        const arr = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { arr[i * 3] = col.r; arr[i * 3 + 1] = col.g; arr[i * 3 + 2] = col.b; }
        g.setAttribute('color', new T.BufferAttribute(arr, 3));
        geos.push(g);
      }
      const merged = U.mergeGeometries(geos);
      return U.mesh(merged, mat, opts || {});
    }

    /* ---- engine bell: ribbed cooling-tube nozzle ------------------------ */
    function bellGeometry(o) {
      const rExit = o.rExit, rThroat = o.rThroat, len = o.len;
      const ribs = o.ribs || 24, ribAmp = o.ribAmp === undefined ? 0.014 : o.ribAmp;
      const NY = o.ny || 20, NT = o.nt || 64;
      const pos = [], uv = [], idx = [];
      for (let j = 0; j < NY; j++) {
        const u = j / (NY - 1);            // 0 = exit plane, 1 = throat
        const y = -len * (1 - u);
        const s = 1 - u;                   // 0 throat → 1 exit
        let r = rThroat + (rExit - rThroat) * (1 - Math.pow(1 - s, 1.9));
        r *= 1 + 0.018 * Math.pow(s, 6);   // slight exit lip flare
        // ring stiffeners along the bell (real nozzles show a few circumferential bands)
        const ribBand = 1 + 0.02 * Math.cos(u * PI * 5.5);
        for (let i = 0; i <= NT; i++) {
          const th = TAU * i / NT;
          const rr = r * ribBand * (1 + ribAmp * Math.cos(ribs * th));
          pos.push(rr * Math.cos(th), y, rr * Math.sin(th));
          uv.push(i / NT, u);
        }
      }
      for (let j = 0; j < NY - 1; j++) {
        for (let i = 0; i < NT; i++) {
          const a = j * (NT + 1) + i, b = a + 1, c = a + NT + 1, d = c + 1;
          idx.push(a, c, b, b, c, d);
        }
      }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      g.computeVertexNormals();
      g.computeBoundingSphere();
      return g;
    }

    /* ======================================================================
     * 2. procedural paint skins
     * ====================================================================*/
    const paintBase = (ctx, W, H, r, base) => {
      ctx.fillStyle = base || '#ece9df';
      ctx.fillRect(0, 0, W, H);
      const nz = U.texNoise(256, { scale: 9, oct: 4, contrast: 1.1, lo: 200, hi: 255, seed: 5 });
      ctx.save();
      ctx.globalAlpha = 0.75;
      ctx.globalCompositeOperation = 'multiply';
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(nz.image, 0, 0, W, H);
      ctx.restore();
      // broad tonal blotches — hand-painted tank skin
      for (let i = 0; i < 30; i++) {
        const x = r.range(0, W), y = r.range(0, H), rad = r.range(W * 0.04, W * 0.26);
        const a = r.range(0.008, 0.032);
        const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
        g.addColorStop(0, 'rgba(120,118,108,' + a + ')');
        g.addColorStop(1, 'rgba(120,118,108,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.fill();
      }
      // vertical drying / flow streaks
      for (let i = 0; i < 52; i++) {
        const x = r.range(0, W), w = r.range(2, 15), y0 = r.range(0, H), len = r.range(H * 0.08, H * 0.55);
        const a = r.range(0.006, 0.024);
        const gg = ctx.createLinearGradient(0, y0, 0, y0 + len);
        gg.addColorStop(0, 'rgba(255,255,250,' + (a * 1.7) + ')');
        gg.addColorStop(0.4, 'rgba(255,255,250,' + a + ')');
        gg.addColorStop(1, 'rgba(255,255,250,0)');
        ctx.fillStyle = gg; ctx.fillRect(x, y0, w, len);
      }
    };

    const seamLine = (ctx, W, ypx, alpha, width) => {
      // soft contact shadow under the seam, then the seam line itself
      const sh = ctx.createLinearGradient(0, ypx + 2, 0, ypx + 16);
      sh.addColorStop(0, 'rgba(66,64,58,' + (alpha * 0.75) + ')');
      sh.addColorStop(1, 'rgba(66,64,58,0)');
      ctx.fillStyle = sh; ctx.fillRect(0, ypx + 2, W, 14);
      ctx.strokeStyle = 'rgba(96,94,85,' + (alpha || 0.2) + ')';
      ctx.lineWidth = width || 2;
      ctx.beginPath(); ctx.moveTo(-2, ypx + 0.5); ctx.lineTo(W + 2, ypx + 0.5); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,250,' + (alpha * 1.1) + ')';
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(-2, ypx + 2.6); ctx.lineTo(W + 2, ypx + 2.6); ctx.stroke();
    };

    const vertSeams = (ctx, W, yA, yB, n, alpha) => {
      for (let i = 0; i < n; i++) {
        const x = (i + 0.5) * W / n;
        ctx.strokeStyle = 'rgba(96,94,85,' + (alpha || 0.1) + ')';
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(x, yA); ctx.lineTo(x, yB); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,250,' + ((alpha || 0.1) * 0.8) + ')';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x + 1.4, yA); ctx.lineTo(x + 1.4, yB); ctx.stroke();
      }
    };

    // dark wet-looking frost / cryo boil-off streaks running downward from yStartPx
    const frostStreaks = (ctx, W, yStartPx, r, count, hPx) => {
      for (let i = 0; i < count; i++) {
        const x = r.range(0, W);
        const len = r.range(hPx * 0.12, hPx * 0.5);
        const w = r.range(2, 12);
        const a = r.range(0.07, 0.21);
        const g = ctx.createLinearGradient(0, yStartPx, 0, yStartPx + len);
        g.addColorStop(0, 'rgba(214,226,230,' + a + ')');
        g.addColorStop(0.25, 'rgba(228,238,240,' + (a * 0.75) + ')');
        g.addColorStop(1, 'rgba(232,240,240,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x, yStartPx, w, len);
      }
    };

    const sootWash = (ctx, W, H, yTopPx, r, strength) => {
      const g = ctx.createLinearGradient(0, yTopPx - H * 0.05, 0, H);
      g.addColorStop(0, 'rgba(70,66,58,0)');
      g.addColorStop(0.45, 'rgba(74,70,62,' + (0.10 * strength) + ')');
      g.addColorStop(1, 'rgba(46,44,40,' + (0.30 * strength) + ')');
      ctx.fillStyle = g; ctx.fillRect(0, yTopPx - H * 0.05, W, H - yTopPx + H * 0.05);
      for (let i = 0; i < 40; i++) {
        const x = r.range(0, W), w = r.range(2, 10), y = r.range(yTopPx, H);
        ctx.fillStyle = 'rgba(60,56,50,' + r.range(0.02, 0.1) + ')';
        ctx.fillRect(x, y, w, r.range(H * 0.02, H * 0.12));
      }
    };

    const frostPatches = (ctx, W, r, count, hPx) => {
      for (let i = 0; i < count; i++) {
        const x = r.range(0, W), y = r.range(0, hPx * 0.9), rad = r.range(10, 46);
        const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
        g.addColorStop(0, 'rgba(226,236,238,' + r.range(.10, .22) + ')');
        g.addColorStop(.6, 'rgba(232,240,242,' + r.range(.04, .1) + ')');
        g.addColorStop(1, 'rgba(232,240,242,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.fill();
      }
    };
    const grimeStreaks = (ctx, W, H, r, count) => {
      for (let i = 0; i < count; i++) {
        const x = r.range(0, W), y0 = r.range(0, H * 0.86), len = r.range(H * 0.008, H * 0.045);
        const w = r.range(1, 4.5);
        const g = ctx.createLinearGradient(0, y0, 0, y0 + len);
        g.addColorStop(0, 'rgba(92,88,80,' + r.range(.04, .10) + ')');
        g.addColorStop(1, 'rgba(92,88,80,0)');
        ctx.fillStyle = g; ctx.fillRect(x, y0, w, len);
      }
    };
    const hatch = (ctx, x, y, w, h) => {
      ctx.fillStyle = 'rgba(88,88,80,.16)';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = 'rgba(70,70,62,.4)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
      ctx.fillStyle = 'rgba(255,255,252,.12)';
      ctx.fillRect(x + 2, y + 2, w - 4, 3);
    };

    // raised cable raceway painted on the barrel (shadowed strip + segment lines)
    const racewayPaint = (ctx, W, H, angleRad, widthPx, yA, yB, segPx) => {
      const x = ((angleRad / TAU) % 1 + 1) % 1 * W;
      const g = ctx.createLinearGradient(x - widthPx / 2, 0, x + widthPx / 2, 0);
      g.addColorStop(0, 'rgba(80,80,72,.30)');
      g.addColorStop(0.28, 'rgba(120,118,108,.16)');
      g.addColorStop(0.5, 'rgba(255,255,250,.22)');
      g.addColorStop(0.72, 'rgba(120,118,108,.16)');
      g.addColorStop(1, 'rgba(80,80,72,.30)');
      ctx.fillStyle = g;
      ctx.fillRect(x - widthPx / 2, yA, widthPx, yB - yA);
      ctx.strokeStyle = 'rgba(70,70,62,.25)';
      ctx.lineWidth = 1.5;
      for (let y = yA; y < yB; y += segPx) {
        ctx.beginPath(); ctx.moveTo(x - widthPx / 2, y); ctx.lineTo(x + widthPx / 2, y); ctx.stroke();
      }
    };

    function skinTexture(o) {
      const W = o.w, H = o.h, y0 = o.y0, y1 = o.y1;
      const ypx = (y) => (1 - (y - y0) / (y1 - y0)) * H;
      const mpx = (m) => H * m / (y1 - y0);
      const r = U.rng(o.seed || 5);
      const res = U.texCanvas(W, H, (ctx, cv) => {
        paintBase(ctx, W, H, r, o.base);
        if (o.draw) o.draw(ctx, { W, H, ypx, mpx, r });
      });
      res.tex.wrapS = T.RepeatWrapping;
      res.tex.wrapT = T.ClampToEdgeWrapping;
      return res.tex;
    }

    /* ---- procedural surface detail maps: normal (orange peel, seams, rivets)
     *      and roughness (frost, soot, sealant) — aligned with the skin UVs ---- */
    function normalFromHeight(cv, strength) {
      const w = cv.width, h = cv.height;
      const src = cv.getContext('2d').getImageData(0, 0, w, h).data;
      const out = new Uint8ClampedArray(w * h * 4);
      const at = (x, y) => {
        const yy = y < 0 ? 0 : (y >= h ? h - 1 : y);
        const xx = (x + w) % w;
        return src[(yy * w + xx) * 4];
      };
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
          const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
          const i = (y * w + x) * 4;
          out[i] = 128 + clamp(-dx * 0.35, -127, 127);
          out[i + 1] = 128 + clamp(dy * 0.35, -127, 127);
          out[i + 2] = 255;
          out[i + 3] = 255;
        }
      }
      const cv2 = document.createElement('canvas'); cv2.width = w; cv2.height = h;
      cv2.getContext('2d').putImageData(new ImageData(out, w, h), 0, 0);
      const tex = new T.CanvasTexture(cv2);
      tex.colorSpace = T.NoColorSpace;
      tex.wrapS = T.RepeatWrapping; tex.wrapT = T.ClampToEdgeWrapping;
      tex.anisotropy = 4;
      return tex;
    }

    function makeSurfaceMaps(o) {
      const W = o.w, H = o.h;
      const yPix = (y) => (1 - (y - o.y0) / (o.y1 - o.y0)) * H;
      const r = U.rng(o.seed || 5);
      /* --- height map --- */
      const hc = U.texCanvas(W, H, (ctx) => {
        ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, W, H);
        const nz = U.texNoise(256, { scale: o.peelScale || 24, oct: 3, contrast: 1.0, lo: 100, hi: 158, seed: (o.seed || 3) + 13 });
        ctx.globalAlpha = 0.9; ctx.imageSmoothingEnabled = true;
        ctx.drawImage(nz.image, 0, 0, W, H);
        ctx.globalAlpha = 1;
        // faint panel pillowing / dents
        for (let i = 0; i < 14; i++) {
          const x = r.range(0, W), y = r.range(0, H), rad = r.range(W * 0.03, W * 0.16);
          const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
          g.addColorStop(0, 'rgba(150,150,150,.14)');
          g.addColorStop(1, 'rgba(128,128,128,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.fill();
        }
        // circumferential seam grooves + rivet rows
        const lw = Math.max(2, H * 0.0026);
        (o.seams || []).forEach((y, si) => {
          const yp = yPix(y);
          ctx.strokeStyle = '#4b4b4b'; ctx.lineWidth = lw;
          ctx.beginPath(); ctx.moveTo(-2, yp); ctx.lineTo(W + 2, yp); ctx.stroke();
          ctx.strokeStyle = '#a6a6a6'; ctx.lineWidth = Math.max(1, lw * 0.45);
          ctx.beginPath(); ctx.moveTo(-2, yp + lw + 1); ctx.lineTo(W + 2, yp + lw + 1); ctx.stroke();
          if (o.bolts && (o.boltAt ? o.boltAt.indexOf(si) >= 0 : true)) {
            const n = o.bolts;
            const br = Math.max(1.1, H * 0.0011);
            for (let i = 0; i < n; i++) {
              const x = (i + 0.5) * W / n;
              ctx.fillStyle = '#b4b4b4';
              ctx.beginPath(); ctx.arc(x, yp - lw * 1.4, br, 0, TAU); ctx.fill();
              ctx.fillStyle = '#666';
              ctx.beginPath(); ctx.arc(x, yp - lw * 1.4 + br * 0.35, br * 0.7, 0, TAU); ctx.fill();
            }
          }
        });
        // longitudinal seams
        if (o.verts) {
          for (let i = 0; i < o.verts; i++) {
            const x = (i + 0.5) * W / o.verts;
            ctx.strokeStyle = 'rgba(88,88,88,.65)'; ctx.lineWidth = Math.max(1.4, W * 0.0016);
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
          }
        }
      });
      const normalMap = normalFromHeight(hc.cv, o.normalStrength === undefined ? 2.3 : o.normalStrength);
      /* --- roughness map --- */
      const rc = U.texCanvas(W, H, (ctx) => {
        ctx.fillStyle = o.baseRough || '#9c9c9c'; ctx.fillRect(0, 0, W, H);
        const nz = U.texNoise(256, { scale: 5, oct: 4, contrast: 1.15, lo: 128, hi: 196, seed: (o.seed || 3) + 7 });
        ctx.globalAlpha = 0.5; ctx.drawImage(nz.image, 0, 0, W, H); ctx.globalAlpha = 1;
        for (let i = 0; i < 46; i++) {
          const x = r.range(0, W), y0 = r.range(0, H * 0.85), len = r.range(H * 0.05, H * 0.3);
          const g = ctx.createLinearGradient(0, y0, 0, y0 + len);
          g.addColorStop(0, 'rgba(216,216,216,.30)');
          g.addColorStop(0.3, 'rgba(198,198,198,.20)');
          g.addColorStop(1, 'rgba(156,156,156,0)');
          ctx.fillStyle = g; ctx.fillRect(x, y0, r.range(3, 14), len);
        }
        if (o.sootY !== undefined) {
          const yp = yPix(o.sootY);
          const g = ctx.createLinearGradient(0, yp, 0, H);
          g.addColorStop(0, 'rgba(90,90,90,0)');
          g.addColorStop(1, 'rgba(74,74,74,.6)');
          ctx.fillStyle = g; ctx.fillRect(0, yp, W, H - yp);
        }
        (o.seams || []).forEach(y => {
          const yp = yPix(y);
          ctx.strokeStyle = 'rgba(210,210,210,.45)'; ctx.lineWidth = Math.max(2, H * 0.002);
          ctx.beginPath(); ctx.moveTo(0, yp); ctx.lineTo(W, yp); ctx.stroke();
        });
      });
      const rtex = rc.tex;
      rtex.colorSpace = T.NoColorSpace;
      rtex.wrapS = T.RepeatWrapping; rtex.wrapT = T.ClampToEdgeWrapping;
      return { normalMap: normalMap, roughnessMap: rtex };
    }

    function applySurfaceMaps(mat, maps, scale) {
      if (!maps) return mat;
      mat.normalMap = maps.normalMap;
      mat.normalScale.set(scale || 0.55, scale || 0.55);
      mat.roughnessMap = maps.roughnessMap;
      mat.roughness = 1.0;
      mat.needsUpdate = true;
      return mat;
    }

    /* ======================================================================
     * 3. marking atlas (all decals of the vehicle share one texture)
     * ====================================================================*/
    function drawStar(ctx, cx, cy, rad, rot) {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = rot + i * PI / 5;
        const rr = (i % 2 === 0) ? rad : rad * 0.382;
        const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath(); ctx.fill();
    }
    const CJK = U.CJK, SERIF = U.SERIF;

    function buildAtlas() {
      const AW = 2048, AH = 2048;
      const reg = {};
      const add = (name, x, y, w, h) => { reg[name] = { x: x, y: y, w: w, h: h }; return reg[name]; };
      const c = U.texCanvas(AW, AH, (ctx) => {
        ctx.clearRect(0, 0, AW, AH);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

        /* --- PRC flag (3:2) --- */
        add('flag', 4, 4, 504, 336);
        ctx.fillStyle = '#d92b1c';
        ctx.fillRect(4, 4, 504, 336);
        ctx.fillStyle = '#f7d94a';
        drawStar(ctx, 4 + 504 * 0.17, 4 + 336 * 0.25, 336 * 0.15, -PI / 2);
        const smalls = [[0.34, 0.10], [0.41, 0.21], [0.41, 0.36], [0.34, 0.47]];
        smalls.forEach(s => {
          const cx = 4 + 504 * s[0], cy = 4 + 336 * s[1];
          const rot = Math.atan2((4 + 336 * 0.25) - cy, (4 + 504 * 0.17) - cx);
          drawStar(ctx, cx, cy, 336 * 0.05, rot);
        });

        /* --- CHN under the flag --- */
        add('chn', 540, 30, 300, 120);
        ctx.fillStyle = '#22272a';
        ctx.font = '700 104px Arial, ' + CJK;
        ctx.fillText('CHN', 690, 96);

        /* --- CASC roundel --- */
        add('casc', 4, 380, 420, 420);
        (() => {
          const cx = 4 + 210, cy = 380 + 200, Rr = 178;
          ctx.beginPath(); ctx.arc(cx, cy, Rr, 0, TAU); ctx.fillStyle = '#173f7c'; ctx.fill();
          ctx.beginPath(); ctx.arc(cx, cy, Rr * 0.87, 0, TAU); ctx.fillStyle = '#f2efe4'; ctx.fill();
          ctx.fillStyle = '#173f7c';
          ctx.beginPath();
          ctx.moveTo(cx - Rr * 0.42, cy + Rr * 0.44);
          ctx.quadraticCurveTo(cx - Rr * 0.05, cy - Rr * 0.58, cx + Rr * 0.52, cy - Rr * 0.28);
          ctx.quadraticCurveTo(cx + Rr * 0.12, cy + Rr * 0.02, cx + Rr * 0.28, cy + Rr * 0.5);
          ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#c9302c';
          drawStar(ctx, cx - Rr * 0.52, cy - Rr * 0.5, Rr * 0.17, 0);
          ctx.fillStyle = '#173f7c';
          ctx.font = '700 40px Arial, ' + CJK;
          ctx.fillText('CASC', cx, cy + Rr * 0.72);
        })();

        /* --- CASC wedge logo (blue/white triangular mark) --- */
        add('cascTri', 444, 400, 360, 250);
        (() => {
          const x = 444, y = 400, w = 360, h = 250;
          ctx.fillStyle = '#f2efe4'; ctx.fillRect(x, y, w, h);
          ctx.fillStyle = '#1d4b8f';
          ctx.beginPath();
          ctx.moveTo(x + 26, y + h - 40);
          ctx.lineTo(x + w - 26, y + 42);
          ctx.lineTo(x + w - 26, y + h - 40);
          ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#f2efe4';
          ctx.beginPath();
          ctx.moveTo(x + 92, y + h - 40);
          ctx.lineTo(x + w - 132, y + 88);
          ctx.lineTo(x + w - 132, y + 128);
          ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#1d4b8f';
          ctx.font = '700 52px Arial, ' + CJK;
          ctx.fillText('CASC', x + 118, y + 196);
        })();

        /* --- 中国航天 vertical (dark blue, as on the real CZ-5 stage 2) --- */
        add('chinaSpace', 4, 840, 250, 1100);
        (() => {
          const chars = '中国航天';
          ctx.fillStyle = '#22406e';
          ctx.font = '700 208px ' + CJK;
          const gap = 244;
          const y0 = 840 + (1100 - 3 * gap) / 2 + 10;
          for (let i = 0; i < chars.length; i++) ctx.fillText(chars[i], 4 + 125, y0 + i * gap);
        })();

        /* --- CZ-5 marking --- */
        add('cz5', 444, 700, 460, 200);
        ctx.fillStyle = '#22303a';
        ctx.font = '800 168px Arial, ' + CJK;
        ctx.fillText('CZ-5', 444 + 230, 700 + 106);

        /* --- serial / mission tail number --- */
        add('serial', 444, 940, 420, 160);
        ctx.fillStyle = '#3a4044';
        ctx.font = '700 96px Arial, ' + CJK;
        ctx.fillText('Y14', 444 + 210, 940 + 58);
        ctx.font = '600 62px ' + CJK;
        ctx.fillText('遥十四', 444 + 210, 940 + 126);

        /* --- 嫦娥七号 mission name --- */
        add('mission', 444, 1140, 620, 300);
        ctx.fillStyle = '#232a2e';
        ctx.font = '700 130px ' + SERIF;
        ctx.fillText('嫦娥七号', 444 + 310, 1140 + 88);
        ctx.fillStyle = '#33404a';
        ctx.font = '600 58px Arial, ' + CJK;
        ctx.fillText("CHANG'E-7", 444 + 310, 1140 + 208);

        /* --- red mission roundel --- */
        add('roundel', 1100, 400, 330, 330);
        (() => {
          const cx = 1100 + 165, cy = 400 + 165, Rr = 150;
          ctx.beginPath(); ctx.arc(cx, cy, Rr, 0, TAU); ctx.fillStyle = '#b5322a'; ctx.fill();
          ctx.beginPath(); ctx.arc(cx, cy, Rr * 0.82, 0, TAU); ctx.strokeStyle = 'rgba(255,248,235,.92)'; ctx.lineWidth = 8; ctx.stroke();
          ctx.fillStyle = '#f5efe2';
          ctx.beginPath();
          ctx.arc(cx - 8, cy - 6, Rr * 0.5, PI * 0.18, PI * 1.5, false);
          ctx.arc(cx + 28, cy - 6, Rr * 0.5, PI * 1.5, PI * 0.18, true);
          ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#f5efe2';
          drawStar(ctx, cx + 54, cy + 48, Rr * 0.16, 0);
          ctx.font = '700 34px Arial, ' + CJK;
          ctx.fillStyle = '#f5efe2';
          ctx.fillText('CE-7', cx, cy + Rr * 0.92);
        })();

        /* --- fairing separation stripe (red / white ordnance cover dashes) --- */
        add('sepStripe', 1500, 380, 120, 1600);
        (() => {
          const x = 1500, y = 380, w = 120, h = 1600;
          ctx.fillStyle = '#f2efe4'; ctx.fillRect(x, y, w, h);
          for (let yy = y; yy < y + h; yy += 96) {
            ctx.fillStyle = '#b5322a';
            ctx.fillRect(x + 8, yy + 8, w - 16, 40);
          }
          ctx.strokeStyle = 'rgba(120,40,30,.55)'; ctx.lineWidth = 4;
          ctx.strokeRect(x + 4, y + 4, w - 8, h - 8);
        })();

        /* --- hazard chevron band (engine section) --- */
        add('hazard', 1500, 140, 512, 96);
        (() => {
          const x = 1500, y = 140, w = 512, h = 96;
          ctx.fillStyle = '#e7e0cf'; ctx.fillRect(x, y, w, h);
          ctx.save();
          ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
          ctx.fillStyle = '#a83226';
          for (let i = -1; i < 16; i++) {
            ctx.beginPath();
            ctx.moveTo(x + i * 48, y + h);
            ctx.lineTo(x + i * 48 + 30, y + h);
            ctx.lineTo(x + i * 48 + 30 + h, y);
            ctx.lineTo(x + i * 48 + h, y);
            ctx.closePath(); ctx.fill();
          }
          ctx.restore();
        })();
      });
      c.tex.wrapS = T.ClampToEdgeWrapping;
      c.tex.wrapT = T.ClampToEdgeWrapping;
      return { tex: c.tex, reg: reg, W: AW, H: AH };
    }

    /* ======================================================================
     * 4. materials
     * ====================================================================*/
    const atlas = buildAtlas();

    // seam / station rings reused by both the paint skin and the detail maps
    const SEAMS_CORE = [3.9, 6.3, 8.7, 11.2, 13.6, 16.2, 19.3, 21.9, 24.6, 27.2, 29.4, 31.3];
    const SEAMS_S2 = [34.4, 35.6, 37.4, 39.4, 41.2, 43.4];
    const SEAMS_FAIR = [45.35, 49.05, 52.85];
    const SEAMS_BOOST = [4.6, 9.0, 13.6, 18.2, 22.8, 24.4];

    const mapsCore = makeSurfaceMaps({
      w: 512, h: 1024, y0: 2.6, y1: 33.16, seams: SEAMS_CORE, verts: 16,
      bolts: 46, boltAt: [0, 3, 6, 8, 11], seed: 111, peelScale: 24, normalStrength: 3.4,
      sootY: 5.6, baseRough: '#9e9e9e'
    });
    const mapsS2 = makeSurfaceMaps({
      w: 512, h: 512, y0: 33.16, y1: 44.7, seams: SEAMS_S2, verts: 14,
      bolts: 46, boltAt: [0, 2, 5], seed: 231, peelScale: 24, normalStrength: 3.1,
      frost: true, baseRough: '#9a9a9a'
    });
    const mapsFair = makeSurfaceMaps({
      w: 512, h: 512, y0: 44.7, y1: 56.97, seams: SEAMS_FAIR, verts: 16,
      bolts: 48, boltAt: [0, 1], seed: 337, peelScale: 26, normalStrength: 2.9,
      frost: true, baseRough: '#a0a0a0'
    });
    const mapsBoost = makeSurfaceMaps({
      w: 256, h: 512, y0: 1.6, y1: 29.2, seams: SEAMS_BOOST, verts: 8,
      bolts: 30, boltAt: [0, 5], seed: 553, peelScale: 26, normalStrength: 3.1,
      sootY: 5.4, baseRough: '#9e9e9e'
    });

    const matSkinCore = new T.MeshPhysicalMaterial({
      clearcoat: 0.07, clearcoatRoughness: 0.72,
      map: skinTexture({
        w: 1024, h: 2048, y0: 2.6, y1: 33.16, seed: 11, base: '#e7e3d6',
        draw: (ctx, m) => {
          const r = m.r;
          // panel seams at real station boundaries
          SEAMS_CORE.forEach(y => seamLine(ctx, m.W, m.ypx(y), 0.30));
          vertSeams(ctx, m.W, m.ypx(4.4), m.ypx(33.1), 16, 0.10);
          // dark thermal band at the base + grey separation band at the top
          ctx.fillStyle = 'rgba(74,78,78,.86)';
          ctx.fillRect(0, m.ypx(3.15), m.W, m.mpx(0.55));
          ctx.fillStyle = 'rgba(196,192,180,.9)';
          ctx.fillRect(0, m.ypx(33.16), m.W, m.mpx(0.30));
          ctx.fillStyle = 'rgba(150,146,134,.55)';
          ctx.fillRect(0, m.ypx(32.9), m.W, m.mpx(0.12));
          // raceway shadows (raised geometry sits on two of them)
          racewayPaint(ctx, m.W, m.H, 79 * DEG, 26, m.ypx(33.0), m.ypx(4.4), m.mpx(1.35));
          racewayPaint(ctx, m.W, m.H, 193 * DEG, 22, m.ypx(33.0), m.ypx(4.4), m.mpx(1.35));
          racewayPaint(ctx, m.W, m.H, 300 * DEG, 16, m.ypx(32.9), m.ypx(4.6), m.mpx(1.4));
          // frost / boil-off around the LH2 tank top and LOX tank top
          frostStreaks(ctx, m.W, m.ypx(16.1), r, 34, m.H);
          frostStreaks(ctx, m.W, m.ypx(28.9), r, 22, m.H * 0.6);
          frostStreaks(ctx, m.W, m.ypx(6.4), r, 14, m.H * 0.45);
          // access hatches
          for (let i = 0; i < 6; i++) {
            hatch(ctx, r.range(0, m.W - 40), r.range(m.ypx(29) , m.ypx(9)), r.range(22, 44), r.range(30, 56));
          }
          // panel tone variation
          for (let i = 0; i < 10; i++) {
            ctx.fillStyle = 'rgba(' + (r.chance(.5) ? '255,255,250' : '130,128,118') + ',' + r.range(.015, .04) + ')';
            ctx.fillRect(r.range(0, m.W), r.range(0, m.H), r.range(60, 200), r.range(60, 320));
          }
          frostPatches(ctx, m.W, r, 9, m.H);
          // engine-bay soot + service grime
          sootWash(ctx, m.W, m.H, m.ypx(5.6), r, 1.0);
          grimeStreaks(ctx, m.W, m.H, r, 26);
        }
      }),
      roughness: 0.47, metalness: 0.035, envMapIntensity: 0.65,
      side: T.DoubleSide, clippingPlanes: cutPlane ? [cutPlane] : null, clipShadows: true
    });

    const matSkinStage2 = new T.MeshPhysicalMaterial({
      clearcoat: 0.06, clearcoatRoughness: 0.72,
      map: skinTexture({
        w: 1024, h: 1024, y0: 33.16, y1: 44.7, seed: 23, base: '#e9e5d9',
        draw: (ctx, m) => {
          const r = m.r;
          SEAMS_S2.forEach(y => seamLine(ctx, m.W, m.ypx(y), 0.28));
          vertSeams(ctx, m.W, m.ypx(33.2), m.ypx(44.6), 14, 0.09);
          ctx.fillStyle = 'rgba(186,182,170,.85)';
          ctx.fillRect(0, m.ypx(33.7), m.W, m.mpx(0.5));
          ctx.fillStyle = 'rgba(120,122,118,.7)';
          ctx.fillRect(0, m.ypx(33.35), m.W, m.mpx(0.16));
          racewayPaint(ctx, m.W, m.H, 103 * DEG, 22, m.ypx(44.5), m.ypx(33.6), m.mpx(1.3));
          racewayPaint(ctx, m.W, m.H, 230 * DEG, 14, m.ypx(44.4), m.ypx(33.7), m.mpx(1.3));
          frostStreaks(ctx, m.W, m.ypx(44.1), r, 22, m.H * 0.55);
          for (let i = 0; i < 3; i++) hatch(ctx, r.range(0, m.W - 40), r.range(m.ypx(43), m.ypx(35)), r.range(20, 40), r.range(22, 40));
          for (let i = 0; i < 6; i++) {
            ctx.fillStyle = 'rgba(' + (r.chance(.5) ? '255,255,250' : '128,126,116') + ',' + r.range(.015, .035) + ')';
            ctx.fillRect(r.range(0, m.W), r.range(0, m.H), r.range(60, 200), r.range(40, 140));
          }
        }
      }),
      roughness: 0.46, metalness: 0.035, envMapIntensity: 0.65,
      side: T.DoubleSide, clippingPlanes: cutPlane ? [cutPlane] : null, clipShadows: true
    });

    const matSkinFairing = new T.MeshPhysicalMaterial({
      clearcoat: 0.08, clearcoatRoughness: 0.7,
      map: skinTexture({
        w: 1024, h: 1024, y0: 44.7, y1: 56.97, seed: 37, base: '#ece8dc',
        draw: (ctx, m) => {
          const r = m.r;
          seamLine(ctx, m.W, m.ypx(52.85), 0.30, 3);
          seamLine(ctx, m.W, m.ypx(45.35), 0.26);
          seamLine(ctx, m.W, m.ypx(49.05), 0.17, 1.5);
          vertSeams(ctx, m.W, m.ypx(45.3), m.ypx(52.8), 16, 0.085);
          // panel seams continue up the ogive (tapering with the nose)
          for (let i = 0; i < 8; i++) {
            const x = (i + 0.5) * m.W / 8;
            const g2 = ctx.createLinearGradient(0, m.ypx(52.85), 0, m.ypx(55.2));
            g2.addColorStop(0, 'rgba(96,94,85,.11)');
            g2.addColorStop(1, 'rgba(96,94,85,0)');
            ctx.strokeStyle = g2; ctx.lineWidth = 1.6;
            ctx.beginPath(); ctx.moveTo(x, m.ypx(52.85)); ctx.lineTo(x, m.ypx(55.2)); ctx.stroke();
          }
          ctx.fillStyle = 'rgba(196,192,180,.8)';
          ctx.fillRect(0, m.ypx(44.95), m.W, m.mpx(0.26));
          ctx.fillStyle = 'rgba(104,104,100,.35)';
          ctx.fillRect(0, m.ypx(44.78), m.W, m.mpx(0.1));
          frostStreaks(ctx, m.W, m.ypx(44.9), r, 10, m.H * 0.25);
          for (let i = 0; i < 5; i++) {
            ctx.fillStyle = 'rgba(' + (r.chance(.5) ? '255,255,250' : '140,138,128') + ',' + r.range(.012, .03) + ')';
            ctx.fillRect(r.range(0, m.W), r.range(0, m.ypx(52.8)), r.range(70, 220), r.range(40, 180));
          }
          frostPatches(ctx, m.W, r, 4, m.H);
          for (let i = 0; i < 2; i++) hatch(ctx, r.range(0, m.W - 40), r.range(m.ypx(51.5), m.ypx(47)), r.range(20, 36), r.range(24, 40));
          grimeStreaks(ctx, m.W, m.H, r, 10);
          // ogive gets a very faint radial sheen towards the tip
          const g = ctx.createLinearGradient(0, 0, 0, m.ypx(52.85));
          g.addColorStop(0, 'rgba(255,255,250,.10)');
          g.addColorStop(1, 'rgba(255,255,250,0)');
          ctx.fillStyle = g; ctx.fillRect(0, 0, m.W, m.ypx(52.85));
        }
      }),
      roughness: 0.44, metalness: 0.03, envMapIntensity: 0.7,
      side: T.DoubleSide, clippingPlanes: cutPlane ? [cutPlane] : null, clipShadows: true
    });

    const matSkinBooster = new T.MeshPhysicalMaterial({
      clearcoat: 0.06, clearcoatRoughness: 0.75,
      map: skinTexture({
        w: 512, h: 1024, y0: 1.6, y1: 29.2, seed: 53, base: '#e9e5d8',
        draw: (ctx, m) => {
          const r = m.r;
          SEAMS_BOOST.forEach(y => seamLine(ctx, m.W, m.ypx(y), 0.28));
          vertSeams(ctx, m.W, m.ypx(2.2), m.ypx(29.1), 8, 0.10);
          racewayPaint(ctx, m.W, m.H, 140 * DEG, 16, m.ypx(29.0), m.ypx(2.2), m.mpx(1.5));
          racewayPaint(ctx, m.W, m.H, 305 * DEG, 14, m.ypx(28.8), m.ypx(2.3), m.mpx(1.5));
          // red/white roll-reference checker band on the nose cone base (CZ-5 signature)
          const yA = m.ypx(25.45), yB = m.ypx(26.95);
          const rows = 3, cols = 26, ch = (yB - yA) / rows, cw = m.W / cols;
          for (let ry = 0; ry < rows; ry++) {
            for (let cx = 0; cx < cols; cx++) {
              ctx.fillStyle = ((ry + cx) % 2 === 0) ? '#ab3227' : '#f2efe6';
              ctx.fillRect(cx * cw, yA + ry * ch, cw + 0.6, ch + 0.6);
            }
          }
          // red/white checker roll band at the aft skirt (as on the real booster)
          const yC = m.ypx(3.28), yD = m.ypx(4.28);
          const crows = 2, ccols = 26, cch = (yD - yC) / crows, ccw = m.W / ccols;
          for (let ry = 0; ry < crows; ry++) {
            for (let cx = 0; cx < ccols; cx++) {
              ctx.fillStyle = ((ry + cx) % 2 === 0) ? '#ab3227' : '#f2efe6';
              ctx.fillRect(cx * ccw, yC + ry * cch, ccw + 0.6, cch + 0.6);
            }
          }
          ctx.fillStyle = 'rgba(78,82,82,.8)';
          ctx.fillRect(0, m.ypx(2.35), m.W, m.mpx(0.5));
          frostStreaks(ctx, m.W, m.ypx(20.2), r, 16, m.H * 0.35);
          frostStreaks(ctx, m.W, m.ypx(12.4), r, 10, m.H * 0.3);
          sootWash(ctx, m.W, m.H, m.ypx(5.4), r, 1.0);
          grimeStreaks(ctx, m.W, m.H, r, 14);
          for (let i = 0; i < 4; i++) hatch(ctx, r.range(0, m.W - 30), r.range(m.ypx(24), m.ypx(6)), r.range(16, 30), r.range(20, 36));
        }
      }),
      roughness: 0.47, metalness: 0.035, envMapIntensity: 0.65,
      side: T.DoubleSide, transparent: true, opacity: 1, depthWrite: true
    });

    // detail maps give the paint a real, non-plastic surface response
    applySurfaceMaps(matSkinCore, mapsCore, 1.15);
    applySurfaceMaps(matSkinStage2, mapsS2, 1.05);
    applySurfaceMaps(matSkinFairing, mapsFair, 1.0);
    applySurfaceMaps(matSkinBooster, mapsBoost, 1.15);
    [matSkinCore, matSkinStage2, matSkinFairing, matSkinBooster].forEach(m => {
      m.metalness = 0.025;
      m.envMapIntensity = 0.38;
      m.needsUpdate = true;
    });

    const matHWClip = new T.MeshStandardMaterial({
      vertexColors: true, roughness: 0.43, metalness: 0.5, envMapIntensity: 0.95,
      side: T.DoubleSide, clippingPlanes: cutPlane ? [cutPlane] : null, clipShadows: true
    });
    const matHW = new T.MeshStandardMaterial({
      vertexColors: true, roughness: 0.42, metalness: 0.52, envMapIntensity: 0.95, side: T.DoubleSide
    });
    const matHWBoost = new T.MeshStandardMaterial({
      vertexColors: true, roughness: 0.42, metalness: 0.5, envMapIntensity: 0.9, side: T.DoubleSide,
      transparent: true, opacity: 1, depthWrite: true
    });
    // nozzle surface: graphite metal with vertical brush streaks and heat tint near the exit
    const bellSkinTex = U.texCanvas(256, 256, (ctx, cv) => {
      const rb = U.rng(97);
      ctx.fillStyle = '#3f4140'; ctx.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 140; i++) {
        const x = rb.range(0, 256), w = rb.range(1, 5);
        ctx.fillStyle = 'rgba(' + (rb.chance(.5) ? '210,214,212' : '24,26,26') + ',' + rb.range(.02, .10) + ')';
        ctx.fillRect(x, 0, w, 256);
      }
      // circumferential rib band shading
      for (let y = 0; y < 256; y += 26) {
        ctx.fillStyle = 'rgba(16,18,18,.28)'; ctx.fillRect(0, y, 256, 3);
        ctx.fillStyle = 'rgba(220,224,222,.10)'; ctx.fillRect(0, y + 3, 256, 2);
      }
      // heat tint + soot at the exit (canvas bottom = bell exit)
      const g = ctx.createLinearGradient(0, 150, 0, 256);
      g.addColorStop(0, 'rgba(58,52,46,0)');
      g.addColorStop(0.45, 'rgba(96,72,48,.30)');
      g.addColorStop(0.72, 'rgba(70,66,86,.34)');
      g.addColorStop(1, 'rgba(24,24,26,.62)');
      ctx.fillStyle = g; ctx.fillRect(0, 150, 256, 106);
      for (let i = 0; i < 24; i++) {
        const x = rb.range(0, 256), len = rb.range(20, 76);
        const gg = ctx.createLinearGradient(0, 256 - len, 0, 256);
        gg.addColorStop(0, 'rgba(20,20,20,0)');
        gg.addColorStop(1, 'rgba(18,18,18,' + rb.range(.2, .5) + ')');
        ctx.fillStyle = gg; ctx.fillRect(x, 256 - len, rb.range(2, 9), len);
      }
    }, { srgb: true });
    bellSkinTex.tex.wrapS = T.RepeatWrapping; bellSkinTex.tex.wrapT = T.ClampToEdgeWrapping;
    const matBell = new T.MeshStandardMaterial({
      map: bellSkinTex.tex, color: 0xffffff, roughness: 0.4, metalness: 0.78, envMapIntensity: 1.15, side: T.DoubleSide
    });
    const matBellBoost = new T.MeshStandardMaterial({
      map: bellSkinTex.tex, color: 0xf4f2ee, roughness: 0.42, metalness: 0.76, envMapIntensity: 1.1, side: T.DoubleSide,
      transparent: true, opacity: 1, depthWrite: true
    });
    // duller cast/plumbing metal, used for secondary engine hardware (varied metal response)
    const matHWDull = new T.MeshStandardMaterial({
      vertexColors: true, roughness: 0.62, metalness: 0.3, envMapIntensity: 0.85, side: T.DoubleSide
    });
    const matHWDullBoost = new T.MeshStandardMaterial({
      vertexColors: true, roughness: 0.62, metalness: 0.3, envMapIntensity: 0.85, side: T.DoubleSide,
      transparent: true, opacity: 1, depthWrite: true
    });
    const matDecal = new T.MeshStandardMaterial({
      map: atlas.tex, transparent: true, opacity: 1, depthWrite: false,
      roughness: 0.5, metalness: 0.04, side: T.DoubleSide, alphaTest: 0.02,
      polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -4,
      clippingPlanes: cutPlane ? [cutPlane] : null
    });
    const matDecalBoost = new T.MeshStandardMaterial({
      map: atlas.tex, transparent: true, opacity: 1, depthWrite: false,
      roughness: 0.5, metalness: 0.04, side: T.DoubleSide, alphaTest: 0.02,
      polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -4
    });
    const matEdge = new T.MeshStandardMaterial({
      color: 0xb03a22, roughness: 0.5, metalness: 0.2,
      emissive: 0x641a08, emissiveIntensity: 1.15, side: T.DoubleSide,
      transparent: true, opacity: 0, depthWrite: false
    });

    /* ======================================================================
     * 5. decal geometry helper (curved onto the barrel, atlas UVs)
     * ====================================================================*/
    function decalGeo(name, r, thetaC, y0, y1, widthM, segs) {
      const rg = atlas.reg[name];
      if (!rg) return null;
      const u0 = rg.x / atlas.W, u1 = (rg.x + rg.w) / atlas.W;
      const v0 = 1 - (rg.y + rg.h) / atlas.H, v1 = 1 - rg.y / atlas.H;
      const arc = widthM / r;
      const seg = segs || 10;
      const pos = [], uv = [], idx = [];
      for (let j = 0; j < 2; j++) {
        const y = j === 0 ? y0 : y1;
        for (let i = 0; i <= seg; i++) {
          const u = i / seg;
          const th = thetaC + arc / 2 - arc * u;
          pos.push(r * Math.cos(th), y, r * Math.sin(th));
          uv.push(u0 + u * (u1 - u0), v0 + j * (v1 - v0));
        }
      }
      for (let i = 0; i < seg; i++) {
        const a = i, b = i + 1, c = i + seg + 1, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      g.computeVertexNormals();
      g.computeBoundingSphere();
      return g;
    }

    // collect decals into a merge list, then build one mesh with the decal material
    function decalMesh(list, mat, parent, ro) {
      if (!list.length) return null;
      const merged = U.mergeGeometries(list);
      const m = U.mesh(merged, mat, { renderOrder: ro === undefined ? 3 : ro });
      m.castShadow = false; m.receiveShadow = false;
      if (parent) parent.add(m);
      return m;
    }
    const decal = (list, name, opts) => {
      const g = decalGeo(name, opts.r, opts.theta, opts.y0, opts.y1, opts.w, opts.seg);
      if (g) list.push(g);
      return g;
    };

    /* ======================================================================
     * 6. live cut-edge ribbons (follow APP.cutPlane.constant)
     * ====================================================================*/
    const cutEdges = [];
    function buildCutEdge(prof, y0, y1, side, parent) {
      // side: 0 full shell, +1 x>0 half (fairing A), -1 x<0 half (fairing B)
      const N = 30;
      const geo = new T.BufferGeometry();
      const pos = new Float32Array(N * 4 * 3);
      const nor = new Float32Array(N * 4 * 3);
      const uv = new Float32Array(N * 4 * 2);
      const idx = [];
      for (let j = 0; j < N - 1; j++) {
        const a = j * 4;
        idx.push(a, a + 4, a + 1, a + 1, a + 4, a + 5);          // +z strip
        idx.push(a + 2, a + 3, a + 6, a + 3, a + 7, a + 6);      // -z strip
      }
      geo.setIndex(idx);
      geo.setAttribute('position', new T.BufferAttribute(pos, 3));
      geo.setAttribute('normal', new T.BufferAttribute(nor, 3));
      geo.setAttribute('uv', new T.BufferAttribute(uv, 2));
      const mesh = new T.Mesh(geo, matEdge);
      mesh.frustumCulled = false;
      mesh.renderOrder = 4;
      mesh.castShadow = false; mesh.receiveShadow = false;
      parent.add(mesh);
      const e = { geo: geo, prof: prof, y0: y0, y1: y1, side: side, N: N };
      cutEdges.push(e);
      return e;
    }
    const ZERO4 = [0, 0, 0, 0];
    function updateCutEdges(c) {
      for (let k = 0; k < cutEdges.length; k++) {
        const e = cutEdges[k];
        const pos = e.geo.attributes.position.array;
        const nor = e.geo.attributes.normal.array;
        for (let j = 0; j < e.N; j++) {
          const y = e.y0 + (e.y1 - e.y0) * (j / (e.N - 1));
          const r = Math.max(0.05, e.prof(y));
          let valid = (c > -r && c < r);
          if (e.side > 0) valid = (c > 0 && c < r);
          else if (e.side < 0) valid = (c < 0 && c > -r);
          let z = 0;
          if (valid) { const d = r * r - c * c; z = d > 1e-4 ? Math.sqrt(d) : 0; }
          const dw = 0.15 / r;
          const th = valid ? Math.atan2(z, c) : PI / 2;
          const a1 = th, a2 = th + dw;
          const b1 = -th, b2 = -th - dw;
          const base = j * 12;
          if (valid) {
            setV(pos, nor, base, r, y, a1);
            setV(pos, nor, base + 3, r, y, a2);
            setV(pos, nor, base + 6, r, y, b1);
            setV(pos, nor, base + 9, r, y, b2);
          } else {
            for (let q = 0; q < 4; q++) {
              pos[base + q * 3] = c; pos[base + q * 3 + 1] = y; pos[base + q * 3 + 2] = 0;
              nor[base + q * 3] = 1; nor[base + q * 3 + 1] = 0; nor[base + q * 3 + 2] = 0;
            }
          }
        }
        e.geo.attributes.position.needsUpdate = true;
        e.geo.attributes.normal.needsUpdate = true;
      }
    }
    function setV(pos, nor, base, r, y, a) {
      const ca = Math.cos(a), sa = Math.sin(a);
      pos[base] = r * ca; pos[base + 1] = y; pos[base + 2] = r * sa;
      nor[base] = ca; nor[base + 1] = 0; nor[base + 2] = sa;
    }

    /* ======================================================================
     * 7. STAGE 1 — core stage, tail, engine bay, 2 × YF-77
     * ====================================================================*/
    const stage1 = U.group('cz5-stage1');
    group.add(stage1);

    // outer shell: tail skirt (2.6) → LH2 → common bulkhead → LOX → forward skirt → 33.16
    const coreProfile = [
      [CORE_R, 2.6], [CORE_R, 4.4], [CORE_R, 16.2], [CORE_R, 17.0],
      [CORE_R, 29.4], [CORE_R, 32.7], [CORE_R, 33.16]
    ];
    const coreSkin = U.mesh(revolve(coreProfile, { seg: 80 }), matSkinCore, { name: 'core-skin' });
    coreSkin.castShadow = true; coreSkin.receiveShadow = true;
    stage1.add(coreSkin);

    const s1hw = [];
    // raised ring bands
    const ringBand = (r, y, h, t, color) => {
      const prof = [[r, y - h / 2], [r + t, y - h / 2 + t * 1.4], [r + t, y + h / 2 - t * 1.4], [r, y + h / 2]];
      s1hw.push({ geo: revolve(prof, { seg: 80 }), color: color });
    };
    ringBand(CORE_R, 4.4, 0.18, 0.045, 0xd8d4c8);
    ringBand(CORE_R, 16.6, 0.16, 0.04, 0xd8d4c8);
    ringBand(CORE_R, 29.4, 0.2, 0.05, 0xd0ccc0);
    ringBand(CORE_R, 32.85, 0.26, 0.06, 0xb9bcb9);
    ringBand(CORE_R, 2.78, 0.22, 0.05, 0x8f9492);
    // aft separation ring at 33.16 (stage1 / stage2 interface)
    s1hw.push({ geo: plateWithHoles(CORE_R + 0.02, 0.1, [[0, 0, CORE_R - 0.18]], 33.12), color: 0x9ba0a0 });
      // raceways (raised conduits) + brackets
    [79, 193].forEach((deg) => {
      const th = deg * DEG;
      const rad = CORE_R + 0.028;
      const len = 33.0 - 4.4;
      const box = new T.BoxGeometry(0.26, len, 0.085);
      box.applyMatrix4(new T.Matrix4().compose(
        new T.Vector3(Math.cos(th) * rad, 4.4 + len / 2, Math.sin(th) * rad),
        new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), -th),
        new T.Vector3(1, 1, 1)
      ));
      s1hw.push({ geo: box, color: 0xc9c5b8 });
      // brackets
      for (let y = 5.2; y < 32.8; y += 1.45) {
        pushBox(s1hw, 0.34, 0.07, 0.12, 0xa9a596,
          Math.cos(th) * (rad + 0.03), y, Math.sin(th) * (rad + 0.03), 0, -th, 0);
      }
    });
    // umbilical plates on the tower side (-x), two levels
    [[24.6, 1.5], [30.2, 1.2]].forEach((lv, i) => {
      const th = PI + (i ? 0.16 : -0.1);
      const g = plateWithHoles(0.62, 0.2, [], 0);
      g.rotateZ(0);
      const box = new T.BoxGeometry(1.5 * (i ? 0.8 : 1), 2.4 * (i ? 0.7 : 1), 0.22);
      box.applyMatrix4(new T.Matrix4().compose(
        new T.Vector3(Math.cos(th) * (CORE_R + 0.08), lv[0], Math.sin(th) * (CORE_R + 0.08)),
        new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), -th),
        new T.Vector3(1, 1, 1)
      ));
      s1hw.push({ geo: box, color: 0xdad6ca });
      // connector blocks
      for (let k = -1; k <= 1; k++) {
        pushBox(s1hw, 0.3, 0.3, 0.34, 0x707673,
          Math.cos(th) * (CORE_R + 0.2) + Math.cos(th + PI / 2) * k * 0.42,
          lv[0] + k * 0.55,
          Math.sin(th) * (CORE_R + 0.2) + Math.sin(th + PI / 2) * k * 0.42, 0, -th, 0);
      }
    });
    // small vents / port covers around the tank tops
    for (let k = 0; k < 10; k++) {
      const th = (k * 137.5 % 360) * DEG, y = 16.0 + (k % 3) * 0.35;
      pushBox(s1hw, 0.22, 0.16, 0.07, 0x7d827f, Math.cos(th) * (CORE_R + 0.02), y, Math.sin(th) * (CORE_R + 0.02), 0, -th, 0);
    }
    // retro / separation pusher covers at the top ring
    for (let k = 0; k < 12; k++) {
      const th = (k / 12) * TAU;
      pushBox(s1hw, 0.18, 0.2, 0.12, 0x9ca19e,
        Math.cos(th) * (CORE_R + 0.03), 32.86, Math.sin(th) * (CORE_R + 0.03), 0, -th, 0);
    }
    // cable harnesses running the length of the core stage (thin, black, with clamps)
    [126, 133, 260].forEach((deg, ci) => {
      const th = deg * DEG;
      const rad = CORE_R + 0.035 + ci * 0.012;
      const pts = [];
      for (let y = 4.8; y <= 32.6; y += 2.3) {
        const wob = Math.sin(y * 0.7 + ci * 1.7) * 0.02;
        pts.push([Math.cos(th) * (rad + wob), y, Math.sin(th) * (rad + wob)]);
      }
      pushTube(s1hw, ci === 2 ? 0x23262a : 0x30332f, pts, 0.028 + ci * 0.006, 26, 5);
      for (let y = 5.4; y < 32.4; y += 2.3) {
        pushBox(s1hw, 0.09, 0.045, 0.06, 0xb6b2a6,
          Math.cos(th) * (rad + 0.02), y, Math.sin(th) * (rad + 0.02), 0, -th, 0);
      }
    });
    // raceway junction boxes
    [8.6, 17.8, 26.4].forEach(y => {
      pushDoor(s1hw, 0xdedbcf, CORE_R + 0.055, 79 * DEG, y, 0.34, 0.26);
    });
    // service ladders at two angles of the core stage
    [96, 252].forEach(deg => {
      const th = deg * DEG;
      const rad = CORE_R + 0.09;
      const x = Math.cos(th) * rad, z = Math.sin(th) * rad;
      [-0.17, 0.17].forEach(off => {
        pushCyl(s1hw, 0.022, 0.022, 5.6, 6, 0xbfbbaf,
          x + Math.cos(th + PI / 2) * off, 6.2, z + Math.sin(th + PI / 2) * off, 0, 0, 0, false);
      });
      for (let y = 3.7; y < 8.9; y += 0.32) {
        pushBox(s1hw, 0.04, 0.022, 0.36, 0xb6b2a6,
          Math.cos(th) * (rad + 0.01), y, Math.sin(th) * (rad + 0.01), 0, -th, 0);
      }
    });
    // rivet rows at the main station rings + raised access doors
    pushBolts(s1hw, 0xc9c5b8, CORE_R + 0.012, 4.46, 52, 0.034, 0.026);
    pushBolts(s1hw, 0xc9c5b8, CORE_R + 0.012, 16.24, 52, 0.034, 0.026);
    pushBolts(s1hw, 0xc9c5b8, CORE_R + 0.012, 32.92, 52, 0.034, 0.026);
    pushDoor(s1hw, 0xe2dfd3, CORE_R + 0.01, 54 * DEG, 12.3, 0.72, 0.6);
    pushDoor(s1hw, 0xe2dfd3, CORE_R + 0.01, 148 * DEG, 9.8, 0.6, 0.5);
    pushDoor(s1hw, 0xe2dfd3, CORE_R + 0.01, 236 * DEG, 22.6, 0.8, 0.62);
    pushDoor(s1hw, 0xdcd9cd, CORE_R + 0.01, 108 * DEG, 30.6, 0.5, 0.4);
    const s1hwMesh = mergeColored(s1hw, matHWClip, { name: 'stage1-hw' });
    if (s1hwMesh) { s1hwMesh.castShadow = true; s1hwMesh.receiveShadow = true; stage1.add(s1hwMesh); }

    // ---- stage-1 tail: base heat shield + thrust structure + 2 × YF-77 ----
    const tailHW = [];
    // dark base plate with two engine holes at x = ±1.25
    tailHW.push({ geo: plateWithHoles(CORE_R - 0.06, 0.09, [[-1.25, 0, 0.63], [1.25, 0, 0.63]], 2.62), color: 0x4a4e4d });
    // rim
    tailHW.push({ geo: plateWithHoles(CORE_R + 0.01, 0.12, [[0, 0, CORE_R - 0.08]], 2.58), color: 0x747876 });
    // radial thrust beams
    for (let k = 0; k < 8; k++) {
      const a = k / 8 * TAU;
      pushBox(tailHW, 0.16, 0.5, 1.9, 0x62686a,
        Math.cos(a) * 1.2, 2.95, Math.sin(a) * 1.2, 0, -a, 0);
    }
    // conical thrust frame ring
    tailHW.push({ geo: revolve([[2.3, 2.66], [1.98, 3.05], [1.9, 3.4], [2.3, 3.4]], { seg: 64 }), color: 0x5c6264 });
    const coreBellList = [];
    const engineHW = [];
    const coreDull = [];
    [-1.25, 1.25].forEach((x, i) => {
      // YF-77 bell (exit ⌀ ~1.16 m, 2.5 m long)
      const bg = bellGeometry({ rExit: 0.6, rThroat: 0.115, len: 2.55, ribs: 32, ny: 30, nt: 76, ribAmp: 0.021 });
      bg.translate(x, 2.55, 0);
      coreBellList.push(bg);
      // gimballed chamber + turbopump + feed lines
      pushCyl(engineHW, 0.24, 0.28, 0.7, 18, 0x7f8587, x, 3.0, 0);
      pushCyl(engineHW, 0.3, 0.3, 0.5, 18, 0x6d7375, x + 0.44, 3.05, (i ? 0.24 : -0.24));
      pushBox(engineHW, 0.5, 0.4, 0.5, 0x585e60, x - 0.4, 3.15, (i ? -0.3 : 0.3), 0, 0.3, 0);
      pushStrut(engineHW, 0xa0a5a2, [x - 0.5, 3.35, 0.3], [x - 0.34, 2.72, 0.12], 0.05, 0.045, 8);
      pushStrut(engineHW, 0xa0a5a2, [x + 0.5, 3.35, -0.3], [x + 0.34, 2.72, -0.12], 0.05, 0.045, 8);
      pushTube(engineHW, 0x8a5a39, [[x - 0.3, 3.35, -0.4], [x - 0.5, 3.0, -0.25], [x - 0.42, 2.7, -0.1]], 0.055, 12, 7);
      pushTube(engineHW, 0x9aa0a1, [[x + 0.3, 3.35, 0.42], [x + 0.5, 2.95, 0.22], [x + 0.4, 2.66, 0.05]], 0.05, 12, 7);
      // exhaust nozzle inner glow ring (dark)
      pushCyl(engineHW, 0.6, 0.6, 0.06, 32, 0x24272a, x, 0.06, 0, 0, 0, 0, true);
      // exit lip ring
      pushCyl(engineHW, 0.625, 0.625, 0.055, 40, 0x6b6a63, x, 0.075, 0, 0, 0, 0, true);
      // heat exchanger + turbine exhaust duct + propellant lines (dull cast metal)
      pushCyl(coreDull, 0.15, 0.15, 0.72, 14, 0x8f9492, x + 0.64, 3.3, 0.12);
      pushCyl(coreDull, 0.09, 0.09, 0.24, 10, 0x9ba09d, x + 0.64, 3.82, 0.12);
      pushTube(coreDull, 0x7e8482, [[x + 0.56, 3.32, -0.18], [x + 0.72, 2.94, -0.34], [x + 0.62, 2.24, -0.4]], 0.065, 10, 6);
      pushTube(coreDull, 0x9a9d95, [[x - 0.56, 3.3, 0.28], [x - 0.72, 2.9, 0.44], [x - 0.56, 2.42, 0.34]], 0.055, 10, 6);
      pushCyl(coreDull, 0.11, 0.13, 0.26, 10, 0x5e6466, x, 3.42, 0);
      pushBox(coreDull, 0.3, 0.22, 0.2, 0x62686a, x + 0.42, 3.55, -0.32, 0, 0.4, 0);
    });
    const coreDullMesh = mergeColored(coreDull, matHWDull, { name: 'yf77-dull' });
    if (coreDullMesh) { coreDullMesh.castShadow = true; coreDullMesh.receiveShadow = true; stage1.add(coreDullMesh); }
    if (coreBellList.length) {
      const bells = U.mesh(U.mergeGeometries(coreBellList), matBell, { name: 'yf77-bells' });
      bells.castShadow = true; bells.receiveShadow = true;
      stage1.add(bells);
    }
    const tailMesh = mergeColored(tailHW, matHW, { name: 'stage1-tail-hw' });
    if (tailMesh) { tailMesh.castShadow = true; tailMesh.receiveShadow = true; stage1.add(tailMesh); }
    const engineMesh = mergeColored(engineHW, matHW, { name: 'yf77-hw' });
    if (engineMesh) { engineMesh.castShadow = true; engineMesh.receiveShadow = true; stage1.add(engineMesh); }

    // ---- stage-1 markings (in the gap between boosters on the hero side) ----
    const s1dec = [];
    decal(s1dec, 'cascTri', { r: CORE_R + 0.02, theta: 79 * DEG, y0: 20.4, y1: 21.5, w: 1.05, seg: 12 });
    decal(s1dec, 'cz5', { r: CORE_R + 0.02, theta: 79 * DEG, y0: 18.3, y1: 19.1, w: 1.5, seg: 12 });
    decal(s1dec, 'flag', { r: CORE_R + 0.02, theta: 193 * DEG, y0: 13.9, y1: 14.75, w: 0.9, seg: 10 });
    decal(s1dec, 'serial', { r: CORE_R + 0.02, theta: 193 * DEG, y0: 11.9, y1: 12.5, w: 0.8, seg: 10 });
    decal(s1dec, 'hazard', { r: CORE_R + 0.02, theta: 79 * DEG, y0: 5.05, y1: 5.4, w: 2.3, seg: 16 });
    decal(s1dec, 'hazard', { r: CORE_R + 0.02, theta: 193 * DEG, y0: 5.05, y1: 5.4, w: 2.3, seg: 16 });
    decal(s1dec, 'hazard', { r: CORE_R + 0.02, theta: 79 * DEG, y0: 31.9, y1: 32.2, w: 1.9, seg: 14 });
    decal(s1dec, 'hazard', { r: CORE_R + 0.02, theta: 193 * DEG, y0: 31.9, y1: 32.2, w: 1.9, seg: 14 });
    decalMesh(s1dec, matDecal, stage1, 3);
    buildCutEdge((y) => CORE_R, 2.6, 33.16, 0, stage1);

    /* ======================================================================
     * 8. STAGE 2 — shell 33.16 → 44.7 (engine bay left open: YF-75D bells are
     *    built by 45-interior.js and reach down into the interstage)
     * ====================================================================*/
    const stage2 = U.group('cz5-stage2');
    group.add(stage2);
    const s2Profile = [[CORE_R, 33.16], [CORE_R, 39.4], [CORE_R, 43.4], [CORE_R, 44.7]];
    const s2Skin = U.mesh(revolve(s2Profile, { seg: 80 }), matSkinStage2, { name: 'stage2-skin' });
    s2Skin.castShadow = true; s2Skin.receiveShadow = true;
    stage2.add(s2Skin);

    const s2hw = [];
    const ringBand2 = (r, y, h, t, color) => {
      const prof = [[r, y - h / 2], [r + t, y - h / 2 + t * 1.4], [r + t, y + h / 2 - t * 1.4], [r, y + h / 2]];
      s2hw.push({ geo: revolve(prof, { seg: 80 }), color: color });
    };
    ringBand2(CORE_R, 35.6, 0.16, 0.04, 0xd8d4c8);
    ringBand2(CORE_R, 39.4, 0.14, 0.035, 0xd8d4c8);
    ringBand2(CORE_R, 43.4, 0.18, 0.045, 0xd0ccc0);
    ringBand2(CORE_R, 44.56, 0.24, 0.055, 0x9da2a1);
    // bottom rim of the open engine bay
    s2hw.push({ geo: plateWithHoles(CORE_R + 0.01, 0.12, [[0, 0, CORE_R - 0.12]], 33.14), color: 0x8e9392 });
    // raceway
    [103, 230].forEach((deg) => {
      const th = deg * DEG;
      const rad = CORE_R + 0.026;
      const len = 44.5 - 35.7;
      const box = new T.BoxGeometry(0.24, len, 0.08);
      box.applyMatrix4(new T.Matrix4().compose(
        new T.Vector3(Math.cos(th) * rad, 35.7 + len / 2, Math.sin(th) * rad),
        new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), -th),
        new T.Vector3(1, 1, 1)
      ));
      s2hw.push({ geo: box, color: 0xc9c5b8 });
      for (let y = 36.4; y < 44.4; y += 1.6) {
        pushBox(s2hw, 0.32, 0.065, 0.11, 0xa9a596,
          Math.cos(th) * (rad + 0.03), y, Math.sin(th) * (rad + 0.03), 0, -th, 0);
      }
    });
    // separation pushers around 39.4
    for (let k = 0; k < 12; k++) {
      const th = (k / 12 + 1 / 24) * TAU;
      pushBox(s2hw, 0.16, 0.18, 0.1, 0x9ca19e,
        Math.cos(th) * (CORE_R + 0.03), 39.4, Math.sin(th) * (CORE_R + 0.03), 0, -th, 0);
    }
    // stage-2 cable harness + vent box
    (() => {
      const th = 156 * DEG, rad = CORE_R + 0.04;
      const pts = [];
      for (let y = 33.7; y <= 44.3; y += 1.8) pts.push([Math.cos(th) * rad, y, Math.sin(th) * rad]);
      pushTube(s2hw, 0x2c2f2b, pts, 0.03, 18, 5);
      for (let y = 34.2; y < 44.2; y += 1.8) {
        pushBox(s2hw, 0.09, 0.045, 0.055, 0xb6b2a6, Math.cos(th) * (rad + 0.01), y, Math.sin(th) * (rad + 0.01), 0, -th, 0);
      }
      pushBox(s2hw, 0.34, 0.28, 0.16, 0xd6d3c6, Math.cos(th) * (rad + 0.06), 44.2, Math.sin(th) * (rad + 0.06), 0, -th, 0);
    })();
    pushBolts(s2hw, 0xc9c5b8, CORE_R + 0.012, 43.46, 52, 0.034, 0.026);
    pushBolts(s2hw, 0xc9c5b8, CORE_R + 0.012, 35.66, 46, 0.03, 0.024);
    pushDoor(s2hw, 0xe2dfd3, CORE_R + 0.01, 64 * DEG, 42.4, 0.56, 0.46);
    pushDoor(s2hw, 0xe2dfd3, CORE_R + 0.01, 196 * DEG, 37.8, 0.62, 0.5);
    const s2hwMesh = mergeColored(s2hw, matHWClip, { name: 'stage2-hw' });
    if (s2hwMesh) { s2hwMesh.castShadow = true; s2hwMesh.receiveShadow = true; stage2.add(s2hwMesh); }

    const s2dec = [];
    decal(s2dec, 'casc', { r: CORE_R + 0.02, theta: 140 * DEG, y0: 40.85, y1: 41.95, w: 1.0, seg: 12 });
    decal(s2dec, 'chinaSpace', { r: CORE_R + 0.02, theta: 140 * DEG, y0: 35.95, y1: 40.35, w: 1.15, seg: 10 });
    decal(s2dec, 'roundel', { r: CORE_R + 0.02, theta: 140 * DEG, y0: 34.15, y1: 34.95, w: 0.7, seg: 10 });
    decal(s2dec, 'cz5', { r: CORE_R + 0.02, theta: 180 * DEG, y0: 37.6, y1: 38.35, w: 1.3, seg: 12 });
    decal(s2dec, 'serial', { r: CORE_R + 0.02, theta: 180 * DEG, y0: 36.45, y1: 37.05, w: 0.82, seg: 10 });
    decalMesh(s2dec, matDecal, stage2, 3);
    buildCutEdge((y) => CORE_R, 33.16, 44.7, 0, stage2);

    /* ======================================================================
     * 9. PAYLOAD FAIRING — two clamshell halves, boat-tail + ogive, ⌀5.2 m
     * ====================================================================*/
    const fairing = U.group('cz5-fairing');
    group.add(fairing);
    const halfA = U.group('fairing-half-a');   // x > 0
    const halfB = U.group('fairing-half-b');   // x < 0
    fairing.add(halfA); fairing.add(halfB);

    const OG_L = ST.fairingTip - ST.fairingBoatTop;   // 4.12 m
    function ogiveR(y) {
      const yy = clamp(y - ST.fairingBoatTop, 0, OG_L);
      const rho = (FAIR_R * FAIR_R + OG_L * OG_L) / (2 * FAIR_R);
      return Math.sqrt(Math.max(0, rho * rho - yy * yy)) - (rho - FAIR_R);
    }
    const fairProfile = [[FAIR_R - 0.1, ST.fairingBase], [FAIR_R, 45.32], [FAIR_R, 46.6], [FAIR_R, 48.0], [FAIR_R, 49.4], [FAIR_R, 50.8], [FAIR_R, 52.2], [FAIR_R, 52.85]];
    for (let i = 1; i <= 26; i++) {
      const y = ST.fairingBoatTop + OG_L * (i / 26);
      fairProfile.push([Math.max(0.015, ogiveR(y)), y]);
    }
    const fairSkinA = U.mesh(revolve(fairProfile, { seg: 46, th0: -PI / 2, thL: PI, uStart: 0.75, uLen: 0.5 }), matSkinFairing, { name: 'fairing-a' });
    fairSkinA.castShadow = true; fairSkinA.receiveShadow = true;
    halfA.add(fairSkinA);
    const fairSkinB = U.mesh(revolve(fairProfile, { seg: 46, th0: PI / 2, thL: PI, uStart: 0.25, uLen: 0.5 }), matSkinFairing, { name: 'fairing-b' });
    fairSkinB.castShadow = true; fairSkinB.receiveShadow = true;
    halfB.add(fairSkinB);

    // ---- fairing hardware: hinges / separation charge covers / base ring ----
    function fairingHardware(half, sign) {
      const hw = [];
      const th0 = sign > 0 ? 0 : PI;
      // base ring segments (half ring each, matching the clamshell split at x = 0)
      const br = FAIR_R + 0.005, bt = 0.09, by = ST.fairingBase + 0.03;
      const halfTh0 = sign > 0 ? -PI / 2 : PI / 2;
      hw.push({
        geo: revolve([[br, by], [br, by + 0.13], [br + 0.07, by + 0.13], [br + 0.07, by]], { seg: 40, th0: halfTh0, thL: PI }),
        color: 0x9ba09f
      });
      // separation charge / ordnance covers along both long edges
      [-1, 1].forEach(dir => {
        const th = (sign > 0 ? 0 : PI) + dir * PI / 2;
        for (let y = 45.4; y < 52.7; y += 0.82) {
          pushBox(hw, 0.14, 0.24, 0.1, 0x8d9290,
            Math.cos(th) * (FAIR_R + 0.03), y, Math.sin(th) * (FAIR_R + 0.03), 0, -th, 0);
        }
        // hinge fittings at the base
        pushBox(hw, 0.34, 0.34, 0.22, 0x787e7c,
          Math.cos(th) * (FAIR_R + 0.06), 45.0, Math.sin(th) * (FAIR_R + 0.06), 0, -th, 0);
      });
      // longitudinal stiffener ribs on the inside of each half (visible in cutaway)
      for (let k = 0; k < 5; k++) {
        const th = th0 - PI / 2 + (k + 0.5) * PI / 5;
        const box = new T.BoxGeometry(0.06, 7.6, 0.16);
        box.applyMatrix4(new T.Matrix4().compose(
          new T.Vector3(Math.cos(th) * (FAIR_R - 0.06), 45.3 + 3.8, Math.sin(th) * (FAIR_R - 0.06)),
          new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), -th),
          new T.Vector3(1, 1, 1)
        ));
        hw.push({ geo: box, color: 0xb6b2a6 });
      }
      // base-row bolts on this half only (theta ranges to avoid double rings)
      const bth0 = sign > 0 ? -PI / 2 : PI / 2;
      for (let i = 0; i < 26; i++) {
        const a = bth0 + (i + 0.5) / 26 * PI;
        pushCyl(hw, 0.04, 0.04, 0.028, 6, 0xc9c5b8,
          Math.cos(a) * (FAIR_R + 0.015), ST.fairingBase + 0.18, Math.sin(a) * (FAIR_R + 0.015), PI / 2, PI / 2 - a, 0, false);
      }
      pushDoor(hw, 0xe4e1d5, FAIR_R + 0.01, (sign > 0 ? 60 : 210) * DEG, 46.8, 0.6, 0.5);
      const m = mergeColored(hw, matHWClip, { name: 'fairing-hw' });
      if (m) { m.castShadow = true; m.receiveShadow = true; half.add(m); }
    }
    fairingHardware(halfA, 1);
    fairingHardware(halfB, -1);

    // ---- fairing markings ----
    const la = [];
    decal(la, 'flag', { r: FAIR_R + 0.015, theta: 30 * DEG, y0: 49.45, y1: 50.35, w: 1.35, seg: 12 });
    decal(la, 'chn', { r: FAIR_R + 0.015, theta: 30 * DEG, y0: 48.9, y1: 49.27, w: 0.92, seg: 10 });
    decal(la, 'cascTri', { r: FAIR_R + 0.015, theta: 58 * DEG, y0: 49.8, y1: 50.5, w: 0.72, seg: 8 });
    decal(la, 'sepStripe', { r: FAIR_R + 0.01, theta: 86 * DEG, y0: 45.4, y1: 52.8, w: 0.16, seg: 4 });
    decal(la, 'sepStripe', { r: FAIR_R + 0.01, theta: 274 * DEG, y0: 45.4, y1: 52.8, w: 0.16, seg: 4 });
    decal(la, 'mission', { r: FAIR_R + 0.015, theta: 22 * DEG, y0: 46.2, y1: 47.15, w: 1.5, seg: 10 });
    const lb = [];
    decal(lb, 'flag', { r: FAIR_R + 0.015, theta: 150 * DEG, y0: 49.45, y1: 50.35, w: 1.35, seg: 12 });
    decal(lb, 'chn', { r: FAIR_R + 0.015, theta: 150 * DEG, y0: 48.9, y1: 49.27, w: 0.92, seg: 10 });
    decal(lb, 'cascTri', { r: FAIR_R + 0.015, theta: 176 * DEG, y0: 49.8, y1: 50.5, w: 0.72, seg: 8 });
    decal(lb, 'sepStripe', { r: FAIR_R + 0.01, theta: 94 * DEG, y0: 45.4, y1: 52.8, w: 0.16, seg: 4 });
    decal(lb, 'sepStripe', { r: FAIR_R + 0.01, theta: 266 * DEG, y0: 45.4, y1: 52.8, w: 0.16, seg: 4 });
    decal(lb, 'mission', { r: FAIR_R + 0.015, theta: 158 * DEG, y0: 46.2, y1: 47.15, w: 1.5, seg: 10 });
    decalMesh(la, matDecal, halfA, 3);
    decalMesh(lb, matDecal, halfB, 3);

    // cut edges for both halves
    buildCutEdge((y) => y > ST.fairingBoatTop ? Math.max(0.03, ogiveR(y)) : FAIR_R, ST.fairingBase, ST.fairingTip, 1, halfA);
    buildCutEdge((y) => y > ST.fairingBoatTop ? Math.max(0.03, ogiveR(y)) : FAIR_R, ST.fairingBase, ST.fairingTip, -1, halfB);

    // fairing tip cap
    const tipCap = U.mesh(new T.SphereGeometry(0.035, 10, 8), matSkinFairing, { y: ST.fairingTip });
    halfA.add(tipCap);

    /* ======================================================================
     * 10. BOOSTERS — 4 × (⌀3.35 m × 27.6 m), 2 × YF-100 each
     * ====================================================================*/
    const boosters = [];
    const BOOST_TOP = R.boosterTop;      // 29.2
    const BOOST_BOT = R.boosterBottom;   // 1.6
    const NOSE_L = 3.8;
    const noseBase = BOOST_TOP - NOSE_L;  // 25.4
    function boosterOgiveR(y) {
      const yy = clamp(y - noseBase, 0, NOSE_L);
      const rho = (BOOST_R * BOOST_R + NOSE_L * NOSE_L) / (2 * BOOST_R);
      return Math.sqrt(Math.max(0, rho * rho - yy * yy)) - (rho - BOOST_R);
    }
    const boostProfile = [
      [1.42, BOOST_BOT], [1.55, BOOST_BOT + 0.5], [BOOST_R, BOOST_BOT + 1.05],
      [BOOST_R, 8.0], [BOOST_R, 14.0], [BOOST_R, 20.0], [BOOST_R, noseBase]
    ];
    for (let i = 1; i <= 20; i++) {
      const y = noseBase + NOSE_L * (i / 20);
      boostProfile.push([Math.max(0.012, boosterOgiveR(y)), y]);
    }

    for (let bi = 0; bi < 4; bi++) {
      const ang = R.boosterAngles[bi] * DEG;
      const bx = Math.cos(ang) * BOOST_D, bz = Math.sin(ang) * BOOST_D;
      const bgrp = U.group('cz5-booster-' + bi);
      bgrp.position.set(bx, 0, bz);
      group.add(bgrp);
      const rec = { group: bgrp, ang: ang, x: bx, z: bz };

      const skin = U.mesh(revolve(boostProfile, { seg: 56 }), matSkinBooster, { name: 'booster-skin' });
      skin.castShadow = true; skin.receiveShadow = true;
      bgrp.add(skin);
      rec.skin = skin;

      // ---- booster hardware: attach struts, bands, fittings ----
      const bhw = [];
      // aft attach strut (angled down toward the core) + fitting
      const inDir = new T.Vector3(-Math.cos(ang), 0, -Math.sin(ang));
      const p1 = new T.Vector3(inDir.x * (BOOST_R - 0.02), 6.2, inDir.z * (BOOST_R - 0.02));
      pushStrut(bhw, 0xb9b5a8,
        [p1.x, p1.y, p1.z],
        [p1.x + inDir.x * 1.0, p1.y - 0.35, p1.z + inDir.z * 1.0], 0.16, 0.1, 10);
      pushBox(bhw, 0.42, 0.34, 0.2, 0x8d9290, p1.x, p1.y, p1.z, 0, -ang, 0);
      // forward attach strut near the nose
      const p2 = new T.Vector3(inDir.x * (BOOST_R - 0.05), 27.15, inDir.z * (BOOST_R - 0.05));
      pushStrut(bhw, 0xc4c0b4,
        [p2.x, p2.y, p2.z],
        [p2.x + inDir.x * 1.35, p2.y + 0.55, p2.z + inDir.z * 1.35], 0.2, 0.075, 10);
      pushBox(bhw, 0.3, 0.4, 0.18, 0x8d9290, p2.x, p2.y, p2.z, 0, -ang, 0);
      // separation pyro covers near the forward end
      for (let k = 0; k < 5; k++) {
        const a = ang - 0.5 + k * 0.25;
        pushBox(bhw, 0.14, 0.2, 0.09, 0x8d9290,
          Math.cos(a) * (BOOST_R + 0.02), 26.4, Math.sin(a) * (BOOST_R + 0.02), 0, -a, 0);
      }
      // small separation pushers on the inboard face
      for (let k = 0; k < 2; k++) {
        const y = 14 + k * 1.4;
        pushBox(bhw, 0.2, 0.22, 0.12, 0x9ca19e,
          inDir.x * (BOOST_R + 0.01), y, inDir.z * (BOOST_R + 0.01), 0, -ang, 0);
      }
      // nose tip cap
      pushCyl(bhw, 0.02, 0.16, 0.12, 12, 0xd9d5c9, 0, BOOST_TOP - 0.03, 0);
      // nose base seam ring + thin dark band (nose/body interface)
      pushCyl(bhw, BOOST_R + 0.022, BOOST_R + 0.022, 0.09, 48, 0xbdb9ac, 0, noseBase + 0.02, 0, 0, 0, 0, true);
      pushCyl(bhw, BOOST_R + 0.014, BOOST_R + 0.014, 0.06, 48, 0x8b8f8c, 0, BOOST_BOT + 1.3, 0, 0, 0, 0, true);
      // raised cable raceway on the outboard face
      const rwTh = ang + 0.22;
      const rwLen = noseBase - 3.3;
      const rwBox = new T.BoxGeometry(0.2, rwLen, 0.07);
      rwBox.applyMatrix4(new T.Matrix4().compose(
        new T.Vector3(Math.cos(rwTh) * (BOOST_R + 0.025), 3.3 + rwLen / 2, Math.sin(rwTh) * (BOOST_R + 0.025)),
        new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), -rwTh),
        new T.Vector3(1, 1, 1)
      ));
      bhw.push({ geo: rwBox, color: 0xc9c5b8 });
      for (let y = 4.2; y < noseBase - 0.6; y += 1.5) {
        pushBox(bhw, 0.3, 0.06, 0.1, 0xa9a596,
          Math.cos(rwTh) * (BOOST_R + 0.05), y, Math.sin(rwTh) * (BOOST_R + 0.05), 0, -rwTh, 0);
      }
      const bhwMesh = mergeColored(bhw, matHWBoost, { name: 'booster-hw' });
      if (bhwMesh) { bhwMesh.castShadow = true; bhwMesh.receiveShadow = true; bgrp.add(bhwMesh); }
      rec.hw = bhwMesh;

      // ---- 2 × YF-100 engines ----
      const bBellList = [], bEngHW = [], bEngDull = [];
      bEngHW.push({ geo: plateWithHoles(1.34, 0.09, [[-0.66, 0, 0.5], [0.66, 0, 0.5]], 2.08), color: 0x44494a });
      [-0.66, 0.66].forEach((ex, ei) => {
        const bg = bellGeometry({ rExit: 0.6, rThroat: 0.105, len: 2.05, ribs: 30, ny: 28, nt: 68, ribAmp: 0.022 });
        bg.translate(ex, 2.08, 0);
        bBellList.push(bg);
        pushCyl(bEngHW, 0.21, 0.26, 0.5, 14, 0x8a8f8d, ex, 2.4, 0);
        pushCyl(bEngHW, 0.26, 0.26, 0.34, 14, 0x6a7072, ex + 0.34, 2.42, 0.13);
        pushStrut(bEngHW, 0xa8adaa, [ex - 0.36, 2.5, 0.24], [ex - 0.26, 2.15, 0.1], 0.05, 0.042, 8);
        pushTube(bEngHW, 0x8a5a39, [[ex - 0.24, 2.5, -0.32], [ex - 0.38, 2.25, -0.18], [ex - 0.32, 2.08, -0.06]], 0.048, 10, 6);
        pushCyl(bEngHW, 0.63, 0.63, 0.05, 36, 0x6b6a63, ex, 0.065, 0, 0, 0, 0, true);
        // dull cast-metal plumbing
        pushCyl(bEngDull, 0.13, 0.13, 0.55, 12, 0x8f9492, ex + 0.4, 2.42, 0.1);
        pushTube(bEngDull, 0x7e8482, [[ex + 0.34, 2.44, -0.16], [ex + 0.46, 2.18, -0.3], [ex + 0.38, 1.86, -0.34]], 0.05, 9, 6);
        pushBox(bEngDull, 0.24, 0.18, 0.16, 0x62686a, ex - 0.44, 2.36, -0.2, 0, 0.35, 0);
      });
      const bBells = U.mesh(U.mergeGeometries(bBellList), matBellBoost, { name: 'yf100-bells' });
      bBells.castShadow = true; bBells.receiveShadow = true;
      bgrp.add(bBells);
      const bEngMesh = mergeColored(bEngHW, matHWBoost, { name: 'yf100-hw' });
      if (bEngMesh) { bEngMesh.castShadow = true; bEngMesh.receiveShadow = true; bgrp.add(bEngMesh); }
      const bDullMesh = mergeColored(bEngDull, matHWDullBoost, { name: 'yf100-dull' });
      if (bDullMesh) { bDullMesh.castShadow = true; bDullMesh.receiveShadow = true; bgrp.add(bDullMesh); }
      rec.dull = bDullMesh;
      rec.bells = bBells;
      rec.engineHW = bEngMesh;

      // ---- booster markings ----
      const bdec = [];
      const faceTh = ang + PI / 2; // outward-facing angle towards hero camera side
      decal(bdec, 'serial', { r: BOOST_R + 0.015, theta: faceTh, y0: 19.4, y1: 20.05, w: 0.6, seg: 8 });
      rec.decals = decalMesh(bdec, matDecalBoost, bgrp, 3);

      boosters.push(rec);
    }
    // booster shells list for the Lead (ghosting targets)
    const boosterShells = boosters.map(b => b.skin);

    /* ======================================================================
     * 11. state: cut + explode
     * ====================================================================*/
    let cutT = 0;
    let explodeT = 0;
    const E = { stage2: 4.0, fairing: 14.0, boosterOut: 2.0, boosterUp: 0.8, fairingSplit: 1.15, fairingTilt: 0.045 };

    function readPlane() {
      return (APP.cutPlane && isFinite(APP.cutPlane.constant)) ? APP.cutPlane.constant : 6.6;
    }

    function applyGhost(t) {
      const g = smoothstep(0.05, 0.45, t);       // 0 → 1 ghost amount
      matSkinBooster.opacity = 1 - 0.82 * g;     // ≈ 0.18 when cut fully open
      matDecalBoost.opacity = 1 - 0.82 * g;
      matHWBoost.opacity = 1 - 0.62 * g;
      matBellBoost.opacity = 1 - 0.30 * g;
      matHWDullBoost.opacity = 1 - 0.62 * g;
      matSkinBooster.depthWrite = matSkinBooster.opacity > 0.9;
      matHWBoost.depthWrite = matHWBoost.opacity > 0.9;
      matBellBoost.depthWrite = matBellBoost.opacity > 0.9;
      matHWDullBoost.depthWrite = matHWDullBoost.opacity > 0.9;
      matDecalBoost.depthWrite = false;
      boosterShells.forEach(s => { s.renderOrder = matSkinBooster.opacity < 0.95 ? 6 : 0; });
      boosters.forEach(b => {
        if (b.hw) b.hw.renderOrder = matHWBoost.opacity < 0.95 ? 7 : 0;
        if (b.bells) b.bells.renderOrder = matBellBoost.opacity < 0.95 ? 7 : 0;
        if (b.engineHW) b.engineHW.renderOrder = matHWBoost.opacity < 0.95 ? 7 : 0;
        if (b.dull) b.dull.renderOrder = matHWDullBoost.opacity < 0.95 ? 7 : 0;
      });
      matEdge.opacity = t > 0.001 ? Math.min(1, smoothstep(0.0, 0.06, t) * 0.95) : 0;
      matEdge.visible = matEdge.opacity > 0.01;
    }

    function applyCut(t) {
      cutT = clamp(t, 0, 1);
      applyGhost(cutT);
      updateCutEdges(readPlane());
    }

    function applyExplode(t) {
      explodeT = clamp(t, 0, 1);
      const e = smoothstep(0, 1, explodeT);
      stage2.position.y = E.stage2 * e;
      fairing.position.y = E.fairing * e;
      halfA.position.x = E.fairingSplit * e;
      halfB.position.x = -E.fairingSplit * e;
      halfA.rotation.z = E.fairingTilt * e;
      halfB.rotation.z = -E.fairingTilt * e;
      boosters.forEach(b => {
        const ca = Math.cos(b.ang), sa = Math.sin(b.ang);
        b.group.position.set(b.x + ca * E.boosterOut * e, E.boosterUp * e, b.z + sa * E.boosterOut * e);
      });
    }

    /* ======================================================================
     * 12. part metadata
     * ====================================================================*/
    const worldOf = (grp, x, y, z) => () => grp.localToWorld(new T.Vector3(x, y, z));
    const reg = (id, meta) => APP.registerPart(id, meta);

    reg('fairing', {
      zh: '整流罩', en: 'PAYLOAD FAIRING', section: '火箭结构',
      modes: ['overall', 'cut', 'explode'],
      group: fairing,
      anchor: worldOf(fairing, -1.75, 50.6, 1.5),
      specs: [
        ['高度', '12.27 m'], ['直径', '5.2 m'], ['分瓣形式', '两半罩纵向解锁'],
        ['材料', '复合材料 / 金属蜂窝']
      ],
      desc: '长征五号的大型整流罩直径 5.2 米，分两瓣纵向解锁，用于包裹嫦娥七号探测器，穿越大气层后抛罩。'
    });
    reg('stage2', {
      zh: '芯二级', en: 'CORE STAGE 2', section: '火箭结构',
      modes: ['overall', 'cut', 'explode'],
      group: stage2,
      anchor: worldOf(stage2, -1.5, 39.0, 1.6),
      specs: [
        ['长度', '11.54 m'], ['直径', '5.0 m'], ['发动机', '2 × YF-75D'],
        ['推进剂', '液氢 / 液氧'], ['真空推力', '2 × 88.36 kN']
      ],
      desc: '芯二级由两台 YF-75D 氢氧发动机提供动力，负责将嫦娥七号送入地月转移轨道，随后与上面级分离。'
    });
    reg('stage1', {
      zh: '芯一级', en: 'CORE STAGE 1', section: '火箭结构',
      modes: ['overall', 'cut', 'explode'],
      group: stage1,
      anchor: worldOf(stage1, -1.7, 17.5, 1.6),
      specs: [
        ['长度', '33.16 m'], ['直径', '5.0 m'], ['发动机', '2 × YF-77'],
        ['推进剂', '液氢 / 液氧'], ['海平面推力', '2 × 518 kN']
      ],
      desc: '芯一级装载液氢液氧低温推进剂，两台 YF-77 发动机在海平面提供约 104 吨推力，工作约 500 秒。'
    });
    reg('booster', {
      zh: '助推器', en: 'STRAP-ON BOOSTERS', section: '火箭结构',
      modes: ['overall', 'cut', 'explode'],
      group: boosters[0].group,
      anchor: worldOf(boosters[0].group, 0, 18.0, BOOST_R),
      specs: [
        ['数量', '4 台'], ['长度', '27.6 m'], ['直径', '3.35 m'],
        ['发动机', '2 × YF-100'], ['推进剂', '液氧 / 煤油']
      ],
      desc: '四台液氧煤油助推器按 X 形布局捆绑，每台由两台 YF-100 发动机推进，起飞阶段提供主要推力。'
    });
    reg('core_engine', {
      zh: 'YF-77 发动机', en: 'YF-77 CORE ENGINES', section: '动力系统',
      modes: ['overall', 'cut', 'explode'],
      group: stage1,
      anchor: worldOf(stage1, 0, 1.35, 0.9),
      specs: [
        ['型号', 'YF-77'], ['数量', '2 台'], ['海平面推力', '2 × 518 kN'],
        ['真空比冲', '约 430 s'], ['推进剂', '液氢 / 液氧']
      ],
      desc: 'YF-77 是中国首型大推力氢氧发动机，采用燃气发生器循环，为芯一级提供持续的高比冲动力。'
    });
    reg('booster_engine', {
      zh: 'YF-100 发动机', en: 'YF-100 BOOSTER ENGINES', section: '动力系统',
      modes: ['overall', 'cut', 'explode'],
      group: boosters[0].group,
      anchor: worldOf(boosters[0].group, 0, 1.2, 0.7),
      specs: [
        ['型号', 'YF-100'], ['数量', '8 台（4 × 2）'], ['海平面推力', '8 × 1,200 kN'],
        ['真空比冲', '约 335 s'], ['推进剂', '液氧 / 煤油']
      ],
      desc: 'YF-100 采用高压补燃循环，单台海平面推力约 120 吨，八台并联是长征五号起飞的主动力来源。'
    });

    /* ======================================================================
     * 13. animations + API
     * ====================================================================*/
    if (APP.cutables) APP.cutables.push(applyCut);
    if (APP.explodables) APP.explodables.push(applyExplode);
    if (APP.timeables) APP.timeables.push(function (mode) {
      const night = mode === 'night';
      const tint = night ? 0xe6e3da : 0xffffff;
      [matSkinCore, matSkinStage2, matSkinFairing, matSkinBooster].forEach(m => {
        m.color.setHex(tint);
        m.envMapIntensity = night ? 0.26 : 0.38;
      });
    });

    // keep cut edges locked to the plane even if the boot animates constant
    let lastC = null, lastCutT = -1;
    if (APP.updaters) {
      APP.updaters.push(() => {
        const c = readPlane();
        const t = APP.state ? APP.state.cut : cutT;
        if (c !== lastC || t !== lastCutT) {
          lastC = c; lastCutT = t;
          if (t !== cutT) { cutT = t; applyGhost(cutT); }
          else if (c !== lastC) { /* noop */ }
          updateCutEdges(c);
        }
      });
    }

    applyCut(0);
    applyExplode(0);

    group.userData.shells = [coreSkin, s2Skin, fairSkinA, fairSkinB];
    group.userData.boosterShells = boosterShells;

    const api = {
      group: group,
      stage1: stage1, stage2: stage2, fairing: fairing,
      halves: { a: halfA, b: halfB },
      boosters: boosters.map(b => b.group),
      shells: [coreSkin, s2Skin, fairSkinA, fairSkinB],
      boosterShells: boosterShells,
      materials: {
        skinCore: matSkinCore, skinStage2: matSkinStage2, skinFairing: matSkinFairing,
        skinBooster: matSkinBooster, hardware: matHWClip, edge: matEdge
      },
      setCut: applyCut,
      setExplode: applyExplode,
      userData: { shells: [coreSkin, s2Skin, fairSkinA, fairSkinB], boosterShells: boosterShells, cutEdges: cutEdges, fairing: fairing }
    };
    APP.modules.rocket = api;
    return api;
  };
})();
