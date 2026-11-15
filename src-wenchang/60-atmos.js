/* ============================================================================
 * 60-atmos.js — lighting rig, cryogenic venting, night floodlights, dust.
 * Owner: Lead.
 * ==========================================================================*/
(function () {
  'use strict';
  window.buildAtmos = function (APP) {
    const T = window.THREE, U = window.U, SPEC = window.SPEC;
    const FLAGS = window.FLAGS;
    const g = U.group('atmos'); APP.scene.add(g);
    const sky = APP.modules.sky;
    const sunDir = sky && sky.sun ? sky.sun.clone() : new T.Vector3(.56, .62, .52).normalize();
    const rocketX = 0, rocketZ = 0;

    const rig = {
      hemi: null, sun: null, fill: null, rim: null, cutFill: null, spots: [], glowSprites: [],
      pads: [], vents: [], dayMix: 1, targetDayMix: 1
    };

    APP.scene.fog = APP.scene.fog || new T.FogExp2(0xc7d3d2, .00052);
    APP.renderer.toneMappingExposure = .94;
    const SUN_DAY = new T.Color(1.0, .84, .64);
    const SUN_SET = new T.Color(1.0, .42, .16);
    const HEMI_DAY = new T.Color(0xcfe2ea);
    const HEMI_NIGHT = new T.Color(0x1d3346);
    const HEMI_GROUND_DAY = new T.Color(0x5c5747);
    const HEMI_GROUND_NIGHT = new T.Color(0x0c1512);

    /* --- daylight -------------------------------------------------------*/
    const hemi = new T.HemisphereLight(0xcfe2ea, 0x5c5747, .28);
    g.add(hemi); rig.hemi = hemi;

    const sun = new T.DirectionalLight(0xffd0a0, 5.6);
    sun.position.copy(sunDir).multiplyScalar(380).add(new T.Vector3(0, 70, 0));
    sun.target.position.set(0, 34, 0);
    sun.castShadow = !FLAGS.lq && !FLAGS.noshadow;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 20;
    sun.shadow.camera.far = 780;
    sun.shadow.camera.left = -150;
    sun.shadow.camera.right = 150;
    sun.shadow.camera.top = 180;
    sun.shadow.camera.bottom = -60;
    sun.shadow.bias = -0.00035;
    sun.shadow.normalBias = 0.9;
    g.add(sun); g.add(sun.target); rig.sun = sun;

    // cool moon fill — just enough to model the vehicle at night
    const moonFill = new T.DirectionalLight(0x9bbff2, 0);
    moonFill.position.set(90, 180, -260);
    g.add(moonFill);
    rig.moonFill = moonFill;

    // soft cooling fill from the sea side
    const fill = new T.DirectionalLight(0xa9cfdf, .18);
    fill.position.set(180, 55, -100);
    g.add(fill); rig.fill = fill;

    // warm rim from the tower / rising sun
    const rim = new T.DirectionalLight(0xffc78e, .72);
    rim.position.set(180, 90, -100);
    g.add(rim); rig.rim = rim;

    // cutaway fill: cool-neutral, only meaningful when the shell opens
    const cutFill = new T.SpotLight(0xeaf4ff, 0, 130, .62, .55, 1.0);
    cutFill.position.set(34, 62, 46);
    cutFill.target.position.set(0, 36, 0);
    cutFill.castShadow = false;
    g.add(cutFill); g.add(cutFill.target); rig.cutFill = cutFill;

    /* --- night floodlight rig ------------------------------------------*/
    const mastPositions = SPEC.masts.map(m => new T.Vector3(m[0], 76, m[1]));
    mastPositions.forEach((p, i) => {
      const s = new T.SpotLight(0xffe8c0, 0, 260, .34, .6, 1.2);
      s.position.copy(p);
      s.target.position.set(0, 34 + (i % 2) * 20, 0);
      s.castShadow = false;
      g.add(s); g.add(s.target);
      rig.spots.push(s);
      const glow = U.sprite(U.texRadial(64, [[0, 'rgba(255,244,216,1)'], [.3, 'rgba(255,224,170,.6)'], [1, 'rgba(255,210,140,0)']]), 0xffe6b8, 5.0, 0);
      glow.position.copy(p);
      g.add(glow); rig.glowSprites.push(glow);
    });
    // low pad floods aimed up at the vehicle / tower base (night only)
    const padFloods = [];
    [
      { p: [-30, 19, 34], aim: [0, 30, 0], color: 0xffd2a0, inten: 4800 },
      { p: [32, 19, 30], aim: [0, 30, 0], color: 0xffe0bc, inten: 4200 }
    ].forEach(function (d) {
      const sp = new T.SpotLight(d.color, 0, 160, .42, .7, 1.25);
      sp.position.set(d.p[0], d.p[1], d.p[2]);
      sp.target.position.set(d.aim[0], d.aim[1], d.aim[2]);
      sp.castShadow = false;
      sp.userData.baseIntensity = d.inten;
      g.add(sp); g.add(sp.target);
      padFloods.push(sp);
    });

    // service tower work lights at two levels
    const tower = SPEC.tower;
    const tw = [
      new T.PointLight(0xffd7a0, 0, 90, 1.4),
      new T.PointLight(0xffd7a0, 0, 90, 1.4)
    ];
    tw[0].position.set(tower.x + 8, 34, tower.z + 8);
    tw[1].position.set(tower.x + 8, 58, tower.z - 7);
    tw.forEach(l => { g.add(l); rig.pads.push(l); });

    /* --- cryogenic venting ---------------------------------------------*/
    const ventTex = U.texRadial(128, [
      [0, 'rgba(255,255,255,.85)'], [.35, 'rgba(245,250,255,.38)'], [.72, 'rgba(230,240,248,.10)'], [1, 'rgba(230,240,248,0)']
    ]);
    const ventAnchors = [
      { x: 1.9, y: SPEC.rocket.baseY + 2.4, z: 1.6, n: 8, s: 6.0 },
      { x: -2.1, y: SPEC.rocket.baseY + 4.6, z: -0.8, n: 6, s: 4.4 },
      { x: 3.2, y: SPEC.rocket.baseY + 8.2, z: 2.2, n: 5, s: 3.4 },
      { x: -3.3, y: SPEC.rocket.baseY + 1.7, z: 2.5, n: 5, s: 4.0 }
    ];
    rig.vents = [];
    ventAnchors.forEach((a, ai) => {
      for (let i = 0; i < a.n; i++) {
        const s = U.sprite(ventTex, 0xf6fbff, a.s * (0.5 + Math.random() * .9), 0);
        s.material.blending = T.NormalBlending;
        s.position.set(a.x + (Math.random() - .5) * 1.2, a.y + Math.random() * 1.2, a.z + (Math.random() - .5) * 1.2);
        g.add(s);
        rig.vents.push({ sprite: s, base: s.position.clone(), phase: Math.random() * TAU, speed: .2 + Math.random() * .28, size: s.scale.x, life: Math.random() });
      }
    });

    /* --- floating dust / pollen ----------------------------------------*/
    const dustGeo = new T.BufferGeometry();
    const dustCount = 200;
    const pos = new Float32Array(dustCount * 3);
    const seed = U.rng(88);
    for (let i = 0; i < dustCount; i++) {
      pos[i * 3] = seed.range(-70, 70);
      pos[i * 3 + 1] = seed.range(4, 55);
      pos[i * 3 + 2] = seed.range(-55, 90);
    }
    dustGeo.setAttribute('position', new T.BufferAttribute(pos, 3));
    const dustTex = U.texRadial(32, [[0, 'rgba(255,255,255,.9)'], [.35, 'rgba(255,255,255,.35)'], [1, 'rgba(255,255,255,0)']]);
    const dustMat = new T.PointsMaterial({
      color: 0xfff2dc, size: .34, map: dustTex, transparent: true, opacity: .22,
      alphaTest: .02, depthWrite: false, blending: T.AdditiveBlending, sizeAttenuation: true
    });
    const dust = new T.Points(dustGeo, dustMat); g.add(dust);
    rig.dust = dust;

    /* --- light glows at the pad (warm lamps reflect on deck) ------------*/
    const deckGlowTex = U.texRadial(64, [[0, 'rgba(255,232,190,.7)'], [.5, 'rgba(255,220,170,.2)'], [1, 'rgba(255,210,150,0)']]);
    for (let i = 0; i < 6; i++) {
      const s = U.sprite(deckGlowTex, 0xffdcaa, 6, 0);
      const ang = i / 6 * TAU;
      s.position.set(Math.cos(ang) * 28, SPEC.pad.deckY + .7, Math.sin(ang) * 26);
      g.add(s);
      rig.glowSprites.push(s);
    }

    /* --- environment / IBL level caching ---------------------------------*/
    // At night the day PMREM environment would keep the whole site lit; scale it
    // back on every standard material (cached once, after all builders ran).
    const envMats = [];
    (function cacheEnv() {
      const seen = new Set();
      APP.scene.traverse(function (o) {
        if (!o.isMesh || !o.material) return;
        (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (m) {
          if (!m || seen.has(m) || !m.isMeshStandardMaterial) return;
          seen.add(m);
          if (typeof m.envMapIntensity !== 'number') m.envMapIntensity = 1;
          envMats.push({ m: m, base: m.envMapIntensity });
        });
      });
    })();

    /* --- transitions ----------------------------------------------------*/
    function setTimeMode(mode, instant) {
      rig.targetDayMix = mode === 'night' ? 0 : 1;
      if (instant) rig.dayMix = rig.targetDayMix;
    }
    function setDayMix(k) { rig.dayMix = k; }
    function update(dt, t) {
      const k = rig.dayMix;
      if (APP.modules.sky) APP.modules.sky.setDayMixHint && APP.modules.sky.setDayMixHint(k);
      // the sun is driven by sky.setHour() so the cinematic 24 h arc moves it
      const dir = (APP.modules.sky && APP.modules.sky.sun) ? APP.modules.sky.sun : sunDir;
      const alt = dir.y;
      const daylight = U.smoothstep(-0.065, 0.22, alt);
      const high = U.smoothstep(0.02, 0.42, alt);
      sun.position.set(0, 34, 0).addScaledVector(dir, 380);
      sun.color.copy(SUN_SET).lerp(SUN_DAY, high);
      sun.intensity = U.lerp(.015, 5.65, daylight) * (0.82 + 0.18 * high);
      // diffuse daylight
      hemi.intensity = U.lerp(.065, .28, k) * (0.85 + 0.15 * daylight);
      hemi.color.copy(HEMI_NIGHT).lerp(HEMI_DAY, k).lerp(SUN_SET, U.clamp((1 - high) * k * .35, 0, .35));
      hemi.groundColor.copy(HEMI_GROUND_NIGHT).lerp(HEMI_GROUND_DAY, k);
      fill.intensity = U.lerp(.01, .18, k) * (0.7 + 0.3 * daylight);
      moonFill.intensity = U.lerp(.70, 0, k);
      rim.intensity = U.lerp(.015, .80, k) * (0.55 + 0.45 * high);
      rim.color.copy(SUN_SET).lerp(new T.Color(0xffc78e), high);
      cutFill.intensity = U.lerp(0, 46, APP.state ? APP.state.cut : 0) * U.lerp(1, .22, 1 - k);
      // night practicals
      const nk = 1 - k;
      rig.spots.forEach((s, i) => { s.intensity = nk * (i % 2 ? 850 : 1050); });
      rig.pads.forEach(l => { l.intensity = nk * 14; });

      padFloods.forEach(l => { l.intensity = nk * l.userData.baseIntensity * .050; });
      rig.glowSprites.forEach((s, i) => {
        s.material.opacity = nk * (i < 4 ? .10 : .05);
      });
      // vent vapour: visible as condensation, strongest in the morning
      rig.vents.forEach((v, i) => {
        v.life += dt * v.speed;
        if (v.life > 1) v.life -= 1;
        const p = v.sprite.position;
        p.x = v.base.x + Math.sin(t * .35 + v.phase) * .8 + v.life * 2.2;
        p.y = v.base.y + v.life * 5.5;
        p.z = v.base.z + Math.cos(t * .27 + v.phase) * .7 + v.life * .9;
        const k2 = Math.sin(Math.PI * v.life);
        v.sprite.scale.setScalar(v.size * (.55 + v.life * 1.8));
        v.sprite.material.opacity = U.lerp(.24, .055, 1 - k) * k2 * .9;
      });
      dust.rotation.y = t * .004;
      dustMat.opacity = k < .25 ? 0 : U.lerp(.025, .12, k);
      // scale the captured day IBL down at night so practicals dominate
      const envScale = U.lerp(.035, 1, k);
      for (let i = 0; i < envMats.length; i++) envMats[i].m.envMapIntensity = envMats[i].base * envScale;
      if (APP.renderer) APP.renderer.toneMappingExposure = U.lerp(.84, .88, k);
      // sparkle at night on pad deck / wet spots
      if (APP.modules.site && APP.modules.site.setNight) APP.modules.site.setNight(1 - k);
    }
    APP.updaters.push(update);

    APP.modules.atmos = {
      group: g, sun, hemi, fill, rim, cutFill, spots: rig.spots,
      setTimeMode, setDayMix, update,
      get sunDir() { return sunDir; },
      get sunAlt() { return APP.modules.sky && APP.modules.sky.sun ? APP.modules.sky.sun.y : .3; }
    };
    return APP.modules.atmos;
  };
})();
