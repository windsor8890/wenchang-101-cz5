/* ============================================================================
 * 50-payload.js — YZ-2 upper stage exterior, payload adapter, Chang'e 7
 *                 (orbiter / lander / rover / hopper), fairing interior,
 *                 payload-only museum explode.
 * Owner: payload.
 *
 * Stations are CZ-5 *local* metres (local y 0 = nozzle exit plane, world y =
 * SPEC.rocket.baseY). Everything is built in local station coordinates inside
 * groups that sit under a root group at y = baseY, so every number below can be
 * read against CONTRACT §1:
 *
 *   44.72 – 49.80   YZ-2 upper stage exterior (⌀3.8 m, 2 × YF-50D shells)
 *   49.80 – 50.60   payload adapter (open truss, descent engine visible)
 *   50.60 – 53.24   lander  (engine 50.33–51.02, body 51.25–52.55, deck→53.24)
 *   53.30 – 54.85   orbiter bus (+ folded wings, HGA to ≈55.55)
 *   +Z face         6-wheel rover in launch cradle (explodes +Z)
 *   −X face         hopper / 飞跃器 docked to lander (explodes −X/−Z)
 *   44.90 – 52.45   fairing interior acoustic blanket + separation rails
 *                   (clipped by a mirror of APP.cutPlane; moves with the
 *                    rocket fairing group when it is discoverable)
 *
 * Explode (Lead contract): whole payload group +4.0 m; inside it orbiter +2.2,
 * rover +1.4 +Z, hopper −1.2 X / −0.6 Z, lander stays. Anchors are live.
 * ==========================================================================*/
(function () {
  'use strict';

  window.buildPayload = function (APP) {
    const T = window.THREE, U = window.U, SPEC = window.SPEC;
    if (!T || !U || !SPEC) { if (window.reportError) window.reportError('payload: foundation missing'); return null; }
    const RT = SPEC.rocket, BASE = RT.baseY;
    const PI = Math.PI, TAU = PI * 2, DEG = PI / 180;
    const clamp = U.clamp, smooth = U.smoothstep;

    /* ---------------------------------------------------------------------
     * 1 · groups
     * -------------------------------------------------------------------*/
    const root = U.group('payload'); root.position.y = BASE; APP.scene.add(root);
    const gF = U.group('payload-fairing-interior'); gF.position.y = BASE; APP.scene.add(gF);
    const gY = U.group('payload-yz2', root);
    const gL = U.group('payload-lander', root);
    const gO = U.group('payload-orbiter', root);
    const gR = U.group('payload-rover', root);
    const gH = U.group('payload-hopper', root);
    // hopper dock on the lander −Z flat (visible side of the cutaway); the
    // hopper is authored in an old −X frame and mapped by kH.xform
    const HOP = { x: 0.10, y: 52.70, z: -1.70 };
    const HOP_OLD = { x: -1.70, z: 0.10 };

    /* ---------------------------------------------------------------------
     * 2 · canvas textures (no external assets)
     * -------------------------------------------------------------------*/
    function repeatTex(t, rx, ry) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 8; return t; }

    const TEX = {};

    TEX.goldA = (function () {
      const g = U.gen(512, 512, (ctx, cv) => {
        const r = U.rng(11);
        ctx.fillStyle = '#c9a24a'; ctx.fillRect(0, 0, cv.width, cv.height);
        for (let i = 0; i < 64; i++) {
          const x = r.range(0, 512), y = r.range(0, 512), rad = r.range(36, 150);
          const gr = ctx.createRadialGradient(x, y, 0, x, y, rad);
          const bright = r.chance(.5);
          gr.addColorStop(0, bright ? 'rgba(255,238,182,.18)' : 'rgba(118,84,20,.13)');
          gr.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.fill();
        }
        // fine vacuum-deposited foil crumple
        for (let i = 0; i < 920; i++) {
          const x = r.range(0, 512), y = r.range(0, 512), len = r.range(4, 26), ang = r.range(0, TAU);
          ctx.beginPath(); ctx.moveTo(x, y);
          ctx.quadraticCurveTo(
            x + Math.cos(ang) * len * .5 + r.range(-4, 4),
            y + Math.sin(ang) * len * .5 + r.range(-4, 4),
            x + Math.cos(ang) * len, y + Math.sin(ang) * len);
          ctx.strokeStyle = r.chance(.5) ? 'rgba(255,247,206,' + r.range(.10, .34) + ')' : 'rgba(92,64,12,' + r.range(.08, .26) + ')';
          ctx.lineWidth = r.range(.5, 1.5); ctx.stroke();
        }
        for (let i = 0; i < 300; i++) {
          ctx.fillStyle = 'rgba(255,251,222,' + r.range(.18, .55) + ')';
          ctx.fillRect(r.range(0, 512), r.range(0, 512), r.range(1, 2.2), r.range(1, 2.2));
        }
      }).tex;
      return repeatTex(g, 3, 3);
    })();

    TEX.goldB = (function () {
      const g = U.gen(512, 512, (ctx, cv) => {
        const r = U.rng(29);
        ctx.fillStyle = '#b08c3c'; ctx.fillRect(0, 0, cv.width, cv.height);
        for (let i = 0; i < 70; i++) {
          const x = r.range(0, 512), y = r.range(0, 512), rad = r.range(30, 140);
          const gr = ctx.createRadialGradient(x, y, 0, x, y, rad);
          gr.addColorStop(0, r.chance(.5) ? 'rgba(236,206,138,.14)' : 'rgba(72,50,10,.16)');
          gr.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.fill();
        }
        for (let i = 0; i < 800; i++) {
          const x = r.range(0, 512), y = r.range(0, 512), len = r.range(4, 24), ang = r.range(0, TAU);
          ctx.beginPath(); ctx.moveTo(x, y);
          ctx.quadraticCurveTo(x + Math.cos(ang) * len * .5 + r.range(-4, 4), y + Math.sin(ang) * len * .5 + r.range(-4, 4), x + Math.cos(ang) * len, y + Math.sin(ang) * len);
          ctx.strokeStyle = r.chance(.5) ? 'rgba(255,242,190,' + r.range(.07, .24) + ')' : 'rgba(62,42,8,' + r.range(.08, .24) + ')';
          ctx.lineWidth = r.range(.5, 1.4); ctx.stroke();
        }
        for (let i = 0; i < 160; i++) {
          ctx.fillStyle = 'rgba(255,246,206,' + r.range(.14, .4) + ')';
          ctx.fillRect(r.range(0, 512), r.range(0, 512), r.range(1, 2), r.range(1, 2));
        }
      }).tex;
      return repeatTex(g, 3.5, 3.5);
    })();

    TEX.crinkle = (function () {
      const g = U.gen(512, 512, (ctx, cv) => {
        const r = U.rng(77);
        ctx.fillStyle = '#8a8a8a'; ctx.fillRect(0, 0, 512, 512);
        for (let i = 0; i < 110; i++) {
          const x = r.range(0, 512), y = r.range(0, 512), rad = r.range(22, 110);
          const gr = ctx.createRadialGradient(x, y, 0, x, y, rad);
          gr.addColorStop(0, r.chance(.5) ? 'rgba(255,255,255,.16)' : 'rgba(0,0,0,.14)');
          gr.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.fill();
        }
        for (let i = 0; i < 420; i++) {
          const x = r.range(0, 512), y = r.range(0, 512), len = r.range(6, 60), ang = r.range(0, TAU);
          ctx.beginPath(); ctx.moveTo(x, y);
          ctx.quadraticCurveTo(x + Math.cos(ang) * len * .5 + r.range(-8, 8), y + Math.sin(ang) * len * .5 + r.range(-8, 8), x + Math.cos(ang) * len, y + Math.sin(ang) * len);
          ctx.strokeStyle = r.chance(.5) ? 'rgba(255,255,255,.22)' : 'rgba(0,0,0,.2)';
          ctx.lineWidth = r.range(.5, 2.2); ctx.stroke();
        }
      }).tex;
      return repeatTex(g, 3, 3);
    })();

    // grey-scale height -> tangent-space normal map (for real MLI foil shading)
    TEX.crinkleN = (function () {
      const size = 512;
      const src = U.gen(size, size, (ctx, cv) => {
        const r = U.rng(77);
        ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 110; i++) {
          const x = r.range(0, size), y = r.range(0, size), rad = r.range(22, 110);
          const gr = ctx.createRadialGradient(x, y, 0, x, y, rad);
          gr.addColorStop(0, r.chance(.5) ? 'rgba(255,255,255,.16)' : 'rgba(0,0,0,.14)');
          gr.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.fill();
        }
        for (let i = 0; i < 420; i++) {
          const x = r.range(0, size), y = r.range(0, size), len = r.range(6, 60), ang = r.range(0, TAU);
          ctx.beginPath(); ctx.moveTo(x, y);
          ctx.quadraticCurveTo(x + Math.cos(ang) * len * .5 + r.range(-8, 8), y + Math.sin(ang) * len * .5 + r.range(-8, 8), x + Math.cos(ang) * len, y + Math.sin(ang) * len);
          ctx.strokeStyle = r.chance(.5) ? 'rgba(255,255,255,.22)' : 'rgba(0,0,0,.2)';
          ctx.lineWidth = r.range(.5, 2.2); ctx.stroke();
        }
      });
      const px = src.ctx.getImageData(0, 0, size, size).data;
      const lum = (x, y) => px[(((y + size) % size) * size + ((x + size) % size)) * 4] / 255;
      const out = U.gen(size, size, (ctx) => {
        const img = ctx.createImageData(size, size);
        const str = 2.4;
        for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
          const dx = (lum(x + 1, y) - lum(x - 1, y)) * str;
          const dy = (lum(x, y + 1) - lum(x, y - 1)) * str;
          const len = Math.sqrt(dx * dx + dy * dy + 1);
          const i = (y * size + x) * 4;
          img.data[i] = Math.round((-dx / len * .5 + .5) * 255);
          img.data[i + 1] = Math.round((-dy / len * .5 + .5) * 255);
          img.data[i + 2] = Math.round((1 / len * .5 + .5) * 255);
          img.data[i + 3] = 255;
        }
        ctx.putImageData(img, 0, 0);
      }, { srgb: false });
      return repeatTex(out.tex, 3, 3);
    })();

    TEX.quilt = (function () {
      const g = U.gen(512, 512, (ctx, cv) => {
        const r = U.rng(5);
        ctx.fillStyle = '#f1efe5'; ctx.fillRect(0, 0, 512, 512);
        for (let i = 0; i < 42; i++) {
          const x = r.range(0, 512), y = r.range(0, 512), rad = r.range(50, 170);
          const gr = ctx.createRadialGradient(x, y, 0, x, y, rad);
          gr.addColorStop(0, r.chance(.5) ? 'rgba(255,255,255,.16)' : 'rgba(172,168,154,.09)');
          gr.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.fill();
        }
        // diamond quilt seams + stitching
        ctx.strokeStyle = 'rgba(148,144,130,.20)'; ctx.lineWidth = 1.2;
        for (let i = -5; i < 9; i++) {
          ctx.beginPath(); ctx.moveTo(i * 64, 0); ctx.lineTo(i * 64 + 512, 512); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(i * 64, 512); ctx.lineTo(i * 64 + 512, 0); ctx.stroke();
        }
        ctx.fillStyle = 'rgba(140,136,124,.20)';
        for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
          const cx = i * 64 + 32, cy = j * 64 + 32;
          for (let s = 0; s < 4; s++) ctx.fillRect(cx - 1.5 + s * 1.1, cy, 1, 1);
        }
      }).tex;
      return repeatTex(g, 2, 2);
    })();

    TEX.solar = (function () {
      const g = U.gen(256, 256, (ctx, cv) => {
        ctx.fillStyle = '#0a1119'; ctx.fillRect(0, 0, 256, 256);
        const n = 4, gap = 5, cw = (256 - gap * (n + 1)) / n;
        for (let iy = 0; iy < n; iy++) for (let ix = 0; ix < n; ix++) {
          const x = gap + ix * (cw + gap), y = gap + iy * (cw + gap);
          const gd = ctx.createLinearGradient(x, y, x + cw, y + cw);
          gd.addColorStop(0, '#1d3f63'); gd.addColorStop(.45, '#122b4a'); gd.addColorStop(1, '#0c1c33');
          ctx.fillStyle = gd; ctx.fillRect(x, y, cw, cw);
          ctx.fillStyle = 'rgba(196,206,214,.42)';
          ctx.fillRect(x + cw * .22, y, 1.4, cw);
          ctx.fillRect(x + cw * .52, y, 1.4, cw);
          ctx.fillRect(x + cw * .82, y, 1.4, cw);
          ctx.fillStyle = 'rgba(214,220,226,.6)';
          ctx.fillRect(x, y + cw * .48, cw, 1.4);
          ctx.fillStyle = 'rgba(226,232,238,.5)';
          ctx.fillRect(x + 2, y + 2, 2.6, 2.6); ctx.fillRect(x + cw - 4.6, y + 2, 2.6, 2.6);
        }
      }).tex;
      return repeatTex(g, 3, 3);
    })();

    TEX.acoustic = (function () {
      const g = U.gen(256, 256, (ctx, cv) => {
        const r = U.rng(91);
        ctx.fillStyle = '#b7b5a7'; ctx.fillRect(0, 0, 256, 256);
        for (let i = 0; i < 200; i++) {
          const x = r.range(0, 256), y = r.range(0, 256), rad = r.range(14, 60);
          const gr = ctx.createRadialGradient(x, y, 0, x, y, rad);
          gr.addColorStop(0, r.chance(.5) ? 'rgba(255,253,244,.10)' : 'rgba(104,102,92,.08)');
          gr.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.fill();
        }
        // diamond quilt pattern with stitched seams
        ctx.strokeStyle = 'rgba(92,90,80,.30)'; ctx.lineWidth = 1.8;
        for (let i = -3; i < 7; i++) {
          ctx.beginPath(); ctx.moveTo(i * 64, 0); ctx.lineTo(i * 64 + 256, 256); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(i * 64, 256); ctx.lineTo(i * 64 + 256, 0); ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(226,224,210,.22)'; ctx.lineWidth = 1;
        for (let i = -3; i < 7; i++) {
          ctx.beginPath(); ctx.moveTo(i * 64 + 2, 0); ctx.lineTo(i * 64 + 258, 256); ctx.stroke();
        }
        ctx.fillStyle = 'rgba(88,86,76,.30)';
        for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
          const cx = i * 32 + 16, cy = j * 32 + 16;
          ctx.fillRect(cx - 1, cy - 3, 1.4, 1.4); ctx.fillRect(cx - 1, cy + 2, 1.4, 1.4);
        }
      }).tex;
      return repeatTex(g, 11, 8);
    })();

    TEX.flag = (function () {
      return U.gen(384, 256, (ctx, cv) => {
        ctx.fillStyle = '#de2910'; ctx.fillRect(0, 0, 384, 256);
        const star = (cx, cy, rad, rot) => {
          ctx.beginPath();
          for (let i = 0; i < 5; i++) {
            const a = rot + i * TAU / 5;
            const a2 = a + TAU / 10;
            if (i === 0) ctx.moveTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
            else ctx.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
            ctx.lineTo(cx + Math.cos(a2) * rad * .382, cy + Math.sin(a2) * rad * .382);
          }
          ctx.closePath();
        };
        ctx.fillStyle = '#ffde00';
        star(96, 64, 34, -PI / 2); ctx.fill();
        star(150, 30, 11, -PI / 2 - .32); ctx.fill();
        star(176, 60, 11, -PI / 2 + .05); ctx.fill();
        star(176, 100, 11, -PI / 2 + .05); ctx.fill();
        star(150, 130, 11, -PI / 2 - .02); ctx.fill();
      }).tex;
    })();

    TEX.hazard = U.texStripe(128, 64, { a: '#d9b53a', b: '#1c1c1a', stripe: 14, angle: 38 });
    TEX.hazard.wrapS = TEX.hazard.wrapT = T.RepeatWrapping;

    /* ---------------------------------------------------------------------
     * 3 · materials (bag keys — one merged mesh per key per group)
     * -------------------------------------------------------------------*/
    const mm = (o) => U.matStandard(o);
    const M = {
      paint: mm({ color: 0xffffff, roughness: .5, metalness: .03, map: TEX.quilt, normalMap: TEX.crinkleN, normalScale: new T.Vector2(.3, .3), envMapIntensity: .9 }),
      gold: mm({ color: 0xffffff, roughness: .24, metalness: .92, map: TEX.goldA, normalMap: TEX.crinkleN, normalScale: new T.Vector2(.5, .5), envMapIntensity: 1.7 }),
      goldD: mm({ color: 0xffffff, roughness: .3, metalness: .86, map: TEX.goldB, normalMap: TEX.crinkleN, normalScale: new T.Vector2(.42, .42), envMapIntensity: 1.4 }),
      amber: mm({ color: 0xffffff, roughness: .3, metalness: .42, map: TEX.goldB, normalMap: TEX.crinkleN, normalScale: new T.Vector2(.3, .3), envMapIntensity: 1.2 }),
      metal: mm({ color: 0xa8adab, roughness: .4, metalness: .82, envMapIntensity: 1.05 }),
      dark: mm({ color: 0x3b4144, roughness: .5, metalness: .62, envMapIntensity: .9 }),
      black: mm({ color: 0x15191b, roughness: .62, metalness: .35 }),
      rad: mm({ color: 0xefede4, roughness: .34, metalness: .06, envMapIntensity: .85 }),
      solar: mm({ color: 0xffffff, roughness: .26, metalness: .52, map: TEX.solar, envMapIntensity: 1.4 }),
      rubber: mm({ color: 0x191b1c, roughness: .93, metalness: .02 }),
      lens: mm({ color: 0x080b0e, roughness: .07, metalness: .92, envMapIntensity: 1.8 }),
      copper: mm({ color: 0x8d5c3a, roughness: .36, metalness: .82 }),
      red: mm({ color: 0xa93225, roughness: .52, metalness: .06 }),
      nozzle: mm({ color: 0x464c4f, roughness: .46, metalness: .72, side: T.DoubleSide, envMapIntensity: 1.0 }),
      ledG: new T.MeshStandardMaterial({ color: 0x0c120e, emissive: 0x63e08c, emissiveIntensity: 1.7, roughness: .5 }),
      ledA: new T.MeshStandardMaterial({ color: 0x120c06, emissive: 0xffa63c, emissiveIntensity: 1.6, roughness: .5 }),
      blanket: mm({ color: 0xffffff, roughness: .95, metalness: .01, map: TEX.acoustic, bumpMap: TEX.acoustic, bumpScale: .018, side: T.DoubleSide, transparent: true, opacity: 1 }),
      blanketD: mm({ color: 0xd8d5c6, roughness: .93, metalness: .02, map: TEX.acoustic, side: T.DoubleSide, transparent: true, opacity: 1 }),
      rail: mm({ color: 0x9ba1a0, roughness: .42, metalness: .72, side: T.DoubleSide, transparent: true, opacity: 1 }),
      foil: mm({ color: 0xcfd3d0, roughness: .3, metalness: .72, side: T.DoubleSide, envMapIntensity: 1.3 }),
      foilC: mm({ color: 0xcfd3d0, roughness: .3, metalness: .72, side: T.DoubleSide, envMapIntensity: 1.3, transparent: true, opacity: 1 })
    };
    // fairing-interior materials are clipped by a mirror of the rocket cut plane
    const mirror = new T.Plane(new T.Vector3(-1, 0, 0), 6.6);
    ['blanket', 'blanketD', 'rail', 'foilC'].forEach(k => { M[k].clippingPlanes = [mirror]; M[k].clipShadows = true; });

    /* ---------------------------------------------------------------------
     * 4 · geometry factory + merging kit
     * -------------------------------------------------------------------*/
    const G = {
      box: (w, h, d) => new T.BoxGeometry(w, h, d),
      cyl: (rt, rb, h, seg, open) => new T.CylinderGeometry(rt, rb, h, seg || 24, 1, !!open),
      sph: (r, ws, hs) => new T.SphereGeometry(r, ws || 16, hs || 10),
      tor: (R, r, seg, tseg) => new T.TorusGeometry(R, r, seg || 8, tseg || 40),
      lathe: (pts, seg) => new T.LatheGeometry(pts.map(p => new T.Vector2(p[0], p[1])), seg || 40),
      disc: (r, seg) => new T.CircleGeometry(r, seg || 24),
      ring(ri, ro, d, seg) {
        const s = new T.Shape(); s.absarc(0, 0, ro, 0, TAU, false);
        const h = new T.Path(); h.absarc(0, 0, ri, 0, TAU, true); s.holes.push(h);
        const g = new T.ExtrudeGeometry(s, { depth: d || .05, bevelEnabled: false, curveSegments: seg || 24 });
        g.rotateX(-PI / 2); g.translate(0, -(d || .05) / 2, 0);
        return g;
      }
    };

    const _m4 = new T.Matrix4(), _q = new T.Quaternion(), _e = new T.Euler(), _v = new T.Vector3(), _sv = new T.Vector3();
    function Kit() { this.bags = Object.create(null); }
    Kit.prototype.add = function (geo, key, o) {
      if (o) {
        _e.set(o.rx || 0, o.ry || 0, o.rz || 0);
        _q.setFromEuler(_e);
        _v.set(o.x || 0, o.y || 0, o.z || 0);
        _sv.set(o.sx === undefined ? 1 : o.sx, o.sy === undefined ? 1 : o.sy, o.sz === undefined ? 1 : o.sz);
        _m4.compose(_v, _q, _sv);
        geo.applyMatrix4(_m4);
      }
      if (this.xform) geo.applyMatrix4(this.xform);
      (this.bags[key] || (this.bags[key] = [])).push(geo);
      return geo;
    };
    Kit.prototype.addM = function (geo, key, m4) {
      geo.applyMatrix4(m4);
      if (this.xform) geo.applyMatrix4(this.xform);
      (this.bags[key] || (this.bags[key] = [])).push(geo);
      return geo;
    };
    Kit.prototype.finish = function (parent, o) {
      o = o || {};
      const keys = Object.keys(this.bags);
      let tris = 0;
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i], list = this.bags[key];
        if (!list || !list.length) continue;
        const merged = U.mergeGeometries(list);
        if (!merged || !merged.attributes || !merged.attributes.position) continue;
        const mat = M[key];
        if (!mat) { console.warn('[payload] missing material for bag', key); continue; }
        const m = new T.Mesh(merged, mat);
        m.name = (parent.name || 'part') + ':' + key;
        m.castShadow = o.cast !== false;
        m.receiveShadow = o.receive !== false;
        parent.add(m);
        tris += merged.attributes.position.count / 3;
        for (let j = 0; j < list.length; j++) list[j] = null;
      }
      this.bags = Object.create(null);
      return tris;
    };

    function rod(k, key, ax, ay, az, bx, by, bz, r, seg) {
      const dx = bx - ax, dy = by - ay, dz = bz - az;
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (len < 1e-4) return;
      const geo = new T.CylinderGeometry(r, r, len, seg || 8, 1, false);
      const dir = _v.set(dx / len, dy / len, dz / len).clone();
      const q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), dir);
      const m = new T.Matrix4().compose(
        new T.Vector3((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2), q, new T.Vector3(1, 1, 1));
      k.addM(geo, key, m);
    }
    // point on a ring: azimuth measured from +X toward +Z
    function az(r, aDeg, y) { const a = aDeg * DEG; return { x: Math.cos(a) * r, y: y, z: Math.sin(a) * r, ry: PI / 2 - a }; }
    // bolt circle (small heads lying on a surface, axis pointing radially out)
    function bolts(k, key, count, radius, y, r, h, azOff) {
      for (let i = 0; i < count; i++) {
        const p = az(radius, (azOff || 0) + i * 360 / count, y);
        k.add(G.cyl(r, r, h, 6), key, { x: p.x, y: p.y, z: p.z, rx: PI / 2, ry: p.ry });
      }
    }
    // polyline cable bundle with rounded joints
    function cable(k, key, pts, r) {
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        rod(k, key, a.x, a.y, a.z, b.x, b.y, b.z, r, 5);
      }
      for (let i = 1; i < pts.length - 1; i++) k.add(G.sph(r * 1.08, 6, 4), key, { x: pts[i].x, y: pts[i].y, z: pts[i].z });
    }

    /* decals -------------------------------------------------------------*/
    function decalMat(tex, opacity) {
      return new T.MeshBasicMaterial({
        map: tex, transparent: true, opacity: opacity === undefined ? .95 : opacity,
        depthWrite: false, side: T.DoubleSide, alphaTest: .02, toneMapped: true,
        polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4
      });
    }
    function clippedDecalMat(tex, opacity) {
      const m = decalMat(tex, opacity);
      m.clippingPlanes = [mirror];
      return m;
    }
    function flatDecal(parent, tex, o) {
      const m = new T.Mesh(new T.PlaneGeometry(o.w, o.h), decalMat(tex, o.opacity));
      m.position.set(o.x || 0, o.y || 0, o.z || 0);
      m.rotation.set(o.rx || 0, o.ry || 0, o.rz || 0);
      m.renderOrder = 3;
      parent.add(m);
      return m;
    }
    // decal laid on a cylinder of radius rx, centred at azimuth azDeg (from +X)
    function surfDecal(parent, tex, o) {
      const R = o.r, seg = 12;
      const geo = new T.PlaneGeometry(o.w, o.h, seg, 1);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), ang = x / R;
        pos.setX(i, R * Math.sin(ang));
        pos.setZ(i, R * Math.cos(ang) - R);
        pos.setY(i, y);
      }
      geo.computeVertexNormals();
      const m = new T.Mesh(geo, decalMat(tex, o.opacity));
      const p = az(R, o.az, o.y);
      m.position.set(p.x, p.y, p.z);
      m.rotation.y = p.ry;
      m.renderOrder = 3;
      parent.add(m);
      return m;
    }
    const txt = (s, o) => U.texText(s, Object.assign({ w: 512, h: 128, size: 88, color: '#e8e4d6', font: U.CJK, weight: '500' }, o || {}));

    /* ---------------------------------------------------------------------
     * 5 · cut-plane mirror + fairing-shell follow
     * -------------------------------------------------------------------*/
    const cutState = { follow: false };
    function onCut(t) {
      const c = APP.cutPlane ? APP.cutPlane.constant : 6.6;
      if (Math.abs(c - 6.6) > 1e-3) {
        cutState.follow = true;
        mirror.copy(APP.cutPlane);
      } else {
        cutState.follow = false;
        mirror.normal.set(-1, 0, 0);
        mirror.constant = 6.6 - 6.6 * t;
      }
    }
    APP.cutables.push(onCut);

    const follow = { host: null, base: 0 };
    function findFairingHost() {
      const mod = APP.modules.rocket;
      if (!mod) return null;
      if (mod.fairing && mod.fairing.isObject3D) return mod.fairing;
      if (mod.fairingGroup && mod.fairingGroup.isObject3D) return mod.fairingGroup;
      if (mod.groups) {
        for (const k in mod.groups) {
          const g = mod.groups[k];
          if (g && g.isObject3D && /fairing/i.test(k)) return g;
        }
      }
      const rg = mod.group;
      if (!rg) return null;
      let best = null, bestN = -1;
      rg.traverse(o => {
        if (o === rg || !o.isObject3D) return;
        const nm = String(o.name || '');
        if (!/fairing/i.test(nm)) return;
        let n = 0; o.traverse(c => { if (c.isMesh) n++; });
        if (n > bestN) { bestN = n; best = o; }
      });
      return best;
    }

    /* =====================================================================
     * 6 · YZ-2 UPPER STAGE EXTERIOR  (44.72 – 49.80)
     * ===================================================================*/
    const kY = new Kit();
    (function yz2() {
      const R = 1.90;

      // ---- bottom separation ring 44.72 – 44.90
      kY.add(G.cyl(R, R, 0.18, 44, true), 'dark', { y: 44.81 });
      kY.add(G.tor(R + .002, .022, 8, 44), 'metal', { y: 44.735, rx: PI / 2 });
      kY.add(G.tor(R + .002, .018, 8, 44), 'metal', { y: 44.885, rx: PI / 2 });
      kY.add(G.cyl(R + .004, R + .004, .05, 44, true), 'gold', { y: 44.81 });
      for (let i = 0; i < 20; i++) {
        const p = az(R - .09, i * 18 + 9, 44.745);
        kY.add(G.box(.065, .05, .065), 'metal', { x: p.x, y: p.y, z: p.z, ry: p.ry });
      }
      for (let i = 0; i < 4; i++) {
        const p = az(R - .40, i * 90 + 45, 44.95);
        kY.add(G.cyl(.05, .05, .17, 12), 'metal', { x: p.x, y: 44.96, z: p.z });
        kY.add(G.cyl(.075, .075, .03, 12), 'dark', { x: p.x, y: 45.05, z: p.z });
      }

      // ---- open engine bay truss 44.90 – 45.55 (2 × YF-50D visible)
      kY.add(G.tor(R - .13, .03, 8, 44), 'dark', { y: 44.94, rx: PI / 2 });
      kY.add(G.tor(R - .13, .03, 8, 44), 'dark', { y: 45.46, rx: PI / 2 });
      for (let i = 0; i < 8; i++) {
        const a = i * 45 + 22.5;
        const p0 = az(R - .14, a, 44.94), p1 = az(R - .06, a, 45.50);
        rod(kY, 'dark', p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, .03, 6);
        if (i % 2 === 0) {
          const p2 = az(R - .30, a + 22.5, 45.48);
          rod(kY, 'dark', p0.x, p0.y, p0.z, p2.x, p2.y, p2.z, .02, 5);
        }
      }
      // thrust plate
      kY.add(G.cyl(R, R, .11, 44), 'dark', { y: 45.575 });
      kY.add(G.ring(.46, R - .03, .05, 40), 'dark', { y: 45.64 });

      // ---- nozzles: 2 × YF-50D exterior bell shells
      const bell = [[.315, 0], [.305, .05], [.278, .12], [.238, .21], [.196, .31], [.156, .41], [.124, .50], [.104, .58], [.10, .64]];
      [-1, 1].forEach(sx => {
        const bx = sx * .62;
        kY.add(G.lathe(bell, 22), 'nozzle', { x: bx, y: 44.80 });
        for (let i = 0; i < 3; i++) {
          const yy = .11 + i * .16, rr = .285 - i * .062;
          kY.add(G.tor(rr + .008, .009, 6, 18), 'metal', { x: bx, y: 44.80 + yy, rx: PI / 2 });
        }
        kY.add(G.cyl(.10, .115, .14, 14), 'dark', { x: bx, y: 45.51 });
        kY.add(G.box(.22, .15, .22), 'metal', { x: bx, y: 45.63 });
        rod(kY, 'metal', bx + sx * .30, 45.60, .21, bx + sx * .36, 45.20, .12, .022, 7);
        rod(kY, 'metal', bx, 45.66, 0, bx * .5, 45.80, .05, .026, 7);
        // small ignition bottle / plumbing
        kY.add(G.sph(.075, 12, 8), 'goldD', { x: bx * 1.45, y: 45.22, z: .22 });
        rod(kY, 'metal', bx * 1.45, 45.22, .22, bx * 1.1, 45.55, .12, .012, 5);
      });

      // ---- main barrel 45.63 – 49.02 (⌀3.8 m, white MLI)
      kY.add(G.cyl(R, R, 3.39, 44), 'paint', { y: 47.325 });
      // circumferential hoop bands + raceways
      [46.10, 47.20, 48.32].forEach(y => {
        kY.add(G.cyl(R + .006, R + .006, .045, 44, true), 'metal', { y: y });
        kY.add(G.tor(R + .008, .012, 6, 44), 'metal', { y: y + .05, rx: PI / 2 });
      });
      [20, 200].forEach(a => {
        const p = az(R + .035, a, 47.30);
        kY.add(G.box(.10, 3.25, .07), 'dark', { x: p.x, y: p.y, z: p.z, ry: p.ry });
        for (let i = 0; i < 6; i++) {
          const q = az(R + .045, a, 45.95 + i * .52);
          kY.add(G.box(.14, .035, .075), 'metal', { x: q.x, y: q.y, z: q.z, ry: q.ry });
        }
      });
      // access panels + gold MLI patches
      [[60, 46.55], [130, 47.75], [250, 46.30], [305, 48.00]].forEach(([a, y]) => {
        const p = az(R + .012, a, y);
        kY.add(G.box(.52, .70, .022), 'dark', { x: p.x, y: p.y, z: p.z, ry: p.ry });
        const p2 = az(R + .024, a, y);
        kY.add(G.box(.44, .60, .02), 'paint', { x: p2.x, y: p2.y, z: p2.z, ry: p2.ry });
        for (let i = 0; i < 4; i++) {
          const pa = az(R + .026, a, y - .30 + (i > 1 ? .60 : 0));
          const off = (i % 2) ? .19 : -.19;
          kY.add(G.box(.04, .04, .014), 'metal', { x: pa.x + Math.cos(a * DEG + PI / 2) * off, y: pa.y, z: pa.z + Math.sin(a * DEG + PI / 2) * off, ry: pa.ry });
        }
      });
      [[120, 46.85, .46, .82], [205, 47.55, .52, .72], [300, 46.45, .40, .62]].forEach(([a, y, w, h]) => {
        const p = az(R + .022, a, y);
        kY.add(G.box(w, h, .026), 'gold', { x: p.x, y: p.y, z: p.z, ry: p.ry });
        const q = az(R + .034, a, y);
        kY.add(G.box(w * .82, .012, .012), 'goldD', { x: q.x, y: q.y, z: q.z, ry: q.ry });
      });
      // RCS clusters
      [55, 235].forEach(a => {
        const p = az(R + .07, a, 48.62);
        kY.add(G.box(.17, .16, .22), 'dark', { x: p.x, y: p.y, z: p.z, ry: p.ry });
        for (let i = 0; i < 4; i++) {
          const q = az(R + .16, a + (i - 1.5) * 7, 48.62 + (i % 2 ? .07 : -.07));
          kY.add(G.cyl(.012, .026, .05, 8), 'metal', { x: q.x, y: q.y, z: q.z, rx: PI / 2 - .5, ry: q.ry });
        }
      });
      // recessed vent / pressure-relief panels
      [100, 290].forEach(a => {
        const p0 = az(R + .014, a, 48.28);
        kY.add(G.box(.46, .52, .03), 'dark', { x: p0.x, y: p0.y, z: p0.z, ry: p0.ry });
        for (let i = 0; i < 5; i++) {
          const p = az(R + .030, a, 48.10 + i * .09);
          kY.add(G.box(.36, .034, .02), 'dark', { x: p.x, y: p.y, z: p.z, ry: p.ry });
        }
      });
      // red alignment stripe + avionics boxes
      kY.add(G.cyl(R + .006, R + .006, .055, 44, true), 'red', { y: 49.06 });
      [[0, 48.05], [90, 47.35]].forEach(([a, y]) => {
        const p = az(R + .03, a, y);
        kY.add(G.box(.34, .26, .10), 'goldD', { x: p.x, y: p.y, z: p.z, ry: p.ry });
      });

      // ---- forward skirt + attachment ring 49.02 – 49.80
      kY.add(G.cyl(1.87, R, .60, 44), 'goldD', { y: 49.33 });
      kY.add(G.cyl(1.845, 1.845, .20, 44, true), 'dark', { y: 49.72 });
      kY.add(G.tor(1.86, .018, 8, 44), 'metal', { y: 49.63, rx: PI / 2 });
      for (let i = 0; i < 16; i++) {
        const p = az(1.80, i * 22.5 + 11, 49.64);
        kY.add(G.box(.06, .05, .06), 'metal', { x: p.x, y: p.y, z: p.z, ry: p.ry });
      }
      for (let i = 0; i < 4; i++) {
        const p = az(1.55, i * 90 + 45, 49.72);
        kY.add(G.cyl(.045, .045, .15, 12), 'metal', { x: p.x, y: 49.79, z: p.z });
      }
      // vertical conduit to adapter
      const c0 = az(1.60, 135, 49.30), c1 = az(1.42, 135, 50.62);
      rod(kY, 'dark', c0.x, c0.y, c0.z, c1.x, c1.y, c1.z, .035, 8);

      // ---- marking decals
      surfDecal(gY, txt('YZ-2', { color: '#5f6662', size: 100 }), { r: R + .012, az: 56, y: 46.28, w: .95, h: .28 });
      surfDecal(gY, U.texText('远征二号', { w: 256, h: 512, size: 74, color: '#5f6662', vertical: true, font: U.CJK }), { r: R + .012, az: 27, y: 47.45, w: .36, h: 1.45 });
      surfDecal(gY, TEX.hazard, { r: 1.872, az: 150, y: 49.28, w: .40, h: .20 });
    })();
    let trisY = kY.finish(gY);

    /* =====================================================================
     * 7 · PAYLOAD ADAPTER  (49.80 – 50.60) — open truss so the descent
     *     engine reads through it. Stays with YZ-2 (spacecraft separates).
     * ===================================================================*/
    (function adapter() {
      const k = kY; // keep adapter in the yz2 group/bags
      k.add(G.ring(1.30, 1.80, .16, 40), 'dark', { y: 49.86 });
      k.add(G.tor(1.79, .02, 8, 40), 'metal', { y: 49.95, rx: PI / 2 });
      k.add(G.ring(1.52, 1.70, .07, 40), 'gold', { y: 49.80 });
      // top interface ring (the spacecraft separates from here)
      k.add(G.ring(1.06, 1.32, .12, 36), 'dark', { y: 50.56 });
      k.add(G.tor(1.31, .018, 8, 36), 'metal', { y: 50.62, rx: PI / 2 });
      // mid ring of the open truss
      k.add(G.ring(1.35, 1.47, .055, 36), 'dark', { y: 50.28 });
      // 8 tapered struts: base ring → mid ring → top ring
      for (let i = 0; i < 8; i++) {
        const a = i * 45;
        const p0 = az(1.60, a, 49.94), p1 = az(1.44, a, 50.28), p2 = az(1.17, a, 50.58);
        rod(k, 'metal', p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, .052, 9);
        rod(k, 'metal', p1.x, p1.y, p1.z, p2.x, p2.y, p2.z, .044, 9);
        if (i % 2 === 0) {
          const q0 = az(1.60, a + 45, 49.94), q1 = az(1.44, a, 50.28);
          rod(k, 'metal', q0.x, q0.y, q0.z, q1.x, q1.y, q1.z, .020, 7);
        }
        // gold MLI gusset panels between struts
        const mid = az(1.47, a + 22.5, 50.12);
        k.add(G.box(.26, .30, .022), 'gold', { x: mid.x, y: mid.y, z: mid.z, ry: mid.ry, rz: .30 });
      }
      // separation pyro blocks on the top ring
      for (let i = 0; i < 8; i++) {
        const p = az(1.20, i * 45 + 22.5, 50.62);
        k.add(G.box(.10, .08, .10), 'metal', { x: p.x, y: p.y, z: p.z, ry: p.ry });
        k.add(G.cyl(.026, .026, .08, 8), 'red', { x: p.x, y: 50.68, z: p.z });
      }
      // avionics / connector blocks sitting on the base ring
      for (let i = 0; i < 4; i++) {
        const p = az(1.52, i * 90 + 30, 50.00);
        k.add(G.box(.24, .16, .15), 'dark', { x: p.x, y: p.y, z: p.z, ry: p.ry });
        k.add(G.box(.08, .06, .09), 'dark', { x: p.x, y: 50.09, z: p.z, ry: p.ry });
      }
      // cable bundle from YZ-2 ring up one strut
      const pts = [az(1.66, 90, 49.92), az(1.50, 88, 50.20), az(1.30, 86, 50.55), az(1.18, 84, 50.70)];
      for (let i = 0; i < pts.length - 1; i++) rod(k, 'dark', pts[i].x, pts[i].y, pts[i].z, pts[i + 1].x, pts[i + 1].y, pts[i + 1].z, .022, 6);
      // red "remove before flight" streamer
      k.add(G.box(.035, .34, .012), 'red', { x: -1.02, y: 50.30, z: .92, rz: .35 });
      k.add(G.cyl(.02, .02, .10, 8), 'metal', { x: -1.03, y: 50.48, z: .93 });
    })();
    /* --- YZ-2 microdetail: harnesses, kapton tape, valves, hatches, fasteners --- */
    (function yz2Detail() {
      const k = kY, R = 1.90;
      // main cable harness bundles with clamp blocks (visible quadrant)
      [[66, .034, 9], [102, .026, 7]].forEach(([a, rr, n]) => {
        const pts = [];
        for (let i = 0; i <= n; i++) pts.push(az(R + .050, a + Math.sin(i * 1.7) * 1.5, 45.80 + i * (3.15 / n)));
        cable(k, 'dark', pts, rr);
        for (let i = 1; i < pts.length - 1; i += 2) {
          const p = az(R + .032, a, pts[i].y);
          k.add(G.box(.13, .05, .05), 'metal', { x: p.x, y: p.y, z: p.z, ry: p.ry });
        }
      });
      // kapton tape patches on seams
      [[52, 47.85, .46, .10], [78, 48.55, .30, .08], [96, 46.35, .52, .07], [122, 47.20, .34, .09]].forEach(([a, y, len, wid]) => {
        const p = az(R + .024, a, y);
        k.add(G.box(wid, len, .014), 'amber', { x: p.x, y: p.y, z: p.z, ry: p.ry, rz: .18 });
      });
      // fill / drain valves with red safety tags
      [[62, 45.95], [112, 48.85], [88, 49.32]].forEach(([a, y]) => {
        const dir = a * DEG;
        const p = az(R + .07, a, y);
        k.add(G.cyl(.065, .065, .13, 12), 'metal', { x: p.x, y: p.y, z: p.z, rz: PI / 2, ry: p.ry });
        k.add(G.cyl(.085, .085, .03, 12), 'dark', { x: p.x + Math.cos(dir) * .075, y: p.y, z: p.z + Math.sin(dir) * .075, rz: PI / 2, ry: p.ry });
        const q = az(R + .15, a, y - .12);
        k.add(G.box(.028, .20, .012), 'red', { x: q.x, y: q.y, z: q.z, ry: q.ry, rz: .5 });
      });
      // secondary service hatches with hinges & latches
      [[70, 46.75], [98, 47.65], [132, 46.35]].forEach(([a, y]) => {
        const p = az(R + .014, a, y);
        k.add(G.box(.42, .56, .02), 'dark', { x: p.x, y: p.y, z: p.z, ry: p.ry });
        const p2 = az(R + .028, a, y);
        k.add(G.box(.34, .46, .016), 'paint', { x: p2.x, y: p2.y, z: p2.z, ry: p2.ry });
        const hp = az(R + .03, a, y + .25);
        k.add(G.cyl(.013, .013, .30, 6), 'metal', { x: hp.x, y: hp.y, z: hp.z, rz: PI / 2, ry: hp.ry });
        const lp = az(R + .03, a, y - .19);
        k.add(G.box(.07, .09, .028), 'amber', { x: lp.x, y: lp.y, z: lp.z, ry: lp.ry });
      });
      // fastener rows on the hoop bands + all around the barrel joints
      [45.60, 46.10, 47.20, 48.32, 49.00].forEach(y => bolts(k, 'metal', 26, R + .016, y + .02, .013, .028, 4));
      bolts(k, 'metal', 30, 1.88, 44.90, .014, .026, 5);
      bolts(k, 'metal', 18, 1.845, 49.60, .013, .026, 10);
      // S-band antenna + base + whip
      const ap = az(R + .05, 84, 48.72);
      k.add(G.box(.16, .11, .13), 'dark', { x: ap.x, y: ap.y, z: ap.z, ry: ap.ry });
      k.add(G.cyl(.03, .03, .10, 8), 'metal', { x: ap.x, y: ap.y + .10, z: ap.z });
      k.add(G.cyl(.02, .02, .28, 6), 'metal', { x: ap.x, y: ap.y + .28, z: ap.z });
      rod(k, 'metal', ap.x, ap.y + .02, ap.z, ap.x + .17, ap.y + .44, ap.z + .10, .009, 4);
      // umbilical connector plate + harness toward the adapter
      const up = az(1.86, 56, 49.58);
      k.add(G.box(.24, .28, .11), 'metal', { x: up.x, y: up.y, z: up.z, ry: up.ry });
      k.add(G.box(.15, .17, .06), 'dark', { x: up.x, y: up.y, z: up.z, ry: up.ry });
      cable(k, 'dark', [az(1.90, 56, 49.46), az(1.80, 56, 49.18), az(1.72, 57, 48.86)], .018);
      // gold foil strips near the aft skirt
      [[36, 45.70, .50], [72, 45.90, .40], [108, 45.60, .55]].forEach(([a, y, w]) => {
        const p = az(R + .02, a, y);
        k.add(G.box(w, .17, .016), 'gold', { x: p.x, y: p.y, z: p.z, ry: p.ry, rz: .10 });
      });
      // two small attitude nozzles near the fore skirt
      [[128, 49.18], [144, 49.18]].forEach(([a, y]) => {
        const p = az(1.80, a, y);
        k.add(G.cyl(.045, .022, .07, 10), 'nozzle', { x: p.x, y: p.y, z: p.z, rx: -PI / 2 + .2, ry: p.ry });
        const q = az(1.80, a, y + .07);
        k.add(G.box(.08, .07, .08), 'dark', { x: q.x, y: q.y, z: q.z, ry: q.ry });
      });
      // additional gold MLI wrap panels on the visible quadrant
      [[14, 46.9, .62, 1.25], [41, 48.05, .50, .85]].forEach(([a, y, w, h]) => {
        const p = az(R + .018, a, y);
        k.add(G.box(w, h, .020), 'gold', { x: p.x, y: p.y, z: p.z, ry: p.ry });
        const q = az(R + .032, a, y);
        k.add(G.box(w * .8, .012, .012), 'goldD', { x: q.x, y: q.y, z: q.z, ry: q.ry });
      });
      const fp2 = az(R + .016, 92, 47.2);
      k.add(G.box(.46, .62, .018), 'foil', { x: fp2.x, y: fp2.y, z: fp2.z, ry: fp2.ry });
      // inspection stencil, far quadrant
      surfDecal(gY, U.texText('中国航天', { w: 128, h: 512, size: 64, color: '#5f6662', vertical: true, font: U.CJK }), { r: R + .012, az: 118, y: 47.0, w: .22, h: 1.10 });
    })();
    trisY += kY.finish(gY);

    /* =====================================================================
     * 8 · LANDER  (engine 50.33 → 51.02 · frame 51.02 → 51.25 ·
     *              body 51.25 → 52.55 · deck → 53.24)
     * ===================================================================*/
    const kL = new Kit();
    const LANDER = { bot: 51.25, top: 52.55, A: 1.245 };
    (function lander() {
      const k = kL;
      const A = LANDER.A, AP = A * Math.cos(PI / 8); // 1.15
      const bot = LANDER.bot, top = LANDER.top, H = top - bot;

      // ---- descent engine bell (7500 N class, 科普示意)
      const bell = [[.46, 0], [.445, .06], [.405, .14], [.355, .24], [.30, .35], [.245, .46], [.195, .56], [.155, .64], [.14, .70]];
      k.add(G.lathe(bell, 26), 'nozzle', { y: 50.33 });
      k.add(G.tor(.34, .012, 6, 24), 'copper', { y: 50.33 + .27, rx: PI / 2 });
      k.add(G.tor(.24, .011, 6, 24), 'copper', { y: 50.33 + .47, rx: PI / 2 });
      k.add(G.cyl(.14, .15, .10, 16), 'dark', { y: 51.06 });
      // engine heat shield + gimbal + actuators
      k.add(G.ring(.17, .63, .05, 34), 'dark', { y: 51.00 });
      k.add(G.cyl(.20, .20, .10, 16), 'metal', { y: 51.10 });
      for (let i = 0; i < 4; i++) {
        const a = i * 90 + 45;
        const p = az(.46, a, 51.04), q = az(.30, a, 50.62);
        rod(k, 'metal', p.x, p.y, p.z, q.x, q.y, q.z, .022, 7);
      }
      // feed lines into the frame
      for (let i = 0; i < 2; i++) {
        const s = i ? -1 : 1;
        rod(k, 'metal', s * .62, 51.05, .30, s * .42, 50.60, .16, .03, 7);
      }

      // ---- lower frame 51.02 – 51.25
      k.add(G.cyl(A + .03, A - .01, .23, 8), 'dark', { y: 51.135, ry: PI / 8 });
      k.add(G.cyl(A + .05, A + .05, .05, 8), 'metal', { y: 51.04, ry: PI / 8 });
      for (let i = 0; i < 8; i++) {
        const p = az(A - .02, i * 45 + 22.5, 51.135);
        k.add(G.box(.10, .23, .10), 'metal', { x: p.x, y: p.y, z: p.z, ry: p.ry });
      }
      // ---- payload launch frame / lower collar 50.60 – 51.02 (mates with adapter)
      k.add(G.ring(1.06, 1.22, .085, 30), 'metal', { y: 50.68 });
      k.add(G.cyl(1.245, 1.245, .05, 30, true), 'dark', { y: 50.76 });
      for (let i = 0; i < 4; i++) {
        const a = i * 90 + 45;
        const p0 = az(1.18, a, 50.70), p1 = az(1.08, a, 51.04);
        rod(k, 'metal', p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, .05, 9);
      }
      for (let i = 0; i < 4; i++) {
        const p = az(1.16, i * 90 + 45, 50.66);
        k.add(G.cyl(.055, .055, .09, 10), 'metal', { x: p.x, y: p.y, z: p.z });
      }
      // hold-down fittings
      for (let i = 0; i < 4; i++) {
        const p = az(A + .02, i * 90 + 45, 51.12);
        k.add(G.box(.16, .12, .16), 'metal', { x: p.x, y: p.y, z: p.z, ry: p.ry });
      }
      // RCS thruster clusters on the lower frame
      for (let i = 0; i < 4; i++) {
        const a = i * 90;
        const p = az(A + .05, a, 51.10);
        k.add(G.box(.18, .14, .12), 'dark', { x: p.x, y: p.y, z: p.z, ry: p.ry });
        for (let j = 0; j < 2; j++) {
          const q = az(A + .14, a + (j ? 8 : -8), 51.08 + (j ? -.04 : .04));
          k.add(G.cyl(.02, .045, .08, 10), 'metal', { x: q.x, y: q.y, z: q.z, rz: PI / 2, ry: q.ry });
        }
      }
      // hazard-avoidance cameras + radar panels under the frame
      [30, 150, 270].forEach(a => {
        const p = az(.95, a, 50.99);
        k.add(G.box(.15, .10, .13), 'dark', { x: p.x, y: p.y, z: p.z, ry: p.ry });
        const q = az(.95, a, 50.925);
        k.add(G.cyl(.045, .045, .02, 12), 'lens', { x: q.x, y: q.y, z: q.z });
      });
      [[90, .62], [270, .62]].forEach(([a, r]) => {
        const p = az(r, a, 50.985);
        k.add(G.box(.30, .035, .30), 'rad', { x: p.x, y: p.y, z: p.z, ry: p.ry });
      });

      // ---- main body 51.25 – 52.55 (octagonal, ⌀2.3 m across flats)
      k.add(G.cyl(A, A, H, 8), 'paint', { y: (bot + top) / 2, ry: PI / 8 });
      // gold MLI panels on the four cardinal flats
      [0, 90, 180, 270].forEach(a => {
        const p = az(AP + .012, a, (bot + top) / 2 + .03);
        k.add(G.box(.86, H - .16, .035), 'gold', { x: p.x, y: p.y, z: p.z, ry: p.ry });
        // quilt lacing
        for (let i = 0; i < 3; i++) {
          const q = az(AP + .032, a, bot + .30 + i * .34);
          k.add(G.box(.70, .016, .012), 'goldD', { x: q.x, y: q.y, z: q.z, ry: q.ry });
        }
      });
      // white MLI on the four diagonal flats, with seams
      [45, 135, 225, 315].forEach(a => {
        const p = az(AP * Math.cos(PI / 8) + .005, a, (bot + top) / 2);
        k.add(G.box(.72, H - .22, .026), 'paint', { x: p.x, y: p.y, z: p.z, ry: p.ry });
      });
      // corner posts
      for (let i = 0; i < 8; i++) {
        const a = i * 45 + 22.5;
        const p = az(A - .015, a, (bot + top) / 2);
        k.add(G.box(.085, H - .06, .085), 'metal', { x: p.x, y: p.y, z: p.z, ry: PI / 2 - a * DEG });
      }
      // waist bands
      [51.62, 52.16].forEach(y => {
        k.add(G.cyl(AP + .035, AP + .035, .035, 8, true), 'dark', { y: y, ry: PI / 8 });
      });
      // top deck rim + floor
      k.add(G.cyl(A + .055, A + .055, .06, 8), 'metal', { y: 52.585, ry: PI / 8 });
      k.add(G.cyl(A + .02, A + .02, .05, 8), 'rad', { y: 52.645, ry: PI / 8 });
      k.add(G.ring(.60, A + .01, .07, 34), 'dark', { y: 52.70 });
      // deck stiffeners
      for (let i = 0; i < 8; i++) {
        const p = az(.80, i * 45, 52.665);
        k.add(G.box(.38, .05, .09), 'metal', { x: p.x, y: p.y, z: p.z, ry: PI / 2 - i * 45 * DEG });
      }

      // ---- folded landing legs (4, at the cardinal flats)
      [[45], [135], [225], [315]].forEach(([a]) => {
        const hip = az(1.06, a, 51.34);
        // hip bracket + hinge pin
        k.add(G.box(.22, .18, .20), 'metal', { x: hip.x, y: 51.32, z: hip.z, ry: hip.ry });
        const t = a * DEG + PI / 2;
        const hp = az(1.06, a, 51.36);
        rod(k, 'metal', hp.x - Math.cos(t) * .11, hp.y, hp.z - Math.sin(t) * .11,
          hp.x + Math.cos(t) * .10, hp.y, hp.z + Math.sin(t) * .10, .055, 10);
        // main strut (folded: nearly vertical along the body)
        const fp = az(1.34, a, 52.80);
        rod(k, 'metal', hip.x, 51.38, hip.z, fp.x, fp.y, fp.z, .044, 12);
        // secondary strut
        const sp = az(1.20, a, 52.24);
        rod(k, 'metal', hip.x, 51.31, hip.z, sp.x, sp.y, sp.z, .026, 8);
        // knee joint
        k.add(G.sph(.062, 10, 8), 'metal', { x: hp.x, y: 51.38, z: hp.z });
        // foot pad (stowed, facing up/out)
        k.add(G.cyl(.16, .145, .05, 20), 'metal', { x: fp.x, y: fp.y + .03, z: fp.z });
        k.add(G.cyl(.16, .175, .03, 20), 'dark', { x: fp.x, y: fp.y + .005, z: fp.z });
        for (let i = 0; i < 3; i++) {
          const aa = a * DEG + i * TAU / 3;
          rod(k, 'metal', fp.x, fp.y + .01, fp.z,
            fp.x + Math.cos(aa) * .15, fp.y - .06, fp.z + Math.sin(aa) * .15, .014, 6);
        }
        // red stow mark
        const rp = az(1.30, a, 52.62);
        k.add(G.box(.06, .12, .02), 'red', { x: rp.x, y: rp.y, z: rp.z, ry: rp.ry });
      });

      // ---- deck equipment above 52.70
      // central avionics / equipment cylinder
      k.add(G.cyl(.40, .43, .34, 20), 'paint', { y: 52.90 });
      k.add(G.cyl(.44, .44, .045, 20, true), 'goldD', { y: 53.05 });
      k.add(G.sph(.40, 20, 10), 'rad', { y: 53.09, sy: .42 });
      k.add(G.cyl(.06, .06, .10, 10), 'metal', { y: 53.24 });
      // spherical propellant / pressurant tanks
      [[-1, .60], [1, -.60]].forEach(([sx, sz]) => {
        k.add(G.sph(.23, 18, 12), 'gold', { x: sx * .60, y: 52.90, z: sz });
        k.add(G.tor(.232, .012, 6, 20), 'metal', { x: sx * .60, y: 52.90, z: sz, rx: PI / 2 });
        k.add(G.cyl(.055, .055, .05, 10), 'metal', { x: sx * .60, y: 53.115, z: sz });
        rod(k, 'metal', sx * .60, 52.78, sz, sx * .40, 52.73, sz * .4, .020, 6);
      });
      // instrument package + hazard camera on deck
      k.add(G.box(.44, .19, .34), 'dark', { x: .55, y: 52.80, z: .52 });
      k.add(G.cyl(.05, .05, .02, 12), 'lens', { x: .55, y: 52.83, z: .70 });
      k.add(G.box(.17, .13, .15), 'dark', { x: -.02, y: 52.77, z: .64 });
      k.add(G.cyl(.04, .04, .02, 10), 'lens', { x: -.02, y: 52.79, z: .725 });
      // ground-penetrating radar electronics + radiator
      k.add(G.box(.46, .06, .30), 'rad', { x: -.55, y: 52.76, z: .46 });
      k.add(G.box(.30, .12, .22), 'goldD', { x: -.52, y: 52.82, z: .18 });
      // small relay dish on a short mast
      k.add(G.cyl(.03, .035, .22, 8), 'metal', { x: -.42, y: 52.82, z: -.48 });
      k.add(G.cyl(.20, .04, .10, 18), 'rad', { x: -.42, y: 52.99, z: -.48, rx: -.45 });
      // whip antennas
      rod(k, 'metal', .85, 52.72, -.80, .99, 53.16, -.92, .011, 5);
      rod(k, 'metal', -.85, 52.72, .78, -.98, 53.14, .90, .011, 5);
      // sun sensors
      [[.30, .80], [-.72, -.70]].forEach(([sx, sz]) => {
        k.add(G.box(.09, .05, .09), 'dark', { x: sx, y: 52.75, z: sz });
        k.add(G.box(.05, .02, .05), 'rad', { x: sx, y: 52.785, z: sz, rx: .3 });
      });
      // interface ring to the orbiter + separation springs
      k.add(G.ring(.84, 1.00, .10, 30), 'metal', { y: 53.17 });
      for (let i = 0; i < 4; i++) {
        const p = az(.93, i * 90 + 45, 53.19);
        k.add(G.cyl(.035, .035, .09, 8), 'metal', { x: p.x, y: 53.19, z: p.z });
      }
      for (let i = 0; i < 4; i++) {
        const p = az(.90, i * 90, 53.14);
        k.add(G.box(.10, .08, .10), 'dark', { x: p.x, y: p.y, z: p.z, ry: PI / 2 - i * 90 * DEG });
      }
      // deck cabling
      const cab = [az(.95, 30, 52.73), az(.80, 60, 52.90), az(.65, 120, 52.86), az(.55, 170, 52.76)];
      for (let i = 0; i < cab.length - 1; i++) rod(k, 'dark', cab[i].x, cab[i].y, cab[i].z, cab[i + 1].x, cab[i + 1].y, cab[i + 1].z, .014, 5);

      // ---- rover launch cradle on the +Z flat (rover itself lives in gR)
      k.add(G.box(1.02, .05, .86), 'dark', { x: 0, y: 51.44, z: 1.60 });
      k.add(G.box(.88, .40, .06), 'dark', { x: 0, y: 51.66, z: 1.20 });
      [[-1], [1]].forEach(([sx]) => {
        k.add(G.box(.06, .10, .84), 'dark', { x: sx * .56, y: 51.50, z: 1.60 });
        k.add(G.box(.10, .16, .10), 'metal', { x: sx * .56, y: 51.44, z: 1.26 });
        k.add(G.box(.10, .16, .10), 'metal', { x: sx * .56, y: 51.44, z: 1.94 });
      });
      // cradle rollers
      for (let i = 0; i < 4; i++) {
        k.add(G.cyl(.045, .045, .16, 10), 'metal', { x: (i % 2 ? .34 : -.34), y: 51.49, z: 1.30 + (i < 2 ? 0 : .60), rz: PI / 2 });
      }
      // tie-down clamps over the stowed rover
      [1.38, 1.84].forEach(z => {
        k.add(G.box(.30, .035, .06), 'metal', { x: 0, y: 52.055, z: z });
        k.add(G.box(.045, .12, .045), 'metal', { x: .15, y: 51.995, z: z });
        k.add(G.box(.045, .12, .045), 'metal', { x: -.15, y: 51.995, z: z });
        k.add(G.cyl(.028, .028, .05, 8), 'red', { x: .0, y: 52.078, z: z });
      });
      // cradle umbilical
      rod(k, 'dark', .0, 51.47, 1.16, .22, 51.66, 1.26, .016, 5);

      // ---- hopper docking bracket on the −Z flat (its dock faces +Z)
      k.add(G.box(.96, .90, .08), 'dark', { x: HOP.x, y: 52.66, z: -(AP + .03) });
      [[52.30], [53.02]].forEach(([y]) => {
        k.add(G.box(.16, .10, .10), 'metal', { x: HOP.x - .40, y: y, z: -(AP + .10) });
        k.add(G.box(.16, .10, .10), 'metal', { x: HOP.x + .40, y: y, z: -(AP + .10) });
      });
      k.add(G.cyl(.07, .07, .10, 12), 'metal', { x: HOP.x, y: 52.66, z: -(AP + .10) });
      k.add(G.box(.12, .16, .12), 'red', { x: HOP.x + .44, y: 52.36, z: -(AP + .10) });
      // docking guide pins
      for (let i = 0; i < 4; i++) {
        k.add(G.cyl(.026, .026, .10, 8), 'metal', {
          x: HOP.x - .40 + (i % 2 ? .80 : 0), y: 52.30 + (i > 1 ? .72 : 0), z: -(AP + .14), rx: PI / 2
        });
      }
      // small national flag + mission markings on the +X flat (gold panel)
      flatDecal(gL, TEX.flag, { w: .40, h: .27, x: AP + .035, y: 52.30, z: -.20, ry: PI / 2 });
      flatDecal(gL, txt('嫦娥七号', { color: '#26261f', size: 96 }), { w: .62, h: .16, x: AP + .035, y: 51.94, z: .04, ry: PI / 2 });
      flatDecal(gL, txt('中国探月', { color: '#c0392b', size: 84 }), { w: .34, h: .13, x: .52, y: 52.42, z: AP + .028, ry: 0 });
      // instrument / warning stencils
      flatDecal(gL, TEX.hazard, { w: .30, h: .16, x: AP + .035, y: 51.44, z: .34, ry: PI / 2, opacity: .9 });
      flatDecal(gL, txt('110N · 变推力', { color: '#d8d3c2', size: 60 }), { w: .34, h: .08, x: AP + .035, y: 51.62, z: -.34, ry: PI / 2, opacity: .8 });
    })();
    /* --- lander microdetail: blankets, plumbing, optics, leg & deck hardware --- */
    (function landerDetail() {
      const k = kL;
      const AP = LANDER.A * Math.cos(PI / 8);
      // MLI quilt seams + lacing eyelets on the diagonal white panels
      [45, 135, 225, 315].forEach(a => {
        const p = az(AP + .014, a, 51.92);
        k.add(G.box(.70, .012, .012), 'paint', { x: p.x, y: p.y, z: p.z, ry: p.ry });
        const p2 = az(AP + .014, a, 52.28);
        k.add(G.box(.70, .010, .010), 'amber', { x: p2.x, y: p2.y, z: p2.z, ry: p2.ry });
        for (let i = 0; i < 4; i++) {
          const q = az(AP + .02, a - 12 + i * 8, 51.52 + (i % 2) * .58);
          k.add(G.sph(.012, 5, 4), 'goldD', { x: q.x, y: q.y, z: q.z });
        }
      });
      // propellant / pressurant lines running down the body to the frame
      [[10, .034], [26, .026]].forEach(([a, r]) => {
        cable(k, 'metal', [az(AP + .085, a, 52.44), az(AP + .10, a, 52.00), az(AP + .085, a, 51.52), az(AP + .05, a, 51.12)], r);
        for (let i = 0; i < 3; i++) {
          const q = az(AP + .058, a, 51.24 + i * .44);
          k.add(G.box(.055, .035, .05), 'metal', { x: q.x, y: q.y, z: q.z, ry: q.ry });
        }
      });
      // deck: radiometer, laser reflector, power box, UHF mast, whips
      k.add(G.box(.24, .14, .20), 'dark', { x: .16, y: 52.82, z: -.62 });
      k.add(G.cyl(.048, .048, .03, 12), 'lens', { x: .16, y: 52.905, z: -.62 });
      k.add(G.box(.18, .10, .14), 'goldD', { x: -.24, y: 52.79, z: .44 });
      k.add(G.box(.30, .05, .22), 'rad', { x: .74, y: 52.765, z: -.18 });
      k.add(G.box(.30, .03, .22), 'metal', { x: .74, y: 52.79, z: -.18 });
      k.add(G.cyl(.028, .038, .16, 8), 'metal', { x: -.22, y: 52.80, z: -.60 });
      k.add(G.cyl(.085, .02, .10, 12), 'rad', { x: -.22, y: 52.94, z: -.60, rx: -.55 });
      rod(k, 'metal', .62, 52.78, .60, .70, 53.10, .70, .008, 4);
      rod(k, 'metal', -.66, 52.78, -.24, -.74, 53.06, -.32, .008, 4);
      // cable runs: deck → rover cradle and deck → hopper bracket
      cable(k, 'dark', [az(.95, 30, 52.70), az(1.02, 55, 52.42), az(1.06, 70, 52.06), az(1.02, 85, 51.82)], .013);
      cable(k, 'dark', [az(1.00, 190, 52.60), az(1.04, 204, 52.48), az(1.10, 208, 52.34)], .011);
      // folded-leg hardware: hip actuator, tie-down clamp, footpad bolts
      [45, 135, 225, 315].forEach(a => {
        const hp = az(1.06, a, 51.44);
        k.add(G.cyl(.042, .042, .17, 8), 'metal', { x: hp.x, y: hp.y, z: hp.z, rz: PI / 2, ry: hp.ry });
        const fp = az(1.34, a, 52.80);
        for (let i = 0; i < 6; i++) {
          const b = az(.0, 0, 0);
          const aa = a * DEG + i * TAU / 6;
          k.add(G.cyl(.012, .012, .026, 5), 'metal', {
            x: fp.x + Math.cos(aa) * .10, y: fp.y + .06, z: fp.z + Math.sin(aa) * .10
          });
        }
        const tp = az(1.30, a, 52.62);
        k.add(G.box(.05, .14, .02), 'amber', { x: tp.x, y: tp.y, z: tp.z, ry: tp.ry });
      });
      // extra hazard-avoidance cameras with hoods (visible quadrant)
      [[0, .98], [60, .98]].forEach(([a, r]) => {
        const p = az(r, a, 50.99);
        k.add(G.box(.16, .11, .15), 'dark', { x: p.x, y: p.y, z: p.z, ry: p.ry });
        k.add(G.cyl(.05, .05, .03, 12), 'lens', { x: p.x, y: p.y - .06, z: p.z });
        k.add(G.box(.18, .03, .09), 'metal', { x: p.x, y: p.y + .06, z: p.z, ry: p.ry });
        k.add(G.box(.10, .03, .025), 'goldD', { x: p.x, y: p.y - .02, z: p.z, ry: p.ry });
      });
      // hold-down clamps + separation connectors on the lower frame
      [0, 90, 180, 270].forEach(a => {
        const p = az(LANDER.A + .06, a, 51.12);
        k.add(G.box(.10, .16, .12), 'metal', { x: p.x, y: p.y, z: p.z, ry: p.ry });
        k.add(G.cyl(.03, .03, .07, 8), 'red', { x: p.x, y: p.y - .10, z: p.z });
      });
      // radiator patch + stencil on a white diagonal flat
      const rp = az(AP + .02, 135, 52.05);
      k.add(G.box(.34, .44, .022), 'rad', { x: rp.x, y: rp.y, z: rp.z, ry: rp.ry });
      for (let i = 0; i < 4; i++) {
        const q = az(AP + .034, 135, 51.88 + i * .11);
        k.add(G.box(.30, .012, .012), 'dark', { x: q.x, y: q.y, z: q.z, ry: q.ry });
      }
      // docking plate connectors facing the hopper
      const dp = az(AP + .10, 180, 52.66);
      k.add(G.cyl(.06, .06, .08, 10), 'metal', { x: dp.x, y: dp.y, z: dp.z, rz: PI / 2 });
      k.add(G.box(.12, .10, .18), 'amber', { x: dp.x, y: 52.50, z: .10, ry: 0 });
      cable(k, 'dark', [az(AP + .06, 175, 52.30), az(AP + .16, 178, 52.44)], .012);
      // small stencil plate
      flatDecal(gL, txt('LND-07', { color: '#3a3d38', size: 64 }), { w: .26, h: .07, x: -(AP + .04), y: 51.40, z: -.30, ry: -PI / 2, opacity: .8 });
    })();
    const trisL = kL.finish(gL);

    /* =====================================================================
     * 9 · ORBITER  (bus 53.30 – 54.85, folded wings, HGA → ≈55.55)
     * ===================================================================*/
    const kO = new Kit();
    (function orbiter() {
      const k = kO;
      const cy = 54.075, bx = 1.05, by = .775, bz = 1.15;

      // ---- bus (chamfered box)
      k.add(U.roundedBox(2.10, 1.55, 2.30, .10, 3), 'paint', { y: cy });
      k.add(G.box(1.97, .07, 2.16), 'dark', { y: cy - by - .02 });
      k.add(G.box(2.02, .05, 2.20), 'rad', { y: cy + by + .02 });
      // gold MLI on −X, −Z and corners
      k.add(G.box(.035, 1.05, 1.52), 'gold', { x: -(bx + .012), y: cy, z: 0 });
      k.add(G.box(1.60, .90, .035), 'gold', { x: 0, y: cy + .10, z: -(bz + .012) });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        k.add(G.box(.055, 1.52, .055), 'goldD', { x: sx * 1.005, y: cy, z: sz * 1.10 });
      }
      // dark instrument panel on +X
      k.add(G.box(.035, .88, 1.70), 'dark', { x: bx + .014, y: cy + .02, z: 0 });
      // white radiator with fin lines on +Z
      k.add(G.box(1.36, .86, .035), 'rad', { x: 0, y: cy + .02, z: bz + .014 });
      for (let i = 0; i < 7; i++) k.add(G.box(1.30, .012, .012), 'dark', { x: 0, y: cy - .30 + i * .105, z: bz + .035 });
      // thermal blanket quilt seams on top
      for (let i = 0; i < 5; i++) k.add(G.box(1.9, .012, .012), 'goldD', { x: 0, y: cy + by + .05, z: -1.0 + i * .50 });

      // ---- folded solar wings on ±X: tight accordion stack of 5 panels
      for (const sx of [-1, 1]) {
        k.add(G.box(.085, 1.42, .10), 'metal', { x: sx * 1.105, y: cy, z: .48 });
        k.add(G.box(.13, .13, .16), 'goldD', { x: sx * 1.06, y: cy + .58, z: .48 });
        k.add(G.box(.13, .13, .16), 'goldD', { x: sx * 1.06, y: cy - .58, z: .48 });
        const NP = 5;
        for (let i = 0; i < NP; i++) {
          const px = sx * (1.135 + i * .050);
          const zz = .16 + (i % 2 ? .035 : -.035);
          k.add(G.box(.036, 1.34, 1.62), 'solar', { x: px, y: cy, z: zz });
          k.add(G.box(.040, .022, 1.64), 'goldD', { x: px, y: cy + .678, z: zz });
          k.add(G.box(.040, .022, 1.64), 'goldD', { x: px, y: cy - .678, z: zz });
          k.add(G.box(.040, 1.36, .020), 'goldD', { x: px, y: cy, z: zz + .818 });
          k.add(G.box(.040, 1.36, .020), 'goldD', { x: px, y: cy, z: zz - .818 });
          rod(k, 'metal', px, cy - .66, zz - .80, px, cy + .66, zz - .80, .016, 7);
        }
        // hold-down brackets crossing the folded stack
        [cy + .56, cy - .56].forEach(yy => {
          k.add(G.box(.32, .05, .07), 'dark', { x: sx * 1.24, y: yy, z: .16 });
        });
        [[cy + .60], [cy - .60]].forEach(([yy]) => {
          k.add(G.cyl(.032, .032, .05, 8), 'metal', { x: sx * 1.33, y: yy, z: .86, rz: PI / 2 });
        });
        k.add(G.sph(.016, 6, 4), sx > 0 ? 'ledG' : 'ledA', { x: sx * 1.34, y: cy + .70, z: .16 });
      }

      // ---- +X instruments
      // camera assembly
      k.add(G.box(.10, .26, .30), 'dark', { x: bx + .05, y: cy + .20, z: -.52 });
      k.add(G.cyl(.062, .062, .05, 16), 'lens', { x: bx + .105, y: cy + .22, z: -.52, rz: PI / 2 });
      k.add(G.cyl(.042, .042, .05, 14), 'lens', { x: bx + .105, y: cy + .16, z: -.43, rz: PI / 2 });
      // laser altimeter + laser comms box
      k.add(G.box(.30, .22, .34), 'dark', { x: bx + .05, y: cy - .26, z: .44 });
      k.add(G.cyl(.058, .058, .04, 14), 'lens', { x: bx + .10, y: cy - .22, z: .50, rz: PI / 2 });
      k.add(G.box(.16, .10, .16), 'goldD', { x: bx + .05, y: cy - .40, z: .10 });
      // small thruster cluster on +X face
      [[cy + .62, .42], [cy - .58, -.35]].forEach(([yy, zz]) => {
        k.add(G.box(.12, .12, .16), 'metal', { x: bx + .04, y: yy, z: zz });
        for (let i = 0; i < 3; i++) {
          k.add(G.cyl(.012, .024, .05, 8), 'metal', { x: bx + .10, y: yy + (i - 1) * .045, z: zz + (i % 2 ? .04 : -.04), rz: PI / 2 });
        }
      });

      // ---- RCS quads at the four bottom corners + tanklets
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const px = sx * .84, pz = sz * .94, py = cy - .63;
        k.add(G.box(.18, .16, .18), 'dark', { x: px, y: py, z: pz });
        for (let i = 0; i < 4; i++) {
          const q = az(0, 0, 0);
          k.add(G.cyl(.014, .03, .055, 8), 'metal', {
            x: px + sx * .10, y: py + (i < 2 ? .05 : -.05), z: pz + sz * (i % 2 ? .09 : -.06),
            rz: PI / 2 - sx * .6
          });
        }
        k.add(G.sph(.085, 12, 8), 'goldD', { x: sx * .62, y: cy - .70, z: sz * .55 });
      }
      // ---- bottom: separation ring + 4 main thruster bells (pointing down)
      k.add(G.ring(.72, 1.02, .08, 30), 'metal', { y: cy - by - .06 });
      k.add(G.box(.62, .10, .62), 'dark', { y: cy - by - .13 });
      for (let i = 0; i < 4; i++) {
        const p = az(.46, i * 90 + 45, cy - by - .16);
        k.add(G.box(.16, .08, .16), 'dark', { x: p.x, y: p.y, z: p.z, ry: p.ry });
        k.add(G.cyl(.035, .068, .14, 12), 'dark', { x: p.x, y: cy - by - .27, z: p.z });
      }
      // bottom-facing instrument apertures
      [[.30, .55], [-.40, -.50]].forEach(([sx, sz]) => {
        k.add(G.box(.16, .06, .16), 'dark', { x: sx, y: cy - by - .08, z: sz });
        k.add(G.cyl(.05, .05, .02, 12), 'lens', { x: sx, y: cy - by - .115, z: sz });
      });

      // ---- star trackers + antennas on top
      [[.60, .74], [-.60, -.74]].forEach(([sx, sz]) => {
        k.add(G.cyl(.05, .055, .09, 12), 'dark', { x: sx, y: cy + by + .07, z: sz });
        k.add(G.cyl(.062, .042, .05, 12), 'dark', { x: sx, y: cy + by + .14, z: sz, rx: .38 });
      });
      // relay horn aperture on top −Z
      k.add(G.cyl(.13, .035, .17, 14, true), 'metal', { x: -.62, y: cy + by + .10, z: -.58, rx: -.55 });
      // whip antennas
      rod(k, 'metal', .92, cy + by, .86, 1.00, cy + by + .34, .94, .010, 5);
      rod(k, 'metal', -.92, cy + by, .82, -1.00, cy + by + .32, .90, .010, 5);

      // ---- high-gain antenna: shallow dish on a gimbal, tilted toward +X/+Z
      const pivot = new T.Matrix4()
        .makeTranslation(.02, cy + by + .12, .30)
        .multiply(new T.Matrix4().makeRotationX(-.40))
        .multiply(new T.Matrix4().makeRotationY(-.30));
      k.add(G.cyl(.085, .10, .12, 12), 'metal', { x: .02, y: cy + by + .05, z: .30 });
      k.add(G.tor(.105, .022, 6, 18), 'metal', { x: .02, y: cy + by + .11, z: .30, rx: PI / 2 });
      k.add(G.cyl(.05, .05, .12, 8), 'metal', { x: .02, y: cy + by + .16, z: .30 });
      const dishR = .64, dishDepth = .13;
      const dishProf = [];
      for (let i = 0; i <= 12; i++) {
        const tt = i / 12, rr = .03 + (dishR - .03) * tt;
        dishProf.push([rr, dishDepth * tt * tt]);
      }
      k.addM(G.lathe(dishProf, 52), 'foil', pivot);
      {
        const m = new T.Matrix4().compose(new T.Vector3(0, dishDepth, 0), new T.Quaternion(), new T.Vector3(1, 1, 1));
        m.premultiply(pivot);
        k.addM(new T.TorusGeometry(dishR - .01, .014, 6, 52), 'metal', m);
      }
      // back ribs
      for (let i = 0; i < 6; i++) {
        const a = i * TAU / 6;
        const rim = new T.Vector3(Math.cos(a) * (dishR - .03), dishDepth - .01, Math.sin(a) * (dishR - .03));
        const ctr = new T.Vector3(0, .01, 0);
        const len = ctr.distanceTo(rim);
        const q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), rim.clone().sub(ctr).normalize());
        const m = new T.Matrix4().compose(ctr.clone().add(rim).multiplyScalar(.5), q, new T.Vector3(1, 1, 1));
        m.premultiply(pivot);
        k.addM(new T.CylinderGeometry(.010, .010, len, 6, 1), 'metal', m);
      }
      // feed tripod + horn at focus
      const focus = new T.Vector3(0, dishDepth + .30, 0);
      for (let i = 0; i < 3; i++) {
        const a = i * TAU / 3 + .5;
        const rim = new T.Vector3(Math.cos(a) * (dishR - .04), dishDepth + .005, Math.sin(a) * (dishR - .04));
        const len = rim.distanceTo(focus);
        const q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), focus.clone().sub(rim).normalize());
        const m = new T.Matrix4().compose(rim.clone().add(focus).multiplyScalar(.5), q, new T.Vector3(1, 1, 1));
        m.premultiply(pivot);
        k.addM(new T.CylinderGeometry(.009, .009, len, 6, 1), 'metal', m);
      }
      {
        const m = new T.Matrix4().compose(new T.Vector3(0, focus.y - .04, 0), new T.Quaternion(), new T.Vector3(1, 1, 1));
        m.premultiply(pivot);
        k.addM(new T.CylinderGeometry(.055, .085, .11, 14, 1, true), 'metal', m);
        const m2 = new T.Matrix4().compose(new T.Vector3(0, focus.y - .14, 0), new T.Quaternion(), new T.Vector3(1, 1, 1));
        m2.premultiply(pivot);
        k.addM(new T.CylinderGeometry(.025, .025, .12, 8, 1), 'copper', m2);
      }

      // extra surface detail: MLI patches, louvre strips, top-deck equipment
      [[cy + .46, -.34, .30, .18], [cy - .04, -.34, .34, .22]].forEach(([yy, zz, ww, hh]) => {
        k.add(G.box(.012, hh, ww), 'goldD', { x: bx + .036, y: yy, z: zz });
      });
      for (let i = 0; i < 3; i++) {
        k.add(G.box(.014, .05, .34), 'dark', { x: bx + .036, y: cy - .54 + i * .06, z: -.02 });
      }
      k.add(G.box(.26, .10, .20), 'dark', { x: .52, y: cy + by + .06, z: .58 });
      k.add(G.box(.20, .07, .16), 'goldD', { x: -.45, y: cy + by + .05, z: .44 });
      k.add(G.cyl(.06, .06, .10, 10), 'metal', { x: .30, y: cy + by + .06, z: -.22 });
      k.add(G.cyl(.04, .04, .05, 10), 'lens', { x: .30, y: cy + by + .115, z: -.22 });

      // ---- markings on +X panel
      flatDecal(gO, TEX.flag, { w: .34, h: .23, x: bx + .034, y: cy + .14, z: -.88, ry: PI / 2 });
      flatDecal(gO, txt('嫦娥七号', { color: '#d9d4c2', size: 96 }), { w: .70, h: .17, x: bx + .034, y: cy - .16, z: .96, ry: PI / 2 });
      flatDecal(gO, txt('CE-7', { color: '#5b615c', size: 84 }), { w: .26, h: .10, x: .52, y: cy + .30, z: bz + .036, ry: 0 });
      flatDecal(gO, TEX.hazard, { w: .22, h: .12, x: bx + .034, y: cy - .44, z: -.86, ry: PI / 2, opacity: .85 });
    })();
    /* --- orbiter microdetail: optics, feeds, wing hardware, blanket seams --- */
    (function orbiterDetail() {
      const k = kO, cy = 54.075, bx = 1.05, by = .775, bz = 1.15;
      // ---- wing hardware: interconnects, hinge bars, hold-downs, bolts
      for (const sx of [-1, 1]) {
        for (let i = 0; i < 4; i++) {
          const px = sx * (1.135 + i * .050);
          const zz = .16 + (i % 2 ? .035 : -.035);
          k.add(G.box(.042, .026, 1.66), 'amber', { x: px, y: cy + .69, z: zz });
          k.add(G.box(.042, .026, 1.66), 'amber', { x: px, y: cy - .69, z: zz });
          for (let j = 0; j < 4; j++) {
            k.add(G.cyl(.011, .011, .024, 5), 'metal', { x: px, y: cy + .678, z: zz - .60 + j * .40, rx: PI / 2 });
          }
        }
        // hold-down clamps + pyro nuts
        [cy + .56, cy - .56].forEach(yy => {
          k.add(G.box(.36, .05, .06), 'metal', { x: sx * 1.24, y: yy, z: .16 });
          k.add(G.cyl(.028, .028, .05, 8), 'metal', { x: sx * 1.30, y: yy, z: .72, rz: PI / 2 });
          k.add(G.sph(.02, 6, 4), 'red', { x: sx * 1.32, y: yy, z: .72 });
        });
        // wing root MLI
        k.add(G.box(.03, 1.10, .70), 'goldD', { x: sx * 1.075, y: cy + .10, z: -.10 });
      }
      // ---- HGA: subreflector, thicker feed struts, rim bolts, back gold, cable
      {
        const pivot = new T.Matrix4()
          .makeTranslation(.02, cy + by + .12, .30)
          .multiply(new T.Matrix4().makeRotationX(-.40))
          .multiply(new T.Matrix4().makeRotationY(-.30));
        const dishR = .64, dishDepth = .13;
        const focus = new T.Vector3(0, dishDepth + .28, 0);
        const local = (geo, key, m) => { const mm4 = m.clone(); mm4.premultiply(pivot); k.addM(geo, key, mm4); };
        for (let i = 0; i < 3; i++) {
          const a = i * TAU / 3 + .5;
          const rim = new T.Vector3(Math.cos(a) * (dishR - .06), dishDepth + .01, Math.sin(a) * (dishR - .06));
          const len = rim.distanceTo(focus);
          const q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), focus.clone().sub(rim).normalize());
          local(new T.CylinderGeometry(.013, .013, len, 7, 1), 'metal', new T.Matrix4().compose(rim.clone().add(focus).multiplyScalar(.5), q, new T.Vector3(1, 1, 1)));
        }
        // subreflector at the focus
        local(new T.CylinderGeometry(.075, .075, .022, 18, 1), 'rad', new T.Matrix4().compose(new T.Vector3(0, focus.y + .02, 0), new T.Quaternion(), new T.Vector3(1, 1, 1)));
        local(new T.CylinderGeometry(.03, .022, .05, 10, 1), 'metal', new T.Matrix4().compose(new T.Vector3(0, focus.y - .03, 0), new T.Quaternion(), new T.Vector3(1, 1, 1)));
        // rim bolt ring
        for (let i = 0; i < 12; i++) {
          const a = i * TAU / 12;
          local(new T.CylinderGeometry(.009, .009, .028, 5, 1), 'metal',
            new T.Matrix4().compose(new T.Vector3(Math.cos(a) * (dishR - .02), dishDepth, Math.sin(a) * (dishR - .02)), new T.Quaternion(), new T.Vector3(1, 1, 1)));
        }
        // kapton patches on the dish back
        [0.3, 2.4].forEach(a => {
          local(G.box(.14, .012, .10), 'amber', new T.Matrix4().compose(
            new T.Vector3(Math.cos(a) * .34, dishDepth * .30, Math.sin(a) * .34), new T.Quaternion(), new T.Vector3(1, 1, 1)));
        });
        // waveguide from the horn back to the bus
        cable(k, 'dark', [new T.Vector3(.02, cy + by + .18, .30), new T.Vector3(.10, cy + by + .05, .40), new T.Vector3(.34, cy + by + .02, .46)], .014);
      }
      // ---- optical instruments on the +X panel: camera boxes with hoods + lenses
      [[-.72, .24, .20], [.02, -.10, .16], [.74, -.06, .13]].forEach(([zz, yy, rr]) => {
        const y = cy + yy;
        k.add(G.box(.10, rr + .04, rr + .08), 'dark', { x: bx + .055, y: y, z: zz });
        k.add(G.cyl(rr * .42, rr * .42, .04, 14), 'lens', { x: bx + .108, y: y, z: zz, rz: PI / 2 });
        k.add(G.cyl(rr * .52, rr * .52, .015, 14), 'goldD', { x: bx + .126, y: y, z: zz, rz: PI / 2 });
        k.add(G.box(.06, .03, rr + .10), 'metal', { x: bx + .112, y: y + rr * .52, z: zz });
      });
      // star tracker baffles
      [[.60, .74], [-.60, -.74]].forEach(([sx, sz]) => {
        k.add(G.cyl(.072, .05, .09, 12, true), 'dark', { x: sx, y: cy + by + .17, z: sz, rx: .38 });
        k.add(G.cyl(.078, .078, .012, 12), 'metal', { x: sx, y: cy + by + .215, z: sz + .02, rx: .38 });
      });
      // RCS quad plumbing at the four bottom corners
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const px = sx * .84, pz = sz * .94, py = cy - .63;
        k.add(G.cyl(.018, .018, .22, 6), 'metal', { x: px, y: py + .16, z: pz });
        k.add(G.box(.06, .05, .06), 'amber', { x: px, y: py + .28, z: pz });
        cable(k, 'dark', [az(.70, sx > 0 ? (sz > 0 ? 20 : -20) : (sz > 0 ? 160 : 200), cy - .50), az(.80, 0, cy - .58)], .012);
      }
      // thermal blanket seams + access panels on top deck
      for (let i = 0; i < 4; i++) {
        k.add(G.box(1.86, .010, .010), 'amber', { x: 0, y: cy + by + .055, z: -.86 + i * .56 });
      }
      [[.42, -.62], [-.50, .34]].forEach(([xx, zz]) => {
        k.add(G.box(.34, .016, .26), 'dark', { x: xx, y: cy + by + .055, z: zz });
        k.add(G.box(.28, .012, .20), 'paint', { x: xx, y: cy + by + .07, z: zz });
      });
      // UHF / relay antenna + whip bases
      k.add(G.cyl(.035, .035, .12, 8), 'metal', { x: .46, y: cy + by + .10, z: .70 });
      k.add(G.cyl(.06, .012, .12, 10, true), 'metal', { x: .46, y: cy + by + .22, z: .70, rx: -.4 });
      // separation springs around the bottom ring
      bolts(k, 'metal', 24, .95, cy - by - .10, .012, .022, 0);
      // small red mission logo decal + stencil
      flatDecal(gO, txt('中国探月', { color: '#c0392b', size: 78 }), { w: .30, h: .11, x: bx + .034, y: cy + .40, z: -.30, ry: PI / 2, opacity: .92 });
      flatDecal(gO, txt('CE-7 / 04', { color: '#cfcbb9', size: 56 }), { w: .22, h: .055, x: -.62, y: cy + .30, z: bz + .036, ry: 0, opacity: .8 });
    })();
    const trisO = kO.finish(gO);

    /* =====================================================================
     * 10 · ROVER (6 wheels, folded suspension, solar + mast) in its cradle
     * ===================================================================*/
    const kR = new Kit();
    (function rover() {
      const k = kR;
      const cy = 51.78, cz = 1.60;
      // body
      k.add(G.box(.92, .34, .58), 'paint', { x: 0, y: cy, z: cz });
      k.add(G.box(.92, .16, .60), 'gold', { x: 0, y: cy - .12, z: cz });
      k.add(G.box(.96, .035, .62), 'rad', { y: cy + .175, z: cz });
      k.add(G.box(.86, .05, .52), 'dark', { y: cy - .175, z: cz });
      // folded solar panel stack on top
      for (let i = 0; i < 2; i++) {
        k.add(G.box(.86, .022, .46), 'solar', { x: 0, y: cy + .205 + i * .032, z: cz + .02 });
        rod(k, 'metal', -.44, cy + .205 + i * .032, cz + .25, .44, cy + .205 + i * .032, cz + .25, .014, 6);
      }
      k.add(G.box(.88, .05, .06), 'goldD', { y: cy + .205, z: cz - .225 });
      // folded mast lying along +Z
      rod(k, 'metal', .0, cy + .285, cz + .22, .0, cy + .285, cz + .60, .022, 6);
      k.add(G.box(.11, .08, .09), 'dark', { x: 0, y: cy + .285, z: cz + .64 });
      k.add(G.cyl(.028, .028, .03, 10), 'lens', { x: .058, y: cy + .285, z: cz + .655, rz: PI / 2 });
      k.add(G.cyl(.022, .022, .03, 10), 'lens', { x: -.058, y: cy + .285, z: cz + .655, rz: PI / 2 });
      // belly radar antenna + folded arm
      k.add(G.box(.52, .02, .32), 'goldD', { y: cy - .195, z: cz });
      k.add(G.box(.24, .10, .10), 'dark', { x: -.36, y: cy - .06, z: cz + .30 });
      rod(k, 'metal', -.42, cy - .10, cz + .30, -.52, cy + .10, cz + .44, .018, 6);
      // six wheels (folded, tucked close to the body)
      for (const sx of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          const wz = cz - .22 + i * .22, wx = sx * .50;
          k.add(G.cyl(.17, .17, .13, 16), 'rubber', { x: wx, y: cy - .145, z: wz, rz: PI / 2 });
          k.add(G.cyl(.09, .09, .15, 12), 'metal', { x: wx, y: cy - .145, z: wz, rz: PI / 2 });
          k.add(G.cyl(.045, .045, .165, 8), 'goldD', { x: wx, y: cy - .145, z: wz, rz: PI / 2 });
          for (let j = 0; j < 12; j++) {
            const a = j / 12 * TAU;
            k.add(G.box(.045, .028, .115), 'rubber', {
              x: wx, y: cy - .145 + Math.cos(a) * .178, z: wz + Math.sin(a) * .178,
              rx: -a + PI / 2
            });
          }
          // rocker arm folded up to the body
          rod(k, 'metal', sx * .47, cy - .10, wz, sx * .42, cy + .16, wz - .04, .022, 6);
        }
        rod(k, 'metal', sx * .455, cy + .17, cz - .26, sx * .455, cy + .17, cz + .26, .02, 6);
      }
      // instrument camera on the front
      k.add(G.box(.26, .14, .12), 'dark', { x: 0, y: cy - .02, z: cz + .34 });
      k.add(G.cyl(.04, .04, .03, 12), 'lens', { x: -.06, y: cy - .02, z: cz + .41 });
      k.add(G.cyl(.03, .03, .03, 12), 'lens', { x: .06, y: cy - .02, z: cz + .41 });
      flatDecal(gR, TEX.flag, { w: .20, h: .13, x: .465, y: cy + .02, z: cz - .10, ry: PI / 2 });
      flatDecal(gR, txt('CE-7', { color: '#c8c2b0', size: 70 }), { w: .16, h: .06, x: .465, y: cy + .12, z: cz + .10, ry: PI / 2, opacity: .85 });
    })();
    /* --- rover microdetail: suspension, wheels, optics, folded panel hardware --- */
    (function roverDetail() {
      const k = kR;
      const cy = 51.78, cz = 1.60;
      // wheel hubs: bolts + spokes + side wall detail
      for (const sx of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          const wz = cz - .22 + i * .22, wx = sx * .50, wy = cy - .145;
          for (let j = 0; j < 8; j++) {
            const a = j * TAU / 8;
            k.add(G.cyl(.010, .010, .018, 5), 'metal', { x: wx, y: wy + Math.cos(a) * .105, z: wz + Math.sin(a) * .105, rz: PI / 2 });
          }
          for (let j = 0; j < 3; j++) {
            const a = j * TAU / 3 + .3;
            k.add(G.box(.10, .012, .022), 'goldD', { x: wx, y: wy + Math.cos(a) * .05, z: wz + Math.sin(a) * .05, rx: -a });
          }
          // fender strip over the wheel
          k.add(G.box(.03, .02, .16), 'metal', { x: wx + sx * .02, y: wy + .185, z: wz });
          // rocker pivot disc + bogie link
          k.add(G.cyl(.036, .036, .028, 10), 'metal', { x: sx * .455, y: cy - .03, z: wz, rz: PI / 2 });
          rod(k, 'metal', sx * .455, cy - .03, wz, sx * .47, cy + .10, wz - .04, .016, 5);
        }
        // rocker spring
        k.add(G.cyl(.018, .018, .20, 8), 'metal', { x: sx * .43, y: cy + .10, z: cz - .10, rx: .5 });
      }
      // folded solar panel hardware: hinge bars, interconnects, tie-downs
      for (let i = 0; i < 2; i++) {
        const yy = cy + .205 + i * .032;
        k.add(G.cyl(.014, .014, .50, 6), 'metal', { x: .0, y: yy, z: cz - .25, rz: PI / 2 });
        k.add(G.box(.86, .010, .020), 'amber', { y: yy + .012, z: cz - .19 });
        k.add(G.box(.86, .010, .020), 'amber', { y: yy + .012, z: cz + .23 });
        [[-.34], [.34]].forEach(([xx]) => {
          k.add(G.box(.05, .03, .26), 'metal', { x: xx, y: yy + .028, z: cz + .02 });
        });
      }
      // mast optics: lens rings + sunshade + cable
      const my = cy + .285, mz = cz + .64;
      k.add(G.cyl(.036, .036, .03, 12), 'goldD', { x: .058, y: my, z: mz + .015, rz: PI / 2 });
      k.add(G.cyl(.030, .030, .03, 12), 'goldD', { x: -.058, y: my, z: mz + .015, rz: PI / 2 });
      k.add(G.box(.12, .012, .03), 'metal', { x: 0, y: my + .045, z: mz + .02 });
      cable(k, 'dark', [new T.Vector3(0, my - .03, cz + .58), new T.Vector3(.06, cy + .20, cz + .34), new T.Vector3(.10, cy + .16, cz + .12)], .010);
      // body detail: radiator, apertures, drill box, antenna, MLI seams
      k.add(G.box(.26, .022, .40), 'rad', { x: -.36, y: cy + .176, z: cz - .08 });
      k.add(G.box(.14, .10, .06), 'dark', { x: .30, y: cy - .02, z: cz - .28 });
      k.add(G.cyl(.03, .03, .02, 10), 'lens', { x: .30, y: cy - .02, z: cz - .31 });
      k.add(G.box(.18, .10, .14), 'goldD', { x: -.30, y: cy - .06, z: cz + .28 });
      rod(k, 'metal', -.34, cy - .10, cz + .30, -.46, cy + .16, cz + .44, .010, 4);
      rod(k, 'metal', .40, cy + .16, cz + .20, .54, cy + .38, cz + .26, .007, 4);
      k.add(G.box(.90, .010, .012), 'amber', { y: cy + .178, z: cz + .12 });
      // small red mission mark + hazard
      flatDecal(gR, txt('中国探月', { color: '#c0392b', size: 66 }), { w: .20, h: .075, x: -.465, y: cy + .10, z: cz + .12, ry: -PI / 2, opacity: .9 });
    })();
    const trisR = kR.finish(gR);

    /* =====================================================================
     * 11 · HOPPER / 飞跃器 (≈1.2 m class, 4 folded legs, own thrusters)
     *      docked on the lander −Z flat (visible side of the cutaway); the
     *      geometry below is authored in the old −X frame and mapped onto the
     *      −Z dock with kH.xform, so its docking face ends up facing +Z.
     * ===================================================================*/
    const kH = new Kit();
    kH.xform = new T.Matrix4()
      .makeTranslation(HOP.x, 0, HOP.z)
      .multiply(new T.Matrix4().makeRotationY(-PI / 2))
      .multiply(new T.Matrix4().makeTranslation(-HOP_OLD.x, 0, -HOP_OLD.z));
    (function hopper() {
      const k = kH;
      const cx = HOP_OLD.x, cy = HOP.y, cz = HOP_OLD.z;
      // body: octagonal drum with gold/white MLI patchwork
      k.add(G.cyl(.40, .42, .54, 8), 'gold', { x: cx, y: cy, z: cz, ry: PI / 8 });
      k.add(G.cyl(.42, .42, .05, 8), 'metal', { x: cx, y: cy - .28, z: cz, ry: PI / 8 });
      k.add(G.cyl(.39, .39, .05, 8), 'rad', { x: cx, y: cy + .28, z: cz, ry: PI / 8 });
      // white MLI patches on two flats
      [45, 135].forEach(a => {
        const p = az(.30, a, cy);
        k.add(G.box(.34, .40, .03), 'paint', { x: cx + p.x, y: cy, z: cz + p.z, ry: p.ry });
      });
      // top hatch + antenna
      k.add(G.sph(.20, 14, 8), 'goldD', { x: cx, y: cy + .30, z: cz, sy: .5 });
      rod(k, 'metal', cx, cy + .32, cz, cx, cy + .52, cz, .012, 5);
      k.add(G.cyl(.10, .02, .07, 16), 'rad', { x: cx, y: cy + .55, z: cz, rx: -.6 });
      rod(k, 'metal', cx + .12, cy + .28, cz - .12, cx + .30, cy + .60, cz - .26, .009, 4);
      // descent / hop thrusters under the body (4 mains + 4 attitude)
      k.add(G.cyl(.30, .32, .05, 16), 'dark', { x: cx, y: cy - .31, z: cz });
      for (let i = 0; i < 4; i++) {
        const a = i * 90 + 45;
        const p = az(.19, a, cy - .34);
        k.add(G.cyl(.05, .075, .14, 12), 'nozzle', { x: cx + p.x, y: cy - .40, z: cz + p.z });
        const q = az(.33, a, cy - .32);
        k.add(G.cyl(.018, .028, .07, 8), 'metal', { x: cx + q.x, y: cy - .35, z: cz + q.z });
      }
      // four folded legs: femur out-down, tibia in, foot pads
      for (let i = 0; i < 4; i++) {
        const a = i * 90 + 45;
        const hip = az(.31, a, cy - .18);
        const knee = az(.56, a, cy - .40);
        const foot = az(.50, a, cy - .60);
        k.add(G.box(.10, .10, .10), 'metal', { x: cx + hip.x, y: hip.y, z: cz + hip.z, ry: hip.ry });
        rod(k, 'metal', cx + hip.x, hip.y, cz + hip.z, cx + knee.x, knee.y, cz + knee.z, .028, 8);
        rod(k, 'metal', cx + knee.x, knee.y, cz + knee.z, cx + foot.x, foot.y, cz + foot.z, .022, 7);
        k.add(G.sph(.035, 8, 6), 'metal', { x: cx + knee.x, y: knee.y, z: cz + knee.z });
        k.add(G.cyl(.075, .06, .03, 14), 'metal', { x: cx + foot.x, y: foot.y - .02, z: cz + foot.z });
        for (let j = 0; j < 3; j++) {
          const aa = a * DEG + j * TAU / 3;
          rod(k, 'metal', cx + foot.x, foot.y - .02, cz + foot.z,
            cx + foot.x + Math.cos(aa) * .07, foot.y - .07, cz + foot.z + Math.sin(aa) * .07, .009, 4);
        }
      }
      // outward (−X) instrument face: water-ice analyser + cameras + probe
      k.add(G.box(.07, .30, .34), 'dark', { x: cx - .42, y: cy + .04, z: cz });
      k.add(G.cyl(.055, .055, .03, 14), 'lens', { x: cx - .46, y: cy + .10, z: cz - .06, rz: PI / 2 });
      k.add(G.box(.10, .14, .12), 'goldD', { x: cx - .46, y: cy - .06, z: cz + .10 });
      k.add(G.box(.08, .05, .18), 'dark', { x: cx - .46, y: cy + .17, z: cz + .04 });
      rod(k, 'metal', cx - .44, cy - .10, cz + .14, cx - .56, cy - .30, cz + .20, .014, 5);
      // docking face (+X, toward the lander)
      k.add(G.cyl(.07, .07, .06, 12), 'metal', { x: cx + .42, y: cy, z: cz, rz: PI / 2 });
      [[-.24, .26], [.24, -.26]].forEach(([dz, dy]) => {
        k.add(G.box(.05, .12, .10), 'metal', { x: cx + .41, y: cy + dy * .3, z: cz + dz });
      });
      // small flag + name on the visible (+X in the new dock frame) face
      flatDecal(gH, TEX.flag, { w: .17, h: .115, x: HOP.x + .392, y: cy + .16, z: HOP.z + .10, ry: PI / 2 });
      flatDecal(gH, U.texText('飞跃器', { w: 128, h: 384, size: 64, color: '#efe9d8', vertical: true, font: U.CJK }),
        { w: .13, h: .38, x: HOP.x + .392, y: cy + .02, z: HOP.z - .10, ry: PI / 2 });
    })();
    /* --- hopper microdetail: leg actuators, thruster ribs, sensors, docking --- */
    (function hopperDetail() {
      const k = kH;
      const cx = HOP_OLD.x, cy = HOP.y, cz = HOP_OLD.z;
      // leg actuators + springs + footpad bolts
      for (let i = 0; i < 4; i++) {
        const a = i * 90 + 45;
        const hip = az(.31, a, cy - .18), knee = az(.56, a, cy - .40), foot = az(.50, a, cy - .60);
        rod(k, 'metal', cx + hip.x * 1.1, hip.y + .10, cz + hip.z * 1.1, cx + knee.x * .92, knee.y + .02, cz + knee.z * .92, .014, 5);
        rod(k, 'metal', cx + knee.x, knee.y + .05, cz + knee.z, cx + knee.x * 1.08, knee.y + .04, cz + knee.z * 1.08, .010, 4);
        for (let j = 0; j < 4; j++) {
          const aa = a * DEG + j * TAU / 4 + .4;
          k.add(G.cyl(.009, .009, .020, 5), 'metal', {
            x: cx + foot.x + Math.cos(aa) * .045, y: foot.y - .035, z: cz + foot.z + Math.sin(aa) * .045
          });
        }
        // hip bracket bolt
        k.add(G.cyl(.014, .014, .03, 5), 'metal', { x: cx + hip.x, y: hip.y, z: cz + hip.z, rx: PI / 2 });
      }
      // thruster cooling ribs + valve blocks
      for (let i = 0; i < 4; i++) {
        const a = i * 90 + 45;
        const p = az(.19, a, cy - .34);
        for (let j = 0; j < 2; j++) {
          k.add(G.tor(.052 - j * .012, .007, 5, 12), 'metal', {
            x: cx + p.x, y: cy - .415 - j * .055, z: cz + p.z, rx: PI / 2
          });
        }
        const q = az(.30, a, cy - .26);
        k.add(G.box(.055, .045, .045), 'dark', { x: cx + q.x, y: cy - .26, z: cz + q.z, ry: q.ry });
        k.add(G.cyl(.012, .012, .06, 5), 'metal', { x: cx + q.x, y: cy - .215, z: cz + q.z });
      }
      // small propellant tanks + radiator + antenna dish
      [[.26, -.16], [-.24, -.20]].forEach(([dx, dz]) => {
        k.add(G.sph(.075, 10, 8), 'goldD', { x: cx + dx, y: cy + .12, z: cz + dz });
        k.add(G.tor(.076, .008, 5, 12), 'metal', { x: cx + dx, y: cy + .12, z: cz + dz, rx: PI / 2 });
      });
      k.add(G.box(.20, .014, .16), 'rad', { x: cx + .13, y: cy + .305, z: cz + .18 });
      k.add(G.cyl(.025, .03, .08, 8), 'metal', { x: cx + .16, y: cy + .34, z: cz - .12 });
      k.add(G.cyl(.07, .015, .06, 12), 'rad', { x: cx + .16, y: cy + .38, z: cz - .12, rx: -.6 });
      // sensor face apertures + gold rings
      [[.10, -.06, .055], [-.06, .10, .040], [.17, .14, .032]].forEach(([yy, zz, rr]) => {
        k.add(G.cyl(rr, rr, .022, 12), 'lens', { x: cx - .455, y: cy + yy, z: cz + zz, rz: PI / 2 });
        k.add(G.cyl(rr * 1.35, rr * 1.35, .010, 12), 'goldD', { x: cx - .452, y: cy + yy, z: cz + zz, rz: PI / 2 });
      });
      // MLI seams + kapton tape
      k.add(G.box(.012, .40, .012), 'amber', { x: cx - .40, y: cy + .02, z: cz - .22 });
      k.add(G.box(.30, .012, .012), 'amber', { x: cx, y: cy + .24, z: cz + .30 });
      // docking latches (4) around the +X face
      for (let i = 0; i < 4; i++) {
        const yy = cy + (i > 1 ? .20 : -.20), zz = cz + (i % 2 ? .22 : -.22);
        k.add(G.box(.05, .06, .06), 'metal', { x: cx + .415, y: yy, z: zz });
        k.add(G.cyl(.014, .014, .035, 5), 'metal', { x: cx + .44, y: yy, z: zz, rz: PI / 2 });
      }
      cable(k, 'dark', [new T.Vector3(cx + .40, cy - .18, cz + .10), new T.Vector3(cx + .30, cy - .30, cz + .22), new T.Vector3(cx + .20, cy - .34, cz + .30)], .009);
      // outward face (old −Z ⇒ new +X in the dock frame): sensor head + radiator
      k.add(G.box(.30, .26, .07), 'dark', { x: cx + .04, y: cy + .06, z: cz - .40 });
      k.add(G.cyl(.062, .062, .025, 14), 'lens', { x: cx + .16, y: cy + .10, z: cz - .44, rx: PI / 2 });
      k.add(G.cyl(.085, .085, .012, 16), 'goldD', { x: cx + .16, y: cy + .10, z: cz - .448, rx: PI / 2 });
      k.add(G.cyl(.038, .038, .02, 12), 'lens', { x: cx - .06, y: cy + .02, z: cz - .44, rx: PI / 2 });
      k.add(G.box(.20, .14, .025), 'rad', { x: cx - .14, y: cy + .16, z: cz - .41 });
      for (let i = 0; i < 3; i++) k.add(G.box(.18, .010, .012), 'amber', { x: cx - .14, y: cy + .12 + i * .04, z: cz - .425 });
      k.add(G.box(.12, .10, .012), 'amber', { x: cx + .22, y: cy - .14, z: cz - .40 });
      // stencil
      flatDecal(gH, txt('HOP-1', { color: '#d8d3c2', size: 56 }), { w: .14, h: .045, x: HOP.x + .392, y: cy - .16, z: HOP.z + .22, ry: PI / 2, opacity: .82 });
    })();
    const trisH = kH.finish(gH);

    /* =====================================================================
     * 12 · FAIRING INTERIOR (acoustic blanket + rails; clipped; follows
     *      the rocket fairing shell in explode)
     * ===================================================================*/
    const kF = new Kit();
    (function fairingInterior() {
      const k = kF;
      // acoustic blanket liner 44.90 → 52.45 (fairing interior clear r ≈ 2.45)
      k.add(G.lathe([[2.395, 44.90], [2.418, 45.40], [2.432, 46.20], [2.432, 52.45]], 52), 'blanket');
      // short blanket collar into the nose cone
      k.add(G.lathe([[2.432, 52.45], [2.28, 53.12], [2.05, 53.62]], 52), 'blanketD');
      // quilting ribs / blanket seams (all in clipped materials!)
      for (let i = 0; i < 8; i++) {
        const a = i * 45 + 22.5;
        const p0 = az(2.408, a, 45.30), p1 = az(2.408, a, 52.35);
        rod(k, 'blanketD', p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, .020, 5);
      }
      [46.3, 48.5, 50.7].forEach(y => {
        k.add(G.tor(2.408, .020, 5, 52), 'blanketD', { y: y, rx: PI / 2 });
      });
      // acoustic foam wedge band
      for (let i = 0; i < 14; i++) {
        const a = 110 + i * 9.5;
        const p = az(2.315, a, 45.25);
        k.add(G.box(.34, .52, .12), 'blanketD', { x: p.x, y: p.y, z: p.z, ry: p.ry });
      }
      // separation rails (longitudinal frangible joints) at ±Z; the ±X ones get
      // bisected by the cut plane, which reads as a deliberate section.
      [0, 90, 180, 270].forEach(a => {
        const p = az(2.408, a, 48.65);
        k.add(G.box(.095, 7.35, .045), 'rail', { x: p.x, y: p.y, z: p.z, ry: p.ry });
        k.add(G.box(.13, 7.30, .012), 'foilC', { x: az(2.432, a, 48.65).x, y: 48.65, z: az(2.432, a, 48.65).z, ry: p.ry });
        for (let i = 0; i < 14; i++) {
          const q = az(2.418, a, 45.20 + i * .52);
          const t = a * DEG + PI / 2;
          k.add(G.cyl(.015, .015, .10, 6), 'rail', {
            x: q.x + Math.cos(t) * .06, y: q.y, z: q.z + Math.sin(t) * .06, rz: PI / 2, ry: q.ry
          });
        }
      });
      // base ring frame + separation pushers + vents
      k.add(G.ring(2.20, 2.435, .14, 44), 'rail', { y: 44.93 });
      k.add(G.ring(2.30, 2.425, .06, 44), 'foilC', { y: 45.05 });
      for (let i = 0; i < 10; i++) {
        const p = az(2.24, i * 36 + 10, 45.02);
        k.add(G.cyl(.045, .045, .20, 10), 'rail', { x: p.x, y: 45.06, z: p.z });
        k.add(G.cyl(.065, .065, .025, 10), 'foilC', { x: p.x, y: 45.16, z: p.z });
      }
      [40, 160, 220, 320].forEach(a => {
        for (let i = 0; i < 3; i++) {
          const p = az(2.395, a, 45.35 + i * .16);
          k.add(G.box(.42, .07, .08), 'blanketD', { x: p.x, y: p.y, z: p.z, ry: p.ry, rz: .3 });
        }
      });
      // access door on the visible (−X) inner side
      const dp = az(2.408, 195, 47.35);
      k.add(G.box(.86, .74, .045), 'rail', { x: dp.x, y: dp.y, z: dp.z, ry: dp.ry });
      k.add(G.box(.76, .64, .030), 'blanketD', { x: az(2.418, 195, 47.35).x, y: 47.35, z: az(2.418, 195, 47.35).z, ry: dp.ry });
      for (let i = 0; i < 2; i++) {
        const h = az(2.425, 187 + i * 4, 47.30);
        rod(k, 'rail', h.x, h.y - .10, h.z, h.x, h.y + .10, h.z, .016, 5);
      }
      // gold foil edging at the blanket ends
      k.add(G.tor(2.415, .030, 5, 52), 'foilC', { y: 52.43, rx: PI / 2 });
      // stencilled blanket label (clipped decal)
      {
        const lp = az(2.424, 205, 46.05);
        const lab = new T.Mesh(new T.PlaneGeometry(.70, .095),
          clippedDecalMat(txt('ACOUSTIC BLANKET', { color: '#cdc9b8', size: 38, letterSpacing: 3 }), .75));
        lab.position.set(lp.x, lp.y, lp.z);
        lab.rotation.y = lp.ry;
        lab.renderOrder = 3;
        gF.add(lab);
      }
    })();
    /* --- fairing interior microdetail: blanket quilting, rails, vents, umbilicals --- */
    (function fairingDetail() {
      const k = kF;
      // extra blanket quilt hoops + lacing rows
      [47.2, 49.4, 51.6].forEach(y => {
        k.add(G.tor(2.408, .012, 5, 52), 'blanketD', { y: y, rx: PI / 2 });
      });
      for (let i = 0; i < 10; i++) {
        const a = 110 + i * 11;
        for (let j = 0; j < 6; j++) {
          const p = az(2.402, a, 45.9 + j * 1.05);
          k.add(G.sph(.014, 5, 4), 'blanketD', { x: p.x, y: p.y, z: p.z });
        }
      }
      // acoustic foam wedge blocks (visible inner hemisphere)
      for (let i = 0; i < 8; i++) {
        const a = 150 + i * 10;
        const p = az(2.33, a, 45.55);
        k.add(G.box(.36, .44, .10), 'blanketD', { x: p.x, y: p.y, z: p.z, ry: p.ry });
      }
      // vent louvre boxes near the base
      [70, 120, 200, 250].forEach(a => {
        const p = az(2.395, a, 45.30);
        k.add(G.box(.30, .34, .04), 'rail', { x: p.x, y: p.y, z: p.z, ry: p.ry });
        for (let i = 0; i < 4; i++) {
          const q = az(2.405, a, 45.18 + i * .07);
          k.add(G.box(.24, .028, .022), 'blanketD', { x: q.x, y: q.y, z: q.z, ry: q.ry });
        }
      });
      // umbilical panel + connectors on the −X inner wall
      const up = az(2.39, 215, 46.55);
      k.add(G.box(.58, .44, .06), 'rail', { x: up.x, y: up.y, z: up.z, ry: up.ry });
      for (let i = 0; i < 3; i++) {
        const q = az(2.418, 215, 46.40 + i * .12);
        k.add(G.cyl(.045, .045, .05, 10), 'metal', { x: q.x, y: q.y, z: q.z, rz: PI / 2, ry: q.ry });
        k.add(G.cyl(.06, .06, .014, 12), 'foilC', { x: q.x, y: q.y, z: q.z, ry: q.ry });
      }
      cable(k, 'blanketD', [az(2.39, 222, 46.9), az(2.37, 228, 46.4), az(2.36, 232, 45.8)], .018);
      // bolt rows along the separation rails
      [0, 90, 180, 270].forEach(a => {
        for (let i = 0; i < 10; i++) {
          const q = az(2.425, a, 45.4 + i * .72);
          const t = a * DEG + PI / 2;
          k.add(G.cyl(.012, .012, .04, 5), 'rail', {
            x: q.x + Math.cos(t) * .055, y: q.y, z: q.z + Math.sin(t) * .055, rz: PI / 2, ry: q.ry
          });
        }
      });
      // kapton tape strips + warning stencil on the door area
      const tp = az(2.415, 192, 48.05);
      k.add(G.box(.30, .12, .014), 'foilC', { x: tp.x, y: tp.y, z: tp.z, ry: tp.ry });
      {
        const lp = az(2.424, 188, 48.42);
        const lab = new T.Mesh(new T.PlaneGeometry(.44, .085),
          clippedDecalMat(txt('CAUTION · SEP', { color: '#d9b53a', size: 34, letterSpacing: 1 }), .8));
        lab.position.set(lp.x, lp.y, lp.z);
        lab.rotation.y = lp.ry;
        lab.renderOrder = 3;
        gF.add(lab);
      }
    })();
    const trisF = kF.finish(gF);

    /* ---------------------------------------------------------------------
     * 13 · simple point lights? (contract: interiors only) — none here.
     *      LED bags were merged above.
     * -------------------------------------------------------------------*/

    /* =====================================================================
     * 14 · EXPLODE — Lead contract offsets, museum-clean easing.
     * ===================================================================*/
    const EX = { stack: 4.0, orbiter: 2.2, roverZ: 1.4, hopperX: -1.2, hopperZ: -0.6, fairing: 14.0 };
    let explodeT = 0, lastOp = 1;
    function setExplode(t) {
      const raw = clamp(t, 0, 1);
      explodeT = raw;
      const e = smooth(0, 1, raw);
      root.position.y = BASE + EX.stack * e;
      gO.position.y = EX.orbiter * e;
      gR.position.set(0, .04 * e, EX.roverZ * e);
      gH.position.set(EX.hopperX * e, 0, EX.hopperZ * e);
      if (!follow.host) gF.position.y = BASE + EX.fairing * e;
    }
    APP.explodables.push(setExplode);

    // follow the rocket's fairing group once it exists (stage explode lifts it)
    setTimeout(function () {
      try {
        follow.host = findFairingHost();
        if (follow.host) {
          follow.host.updateWorldMatrix(true, false);
          follow.base = follow.host.getWorldPosition(new T.Vector3()).y;
        }
      } catch (e) { /* non-fatal */ }
    }, 0);

    APP.updaters.push(function () {
      if (cutState.follow && APP.cutPlane) mirror.copy(APP.cutPlane);
      const h = follow.host;
      if (h) {
        h.updateWorldMatrix(true, false);
        const y = h.getWorldPosition(_v).y;
        gF.position.y = BASE + (y - follow.base);
      } else {
        gF.position.y = BASE + EX.fairing * smooth(0, 1, explodeT);
      }
      // the fairing splits into two clamshells as it lifts: fade the blanket
      // liner out so it does not intersect the separated halves
      const e = smooth(0, 1, explodeT);
      const op = 1 - smooth(.02, .34, e);
      if (Math.abs(op - lastOp) > .002) {
        lastOp = op;
        M.blanket.opacity = op;
        M.blanketD.opacity = op;
        M.rail.opacity = op;
        M.foilC.opacity = op;
        gF.visible = op > .02;
      }
    });

    /* =====================================================================
     * 15 · anchors + part metadata
     * ===================================================================*/
    function anchor(parent, x, y, z) {
      const o = new T.Object3D();
      o.position.set(x, y, z);
      parent.add(o);
      return function () { return o.getWorldPosition(new T.Vector3()); };
    }
    const aY = anchor(gY, 0.9, 47.1, 1.0);
    const aC = anchor(gL, 0.55, 52.35, 0.55);
    const aL = anchor(gL, 0.55, 51.95, 1.05);
    const aO = anchor(gO, 0.2, 54.15, 0.95);
    const aR = anchor(gR, 0.0, 51.80, 1.95);
    const aH = anchor(gH, -0.10, 52.72, -1.84);

    APP.registerPart('change7', {
      zh: '嫦娥七号', en: "CHANG'E-7 SPACECRAFT",
      section: '探测器', modes: ['cut', 'explode'], group: gL, anchor: aC, view: 'payload',
      specs: [
        ['任务', '月球南极综合探测'],
        ['构成', '轨道器 · 着陆器 · 巡视器 · 飞跃器'],
        ['发射', '长征五号 · 文昌 101 工位'],
        ['中继', '鹊桥二号（已在环月轨道）']
      ],
      desc: '中国探月工程四期任务，采用绕、落、巡、飞跃一体化方式探测月球南极永久阴影区的水冰与挥发分。堆叠关系为科普示意。'
    });
    APP.registerPart('orbiter', {
      zh: '轨道器', en: 'ORBITER',
      section: '探测器', modes: ['cut', 'explode'], group: gO, anchor: aO, view: 'payload',
      specs: [
        ['功能', '环月飞行 · 中继通信 · 科学探测'],
        ['太阳翼', '双翼折叠，入轨后展开'],
        ['有效载荷', '成像相机 · 测月雷达 · 中继终端']
      ],
      desc: '轨道器负责地月转移后的环月飞行与中继通信，两侧太阳翼在发射时折叠收拢，入轨展开后为整器供电并向地面转发数据。'
    });
    APP.registerPart('lander', {
      zh: '着陆器', en: 'LANDER',
      section: '探测器', modes: ['cut', 'explode'], group: gL, anchor: aL, view: 'payload',
      specs: [
        ['分系统', '推进 · 着陆缓冲 · 热控'],
        ['主发动机', '变推力下降发动机'],
        ['着陆腿', '4 条，发射时折叠收拢'],
        ['科学载荷', '地形相机 · 水冰与挥发分探测']
      ],
      desc: '着陆器以变推力发动机完成动力下降，四条着陆腿缓冲软着月；顶部为设备平台，侧面搭载巡视器与飞跃器，落月后分别释放。'
    });
    APP.registerPart('rover', {
      zh: '巡视器', en: 'ROVER',
      section: '探测器', modes: ['cut', 'explode'], group: gR, anchor: aR, view: 'payload',
      specs: [
        ['移动', '六轮独立驱动'],
        ['太阳翼', '可折叠，落月后展开'],
        ['科学载荷', '相机 · 测月雷达 · 成分分析'],
        ['发射状态', '折叠于着陆器侧面托架']
      ],
      desc: '巡视器为六轮月球车，发射时折叠收拢在着陆器侧面托架内，落月后展开太阳翼与桅杆，在月球南极附近开展巡视探测。'
    });
    APP.registerPart('hopper', {
      zh: '飞跃器', en: 'HOPPER',
      section: '探测器', modes: ['cut', 'explode'], group: gH, anchor: aH, view: 'payload',
      specs: [
        ['任务', '飞跃进入永久阴影坑'],
        ['尺寸', '约 1.2 m 量级（科普示意）'],
        ['推进', '自带发动机，可多次跳跃'],
        ['科学载荷', '月壤水分子与挥发分分析']
      ],
      desc: '飞跃器是嫦娥七号的标志性载荷，可自行起飞、落到地形复杂的永久阴影区坑内，直接检测月壤中的水冰与挥发分；图中为收拢状态。'
    });
    APP.registerPart('yz2', {
      zh: '远征二号上面级', en: 'YZ-2 UPPER STAGE',
      section: '火箭结构', modes: ['cut', 'explode'], group: gY, anchor: aY, view: 'payload',
      specs: [
        ['直径', '3.8 m'],
        ['发动机', '2 × YF-50D'],
        ['推进剂', '四氧化二氮 / 偏二甲肼'],
        ['功能', '地月转移轨道直接入轨']
      ],
      desc: '远征二号（YZ-2）为常温推进剂液上面级，可在入轨后多次点火，把嫦娥七号组合体直接送入地月转移轨道，随后与探测器分离。'
    });

    /* ---------------------------------------------------------------------
     * 16 · expose module
     * -------------------------------------------------------------------*/
    root.userData.payload = {
      yz2: gY, lander: gL, orbiter: gO, rover: gR, hopper: gH, fairingInterior: gF
    };
    const mod = {
      group: root,
      fairingInterior: gF,
      setExplode,
      groups: { yz2: gY, lander: gL, orbiter: gO, rover: gR, hopper: gH, fairing: gF },
      tris: { yz2: trisY, lander: trisL, orbiter: trisO, rover: trisR, hopper: trisH, fairing: trisF },
      cut: onCut
    };
    APP.modules.payload = mod;
    if (window.FLAGS && window.FLAGS.debug) {
      console.log('[payload] built tris', trisY + trisL + trisO + trisR + trisH + trisF,
        { yz2: trisY, lander: trisL, orbiter: trisO, rover: trisR, hopper: trisH, fairing: trisF },
        'fairing host', follow.host ? follow.host.name || follow.host.type : 'none');
    }
    return mod;
  };
})();
