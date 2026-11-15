/* ============================================================================
 * 90-boot.js — renderer, camera rig, assembly, cutaway + explode controller,
 *               view presets, input, flags, QA hooks.
 * Owner: Lead.
 * ==========================================================================*/
(function () {
  'use strict';

  const boot = () => {
    const T = window.THREE, U = window.U, APP = window.APP;
    const SPEC = window.SPEC, FLAGS = window.FLAGS;
    const DEG = U.DEG, PI = U.PI;
    const reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const MOBILE = !!(window.matchMedia && window.matchMedia('(max-width: 760px)').matches);
    const DPR_CAP = FLAGS.pr || Math.min(window.devicePixelRatio || 1, FLAGS.lq ? 1 : (MOBILE ? 1.4 : 1.75));

    /* -- renderer ----------------------------------------------------------*/
    const canvas = document.getElementById('stage');
    if (!canvas) throw new Error('#stage canvas missing');
    let renderer;
    try {
      renderer = new T.WebGLRenderer({
        canvas, antialias: !FLAGS.lq, powerPreference: 'high-performance',
        alpha: false, stencil: false, preserveDrawingBuffer: false
      });
    } catch (e) {
      throw new Error('WebGL unavailable: ' + e.message);
    }
    renderer.setPixelRatio(DPR_CAP);
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = !FLAGS.lq && !FLAGS.noshadow;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.localClippingEnabled = true;
    renderer.setClearColor(0xbfd6dd, 1);

    const scene = new T.Scene();
    scene.matrixWorldAutoUpdate = true;
    const camera = new T.PerspectiveCamera(36, window.innerWidth / window.innerHeight, 0.9, 6000);
    APP.scene = scene; APP.camera = camera; APP.renderer = renderer;

    /* -- cut plane ---------------------------------------------------------*/
    const cutPlane = new T.Plane(new T.Vector3(-1, 0, 0), 6.6);
    APP.cutPlane = cutPlane;

    /* -- part registry -----------------------------------------------------*/
    APP.parts = {};
    APP.partsOrder = [];
    APP.registerPart = function (id, meta) {
      if (!meta) return;
      if (!APP.parts[id]) APP.partsOrder.push(id);
      const m = Object.assign({}, meta);
      m.id = id;
      if (m.anchor && m.anchor.isVector3) { const v = m.anchor.clone(); m.anchor = () => v.clone(); }
      if (typeof m.anchor !== 'function') {
        m.anchor = (m.group && m.group.isObject3D) ? U.anchorOf(m.group) : U.anchorAt(0, 30, 0);
      }
      if (!m.modes) m.modes = ['cut', 'explode'];
      if (m.index === undefined) m.index = true;
      APP.parts[id] = m;
      return m;
    };

    /* -- camera rig --------------------------------------------------------*/
    const rig = {
      target: new T.Vector3(0, 38, 0),
      az: -46 * U.DEG, elev: 13 * U.DEG, dist: 162, fov: 36,
      tTarget: new T.Vector3(0, 38, 0),
      tAz: -46 * U.DEG, tElev: 13 * U.DEG, tDist: 162, tFov: 36,
      flying: false, flyT: 0, flyDur: 1.6,
      from: null, interacted: false
    };
    const VIEWS = {
      hero: { target: [0, 38, 0], az: -8, elev: 9, dist: 142, fov: 37 },
      tower: { target: [0, 31, 0], az: -14, elev: 5, dist: 84, fov: 43 },
      cut: { target: [0, 40, 0], az: 104, elev: 7, dist: 112, fov: 35 },
      payload: { target: [0, 63.4, 0], az: 100, elev: 5, dist: 39, fov: 33 },
      engine: { target: [0, 15.5, 0], az: 110, elev: 1, dist: 30, fov: 50 },
      explode: { target: [0, 44, 0], az: 18, elev: 8, dist: 168, fov: 38 }
    };
    APP.views = [
      { id: 'hero', zh: '全景', en: 'OVERVIEW' },
      { id: 'tower', zh: '塔架', en: 'PAD & TOWER' },
      { id: 'cut', zh: '剖面', en: 'CUTAWAY' },
      { id: 'payload', zh: '载荷', en: 'PAYLOAD' },
      { id: 'engine', zh: '动力', en: 'PROPULSION' }
    ];
    function applyCamera() {
      const ce = Math.cos(rig.elev), se = Math.sin(rig.elev);
      camera.position.set(
        rig.target.x + rig.dist * ce * Math.sin(rig.az),
        rig.target.y + rig.dist * se,
        rig.target.z + rig.dist * ce * Math.cos(rig.az)
      );
      camera.fov = rig.fov; camera.updateProjectionMatrix();
      camera.lookAt(rig.target);
    }
    function setViewInstant(id) {
      const v = VIEWS[id] || VIEWS.hero;
      rig.target.set(v.target[0], v.target[1], v.target[2]);
      rig.az = v.az * U.DEG; rig.elev = v.elev * U.DEG; rig.dist = v.dist; rig.fov = v.fov;
      rig.tTarget.copy(rig.target); rig.tAz = rig.az; rig.tElev = rig.elev; rig.tDist = rig.dist; rig.tFov = v.fov;
      rig.flying = false; applyCamera();
    }
    function flyTo(id, dur) {
      const v = VIEWS[id] || VIEWS.hero;
      if (reduced) dur = 0.01;
      rig.from = { target: rig.target.clone(), az: rig.az, elev: rig.elev, dist: rig.dist, fov: rig.fov };
      rig.tTarget.set(v.target[0], v.target[1], v.target[2]);
      rig.tAz = v.az * U.DEG; rig.tElev = v.elev * U.DEG; rig.tDist = v.dist; rig.tFov = v.fov;
      rig.flyT = 0; rig.flyDur = dur === undefined ? 1.7 : dur;
      rig.flying = true;
      if (dur === 0) { setViewInstant(id); }
    }
    function stepCamera(dt) {
      if (rig.flying) {
        rig.flyT += dt / Math.max(.001, rig.flyDur);
        const t = U.easeInOut(U.clamp(rig.flyT, 0, 1));
        rig.target.lerpVectors(rig.from.target, rig.tTarget, t);
        rig.az = U.lerp(rig.from.az, rig.tAz, t);
        rig.elev = U.lerp(rig.from.elev, rig.tElev, t);
        rig.dist = U.lerp(rig.from.dist, rig.tDist, t);
        rig.fov = U.lerp(rig.from.fov, rig.tFov, t);
        if (rig.flyT >= 1) { rig.flying = false; rig.target.copy(rig.tTarget); }
      } else {
        // damped orbit residual (mouse)
        rig.az = U.lerp(rig.az, rig.tAz, 1 - Math.pow(.001, dt));
        rig.elev = U.lerp(rig.elev, rig.tElev, 1 - Math.pow(.001, dt));
        rig.dist = U.lerp(rig.dist, rig.tDist, 1 - Math.pow(.001, dt));
        rig.target.lerp(rig.tTarget, 1 - Math.pow(.001, dt));
      }
      // gentle drift when untouched in hero, disabled in QA/reduced motion
      if (!FLAGS.still && !reduced && !rig.interacted && !rig.flying && APP.mode === 'overall') {
        rig.tAz += dt * .045;
      }
      applyCamera();
    }

    /* -- orbit input -------------------------------------------------------*/
    const state = { pointerId: null, lastX: 0, lastY: 0, pointers: new Map(), pinchDist: 0 };
    function onDown(e) {
      if (APP.cineActive) return;
      if (e.target !== canvas) return;
      if (state.pointers.size === 0) {
        state.pointerId = e.pointerId; state.lastX = e.clientX; state.lastY = e.clientY;
      }
      state.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (state.pointers.size === 2) {
        const p = [...state.pointers.values()];
        state.pinchDist = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      }
      canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
      document.body.classList.add('dragging');
      rig.interacted = true;
    }
    function onMove(e) {
      if (APP.cineActive) return;
      if (!state.pointers.has(e.pointerId)) return;
      state.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (state.pointers.size === 1) {
        const dx = e.clientX - state.lastX, dy = e.clientY - state.lastY;
        state.lastX = e.clientX; state.lastY = e.clientY;
        rig.flying = false;
        rig.tAz -= dx * .0042;
        rig.tElev = U.clamp(rig.tElev + dy * .0032, -2 * U.DEG, 68 * U.DEG);
      } else if (state.pointers.size === 2) {
        const p = [...state.pointers.values()];
        const d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
        if (state.pinchDist > 0) {
          rig.tDist = U.clamp(rig.tDist * (state.pinchDist / d), 18, 620);
        }
        state.pinchDist = d;
        const cx = (p[0].x + p[1].x) / 2, cy = (p[0].y + p[1].y) / 2;
        if (state.lastX) {
          rig.tAz -= (cx - state.lastX) * .002;
          rig.tElev = U.clamp(rig.tElev + (cy - state.lastY) * .0015, -2 * U.DEG, 68 * U.DEG);
        }
        state.lastX = cx; state.lastY = cy;
      }
    }
    function onUp(e) {
      state.pointers.delete(e.pointerId);
      if (state.pointers.size === 1) {
        const p = [...state.pointers.values()][0];
        state.lastX = p.x; state.lastY = p.y;
      }
      if (state.pointers.size === 0) {
        document.body.classList.remove('dragging');
        state.lastX = state.lastY = 0;
      }
    }
    function onWheel(e) {
      if (APP.cineActive) return;
      if (e.target !== canvas) return;
      e.preventDefault();
      rig.interacted = true; rig.flying = false;
      rig.tDist = U.clamp(rig.tDist * Math.exp(e.deltaY * .0011), 18, 620);
    }
    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('dblclick', () => { if (!APP.cineActive && APP.mode === 'overall') flyTo('hero', 1.2); });

    /* -- state + transitions ----------------------------------------------*/
    const S = {
      mode: 'overall', view: 'hero', cut: 0, cutTarget: 0, cutLevel: 1,
      explode: 0, explodeTarget: 0, time: 'day', labels: !FLAGS.nolabels,
      selected: null, started: performance.now()
    };
    APP.state = S;
    APP.mode = S.mode;
    function callAll(list, t) {
      for (let i = 0; i < list.length; i++) { try { list[i](t); } catch (e) { reportError(e); } }
    }
    function applyCutPlane() {
      // keep region x < c; park at c=6.6 when whole, cut through the axis at c=-0.35
      cutPlane.constant = U.lerp(6.6, -0.35, U.easeInOut(U.clamp(S.cut, 0, 1)));
    }
    function setCut(v, fromUser) {
      S.cut = U.clamp(v, 0, 1);
      S.cutTarget = S.cut;
      applyCutPlane();
      callAll(APP.cutables, S.cut);
      if (HUD && HUD.setCut) HUD.setCut(S.cut, fromUser);
      if (fromUser && S.mode === 'overall' && S.cut > .03) { /* stay in overall; UI decides */ }
    }
    function setMode(mode, opts) {
      opts = opts || {};
      mode = ['overall', 'cut', 'explode'].includes(mode) ? mode : 'overall';
      S.mode = mode; APP.mode = mode;
      if (mode === 'overall') { S.cutTarget = 0; S.explodeTarget = 0; S.view = 'hero'; if (!opts.keepView) flyTo('hero'); }
      else if (mode === 'cut') { S.cutTarget = S.cutLevel; S.explodeTarget = 0; S.view = 'cut'; if (!opts.keepView) flyTo('cut'); }
      else if (mode === 'explode') { S.cutTarget = 0; S.explodeTarget = 1; S.view = 'hero'; if (!opts.keepView) flyTo('explode', 2.0); }
      if (HUD && HUD.setMode) HUD.setMode(mode);
      if (HUD && HUD.setView && !opts.keepView) HUD.setView(S.view);
      return S.mode;
    }
    function setView(id, opts) {
      if (!VIEWS[id]) return;
      S.view = id;
      flyTo(id, (opts && opts.dur !== undefined) ? opts.dur : 1.7);
      if (HUD && HUD.setView) HUD.setView(id, opts);
      return id;
    }
    function setTimeMode(mode, instant) {
      mode = mode === 'night' ? 'night' : 'day';
      instant = instant === undefined ? !!FLAGS.instant : !!instant;
      S.time = mode;
      if (APP.modules.sky && APP.modules.sky.setTimeMode) APP.modules.sky.setTimeMode(mode, instant);
      if (APP.modules.atmos && APP.modules.atmos.setTimeMode) APP.modules.atmos.setTimeMode(mode, instant);
      if (instant) {
        if (APP.modules.sky && APP.modules.sky.update) APP.modules.sky.update(1.0, 0);
        if (APP.modules.atmos && APP.modules.atmos.update) APP.modules.atmos.update(1.0, 0);
      }
      callAll(APP.timeables, mode);
      if (HUD && HUD.setTimeMode) HUD.setTimeMode(mode);
      return mode;
    }
    function setLabelsVisible(on) {
      S.labels = !!on;
      if (HUD && HUD.setLabelsVisible) HUD.setLabelsVisible(S.labels);
      return S.labels;
    }
    function selectPart(id) {
      S.selected = id || null;
      if (HUD && HUD.setSelectedPart) HUD.setSelectedPart(S.selected);
      return S.selected;
    }
    function focusPart(id) {
      const p = APP.parts[id];
      if (!p) return;
      selectPart(id);
      const mode = p.focusMode || (p.modes && p.modes.includes('cut') ? 'cut' : S.mode);
      if (mode !== S.mode) setMode(mode, { keepView: true });
      const anchor = p.anchor();
      const viewId = p.view || (id === 'change7' || id === 'orbiter' || id === 'lander' || id === 'rover' || id === 'hopper' ? 'payload' : null);
      if (viewId && VIEWS[viewId]) {
        S.view = viewId;
        // fly to the part's live anchor instead of the static preset
        const v = VIEWS[viewId];
        rig.from = { target: rig.target.clone(), az: rig.az, elev: rig.elev, dist: rig.dist, fov: rig.fov };
        rig.tTarget.copy(anchor);
        rig.tAz = v.az * U.DEG; rig.tElev = v.elev * U.DEG;
        rig.tDist = v.dist; rig.tFov = v.fov;
        rig.flyT = 0; rig.flyDur = 1.5; rig.flying = true;
        if (HUD && HUD.setView) HUD.setView(viewId);
      } else {
        setView('cut');
      }
    }
    function toggleFullscreen() {
      try {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen();
        else document.exitFullscreen();
      } catch (e) { /* ignore */ }
    }
    function getState() {
      return { mode: S.mode, view: S.view, cut: S.cut, explode: S.explode, time: S.time, labels: S.labels, selected: S.selected };
    }

    APP.actions = {
      setMode, setView, setCut, setTimeMode, setLabelsVisible, selectPart, focusPart, toggleFullscreen, getState,
      toggleTime() { setTimeMode(S.time === 'day' ? 'night' : 'day'); },
      toggleLabels() { return setLabelsVisible(!S.labels); },
      setViewInstant, reset: () => { setMode('overall', { keepView: false }); }
    };

    /* -- cinematic rig bridge (used by 80-cinematic.js) --------------------*/
    APP.cineActive = false;
    APP.cinema = {
      setActive(on) {
        APP.cineActive = !!on;
        if (on) { rig.flying = false; rig.interacted = true; }
      },
      getCamera() {
        return { target: [rig.target.x, rig.target.y, rig.target.z], az: rig.az * RAD, elev: rig.elev * RAD, dist: rig.dist, fov: rig.fov };
      },
      camera(cam) {
        if (!cam) return;
        const t = cam.target || [0, 38, 0];
        rig.target.set(t[0], t[1], t[2]);
        rig.az = (cam.az || 0) * DEG; rig.elev = (cam.elev || 0) * DEG;
        rig.dist = cam.dist; rig.fov = cam.fov;
        rig.tTarget.copy(rig.target); rig.tAz = rig.az; rig.tElev = rig.elev;
        rig.tDist = rig.dist; rig.tFov = rig.fov;
        rig.flying = false;
        applyCamera();
      },
      cut(v) {
        const c = U.clamp(v, 0, 1);
        S.cut = c; S.cutTarget = c;
        applyCutPlane(); callAll(APP.cutables, c);
        if (HUD && HUD.setCut) HUD.setCut(c);
      },
      explode(v) {
        const x = U.clamp(v, 0, 1);
        S.explode = x; S.explodeTarget = x;
        callAll(APP.explodables, x);
        if (HUD && HUD.setExplode) HUD.setExplode(x);
      },
      mode(mode) {
        mode = ['overall', 'cut', 'explode'].includes(mode) ? mode : 'overall';
        S.mode = mode; APP.mode = mode;
        if (HUD && HUD.setMode) HUD.setMode(mode);
      },
      hour(h, force) {
        if (APP.modules.sky && APP.modules.sky.setHour) APP.modules.sky.setHour(h, !!force);
      }
    };

    /* -- minimal fallback lighting (sky/atmos replace/boost) ---------------*/
    const fallback = new T.Group(); fallback.name = 'fallback-light';
    const hemi = new T.HemisphereLight(0xdfeaf0, 0x5f6351, .55);
    fallback.add(hemi);
    const d = new T.DirectionalLight(0xfff2dc, 1.6);
    d.position.set(130, 180, 90); d.castShadow = true;
    d.shadow.mapSize.set(2048, 2048);
    d.shadow.camera.near = 10; d.shadow.camera.far = 600;
    d.shadow.camera.left = -180; d.shadow.camera.right = 180;
    d.shadow.camera.top = 200; d.shadow.camera.bottom = -40;
    d.shadow.bias = -0.0004; d.shadow.normalBias = 0.7;
    fallback.add(d); scene.add(fallback);
    APP.lights = { hemi, dir: d, fallback };

    /* -- assembly ----------------------------------------------------------*/
    let HUD = null;
    function loadModule(name, fn) {
      const t0 = performance.now();
      try {
        if (typeof window[fn] === 'function') {
          window[fn](APP);
          const dt = performance.now() - t0;
          if (FLAGS.debug) console.log('[build]', name, dt.toFixed(0) + 'ms');
        }
      } catch (e) {
        reportError('build ' + name + ': ' + (e && e.stack || e));
      }
    }
    const only = FLAGS.only;
    const want = (n) => !only || only.includes(n);
    if (want('sky')) loadModule('sky', 'buildSky');
    if (want('site')) loadModule('site', 'buildSite');
    if (!APP.modules.site) {
      const g = U.group('fallback-ground'); scene.add(g);
      const ground = U.planeMesh(2600, 2600, U.matStandard({ color: 0x666a5f, roughness: .95 }), { rx: -PI / 2, y: 0 });
      ground.receiveShadow = true; g.add(ground);
      APP.modules.site = { group: g };
    }
    if (want('rocket')) loadModule('rocket', 'buildRocket');
    if (want('interior')) loadModule('interior', 'buildInterior');
    if (want('payload')) loadModule('payload', 'buildPayload');
    if (want('atmos')) loadModule('atmos', 'buildAtmos');
    if (MOBILE && APP.modules.atmos && APP.modules.atmos.sun && APP.modules.atmos.sun.shadow) {
      APP.modules.atmos.sun.shadow.mapSize.set(1024, 1024);
      if (APP.modules.atmos.sun.shadow.map) { APP.modules.atmos.sun.shadow.map.dispose(); APP.modules.atmos.sun.shadow.map = null; }
    }
    if (want('post')) loadModule('post', 'buildPost');
    // the Lead's atmos rig replaces the safety lighting as soon as it exists
    if (APP.modules.atmos) fallback.visible = false;
    if (want('ui')) {
      try {
        HUD = window.HUD || null;
        if (HUD && HUD.init) HUD.init(APP);
      } catch (e) { reportError('HUD init: ' + (e && e.stack || e)); }
    }
    window.__HUD__ = HUD;
    if (want('cinematic')) loadModule('cinematic', 'buildCinematic');

    // initial state from flags
    if (FLAGS.time === 'night') { S.time = 'day'; setTimeMode('night', FLAGS.instant); }
    if (FLAGS.cam) {
      const a = FLAGS.cam.split(',').map(Number);
      rig.target.set(a[3] || 0, a[4] === undefined ? 38 : a[4], a[5] || 0);
      rig.az = (a[0] || 0) * DEG; rig.elev = (a[1] || 12) * DEG; rig.dist = a[2] || 160;
      rig.fov = a[6] || 36;
      rig.tTarget.copy(rig.target); rig.tAz = rig.az; rig.tElev = rig.elev; rig.tDist = rig.dist; rig.tFov = rig.fov;
      applyCamera();
    } else if (FLAGS.view) {
      S.view = VIEWS[FLAGS.view] ? FLAGS.view : 'hero';
      setViewInstant(S.view);
      if (HUD && HUD.setView) HUD.setView(S.view);
    } else {
      applyCamera();
    }
    if (FLAGS.mode === 'cut') { S.mode = 'cut'; S.cutTarget = 1; S.explodeTarget = 0; APP.mode = 'cut'; if (!FLAGS.view && !FLAGS.cam) { S.view = 'cut'; setViewInstant('cut'); } if (HUD && HUD.setMode) HUD.setMode('cut'); }
    else if (FLAGS.mode === 'explode') { S.mode = 'explode'; S.cutTarget = 0; S.explodeTarget = 1; APP.mode = 'explode'; if (!FLAGS.view && !FLAGS.cam) setViewInstant('explode'); if (HUD && HUD.setMode) HUD.setMode('explode'); }
    if (FLAGS.cut !== null) { S.cut = FLAGS.cut; S.cutTarget = FLAGS.cut; S.cutLevel = FLAGS.cut; applyCutPlane(); callAll(APP.cutables, S.cut); }
    if (FLAGS.instant) {
      // deterministic initial state for stills/QA: no slow damping under software GL
      if (S.cutTarget > 0) { S.cut = S.cutTarget; applyCutPlane(); callAll(APP.cutables, S.cut); }
      if (S.explodeTarget > 0) { S.explode = S.explodeTarget; callAll(APP.explodables, S.explode); }
      setTimeMode(S.time, true);
    }
    if (FLAGS.nolabels) setLabelsVisible(false);
    // HUD init happened before flags were applied; sync once now
    if (HUD) {
      if (HUD.setMode) HUD.setMode(S.mode);
      if (HUD.setView) HUD.setView(S.view);
      if (HUD.setCut) HUD.setCut(S.cut);
      if (HUD.setTimeMode) HUD.setTimeMode(S.time);
      if (HUD.setLabelsVisible) HUD.setLabelsVisible(S.labels);
    }

    /* -- intro -------------------------------------------------------------*/
    const introFrom = { target: [0, 34, 0], az: -16, elev: 13, dist: 380, fov: 38 };
    const introTo = VIEWS.hero;
    if (!FLAGS.instant && !FLAGS.view && !FLAGS.cam && !reduced) {
      rig.target.set(introFrom.target[0], introFrom.target[1], introFrom.target[2]);
      rig.az = introFrom.az * DEG; rig.elev = introFrom.elev * DEG; rig.dist = introFrom.dist; rig.fov = introFrom.fov;
      rig.tTarget.set(introTo.target[0], introTo.target[1], introTo.target[2]);
      rig.tAz = introTo.az * DEG; rig.tElev = introTo.elev * DEG; rig.tDist = introTo.dist; rig.tFov = introTo.fov;
      rig.from = { target: rig.target.clone(), az: rig.az, elev: rig.elev, dist: rig.dist, fov: rig.fov };
      rig.flyT = 0; rig.flyDur = 4.2; rig.flying = true;
      applyCamera();
    }

    /* -- boot progress -----------------------------------------------------*/
    const mark = (t, label) => {
      if (HUD && HUD.setLoading) { try { HUD.setLoading(t, label); } catch (e) { } }
      const el = document.getElementById('boot-status');
      if (el && label) el.textContent = label;
      const bar = document.getElementById('boot-bar');
      if (bar) bar.style.transform = 'scaleX(' + U.clamp(t, 0, 1) + ')';
    };
    mark(.18, '载入发射场数据');
    requestAnimationFrame(() => mark(.45, '构建箭体结构'));
    setTimeout(() => mark(.72, '装订剖面与标注'), 120);
    setTimeout(() => mark(.9, '准备就绪'), 380);
    // safety: never trap the user behind the boot veil, whatever the HUD does
    setTimeout(() => {
      const b = document.getElementById('boot');
      if (b && !b.classList.contains('gone')) {
        b.classList.add('gone');
        setTimeout(() => { if (b.parentNode) b.parentNode.removeChild(b); }, 950);
      }
    }, 7200);

    /* -- resize ------------------------------------------------------------*/
    function resize() {
      const w = window.innerWidth, h = window.innerHeight;
      camera.aspect = w / h; camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
      const pr = DPR_CAP;
      renderer.setPixelRatio(pr);
      if (APP.modules.post && APP.modules.post.setSize) APP.modules.post.setSize(w, h, renderer.getPixelRatio());
      if (HUD && HUD.resize) HUD.resize(w, h);
    }
    window.addEventListener('resize', resize);

    /* -- main loop ---------------------------------------------------------*/
    const clock = new T.Clock();
    let frame = 0, fpsAcc = 0, fpsN = 0, fps = 60, last = performance.now();
    APP.ready = false;
    function loop() {
      requestAnimationFrame(loop);
      const dt = Math.min(clock.getDelta(), .05);
      const t = clock.elapsedTime;
      // transitions
      const cutSpeed = 1 - Math.pow(.0008, dt);
      if (Math.abs(S.cut - S.cutTarget) > .0004) {
        S.cut = U.lerp(S.cut, S.cutTarget, cutSpeed);
        if (Math.abs(S.cut - S.cutTarget) < .0006) S.cut = S.cutTarget;
        applyCutPlane();
        callAll(APP.cutables, S.cut);
        if (HUD && HUD.setCut) HUD.setCut(S.cut);
      }
      if (Math.abs(S.explode - S.explodeTarget) > .0004) {
        S.explode = U.lerp(S.explode, S.explodeTarget, 1 - Math.pow(.001, dt));
        if (Math.abs(S.explode - S.explodeTarget) < .0006) S.explode = S.explodeTarget;
        callAll(APP.explodables, S.explode);
        if (HUD && HUD.setExplode) HUD.setExplode(S.explode);
      }
      if (!APP.cineActive) { try { stepCamera(dt); } catch (e) { reportError(e); } }
      for (let i = 0; i < APP.updaters.length; i++) {
        try { APP.updaters[i](dt, t); } catch (e) { reportError(e); }
      }
      if (HUD && HUD.update) { try { HUD.update(dt, t, APP.metrics); } catch (e) { reportError(e); } }
      if (!FLAGS.raw && APP.modules.post && APP.modules.post.render) {
        try { APP.modules.post.render(dt, t); } catch (e) { APP.modules.post = null; reportError(e); renderer.render(scene, camera); }
      } else {
        renderer.render(scene, camera);
      }
      frame++;
      fpsAcc += dt; fpsN++;
      if (fpsAcc >= .5) { fps = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }
      const pm = APP.modules.post && APP.modules.post.metrics;
      APP.metrics = {
        draws: pm ? pm.draws : renderer.info.render.calls,
        tris: pm ? pm.tris : renderer.info.render.triangles,
        programs: renderer.info.programs ? renderer.info.programs.length : 0,
        fps, frame
      };
      if (frame === 2) {
        APP.ready = true; window.__READY__ = true;
        window.__METRICS__ = APP.metrics;
        mark(1, '就绪');
        if (HUD && HUD.ready) { try { HUD.ready(); } catch (e) { } }
        if (APP.cinematic && APP.cinematic.onReady) { try { APP.cinematic.onReady(); } catch (e) { reportError(e); } }
        else {
          const b = document.getElementById('boot');
          if (b) { b.classList.add('gone'); setTimeout(() => b.remove(), 900); }
        }
      }
      if (frame % 30 === 0) window.__METRICS__ = APP.metrics;
    }
    // initial cut state
    applyCutPlane();
    callAll(APP.cutables, S.cut);
    callAll(APP.explodables, S.explode);
    resize();
    loop();
    window.__BOOT_STATE__ = S;
    if (FLAGS.debug) console.log('[boot] ready in', ((performance.now() - S.started) | 0) + 'ms');
  };

  try { boot(); } catch (e) {
    console.error(e);
    const el = document.getElementById('err');
    if (el) { el.style.display = 'block'; el.textContent = '启动失败: ' + (e && e.message || e); }
  }
})();
