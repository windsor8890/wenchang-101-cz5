/* ============================================================================
 * 45-interior.js — CZ-5 / Chang'e 7 rocket internals · cutaway centrepiece
 * Owner: interior.  Write scope: this file only.
 *
 * Cutaway strategy (Lead decision): interior materials are NOT clipped by
 * APP.cutPlane.  Wall-mounted structure (tank walls, domes, frames, stringers,
 * baffles, raceways, wall plumbing) is built as an explicit half section on
 * x < 0, so it reads as a deliberate peel; free-standing machinery (engines,
 * ducts, bottles, thrust frame, truss) stays whole.  Warm-red section caps sit
 * on the x = 0 plane and are shown/hidden from APP.cutPlane.constant.
 *
 * Stations follow SPEC.rocket.stations exactly (local y from nozzle exit).
 * ==========================================================================*/
(function () {
  'use strict';

  window.buildInterior = function (APP) {
    const T = window.THREE, U = window.U, SPEC = window.SPEC, FLAGS = window.FLAGS;
    const PI = Math.PI, TAU = PI * 2, DEG = PI / 180;
    const BASE = SPEC.rocket.baseY;
    const LQ = !!FLAGS.lq;
    const SEGA = LQ ? 24 : 40;   // main surfaces of revolution
    const SEGB = LQ ? 12 : 16;   // cylinders
    const SEGC = LQ ? 8 : 10;    // small cylinders

    const group = U.group('interior');
    group.position.set(0, BASE, 0);
    APP.scene.add(group);

    const ST = { tris: 0, draws: 0 };
    const sectionRibbons = [];   // { prof, cy, out, inn }
    const capsExtra = [];        // extra raw cap geos (cut pipes)

    /* ======================================================================
     * 0. materials — no clipping planes (interior is peeled, not clipped)
     * ====================================================================*/
    function mk() {
      const M = (o) => U.matStandard(o);
      return {
        wall: M({ color: 0xc2c6c1, roughness: 0.5, metalness: 0.42, envMapIntensity: 0.85, side: T.DoubleSide }),
        wallDim: M({ color: 0xa7aca8, roughness: 0.58, metalness: 0.35, side: T.DoubleSide }),
        wallIn: M({ color: 0xb5bab6, roughness: 0.55, metalness: 0.38, side: T.DoubleSide }),
        frame: M({ color: 0x878b6c, roughness: 0.62, metalness: 0.24, side: T.DoubleSide }),
        steel: M({ color: 0x8d9394, roughness: 0.42, metalness: 0.72, envMapIntensity: 1.0, side: T.DoubleSide }),
        steelD: M({ color: 0x4a5052, roughness: 0.48, metalness: 0.75, side: T.DoubleSide }),
        dark: M({ color: 0x2e3335, roughness: 0.55, metalness: 0.55, side: T.DoubleSide }),
        gold: M({ color: 0xb58a2f, roughness: 0.33, metalness: 0.72, envMapIntensity: 1.1, side: T.DoubleSide }),
        foil: M({ color: 0xc7cbc8, roughness: 0.34, metalness: 0.6, envMapIntensity: 1.1, side: T.DoubleSide }),
        white: M({ color: 0xdcd8cb, roughness: 0.58, metalness: 0.12, side: T.DoubleSide }),
        insul: M({ color: 0xd2c9b1, roughness: 0.8, metalness: 0.05, side: T.DoubleSide }),
        bell: M({ color: 0x50555a, roughness: 0.38, metalness: 0.85, envMapIntensity: 1.15, side: T.FrontSide }),
        bellIn: M({ color: 0x23272a, roughness: 0.5, metalness: 0.72, side: T.FrontSide }),
        copper: M({ color: 0x8b5a37, roughness: 0.38, metalness: 0.68, side: T.DoubleSide }),
        red: M({ color: 0xb83a24, roughness: 0.5, metalness: 0.2, side: T.DoubleSide }),
        cable: M({ color: 0x232625, roughness: 0.85, metalness: 0.08, side: T.DoubleSide }),
        amber: M({ color: 0x1a1512, roughness: 0.4, metalness: 0.2, emissive: 0xffab54, emissiveIntensity: 1.5, side: T.DoubleSide }),
        green: M({ color: 0x101510, roughness: 0.4, metalness: 0.2, emissive: 0x63d489, emissiveIntensity: 1.3, side: T.DoubleSide }),
        cap: M({ color: 0x9d3421, roughness: 0.6, metalness: 0.2, side: T.DoubleSide })
      };
    }
    const M = mk();

    /* ======================================================================
     * 1. geometry helpers
     * ====================================================================*/
    function xform(g, o) {
      if (!o) return g;
      if (o.sx !== undefined || o.sy !== undefined || o.sz !== undefined) {
        g.scale(o.sx === undefined ? 1 : o.sx, o.sy === undefined ? 1 : o.sy, o.sz === undefined ? 1 : o.sz);
      }
      if (o.rx) g.rotateX(o.rx);
      if (o.ry) g.rotateY(o.ry);
      if (o.rz) g.rotateZ(o.rz);
      if (o.x || o.y || o.z) g.translate(o.x || 0, o.y || 0, o.z || 0);
      return g;
    }

    function dedupe(prof) {
      const out = [];
      for (let i = 0; i < prof.length; i++) {
        const r = Math.max(0, prof[i][0] || 0), y = prof[i][1] || 0;
        if (!isFinite(r) || !isFinite(y)) continue;
        if (out.length) {
          const p = out[out.length - 1];
          if (Math.abs(p[0] - r) < 1e-4 && Math.abs(p[1] - y) < 1e-4) continue;
        }
        out.push([r, y]);
      }
      return out;
    }
    function latheGeo(prof, seg, phi0, phiL) {
      const p = dedupe(prof);
      if (p.length < 2) return null;
      return new T.LatheGeometry(p.map(q => new T.Vector2(q[0], q[1])), seg || SEGA,
        phi0 === undefined ? 0 : phi0, phiL === undefined ? TAU : phiL);
    }
    function halfLatheGeo(prof, seg) { return latheGeo(prof, seg, PI, PI); }  // x < 0 half

    // dome profile: equator (r, yEq) → apex (0, yEq + dir*depth)
    function domePts(r, yEq, depth, dir, steps) {
      const n = steps || 9, out = [];
      for (let i = 0; i <= n; i++) {
        const th = (i / n) * (PI / 2 - 0.012);
        out.push([Math.max(0.02, r * Math.cos(th)), yEq + dir * depth * Math.sin(th)]);
      }
      return out;
    }
    // full tank profile bottom apex -> aft dome -> barrel -> forward dome -> top apex
    function tankProf(r, yBotApex, yBotEq, yTopEq, yTopApex, steps) {
      const bot = domePts(r, yBotEq, yBotApex - yBotEq, -1, steps).reverse(); // apex -> equator
      const top = domePts(r, yTopEq, yTopApex - yTopEq, yTopApex >= yTopEq ? 1 : -1, steps);
      top.shift(); // drop duplicated equator point
      return bot.concat([[r, yTopEq]], top);
    }
    // offset a [r,y] profile by t along its outward normal (heuristic ref point for orientation)
    function offsetProfile(prof, t, cy) {
      const out = [];
      for (let i = 0; i < prof.length; i++) {
        const a = prof[Math.max(0, i - 1)], b = prof[Math.min(prof.length - 1, i + 1)];
        let dr = b[0] - a[0], dy = b[1] - a[1];
        const L = Math.hypot(dr, dy) || 1;
        let nr = dy / L, ny = -dr / L;
        if (prof[i][0] * nr + (prof[i][1] - cy) * ny < 0) { nr = -nr; ny = -ny; }
        out.push([Math.max(0, prof[i][0] + t * nr), prof[i][1] + t * ny]);
      }
      return out;
    }
    // warm-red section ribbon on the x = 0 plane between two profiles
    function ribbonGeo(pOut, pIn) {
      const n = Math.min(pOut.length, pIn.length);
      const pos = [], nor = [], uv = [], idx = [];
      for (const side of [1, -1]) {
        const base = pos.length / 3;
        for (let i = 0; i < n; i++) {
          pos.push(0, pOut[i][1], side * pOut[i][0]); nor.push(1, 0, 0); uv.push(i / (n - 1), 1);
          pos.push(0, pIn[i][1], side * pIn[i][0]); nor.push(1, 0, 0); uv.push(i / (n - 1), 0);
        }
        for (let i = 0; i < n - 1; i++) {
          // barrels are cut by the rocket shell's own red edge — only cap the domes
          if (Math.abs(pOut[i + 1][0] - pOut[i][0]) < 1e-3 && Math.abs(pIn[i + 1][0] - pIn[i][0]) < 1e-3) continue;
          const a = base + i * 2, b = a + 1, c = a + 2, d = a + 3;
          if (side > 0) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d);
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
    function rodGeo(a, b, r, seg) {
      const A = new T.Vector3(a[0], a[1], a[2]), B = new T.Vector3(b[0], b[1], b[2]);
      const d = new T.Vector3().subVectors(B, A), len = d.length();
      if (!(len > 1e-4)) return null;
      const g = new T.CylinderGeometry(r, r, len, seg || SEGC, 1, false);
      g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), d.clone().normalize()));
      g.translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2);
      return g;
    }
    function pipeGeo(pts, r, o) {
      o = o || {};
      const v = [];
      for (const p of pts) {
        const q = new T.Vector3(p[0], p[1], p[2]);
        if (!v.length || v[v.length - 1].distanceToSquared(q) > 1e-5) v.push(q);
      }
      if (v.length < 2) return null;
      const curve = new T.CatmullRomCurve3(v, false, 'catmullrom', 0.35);
      return new T.TubeGeometry(curve, o.tSeg || 18, r, o.rSeg || (LQ ? 5 : 7), false);
    }
    function discX(x, y, z, r, seg) {
      const g = new T.CircleGeometry(r, seg || 10);
      g.rotateY(PI / 2);
      g.translate(x, y, z);
      return g;
    }
    function ang2(a) { return { x: Math.cos(a), z: Math.sin(a) }; }
    const HALF_A = (i, n) => (PI / 2 + ((i + 0.5) / n) * PI);   // x<0 wall angles

    class Parts {
      constructor() { this.items = []; }
      add(mat, geo, o) { if (!geo) return this; xform(geo, o); this.items.push([mat, geo]); return this; }
      box(mat, w, h, d, o) { return this.add(mat, new T.BoxGeometry(w, h, d), o); }
      cyl(mat, rt, rb, h, seg, o) {
        o = o || {};
        return this.add(mat, new T.CylinderGeometry(rt, rb, h, seg || SEGB, 1, !!o.openEnded,
          o.thetaStart === undefined ? 0 : o.thetaStart, o.thetaLength === undefined ? TAU : o.thetaLength), o);
      }
      sphere(mat, r, o) { return this.add(mat, new T.SphereGeometry(r, LQ ? 8 : 12, LQ ? 6 : 8), o); }
      torus(mat, R, r, o) { return this.add(mat, new T.TorusGeometry(R, r, LQ ? 4 : 6, LQ ? 10 : 16), o); }
      lathe(mat, prof, seg, o) { return this.add(mat, latheGeo(prof, seg), o); }
      half(mat, prof, seg, o) { return this.add(mat, halfLatheGeo(prof, seg), o); }
      rod(mat, a, b, r, seg) { return this.add(mat, rodGeo(a, b, r, seg)); }
      pipe(mat, pts, r, o) { return this.add(mat, pipeGeo(pts, r, o)); }
      absorb(sub, mtx) {
        for (const it of sub.items) { if (mtx) it[1].applyMatrix4(mtx); this.items.push(it); }
        sub.items = [];
        return this;
      }
      finish(parent, tag) {
        const buckets = new Map();
        for (const it of this.items) {
          const arr = buckets.get(it[0]);
          if (arr) arr.push(it[1]); else buckets.set(it[0], [it[1]]);
        }
        let k = 0;
        buckets.forEach((geos, mat) => {
          const good = [];
          for (const g of geos) {
            if (!g || !g.attributes || !g.attributes.position) continue;
            const bound = g.boundingSphere || (g.computeBoundingSphere(), g.boundingSphere);
            if (!bound || !isFinite(bound.radius) || bound.radius <= 0) continue;
            good.push(g);
          }
          if (!good.length) return;
          let merged;
          try { merged = U.mergeGeometries(good); } catch (e) { if (window.reportError) reportError('interior merge ' + (tag || '') + ': ' + e.message); return; }
          if (!merged || !merged.attributes.position) return;
          merged.computeBoundingSphere();
          if (!merged.boundingSphere || !isFinite(merged.boundingSphere.radius)) return;
          const mesh = new T.Mesh(merged, mat);
          mesh.castShadow = false; mesh.receiveShadow = false;
          mesh.name = (tag || 'interior') + '-' + (k++);
          parent.add(mesh);
          ST.tris += merged.attributes.position.count / 3;
          ST.draws++;
          for (const g of good) g.dispose();
        });
        this.items = [];
        return this;
      }
    }

    /* ---- shared sub-assemblies ----*/
    function ringFrame(P, r, y, h, depth, seg) {
      P.half(M.frame, [[r, y - h / 2], [r - depth, y - h / 2], [r - depth, y + h / 2], [r, y + h / 2], [r, y - h / 2]], seg || SEGA);
    }
    function stringersHalf(P, r, y0, y1, n, w, d) {
      const h = y1 - y0, ym = (y0 + y1) / 2;
      for (let i = 0; i < n; i++) {
        const a = HALF_A(i, n), c = Math.cos(a), s = Math.sin(a);
        P.box(M.frame, d, h, w, { x: c * (r - d / 2), y: ym, z: s * (r - d / 2), ry: -a });
      }
    }
    function baffleHalf(P, r, y, width, lip) {
      P.add(M.steel, new T.RingGeometry(Math.max(0.05, r - width), r, LQ ? 20 : 32, 1, PI / 2, PI), { rx: -PI / 2, y: y });
      P.cyl(M.frame, r - width, r - width, lip || 0.14, LQ ? 16 : 24, { y: y + (lip || 0.14) / 2, openEnded: true, thetaStart: PI, thetaLength: PI });
    }
    function raceway(P, r, y0, y1, a) {
      const c = Math.cos(a), s = Math.sin(a), h = y1 - y0, ym = (y0 + y1) / 2;
      P.box(M.steelD, 0.06, h, 0.2, { x: c * (r - 0.03), y: ym, z: s * (r - 0.03), ry: -a });
      for (let k = 0; k < 3; k++) {
        P.cyl(M.cable, 0.022, 0.022, h, 6, { x: c * (r - 0.06) + Math.cos(a + PI / 2) * (k - 1) * 0.055, y: ym, z: s * (r - 0.06) + Math.sin(a + PI / 2) * (k - 1) * 0.055 });
      }
      for (let y = y0 + 0.5; y < y1; y += 1.8) {
        P.box(M.steel, 0.1, 0.06, 0.26, { x: c * (r - 0.02), y: y, z: s * (r - 0.02), ry: -a });
      }
    }
    function wallPipe(P, r, a, y0, y1, rad, mat) {
      const c = Math.cos(a), s = Math.sin(a);
      P.pipe(mat || M.foil, [
        [c * r, y0, s * r], [c * (r - 0.01), (y0 + y1) / 2, s * (r - 0.01)], [c * r, y1, s * r]
      ], rad || 0.035, { tSeg: 8, rSeg: 6 });
      for (let y = y0 + 0.6; y < y1; y += 1.5) {
        P.box(M.steel, 0.07, 0.045, 0.07, { x: c * (r - 0.02), y: y, z: s * (r - 0.02), ry: -a });
      }
    }
    function valve(P, x, y, z, s, dir) {
      s = s || 1;
      P.cyl(M.steelD, 0.075 * s, 0.075 * s, 0.16 * s, SEGC, { x: x, y: y, z: z, rz: (dir || 0) + PI / 2 });
      P.cyl(M.steel, 0.095 * s, 0.095 * s, 0.026 * s, SEGC, { x: x, y: y, z: z, rz: (dir || 0) + PI / 2 });
      P.box(M.copper, 0.09 * s, 0.09 * s, 0.12 * s, { x: x, y: y + 0.13 * s, z: z });
      P.box(M.red, 0.07 * s, 0.03 * s, 0.07 * s, { x: x, y: y + 0.19 * s, z: z });
    }
    function boltRing(P, x, y, z, R, n, s) {
      s = s || 0.014;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        P.cyl(M.steelD, s, s, s * 1.4, 6, { x: x + Math.cos(a) * R, y: y, z: z + Math.sin(a) * R });
      }
    }
    function bottle(P, x, y, z, r, h, mat) {
      P.cyl(mat || M.foil, r, r, h, SEGC, { x: x, y: y, z: z });
      P.sphere(mat || M.foil, r * 0.99, { x: x, y: y + h / 2, z: z });
      P.sphere(mat || M.foil, r * 0.99, { x: x, y: y - h / 2, z: z });
      P.box(M.steel, 0.1, 0.05, 0.1, { x: x, y: y + h / 2 + r * 0.8, z: z });
    }
    function avionicsBox(P, x, y, z, w, h, d, ry, lit) {
      P.box(M.white, w, h, d, { x: x, y: y, z: z, ry: ry || 0 });
      P.box(M.steelD, w * 1.04, 0.03, d * 1.04, { x: x, y: y + h / 2, z: z, ry: ry || 0 });
      if (lit) {
        P.box(M.green, 0.03, 0.03, 0.012, { x: x + Math.cos(ry || 0) * (w / 2 + 0.01), y: y + h * 0.28, z: z - Math.sin(ry || 0) * (w / 2 + 0.01), ry: ry || 0 });
        P.box(M.amber, 0.03, 0.03, 0.012, { x: x - Math.cos(ry || 0) * (w / 2 + 0.01), y: y + h * 0.28, z: z + Math.sin(ry || 0) * (w / 2 + 0.01), ry: ry || 0 });
      }
    }

    /* ======================================================================
     * 2. tank wall builder — half section, double-wall read, cap ribbon
     * ====================================================================*/
    function tankWall(P, prof, opts) {
      opts = opts || {};
      // The rocket shell IS the tank barrel (it is what gets clipped open), so the
      // interior wall sits a few cm inside it and shows a real wall section at the cut.
      const out = prof;
      const inn = offsetProfile(prof, -(opts.thick || 0.05), opts.cy || 16);
      P.half(opts.mat || M.wall, out, opts.seg || SEGA);
      P.half(opts.innerMat || M.wallIn, inn, opts.seg || SEGA);
      // inner stiffening
      if (opts.frames) {
        const n = opts.frames.n || 8, y0 = opts.frames.y0, y1 = opts.frames.y1;
        for (let i = 0; i < n; i++) {
          const y = y0 + (y1 - y0) * (i + 0.5) / n;
          const rr = innerRadiusAt(inn, y);
          ringFrame(P, rr, y, opts.frames.h || 0.09, 0.07, opts.frames.seg);
        }
      }
      if (opts.stringers) {
        const nn = opts.stringers.n || 26;
        const y0 = opts.stringers.y0, y1 = opts.stringers.y1;
        const rr = innerRadiusAt(inn, (y0 + y1) / 2);
        stringersHalf(P, rr, y0, y1, nn, 0.07, 0.06);
      }
      sectionRibbons.push({ prof: out, inn: inn, cy: opts.cy || 16, outT: 0.012 });
      return { out: out, inn: inn };
    }
    function innerRadiusAt(prof, y) {
      // nearest profile radius at station y
      let best = prof[0], bd = 1e9;
      for (const p of prof) { const d = Math.abs(p[1] - y); if (d < bd) { bd = d; best = p; } }
      return best[0];
    }

    /* ======================================================================
     * 3. engine assemblies (local y = 0 at the nozzle exit plane)
     * ====================================================================*/
    function bellFull(P, o) {
      // outer + inner nozzle surfaces as full revolves (single-sided, opposite normals)
      const prof = [], n = o.steps || 12, flare = o.flare || 1.9;
      for (let i = 0; i <= n; i++) {
        const f = i / n;
        const y = U.lerp(o.yExit, o.yThroat, f);
        let r = o.rThroat + (o.rExit - o.rThroat) * Math.pow(1 - f, flare);
        r *= 1 + 0.016 * Math.pow(1 - f, 6);
        prof.push([r, y]);
      }
      if (o.chamberR && o.yChamber) {
        const m = 4;
        for (let i = 1; i <= m; i++) {
          const f = i / m, y = U.lerp(o.yThroat, o.yChamber, f);
          prof.push([o.rThroat + (o.chamberR - o.rThroat) * (0.5 - 0.5 * Math.cos(f * PI)), y]);
        }
      }
      P.lathe(o.mat || M.bell, prof, o.seg || SEGA);
      const inner = offsetProfile(prof, -0.022, (o.yExit + o.yThroat) / 2);
      inner.reverse();
      P.lathe(M.bellIn, inner, o.seg || SEGA);
      // stiffener hoops on the outside of the bell
      for (let k = 1; k <= (o.hoops || 2); k++) {
        const f = k / ((o.hoops || 2) + 1);
        const y = U.lerp(o.yExit, o.yThroat, f);
        const r = o.rThroat + (o.rExit - o.rThroat) * Math.pow(1 - f, flare) + 0.024;
        P.torus(M.steelD, r, 0.02, { y: y, rx: PI / 2 });
      }
      return prof;
    }
    function turbopump(P, x, y, z, r, h) {
      P.cyl(M.steel, r, r * 1.06, h, SEGB, { x: x, y: y, z: z });
      P.cyl(M.steelD, r * 1.16, r * 1.16, 0.04, SEGB, { x: x, y: y - h / 2 + 0.04, z: z });
      P.cyl(M.steelD, r * 1.16, r * 1.16, 0.04, SEGB, { x: x, y: y + h / 2 - 0.04, z: z });
      P.cyl(M.steel, r * 0.72, r * 0.72, r * 2.2, SEGC, { x: x - r * 1.7, y: y + h * 0.16, z: z, rz: PI / 2 });
      P.cyl(M.steel, r * 0.6, r * 0.6, r * 1.8, SEGC, { x: x + r * 1.5, y: y - h * 0.24, z: z, rz: PI / 2 });
      boltRing(P, x, y + h / 2 - 0.04, z, r * 1.16, 8, 0.012);
      P.box(M.white, 0.07, 0.1, 0.012, { x: x + r * 0.9, y: y, z: z + r * 0.72, ry: -0.5 });
    }
    function engineYF77(P, ex) {
      const E = new Parts();
      // combustion chamber + injector (above the bell throat at y = 2.5)
      E.lathe(M.bell, [[0.19, 2.5], [0.205, 2.62], [0.235, 2.76], [0.262, 2.9], [0.262, 2.98]], SEGB);
      E.lathe(M.steelD, [[0.262, 2.98], [0.245, 3.06], [0.16, 3.13], [0.06, 3.16], [0.02, 3.165]], SEGB);
      boltRing(E, 0, 3.0, 0, 0.268, 12, 0.013);
      // gimbal block / powerhead
      E.box(M.steelD, 0.34, 0.2, 0.34, { y: 3.2 });
      E.cyl(M.steel, 0.11, 0.13, 0.18, SEGB, { y: 3.34 });
      boltRing(E, 0, 3.15, 0, 0.24, 8, 0.012);
      // LH2 turbopump (+x side, faces the cut camera for the far engine)
      turbopump(E, 0.62, 3.04, 0.14, 0.23, 0.6);
      E.torus(M.copper, 0.26, 0.028, { x: 0.62, y: 2.7, z: 0.14, rx: PI / 2 });
      // LOX turbopump
      turbopump(E, -0.54, 3.0, -0.12, 0.195, 0.48);
      // gas generator
      E.cyl(M.dark, 0.105, 0.115, 0.3, SEGC, { x: 0.30, y: 2.72, z: 0.46 });
      E.lathe(M.dark, [[0.105, 2.87], [0.07, 2.93], [0.02, 2.95]], SEGC, { x: 0.30, y: 0, z: 0.46 });
      // heat exchanger (coiled)
      for (let k = 0; k < 3; k++) E.torus(M.copper, 0.13, 0.024, { x: 0.62, y: 2.78 - k * 0.075, z: -0.30, rx: PI / 2 });
      E.cyl(M.steel, 0.04, 0.04, 0.34, SEGC, { x: 0.62, y: 2.9, z: -0.30 });
      // turbine exhaust duct into the nozzle
      E.pipe(M.copper, [[0.62, 2.68, 0.16], [0.66, 2.4, 0.3], [0.7, 2.1, 0.36], [0.6, 1.82, 0.3]], 0.072, { tSeg: 12, rSeg: 6 });
      // propellant dome → injector feeds
      E.pipe(M.steel, [[0.44, 3.2, 0.14], [0.28, 3.34, 0.06], [0.1, 3.3, 0.02]], 0.095, { tSeg: 8, rSeg: 7 });
      E.pipe(M.steel, [[-0.38, 3.16, -0.12], [-0.22, 3.32, -0.04], [-0.06, 3.3, 0]], 0.082, { tSeg: 8, rSeg: 7 });
      E.pipe(M.foil, [[0.3, 2.9, 0.46], [0.2, 3.05, 0.36], [0.08, 3.1, 0.24]], 0.04, { tSeg: 6, rSeg: 5 });
      E.pipe(M.foil, [[-0.4, 2.8, -0.3], [-0.3, 3.02, -0.22], [-0.14, 3.1, -0.1]], 0.035, { tSeg: 6, rSeg: 5 });
      // main valves
      valve(E, -0.54, 3.28, -0.12, 1.15, 0);
      valve(E, 0.62, 3.34, 0.14, 1.2, 0);
      valve(E, 0.3, 2.98, 0.46, 0.85, PI / 2);
      // gimbal actuators
      E.rod(M.steelD, [0.46, 2.62, 0.3], [0.74, 3.5, 0.56], 0.058, SEGC);
      E.rod(M.foil, [0.74, 3.5, 0.56], [0.9, 3.9, 0.68], 0.032, 8);
      E.rod(M.steelD, [-0.5, 2.62, -0.24], [-0.78, 3.5, -0.5], 0.058, SEGC);
      E.rod(M.foil, [-0.78, 3.5, -0.5], [-0.94, 3.9, -0.62], 0.032, 8);
      E.box(M.steelD, 0.12, 0.1, 0.12, { x: 0.74, y: 3.53, z: 0.56 });
      E.box(M.steelD, 0.12, 0.1, 0.12, { x: -0.78, y: 3.53, z: -0.5 });
      // nozzle throat insert visible inside the bell
      E.lathe(M.bellIn, [[0.165, 2.52], [0.2, 2.28], [0.255, 1.98], [0.31, 1.7]], SEGB);
      const mtx = new T.Matrix4().makeTranslation(ex, 0, 0);
      P.absorb(E, mtx);
    }
    function engineYF100(P, zc, flip) {
      const E = new Parts();
      // chamber above the bell throat
      E.lathe(M.bell, [[0.15, 2.05], [0.17, 2.18], [0.21, 2.34], [0.235, 2.5]], SEGB);
      E.lathe(M.steelD, [[0.235, 2.5], [0.2, 2.58], [0.11, 2.64], [0.02, 2.66]], SEGB);
      boltRing(E, 0, 2.52, 0, 0.24, 10, 0.012);
      // two small turbopumps
      turbopump(E, 0.36, 2.78, 0.1, 0.15, 0.4);
      turbopump(E, -0.33, 2.74, -0.1, 0.135, 0.34);
      // gas generator + exhaust
      E.cyl(M.dark, 0.075, 0.085, 0.22, SEGC, { x: 0.2, y: 2.6, z: 0.34 });
      E.pipe(M.copper, [[0.2, 2.52, 0.34], [0.26, 2.3, 0.4], [0.2, 2.06, 0.3]], 0.052, { tSeg: 8, rSeg: 5 });
      // feed lines + valves
      E.pipe(M.steel, [[0.26, 2.92, 0.1], [0.14, 3.06, 0.03], [0.02, 3.02, 0]], 0.07, { tSeg: 7, rSeg: 6 });
      E.pipe(M.steel, [[-0.23, 2.88, -0.1], [-0.12, 3.04, -0.03], [0.02, 3.0, 0]], 0.062, { tSeg: 7, rSeg: 6 });
      E.pipe(M.foil, [[0.2, 2.7, 0.34], [0.1, 2.86, 0.24], [0.02, 2.9, 0.14]], 0.03, { tSeg: 5, rSeg: 5 });
      valve(E, 0.36, 2.98, 0.1, 0.8, 0);
      valve(E, -0.33, 2.92, -0.1, 0.75, 0);
      // gimbal actuators
      E.rod(M.steelD, [0.3, 2.3, 0.2], [0.46, 3.26, 0.42], 0.044, SEGC);
      E.rod(M.foil, [0.46, 3.26, 0.42], [0.56, 3.6, 0.5], 0.026, 6);
      E.rod(M.steelD, [-0.3, 2.3, -0.2], [-0.46, 3.26, -0.42], 0.044, SEGC);
      E.rod(M.foil, [-0.46, 3.26, -0.42], [-0.56, 3.6, -0.5], 0.026, 6);
      let mtx = new T.Matrix4().makeTranslation(0, 0, zc);
      if (flip) mtx.multiply(new T.Matrix4().makeRotationY(PI));
      P.absorb(E, mtx);
    }
    function engineYF75D(P, ex, zc) {
      const E = new Parts();
      bellFull(E, { yExit: 0, yThroat: 1.98, rExit: 0.42, rThroat: 0.115, chamberR: 0.2, yChamber: 2.32, steps: 11, flux: 1, flare: 1.7, hoops: 2, seg: LQ ? 20 : 32 });
      // chamber / injector
      E.lathe(M.steelD, [[0.2, 2.32], [0.21, 2.4], [0.17, 2.47], [0.02, 2.49]], SEGB);
      boltRing(E, 0, 2.36, 0, 0.21, 10, 0.011);
      E.box(M.steelD, 0.26, 0.18, 0.26, { y: 2.56 });
      // 2 turbopumps
      turbopump(E, 0.32, 2.72, 0.12, 0.14, 0.36);
      turbopump(E, -0.3, 2.68, -0.1, 0.125, 0.3);
      E.cyl(M.dark, 0.07, 0.08, 0.2, SEGC, { x: 0.2, y: 2.56, z: 0.3 });
      E.pipe(M.copper, [[0.2, 2.48, 0.3], [0.26, 2.28, 0.36], [0.2, 2.06, 0.28]], 0.045, { tSeg: 8, rSeg: 5 });
      E.pipe(M.steel, [[0.22, 2.84, 0.12], [0.12, 2.96, 0.04], [0.02, 2.94, 0]], 0.062, { tSeg: 6, rSeg: 6 });
      E.pipe(M.steel, [[-0.2, 2.8, -0.1], [-0.1, 2.94, -0.03], [0.02, 2.92, 0]], 0.055, { tSeg: 6, rSeg: 6 });
      valve(E, 0.32, 2.9, 0.12, 0.72, 0);
      valve(E, -0.3, 2.86, -0.1, 0.68, 0);
      E.rod(M.steelD, [0.26, 2.28, 0.2], [0.4, 3.12, 0.4], 0.038, SEGC);
      E.rod(M.foil, [0.4, 3.12, 0.4], [0.5, 3.44, 0.46], 0.022, 6);
      E.rod(M.steelD, [-0.26, 2.28, -0.2], [-0.4, 3.12, -0.4], 0.038, SEGC);
      E.rod(M.foil, [-0.4, 3.12, -0.4], [-0.5, 3.44, -0.46], 0.022, 6);
      // gimbal block bolts
      boltRing(E, 0, 2.62, 0, 0.17, 8, 0.01);
      const mtx = new T.Matrix4().makeTranslation(ex, 0, zc || 0);
      P.absorb(E, mtx);
    }
    function engineYF50D(P, ex) {
      // payload owns the exterior bells — interior only adds throat/pump hardware
      const E = new Parts();
      E.lathe(M.steelD, [[0.115, 0.32], [0.14, 0.44], [0.11, 0.52], [0.03, 0.54]], SEGB);
      boltRing(E, 0, 0.4, 0, 0.13, 8, 0.009);
      turbopump(E, 0.2, 0.62, 0.05, 0.09, 0.22);
      turbopump(E, -0.18, 0.58, -0.06, 0.08, 0.2);
      E.pipe(M.steel, [[0.14, 0.74, 0.05], [0.06, 0.86, 0.02], [0, 0.86, 0]], 0.04, { tSeg: 5, rSeg: 5 });
      E.pipe(M.steel, [[-0.12, 0.72, -0.06], [-0.05, 0.88, -0.02], [0, 0.88, 0]], 0.035, { tSeg: 5, rSeg: 5 });
      valve(E, 0.2, 0.76, 0.05, 0.55, 0);
      P.absorb(E, new T.Matrix4().makeTranslation(ex, 44.74, 0));
    }

    /* ======================================================================
     * 4. CORE STAGE  — 0 → 33.16
     * ====================================================================*/
    const coreG = U.group('int-core');
    group.add(coreG);
    const CP = new Parts();
    (function buildCore() {
      const R = 2.44;
      // ---- LH2 tank (aft) 4.4 – 16.2, common bulkhead lower skin to 15.62
      const lh2 = tankProf(R, 4.55, 6.0, 16.2, 15.62, 10);
      tankWall(CP, lh2, {
        cy: 11, goldSkin: true,
        frames: { n: 10, y0: 6.4, y1: 15.9, h: 0.1 },
        stringers: { n: 28, y0: 6.3, y1: 15.9 }
      });
      // ---- LOX tank (fwd) 17.0 – 29.4
      const lox = tankProf(R, 16.42, 17.0, 27.9, 29.35, 10);
      tankWall(CP, lox, {
        cy: 23, frames: { n: 11, y0: 17.3, y1: 27.7, h: 0.1 },
        stringers: { n: 28, y0: 17.2, y1: 27.7 }
      });
      // ---- slosh baffles
      [[9.7], [11.8], [13.9]].forEach(p => baffleHalf(CP, 2.39, p[0], 0.5, 0.16));
      [[19.3], [21.6], [23.9], [26.2]].forEach(p => baffleHalf(CP, 2.39, p[0], 0.55, 0.18));
      // ---- common bulkhead: two skins are tank ends above; add spacer webs
      for (let i = 0; i < 14; i++) {
        const a = HALF_A(i, 14), r = 2.24, c = Math.cos(a), s = Math.sin(a);
        CP.box(M.insul, 0.1, 0.78, 0.16, { x: c * r, y: 16.6, z: s * r, ry: -a });
      }
      CP.half(M.insul, [[2.36, 16.25], [2.36, 16.95]], SEGB);
      // ---- LOX transfer ducts through the LH2 tank (gold MLI, bellows)
      [-1, 1].forEach(sx => {
        const x = sx * 0.82;
        CP.pipe(M.gold, [[x, 16.55, 0.05], [x, 14.6, -0.05], [x, 11.8, -0.12], [x * 1.06, 8.8, -0.1],
        [x * 1.12, 6.2, 0.0], [x * 1.22, 4.5, 0.16], [sx * 1.25, 3.42, 0.3]], 0.235, { tSeg: 26, rSeg: 10 });
        for (let k = 0; k < 6; k++) {
          const y = 15.0 - k * 1.55;
          CP.torus(M.gold, 0.252, 0.028, { x: x * (1 + 0.03 * k), y: y, z: -0.05 - 0.02 * k, rx: PI / 2 });
        }
        // clamps to the wall
        [12.4, 9.2].forEach(y => {
          CP.rod(M.steel, [x * 1.03, y, -0.1], [sx * 2.28, y, -0.1], 0.028, 6);
        });
        // inline valve near the top
        valve(CP, x, 15.9, 0.05, 1.25, PI);
      });
      // ---- LH2 feed ducts from the aft dome into the pumps
      [-1, 1].forEach(sx => {
        CP.pipe(M.foil, [[sx * 1.66, 5.1, 0], [sx * 1.7, 4.7, 0.02], [sx * 1.62, 4.15, 0.12],
        [sx * 1.4, 3.7, 0.26], [sx * 1.28, 3.36, 0.4]], 0.3, { tSeg: 12, rSeg: 9 });
        CP.torus(M.foil, 0.32, 0.03, { x: sx * 1.67, y: 4.8, z: 0.02, rx: PI / 2 });
      });
      // ---- aft dome gold MLI (exterior, visible from the engine bay)
      CP.half(M.gold, offsetProfile(domePts(2.42, 6.0, 1.45, -1, 8).reverse(), 0.04, 6), SEGA);
      // ---- pressurisation / vent lines on the far wall
      wallPipe(CP, 2.3, 2.25, 6.4, 15.8, 0.045, M.foil);
      wallPipe(CP, 2.3, 2.55, 6.4, 28.6, 0.035, M.foil);
      wallPipe(CP, 2.3, 4.35, 17.4, 27.8, 0.04, M.copper);
      // circumferential half ring pipes (deliberately cut at x = 0)
      [13.2, 24.6].forEach(y => {
        const pts = [];
        for (let i = 0; i <= 6; i++) { const a = PI / 2 + (i / 6) * PI; pts.push([Math.cos(a) * 2.3, y, Math.sin(a) * 2.3]); }
        CP.pipe(M.foil, pts, 0.045, { tSeg: 14, rSeg: 6 });
        capsExtra.push(discX(0, y, 2.3, 0.05, 10), discX(0, y, -2.3, 0.05, 10));
      });
      // ---- helium bottles near the common bulkhead
      [2.0, 2.7, 3.9, 4.6].forEach(a => {
        CP.sphere(M.foil, 0.23, { x: Math.cos(a) * 1.62, y: 14.9, z: Math.sin(a) * 1.62 });
        CP.rod(M.steel, [Math.cos(a) * 1.62, 14.6, Math.sin(a) * 1.62], [Math.cos(a) * 2.32, 14.2, Math.sin(a) * 2.32], 0.03, 6);
        CP.rod(M.steel, [Math.cos(a) * 1.62, 15.15, Math.sin(a) * 1.62], [Math.cos(a) * 2.32, 15.5, Math.sin(a) * 2.32], 0.03, 6);
        CP.pipe(M.copper, [[Math.cos(a) * 1.62, 15.15, Math.sin(a) * 1.62], [Math.cos(a) * 1.9, 15.7, Math.sin(a) * 1.9]], 0.022, { tSeg: 4, rSeg: 5 });
      });
      // ---- cable raceways on the far wall + hatch rings
      raceway(CP, 2.37, 5.0, 16.0, 2.15);
      raceway(CP, 2.37, 17.2, 28.4, 4.05);
      raceway(CP, 2.34, 6.2, 15.6, 3.15);
      // wall-mounted valve / sensor clusters (read as machinery in close-up)
      [[2.9, 12.4], [3.5, 20.2], [2.5, 25.6], [4.4, 9.6], [3.2, 16.8], [4.0, 23.1]].forEach(p => {
        const a = p[0], y = p[1], rr = 2.27, c = Math.cos(a), s = Math.sin(a);
        CP.box(M.white, 0.2, 0.26, 0.12, { x: c * rr, y: y, z: s * rr, ry: -a });
        CP.box(M.steelD, 0.12, 0.1, 0.06, { x: c * (rr - 0.08), y: y - 0.1, z: s * (rr - 0.08), ry: -a });
        CP.cyl(M.copper, 0.045, 0.045, 0.16, SEGC, { x: c * (rr - 0.1), y: y + 0.16, z: s * (rr - 0.1) });
        CP.pipe(M.cable, [[c * rr, y - 0.14, s * rr], [c * (rr - 0.04), y - 0.5, s * (rr - 0.04)],
        [c * (rr - 0.06), y - 1.2, s * (rr - 0.06)]], 0.018, { tSeg: 6, rSeg: 4 });
      });
      // extra helium bottles low in the LH2 tank
      [2.05, 4.5].forEach(a => {
        CP.sphere(M.foil, 0.21, { x: Math.cos(a) * 1.6, y: 7.4, z: Math.sin(a) * 1.6 });
        CP.rod(M.steel, [Math.cos(a) * 1.6, 7.2, Math.sin(a) * 1.6], [Math.cos(a) * 2.3, 6.9, Math.sin(a) * 2.3], 0.028, 5);
      });
      [8.4, 20.6, 25.4].forEach(y => {
        CP.torus(M.steel, 0.26, 0.05, { x: -2.2, y: y, z: 0.9, ry: PI / 2 - 1.1 });
        boltRing(CP, -2.2, y, 0.9, 0.3, 8, 0.012);
      });
      // ---- thrust structure (whole frame, 2.6 – 4.4)
      CP.cyl(M.steelD, 2.4, 2.4, 1.5, SEGA, { y: 3.55, openEnded: true });
      CP.cyl(M.steel, 2.42, 2.42, 0.12, SEGA, { y: 4.32 });
      CP.cyl(M.steel, 2.42, 2.42, 0.1, SEGA, { y: 2.94 });
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * TAU, c = Math.cos(a), s = Math.sin(a);
        CP.box(M.steelD, 2.02, 0.2, 0.16, { x: c * 1.25, y: 3.5, z: s * 1.25, ry: -a });
        CP.rod(M.steel, [c * 2.3, 4.2, s * 2.3], [c * 0.95, 3.15, s * 0.95], 0.045, 6);
      }
      CP.cyl(M.steelD, 0.62, 0.62, 0.5, SEGB, { y: 3.3 });
      boltRing(CP, 0, 3.56, 0, 0.55, 12, 0.015);
      // engine mount rings
      [-1, 1].forEach(sx => {
        CP.torus(M.steelD, 0.4, 0.06, { x: sx * 1.25, y: 2.98, rx: PI / 2 });
        for (let k = 0; k < 4; k++) {
          const a = k / 4 * TAU + PI / 4;
          CP.rod(M.steelD, [sx * 1.25 + Math.cos(a) * 0.4, 2.98, Math.sin(a) * 0.4], [sx * 1.25 + Math.cos(a) * 0.72, 3.9, Math.sin(a) * 0.72], 0.042, 6);
        }
      });
      // base heat-shield ring under the tank
      CP.add(M.dark, (function () {
        const sh = new T.Shape(); sh.absarc(0, 0, 2.36, 0, TAU, false);
        [[-1.25, 0], [1.25, 0]].forEach(h => { const p = new T.Path(); p.absarc(h[0], h[1], 0.78, 0, TAU, true); sh.holes.push(p); });
        const g = new T.ExtrudeGeometry(sh, { depth: 0.07, bevelEnabled: false, curveSegments: 32 });
        g.rotateX(-PI / 2); g.translate(0, 2.7, 0);
        return g;
      })());
      // ---- engines
      engineYF77(CP, -1.25);
      engineYF77(CP, 1.25);
      // ---- interstage / forward skirt 29.4 – 33.16: truss + deck + avionics
      CP.cyl(M.steelD, 2.4, 2.4, 0.16, SEGA, { y: 29.62, openEnded: true });
      CP.cyl(M.steelD, 2.4, 2.4, 0.16, SEGA, { y: 32.9, openEnded: true });
      CP.cyl(M.steelD, 2.4, 2.4, 0.12, SEGA, { y: 31.3, openEnded: true });
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * TAU, c = Math.cos(a), s = Math.sin(a);
        CP.box(M.steel, 0.1, 3.42, 0.07, { x: c * 2.36, y: 31.26, z: s * 2.36, ry: -a });
        if (k % 2 === 0) {
          CP.rod(M.steel, [c * 2.34, 30.2, s * 2.34], [Math.cos(a + 0.2) * 2.34, 32.3, Math.sin(a + 0.2) * 2.34], 0.026, 5);
        }
      }
      // separation deck at the stage-1/2 interface with two engine holes
      CP.add(M.steel, (function () {
        const sh = new T.Shape(); sh.absarc(0, 0, 2.38, 0, TAU, false);
        [[-0.85, 0], [0.85, 0]].forEach(h => { const p = new T.Path(); p.absarc(h[0], h[1], 0.44, 0, TAU, true); sh.holes.push(p); });
        const g = new T.ExtrudeGeometry(sh, { depth: 0.08, bevelEnabled: false, curveSegments: 32 });
        g.rotateX(-PI / 2); g.translate(0, 33.06, 0);
        return g;
      })());
      // separation pushers
      [0.6, 2.2, 3.8, 5.4].forEach(a => {
        CP.cyl(M.steel, 0.09, 0.09, 0.34, SEGC, { x: Math.cos(a) * 2.16, y: 33.0, z: Math.sin(a) * 2.16 });
        CP.cyl(M.copper, 0.06, 0.06, 0.4, SEGC, { x: Math.cos(a) * 2.16, y: 32.8, z: Math.sin(a) * 2.16 });
      });
      // avionics + wiring in the interstage
      [2.05, 2.5, 4.2].forEach((a, i) => {
        avionicsBox(CP, Math.cos(a) * 2.16, 30.3 + i * 0.2, Math.sin(a) * 2.16, 0.52, 0.36, 0.26, -a, true);
      });
      CP.pipe(M.cable, [[Math.cos(2.05) * 2.16, 30.1, Math.sin(2.05) * 2.16], [2.05, 30.3, 0.9], [-2.12, 31.2, 0.3]], 0.03, { tSeg: 10, rSeg: 5 });
      raceway(CP, 2.37, 29.6, 33.0, 3.6);
      // ladder
      for (let k = 0; k < 2; k++) CP.cyl(M.steel, 0.02, 0.02, 3.2, 5, { x: -1.75 + k * 0.34, y: 31.2, z: -1.62 });
      for (let y = 29.9; y < 32.9; y += 0.36) CP.cyl(M.steel, 0.016, 0.016, 0.34, 5, { x: -1.58, y: y, z: -1.62, rz: PI / 2 });
      // LOX dome top reinforcement + gold blanket patches on the forward skirt wall
      CP.half(M.gold, [[2.3, 30.0], [2.34, 31.4], [2.36, 32.8]], SEGB);
      CP.half(M.insul, [[2.32, 29.8], [2.35, 30.9]], SEGB);
      CP.lathe(M.steel, [[0.03, 29.35], [0.4, 29.22], [0.8, 28.95]], SEGB);
    })();
    CP.finish(coreG, 'core');

    /* ======================================================================
     * 5. STAGE 2 — engines complete (YF-75D), tanks 37.7 … 43.4
     * ====================================================================*/
    const s2G = U.group('int-stage2');
    group.add(s2G);
    const S2 = new Parts();
    (function buildStage2() {
      const R = 2.44;
      // ---- YF-75D engines (bells reach down into the interstage)
      engineYF75D(S2, -0.85, 0);
      engineYF75D(S2, 0.85, 0);
      // shift engines down to their exit plane (local y = 31.85)
      S2.items.forEach(it => it[1].translate(0, 31.85, 0));
      // ---- engine bay structure 33.16 – 35.6
      S2.cyl(M.steelD, 2.4, 2.4, 0.14, SEGA, { y: 33.3, openEnded: true });
      S2.cyl(M.steelD, 2.4, 2.4, 0.14, SEGA, { y: 35.45, openEnded: true });
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * TAU, c = Math.cos(a), s = Math.sin(a);
        S2.box(M.steel, 0.09, 2.2, 0.07, { x: c * 2.36, y: 34.4, z: s * 2.36, ry: -a });
      }
      // thrust deck with two nozzle cut-outs
      S2.add(M.steel, (function () {
        const sh = new T.Shape(); sh.absarc(0, 0, 2.38, 0, TAU, false);
        [[-0.85, 0], [0.85, 0]].forEach(h => { const p = new T.Path(); p.absarc(h[0], h[1], 0.4, 0, TAU, true); sh.holes.push(p); });
        const g = new T.ExtrudeGeometry(sh, { depth: 0.1, bevelEnabled: false, curveSegments: 32 });
        g.rotateX(-PI / 2); g.translate(0, 35.55, 0);
        return g;
      })());
      // ---- LH2 tank (aft) 37.7 → 39.0 (lower common skin 38.55)
      const lh2 = tankProf(R, 36.95, 37.7, 39.0, 38.55, 8);
      tankWall(S2, lh2, {
        cy: 38.2, goldSkin: true, frames: { n: 2, y0: 37.8, y1: 38.9, h: 0.09 },
        stringers: { n: 24, y0: 37.7, y1: 38.9 }
      });
      // ---- LOX tank (fwd) 39.8 → 43.4
      const lox = tankProf(R, 39.35, 39.8, 42.75, 43.4, 8);
      tankWall(S2, lox, {
        cy: 41.4, frames: { n: 4, y0: 40.0, y1: 42.7, h: 0.09 },
        stringers: { n: 24, y0: 39.8, y1: 42.7 }
      });
      baffleHalf(S2, 2.39, 38.05, 0.45, 0.14);
      [[40.6], [41.7], [42.5]].forEach(p => baffleHalf(S2, 2.39, p[0], 0.5, 0.16));
      // common bulkhead webbing
      for (let i = 0; i < 12; i++) {
        const a = HALF_A(i, 12), c = Math.cos(a), s = Math.sin(a);
        S2.box(M.insul, 0.09, 0.72, 0.15, { x: c * 2.24, y: 39.4, z: s * 2.24, ry: -a });
      }
      S2.half(M.insul, [[2.36, 39.05], [2.36, 39.75]], SEGB);
      // ---- LOX transfer duct through the LH2 tank
      [-1, 1].forEach(sx => {
        const x = sx * 0.6;
        S2.pipe(M.gold, [[x, 39.55, 0.04], [x, 38.6, -0.04], [x, 37.2, -0.06], [x * 1.1, 36.0, 0.02], [sx * 0.85, 35.5, 0.14]], 0.19, { tSeg: 18, rSeg: 9 });
        for (let k = 0; k < 3; k++) S2.torus(M.gold, 0.206, 0.025, { x: x, y: 39.0 - k * 0.8, z: -0.03, rx: PI / 2 });
      });
      // ---- LH2 feed ducts
      [-1, 1].forEach(sx => {
        S2.pipe(M.foil, [[sx * 0.95, 38.6, 0.1], [sx * 0.92, 37.9, 0.12], [sx * 0.85, 36.2, 0.2]], 0.2, { tSeg: 8, rSeg: 8 });
      });
      // ---- pressurisation lines, bottles, raceways
      wallPipe(S2, 2.3, 2.3, 39.9, 43.2, 0.035, M.foil);
      wallPipe(S2, 2.3, 4.5, 36.0, 43.2, 0.03, M.copper);
      [2.4, 3.0, 3.6, 4.2, 4.8].forEach(a => {
        S2.box(M.white, 0.34, 0.5, 0.22, { x: Math.cos(a) * 1.85, y: 43.6, z: Math.sin(a) * 1.85, ry: -a });
      });
      raceway(S2, 2.37, 35.8, 43.2, 2.15);
      raceway(S2, 2.37, 40.0, 43.2, 4.1);
      // ---- RCS thruster modules on the forward skirt (recessed inside the skin)
      [0.6, 2.2, 3.8, 5.4].forEach(a => {
        const c = Math.cos(a), s = Math.sin(a), x = c * 2.34, z = s * 2.34;
        S2.box(M.steelD, 0.34, 0.26, 0.22, { x: x, y: 44.16, z: z, ry: -a });
        S2.box(M.white, 0.3, 0.2, 0.04, { x: c * 2.42, y: 44.16, z: s * 2.42, ry: -a });
        for (let t = -1; t <= 1; t += 2) {
          S2.cyl(M.steelD, 0.035, 0.06, 0.12, SEGC, { x: c * 2.4, y: 44.16, z: s * 2.4 });
          S2.cyl(M.steelD, 0.06, 0.035, 0.1, SEGC, { x: c * 2.38 + Math.cos(a + PI / 2) * 0.16 * t, y: 44.2, z: s * 2.38 + Math.sin(a + PI / 2) * 0.16 * t, ry: -a, rz: PI / 2 });
        }
        S2.pipe(M.copper, [[c * 2.28, 43.9, s * 2.28], [c * 2.31, 44.05, s * 2.31]], 0.02, { tSeg: 3, rSeg: 5 });
      });
      // ---- top separation pushers + avionics
      [0.4, 1.97, 3.54, 5.11].forEach(a => {
        S2.cyl(M.steel, 0.08, 0.08, 0.26, SEGC, { x: Math.cos(a) * 2.2, y: 44.55, z: Math.sin(a) * 2.2 });
      });
      [1.3, 4.6].forEach((a, i) => avionicsBox(S2, Math.cos(a) * 2.16, 43.8 + i * 0.14, Math.sin(a) * 2.16, 0.5, 0.3, 0.26, -a, true));
      S2.half(M.gold, [[2.31, 43.42], [2.34, 44.6]], SEGB);
    })();
    S2.finish(s2G, 'stage2');

    /* ======================================================================
     * 6. YZ-2 UPPER STAGE 44.7 – 49.8 (payload owns the exterior + bells)
     * ====================================================================*/
    const yzG = U.group('int-yz2');
    group.add(yzG);
    const YZ = new Parts();
    (function buildYZ2() {
      const R = 1.78;
      engineYF50D(YZ, -0.5);
      engineYF50D(YZ, 0.5);
      // base ring / separation hardware
      YZ.cyl(M.steelD, 1.74, 1.74, 0.14, SEGB, { y: 44.82, openEnded: true });
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * TAU + PI / 4;
        YZ.box(M.steel, 0.14, 0.2, 0.12, { x: Math.cos(a) * 1.7, y: 44.8, z: Math.sin(a) * 1.7, ry: -a });
      }
      // ---- tanks (half section)
      const low = tankProf(R, 45.62, 46.15, 47.0, 46.68, 7);
      tankWall(YZ, low, { cy: 46.4, frames: { n: 2, y0: 46.2, y1: 46.95, h: 0.07 }, stringers: { n: 18, y0: 46.2, y1: 46.95 } });
      const up = tankProf(R, 47.16, 47.5, 48.75, 49.35, 7);
      tankWall(YZ, up, { cy: 48.2, frames: { n: 3, y0: 47.6, y1: 48.7, h: 0.07 }, stringers: { n: 18, y0: 47.5, y1: 48.7 } });
      for (let i = 0; i < 10; i++) {
        const a = HALF_A(i, 10), c = Math.cos(a), s = Math.sin(a);
        YZ.box(M.insul, 0.07, 0.55, 0.12, { x: c * 1.62, y: 47.08, z: s * 1.62, ry: -a });
      }
      YZ.half(M.insul, [[1.7, 46.75], [1.7, 47.45]], SEGB);
      // ---- feed lines + valves
      [-1, 1].forEach(sx => {
        YZ.pipe(M.steel, [[sx * 0.5, 47.15, 0.05], [sx * 0.5, 46.3, 0.03], [sx * 0.5, 45.6, 0.02], [sx * 0.5, 45.05, 0.05]], 0.075, { tSeg: 10, rSeg: 6 });
        YZ.pipe(M.copper, [[sx * 0.75, 46.9, -0.1], [sx * 0.7, 46.2, -0.1], [sx * 0.62, 45.6, -0.05], [sx * 0.52, 45.15, 0]], 0.05, { tSeg: 8, rSeg: 5 });
        valve(YZ, sx * 0.5, 46.55, 0.04, 0.6, 0);
      });
      // ---- small helium bottles + pressurisation
      [2.2, 3.6, 4.8].forEach(a => {
        bottle(YZ, Math.cos(a) * 1.35, 48.9, Math.sin(a) * 1.35, 0.12, 0.3);
      });
      wallPipe(YZ, 1.68, 2.4, 45.4, 48.6, 0.026, M.foil);
      raceway(YZ, 1.72, 45.4, 48.6, 3.7);
      // ---- avionics ring
      [1.9, 3.2, 4.5].forEach((a, i) => {
        avionicsBox(YZ, Math.cos(a) * 1.45, 49.35 + (i % 2) * 0.16, Math.sin(a) * 1.45, 0.42, 0.26, 0.22, -a, true);
      });
      // payload separation springs
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * TAU + PI / 4;
        YZ.cyl(M.steel, 0.05, 0.05, 0.2, SEGC, { x: Math.cos(a) * 1.52, y: 49.62, z: Math.sin(a) * 1.52 });
        YZ.cyl(M.copper, 0.035, 0.035, 0.12, SEGC, { x: Math.cos(a) * 1.52, y: 49.42, z: Math.sin(a) * 1.52 });
      }
      YZ.cyl(M.steelD, 1.7, 1.7, 0.1, SEGB, { y: 49.74, openEnded: true });
    })();
    YZ.finish(yzG, 'yz2');

    /* ======================================================================
     * 7. BOOSTERS — 4 × (tanks, YF-100 machinery, struts), full 360 internals
     * ====================================================================*/
    const boosterGs = [];
    function buildBooster(idx) {
      const bp = SPEC.rocket.boosterPos(idx);
      const g = U.group('int-booster-' + idx);
      g.position.set(bp.x, 0, bp.z);
      g.rotation.y = PI - bp.angle;
      group.add(g);
      boosterGs.push({ group: g, x: bp.x, z: bp.z, ang: bp.angle, basePos: new T.Vector3(bp.x, 0, bp.z) });

      const B = new Parts();
      const r = 1.6;
      // NOTE: the rocket's ghosted booster skin is the tank barrel in cut mode, so
      // the interior only contributes structure (no opaque barrel wall) — the
      // booster then reads as an X-ray with rings, ducts and engines inside.
      const prof = tankProf(r, 4.2, 5.75, 17.2, 16.75, 8);
      const lo = tankProf(r, 17.45, 17.9, 26.4, 28.0, 8);
      // dome rims + common bulkhead frame (sparse, reads through the ghost shell)
      function rimRing(y, rad) { B.cyl(M.frame, rad, rad, 0.1, SEGB, { y: y, openEnded: true }); }
      rimRing(5.75, 1.52); rimRing(16.75, 1.5); rimRing(17.45, 1.5); rimRing(26.4, 1.48); rimRing(28.0, 1.38);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        B.box(M.steel, 1.1, 0.07, 0.12, { x: Math.cos(a) * 0.75, y: 17.1, z: Math.sin(a) * 0.75, ry: -a });
      }
      B.cyl(M.steelD, 0.2, 0.2, 0.16, SEGC, { y: 17.1 });
      // ---- frames / stringers / baffles
      for (let i = 0; i < 9; i++) {
        const y = 6.2 + (16.4 - 6.2) * (i + 0.5) / 9;
        B.cyl(M.frame, 1.545, 1.545, 0.08, SEGB, { y: y, openEnded: true });
      }
      for (let i = 0; i < 8; i++) {
        const y = 18.1 + (26.2 - 18.1) * (i + 0.5) / 8;
        B.cyl(M.frame, 1.545, 1.545, 0.08, SEGB, { y: y, openEnded: true });
      }
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * TAU, c = Math.cos(a), s = Math.sin(a);
        B.box(M.frame, 0.04, 10.4, 0.05, { x: c * 1.565, y: 11.2, z: s * 1.565, ry: -a });
        B.box(M.frame, 0.04, 8.1, 0.05, { x: c * 1.565, y: 22.1, z: s * 1.565, ry: -a });
      }
      [[8.2], [12.4], [15.4]].forEach(p => {
        B.add(M.steel, new T.RingGeometry(1.12, 1.56, LQ ? 20 : 30, 1), { rx: -PI / 2, y: p[0] });
        B.cyl(M.frame, 1.12, 1.12, 0.13, LQ ? 16 : 24, { y: p[0] + 0.065, openEnded: true });
      });
      [[20.3], [23.2], [25.2]].forEach(p => {
        B.add(M.steel, new T.RingGeometry(1.1, 1.56, LQ ? 20 : 30, 1), { rx: -PI / 2, y: p[0] });
        B.cyl(M.frame, 1.1, 1.1, 0.13, LQ ? 16 : 24, { y: p[0] + 0.065, openEnded: true });
      });
      // ---- thrust structure 1.6 – 3.0
      B.cyl(M.steelD, 1.56, 1.56, 0.12, SEGB, { y: 1.72, openEnded: true });
      B.cyl(M.steelD, 1.56, 1.56, 0.12, SEGB, { y: 2.9, openEnded: true });
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * TAU;
        B.box(M.steel, 1.3, 0.14, 0.12, { x: Math.cos(a) * 0.8, y: 2.4, z: Math.sin(a) * 0.8, ry: -a });
      }
      B.add(M.dark, (function () {
        const sh = new T.Shape(); sh.absarc(0, 0, 1.5, 0, TAU, false);
        [[0, -0.74], [0, 0.74]].forEach(hh => { const p = new T.Path(); p.absarc(hh[0], hh[1], 0.52, 0, TAU, true); sh.holes.push(p); });
        const g2 = new T.ExtrudeGeometry(sh, { depth: 0.07, bevelEnabled: false, curveSegments: 24 });
        g2.rotateX(-PI / 2); g2.translate(0, 2.24, 0);
        return g2;
      })());
      // ---- 2 × YF-100 (rocket owns the exterior bells)
      engineYF100(B, 0.74, false);
      engineYF100(B, -0.74, true);
      // ---- feed ducts (LOX from the upper tank down through the kerosene tank)
      [0.86, -0.86].forEach(zc => {
        B.pipe(M.gold, [[0.14, 17.55, zc * 0.9], [0.16, 15.0, zc * 0.85], [0.18, 11.0, zc * 0.8],
        [0.2, 7.4, zc * 0.8], [0.16, 4.6, zc * 0.94], [0.05, 3.3, zc]], 0.135, { tSeg: 20, rSeg: 8 });
        for (let k = 0; k < 4; k++) B.torus(M.gold, 0.148, 0.02, { x: 0.17, y: 14.2 - k * 2.2, z: zc * 0.82, rx: PI / 2 });
      });
      [-0.6, 0.6].forEach(zc => {
        B.pipe(M.foil, [[-0.28, 4.6, zc], [-0.26, 3.8, zc], [-0.12, 3.1, zc * 0.9], [0.0, 2.7, zc]], 0.11, { tSeg: 7, rSeg: 7 });
      });
      // ---- pressurisation, raceways, avionics
      for (let i = 0; i < 2; i++) {
        const a = 1.4 + i * 2.6, c = Math.cos(a), s = Math.sin(a);
        B.pipe(M.foil, [[c * 1.5, 4.6, s * 1.5], [c * 1.52, 12, s * 1.52], [c * 1.5, 26.2, s * 1.5]], 0.028, { tSeg: 8, rSeg: 5 });
        for (let y = 5.4; y < 26; y += 1.8) B.box(M.steel, 0.07, 0.04, 0.07, { x: c * 1.55, y: y, z: s * 1.55, ry: -a });
      }
      raceway(B, 1.57, 3.4, 28.8, 2.2);
      avionicsBox(B, -1.36, 27.6, 0.7, 0.44, 0.3, 0.24, -2.2, true);
      // ---- forward skirt 28.0 – 29.2 + separation struts toward the core (+x local)
      B.cyl(M.steelD, 1.56, 1.56, 0.12, SEGB, { y: 28.35, openEnded: true });
      B.cyl(M.steelD, 1.56, 1.56, 0.1, SEGB, { y: 29.05, openEnded: true });
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * TAU;
        B.box(M.steel, 0.08, 1.1, 0.06, { x: Math.cos(a) * 1.53, y: 28.7, z: Math.sin(a) * 1.53, ry: -a });
      }
      [24.9, 5.4].forEach(y => {
        [-0.55, 0.55].forEach(z => {
          B.box(M.steelD, 0.3, 0.2, 0.18, { x: 1.52, y: y, z: z });
          B.rod(M.steel, [1.6, y, z], [1.78, y, z], 0.045, 6);
          B.box(M.copper, 0.12, 0.14, 0.12, { x: 1.7, y: y + 0.14, z: z });
        });
      });
      // aft dome MLI read: a spoked gold ring instead of a solid dome (keeps the
      // ghosted booster see-through while still reading as an insulated bulkhead)
      B.cyl(M.gold, 1.42, 1.42, 0.18, SEGB, { y: 5.7, openEnded: true });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        B.box(M.gold, 0.9, 0.05, 0.1, { x: Math.cos(a) * 0.8, y: 5.62, z: Math.sin(a) * 0.8, ry: -a, rz: 0 });
      }
      B.finish(g, 'booster' + idx);
    }
    for (let i = 0; i < 4; i++) buildBooster(i);

    /* ======================================================================
     * 8. CUT FACES — warm-red section ribbons at x = 0 + cut pipe discs
     * ====================================================================*/
    const capGeos = [];
    for (const sp of sectionRibbons) {
      const out = offsetProfile(sp.prof, sp.outT || 0.02, sp.cy);
      const inn = offsetProfile(sp.inn, -0.012, sp.cy);
      capGeos.push(ribbonGeo(out, inn));
    }
    for (const gx of capsExtra) capGeos.push(gx);
    const capMesh = U.mesh(U.mergeGeometries(capGeos), M.cap, { name: 'interior-section-caps' });
    capMesh.castShadow = false; capMesh.receiveShadow = false;
    capMesh.frustumCulled = false;
    capMesh.renderOrder = 3;
    group.add(capMesh);
    capMesh.visible = false;

    /* ======================================================================
     * 9. lighting — at most 2 small warm point lights inside the core
     * ====================================================================*/
    const l1 = new T.PointLight(0xffd9ad, 14, 15, 2);
    l1.position.set(0.5, 12.5, 0.9); group.add(l1);
    const l2 = new T.PointLight(0xffc890, 9, 12, 2);
    l2.position.set(-0.3, 3.4, -0.2); group.add(l2);

    /* ======================================================================
     * 10. state: cut caps + explode offsets
     * ====================================================================*/
    let capShown = false, grpVisible = true;
    function planeC() {
      const p = APP.cutPlane;
      return (p && isFinite(p.constant)) ? p.constant : 6.6;
    }
    function setCut(t) {
      const c = planeC();
      const show = c < 2.5 && t > 0.02;
      if (show !== capShown) { capShown = show; capMesh.visible = show; }
    }
    const E2 = 4.0, EBO = 2.0, EBU = 0.8;
    function setExplode(t) {
      const e = U.smoothstep(0, 1, U.clamp(t, 0, 1));
      s2G.position.y = E2 * e;
      yzG.position.y = E2 * e;
      for (const b of boosterGs) {
        b.group.position.set(b.basePos.x + Math.cos(b.ang) * EBO * e, EBU * e, b.basePos.z + Math.sin(b.ang) * EBO * e);
      }
    }
    // keep the caps locked to the boot-animated plane + hide the module in overall
    let lastMode = null, lastC = null;
    if (APP.updaters) {
      APP.updaters.push(function () {
        const st = APP.state || {};
        const c = planeC();
        if (c !== lastC) { lastC = c; setCut(st.cut === undefined ? 1 : st.cut); }
        const vis = !!st.mode && st.mode !== 'overall';
        if (vis !== grpVisible || st.mode !== lastMode) {
          grpVisible = vis; lastMode = st.mode;
          group.visible = vis;
          if (!vis) { capMesh.visible = false; capShown = false; }
        }
      });
    }
    if (APP.cutables) APP.cutables.push(setCut);
    if (APP.explodables) APP.explodables.push(setExplode);

    /* ======================================================================
     * 11. label-only part metadata (rocket owns stage1 / stage2)
     * ====================================================================*/
    const reg = (id, meta) => { if (APP.registerPart) APP.registerPart(id, meta); };
    const worldAnchor = (grp, x, y, z) => () => grp.localToWorld(new T.Vector3(x, y, z));
    reg('tank_lh2', {
      zh: '液氢贮箱', en: 'LH2 TANK', section: '推进剂系统', modes: ['cut'], index: false,
      anchor: () => new T.Vector3(-0.9, BASE + 11.2, -1.5),
      specs: [['位置', '芯一级后段'], ['推进剂', '液氢 (−253 °C)'], ['结构', '铝合金内壁 + 环向框 + 纵向桁条']],
      desc: '芯一级液氢贮箱包裹在低温绝热层内，内壁由环向框和纵向桁条加强；液氧输送管穿过本箱体直达发动机。'
    });
    reg('tank_lox', {
      zh: '液氧贮箱', en: 'LOX TANK', section: '推进剂系统', modes: ['cut'], index: false,
      anchor: () => new T.Vector3(-0.9, BASE + 23.2, -1.5),
      specs: [['位置', '芯一级前段'], ['推进剂', '液氧 (−183 °C)'], ['结构', '共底式双壁箱体']],
      desc: '液氧贮箱位于芯一级前段，与液氢贮箱以共底结构分隔；箱内布置防晃隔板与增压、排气管路。'
    });
    reg('yf77', {
      zh: 'YF-77 涡轮泵组', en: 'YF-77 TURBOPUMPS', section: '动力系统', modes: ['cut', 'explode'], index: false,
      anchor: () => new T.Vector3(-1.25 + 0.62, BASE + 3.05, 0.5),
      specs: [['循环方式', '燃气发生器循环'], ['泵组', '液氢泵 / 液氧泵'], ['单台推力', '约 518 kN（海平面）']],
      desc: 'YF-77 采用燃气发生器循环：液氢泵与液氧泵由燃气涡轮驱动，高压推进剂经主管路进入推力室，摆动作动器实现推力矢量控制。'
    });
    reg('yf75d', {
      zh: 'YF-75D 发动机', en: 'YF-75D ENGINES', section: '动力系统', modes: ['cut'], index: false,
      anchor: worldAnchor(s2G, -0.85, 33.2, 0.7),
      specs: [['数量', '2 台'], ['真空推力', '2 × 88.36 kN'], ['推进剂', '液氢 / 液氧']],
      desc: '芯二级两台 YF-75D 氢氧发动机可二次启动，喷管伸入级间段；本剖视展示其头部泵组、阀门与摆动作动器。'
    });
    reg('yf100', {
      zh: 'YF-100 涡轮泵组', en: 'YF-100 TURBOPUMPS', section: '动力系统', modes: ['cut', 'explode'], index: false,
      anchor: () => boosterGs[0].group.localToWorld(new T.Vector3(0.3, 2.9, 0.74)),
      specs: [['循环方式', '高压补燃循环'], ['泵组', '液氧泵 / 煤油泵'], ['单台推力', '约 1,200 kN（海平面）']],
      desc: 'YF-100 采用液氧煤油高压补燃循环，单台海平面推力约 120 吨；每台助推器并联两台，为起飞提供主要推力。'
    });

    /* ======================================================================
     * 12. finish
     * ====================================================================*/
    setExplode(0);
    setCut(0);
    if (FLAGS.debug) console.log('[interior] tris=' + Math.round(ST.tris) + ' draws=' + ST.draws);
    const api = {
      group: group,
      core: coreG, stage2: s2G, yz2: yzG, boosters: boosterGs.map(b => b.group),
      stats: ST,
      setCut: setCut,
      setExplode: setExplode
    };
    APP.modules.interior = api;
    return api;
  };
})();
