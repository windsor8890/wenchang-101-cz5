/* ============================================================================
 * 30-site.js — 中国文昌航天发射场 101 工位 · 发射场环境
 *
 * Builds: tropical coastal terrain & shore, 101 hardstand + flame trench,
 * 24 x 24 m mobile launch platform (top y=12.2), 91.7 m fixed service tower at
 * (-18.5, 0), four white lattice lightning masts (110 m), water tower, LOX/LH2
 * tank farm, roads / fence / blockhouses, distant VAB + faint LC-102, palm and
 * casuarina vegetation, and night-emissive fixtures (no lights are added here).
 *
 * Coordinates are metres, y up, pad centred on the origin.
 *   terrain / sea level y = 0 · ground at the pad ~ y 0.9 · deck top y = 7.0
 *   MLP top y = 12.2 · rocket nozzle exit plane y = 13.8
 * ==========================================================================*/
(function () {
  'use strict';

  window.buildSite = function (APP) {
    const T = window.THREE, U = window.U, SPEC = window.SPEC;
    const FLAGS = window.FLAGS;
    const PI = Math.PI, TAU = U.TAU, DEG = U.DEG;
    const clamp = U.clamp, lerp = U.lerp, smooth = U.smooth;
    const g = U.group('site');
    APP.scene.add(g);
    const rng = U.rng(10107);
    const R = (a, b) => a + (b - a) * rng.next();
    const RI = (a, b) => Math.floor(a + (b - a + 1) * rng.next());
    const V3 = (x, y, z) => new T.Vector3(x, y, z);

    const PAD = { hw: 39, hd: 35, deckY: 7.0, mlpHalf: 12, mlpTop: 12.2 };
    const GROUND_Y = 0.9;                      // flat facility ground elevation
    const SEA_X = SPEC.sea ? SPEC.sea.coastlineX : 230;

    /* ---------------------------------------------------------------- night */
    const lamps = [];       // {m, base} emissive materials driven by night amount
    const glows = [];       // {sp, base} additive sprites
    const beacons = [];     // {m, base, phase} pulsing red obstruction lights
    let nightAmt = 0;
    function setNight(amount) {
      nightAmt = clamp(amount || 0, 0, 1);
      for (let i = 0; i < lamps.length; i++) lamps[i].m.emissiveIntensity = lamps[i].base * nightAmt;
      for (let i = 0; i < glows.length; i++) glows[i].sp.material.opacity = glows[i].base * nightAmt;
      for (let i = 0; i < beacons.length; i++) beacons[i].m.emissiveIntensity = beacons[i].base * nightAmt;
      // unlit billboard foliage must fade down so it reads as a night silhouette
      const tk = 1 - .8 * nightAmt;
      if (M.treeA) M.treeA.color.setRGB(tk, tk, tk);
      if (M.treeB) M.treeB.color.setRGB(tk, tk, tk);
      if (M.treeC) M.treeC.color.setRGB(tk * .94, tk * .97, tk * .9);
    }

    /* -------------------------------------------------------------- textures */
    // pad / building concrete with expansion joints baked in (one tile = 6 m)
    const deckTex = U.texConcrete({ size: 512, base: '#c2bdb0', seed: 21, tone: .55 });
    const wallTex = U.texConcrete({ size: 256, base: '#9d9a8f', seed: 33, tone: .8 });

    function canvasTex(w, h, draw, opts) {
      const t = U.texCanvas(w, h, draw, opts || {}).tex;
      t.wrapS = t.wrapT = T.RepeatWrapping;
      return t;
    }

    // steel plate for the MLP deck / box girders
    const plateTex = canvasTex(256, 256, (ctx, cv) => {
      ctx.fillStyle = '#82898a';
      ctx.fillRect(0, 0, cv.width, cv.height);
      const r = U.rng(9);
      for (let i = 0; i < 90; i++) {
        ctx.fillStyle = 'rgba(20,24,25,' + r.range(.03, .1).toFixed(3) + ')';
        ctx.fillRect(r.range(0, 256), r.range(0, 256), r.range(20, 90), r.range(4, 26));
      }
      // plate seams
      ctx.strokeStyle = 'rgba(18,22,23,.55)'; ctx.lineWidth = 3;
      for (let x = 0; x <= 256; x += 128) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 256); ctx.stroke(); }
      for (let y = 0; y <= 256; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke(); }
      // rivets / bolt rows
      ctx.fillStyle = 'rgba(28,32,33,.6)';
      for (let x = 8; x < 256; x += 16) for (let y = 6; y < 256; y += 64) ctx.fillRect(x, y, 3, 3);
      // wear
      for (let i = 0; i < 120; i++) {
        ctx.strokeStyle = 'rgba(230,232,225,' + r.range(.02, .07).toFixed(3) + ')';
        ctx.lineWidth = 1;
        const x = r.range(0, 256), y = r.range(0, 256);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + r.range(-20, 20), y + r.range(-14, 14)); ctx.stroke();
      }
    }, { srgb: true });

    // hazard stripes (diagonal, one tile = 1.6 x 0.8 m)
    const hazardTex = U.texStripe(128, 64, { a: '#d9a72a', b: '#26281f', stripe: 16, angle: 45 });
    hazardTex.wrapS = hazardTex.wrapT = T.RepeatWrapping;

    // dark blast / scorch stain for decals
    const stainTex = U.texRadial(128, [
      [0, 'rgba(26,24,20,.78)'], [.38, 'rgba(28,26,22,.44)'],
      [.72, 'rgba(30,28,24,.14)'], [1, 'rgba(30,28,24,0)']
    ]);
    // streaky soot along the trench
    const sootTex = canvasTex(128, 512, (ctx, cv) => {
      const im = ctx.createImageData(128, 512);
      const r = U.rng(4);
      for (let y = 0; y < 512; y++) for (let x = 0; x < 128; x++) {
        const n = U.fbm2(x * .05 + 2, y * .012, 3);
        const edge = Math.sin(x / 128 * PI);
        const a = clamp((n * .9 - .25) * 1.5, 0, 1) * edge * (.9 - y / 512 * .55);
        const i = (y * 128 + x) * 4;
        im.data[i] = 22; im.data[i + 1] = 21; im.data[i + 2] = 19;
        im.data[i + 3] = Math.round(a * 210);
      }
      ctx.putImageData(im, 0, 0);
    }, { srgb: true });

    // terrain detail: near-neutral speckle that multiplies vertex colours
    const terrainDetail = canvasTex(512, 512, (ctx, cv) => {
      const im = ctx.createImageData(512, 512);
      for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
        const n = U.fbm2(x * .012 + 3, y * .012 + 8, 4);
        const fine = U.fbm2(x * .16, y * .16, 2);
        const v = 212 + n * 34 + (fine - .5) * 26;
        const i = (y * 512 + x) * 4;
        im.data[i] = clamp(v + 4, 0, 255);
        im.data[i + 1] = clamp(v + 2, 0, 255);
        im.data[i + 2] = clamp(v - 10, 0, 255);
        im.data[i + 3] = 255;
      }
      ctx.putImageData(im, 0, 0);
    }, { srgb: true });

    // chain-link security fence (alpha)
    const fenceTex = canvasTex(128, 128, (ctx, cv) => {
      ctx.clearRect(0, 0, 128, 128);
      ctx.strokeStyle = 'rgba(208,214,208,.8)';
      ctx.lineWidth = 2.2;
      for (let i = -128; i < 256; i += 16) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 128, 128); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(i + 128, 0); ctx.lineTo(i, 128); ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(120,126,120,.9)'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(0, 3); ctx.lineTo(128, 3); ctx.stroke();
    }, { srgb: true });

    // palm frond (alpha)
    const frondTex = canvasTex(256, 256, (ctx, cv) => {
      ctx.clearRect(0, 0, 256, 256);
      const r = U.rng(12);
      // rachis
      ctx.strokeStyle = '#7c8a4a'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(128, 252); ctx.quadraticCurveTo(126, 120, 130, 8); ctx.stroke();
      for (let i = 0; i < 34; i++) {
        const t = i / 34;
        const y = 248 - t * 238;
        const len = 104 * Math.pow(Math.sin(Math.min(1, t * 1.12 + .05) * PI * .78), .6) * (1 - t * .35);
        for (const s of [-1, 1]) {
          const g = Math.round(132 + r.range(-22, 52) + t * 26);
          ctx.strokeStyle = 'rgba(' + Math.round(g * .62) + ',' + g + ',' + Math.round(g * .46) + ',.95)';
          ctx.lineWidth = 4.2 - t * 2.4;
          ctx.beginPath();
          ctx.moveTo(128, y + 8);
          ctx.quadraticCurveTo(128 + s * len * .55, y + 4 + len * .12, 128 + s * len, y + 18 + len * .16);
          ctx.stroke();
        }
      }
    }, { srgb: true });
    frondTex.wrapS = frondTex.wrapT = T.ClampToEdgeWrapping;

    // casuarina / coastal tree silhouette (alpha) — two variants for the tree line
    function treeTex(seed) {
      return canvasTex(256, 256, (ctx, cv) => {
        ctx.clearRect(0, 0, 256, 256);
        const r = U.rng(seed);
        // trunk
        ctx.fillStyle = 'rgba(104,88,66,.95)';
        ctx.fillRect(122, 186, 13, 70);
        // canopy: clustered blobs, wispy casuarina profile — brighter greens so
        // the billboards read as sunlit tropical foliage, not black silhouettes
        for (let i = 0; i < 190; i++) {
          const a = r.range(0, TAU);
          const rad = Math.pow(r.next(), .58);
          const x = 128 + Math.cos(a) * rad * 108;
          const y = 106 + Math.sin(a) * rad * 104 - (1 - rad) * 22;
          const s = r.range(6, 27) * (1 - rad * .4);
          const gr = Math.round(96 + r.range(-26, 62) + rad * 30);
          ctx.fillStyle = 'rgba(' + Math.round(gr * .66) + ',' + gr + ',' + Math.round(gr * .46) + ',' + r.range(.55, .95).toFixed(2) + ')';
          ctx.beginPath(); ctx.ellipse(x, y, s, s * r.range(.5, 1), a, 0, TAU); ctx.fill();
        }
        // sunlit crown
        for (let i = 0; i < 60; i++) {
          const a = r.range(0, TAU), rad = Math.pow(r.next(), .7);
          const x = 128 + Math.cos(a) * rad * 90, y = 74 + Math.sin(a) * rad * 54;
          const gr = Math.round(150 + r.range(-20, 50));
          ctx.fillStyle = 'rgba(' + Math.round(gr * .78) + ',' + gr + ',' + Math.round(gr * .55) + ',' + r.range(.3, .7).toFixed(2) + ')';
          ctx.beginPath(); ctx.ellipse(x, y, r.range(6, 20), r.range(4, 13), a, 0, TAU); ctx.fill();
        }
        // lower shade
        const lg = ctx.createLinearGradient(0, 150, 0, 256);
        lg.addColorStop(0, 'rgba(0,0,0,0)');
        lg.addColorStop(1, 'rgba(14,22,12,.34)');
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = lg; ctx.fillRect(0, 0, 256, 256);
      }, { srgb: true });
    }
    const treeTexA = treeTex(31), treeTexB = treeTex(77), treeTexC = treeTex(53);

    // palm trunk rings (repeat vertically)
    const trunkTex = canvasTex(64, 256, (ctx, cv) => {
      const grad = ctx.createLinearGradient(0, 0, 64, 0);
      grad.addColorStop(0, '#4f4234'); grad.addColorStop(.45, '#7b6750'); grad.addColorStop(1, '#463b2e');
      ctx.fillStyle = grad; ctx.fillRect(0, 0, 64, 256);
      const r = U.rng(5);
      for (let y = 0; y < 256; y += 9) {
        ctx.fillStyle = 'rgba(28,23,18,' + r.range(.18, .42).toFixed(2) + ')';
        ctx.fillRect(0, y + r.range(0, 3), 64, r.range(1.5, 3));
      }
    }, { srgb: true });
    trunkTex.wrapS = trunkTex.wrapT = T.RepeatWrapping;
    trunkTex.repeat.set(1, 5);

    // small warm glow disc for floodlights
    const glowTex = U.texRadial(64, [
      [0, 'rgba(255,248,224,1)'], [.22, 'rgba(255,232,180,.72)'],
      [.55, 'rgba(255,220,158,.20)'], [1, 'rgba(255,210,140,0)']
    ]);

    /* ------------------------------------------------------- facade textures */
    // weathered-surface detail: grime for steel, grain for asphalt, grass tufts
    const metalGrime = U.texNoise(256, { scale: 4.4, oct: 4, contrast: 1.2, lo: 172, hi: 255, seed: 5 });
    const metalGrime2 = U.texNoise(256, { scale: 9, oct: 3, contrast: 1.1, lo: 196, hi: 255, seed: 9 });
    const asphaltTex = canvasTex(512, 512, (ctx, cv) => {
      const im = ctx.createImageData(512, 512);
      for (let y = 0; y < 512; y++) {
        for (let x = 0; x < 512; x++) {
          const n = U.fbm2(x * .019 + 1, y * .019 + 4, 3), f = U.fbm2(x * .11, y * .11, 2);
          const v = 148 + n * 62 + (f - .5) * 44;
          const i = (y * 512 + x) * 4;
          im.data[i] = v; im.data[i + 1] = v; im.data[i + 2] = v - 3; im.data[i + 3] = 255;
        }
      }
      ctx.putImageData(im, 0, 0);
      const r = U.rng(17);
      for (let i = 0; i < 30; i++) {
        ctx.fillStyle = 'rgba(56,58,54,' + r.range(.03, .13).toFixed(2) + ')';
        ctx.beginPath(); ctx.ellipse(r.range(0, 512), r.range(0, 512), r.range(20, 150), r.range(10, 60), r.range(0, 3), 0, TAU); ctx.fill();
      }
      for (let i = 0; i < 14; i++) {   // tyre streaks
        ctx.strokeStyle = 'rgba(40,42,38,.10)'; ctx.lineWidth = r.range(3, 9);
        const y = r.range(0, 512);
        ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(170, y + r.range(-20, 20), 340, y + r.range(-20, 20), 512, y); ctx.stroke();
      }
    }, { srgb: true });
    const grassTex = canvasTex(128, 128, (ctx, cv) => {
      ctx.clearRect(0, 0, 128, 128);
      const r = U.rng(23);
      for (let i = 0; i < 46; i++) {
        const x = r.range(4, 124), h = r.range(26, 92), lean = r.range(-22, 22);
        const g = Math.round(108 + r.range(-28, 76));
        ctx.strokeStyle = 'rgba(' + Math.round(g * .64) + ',' + g + ',' + Math.round(g * .4) + ',' + r.range(.5, .95).toFixed(2) + ')';
        ctx.lineWidth = r.range(1.4, 3.2);
        ctx.beginPath(); ctx.moveTo(x, 128); ctx.quadraticCurveTo(x + lean * .4, 128 - h * .6, x + lean, 128 - h); ctx.stroke();
      }
    }, { srgb: true });

    // draws a tall service-building facade with window bands + a matching
    // emissive map of lit windows for the night read.
    function facadeTex(o) {
      const W = 512, H = 512, r = U.rng(o.seed);
      const lit = [];
      const draw = (target) => (ctx, cv) => {
        if (target === 'em') { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
        else {
          ctx.fillStyle = o.base; ctx.fillRect(0, 0, W, H);
          // broad tonal patches / weathering
          for (let i = 0; i < 130; i++) {
            ctx.fillStyle = 'rgba(' + (r.next() < .5 ? '20,24,24,' : '245,244,236,') + r.range(.02, .07).toFixed(3) + ')';
            ctx.fillRect(r.range(0, W), r.range(0, H), r.range(24, 120), r.range(8, 46));
          }
          // vertical panel seams
          ctx.lineWidth = 2;
          for (let x = 0; x <= W; x += o.colPx) {
            ctx.strokeStyle = 'rgba(18,22,22,' + (o.seamA || .3) + ')';
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
            ctx.strokeStyle = 'rgba(255,255,245,' + (o.seamB || .1) + ')';
            ctx.beginPath(); ctx.moveTo(x + 2, 0); ctx.lineTo(x + 2, H); ctx.stroke();
          }
          // horizontal floor slabs
          for (let y = o.floorPx * .5; y < H; y += o.floorPx) {
            ctx.strokeStyle = 'rgba(16,20,20,' + (o.floorA || .42) + ')'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
            ctx.fillStyle = 'rgba(238,236,226,.07)';
            ctx.fillRect(0, y - 4, W, 3);
          }
        }
        // windows (map: dark glass, em: warm light)
        const rows = Math.floor(H / o.floorPx);
        for (let ry = 0; ry < rows; ry++) {
          const y0 = ry * o.floorPx + o.winY;
          for (let x = 10; x < W - 10; x += o.winStep) {
            const on = r.next() < o.litChance;
            if (target === 'em') {
              if (!on) continue;
              ctx.fillStyle = r.next() < .24 ? '#cfe2ff' : '#ffdba6';
              ctx.globalAlpha = r.range(.6, 1);
              ctx.fillRect(x, y0, o.winW, o.winH);
              ctx.globalAlpha = 1;
            } else {
              ctx.fillStyle = on ? 'rgba(84,96,98,.9)' : (o.winDark || 'rgba(26,32,34,.92)');
              ctx.fillRect(x, y0, o.winW, o.winH);
              ctx.fillStyle = 'rgba(210,224,228,.10)';
              ctx.fillRect(x, y0, o.winW, 2);
            }
          }
        }
        if (target !== 'em') {
          // soot / water streaks
          for (let i = 0; i < 26; i++) {
            const x = r.range(0, W), w = r.range(2, 16), y = r.range(0, H * .7);
            const gr = ctx.createLinearGradient(0, y, 0, y + r.range(30, 150));
            gr.addColorStop(0, 'rgba(24,26,24,.10)'); gr.addColorStop(1, 'rgba(24,26,24,0)');
            ctx.fillStyle = gr; ctx.fillRect(x, y, w, 160);
          }
        }
      };
      const map = U.texCanvas(W, H, draw('map')).tex;
      const em = U.texCanvas(W, H, draw('em')).tex;
      return { map, em };
    }

    function facadeMat(o) {
      const t = facadeTex(o);
      const m = new T.MeshStandardMaterial({
        map: t.map, emissive: new T.Color(0xffdfb4), emissiveMap: t.em,
        emissiveIntensity: 0, roughness: o.rough === undefined ? .62 : o.rough,
        metalness: o.metal === undefined ? .12 : o.metal, color: 0xffffff
      });
      lamps.push({ m, base: o.nightGlow === undefined ? 1.5 : o.nightGlow });
      return m;
    }

    // dedicated facades for the fixed service tower: blue-grey insulated panel
    // modules, sparse service openings, dense rows of small work lights at night.
    function towerFacade(o) {
      const W = 512, H = 512, r = U.rng(o.seed);
      const lit = [];
      const map = U.texCanvas(W, H, (ctx) => {
        ctx.fillStyle = o.base; ctx.fillRect(0, 0, W, H);
        for (let x = 0; x < W; x += 32) {          // insulated panel modules
          ctx.fillStyle = 'rgba(255,255,255,' + r.range(.008, .035).toFixed(3) + ')';
          ctx.fillRect(x + 2, 0, 30, H);
          ctx.fillStyle = 'rgba(14,18,20,' + (o.seam || .3) + ')';
          ctx.fillRect(x, 0, 2.5, H);
        }
        for (let y = 0; y < H; y += 24) {          // floor slab bands + vents
          ctx.fillStyle = 'rgba(14,18,20,' + (o.band || .34) + ')'; ctx.fillRect(0, y, W, 2);
          ctx.fillStyle = 'rgba(240,242,238,' + (o.hi || .09) + ')'; ctx.fillRect(0, y + 2, W, 1);
          if (r.next() < .3) {
            const x = Math.floor(r.range(0, 14)) * 32 + 5;
            ctx.fillStyle = 'rgba(20,26,28,.7)'; ctx.fillRect(x, y + 7, 24, 9);
          }
        }
        for (let k = 0; k < 5; k++) {              // big service openings
          const x = 34 + k * 96 + r.range(-10, 10);
          const y = 42 + (k % 2) * 120 + r.range(-10, 10);
          ctx.fillStyle = 'rgba(20,26,28,.9)'; ctx.fillRect(x, y, 20, 84);
          ctx.fillStyle = 'rgba(186,194,190,.2)'; ctx.fillRect(x, y, 2, 84);
          lit.push([x, y, 20, 84]);
        }
        for (let k = 0; k < 12; k++) {             // hatches / inspection panels
          ctx.fillStyle = 'rgba(190,196,190,' + r.range(.1, .3).toFixed(2) + ')';
          ctx.fillRect(r.range(0, W), r.range(0, H), r.range(8, 20), r.range(6, 14));
        }
        for (let i = 0; i < 30; i++) {             // grime / water streaks
          const x = r.range(0, W), y = r.range(0, H * .6);
          const gr = ctx.createLinearGradient(0, y, 0, y + r.range(30, 180));
          gr.addColorStop(0, 'rgba(26,30,28,' + r.range(.05, .15).toFixed(2) + ')');
          gr.addColorStop(1, 'rgba(26,30,28,0)');
          ctx.fillStyle = gr; ctx.fillRect(x, y, r.range(1, 9), 200);
        }
        ctx.fillStyle = 'rgba(22,26,26,.35)'; ctx.fillRect(0, H - 26, W, 26);
      }).tex;
      const em = U.texCanvas(W, H, (ctx) => {
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
        for (let y = 8; y < H; y += 24) {          // rows of small work lights
          for (let x = 10; x < W; x += 32) {
            if (r.next() < .48) continue;
            ctx.fillStyle = r.next() < .2 ? '#d6e4ff' : '#ffd9a4';
            ctx.globalAlpha = r.range(.5, 1);
            ctx.fillRect(x + r.range(0, 14), y + 2, r.range(2.5, 6), r.range(2, 4));
            ctx.globalAlpha = 1;
          }
        }
        ctx.fillStyle = '#ffd9a4'; ctx.globalAlpha = .8;
        for (const l of lit) ctx.fillRect(l[0] + 2, l[1] + 2, l[2] - 4, l[3] - 4);
        ctx.globalAlpha = 1;
      }).tex;
      return { map, em };
    }
    function towerFacadeMat(o) {
      const t = towerFacade(o);
      const m = new T.MeshStandardMaterial({
        map: t.map, emissive: new T.Color(0xffdfb8), emissiveMap: t.em,
        emissiveIntensity: 0, roughness: o.rough === undefined ? .66 : o.rough,
        metalness: o.metal === undefined ? .14 : o.metal, color: 0xffffff
      });
      lamps.push({ m, base: o.nightGlow === undefined ? 1.8 : o.nightGlow });
      return m;
    }

    /* ------------------------------------------------------------- materials */
    const std = (o) => new T.MeshStandardMaterial(o);
    const M = {
      concreteDeck: std({
        map: deckTex.map, bumpMap: deckTex.bump, bumpScale: .09,
        roughnessMap: deckTex.rough, color: 0xf4f1e6, roughness: .9, metalness: .02
      }),
      concrete: std({ map: wallTex.map, color: 0xd8d3c5, roughness: .93, metalness: .02 }),
      concretePale: std({ color: 0xcfcabb, roughness: .9, metalness: .02 }),
      concreteDark: std({ color: 0x8a8578, roughness: .95, metalness: .02 }),
      trench: std({ map: asphaltTex, color: 0x6a675f, roughness: .94, metalness: .04 }),
      asphalt: std({ map: asphaltTex, color: 0x8b8d86, roughness: .95, metalness: .02 }),
      steel: std({ map: metalGrime, color: 0xd8dcd6, roughness: .5, metalness: .42 }),
      steelDark: std({ map: metalGrime2, color: 0x767c79, roughness: .58, metalness: .5 }),
      steelBlue: std({ color: 0x6f8089, roughness: .52, metalness: .38 }),
      steelWhite: std({ map: metalGrime2, color: 0xe6e9e3, roughness: .48, metalness: .32 }),
      plate: std({ map: plateTex, roughnessMap: metalGrime2, color: 0xdfe2dd, roughness: .56, metalness: .34 }),
      orange: std({ color: 0xb45c26, roughness: .6, metalness: .14 }),
      redPaint: std({ color: 0xa53422, roughness: .58, metalness: .1 }),
      whitePaint: std({ color: 0xe4e2d8, roughness: .6, metalness: .05 }),
      markWhite: std({ color: 0xe6e3d6, roughness: .72, metalness: .02 }),
      markYellow: std({ color: 0xd0a52e, roughness: .72, metalness: .02 }),
      markRed: std({ color: 0xa8402a, roughness: .72, metalness: .02 }),
      hazard: std({ map: hazardTex, color: 0xffffff, roughness: .72, metalness: .04 }),
      glass: std({ color: 0x2a3437, roughness: .24, metalness: .55 }),
      glassLit: (() => {
        const m = std({ color: 0x3a4245, emissive: 0xffd9a8, emissiveIntensity: 0, roughness: .3, metalness: .4 });
        lamps.push({ m, base: 1.6 }); return m;
      })(),
      lampWarm: (() => {
        const m = std({ color: 0x8d8f86, emissive: 0xffd9a0, emissiveIntensity: 0, roughness: .42, metalness: .2 });
        lamps.push({ m, base: 2.6 }); return m;
      })(),
      lampWhite: (() => {
        const m = std({ color: 0x9a9c94, emissive: 0xfff4dc, emissiveIntensity: 0, roughness: .4, metalness: .2 });
        lamps.push({ m, base: 3.2 }); return m;
      })(),
      beacon: (() => {
        const m = std({ color: 0x521a12, emissive: 0xff3218, emissiveIntensity: 0, roughness: .5, metalness: .1 });
        beacons.push({ m, base: 3.4, phase: 0 }); return m;
      })(),
      rubber: std({ color: 0x191b1b, roughness: .88, metalness: .05 }),
      pipe: std({ color: 0xa9a89d, roughness: .42, metalness: .62 }),
      pipeDark: std({ color: 0x6b6f6d, roughness: .5, metalness: .55 }),
      copper: std({ color: 0x8a5c33, roughness: .4, metalness: .7 }),
      rock: std({ color: 0x5a5b53, roughness: .94, metalness: .02 }),
      sand: std({ color: 0xc3b594, roughness: .95, metalness: .01 }),
      foliage: std({ color: 0x466030, roughness: .9, metalness: 0 }),
      foliageDark: std({ color: 0x33481f, roughness: .92, metalness: 0 }),
      trunk: std({ map: trunkTex, color: 0xbfb3a2, roughness: .9, metalness: .02 }),
      frond: std({ map: frondTex, alphaTest: .32, side: T.DoubleSide, roughness: .86, metalness: 0, color: 0xffffff }),
      treeA: new T.MeshBasicMaterial({ map: treeTexA, alphaTest: .42, side: T.DoubleSide, fog: true, color: 0xffffff }),
      treeB: new T.MeshBasicMaterial({ map: treeTexB, alphaTest: .42, side: T.DoubleSide, fog: true, color: 0xffffff }),
      treeC: new T.MeshBasicMaterial({ map: treeTexC, alphaTest: .42, side: T.DoubleSide, fog: true, color: 0xffffff }),
      fence: new T.MeshStandardMaterial({
        map: fenceTex, alphaTest: .25, side: T.DoubleSide, roughness: .6,
        metalness: .5, color: 0xc9cfc8
      }),
      water: std({ color: 0x28474c, roughness: .18, metalness: .35 }),
      facadeGrey: towerFacadeMat({ seed: 51, base: '#8d979b', seam: .3, band: .3, nightGlow: 1.9 }),
      facadeBlue: towerFacadeMat({ seed: 63, base: '#4d6a79', seam: .34, band: .3, nightGlow: 2.1, metal: .18 }),
      facadePale: facadeMat({
        seed: 84, base: '#b9b6aa', colPx: 64, floorPx: 120, winStep: 100,
        winW: 46, winH: 26, winY: 34, litChance: .28, nightGlow: 1.2,
        seamA: .15, seamB: .1, floorA: .22, metal: .08, rough: .74
      })
    };

    /* ---------------------------------------------------- geometry utilities */
    const unitBox = new T.BoxGeometry(1, 1, 1);
    const unitCyl = new T.CylinderGeometry(.5, .5, 1, 8, 1, false);
    const unitCyl6 = new T.CylinderGeometry(.5, .5, 1, 6, 1, false);
    const _upY = new T.Vector3(0, 1, 0);
    const _qa = new T.Quaternion(), _pa = new T.Vector3(), _pb = new T.Vector3();
    const _sa = new T.Vector3(), _ma = new T.Matrix4();

    // orientation matrix for a member from A to B, cross-section w x d (metres)
    function memberMatrix(ax, ay, az, bx, by, bz, w, d) {
      _pa.set(ax, ay, az); _pb.set(bx, by, bz);
      const len = _pa.distanceTo(_pb);
      if (len < 1e-4) return null;
      _pb.sub(_pa).normalize();
      _qa.setFromUnitVectors(_upY, _pb);
      _sa.set(w, len, d === undefined ? w : d);
      const mid = new T.Vector3((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
      return new T.Matrix4().compose(mid, _qa.clone(), _sa.clone());
    }

    function Bars(geo) { this.geo = geo || unitBox; this.mats = []; }
    Bars.prototype.add = function (ax, ay, az, bx, by, bz, w, d) {
      const m = memberMatrix(ax, ay, az, bx, by, bz, w, d);
      if (m) this.mats.push(m);
      return this;
    };
    Bars.prototype.flush = function (mat, parent, o) {
      o = o || {};
      const n = this.mats.length;
      if (!n) return null;
      const im = new T.InstancedMesh(this.geo, mat, n);
      for (let i = 0; i < n; i++) im.setMatrixAt(i, this.mats[i]);
      im.instanceMatrix.needsUpdate = true;
      im.castShadow = o.cast !== false;
      im.receiveShadow = o.receive !== false;
      if (o.name) im.name = o.name;
      (parent || g).add(im);
      return im;
    };

    // generic one-material merged geometry builder (axis-aligned or Euler boxes)
    function Builder(mat) { this.mat = mat; this.geos = []; }
    Builder.prototype.addGeo = function (geo, x, y, z, rx, ry, rz, sx, sy, sz) {
      _ma.compose(
        new T.Vector3(x || 0, y || 0, z || 0),
        new T.Quaternion().setFromEuler(new T.Euler(rx || 0, ry || 0, rz || 0)),
        new T.Vector3(sx === undefined ? 1 : sx, sy === undefined ? 1 : sy, sz === undefined ? 1 : sz)
      );
      geo.applyMatrix4(_ma);
      this.geos.push(geo);
      return this;
    };
    Builder.prototype.box = function (w, h, d, x, y, z, ry) {
      return this.addGeo(new T.BoxGeometry(w, h, d), x, y, z, 0, ry || 0, 0);
    };
    Builder.prototype.mesh = function (parent, o) {
      o = o || {};
      if (!this.geos.length) return null;
      const mesh = new T.Mesh(U.mergeGeometries(this.geos), this.mat);
      mesh.castShadow = o.cast !== false;
      mesh.receiveShadow = o.receive !== false;
      if (o.name) mesh.name = o.name;
      (parent || g).add(mesh);
      return mesh;
    };

    // box geometry whose UVs are in metres (one texture tile = `tile` metres)
    function boxUV(w, h, d, tile) {
      tile = tile || 6;
      const geo = new T.BoxGeometry(w, h, d);
      const uv = geo.attributes.uv;
      const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
      for (let f = 0; f < 6; f++) {
        for (let i = 0; i < 4; i++) {
          const k = f * 4 + i;
          uv.setXY(k, uv.getX(k) * dims[f][0] / tile, uv.getY(k) * dims[f][1] / tile);
        }
      }
      return geo;
    }
    function planeUV(w, h, tile) {
      tile = tile || 6;
      const geo = new T.PlaneGeometry(w, h);
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / tile, uv.getY(i) * h / tile);
      return geo;
    }

    // instanced mesh from a list of {p:[x,y,z], q:Quaternion|r:[rx,ry,rz], s:number|[x,y,z], c:color}
    function makeInstanced(geo, mat, list, o) {
      o = o || {};
      if (!list.length) return null;
      const im = new T.InstancedMesh(geo, mat, list.length);
      const M4 = new T.Matrix4(), P = new T.Vector3(), S = new T.Vector3(), Q = new T.Quaternion(), E = new T.Euler();
      let colored = false;
      list.forEach((it, i) => {
        P.set(it.p[0], it.p[1], it.p[2]);
        if (it.q) Q.copy(it.q); else { E.set(it.r ? it.r[0] : 0, it.r ? it.r[1] : 0, it.r ? it.r[2] : 0); Q.setFromEuler(E); }
        if (typeof it.s === 'number') S.set(it.s, it.s, it.s); else if (it.s) S.set(it.s[0], it.s[1], it.s[2]); else S.set(1, 1, 1);
        M4.compose(P, Q, S);
        im.setMatrixAt(i, M4);
        if (it.c !== undefined) { im.setColorAt(i, new T.Color(it.c)); colored = true; }
      });
      im.instanceMatrix.needsUpdate = true;
      if (colored && im.instanceColor) im.instanceColor.needsUpdate = true;
      im.castShadow = o.cast !== false;
      im.receiveShadow = o.receive !== false;
      if (o.name) im.name = o.name;
      (o.parent || g).add(im);
      return im;
    }

    // flat painted marking / decal plane, laid horizontally
    function markBuilder(mat) { return new Builder(mat); }
    function addGroundMark(b, w, d, x, y, z, ry) {
      b.addGeo(new T.PlaneGeometry(w, d), x, y, z, -PI / 2, 0, ry || 0);
    }
    function flatStripeStrip(b, len, width, x, y, z, ry) {
      // hazard stripes: uv in metres, one tile = 1.6 x 0.8 m
      const geo = new T.PlaneGeometry(len, width);
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * len / 1.6, uv.getY(i) * width / .8);
      b.addGeo(geo, x, y, z, -PI / 2, 0, ry || 0);
    }

    // decals are batched by texture + opacity bucket so many stains cost 1 draw
    const _decBatches = new Map();
    function decalAt(parent, tex, w, h, x, y, z, rx, ry, rz, opacity) {
      const op = opacity === undefined ? 1 : opacity;
      const bucket = op >= .55 ? .82 : (op >= .3 ? .42 : .22);
      const key = tex.uuid + '|' + bucket;
      let b = _decBatches.get(key);
      if (!b) { b = { tex, op: bucket, geos: [] }; _decBatches.set(key, b); }
      const geo = new T.PlaneGeometry(w, h);
      geo.applyMatrix4(new T.Matrix4().compose(
        new T.Vector3(x, y, z),
        new T.Quaternion().setFromEuler(new T.Euler(rx || 0, ry || 0, rz || 0)),
        new T.Vector3(1, 1, 1)));
      b.geos.push(geo);
      return null;
    }
    function flushDecals() {
      _decBatches.forEach((b) => {
        const mat = new T.MeshBasicMaterial({
          map: b.tex, transparent: true, opacity: b.op, depthWrite: false,
          side: T.DoubleSide, alphaTest: .02, toneMapped: true,
          polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
        });
        const m = new T.Mesh(U.mergeGeometries(b.geos), mat);
        m.castShadow = false; m.receiveShadow = false; m.renderOrder = 2;
        g.add(m);
      });
      _decBatches.clear();
    }

    /* --------------------------------------------------------------- terrain */
    function coastX(z) {
      return SEA_X + 30 * Math.sin(z * 0.0028) + 16 * Math.sin(z * 0.0071 + 2.1) + 7 * Math.sin(z * 0.019 + 0.6);
    }
    // beach cross-shore profile, dx = x - coastX(z)
    const BEACH_PTS = [
      [-260, 0.92], [-110, 0.90], [-50, 0.80], [-14, 0.62], [0, 0.48],
      [16, 0.30], [34, 0.06], [50, -0.34], [74, -1.05], [120, -2.05],
      [220, -3.5], [460, -5.6]
    ];
    function beachH(dx) {
      if (dx <= BEACH_PTS[0][0]) return BEACH_PTS[0][1];
      for (let i = 0; i < BEACH_PTS.length - 1; i++) {
        const a = BEACH_PTS[i], b = BEACH_PTS[i + 1];
        if (dx <= b[0]) {
          const t = (dx - a[0]) / (b[0] - a[0]);
          return lerp(a[1], b[1], t * t * (3 - 2 * t));
        }
      }
      return BEACH_PTS[BEACH_PTS.length - 1][1];
    }
    function terrainH(x, z) {
      const xc = coastX(z), dx = x - xc;
      // inland: low rolling tropical coastal plain
      let h = GROUND_Y
        + 1.25 * U.fbm2(x * 0.0017 + 9.3, z * 0.0017 + 4.7, 4)
        + 0.42 * U.fbm2(x * 0.011 + 2.1, z * 0.011 + 8.4, 3)
        - 0.62;
      // far inland hills (west / north) give the horizon a soft silhouette
      const far = U.smooth(340, 1250, Math.abs(x) * .92 + Math.abs(z) * .55);
      h += far * 7.5 * (0.35 + 0.65 * U.fbm2(x * 0.00085 + 1.7, z * 0.00085 + 7.1, 3));
      // flatten the launch complex
      const fx = U.smooth(330, 250, Math.abs(x));
      const fz = U.smooth(350, 250, Math.abs(z));
      h = lerp(h, GROUND_Y, fx * fz * 0.97);
      // shore profile overrides inland height near the coast
      const w = U.smooth(-230, -90, dx);
      h = lerp(h, beachH(dx), w);
      return h;
    }

    const cGrassA = new T.Color(0x5a6749), cGrassB = new T.Color(0x848866);
    const cDry = new T.Color(0xa89b74), cSand = new T.Color(0xcabc9b);
    const cWet = new T.Color(0x8d8168), cSeaFloor = new T.Color(0x5f6f60);
    const cDust = new T.Color(0x8d8a7a);
    const cForest = new T.Color(0x3d5030);
    const FOREST_PATCHES = [
      [120, 0, 190, 400], [-40, 260, 300, 90], [-20, -270, 300, 90],
      [-420, 40, 160, 380], [-120, 70, 88, 70], [104, 76, 72, 62],
      [-52, -126, 115, 72], [116, -96, 60, 95], [-176, -52, 86, 86],
      [-880, -640, 300, 220], [148, -820, 220, 160]
    ];
    const _tc = new T.Color();
    function terrainColor(x, z, h, out) {
      const g1 = U.fbm2(x * 0.008 + 5, z * 0.008 + 2, 3);
      const g2 = U.fbm2(x * 0.038 + 1, z * 0.038 + 9, 2);
      _tc.copy(cGrassA).lerp(cGrassB, clamp(g1 * 1.15 - .07, 0, 1));
      _tc.lerp(cDry, clamp(g2 * 1.35 - .22, 0, .78));
      _tc.lerp(cDry, clamp(U.fbm2(x * 0.0026 + 4.2, z * 0.0026 + 1.9, 3) * 1.5 - .55, 0, .5));
      // beach / wet sand / shallow shelf
      _tc.lerp(cSand, U.smooth(.78, .08, h) * .92);
      _tc.lerp(cWet, U.smooth(.04, -.42, h) * .8);
      _tc.lerp(cSeaFloor, U.smooth(-.34, -1.7, h) * .75);
      // dusty apron around the pad complex
      const d = Math.min(Math.abs(x), Math.abs(z));
      _tc.lerp(cDust, (1 - U.smooth(210, 290, Math.max(Math.abs(x), Math.abs(z)))) * .16 * (1 - U.smooth(80, 160, d)));
      // darker, cooler ground under the tree masses so vegetation reads as one mass
      let fm = 0;
      for (let i = 0; i < FOREST_PATCHES.length; i++) {
        const f = FOREST_PATCHES[i];
        const dx = (x - f[0]) / f[2], dz = (z - f[1]) / f[3];
        const r2 = dx * dx + dz * dz;
        if (r2 < 1) fm = Math.max(fm, 1 - r2);
      }
      _tc.lerp(cForest, fm * .62);
      out.r = _tc.r; out.g = _tc.g; out.b = _tc.b;
    }

    const terrainGroup = U.group('terrain'); g.add(terrainGroup);
    function buildTerrain() {
      const half = 480, cells = 96, cell = half * 2 / cells, rowLen = cells + 1;
      const pos = [], col = [], uv = [], idx = [];
      const tcol = { r: 0, g: 0, b: 0 };
      const pushV = (x, z, f) => {
        const y = terrainH(x, z);
        pos.push(x, y, z);
        terrainColor(x, z, y, tcol);
        col.push(tcol.r, tcol.g, tcol.b);
        uv.push(x / 24, z / 24);
        return (pos.length / 3) - 1;
      };
      // inner grid (row-major z*rowLen+x)
      for (let iz = 0; iz <= cells; iz++) {
        for (let ix = 0; ix <= cells; ix++) pushV(-half + ix * cell, -half + iz * cell);
      }
      const gi = (ix, iz) => iz * rowLen + ix;
      // quads (upward winding)
      for (let iz = 0; iz < cells; iz++) {
        for (let ix = 0; ix < cells; ix++) {
          const a = gi(ix, iz), b = gi(ix + 1, iz), c = gi(ix + 1, iz + 1), d = gi(ix, iz + 1);
          idx.push(a, c, b, a, d, c);
        }
      }
      // outer ring: expand the square boundary to 4.2 km in K rows
      const K = 9, OUTER = 4200;
      const sideSeed = 0;
      for (let side = 0; side < 4; side++) {
        const rows = [];
        const inner = [];
        for (let j = 0; j <= cells; j++) {
          let x, z;
          if (side === 0) { x = -half + j * cell; z = half; }
          else if (side === 1) { x = half; z = half - j * cell; }
          else if (side === 2) { x = half - j * cell; z = -half; }
          else { x = -half; z = -half + j * cell; }
          inner.push(gi((x + half) / cell, (z + half) / cell));
          rows.push(inner);
        }
        for (let k = 1; k <= K; k++) {
          const hk = half + (OUTER - half) * Math.pow(k / K, 1.7);
          const f = hk / half;
          const row = [];
          for (let j = 0; j <= cells; j++) {
            let x, z;
            if (side === 0) { x = -half + j * cell; z = half; }
            else if (side === 1) { x = half; z = half - j * cell; }
            else if (side === 2) { x = half - j * cell; z = -half; }
            else { x = -half; z = -half + j * cell; }
            row.push(pushV(x * f, z * f));
          }
          rows.push(row);
        }
        // stitch rows
        for (let k = 0; k < K; k++) {
          const r0 = rows[k], r1 = rows[k + 1];
          for (let j = 0; j < cells; j++) {
            const a = r0[j], b = r0[j + 1], c = r1[j + 1], d = r1[j];
            // choose winding so the face normal points up
            const ax = pos[a * 3], ay = pos[a * 3 + 1], az = pos[a * 3 + 2];
            const bx = pos[b * 3], by = pos[b * 3 + 1], bz = pos[b * 3 + 2];
            const cx = pos[c * 3], cy = pos[c * 3 + 1], cz = pos[c * 3 + 2];
            const ux = bx - ax, uy = by - ay, uz = bz - az;
            const vx = cx - ax, vy = cy - ay, vz = cz - az;
            const ny = uz * vx - ux * vz;
            if (ny >= 0) idx.push(a, b, c, a, c, d); else idx.push(a, c, b, a, d, c);
          }
        }
      }
      const geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      geo.setAttribute('color', new T.Float32BufferAttribute(col, 3));
      geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      const mat = new T.MeshStandardMaterial({
        map: terrainDetail, vertexColors: true, roughness: .97, metalness: .0, color: 0xffffff
      });
      const mesh = new T.Mesh(geo, mat);
      mesh.name = 'coastal-terrain';
      mesh.receiveShadow = true;
      mesh.castShadow = false;
      terrainGroup.add(mesh);
      return mesh;
    }
    buildTerrain();

    // shore rocks along the waterline
    (function buildRocks() {
      const list = [];
      const rockGeo = new T.IcosahedronGeometry(1, 0);
      for (let z = -1000; z <= 1000; z += R(20, 46)) {
        const n = RI(0, 2);
        for (let i = 0; i < n; i++) {
          const dx = R(20, 70) + (rng.next() < .25 ? R(60, 150) : 0);
          const x = coastX(z) + dx + R(-8, 8);
          const y = terrainH(x, z);
          if (y < -.5) continue;
          const sy = R(.5, 1.5), sx = R(1, 3.0), sz2 = R(1, 2.8);
          list.push({
            p: [x, y + sy * .25, z + R(-12, 12)],
            r: [R(0, 1), R(0, 6.28), R(0, 1)],
            s: [sx, sy, sz2],
            c: rng.next() < .4 ? 0x4f514a : (rng.next() < .5 ? 0x67685e : 0x7a796d)
          });
        }
      }
      // a few bigger outcrops near the south end of the shore
      for (let i = 0; i < 5; i++) {
        const z = R(160, 620);
        const x = coastX(z) + R(44, 120);
        list.push({
          p: [x, terrainH(x, z) + .8, z], r: [R(-.2, .2), R(0, 6.28), R(-.2, .2)],
          s: [R(4, 8), R(1.8, 3.4), R(3.5, 7)], c: 0x5e5f55
        });
      }
      makeInstanced(rockGeo, M.rock, list, { name: 'shore-rocks', cast: true, receive: true });
    })();

    /* ================================================================ 101 工位 */
    const padGroup = U.group('pad-101'); g.add(padGroup);
    M.deflector = std({ color: 0x4b4d48, roughness: .58, metalness: .55 });
    M.bank = std({
      map: terrainDetail, color: 0x6d7d52, roughness: .97, metalness: .0
    });
    M.drain = std({ color: 0x8b8778, roughness: .9, metalness: .02 });

    (function buildPad() {
      const P = padGroup;
      const y = PAD.deckY;

      /* -- raised hardstand: three slabs leave the flame-trench open -------- */
      const deck = new Builder(M.concreteDeck);
      deck.addGeo(boxUV(78, 7, 28, 6), 0, 3.5, -21);     // north of trench
      deck.addGeo(boxUV(78, 7, 28, 6), 0, 3.5, 21);      // south of trench
      deck.addGeo(boxUV(31, 7, 14, 6), -23.5, 3.5, 0);   // west of the opening
      deck.mesh(P, { name: 'pad-deck' });

      // pale coping band around the exposed deck edge
      const cope = new Builder(M.concretePale);
      cope.box(78.6, .30, .55, 0, y + .12, -34.9);
      cope.box(78.6, .30, .55, 0, y + .12, 34.9);
      cope.box(.55, .30, 70.2, -38.9, y + .12, 0);
      cope.box(.55, .30, 28, 38.9, y + .12, -21);
      cope.box(.55, .30, 28, 38.9, y + .12, 21);
      cope.mesh(P);

      // vertical expansion joints / wall staining bands on the outer faces
      const seams = new Bars(unitBox);
      for (let x = -36; x <= 36; x += 6) {
        seams.add(x, .15, 35.03, x, 6.9, 35.03, .09, .12);
        seams.add(x, .15, -35.03, x, 6.9, -35.03, .09, .12);
      }
      for (let z = -33; z <= 33; z += 6) {
        seams.add(-39.03, .15, z, -39.03, 6.9, z, .09, .12);
      }
      seams.flush(M.concreteDark, P, { cast: false });

      /* -- flame trench ---------------------------------------------------- */
      // floor
      const trench = new Builder(M.trench);
      trench.addGeo(boxUV(47, .95, 14, 6), 15.5, .47, 0);
      // deflector apron / exit apron outside the pad edge
      trench.addGeo(boxUV(20, .8, 24, 6), 49, .4, 0);
      trench.mesh(P);
      // scorched trench floor + exit streaks
      decalAt(P, sootTex, 46, 13, 15.5, .96, 0, -PI / 2, 0, 0, .86);
      decalAt(P, sootTex, 14, 12.4, 47, .82, 0, -PI / 2, 0, 0, .7);
      decalAt(P, stainTex, 34, 20, 12, y + .022, 0, -PI / 2, 0, 0, .5);

      // flame deflector: a heat-stained steel hump that turns the exhaust east
      (function deflector() {
        const pts = [
          new T.Vector2(-7.4, .95), new T.Vector2(-5.6, .95), new T.Vector2(-4.4, 2.1),
          new T.Vector2(-2.6, 3.7), new T.Vector2(-.4, 4.85), new T.Vector2(2.2, 4.3),
          new T.Vector2(4.6, 2.9), new T.Vector2(6.6, 1.55), new T.Vector2(8.3, .95), new T.Vector2(9.2, .95)
        ];
        const shape = new T.Shape();
        shape.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i].x, pts[i].y);
        shape.lineTo(9.2, .0); shape.lineTo(-7.4, .0);
        const geo = new T.ExtrudeGeometry(shape, { depth: 11.6, bevelEnabled: false, curveSegments: 3 });
        geo.translate(0, 0, -5.8);
        const m = new T.Mesh(geo, M.deflector);
        m.castShadow = true; m.receiveShadow = true;
        P.add(m);
        // stiffener ribs across the deflector + side stringers
        const rib = new Bars(unitBox);
        const prof = [[-4.4, 2.1], [-2.6, 3.7], [-.4, 4.85], [2.2, 4.3], [4.6, 2.9], [6.6, 1.55]];
        for (let i = 0; i < prof.length; i++) {
          const px = prof[i][0], py = prof[i][1];
          for (const z of [-6.1, -3.6, -1.2, 1.2, 3.6, 6.1]) rib.add(px, py - .28, z, px, py + .1, z, .16, .34);
        }
        // heat-darkened lip along the crest
        rib.add(-.4, 4.85, -5.9, -.4, 4.85, 5.9, .22, .3);
        rib.flush(M.steelDark, P);
      })();

      // deluge ring + nozzles inside the trench
      const del = new Builder(M.pipe);
      for (const z of [-5.9, 5.9]) {
        del.addGeo(new T.CylinderGeometry(.26, .26, 17, 8), - .5, 1.5, z, 0, 0, PI / 2);
      }
      for (let i = 0; i < 9; i++) {
        const x = -6 + i * 1.9;
        del.addGeo(new T.CylinderGeometry(.09, .11, .9, 6), x, 1.55, 5.2, .5, 0, 0);
        del.addGeo(new T.CylinderGeometry(.09, .11, .9, 6), x, 1.55, -5.2, -.5, 0, 0);
      }
      del.mesh(P);

      // trench exit wing walls + hazard lips
      const wing = new Builder(M.concretePale);
      wing.addGeo(new T.BoxGeometry(13, 4.6, .9), 44.5, 2.3, 8.8, 0, .38, 0);
      wing.addGeo(new T.BoxGeometry(13, 4.6, .9), 44.5, 2.3, -8.8, 0, -.38, 0);
      wing.mesh(P);
      const hz = new Builder(M.hazard);
      flatStripeStrip(hz, 9, .8, 44.5, 4.62, 8.55, .38);
      flatStripeStrip(hz, 9, .8, 44.5, 4.62, -8.55, -.38);
      hz.mesh(P);

      // big deluge pipe ring around the MLP on the deck
      (function delugeRing() {
        const d = new Builder(M.pipe);
        const yy = y + .55, r = .3;
        const ax = 16.5, az = 15.2;
        d.addGeo(new T.CylinderGeometry(r, r, ax * 2, 8), 0, yy, az, 0, 0, PI / 2);
        d.addGeo(new T.CylinderGeometry(r, r, ax * 2, 8), 0, yy, -az, 0, 0, PI / 2);
        d.addGeo(new T.CylinderGeometry(r, r, az * 2, 8), ax, yy, 0, PI / 2, 0, 0);
        d.addGeo(new T.CylinderGeometry(r, r, az * 2, 8), -ax, yy, 0, PI / 2, 0, 0);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
          d.addGeo(new T.SphereGeometry(r * 1.25, 8, 6), sx * ax, yy, sz * az);
          // vertical rainbird risers
          d.addGeo(new T.CylinderGeometry(.16, .2, 2.4, 8), sx * ax, yy + 1.1, sz * az);
          d.addGeo(new T.CylinderGeometry(.1, .3, .55, 8), sx * ax, yy + 2.4, sz * az, .5 * -sz, 0, .5 * sx);
          // red valve wheel
          d.addGeo(new T.CylinderGeometry(.34, .34, .12, 10), sx * (ax - 1.6), yy, sz * az, PI / 2, 0, 0);
        }
        // supports
        for (let i = -2; i <= 2; i++) {
          d.addGeo(new T.BoxGeometry(.4, .55, .4), i * 6.5, y + .27, az);
          d.addGeo(new T.BoxGeometry(.4, .55, .4), i * 6.5, y + .27, -az);
          d.addGeo(new T.BoxGeometry(.4, .55, .4), ax, y + .27, i * 6.2);
          d.addGeo(new T.BoxGeometry(.4, .55, .4), -ax, y + .27, i * 6.2);
        }
        d.mesh(P);
      })();

      /* -- painted markings ------------------------------------------------ */
      const mkWhite = new Builder(M.markWhite);
      const mkYellow = new Builder(M.markYellow);
      const mkRed = new Builder(M.markRed);
      const mkHaz = new Builder(M.hazard);
      // perimeter safety line
      for (const z of [-33.4, 33.4]) addGroundMark(mkWhite, 77, .45, 0, y + .025, z);
      for (const x of [-37.4, 37.4]) addGroundMark(mkWhite, .45, 66, x, y + .025, 0);
      // yellow operating boundary around the MLP
      for (const z of [-15.5, 15.5]) addGroundMark(mkYellow, 36, .5, 0, y + .024, z);
      for (const x of [-17.5, 17.5]) addGroundMark(mkYellow, .5, 31, x, y + .024, 0);
      // hazard chevrons at the platform / trench mouth
      for (let i = 0; i < 4; i++) {
        flatStripeStrip(mkHaz, 30, .7, 0, y + .028, -13.8 - i * .9, 0);
        flatStripeStrip(mkHaz, 30, .7, 0, y + .028, 13.8 + i * .9, 0);
      }
      flatStripeStrip(mkHaz, 7, .8, 0, y + .0, -7.2, -PI / 2);
      flatStripeStrip(mkHaz, 7, .8, 0, y + .0, 7.2, PI / 2);
      // red no-go kerbs near the exhaust opening
      for (const z of [-7.6, 7.6]) addGroundMark(mkRed, 30, .3, 0, y + .026, z);
      mkWhite.mesh(P, { cast: false, receive: true });
      mkYellow.mesh(P, { cast: false, receive: true });
      mkRed.mesh(P, { cast: false, receive: true });
      mkHaz.mesh(P, { cast: false, receive: true });

      // pad number painted on the concrete (facing the hero camera)
      const numTex = U.texText('101', {
        w: 512, h: 256, size: 216, color: '#d9d3c1', weight: '600', align: 'center'
      });
      decalAt(P, numTex, 19, 9.5, -19, y + .03, 25, -PI / 2, 0, -0.10, .92);
      const num2 = U.texText('LC-101', {
        w: 512, h: 128, size: 88, color: '#cfc9b8', weight: '500', align: 'center'
      });
      decalAt(P, num2, 11, 2.75, 25, y + .03, 28, -PI / 2, 0, .06, .8);

      // blast / scorch stains around the opening
      for (let i = 0; i < 5; i++) {
        decalAt(P, stainTex, R(10, 20), R(8, 15), R(-14, 14), y + .021, R(-12, 12) * (i % 2 ? 1 : -1),
          -PI / 2, 0, R(0, TAU), R(.12, .3));
      }

      /* -- apron banks + stairs + ramp ------------------------------------ */
      (function banks() {
        // sloped grass/concrete bank from deck edge down to the terrain
        const b = new T.BufferGeometry();
        const vs = [], ns = [], uvs = [], ids = [];
        const y0 = GROUND_Y;
        const bank = 12;
        const edge = [
          [[-39, 35], [-39 + .0, 35 + bank]], // placeholder replaced below
        ];
        // south bank
        const addBankQuad = (ax, az, bx, bz, cx, cz, dx, dz, topY) => {
          const base = vs.length / 3;
          const push = (px, py, pz) => { vs.push(px, py, pz); uvs.push(px / 6, pz / 6); };
          push(ax, topY, az); push(bx, topY, bz); push(cx, y0 - .2, cz); push(dx, y0 - .2, dz);
          ids.push(base, base + 2, base + 1, base, base + 3, base + 2);
        };
        // south (z = +35 -> +51)
        addBankQuad(-39.2, 35, 39.2, 35, 39.2 + 4, 35 + bank, -39.2 - 4, 35 + bank, y);
        // north
        addBankQuad(39.2, -35, -39.2, -35, -39.2 - 4, -35 - bank, 39.2 + 4, -35 - bank, y);
        // west (x = -39 -> -55)
        addBankQuad(-39, -35.2, -39, 35.2, -39 - bank, 35.2 + 4, -39 - bank, -35.2 - 4, y);
        // east: the pad drops straight to the trench apron
        addBankQuad(39, 35.2, 39, 8.6, 39 + 8, 8.6 + 3, 39 + 8, 35.2, y);
        addBankQuad(39, -8.6, 39, -35.2, 39 + 8, -35.2, 39 + 8, -8.6 - 3, y);
        b.setAttribute('position', new T.Float32BufferAttribute(vs, 3));
        b.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
        b.setIndex(ids);
        b.computeVertexNormals();
        const bankMesh = new T.Mesh(b, M.bank);
        bankMesh.receiveShadow = true;
        P.add(bankMesh);
        // concrete edge gutter around the base of the deck
        const gut = new Builder(M.concretePale);
        gut.box(86, .5, 1.6, 0, GROUND_Y + .1, 43.4);
        gut.box(86, .5, 1.6, 0, GROUND_Y + .1, -43.4);
        gut.box(1.6, .5, 86, -47.4, GROUND_Y + .1, 0);
        gut.mesh(P, { cast: false });
      })();

      // stair flights from ground to deck (south + west)
      (function stairs() {
        const steps = new Builder(M.concretePale);
        const rails = new Bars(unitBox);
        function flight(ox, oz, dirX, dirZ, rotY) {
          // dir: outward direction from the deck edge (unit)
          const n = 20, rise = (y - GROUND_Y) / n, run = .46;
          for (let i = 0; i < n; i++) {
            steps.addGeo(new T.BoxGeometry(3.4, rise, run + .02),
              ox + dirX * (i * run + run / 2), y - rise * (i + 1) + rise / 2, oz + dirZ * (i * run + run / 2), 0, rotY, 0);
          }
          // stringers
          for (const s of [-1.65, 1.65]) {
            const px = ox + dirX * 4.7, pz = oz + dirZ * 4.7;
            rails.add(px + (dirZ ? s : 0), GROUND_Y + .9, pz + (dirX ? s : 0),
              px - dirX * .2, y + .9, pz - dirZ * .2, .12, .12);
            for (let i = 0; i <= 6; i++) {
              const t = i / 6;
              const cx = ox + dirX * (4.7) * (1 - t), cz = oz + dirZ * 4.7 * (1 - t);
              const cy = lerp(GROUND_Y, y, t);
              rails.add(cx + (dirZ ? s : 0), cy, cz + (dirX ? s : 0), cx + (dirZ ? s : 0), cy + 1.0, cz + (dirX ? s : 0), .1, .1);
            }
          }
        }
        // south stair (runs outward in +z), west stair (+? runs outward in -x)
        flight(20, 35.4, 0, 1, 0);
        flight(-39.4, 14, -1, 0, 0);
        steps.mesh(P);
        rails.flush(M.steelDark, P);
        // handrails (two horizontal runs)
        const hr = new Builder(M.steelDark);
        hr.addGeo(new T.BoxGeometry(3.8, .09, .09), 20, y + 1.05, 35.6);
        hr.mesh(P);
      })();

      // vehicle access ramp (south-west corner)
      (function ramp() {
        const ang = Math.atan2(6.1, 21);
        const ramp = new Builder(M.concretePale);
        const geo = boxUV(11, .5, 22, 6);
        ramp.addGeo(geo, -30, (y + GROUND_Y) / 2 - .1, 35 + 10.6, ang, 0, 0);
        ramp.addGeo(new T.BoxGeometry(.6, 1.1, 22), -35.6, (y + GROUND_Y) / 2 + .3, 45.6, ang, 0, 0);
        ramp.addGeo(new T.BoxGeometry(.6, 1.1, 22), -24.4, (y + GROUND_Y) / 2 + .3, 45.6, ang, 0, 0);
        ramp.mesh(P);
      })();

      /* -- floodlight poles on the deck ----------------------------------- */
      (function poles() {
        const poles = new Builder(M.steel);
        const heads = [];
        const defs = [
          [-33, 29, -.6, 1.7], [33, 29, .6, 1.7], [-33, -29, -.6, -1.7],
          [33, -29, .6, -1.7], [-36, 0, 1.7, 0], [36, 0, -1.7, 0]
        ];
        defs.forEach(dd => {
          const [px, pz, ox, oz] = dd;
          const L = Math.hypot(ox, oz) || 1, fx = ox / L, fz = oz / L;
          const axx = -fz, axz = fx;                       // arm axis (perpendicular)
          const armRy = Math.atan2(-axz, axx);
          poles.addGeo(new T.CylinderGeometry(.22, .38, 20, 8), px, y + 10, pz);
          const armY = y + 20;
          const cx = px + fx * .55, cz = pz + fz * .55;
          poles.addGeo(new T.BoxGeometry(3.2, .2, .2), cx, armY, cz, 0, armRy, 0);
          poles.addGeo(new T.BoxGeometry(.5, .5, .5), px, armY - .4, pz);
          for (let i = -1; i <= 1; i++) {
            heads.push({
              p: [cx + axx * i * 1.02, armY + .34, cz + axz * i * 1.02],
              r: [0, Math.atan2(-fx, -fz), 0],
              s: [.82, .5, .3]
            });
          }
        });
        poles.mesh(P);
        makeInstanced(unitBox, M.lampWhite, heads, { name: 'deck-floodlights', cast: false });
        // small warm glows
        defs.forEach(dd => {
          const sp = U.sprite(glowTex, 0xffe6b8, 10, 0);
          const L = Math.hypot(dd[2], dd[3]) || 1;
          sp.position.set(dd[0] + dd[2] / L * .55, y + 20.4, dd[1] + dd[3] / L * .55);
          sp.material.depthWrite = false;
          g.add(sp); glows.push({ sp, base: .55 });
        });
      })();

      // bollards + drainage grates around the apron
      (function bollards() {
        const b = new Builder(M.markYellow);
        const posts = [];
        for (let i = 0; i < 26; i++) {
          const t = i / 26 * TAU;
          const x = Math.cos(t) * 42, z = Math.sin(t) * 38;
          if (Math.abs(x) < 40 && Math.abs(z) < 36) continue;
          posts.push({ p: [x, terrainH(x, z) + .55, z], s: [.42, 1.1, .42] });
          b.addGeo(new T.BoxGeometry(.5, .5, .5), x, terrainH(x, z) + .55, z);
        }
        makeInstanced(unitBox, M.markYellow, posts, { cast: true });
      })();
    })();

    /* ----------------------------------------------- mobile launch platform */
    (function buildMLP() {
      const P = U.group('mlp'); padGroup.add(P);
      const y0 = PAD.deckY, y1 = PAD.mlpTop;

      // girder ring (outer 24x24, central 12x12 exhaust opening)
      const body = new Builder(M.plate);
      body.addGeo(boxUV(24, 3.4, 6, 4), 0, y1 - 2.0, -9);
      body.addGeo(boxUV(24, 3.4, 6, 4), 0, y1 - 2.0, 9);
      body.addGeo(boxUV(6, 3.4, 12, 4), -9, y1 - 2.0, 0);
      body.addGeo(boxUV(6, 3.4, 12, 4), 9, y1 - 2.0, 0);
      // lower frame + jacking pads
      body.addGeo(boxUV(24, 1.3, 6, 4), 0, y0 + .65, -9);
      body.addGeo(boxUV(24, 1.3, 6, 4), 0, y0 + .65, 9);
      body.addGeo(boxUV(6, 1.3, 12, 4), -9, y0 + .65, 0);
      body.addGeo(boxUV(6, 1.3, 12, 4), 9, y0 + .65, 0);
      body.mesh(P, { name: 'mlp-body' });

      // top walkway plates (leave the exhaust opening open)
      const top = new Builder(M.plate);
      top.addGeo(boxUV(24, .26, 6, 3), 0, y1 - .13, -9);
      top.addGeo(boxUV(24, .26, 6, 3), 0, y1 - .13, 9);
      top.addGeo(boxUV(6, .26, 12, 3), -9, y1 - .13, 0);
      top.addGeo(boxUV(6, .26, 12, 3), 9, y1 - .13, 0);
      // central opening lip / gutters
      top.addGeo(boxUV(12.5, .32, .45, 3), 0, y1 + .02, -6.15);
      top.addGeo(boxUV(12.5, .32, .45, 3), 0, y1 + .02, 6.15);
      top.addGeo(boxUV(.45, .32, 11.6, 3), -6.15, y1 + .02, 0);
      top.addGeo(boxUV(.45, .32, 11.6, 3), 6.15, y1 + .02, 0);
      top.mesh(P, { name: 'mlp-top' });

      // side stiffeners + horizontal seams
      const bars = new Bars(unitBox);
      const barsO = new Bars(unitBox);
      for (let i = -11; i <= 11; i += 1.6) {
        for (const zz of [-12.03, 12.03]) bars.add(i, y0 + .2, zz, i, y1 - .25, zz, .16, .1);
        for (const xx of [-12.03, 12.03]) bars.add(xx, y0 + .2, i, xx, y1 - .25, i, .1, .16);
      }
      for (const yy of [y0 + 1.45, y1 - 1.6, y1 - .5]) {
        bars.add(-12.02, yy, -12.02, 12.02, yy, -12.02, .1, .16);
        bars.add(-12.02, yy, 12.02, 12.02, yy, 12.02, .1, .16);
        bars.add(-12.02, yy, -12.02, -12.02, yy, 12.02, .16, .1);
        bars.add(12.02, yy, -12.02, 12.02, yy, 12.02, .16, .1);
      }
      // outer perimeter railing
      for (let i = -12; i <= 12; i += 2) {
        bars.add(i, y1, -11.8, i, y1 + 1.1, -11.8, .1, .1);
        bars.add(i, y1, 11.8, i, y1 + 1.1, 11.8, .1, .1);
        bars.add(-11.8, y1, i, -11.8, y1 + 1.1, i, .1, .1);
        bars.add(11.8, y1, i, 11.8, y1 + 1.1, i, .1, .1);
      }
      for (const yy of [y1 + 1.1, y1 + .58]) {
        bars.add(-11.8, yy, -11.8, 11.8, yy, -11.8, .07, .07);
        bars.add(-11.8, yy, 11.8, 11.8, yy, 11.8, .07, .07);
        bars.add(-11.8, yy, -11.8, -11.8, yy, 11.8, .07, .07);
        bars.add(11.8, yy, -11.8, 11.8, yy, 11.8, .07, .07);
      }
      // inner exhaust-opening railing
      for (let i = -6; i <= 6; i += 2) {
        bars.add(i, y1, -6.3, i, y1 + 1.05, -6.3, .08, .08);
        bars.add(i, y1, 6.3, i, y1 + 1.05, 6.3, .08, .08);
        bars.add(-6.3, y1, i, -6.3, y1 + 1.05, i, .08, .08);
        bars.add(6.3, y1, i, 6.3, y1 + 1.05, i, .08, .08);
      }
      for (const yy of [y1 + 1.05, y1 + .55]) {
        bars.add(-6.3, yy, -6.3, 6.3, yy, -6.3, .06, .06);
        bars.add(-6.3, yy, 6.3, 6.3, yy, 6.3, .06, .06);
        bars.add(-6.3, yy, -6.3, -6.3, yy, 6.3, .06, .06);
        bars.add(6.3, yy, -6.3, 6.3, yy, 6.3, .06, .06);
      }
      bars.flush(M.steelDark, P);

      // hazard bands on all four faces
      const hz = new Builder(M.hazard);
      for (const zz of [-12.06, 12.06]) {
        const g1 = planeUV(23, .6, 1.6);
        hz.addGeo(g1, 0, y0 + 1.05, zz, 0, zz > 0 ? 0 : PI, 0);
      }
      for (const xx of [-12.06, 12.06]) {
        const g1 = planeUV(23, .6, 1.6);
        hz.addGeo(g1, xx, y0 + 1.05, 0, 0, xx > 0 ? PI / 2 : -PI / 2, 0);
      }
      hz.mesh(P, { cast: false });

      /* -- equipment on the walkway ring ---------------------------------- */
      const equip = new Builder(M.steelWhite);
      const equipD = new Builder(M.steelDark);
      const equipR = new Builder(M.redPaint);
      const drawers = [
        [-8.6, -9, 1.6, 1.5, 1.1, 0], [-7, -9, 1.1, 1.1, .9, 0], [8.4, -9, 1.4, 1.3, 1.0, 0],
        [-9, 8.8, 1.8, 1.2, .9, 0], [8.8, 8.8, 1.2, 1.6, 1.0, 0], [2.6, -9.6, 1.2, 1.0, .8, 0],
        [-2.8, 9.6, 1.3, 1.1, .9, 0], [9.4, 2.4, 1.0, 1.4, .8, 0]
      ];
      drawers.forEach(d => equip.box(d[2], d[3], d[4], d[0], y1 + d[3] / 2, d[1]));
      equip.mesh(P);
      // cable trays + conduits running along the walkway
      equipD.addGeo(new T.BoxGeometry(21, .22, .55), 0, y1 + .16, -11.1);
      equipD.addGeo(new T.BoxGeometry(21, .22, .55), 0, y1 + .16, 11.1);
      equipD.addGeo(new T.BoxGeometry(.55, .22, 21), -11.1, y1 + .16, 0);
      equipD.addGeo(new T.BoxGeometry(.55, .22, 21), 11.1, y1 + .16, 0);
      equipD.mesh(P);
      const pipes = new Builder(M.pipe);
      pipes.addGeo(new T.CylinderGeometry(.13, .13, 22, 8), -11.4, y1 + .55, 10.4, 0, 0, PI / 2);
      pipes.addGeo(new T.CylinderGeometry(.1, .1, 22, 8), 11.4, y1 + .45, -10.4, 0, 0, PI / 2);
      pipes.addGeo(new T.CylinderGeometry(.16, .16, 20, 8), -10.4, y1 + .5, -11.4, 0, 0, PI / 2);
      pipes.mesh(P);
      // red service boxes on the corners
      [[-11.2, -11.2], [11.2, -11.2], [-11.2, 11.2], [11.2, 11.2]].forEach(c => {
        equipR.box(1.1, 1.2, 1.1, c[0], y1 + .6, c[1]);
      });
      equipR.mesh(P);

      /* -- hold-down posts + clamps around the rocket tail ----------------- */
      (function holdDown() {
        const dark = new Bars(unitBox);
        const clamp = new Builder(M.steelDark);
        const red = new Builder(M.redPaint);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
          const bx = sx * 4.7, bz = sz * 4.7, tx = sx * 4.05, tz = sz * 4.05;
          dark.add(bx, y1, bz, tx, 17.1, tz, .78, .78);
          dark.add(sx * 5.05, y1 + .2, sz * 5.05, tx + sx * .35, 15.4, tz + sz * .35, .32, .32);
          dark.add(sx * 5.05, y1 + .2, sz * 5.05, tx + sx * .35, 13.2, tz + sz * .35, .32, .32);
          // clamp head, reaching in toward the booster skirt
          const ry = Math.atan2(-(-sx), -(-sz));
          clamp.addGeo(new T.BoxGeometry(1.5, .62, .95), tx - sx * .35, 17.0, tz - sz * .35, 0, ry, 0);
          clamp.addGeo(new T.BoxGeometry(.75, .9, .75), tx, 16.35, tz, 0, ry, 0);
          red.addGeo(new T.BoxGeometry(.5, .16, 1.02), tx - sx * 1.0, 17.28, tz - sz * 1.0, 0, ry, 0);
          // hydraulic cylinder
          clamp.addGeo(new T.CylinderGeometry(.14, .14, .9, 8), tx - sx * .2, 15.95, tz - sz * .2, .5, 0, .5);
        }
        dark.flush(M.steelDark, P);
        clamp.mesh(P);
        red.mesh(P);
      })();

      /* -- tail service masts + umbilical hoses --------------------------- */
      (function umbilicals() {
        const bars = new Bars(unitBox);
        const white = new Builder(M.steelWhite);
        const hoses = [];
        function mast(mx, mz, h) {
          const top = y1 + h;
          for (const sx of [-.9, .9]) for (const sz of [-.9, .9]) {
            bars.add(mx + sx, y1, mz + sz, mx + sx * .72, top, mz + sz * .72, .15, .15);
            bars.add(mx + sx, y1 + h * .35, mz + sz, mx + sx, y1 + h * .65, mz + sz, .1, .1);
          }
          for (let i = 1; i < 5; i++) {
            const yy = y1 + h * i / 5;
            const w = 1.7 - i * .1;
            for (const sz of [-1, 1]) bars.add(mx - w, yy, mz + sz * w, mx + w, yy, mz + sz * w, .1, .1);
            for (const sx of [-1, 1]) bars.add(mx + sx * w, yy, mz - w, mx + sx * w, yy, mz + w, .1, .1);
          }
          white.box(2.2, 1.1, 1.6, mx, top + .4, mz);
          white.box(.8, .5, .5, mx - .8, top + .9, mz);
        }
        mast(-10.2, 9.9, 10.6);
        mast(9.9, -10.2, 9.2);
        bars.flush(M.steel, P);
        white.mesh(P);
        // flexible hoses up to the rocket
        function hose(pts, r) {
          const geo = new T.TubeGeometry(new T.CatmullRomCurve3(pts), 18, r, 5, false);
          hoses.push(geo);
        }
        hose([V3(-9.4, 20.4, 9.2), V3(-7.2, 21.6, 7.2), V3(-5.2, 22.4, 5.0), V3(-3.4, 23.0, 3.4)], .17);
        hose([V3(-8.6, 19.2, 10.0), V3(-6.4, 19.8, 7.8), V3(-4.4, 20.6, 5.4), V3(-3.0, 21.2, 3.2)], .13);
        hose([V3(9.0, 18.6, -9.4), V3(7.0, 19.4, -7.4), V3(5.0, 20.2, -5.0), V3(3.2, 20.8, -3.2)], .15);
        const hm = new T.Mesh(U.mergeGeometries(hoses), M.rubber);
        hm.castShadow = true; P.add(hm);
      })();

      /* -- access stairs on the platform ---------------------------------- */
      (function mlpStairs() {
        const steps = new Builder(M.steelDark);
        const rails = new Bars(unitBox);
        function stair(ox, oz, dx, dz) {
          const n = 12, rise = (y1 - y0) / n, run = .38;
          for (let i = 0; i < n; i++) {
            steps.addGeo(new T.BoxGeometry(2.0, rise * .35, run),
              ox + dx * (i * run + run / 2), y0 + rise * (i + .5), oz + dz * (i * run + run / 2));
          }
          for (const s of [-1.05, 1.05]) {
            rails.add(ox + (dz ? s : 0), y0 + .9, oz + (dx ? s : 0),
              ox + dx * 4.6 + (dz ? s : 0), y1 + .9, oz + dz * 4.6 + (dx ? s : 0), .09, .09);
          }
        }
        stair(-10.9, 13.1, 0, -1);
        stair(10.9, -13.1, 0, 1);
        steps.mesh(P);
        rails.flush(M.steelDark, P);
      })();

      // lamp heads on the platform corners
      const lampsList = [];
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        lampsList.push({
          p: [sx * 11.6, y1 + 3.4, sz * 11.6],
          r: [0, Math.atan2(-sx, -sz), 0],
          s: [.62, .4, .26]
        });
      }
      makeInstanced(unitBox, M.lampWhite, lampsList, { cast: false });

      // painted "MLP" corner marks + platform number
      const numTex = U.texText('01', { w: 256, h: 256, size: 190, color: '#ded8c6', weight: '600' });
      decalAt(P, numTex, 2.6, 2.6, 0, y1 + .02, -9.2, -PI / 2, 0, 0, .8);
    })();

    /* ================================================== fixed service tower */
    (function buildTower() {
      const P = U.group('service-tower'); g.add(P);
      const TX = SPEC.tower.x, TZ = SPEC.tower.z;
      const baseY = PAD.deckY, topY = SPEC.tower.top;
      const NB = 14;
      const ys = [], halves = [];
      for (let i = 0; i <= NB; i++) {
        const t = i / NB;
        ys.push(baseY + 1.3 + (topY - baseY - 1.3) * t);
        halves.push(lerp(7.7, 5.85, smooth(0, 1, t)));
      }
      const cy = (i) => ys[i];
      const H = (i) => halves[i];
      const cxy = (i, sx, sz) => [TX + sx * H(i), cy(i), TZ + sz * H(i)];

      const frame = new Bars(unitBox);       // main white-grey structural steel
      const rail = new Bars(unitBox);        // dark handrails / stair rails

      // corner columns
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        for (let i = 0; i < NB; i++) {
          const a = cxy(i, sx, sz), b = cxy(i + 1, sx, sz);
          frame.add(a[0], a[1], a[2], b[0], b[1], b[2], .74, .74);
        }
      }
      // X bracing + mid-face verticals + horizontal belts
      const faces = [
        [1, 1, 1, -1],   // +x face: (sx=1,sz=1) -> (sx=1,sz=-1)
        [-1, 1, -1, -1], // -x face
        [1, 1, -1, 1],   // +z face
        [1, -1, -1, -1]  // -z face
      ];
      for (let i = 0; i < NB; i++) {
        for (const f of faces) {
          const a = cxy(i, f[0], f[1]), b = cxy(i, f[2], f[3]);
          const a2 = cxy(i + 1, f[0], f[1]), b2 = cxy(i + 1, f[2], f[3]);
          frame.add(a[0], a[1], a[2], b2[0], b2[1], b2[2], .33, .33);
          frame.add(b[0], b[1], b[2], a2[0], a2[1], a2[2], .33, .33);
          // mid-face vertical member
          const mx0 = (a[0] + b[0]) / 2, mz0 = (a[2] + b[2]) / 2;
          const mx1 = (a2[0] + b2[0]) / 2, mz1 = (a2[2] + b2[2]) / 2;
          frame.add(mx0, a[1], mz0, mx1, a2[1], mz1, .24, .24);
        }
        // horizontal belt at each level
        for (const f of faces) {
          const a = cxy(i, f[0], f[1]), b = cxy(i, f[2], f[3]);
          frame.add(a[0], a[1], a[2], b[0], b[1], b[2], .38, .38);
        }
      }

      /* -- walkway platforms (rings) with orange safety edges -------------- */
      const plat = new Builder(M.steelDark);
      const orange = new Builder(M.orange);
      for (let i = 1; i <= NB; i++) {
        const h = H(i), yy = ys[i];
        plat.box(2 * h - 2.2, .24, 1.3, TX, yy, TZ + h - .65);
        plat.box(2 * h - 2.2, .24, 1.3, TX, yy, TZ - h + .65);
        plat.box(1.3, .24, 2 * h - 2.2, TX + h - .65, yy, TZ);
        plat.box(1.3, .24, 2 * h - 2.2, TX - h + .65, yy, TZ);
        orange.box(2 * h - 2.2, .16, .14, TX, yy + .18, TZ + h - .06);
        orange.box(2 * h - 2.2, .16, .14, TX, yy + .18, TZ - h + .06);
        orange.box(.14, .16, 2 * h - 2.2, TX + h - .06, yy + .18, TZ);
        orange.box(.14, .16, 2 * h - 2.2, TX - h + .06, yy + .18, TZ);
        // railing posts + two rails on all four sides
        const n = Math.max(4, Math.round(2 * h / 2.5));
        for (let k = 0; k <= n; k++) {
          const t = k / n, px = TX + (t * 2 - 1) * (h - .35);
          for (const zz of [TZ + h - .3, TZ - h + .3]) rail.add(px, yy + .18, zz, px, yy + 1.16, zz, .09, .09);
          const pz = TZ + (t * 2 - 1) * (h - .35);
          for (const xx of [TX + h - .3, TX - h + .3]) rail.add(xx, yy + .18, pz, xx, yy + 1.16, pz, .09, .09);
        }
        for (const hh of [.62, 1.12]) {
          rail.add(TX - h + .3, yy + hh, TZ + h - .3, TX + h - .3, yy + hh, TZ + h - .3, .07, .07);
          rail.add(TX - h + .3, yy + hh, TZ - h + .3, TX + h - .3, yy + hh, TZ - h + .3, .07, .07);
          rail.add(TX + h - .3, yy + hh, TZ - h + .3, TX + h - .3, yy + hh, TZ + h - .3, .07, .07);
          rail.add(TX - h + .3, yy + hh, TZ - h + .3, TX - h + .3, yy + hh, TZ + h - .3, .07, .07);
        }
      }

      /* -- external zig-zag stairs on the +z face ------------------------- */
      const steps = new Builder(M.steelDark);
      for (let i = 0; i < NB; i++) {
        const h0 = H(i), h1 = H(i + 1);
        const dir = (i % 2 === 0) ? 1 : -1;
        const x0 = TX + dir * 2.4, x1 = TX + dir * 6.3;
        const z0 = TZ + h0 + .45, z1 = TZ + h1 + .45;
        const n = 11;
        for (let k = 0; k < n; k++) {
          const t1 = (k + .5) / n;
          const sx = lerp(x0, x1, t1), sy = lerp(ys[i], ys[i + 1], t1), sz = lerp(z0, z1, t1);
          steps.addGeo(new T.BoxGeometry(1.7, .14, .8), sx, sy, sz);
        }
        // stringers + handrails along the flight
        for (const s of [-.9, .9]) {
          rail.add(x0, ys[i] + .7, z0 + s, x1, ys[i + 1] + .7, z1 + s, .26, .26);
          rail.add(x0, ys[i] + 1.5, z0 + s, x1, ys[i + 1] + 1.5, z1 + s, .1, .1);
        }
        rail.add(x0, ys[i] + .2, z0, x1, ys[i] + .2, z1, .2, .2);
      }

      /* -- enclosed service building (west slab) -------------------------- */
      const coreW = 6.8, coreTop = 82, coreH = coreTop - (baseY + 2.4), coreD = 14.6;
      const core = new T.Mesh(new T.BoxGeometry(coreW, coreH, coreD), M.facadeGrey);
      core.position.set(TX - 4.15, baseY + 2.4 + coreH / 2, TZ);
      core.castShadow = true; core.receiveShadow = true; P.add(core);
      const coreRoof = new Builder(M.steelDark);
      coreRoof.box(coreW + .8, 1.1, coreD + .8, TX - 4.15, baseY + 2.4 + coreH + .55, TZ);
      for (let k = 1; k <= 6; k++) {
        const yy = baseY + 2.4 + coreH * k / 7;
        coreRoof.box(coreW + 1.1, .35, coreD + 1.0, TX - 4.15, yy, TZ);
      }
      coreRoof.mesh(P);
      // roof equipment
      const roofEq = new Builder(M.steelWhite);
      roofEq.box(2.6, 1.5, 3.2, TX - 5.2, baseY + 2.4 + coreH + 2.1, TZ - 3);
      roofEq.box(1.6, 1.0, 1.8, TX - 2.8, baseY + 2.4 + coreH + 1.9, TZ + 2.6);
      roofEq.mesh(P);

      /* -- industrial detail on the exposed faces -------------------------- */
      (function towerDetail() {
        // vertical pipes + cable trays climbing the west slab's front face
        const pipes = new Builder(M.pipeDark);
        for (const xx of [-4.9, -4.2, -1.4, -.7]) {
          pipes.addGeo(new T.CylinderGeometry(.15, .18, coreH - 2, 6), TX + xx, baseY + 2.4 + coreH / 2, TZ + 7.42);
        }
        pipes.addGeo(new T.CylinderGeometry(.34, .34, coreH - 4, 8), TX - 2.7, baseY + 2.4 + coreH / 2, TZ + 7.46);
        pipes.mesh(P);
        const trays = new Builder(M.steelDark);
        for (const xx of [-3.3, -1.0]) trays.box(.55, coreH - 3, .3, TX + xx, baseY + 2.8 + (coreH - 3) / 2, TZ + 7.55);
        // horizontal service gangways across the slab face
        for (let yy = 20; yy <= 78; yy += 11.6) {
          trays.box(6.2, .34, .9, TX - 4.0, yy, TZ + 8.95);
        }
        trays.mesh(P);
        // orange machinery brackets at the umbilical arm levels
        const brk = new Builder(M.orange);
        [30, 44, 58, 66].forEach(yy => {
          brk.box(2.6, .7, 1.2, TX + 5.0, yy, TZ + 7.4);
          brk.box(.5, 2.2, .5, TX + 6.1, yy - 1.4, TZ + 7.4);
        });
        brk.mesh(P);
        // white service rooms hanging on the front face
        const rooms = new Builder(M.steelWhite);
        rooms.box(3.4, 3.0, 1.7, TX - 1.6, 39.4, TZ + 8.3);
        rooms.box(2.8, 2.6, 1.6, TX - 5.4, 63.0, TZ + 8.3);
        rooms.mesh(P);
        const roomWin = new Builder(M.glass);
        roomWin.box(2.6, .7, .06, TX - 1.6, 39.9, TZ + 9.16);
        roomWin.mesh(P);
        // red/white hazard band + louvres at the base of the blue column
        const hz = new Builder(M.hazard);
        const hp = planeUV(8, .8, 1.6);
        hz.addGeo(hp, TX - 1.0, 11.2, TZ + 8.72, 0, 0, 0);
        hz.mesh(P, { cast: false });
        // vertical access ladder up the west slab
        const ladder = new Bars(unitBox);
        for (let yy = 12; yy < 80; yy += 1.1) {
          ladder.add(TX - 7.7, yy, TZ - 1.1, TX - 7.7, yy, TZ - .2, .07, .07);
        }
        ladder.add(TX - 7.7, 12, TZ - 1.1, TX - 7.7, 80, TZ - 1.1, .08, .08);
        ladder.add(TX - 7.7, 12, TZ - .2, TX - 7.7, 80, TZ - .2, .08, .08);
        ladder.flush(M.steelDark, P, { name: 'tower-ladder' });
      })();

      /* -- blue-grey panel column on the +z face --------------------------- */
      const blueH = 68;
      const blue = new T.Mesh(new T.BoxGeometry(8.4, blueH, 2.2), M.facadeBlue);
      blue.position.set(TX - 1.0, baseY + 1.6 + blueH / 2, TZ + 7.6);
      blue.castShadow = true; blue.receiveShadow = true; P.add(blue);
      const blueCap = new Builder(M.steelDark);
      blueCap.box(9.0, .9, 2.8, TX - 1.0, baseY + 1.6 + blueH + .45, TZ + 7.6);
      for (let k = 1; k <= 8; k++) {
        blueCap.box(8.8, .3, 2.5, TX - 1.0, baseY + 1.6 + blueH * k / 9, TZ + 7.6);
      }
      blueCap.mesh(P);
      const blueLedge = new Builder(M.orange);
      for (let k = 1; k <= 8; k++) {
        blueLedge.box(9.2, .22, .3, TX - 1.0, baseY + 1.6 + blueH * k / 9, TZ + 8.75);
      }
      blueLedge.mesh(P);

      /* -- elevator / service shaft --------------------------------------- */
      const elevH = topY - baseY - 3.5;
      const elev = new Builder(M.steelBlue);
      elev.box(2.2, elevH, 2.0, TX - 6.7, baseY + 1.2 + elevH / 2, TZ + 8.2);
      elev.box(3.4, 2.6, 3.4, TX - 6.7, baseY + 1.2 + elevH + 1.3, TZ + 8.2);
      elev.mesh(P);
      for (let k = 0; k <= 20; k++) {   // shaft mullions / bands
        const yy = baseY + 3.4 + (elevH - 4) * k / 20;
        if (k % 2 === 0) rail.add(TX - 7.8, yy, TZ + 9.25, TX - 5.6, yy, TZ + 9.25, .1, .1);
      }

      frame.flush(M.steelWhite, P, { name: 'tower-frame' });
      rail.flush(M.steelDark, P, { name: 'tower-rails' });
      plat.mesh(P, { name: 'tower-platforms' });
      orange.mesh(P, { name: 'tower-edges' });
      steps.mesh(P, { name: 'tower-stairs' });

      /* -- base plinth + pad services ------------------------------------- */
      const base = new Builder(M.concretePale);
      base.box(20.5, 1.3, 20.5, TX, baseY + .65, TZ);
      base.box(3.0, 1.8, 3.0, TX + 8.6, baseY + .9, TZ - 8.6);
      base.box(3.0, 1.8, 3.0, TX - 8.6, baseY + .9, TZ - 8.6);
      base.mesh(P, { name: 'tower-base' });
      const baseKit = new Builder(M.steelDark);
      baseKit.box(2.6, 2.2, 1.8, TX + 8.2, baseY + 2.4, TZ + 7.8);      // transformer
      baseKit.box(1.2, 1.2, 1.2, TX + 7.0, baseY + 1.9, TZ + 6.4);
      baseKit.box(1.4, .5, 6.0, TX + 9.4, baseY + 3.4, TZ + 1.0);       // duct
      baseKit.mesh(P);
      // pipes / cable trays from tower base toward the MLP
      const link = new Builder(M.pipe);
      for (const zz of [-1.6, 0, 1.6]) {
        link.addGeo(new T.CylinderGeometry(.26, .26, 7.6, 8), TX + 12.5, baseY + .8, zz, 0, 0, PI / 2);
      }
      link.addGeo(new T.CylinderGeometry(.42, .42, 7.6, 8), TX + 12.5, baseY + 1.7, 2.9, 0, 0, PI / 2);
      link.mesh(P, { name: 'tower-pipes' });
      const tray = new Builder(M.steelDark);
      tray.box(8.2, .18, 1.5, TX + 12.2, baseY + 3.4, 0);
      tray.box(8.2, .18, 1.5, TX + 12.2, baseY + 3.4, -2.4);
      tray.mesh(P);

      /* -- swing arms toward the rocket ----------------------------------- */
      const armY = [30, 44, 58, 66];
      const armBars = new Bars(unitBox);
      const armWhite = new Builder(M.steelWhite);
      const armOrange = new Builder(M.orange);
      const hoses = [];
      armY.forEach((ay, ai) => {
        // tower face x at this height
        const t = (ay - baseY - 1.3) / (topY - baseY - 1.3);
        const h = lerp(7.7, 5.85, smooth(0, 1, t));
        const x0 = TX + h - .3, x1 = -2.85, len = x0 - x1;
        const halfW = ai === 3 ? 1.15 : 1.0;
        // bottom + top chords
        for (const zz of [-halfW, halfW]) {
          armBars.add(x0, ay, TZ + zz, x1 + .5, ay, TZ + zz * .8, .24, .24);
          armBars.add(x0, ay + (ai === 3 ? 2.4 : 2.0), TZ + zz, x1 + 1.4, ay + (ai === 3 ? 2.4 : 2.0), TZ + zz * .8, .2, .2);
        }
        // truss web
        for (let k = 0; k <= 5; k++) {
          const t0 = k / 6, t1 = (k + 1) / 6;
          const px0 = lerp(x0, x1 + .4, t0), px1 = lerp(x0, x1 + .4, t1);
          armBars.add(px0, ay, TZ - halfW, px1, ay + 2.0, TZ - halfW * .8, .12, .12);
          armBars.add(px0, ay + 2.0, TZ - halfW, px1, ay, TZ - halfW * .8, .12, .12);
          armBars.add(px0, ay, TZ + halfW, px1, ay + 2.0, TZ + halfW * .8, .12, .12);
          armBars.add(px0, ay + 2.0, TZ + halfW, px1, ay, TZ + halfW * .8, .12, .12);
        }
        // support strut back down to the tower
        armBars.add(x1 + 2.2, ay, TZ, x0 - 1.0, ay - 5.2, TZ, .16, .16);
        // umbilical room at the tip
        const boxX = x1 + .2;
        armWhite.box(2.9, 2.7, halfW * 2.1, boxX, ay + 1.1, TZ);
        armOrange.box(3.1, .24, halfW * 2.2, boxX, ay + 2.5, TZ);
        armOrange.box(.24, 2.8, halfW * 2.2, boxX - 1.5, ay + 1.1, TZ);
        // window strip + hoses to the vehicle
        const win = new T.Mesh(new T.BoxGeometry(.06, .9, halfW * 1.5), M.glass);
        win.position.set(boxX - 1.48, ay + 1.35, TZ); P.add(win);
        hoses.push(new T.TubeGeometry(new T.CatmullRomCurve3([
          V3(boxX - 1.4, ay + .3, TZ + .3), V3(-3.4, ay + .1, TZ + .2), V3(-2.55, ay - .4, TZ)
        ]), 10, .16, 5, false));
        hoses.push(new T.TubeGeometry(new T.CatmullRomCurve3([
          V3(boxX - 1.4, ay + 1.5, TZ - .4), V3(-3.3, ay + 1.9, TZ - .3), V3(-2.55, ay + 2.2, TZ)
        ]), 10, .12, 5, false));
        // small platform bracket where the arm meets the tower
        armBars.add(x0, ay - .1, TZ - 2.2, x0 + 1.6, ay - .1, TZ - 2.2, .18, .18);
        armBars.add(x0 + 1.6, ay - .1, TZ - 2.2, x0 + 1.6, ay - .1, TZ + 2.2, .18, .18);
        armBars.add(x0 + 1.6, ay - .1, TZ + 2.2, x0, ay - .1, TZ + 2.2, .18, .18);
      });
      armBars.flush(M.steel, P, { name: 'swing-arms' });
      armWhite.mesh(P);
      armOrange.mesh(P);
      const hoseMesh = new T.Mesh(U.mergeGeometries(hoses), M.rubber);
      hoseMesh.castShadow = true; P.add(hoseMesh);

      /* -- hammerhead crane on top ---------------------------------------- */
      (function crane() {
        const red = new Bars(unitBox);
        const dark = new Builder(M.steelDark);
        const white = new Builder(M.steelWhite);
        const cY = topY + .4;
        const cx = TX + 2.2, cz = TZ;
        dark.box(4.6, 2.4, 4.6, cx, cY + 1.2, cz);
        dark.box(3.6, 2.6, 3.4, cx, cY + 3.6, cz);
        white.box(2.6, 2.4, 2.6, cx + 2.2, cY + 3.5, cz + 1.4);
        // main jib toward +x (over the rocket), plus counter-jib
        const tipX = cx + 25.5, cjX = cx - 11.5, jibY = cY + 5.2;
        for (const zz of [-.75, .75]) {
          red.add(cx + 1.4, jibY, cz + zz, tipX, jibY + .4, cz + zz, .22, .22);
          red.add(cx + 1.4, jibY + 1.5, cz + zz, tipX, jibY + .6, cz + zz, .2, .2);
        }
        for (let k = 0; k < 15; k++) {
          const t0 = k / 15, t1 = (k + 1) / 15;
          const px0 = lerp(cx + 1.4, tipX, t0), px1 = lerp(cx + 1.4, tipX, t1);
          red.add(px0, jibY + (k % 2 ? 0 : 1.5), cz - .75, px1, jibY + (k % 2 ? 1.5 : 0), cz - .75, .1, .1);
          red.add(px0, jibY + (k % 2 ? 0 : 1.5), cz + .75, px1, jibY + (k % 2 ? 1.5 : 0), cz + .75, .1, .1);
          red.add(px0, jibY + (k % 2 ? 1.5 : 0), cz - .75, px0, jibY + (k % 2 ? 0 : 1.5), cz + .75, .08, .08);
        }
        red.add(cx + 1.2, jibY + .3, cz, cjX, jibY + .2, cz, .26, .26);
        red.add(cx + 1.2, jibY + 1.5, cz, cjX, jibY + .3, cz, .2, .2);
        dark.box(2.8, 2.2, 2.6, cjX + 1.4, jibY - 1.0, cz);            // counterweights
        dark.box(2.2, 1.4, 2.4, cjX + 1.0, jibY - 2.4, cz);
        white.box(.9, 1.4, .9, tipX - .2, jibY + 1.3, cz);              // jib head
        // hook block + short cable
        red.add(tipX - .4, jibY, cz, tipX - .4, jibY - 6.5, cz, .05, .05);
        dark.box(.7, .8, .7, tipX - .4, jibY - 7.0, cz);
        red.flush(M.redPaint, P, { name: 'crane-jib' });
        dark.mesh(P);
        white.mesh(P);
      })();

      /* -- top platform, lightning rod, beacons --------------------------- */
      const top = new Builder(M.steelDark);
      top.box(13.2, .5, 13.2, TX, topY - .1, TZ);
      top.box(.4, 8.0, .4, TX - 5.6, topY + 4.0, TZ - 5.6);   // mast / lightning rod
      top.box(.3, 7.0, .3, TX + 5.8, topY + 3.5, TZ + 5.4);
      top.mesh(P);
      const rod = new Builder(M.steelWhite);
      rod.addGeo(new T.CylinderGeometry(.09, .16, 9, 6), TX - 5.6, topY + 12.5, TZ - 5.6);
      rod.mesh(P);
      // red obstruction beacons (instanced spheres)
      const beaconGeo = new T.SphereGeometry(.32, 8, 6);
      const beaconList = [];
      const addBeacon = (x, y, z) => beaconList.push({ p: [x, y, z], s: 1 });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) addBeacon(TX + sx * 6.1, topY + .35, TZ + sz * 6.1);
      addBeacon(TX + 2.2, topY + 12.2, TZ);                        // crane top
      addBeacon(TX - 5.6, topY + 17.2, TZ - 5.6);
      addBeacon(TX + 5.8, topY + 10.5, TZ + 5.4);
      for (const yy of [40, 62, 84]) addBeacon(TX - 6.4, yy, TZ + 6.4);
      makeInstanced(beaconGeo, M.beacon, beaconList, { name: 'tower-beacons', cast: false });

      // work lights under the platforms (night read)
      const workLights = [];
      for (let i = 2; i <= NB; i += 2) {
        const h = H(i), yy = ys[i] - .35;
        for (const zz of [TZ + h - .3, TZ - h + .3]) {
          workLights.push({ p: [TX - 2.0, yy, zz], r: [0, 0, 0], s: [1.5, .16, .18] });
          workLights.push({ p: [TX + 3.4, yy, zz], r: [0, 0, 0], s: [1.5, .16, .18] });
        }
      }
      makeInstanced(unitBox, M.lampWarm, workLights, { name: 'tower-work-lights', cast: false });
    })();

    /* ============================================ four lightning protection masts */
    (function buildMasts() {
      const P = U.group('lightning-masts'); g.add(P);
      const mastBars = new Bars(unitBox);
      const foot = new Builder(M.concretePale);
      const headBars = new Bars(unitBox);
      const headFrame = new Builder(M.steelDark);
      const lampPanels = [];
      const beaconGeo = new T.SphereGeometry(.3, 8, 6);
      const beaconList = [];
      const wireGeo = [];

      SPEC.masts.forEach(([mx, mz]) => {
        const gy = terrainH(mx, mz);
        const y0 = gy, yA = gy + 1.6, yB = gy + 19, yT = gy + 104;
        // footing
        foot.box(7.2, 1.6, 7.2, mx, yA - .8, mz);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) foot.box(1.8, .9, 1.8, mx + sx * 2.6, yA + .3, mz + sz * 2.6);
        // level list: 4 splayed base levels + 14 tapering upper levels
        const levels = [];
        for (let i = 0; i <= 4; i++) levels.push({ y: lerp(yA, yB, i / 4), h: lerp(4.3, 1.9, smooth(0, 1, i / 4)) });
        for (let i = 1; i <= 14; i++) levels.push({ y: lerp(yB, yT, i / 14), h: lerp(1.9, .32, Math.pow(i / 14, .85)) });
        const cpos = (li, sx, sz) => [mx + sx * levels[li].h, levels[li].y, mz + sz * levels[li].h];
        for (let i = 0; i < levels.length - 1; i++) {
          const wLeg = lerp(.3, .11, i / levels.length);
          for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
            const a = cpos(i, sx, sz), b = cpos(i + 1, sx, sz);
            mastBars.add(a[0], a[1], a[2], b[0], b[1], b[2], wLeg, wLeg);
          }
          for (const f of [[1, 1, 1, -1], [-1, 1, -1, -1], [1, 1, -1, 1], [1, -1, -1, -1]]) {
            const a = cpos(i, f[0], f[1]), b = cpos(i + 1, f[2], f[3]);
            const a2 = cpos(i + 1, f[0], f[1]), b2 = cpos(i, f[2], f[3]);
            mastBars.add(a[0], a[1], a[2], b[0], b[1], b[2], .09, .09);
            mastBars.add(b2[0], b2[1], b2[2], a2[0], a2[1], a2[2], .09, .09);
          }
          for (const f of [[1, 1, 1, -1], [-1, 1, -1, -1], [1, 1, -1, 1], [1, -1, -1, -1]]) {
            const a = cpos(i + 1, f[0], f[1]), b = cpos(i + 1, f[2], f[3]);
            mastBars.add(a[0], a[1], a[2], b[0], b[1], b[2], .1, .1);
          }
        }
        // finial spike
        mastBars.add(mx, yT, mz, mx, gy + 110.4, mz, .12, .12);
        beaconList.push({ p: [mx, gy + 110.8, mz], s: 1 });

        /* -- floodlight head at ~2/3 height (night practical) -------------- */
        const fy = gy + 75.5;
        const dx = -mx, dz = -mz, dl = Math.hypot(dx, dz) || 1;
        const fx = dx / dl, fz = dz / dl, axx = -fz, axz = fx;
        const face = 1.05; // half width of mast at that height (approx)
        const hx = mx + fx * (face + 1.0), hz = mz + fz * (face + 1.0);
        const armRy = Math.atan2(-axz, axx);
        headBars.add(mx + fx * face, fy - .4, mz + fz * face, hx, fy, hz, .16, .16);
        headBars.add(mx + fx * face, fy + .9, mz + fz * face, hx, fy + .5, hz, .12, .12);
        const panelRy = Math.atan2(-fx, -fz);
        headFrame.addGeo(new T.BoxGeometry(3.2, .55, .5), hx, fy + .2, hz, 0, armRy, 0);
        for (let k = -1; k <= 1; k++) {
          lampPanels.push({
            p: [hx + axx * k * 1.02, fy + .32, hz + axz * k * 1.02],
            r: [.3, panelRy, 0],
            s: [.82, .62, .12]
          });
        }
        // obstructions lights at 1/3, 2/3 and top
        beaconList.push({ p: [mx + fx * .4, gy + 39, mz + fz * .4], s: .8 });
        beaconList.push({ p: [mx + fx * .5, gy + 76.6, mz + fz * .5], s: .8 });
        // ground-level red/white identity bands
        headFrame.box(2.4, .5, .18, mx + fx * 2.2, gy + 2.2, mz + fz * 2.2);
      });
      mastBars.flush(M.steelWhite, P, { name: 'mast-lattice' });
      foot.mesh(P, { name: 'mast-footings' });
      headBars.flush(M.steel, P, { name: 'mast-head-arms' });
      headFrame.mesh(P, { name: 'mast-heads' });
      makeInstanced(unitBox, M.lampWhite, lampPanels, { name: 'mast-floodlights', cast: false });
      makeInstanced(beaconGeo, M.beacon, beaconList, { name: 'mast-beacons', cast: false });

      // catenary wires strung between the mast tops (rectangle + one diagonal)
      const tops = SPEC.masts.map(([mx, mz]) => V3(mx, terrainH(mx, mz) + 103.5, mz));
      const pairs = [[0, 2], [1, 3], [0, 1], [2, 3], [0, 3]];
      pairs.forEach(([a, b]) => {
        const A = tops[a], B = tops[b];
        const mid = A.clone().add(B).multiplyScalar(.5);
        mid.y -= A.distanceTo(B) * .045;
        const curve = new T.QuadraticBezierCurve3(A, mid, B);
        wireGeo.push(new T.TubeGeometry(curve, 22, .13, 4, false));
      });
      const wires = new T.Mesh(U.mergeGeometries(wireGeo), M.steelDark);
      wires.castShadow = false; P.add(wires);
    })();

    /* ================================================== elevated water tower */
    (function buildWaterTower() {
      const P = U.group('water-tower'); g.add(P);
      const wx = -78, wz = -74;
      const gy = terrainH(wx, wz);
      const legBars = new Bars(unitBox);
      // four splayed legs + bracing up to the tank platform
      const legTopY = gy + 44;
      const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
      corners.forEach(([sx, sz]) => {
        legBars.add(wx + sx * 6.4, gy, wz + sz * 6.4, wx + sx * 2.6, legTopY, wz + sz * 2.6, .85, .85);
      });
      for (let lv = 1; lv <= 3; lv++) {
        const t = lv / 4;
        const h = lerp(6.4, 2.6, t), yy = lerp(gy + 1, legTopY, t);
        for (const [sx, sz] of corners) {
          legBars.add(wx + sx * h, yy, wz + sz * h, wx + (sx > 0 ? -1 : 1) * h, yy, wz + sz * h, .28, .28);
          legBars.add(wx + sx * h, yy, wz + sz * h, wx + sx * h, yy, wz + (sz > 0 ? -1 : 1) * h, .28, .28);
        }
        // diagonal ties
        const h2 = lerp(6.4, 2.6, (lv - 1) / 4), y2 = lerp(gy + 1, legTopY, (lv - 1) / 4);
        for (const [sx, sz] of corners) {
          legBars.add(wx + sx * h2, y2, wz + sz * h2, wx + sx * h, yy, wz + (sz > 0 ? -1 : 1) * h, .18, .18);
        }
      }
      legBars.flush(M.steelWhite, P, { name: 'water-tower-legs' });

      const platform = new Builder(M.concretePale);
      platform.addGeo(new T.CylinderGeometry(8.4, 8.0, .7, 24), wx, legTopY + .35, wz);
      platform.mesh(P);
      // ring railing
      const rail = new Bars(unitBox);
      for (let k = 0; k < 24; k++) {
        const a = k / 24 * TAU;
        rail.add(wx + Math.cos(a) * 8.2, legTopY + .7, wz + Math.sin(a) * 8.2,
          wx + Math.cos(a) * 8.2, legTopY + 1.8, wz + Math.sin(a) * 8.2, .08, .08);
      }
      rail.add(wx - 8.2, legTopY + 1.8, wz, wx + 8.2, legTopY + 1.8, wz, .07, .07);
      // central riser + tank
      const tank = new Builder(M.steelWhite);
      tank.addGeo(new T.CylinderGeometry(1.0, 1.0, 44, 12), wx, gy + 22, wz);
      tank.addGeo(new T.CylinderGeometry(6.4, 6.4, 9.4, 26), wx, legTopY + 5.6, wz);
      tank.addGeo(new T.SphereGeometry(6.4, 26, 12, 0, TAU, 0, PI / 2), wx, legTopY + 10.3, wz);
      tank.addGeo(new T.CylinderGeometry(6.4, 1.2, 4.2, 26), wx, legTopY + 1.9, wz);
      // walkway ring + ladder hoops
      tank.addGeo(new T.TorusGeometry(6.6, .12, 6, 30), wx, legTopY + 10.1, wz, PI / 2, 0, 0);
      tank.addGeo(new T.CylinderGeometry(.22, .22, 40, 6), wx + 6.0, legTopY + 12, wz);
      tank.mesh(P, { name: 'water-tank' });
      // red band + beacon
      const band = new Builder(M.markRed);
      band.addGeo(new T.CylinderGeometry(6.45, 6.45, .9, 26), wx, legTopY + 9.2, wz);
      band.mesh(P);
      const beacon = new T.Mesh(new T.SphereGeometry(.36, 8, 6), M.beacon);
      beacon.position.set(wx, legTopY + 16.9, wz); P.add(beacon);
      // feed pipe toward the pad
      const pipe = new Builder(M.pipeDark);
      pipe.addGeo(new T.CylinderGeometry(.55, .55, 30, 10), wx, gy + 1.0, wz + 15, PI / 2, 0, 0);
      pipe.addGeo(new T.CylinderGeometry(.55, .55, 2.0, 10), wx, gy + 1.0, wz + 29.6);
      pipe.mesh(P);
      // small pump house at the base
      const shed = new Builder(M.facadePale);
      shed.box(9, 5.2, 7, wx + 10, gy + 2.6, wz + 8, .3);
      shed.mesh(P);
    })();



    /* ================================================================ roads */
    const ROADS = [];   // {x1,z1,x2,z2,w} for props placement avoidance
    const roadAsphalt = new Builder(M.asphalt);
    const roadLight = new Builder(M.concretePale);
    const roadLine = new Builder(M.markWhite);
    const dashList = [];
    function addRoad(x1, z1, x2, z2, w, light) {
      const dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz);
      const ry = Math.atan2(dx, dz);
      const mx = (x1 + x2) / 2, mz = (z1 + z2) / 2;
      const yy = GROUND_Y + .06;
      (light ? roadLight : roadAsphalt).addGeo(boxUV(w, .22, len, 6), mx, yy, mz, 0, ry, 0);
      const px = Math.cos(ry), pz = -Math.sin(ry);   // local +x in world
      for (const s of [-1, 1]) {
        const ox = s * (w / 2 - .45);
        roadLine.addGeo(new T.BoxGeometry(.17, .02, len), mx + px * ox, yy + .12, mz + pz * ox, 0, ry, 0);
      }
      if (!light) {
        const n = Math.max(2, Math.floor(len / 11));
        for (let i = 0; i < n; i++) {
          const t = (i + .5) / n;
          dashList.push({ p: [lerp(x1, x2, t), yy + .12, lerp(z1, z2, t)], r: [0, ry, 0], s: [.16, .02, 2.3] });
        }
      }
      ROADS.push({ x1, z1, x2, z2, w });
    }
    // crawlerway to the VAB (pale, twin treads)
    (function crawlerway() {
      const x1 = -42, z1 = -4, x2 = -336, z2 = -216;
      addRoad(x1, z1, x2, z2, 26, true);
      const dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz), ry = Math.atan2(dx, dz);
      const mx = (x1 + x2) / 2, mz = (z1 + z2) / 2;
      const px = Math.cos(ry), pz = -Math.sin(ry);
      const tread = new Builder(M.concreteDark);
      for (const s of [-1, 1]) {
        tread.addGeo(boxUV(4.6, .24, len - 2, 6), mx + px * s * 6.6, GROUND_Y + .07, mz + pz * s * 6.6, 0, ry, 0);
      }
      // expansion joints across the crawlerway
      for (let i = 0; i < 18; i++) {
        const t = (i + .5) / 18;
        tread.addGeo(new T.BoxGeometry(25.4, .03, .5), lerp(x1, x2, t), GROUND_Y + .185, lerp(z1, z2, t), 0, ry, 0);
      }
      tread.mesh(g, { cast: false });
    })();
    // access road loop + branches
    addRoad(30, 322, 30, 142, 11);
    addRoad(30, 142, -4, 88, 10);
    addRoad(-4, 88, -27, 58, 10);
    addRoad(30, 142, -74, 122, 8);
    addRoad(-74, 122, -116, 68, 8);
    addRoad(-27, 58, -62, 22, 8);
    addRoad(-62, 22, -70, -46, 8);
    addRoad(-70, -46, -76, -66, 7);
    addRoad(30, 142, 34, -60, 9);
    addRoad(34, -60, 62, -150, 9);
    addRoad(34, -60, 92, -30, 8);
    roadAsphalt.mesh(g, { name: 'roads' });
    roadLight.mesh(g, { name: 'crawlerway' });
    roadLine.mesh(g, { cast: false });
    if (dashList.length) makeInstanced(unitBox, M.markWhite, dashList, { cast: false, name: 'road-dashes' });

    // road lamps
    (function roadLamps() {
      const poles = new Bars(unitBox);
      const heads = [];
      const spots = [
        [30, 300], [30, 250], [30, 200], [30, 160], [-6, 100], [-27, 66],
        [-60, 108], [-112, 74], [-66, 10], [-73, -48], [34, 20], [34, -34], [58, -120]
      ];
      spots.forEach(([x, z]) => {
        const gy = terrainH(x, z);
        poles.add(x + 2.4, gy, z, x + 2.4, gy + 7.4, z, .12, .12);
        poles.add(x + 2.4, gy + 7.2, z, x + 1.1, gy + 7.5, z, .1, .1);
        heads.push({ p: [x + 1.0, gy + 7.45, z], r: [0, 0, 0], s: [.7, .22, .3] });
      });
      poles.flush(M.steelDark, g);
      makeInstanced(unitBox, M.lampWarm, heads, { cast: false, name: 'road-lamps' });
    })();

    /* ============================================================ tank farm */
    (function tankFarm() {
      const P = U.group('tank-farm'); g.add(P);
      const cx = -145, cz = 48;
      const slab = new Builder(M.concretePale);
      slab.addGeo(boxUV(104, .3, 92, 6), cx, GROUND_Y + .15, cz);
      slab.mesh(P, { cast: false });
      // containment bund
      const bund = new Builder(M.concrete);
      const bh = 1.15;
      bund.box(105, bh, .45, cx, GROUND_Y + bh / 2 + .2, cz - 46);
      bund.box(105, bh, .45, cx, GROUND_Y + bh / 2 + .2, cz + 46);
      bund.box(.45, bh, 92, cx - 52.5, GROUND_Y + bh / 2 + .2, cz);
      bund.box(.45, bh, 92, cx + 52.5, GROUND_Y + bh / 2 + .2, cz);
      bund.mesh(P);
      const tankMat = std({ color: 0xe7e7de, roughness: .4, metalness: .18 });
      const tankMat2 = std({ color: 0xd2d3c9, roughness: .45, metalness: .15 });
      const legsB = new Bars(unitBox);
      const tanksB = new Builder(tankMat);
      const tanksB2 = new Builder(tankMat2);
      function sphereTank(sx, sz, r) {
        const cyT = GROUND_Y + r + 3.2;
        for (let k = 0; k < 8; k++) {
          const a = k / 8 * TAU + PI / 8;
          const lx = sx + Math.cos(a) * r * .9, lz = sz + Math.sin(a) * r * .9;
          legsB.add(lx, GROUND_Y + .2, lz, lx, cyT - r * .35, lz, .34, .34);
        }
        tanksB.addGeo(new T.SphereGeometry(r, 26, 18), sx, cyT, sz);
        // ladder + top valve
        legsB.add(sx + r * .55, GROUND_Y + .2, sz + r * .55, sx + r * .55, cyT + r * .55, sz + r * .55, .16, .16);
        tanksB.addGeo(new T.CylinderGeometry(.3, .3, 1.4, 8), sx, cyT + r * .98, sz);
        // frost streaks
        const frost = U.texCanvas(64, 128, (ctx2, cv) => {
          ctx2.clearRect(0, 0, 64, 128);
          const r2 = U.rng(Math.round(sx));
          for (let i = 0; i < 26; i++) {
            ctx2.fillStyle = 'rgba(255,255,252,' + r2.range(.06, .2).toFixed(2) + ')';
            ctx2.fillRect(r2.range(0, 64), r2.range(0, 100), r2.range(1, 4), r2.range(8, 40));
          }
        }, { srgb: true }).tex;
        const dec = U.decal(P, frost, { w: r * 1.1, h: r * 1.5, x: sx - r * .55, y: cyT, z: sz - r * .82, ry: -PI / 2 });
        dec.material.depthWrite = false;
      }
      sphereTank(cx - 26, cz - 16, 8.6);
      sphereTank(cx + 2, cz - 24, 7.2);
      // horizontal LOX bullets
      for (let i = 0; i < 3; i++) {
        const bx = cx - 30 + i * 20, bz = cz + 24;
        tanksB2.addGeo(new T.CylinderGeometry(2.7, 2.7, 15, 18), bx, GROUND_Y + 4.2, bz, 0, 0, PI / 2);
        tanksB2.addGeo(new T.SphereGeometry(2.7, 16, 10), bx - 7.5, GROUND_Y + 4.2, bz);
        tanksB2.addGeo(new T.SphereGeometry(2.7, 16, 10), bx + 7.5, GROUND_Y + 4.2, bz);
        for (const s of [-1, 1]) legsB.add(bx + s * 4.5, GROUND_Y + .2, bz - 2, bx + s * 4.5, GROUND_Y + 3.4, bz, .3, .3);
        tanksB2.addGeo(new T.CylinderGeometry(.22, .22, 4, 6), bx, GROUND_Y + 6.9, bz);
      }
      // vertical water/LOX tanks + vaporisers
      tanksB2.addGeo(new T.CylinderGeometry(3.1, 3.1, 11, 18), cx + 32, GROUND_Y + 6.5, cz - 26);
      tanksB2.addGeo(new T.SphereGeometry(3.1, 18, 8, 0, TAU, 0, PI / 2), cx + 32, GROUND_Y + 12, cz - 26);
      for (let i = 0; i < 3; i++) {
        const vx = cx + 36 + i * 6, vz = cz + 4;
        tanksB2.addGeo(new T.BoxGeometry(2.2, 13, 2.2), vx, GROUND_Y + 6.5, vz);
        for (let k = 0; k < 9; k++) legsB.add(vx - 1.2, GROUND_Y + 1 + k * 1.35, vz, vx + 1.2, GROUND_Y + 1 + k * 1.35, vz, .08, .5);
      }
      legsB.flush(M.steel, P, { name: 'tank-legs' });
      tanksB.mesh(P, { name: 'spheres' });
      tanksB2.mesh(P, { name: 'tanks' });
      // pipe rack between the farm and the pad
      const rack = new Bars(unitBox);
      const pipesB = new Builder(M.pipe);
      for (let i = 0; i <= 10; i++) {
        const px = cx - 40 + i * 10, pz = cz + 38;
        rack.add(px, GROUND_Y, pz - 1.6, px, GROUND_Y + 4.4, pz - 1.6, .22, .22);
        rack.add(px, GROUND_Y, pz + 1.6, px, GROUND_Y + 4.4, pz + 1.6, .22, .22);
        rack.add(px, GROUND_Y + 4.2, pz - 1.9, px, GROUND_Y + 4.2, pz + 1.9, .18, .18);
      }
      for (let k = 0; k < 4; k++) {
        pipesB.addGeo(new T.CylinderGeometry(.24, .24, 100, 8), cx, GROUND_Y + 3.0 + k * .55, cz + 38 + (k % 2 ? .7 : -.7), 0, 0, PI / 2);
      }
      // small pump house
      const shed = new Builder(M.facadePale);
      shed.addGeo(new T.BoxGeometry(10, 5.4, 7), cx + 40, GROUND_Y + 2.7, cz + 30, 0, .18, 0);
      shed.mesh(P);
      rack.flush(M.steel, P);
      pipesB.mesh(P);
      // warning lamp heads on the rack
      const heads = [];
      for (let i = 0; i < 4; i++) heads.push({ p: [cx - 30 + i * 20, GROUND_Y + 4.6, cz + 36.2], r: [0, 0, 0], s: [.6, .2, .26] });
      makeInstanced(unitBox, M.lampWarm, heads, { cast: false });
    })();

    /* ================================================== distant VAB + LC-102 */
    (function buildVAB() {
      const P = U.group('vab'); g.add(P);
      const ry = Math.atan2(0 - (-900), 0 - (-650));
      const V = U.group('vab-local', P);
      V.position.set(-900, terrainH(-900, -650), -650);
      V.rotation.y = ry;
      const vabCon = std({ color: 0xc4c7c1, roughness: .93, metalness: .02 });
      const vabPale = std({ color: 0xd0d2cc, roughness: .92, metalness: .02 });
      const vabDark = std({ color: 0x929997, roughness: .78, metalness: .12 });
      // ground apron + plinth band so the mass settles into the coastal plain
      const apron = new Builder(vabPale);
      apron.addGeo(boxUV(300, .5, 220, 20), 0, -.1, 20);
      apron.addGeo(boxUV(144, 15, 98, 18), 0, 7.5, 0);
      apron.addGeo(boxUV(190, 6, 52, 20), -6, 2.6, 62);
      apron.mesh(V);
      // main high-bay block (two bays) + low annexes in the same mass family
      const body = new Builder(vabCon);
      body.addGeo(boxUV(140, 94, 84, 24), 0, 62, 0);
      body.addGeo(boxUV(196, 24, 54, 20), 0, 14, 52);
      body.addGeo(boxUV(96, 26, 40, 18), -92, 15, 8);
      body.addGeo(boxUV(72, 18, 34, 16), 92, 11, 2);
      body.addGeo(boxUV(120, 16, 40, 18), 20, 10, -62);
      body.mesh(V);
      // bay doors + roof crane house + rails
      const dark = new Builder(vabDark);
      for (const s of [-1, 1]) {
        dark.addGeo(new T.BoxGeometry(28, 84, 1.2), s * 32, 60, 42.4);
        dark.addGeo(new T.BoxGeometry(30, 2.6, 2.4), s * 32, 104, 43.0);
        dark.addGeo(new T.BoxGeometry(.8, 84, 1.6), s * 32 - 14.4, 60, 42.6);
        dark.addGeo(new T.BoxGeometry(.8, 84, 1.6), s * 32 + 14.4, 60, 42.6);
      }
      dark.addGeo(new T.BoxGeometry(76, 10, 32), 0, 113, -6);
      dark.addGeo(new T.BoxGeometry(144, 1.8, 2.4), 0, 110.4, 43.2);
      dark.mesh(V);
      // pilasters / vertical ribs on the front + sides
      const pil = new Bars(unitBox);
      for (let x = -62; x <= 62; x += 14) pil.add(x, 4, 42.3, x, 106, 42.3, .8, 1.3);
      for (const s of [-1, 1]) for (let x = -58; x <= 58; x += 14) pil.add(x, 4, s * 42.4, x, 106, s * 42.4, .7, 1.1);
      pil.flush(vabPale, V, { name: 'vab-pilasters' });
      // window strips + a service lighting band (faint, for night)
      const win = [];
      for (let k = 0; k < 7; k++) win.push({ p: [-78 + k * 26, 96, 42.9], r: [0, 0, 0], s: [8, .6, .2] });
      for (let k = 0; k < 9; k++) win.push({ p: [-80 + k * 20, 22, 79.2], r: [0, 0, 0], s: [8, .5, .2] });
      makeInstanced(unitBox, M.lampWarm, win, { cast: false, parent: V });
    })();

    // faint second launch complex far to the north-east along the coast (LC-102)
    (function buildLC102() {
      const P = U.group('lc-102'); g.add(P);
      const bx = 148, bz = -820;
      const gy = terrainH(bx, bz);
      const con = std({ color: 0x8d938b, roughness: .93, metalness: .02 });
      const pale = std({ color: 0x7f867e, roughness: .9, metalness: .02 });
      const grey = std({ color: 0x848b88, roughness: .82, metalness: .12 });
      // ground apron + raised pad
      const pad = new Builder(pale);
      pad.addGeo(boxUV(120, .4, 100, 20), bx, gy - .1, bz);
      pad.addGeo(boxUV(64, 5.5, 52, 10), bx, gy + 2.7, bz);
      pad.mesh(P, { cast: false });
      // fixed tower + erector + service block
      const tower = new Builder(grey);
      tower.addGeo(new T.BoxGeometry(12, 30, 12), bx - 13, gy + 6.5 + 15, bz);
      tower.addGeo(new T.BoxGeometry(9, 20, 9), bx + 8, gy + 6.5 + 10, bz + 4);
      tower.addGeo(new T.BoxGeometry(14, 2.4, 14), bx - 13, gy + 6.5 + 31, bz);
      tower.mesh(P, { cast: false });
      const dark = new Builder(std({ color: 0x8f9592, roughness: .75, metalness: .15 }));
      for (let k = 0; k < 3; k++) dark.addGeo(new T.BoxGeometry(13.0, .8, 13.0), bx - 13, gy + 11 + k * 8.5, bz);
      dark.addGeo(new T.BoxGeometry(24, 1.2, 1.2), bx + 1, gy + 38, bz);
      dark.mesh(P, { cast: false });
      // low service buildings
      const low = new Builder(con);
      low.addGeo(boxUV(34, 11, 18, 12), bx - 50, gy + 5.5, bz + 26);
      low.addGeo(boxUV(22, 8, 15, 12), bx + 34, gy + 4, bz + 20);
      low.addGeo(boxUV(52, 7, 14, 14), bx + 10, gy + 3.5, bz - 38);
      low.mesh(P, { cast: false });
      // four white lightning masts
      const masts = new Bars(unitBox);
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const mx = bx + sx * 58, mz = bz + sz * 48;
        for (const [ox2, oz2] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
          masts.add(mx + ox2 * 1.4, gy, mz + oz2 * 1.4, mx + ox2 * .5, gy + 96, mz + oz2 * .5, .55, .55);
        }
        for (let k = 1; k < 9; k++) {
          const w = 1.4 - k * .1, yy = gy + k * 10.7;
          masts.add(mx - w, yy, mz - w, mx + w, yy, mz - w, .3, .3);
          masts.add(mx - w, yy, mz + w, mx + w, yy, mz + w, .3, .3);
        }
      }
      masts.flush(M.steelWhite, P, { cast: false });
      // access road toward the main complex
      const road = new Builder(M.asphalt);
      const dx = 210 - bx, dz = -410 - bz, len = Math.hypot(dx, dz), rry = Math.atan2(dx, dz);
      road.addGeo(boxUV(9, .2, len, 6), (bx + 210) / 2, Math.max(gy, .9) + .3, (bz - 410) / 2, 0, rry, 0);
      road.mesh(P, { cast: false });
    })();

    /* ========================================================== fence + site */
    (function perimeterFence() {
      const P = U.group('fence'); g.add(P);
      const X1 = -330, X2 = 178, Z1 = -320, Z2 = 320;
      const gapS = { c: 30, h: 9 }, gapW = { c: 0, h: 8 };
      const planes = new Builder(M.fence);
      const posts = [];
      const rails = new Bars(unitBox);
      function seg(x1, z1, x2, z2) {
        const dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz);
        if (len < .5) return;
        const ry = Math.atan2(-dz, dx);
        const mx = (x1 + x2) / 2, mz = (z1 + z2) / 2;
        const gy = GROUND_Y;
        planes.addGeo(planeUV(len, 2.7, 2.7), mx, gy + .12 + 1.35, mz, 0, ry, 0);
        rails.add(x1, gy + 2.82, z1, x2, gy + 2.82, z2, .08, .08);
        const n = Math.max(2, Math.round(len / 3.2));
        for (let i = 0; i <= n; i++) {
          const t = i / n;
          posts.push({ p: [lerp(x1, x2, t), gy + 1.45, lerp(z1, z2, t)], s: [.14, 2.9, .14] });
        }
      }
      // south (with gate), north
      seg(X1, Z2, gapS.c - gapS.h, Z2); seg(gapS.c + gapS.h, Z2, X2, Z2);
      seg(X2, Z2, X2, Z1); seg(X2, Z1, X1, Z1);
      // west (with gate)
      seg(X1, Z1, X1, gapW.c - gapW.h); seg(X1, gapW.c + gapW.h, X1, Z2);
      planes.mesh(P, { cast: false, receive: false });
      makeInstanced(unitBox, M.steel, posts, { cast: false, receive: false, name: 'fence-posts' });
      rails.flush(M.steel, P, { cast: false });
      // gate posts + boom barrier at the south gate
      const gate = new Builder(M.concretePale);
      for (const s of [-1, 1]) gate.box(1.0, 3.6, 1.0, gapS.c + s * gapS.h, GROUND_Y + 1.8, Z2);
      gate.box(4.6, 2.4, .5, gapS.c - 2.6, GROUND_Y + 1.2, Z2 + 1.2);
      gate.mesh(P);
      const barrier = new Builder(M.markYellow);
      barrier.addGeo(new T.BoxGeometry(12, .18, .18), gapS.c, GROUND_Y + 1.1, Z2 - .4);
      barrier.mesh(P);
    })();

    /* =============================================== pad-side services / clutter */
    (function padServices() {
      const P = U.group('pad-services'); g.add(P);
      // propellant pipe rack running along the crawlerway (visible from hero)
      const rack = new Bars(unitBox);
      const pipes = new Builder(M.pipe);
      const dir = { x: -0.81, z: -0.585 };
      const perp = { x: -0.585, z: 0.81 };
      const ox = -42 + perp.x * 21, oz = -4 + perp.z * 21;
      for (let i = 0; i <= 16; i++) {
        const t = i / 16, d = t * 120;
        const px = ox + dir.x * d, pz = oz + dir.z * d;
        const gy = terrainH(px, pz);
        rack.add(px, gy, pz - 1.8, px, gy + 4.6, pz - 1.8, .24, .24);
        rack.add(px, gy, pz + 1.8, px, gy + 4.6, pz + 1.8, .24, .24);
        rack.add(px, gy + 4.4, pz - 2.1, px, gy + 4.4, pz + 2.1, .18, .18);
      }
      const rackRy = Math.atan2(dir.x, dir.z);
      const cx0 = ox + dir.x * 60, cz0 = oz + dir.z * 60;
      const cy0 = terrainH(cx0, cz0);
      for (let k = 0; k < 3; k++) {
        const geo = new T.CylinderGeometry(.22, .22, 122, 8);
        geo.rotateX(PI / 2);
        geo.rotateY(rackRy);
        geo.translate(cx0, cy0 + 3.6 + k * .55, cz0);
        pipes.geos.push(geo);
      }
      rack.flush(M.steel, P, { name: 'pipe-rack' });
      pipes.mesh(P, { name: 'rack-pipes' });

      // equipment sheds / containers just outside the pad bank (foreground read)
      const shed = new Builder(M.facadePale);
      shed.addGeo(new T.BoxGeometry(9.5, 4.6, 7), -76, terrainH(-76, 58) + 2.3, 58, 0, .24, 0);
      shed.addGeo(new T.BoxGeometry(5.2, 3.2, 4.6), -88, terrainH(-88, 50) + 1.6, 50, 0, -.1, 0);
      shed.mesh(P);
      const roof = new Builder(M.steelDark);
      roof.addGeo(new T.BoxGeometry(10.6, .4, 8.0), -76, terrainH(-76, 58) + 4.8, 58, 0, .24, 0);
      roof.addGeo(new T.BoxGeometry(6.0, .3, 5.2), -88, terrainH(-88, 50) + 3.3, 50, 0, -.1, 0);
      roof.mesh(P);
      // containers / stores
      const boxA = new Builder(std({ color: 0xcfcabb, roughness: .72, metalness: .2 }));
      const boxB = new Builder(M.steelBlue);
      const boxC = new Builder(M.orange);
      boxA.addGeo(new T.BoxGeometry(2.5, 2.6, 6.1), -70, terrainH(-70, 46) + 1.3, 46, 0, .1, 0);
      boxB.addGeo(new T.BoxGeometry(2.5, 2.6, 6.1), -66, terrainH(-66, 44) + 1.3, 44, 0, .1, 0);
      boxC.addGeo(new T.BoxGeometry(2.2, 2.3, 4.4), -60.5, terrainH(-60.5, 40.5) + 1.15, 40.5, 0, -.2, 0);
      boxA.mesh(P); boxB.mesh(P); boxC.mesh(P);
      // guardhouse at the south gate
      const gh = new Builder(M.concretePale);
      const gx = 21, gz = 315;
      gh.addGeo(new T.BoxGeometry(5.2, 3.0, 4.2), gx, terrainH(gx, gz) + 1.5, gz);
      gh.addGeo(new T.BoxGeometry(5.8, .3, 4.8), gx, terrainH(gx, gz) + 3.1, gz);
      gh.mesh(P);
      const gw = new Builder(M.glassLit);
      gw.addGeo(new T.BoxGeometry(4.2, .9, .12), gx, terrainH(gx, gz) + 2.1, gz + 2.16);
      gw.addGeo(new T.BoxGeometry(.12, .9, 3.0), gx + 2.66, terrainH(gx, gz) + 2.1, gz);
      gw.mesh(P);
    })();

    /* ================================================== blockhouses / buildings */
    (function buildings() {
      const P = U.group('buildings'); g.add(P);
      const bodyPale = new Builder(M.facadePale);
      const bodyGrey = new Builder(M.facadeGrey);
      const trimB = new Builder(M.concretePale);
      const roofB = new Builder(M.steelDark);
      const bermB = new Builder(M.bank);
      const acList = [];
      function blockhouse(x, z, w, d, h, ry, grey) {
        const gy = terrainH(x, z);
        (grey ? bodyGrey : bodyPale).addGeo(new T.BoxGeometry(w, h, d), x, gy + h / 2, z, 0, ry || 0, 0);
        trimB.addGeo(new T.BoxGeometry(w + .6, .5, d + .6), x, gy + h + .25, z, 0, ry || 0, 0);
        roofB.addGeo(new T.BoxGeometry(w * .34, .8, d * .38),
          x + Math.sin(ry || 0) * (d * .3), gy + h + .8, z + Math.cos(ry || 0) * (d * .3), 0, ry || 0, 0);
        if (h < 7) {
          bermB.addGeo(new T.BoxGeometry(w + 12, h * .9, 3.6), x, gy + h * .45, z - d / 2 - 3.2, -.5, ry || 0, 0);
        }
        for (let i = 0; i < 3; i++) {
          acList.push({ p: [x + (i - 1) * 2.6, gy + h + 1.4, z - d * .2], s: [1.4, .9, 1.1] });
        }
        return { x, z, gy };
      }
      blockhouse(66, 104, 26, 14, 9.5, -.18, false);
      blockhouse(-118, 100, 32, 12, 6.4, .12, false);
      blockhouse(88, 52, 18, 11, 5.4, .35, true);
      blockhouse(-46, -118, 20, 12, 5.0, -.3, false);
      blockhouse(120, -20, 14, 10, 4.6, -.5, true);
      bodyPale.mesh(P, { name: 'blockhouses-pale' });
      bodyGrey.mesh(P, { name: 'blockhouses-grey' });
      trimB.mesh(P);
      roofB.mesh(P);
      bermB.mesh(P, { cast: false });
      makeInstanced(unitBox, M.steel, acList, { name: 'ac-units' });
      // a few site containers for scale
      const boxA = new Builder(std({ color: 0xd9d7cb, roughness: .7, metalness: .2 }));
      const boxB = new Builder(std({ color: 0x39606e, roughness: .7, metalness: .2 }));
      const boxC = new Builder(M.orange);
      boxA.addGeo(new T.BoxGeometry(2.4, 2.6, 6.0), 44, terrainH(44, -50) + 1.3, -50, 0, .2, 0);
      boxB.addGeo(new T.BoxGeometry(2.4, 2.6, 6.0), 48, terrainH(48, -44) + 1.3, -44, 0, .2, 0);
      boxC.addGeo(new T.BoxGeometry(2.2, 2.4, 4.6), 52, terrainH(52, -47) + 1.2, -47);
      boxA.mesh(P); boxB.mesh(P); boxC.mesh(P);
    })();

    /* ======================================================== tropical palms */
    (function palms() {
      const P = U.group('palms'); g.add(P);
      const frondGeo = (function () {
        const geo = new T.PlaneGeometry(1.8, 4.9, 1, 7);
        const p = geo.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const x = p.getX(i), y = p.getY(i);
          const t = (y + 2.45) / 4.9;
          p.setXYZ(i, x * (1 - .72 * t), y + 2.45, -2.15 * t * t);
        }
        geo.computeVertexNormals();
        return geo;
      })();
      const trunkGeo = new T.CylinderGeometry(.14, .24, 1, 7, 1);
      const nutGeo = new T.SphereGeometry(.17, 6, 5);
      const trunks = [], fronds = [], nuts = [];
      const PALMS = [];
      function distToRoad(x, z) {
        let best = 1e9;
        for (const r of ROADS) {
          const dx = r.x2 - r.x1, dz = r.z2 - r.z1;
          const L2 = dx * dx + dz * dz;
          let t = ((x - r.x1) * dx + (z - r.z1) * dz) / L2;
          t = clamp(t, 0, 1);
          const px = r.x1 + dx * t, pz = r.z1 + dz * t;
          best = Math.min(best, Math.hypot(x - px, z - pz) - r.w / 2);
        }
        return best;
      }
      const blockers = [[66, 104, 22], [-118, 100, 26], [88, 52, 16], [-46, -118, 18], [120, -20, 12],
        [-145, 48, 55], [-78, -74, 14], [0, 0, 78]];
      function ok(x, z) {
        if (Math.abs(x) < 54 && Math.abs(z) < 50) return false;
        if (distToRoad(x, z) < 7) return false;
        for (const b of blockers) if (Math.hypot(x - b[0], z - b[1]) < b[2] + 8) return false;
        const xc = coastX(z);
        if (x > xc - 14) return false;
        return true;
      }
      const clusters = [
        { x: -96, z: 132, r: 52, n: 14 }, { x: 40, z: 128, r: 58, n: 12 },
        { x: 128, z: 96, r: 44, n: 10 }, { x: -178, z: -12, r: 70, n: 12 },
        { x: 150, z: -96, r: 56, n: 10 }, { x: -52, z: -136, r: 44, n: 8 },
        { x: -230, z: 120, r: 50, n: 8 }, { x: 110, z: 60, r: 30, n: 6 },
        { x: -58, z: 86, r: 26, n: 9 }, { x: 62, z: 92, r: 30, n: 9 },
        { x: -118, z: 176, r: 40, n: 8 }, { x: 168, z: -30, r: 34, n: 8 },
        { x: -86, z: 64, r: 24, n: 8 }, { x: 96, z: 58, r: 24, n: 8 },
        { x: 132, z: 96, r: 30, n: 8 }, { x: -152, z: 64, r: 30, n: 8 }
      ];
      const taken = [];
      clusters.forEach(cl => {
        let made = 0, tries = 0;
        while (made < cl.n && tries < 300) {
          tries++;
          const a = rng.range(0, TAU), rr = Math.sqrt(rng.next()) * cl.r;
          const x = cl.x + Math.cos(a) * rr, z = cl.z + Math.sin(a) * rr;
          if (!ok(x, z)) continue;
          if (taken.some(t => Math.hypot(t[0] - x, t[1] - z) < 7)) continue;
          taken.push([x, z]);
          made++;
          const gy = terrainH(x, z);
          const h = R(8.0, 15.0);
          const lean = R(-.09, .09), leanZ = R(-.09, .09);
          trunks.push({ p: [x, gy + h / 2, z], r: [leanZ, R(0, TAU), lean], s: [1, h, 1] });
          const topX = x - leanZ * h * .5, topZ = z + lean * h * .5;
          const nf = RI(8, 11);
          for (let i = 0; i < nf; i++) {
            const az = i / nf * TAU + R(-.22, .22);
            const tilt = R(.78, 1.32) + (i % 3 === 0 ? .3 : 0);   // rad from +Y
            const q = new T.Quaternion().setFromEuler(new T.Euler(0, az, 0))
              .multiply(new T.Quaternion().setFromEuler(new T.Euler(0, 0, tilt)));
            fronds.push({
              p: [topX, gy + h - .15, topZ],
              q, s: R(.95, 1.4),
              c: rng.next() < .3 ? 0xdfe9c8 : (rng.next() < .5 ? 0xc8d8a4 : 0xe8eed0)
            });
          }
          for (let i = 0; i < 5; i++) {
            const a2 = rng.range(0, TAU);
            nuts.push({ p: [topX + Math.cos(a2) * .38, gy + h - .45, topZ + Math.sin(a2) * .38], s: R(.8, 1.2) });
          }
        }
      });
      makeInstanced(trunkGeo, M.trunk, trunks, { name: 'palm-trunks' });
      const frondMesh = makeInstanced(frondGeo, M.frond, fronds, { name: 'palm-fronds' });
      if (frondMesh) frondMesh.instanceColor.needsUpdate = true;
      makeInstanced(nutGeo, std({ color: 0x6f6a3c, roughness: .8 }), nuts, { cast: false });
      APP.modules.sitePalmCount = trunks.length;
    })();

    /* ============================================ casuarina tree line (billboards) */
    (function treeLine() {
      const P = U.group('tree-line'); g.add(P);
      function crossedTree() {
        const a = new T.PlaneGeometry(1, 1); a.translate(0, .5, 0);
        const b = new T.PlaneGeometry(1, 1); b.rotateY(PI / 2); b.translate(0, .5, 0);
        const geo = U.mergeGeometries([a, b]);
        return geo;
      }
      const treeGeo = crossedTree();
      const listA = [], listB = [], listC = [];
      function distToRoad(x, z) {
        let best = 1e9;
        for (const r of ROADS) {
          const dx = r.x2 - r.x1, dz = r.z2 - r.z1;
          const L2 = dx * dx + dz * dz;
          let t = clamp(((x - r.x1) * dx + (z - r.z1) * dz) / L2, 0, 1);
          const px = r.x1 + dx * t, pz = r.z1 + dz * t;
          best = Math.min(best, Math.hypot(x - px, z - pz) - r.w / 2);
        }
        return best;
      }
      const clusters = [
        // dense band behind / east of the pad, toward the beach
        { x: 120, z: 0, rx: 55, rz: 320, n: 190 },
        // south tree line in front of the complex
        { x: -40, z: 250, rx: 260, rz: 60, n: 150 },
        // north tree line
        { x: -20, z: -260, rx: 260, rz: 60, n: 150 },
        // west / inland forest
        { x: -420, z: 40, rx: 120, rz: 340, n: 220 },
        // far background clumps
        { x: -180, z: -420, rx: 300, rz: 180, n: 120 },
        // ring around the pad: this is what makes 101 read tropical
        { x: -120, z: 70, rx: 66, rz: 52, n: 110 },
        { x: 104, z: 76, rx: 52, rz: 46, n: 90 },
        { x: -52, z: -126, rx: 90, rz: 56, n: 110 },
        { x: 116, z: -96, rx: 46, rz: 74, n: 80 },
        { x: -176, z: -52, rx: 66, rz: 66, n: 90 },
        // distant masses that ground the VAB + LC-102 silhouettes
        { x: -880, z: -640, rx: 210, rz: 150, n: 150 },
        { x: 150, z: -780, rx: 150, rz: 110, n: 120 }
      ];
      clusters.forEach((cl, ci) => {
        let made = 0, tries = 0;
        while (made < cl.n && tries < cl.n * 8) {
          tries++;
          const x = cl.x + R(-cl.rx, cl.rx), z = cl.z + R(-cl.rz, cl.rz);
          if (Math.abs(x) < 60 && Math.abs(z) < 58) continue;
          if (distToRoad(x, z) < 8) continue;
          if (Math.hypot(x + 145, z - 48) < 60) continue;
          if (Math.hypot(x + 78, z + 74) < 18) continue;
          if (Math.hypot(x - 172, z + 726) < 80) continue;
          for (const b of [[66, 104, 22], [-118, 100, 26], [88, 52, 18], [-46, -118, 20], [120, -20, 16]]) if (Math.hypot(x - b[0], z - b[1]) < b[2]) continue;
          const xc = coastX(z);
          if (x > xc - 8) continue;
          const gy = terrainH(x, z);
          if (gy < .2) continue;
          const h = rng.next() < .22 ? R(16, 24) : R(7.5, 16);
          const w = h * R(.8, 1.2);
          const item = {
            p: [x, gy - .2, z], r: [0, R(0, TAU), 0], s: [w, h, w],
            c: rng.next() < .33 ? 0x93a377 : (rng.next() < .5 ? 0xa3b08a : 0x7f9068)
          };
          (ci % 3 === 1 ? listB : (ci % 3 === 2 ? listC : listA)).push(item);
          made++;
        }
      });
      makeInstanced(treeGeo, M.treeA, listA, { name: 'tree-line-a', cast: false, receive: false });
      makeInstanced(treeGeo, M.treeB, listB, { name: 'tree-line-b', cast: false, receive: false });
      makeInstanced(treeGeo, M.treeC, listC, { name: 'tree-line-c', cast: false, receive: false });
    })();

    /* ============================================ near 3-D trees + undergrowth */
    (function trees3d() {
      const P = U.group('trees-3d'); g.add(P);
      const trunkB = new Builder(M.trunk);
      const leafB = new Builder(M.foliage);
      const leafDark = new Builder(M.foliageDark);
      const defs = [
        [-70, 96, 7.5, 5.5], [-96, 122, 8.5, 6.5], [16, 104, 6.5, 5], [52, 78, 7, 5],
        [-30, 140, 9, 6], [96, 122, 7.5, 5.5], [-150, 78, 8, 6], [-196, 40, 9, 7],
        [142, 40, 7, 5], [124, -60, 8, 6], [-90, -116, 8.5, 6], [-170, -60, 9.5, 7],
        [64, -122, 7.5, 5.5], [-240, 180, 10, 7]
      ];
      defs.forEach(([x, z, h, cp]) => {
        const gy = terrainH(x, z);
        trunkB.addGeo(new T.CylinderGeometry(.32, .5, h * .55, 7), x, gy + h * .27, z);
        const n = RI(3, 5);
        for (let i = 0; i < n; i++) {
          const a = rng.range(0, TAU), rr = R(0, cp * .45);
          const bx = x + Math.cos(a) * rr, bz = z + Math.sin(a) * rr;
          const by = gy + h * R(.52, .92);
          const s = R(cp * .5, cp * .95);
          const geo = new T.IcosahedronGeometry(1, 0);
          geo.computeVertexNormals();
          (i % 3 ? leafB : leafDark).addGeo(geo, bx, by, bz, R(0, 1), R(0, 1), R(0, 1), s, s * R(.7, 1.0), s);
        }
      });
      trunkB.mesh(P);
      leafB.mesh(P, { name: 'tree-canopies' });
      leafDark.mesh(P);

      // low undergrowth / shrubs along banks, fences and roads
      const shrub = [];
      const shrubGeo = new T.IcosahedronGeometry(1, 0);
      for (let i = 0; i < 400; i++) {
        let x, z, gy;
        const mode = i % 4;
        if (mode === 0 || mode === 3) {  // around the pad bank / open apron
          const a = rng.range(0, TAU);
          x = Math.cos(a) * R(52, 76); z = Math.sin(a) * R(48, 72);
        } else if (mode === 1) {  // fence lines / road edges
          const r = ROADS[RI(0, ROADS.length - 1)];
          const t = rng.next();
          x = lerp(r.x1, r.x2, t) + R(-1, 1) * (r.w / 2 + R(1.2, 5));
          z = lerp(r.z1, r.z2, t) + R(-1, 1) * (r.w / 2 + R(1.2, 5));
        } else {  // random coastal plain
          x = R(-300, 190); z = R(-300, 300);
        }
        const xc = coastX(z);
        if (x > xc - 20) continue;
        if (Math.max(Math.abs(x), Math.abs(z)) < 44) continue;
        gy = terrainH(x, z);
        const s = R(.7, 2.3);
        shrub.push({
          p: [x, gy + s * .35, z], r: [R(0, 1), R(0, TAU), R(0, 1)],
          s: [s, s * R(.5, .8), s],
          c: rng.next() < .4 ? 0x54683a : 0x647a45
        });
      }
      makeInstanced(shrubGeo, std({ color: 0xffffff, roughness: .92 }), shrub, { name: 'shrubs' });
    })();

    /* ================================================== vehicles and people */
    (function vehicles() {
      const P = U.group('vehicles'); g.add(P);
      const bodies = new Builder(std({ color: 0xe4e2d8, roughness: .5, metalness: .2 }));
      const bodies2 = new Builder(std({ color: 0x8c3224, roughness: .5, metalness: .2 }));
      const wheels = new Builder(M.rubber);
      const glass = new Builder(M.glass);
      function vehicle(x, z, ry, red) {
        const gy = terrainH(x, z);
        const B = red ? bodies2 : bodies;
        B.addGeo(new T.BoxGeometry(2.05, 1.0, 4.7), x, gy + 1.0, z, 0, ry, 0);
        B.addGeo(new T.BoxGeometry(1.9, .85, 1.95), x - Math.sin(ry) * .45, gy + 1.85, z - Math.cos(ry) * .45, 0, ry, 0);
        glass.addGeo(new T.BoxGeometry(1.92, .5, 1.6), x - Math.sin(ry) * .45, gy + 2.0, z - Math.cos(ry) * .45, 0, ry, 0);
        const px = Math.cos(ry), pz = -Math.sin(ry);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
          wheels.addGeo(new T.CylinderGeometry(.42, .42, .32, 10),
            x + px * sx * .95 + Math.sin(ry) * sz * 1.5, gy + .45, z + pz * sx * .95 + Math.cos(ry) * sz * 1.5,
            PI / 2, ry, 0);
        }
      }
      vehicle(24, 210, .02, false);
      vehicle(26, 96, -.03, true);
      vehicle(-64, -34, .95, false);
      vehicle(-122, 62, .12, false);
      vehicle(48, -62, .2, false);
      bodies.mesh(P); bodies2.mesh(P); wheels.mesh(P); glass.mesh(P);

      // tiny human figures for scale
      const vest = new Builder(M.orange);
      const legs = new Builder(M.steelDark);
      const heads = new Builder(std({ color: 0xb59a7e, roughness: .85 }));
      const people = [
        [8.5, 14.5, 7.0], [9.6, 15.6, 7.0], [-9.2, 11.4, 7.0], [-7.8, 12.6, 7.0],
        [-24.5, 16.4, 7.0], [22, 250, null], [31, 150, null], [-70, 20, null]
      ];
      people.forEach(([x, z, fy]) => {
        const gy = fy === null ? terrainH(x, z) : fy;
        const hgt = R(.92, 1.02);
        vest.addGeo(new T.BoxGeometry(.42, .62, .26), x, gy + 1.16 * hgt, z, 0, R(0, 6.28), 0);
        legs.addGeo(new T.BoxGeometry(.34, .78, .24), x, gy + .39 * hgt, z, 0, 0, 0);
        heads.addGeo(new T.SphereGeometry(.13, 6, 5), x, gy + 1.62 * hgt, z);
      });
      vest.mesh(P); legs.mesh(P); heads.mesh(P);
    })();

    /* ======================================== ground cover, cones, cables, props */
    (function detailPass() {
      const P = U.group('detail-pass'); g.add(P);
      const TX0 = SPEC.tower.x;
      // grass tufts — instanced crossed billboards for ground-cover variation
      const tuftGeo = (function () {
        const a = new T.PlaneGeometry(1, 1); a.translate(0, .5, 0);
        const b = new T.PlaneGeometry(1, 1); b.rotateY(PI / 2); b.translate(0, .5, 0);
        return U.mergeGeometries([a, b]);
      })();
      const grassMat = std({ map: grassTex, alphaTest: .3, side: T.DoubleSide, roughness: .9, metalness: 0, color: 0xffffff });
      const tufts = [];
      for (let i = 0; i < 560; i++) {
        let x, z;
        if (i % 2 === 0) {
          const a = rng.range(0, TAU);
          x = Math.cos(a) * R(58, 168); z = Math.sin(a) * R(54, 168);
        } else {
          const r = ROADS[RI(0, ROADS.length - 1)], tt = rng.next();
          x = lerp(r.x1, r.x2, tt) + R(-1, 1) * (r.w / 2 + R(.4, 5));
          z = lerp(r.z1, r.z2, tt) + R(-1, 1) * (r.w / 2 + R(.4, 5));
        }
        if (x > coastX(z) - 10) continue;
        if (Math.abs(x) < 42 && Math.abs(z) < 38) continue;
        const gy = terrainH(x, z);
        const s = R(.5, 1.5);
        tufts.push({
          p: [x, gy, z], r: [0, R(0, TAU), 0],
          s: [s * R(1, 1.7), s, s * R(1, 1.7)],
          c: rng.next() < .4 ? 0x9aac74 : (rng.next() < .5 ? 0xb4bd88 : 0x849566)
        });
      }
      makeInstanced(tuftGeo, grassMat, tufts, { name: 'grass-tufts', cast: false, receive: false });

      // traffic cones around the MLP / ramp / trench mouth
      const coneGeo = new T.ConeGeometry(.24, .62, 8, 1, false);
      const cones = [];
      const coneAt = (x, z, y) => cones.push({ p: [x, (y === undefined ? PAD.deckY : y) + .31, z], s: 1 });
      for (let i = 0; i < 5; i++) { coneAt(-14.5 + i * 1.6, 13.2); coneAt(-14.5 + i * 1.6, -13.2); }
      for (let i = 0; i < 4; i++) coneAt(13.5, -5 + i * 2.4);
      coneAt(-27, 40, GROUND_Y + .1); coneAt(-24, 42, GROUND_Y + .1);
      makeInstanced(coneGeo, std({ color: 0xb84a24, roughness: .7, metalness: .05 }), cones, { name: 'cones', cast: false });

      // tower service doors + frames (reads as a working structure)
      const doorTex = U.texCanvas(64, 128, (ctx, cv) => {
        ctx.fillStyle = '#3a4142'; ctx.fillRect(0, 0, 64, 128);
        ctx.strokeStyle = 'rgba(180,186,182,.22)'; ctx.lineWidth = 2;
        for (let y = 8; y < 128; y += 22) { ctx.beginPath(); ctx.moveTo(3, y); ctx.lineTo(61, y); ctx.stroke(); }
        ctx.strokeStyle = 'rgba(210,214,208,.35)'; ctx.lineWidth = 3;
        ctx.strokeRect(3, 3, 58, 122);
        ctx.fillStyle = 'rgba(200,205,198,.5)'; ctx.fillRect(48, 62, 8, 3);
      }, { srgb: true }).tex;
      [[-5.2, 11.4, 7.36], [-1.9, 11.4, 8.76], [-6.4, 9.3, 7.36]].forEach(([dx, dy, dz]) => {
        decalAt(g, doorTex, 2.0, 4.0, TX0 + dx, dy, dz, 0, 0, 0, .95);
      });
      const doorFrame = new Builder(M.steelDark);
      [[-5.2, 11.4, 7.32], [-1.9, 11.4, 8.72], [-6.4, 9.3, 7.32]].forEach(([dx, dy, dz]) => {
        doorFrame.box(2.4, .22, .22, TX0 + dx, dy + 2.1, dz);
        doorFrame.box(.22, 4.2, .22, TX0 + dx - 1.15, dy, dz);
        doorFrame.box(.22, 4.2, .22, TX0 + dx + 1.15, dy, dz);
      });
      doorFrame.mesh(P);

      // cable bundles / hoses from the tower base to the MLP and along the deck
      const hoses = [];
      for (let i = 0; i < 4; i++) {
        hoses.push(new T.TubeGeometry(new T.CatmullRomCurve3([
          V3(TX0 + 8.4, PAD.deckY + .8 + i * .16, -6 + i * 3.4),
          V3(TX0 + 13.5, PAD.deckY + 1.0 + i * .16, -6.5 + i * 3.5),
          V3(TX0 + 19.5, PAD.deckY + 1.4 + i * .16, -7 + i * 3.5),
          V3(-11.6, PAD.deckY + 1.2 + i * .16, -6 + i * 3.4)
        ]), 14, .12, 5, false));
      }
      const hoseMesh = new T.Mesh(U.mergeGeometries(hoses), M.rubber);
      hoseMesh.castShadow = true; P.add(hoseMesh);
      const trays = new Builder(M.steelDark);
      trays.box(.55, .2, 22, -14.0, PAD.deckY + .1, 10.5);
      trays.box(.55, .2, 22, -14.0, PAD.deckY + .1, -10.5);
      trays.box(22, .2, .55, 4, PAD.deckY + .1, 12.6);
      trays.mesh(P);
      // a couple of crates / cable reels near the platform base
      const crates = new Builder(M.orange);
      crates.box(1.6, 1.1, 1.1, -13.2, PAD.deckY + .55, 15.2, .3);
      crates.box(1.2, .9, .9, -12.0, PAD.deckY + .45, 16.1, -.2);
      crates.mesh(P);
      const reels = new Builder(M.steelDark);
      reels.addGeo(new T.CylinderGeometry(.75, .75, .9, 12), -15.6, PAD.deckY + .8, 16.6, PI / 2, 0, 0);
      reels.addGeo(new T.CylinderGeometry(.75, .75, .9, 12), -15.6, PAD.deckY + .8, 17.9, PI / 2, 0, 0);
      reels.mesh(P);

      // two extra vehicles on the access road (fire tender + pickup)
      function truck(x, z, ry, bodyMat, cabMat) {
        const gy = terrainH(x, z);
        const bod = new Builder(bodyMat), cab = new Builder(cabMat), wheel = new Builder(M.rubber), win = new Builder(M.glass);
        bod.box(2.4, 1.7, 6.2, x, gy + 1.45, z, ry);
        cab.box(2.3, 1.5, 2.2, x - Math.sin(ry) * 3.2, gy + 1.5, z - Math.cos(ry) * 3.2, ry);
        win.box(2.32, .7, 1.4, x - Math.sin(ry) * 3.2, gy + 2.0, z - Math.cos(ry) * 3.2, ry);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
          wheel.addGeo(new T.CylinderGeometry(.5, .5, .36, 10),
            x + Math.cos(ry) * sx * 1.15 + Math.sin(ry) * sz * 2.1, gy + .52, z - Math.sin(ry) * sx * 1.15 + Math.cos(ry) * sz * 2.1,
            PI / 2, ry, 0);
        }
        bod.mesh(P); cab.mesh(P); wheel.mesh(P); win.mesh(P);
      }
      truck(-20, 76, .35, std({ color: 0xa8331f, roughness: .5, metalness: .18 }), std({ color: 0xe6e4da, roughness: .5, metalness: .12 }));
      truck(38, 132, .05, std({ color: 0xe2e0d4, roughness: .55, metalness: .12 }), std({ color: 0xdcd9cc, roughness: .55, metalness: .1 }));
    })();

    // weathering: damp stains, blast scorch and runoff streaks around the pad
    (function padWeathering() {
      for (const [x, z, w, d] of [[-30, 26, 16, 12], [26, 24, 20, 14], [-32, -24, 14, 11], [30, -26, 12, 10], [0, 30, 22, 9]]) {
        decalAt(g, stainTex, w, d, x, PAD.deckY + .024, z, -PI / 2, 0, R(0, TAU), .22);
      }
      // runoff streaks down the concrete faces
      for (let i = 0; i < 12; i++) {
        const side = i % 4;
        if (side === 0) decalAt(g, sootTex, R(2, 7), R(2.4, 5), R(-38, 38), R(2.2, 6.4), 35.06, 0, 0, 0, .2);
        else if (side === 1) decalAt(g, sootTex, R(2, 7), R(2.4, 5), R(-38, 38), R(2.2, 6.4), -35.06, 0, PI, 0, .2);
        else decalAt(g, sootTex, R(2.6, 6), R(3, 6), -39.06, R(2.2, 6.4), R(-33, 33), 0, -PI / 2, 0, .2);
      }
    })();
    flushDecals();

    /* -------------------------------------------------------- registration + */
    APP.registerPart('tower', {
      zh: '固定服务塔', en: 'FIXED SERVICE TOWER', section: '发射场',
      index: false, modes: ['overall'], group: null,
      anchor: () => V3(SPEC.tower.x, 82, SPEC.tower.z),
      specs: [['高度', '91.7 m（塔顶约 98.7 m）'], ['平面', '16 × 16 m'], ['功能', '吊装 / 加注 / 测试 / 摆杆供气']],
      desc: '101 工位的固定服务塔高 91.7 米，蓝色服务间与开放钢桁架并置，四根摆杆在发射前为箭体供气、供电并维持温湿度。'
    });
    APP.registerPart('launch_mount', {
      zh: '活动发射平台', en: 'MOBILE LAUNCH PLATFORM', section: '发射场',
      index: false, modes: ['overall'], group: null,
      anchor: () => V3(0, 13.4, 11.6),
      specs: [['平台尺寸', '24 × 24 m'], ['台面高度', '12.2 m（高出地面约 11.3 m）'], ['功能', '承载箭体 / 尾端夹持 / 排焰']],
      desc: '箭体在垂直总装测试厂房完成组装后，由活动发射平台沿专用道路整体转运至 101 工位，平台中央的排焰口把起飞尾焰导入导流槽。'
    });
    APP.registerPart('lightning', {
      zh: '避雷塔', en: 'LIGHTNING PROTECTION MASTS', section: '发射场',
      index: false, modes: ['overall'], group: null,
      anchor: () => V3(58, 96, 52),
      specs: [['数量', '4 座'], ['高度', '约 110 m'], ['保护', '悬链线引雷 / 双回路接地']],
      desc: '四座白色格构式避雷塔分列工位四角，塔顶悬链线与避雷针把雷电流引至接地网，保护箭体与塔架在雷雨季节的安全。'
    });
    APP.registerPart('vab', {
      zh: '垂直总装测试厂房', en: 'VEHICLE ASSEMBLY BUILDING', section: '发射场',
      index: false, modes: ['overall'], group: null,
      anchor: () => V3(-900, 84, -650),
      specs: [['高跨', '2 个'], ['总装高度', '约 100 m'], ['位置', '距 101 工位约 2.8 km（场景压缩）']],
      desc: '长征五号在垂直总装测试厂房内完成芯级、助推器与整流罩合罩，随后由活动发射平台垂直转运至 101 工位。'
    });

    /* --------------------------------------------------------------- runtime */
    function update(dt, t) {
      // red obstruction lights breathe slowly at night
      for (let i = 0; i < beacons.length; i++) {
        const b = beacons[i];
        if (!nightAmt) { b.m.emissiveIntensity = 0; continue; }
        const pulse = .55 + .45 * Math.sin(t * 1.9 + b.phase);
        b.m.emissiveIntensity = b.base * nightAmt * pulse;
      }
    }
    APP.updaters.push(update);
    setNight(0);

    APP.modules.site = {
      group: g,
      setNight,
      terrainH,
      coastX,
      groundY: GROUND_Y,
      anchors: {
        tower: V3(SPEC.tower.x, 82, SPEC.tower.z),
        mlp: V3(0, 12.2, 0),
        masts: SPEC.masts.map(m => V3(m[0], 96, m[1])),
        vab: V3(-900, 84, -650)
      }
    };
    return APP.modules.site;
  };
})();
