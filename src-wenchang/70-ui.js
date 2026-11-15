/* ============================================================================
 * 70-ui.js — paper / ink / vermilion dossier UI.
 * Owner: ui.  Boot overlay, identity, utilities, structure index, public-data
 * plate, mode tabs, cut depth, view presets, part detail file, projected 3-D
 * callout labels, keyboard shortcuts, toasts, mobile composition.
 *
 * Rules: read APP state through APP.actions only, never touch 3-D geometry.
 * Degrades gracefully when other modules are stubbed (empty index / no labels).
 * ==========================================================================*/
(function () {
  'use strict';

  var doc = document;
  var SVGNS = 'http://www.w3.org/2000/svg';
  var Q = window.Q || {};
  var REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var PAYLOAD_IDS = ['change7', 'orbiter', 'lander', 'rover', 'hopper', 'yz2'];
  var DEFAULT_VIEWS = [
    { id: 'hero', zh: '全景', en: 'OVERVIEW' },
    { id: 'tower', zh: '塔架', en: 'PAD & TOWER' },
    { id: 'cut', zh: '剖面', en: 'CUTAWAY' },
    { id: 'payload', zh: '载荷', en: 'PAYLOAD' },
    { id: 'engine', zh: '动力', en: 'PROPULSION' }
  ];
  var MODE_LABELS = { overall: '整体', cut: '剖视', explode: '分解' };
  /* Callout curation. Contract part ids come first; any part not listed falls
     back to registry order, so the UI stays robust if the part set changes. */
  var LABEL_PRIORITY = {
    overall: ['tower', 'launch_mount', 'lightning', 'sea', 'vab', 'fairing', 'stage2', 'stage1', 'booster', 'change7', 'core_engine', 'booster_engine'],
    cut: ['fairing', 'change7', 'stage1', 'tank_lh2', 'stage2', 'orbiter', 'lander', 'tank_lox', 'booster', 'rover', 'hopper', 'yf77', 'yz2', 'core_engine', 'booster_engine', 'yf100', 'yf75d'],
    explode: ['fairing', 'change7', 'orbiter', 'stage1', 'stage2', 'lander', 'booster', 'rover', 'hopper', 'yz2', 'core_engine', 'booster_engine', 'tank_lh2', 'tank_lox', 'yf77', 'yf100']
  };
  var VIEW_BOOST = {
    hero: ['tower', 'launch_mount', 'lightning', 'sea', 'vab', 'fairing', 'stage1'],
    tower: ['tower', 'launch_mount', 'lightning', 'stage1', 'booster', 'core_engine'],
    cut: LABEL_PRIORITY.cut,
    payload: ['change7', 'orbiter', 'lander', 'rover', 'hopper', 'fairing', 'yz2', 'stage2'],
    engine: ['core_engine', 'booster_engine', 'booster', 'stage1', 'yf77', 'yf100', 'yf75d', 'fairing']
  };

  function $(sel, root) { return (root || doc).querySelector(sel); }
  function all(sel, root) { return Array.prototype.slice.call((root || doc).querySelectorAll(sel)); }
  function on(el, type, fn, opts) {
    if (el && typeof el.addEventListener === 'function') { el.addEventListener(type, fn, opts); return true; }
    return false;
  }
  function isEl(el) { return !!(el && typeof el.getBoundingClientRect === 'function'); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function num(v) { return (typeof v === 'number' && isFinite(v)) ? v : 0; }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function isMobile() { return window.innerWidth <= 760; }
  function svgEl(tag) { return doc.createElementNS(SVGNS, tag); }

  var S = {
    app: null,
    els: {},
    /* mirrored APP state */
    mode: 'overall', view: 'hero', time: 'day', labelsOn: true, selected: null, cut: 0,
    /* interaction */
    hover: null, draggingCut: false,
    /* derived */
    entries: [], indexEntries: [], numOf: {}, labels: {}, labelOrder: [],
    safe: [], maxLabels: 6, regSig: '',
    acc: 0, lastSyncMs: 0,
    measureQueued: false,
    readyFired: false, bootDone: false, bootHold: Q.uiboot === '1',
    _v1: null, _v2: null
  };

  /* ==========================================================================
   * public HUD API (contract §5) — defined immediately so boot can call it.
   * ========================================================================*/
  var HUD = {
    init: function (app) { try { init(app || window.APP); } catch (e) { console.error('[ui] init failed', e); } },
    ready: function () { try { onReady(); } catch (e) { console.error('[ui] ready failed', e); } },
    setLoading: function (t, label) { try { setLoading(t, label); } catch (e) { /* noop */ } },
    setMode: function (mode) { try { applyMode(mode); } catch (e) { /* noop */ } },
    setView: function (id) { try { applyView(id); } catch (e) { /* noop */ } },
    setCut: function (v) { try { applyCut(v); } catch (e) { /* noop */ } },
    setExplode: function (v) { try { applyExplode(v); } catch (e) { /* noop */ } },
    setSelectedPart: function (id) { try { applySelected(id); } catch (e) { /* noop */ } },
    setLabelsVisible: function (on) { try { applyLabels(on); } catch (e) { /* noop */ } },
    setTimeMode: function (mode) { try { applyTime(mode); } catch (e) { /* noop */ } },
    toast: function (text) { try { pushToast(text); } catch (e) { /* noop */ } },
    update: function (dt) { try { tick(dt || 0.016); } catch (e) { /* noop */ } },
    resize: function () { try { onResize(); } catch (e) { /* noop */ } },
    /* extra (tolerant helper used by QA / late module registration) */
    refresh: function () { try { registryChanged(); } catch (e) { /* noop */ } }
  };
  window.HUD = HUD;
  HUD._state = S; /* QA / debug inspection only */

  /* ==========================================================================
   * boot safety net — independent of the main loop: never trap the user.
   * ========================================================================*/
  window.setTimeout(function () {
    if (!window.__READY__) hideBoot();
  }, 6200);
  window.setTimeout(function () {
    var err = doc.getElementById('err');
    if (err && (err.textContent || '').trim()) hideBoot();
  }, 2600);

  function setLoading(t, label) {
    var pct = clamp(num(t), 0, 1);
    var el = S.els.bootPct || doc.getElementById('boot-pct');
    if (el) el.textContent = Math.round(pct * 100) + '%';
    if (label) {
      var st = doc.getElementById('boot-status');
      if (st) st.textContent = label;
    }
  }

  function hideBoot() {
    if (S.bootDone) return;
    S.bootDone = true;
    var boot = doc.getElementById('boot');
    if (boot) {
      boot.classList.add('is-out');
      boot.setAttribute('aria-hidden', 'true');
      window.setTimeout(function () {
        if (boot.parentNode) boot.style.display = 'none';
      }, 1100);
    }
    doc.body.classList.add('is-ready');
  }

  function onReady() {
    if (S.readyFired) return;
    S.readyFired = true;
    if (Q.noui) { hideBoot(); return; }
    setLoading(1, '就绪');
    if (S.bootHold) {
      /* QA-only: keep the boot veil up long enough to be photographed */
      window.setTimeout(hideBoot, 30000);
    } else {
      hideBoot();
    }
    if (!Q.still && !Q.instant) {
      window.setTimeout(function () {
        pushToast('拖动旋转 · 滚轮缩放 · 数字键 1–5 切换视角');
      }, 1500);
    }
  }

  /* ==========================================================================
   * init
   * ========================================================================*/
  function init(app) {
    S.app = app || window.APP || null;
    cacheEls();
    if (Q.noui) doc.body.classList.add('noui');
    if (Q.nolabels) doc.body.classList.add('nolabels');
    if (REDUCED) doc.body.classList.add('reduced-motion');
    updateMobileClass();
    try { bindEvents(); } catch (e) { console.error('[ui] bindEvents failed', e); }
    try { buildViews(); } catch (e) { console.error('[ui] buildViews failed', e); }

    /* seed mirrored state from APP */
    var st = (S.app && S.app.state) || {};
    try { applyMode(st.mode || (S.app && S.app.mode) || 'overall'); } catch (e) { console.error('[ui] applyMode failed', e); }
    try { applyView(st.view || 'hero'); } catch (e) { console.error('[ui] applyView failed', e); }
    try { applyTime(st.time || 'day'); } catch (e) { console.error('[ui] applyTime failed', e); }
    try { applyLabels(typeof st.labels === 'boolean' ? st.labels : true); } catch (e) { console.error('[ui] applyLabels failed', e); }
    try { applyCut(typeof st.cut === 'number' ? st.cut : 0); } catch (e) { console.error('[ui] applyCut failed', e); }
    try { applySelected(st.selected || null); } catch (e) { console.error('[ui] applySelected failed', e); }
    try { registryChanged(); } catch (e) { console.error('[ui] registryChanged failed', e); }
    try { measure(); } catch (e) { console.error('[ui] measure failed', e); }

    if (doc.fonts && doc.fonts.ready && doc.fonts.ready.then) {
      doc.fonts.ready.then(function () { try { measure(); } catch (e) { /* noop */ } });
    }
    window.addEventListener('resize', onResize, { passive: true });
    window.addEventListener('orientationchange', onResize);
    var mq = window.matchMedia ? window.matchMedia('(max-width: 760px)') : null;
    if (mq) {
      var onMq = function () { updateMobileClass(); onResize(); rebuildLabels(); };
      if (mq.addEventListener) mq.addEventListener('change', onMq);
      else if (mq.addListener) mq.addListener(onMq);
    }
  }

  function cacheEls() {
    var e = S.els;
    e.body = doc.body;
    e.masthead = $('#masthead');
    e.utilities = $('#utilities');
    e.rail = $('#rail');
    e.index = $('#index');
    e.indexGroups = $('#indexGroups');
    e.indexCount = $('#indexCount');
    e.plate = $('#plate');
    e.dock = $('#dock');
    e.modes = $('#modes');
    e.views = $('#views');
    e.cutbar = $('#cutbar');
    e.cutRange = $('#cutRange');
    e.cutFill = $('#cutFill');
    e.cutOut = $('#cutOut');
    e.cutVal = $('#cutVal');
    e.detail = $('#detail');
    e.detailNum = $('#detailNum');
    e.detailSection = $('#detailSection');
    e.detailZh = $('#detailZh');
    e.detailEn = $('#detailEn');
    e.detailDesc = $('#detailDesc');
    e.detailSpecs = $('#detailSpecs');
    e.detailLocate = $('#detailLocate');
    e.detailNote = $('#detailNote');
    e.detailClose = $('#detailClose');
    e.timeSeg = $('#timeSeg');
    e.btnLabels = $('#btnLabels');
    e.btnFull = $('#btnFull');
    e.btnHelp = $('#btnHelp');
    e.help = $('#help');
    e.helpClose = $('#helpClose');
    e.toasts = $('#toasts');
    e.stamp = $('.stamp');
    e.labels = $('#labels');
    e.leaders = $('#leaders');
    e.chips = $('#chips');
    e.boot = $('#boot');
    e.bootPct = $('#boot-pct');
  }

  /* ==========================================================================
   * event wiring
   * ========================================================================*/
  function bindEvents() {
    /* mode tabs */
    on(S.els.modes, 'click', function (ev) {
      var b = ev.target && ev.target.closest ? ev.target.closest('.mode') : null;
      if (!b) return;
      action('setMode', b.getAttribute('data-mode'));
    });
    /* time segmented */
    on(S.els.timeSeg, 'click', function (ev) {
      var b = ev.target && ev.target.closest ? ev.target.closest('button[data-time]') : null;
      if (!b) return;
      action('setTimeMode', b.getAttribute('data-time'));
    });
    /* utilities */
    on(S.els.btnLabels, 'click', toggleLabels);
    on(S.els.btnFull, 'click', function () { action('toggleFullscreen'); });
    on(S.els.btnHelp, 'click', function () { toggleHelp(!!(S.els.help && S.els.help.hidden)); });
    on(S.els.helpClose, 'click', function () { toggleHelp(false); });
    on(S.els.help, 'click', function (ev) { if (ev.target === S.els.help) toggleHelp(false); });
    /* detail card */
    on(S.els.detailClose, 'click', function () { action('selectPart', null); });
    on(S.els.detailLocate, 'click', function () { if (S.selected) focusPart(S.selected); });
    /* cut slider */
    var range = S.els.cutRange;
    if (range && typeof range.addEventListener === 'function') {
      range.addEventListener('input', function () {
        var v = clamp((parseFloat(range.value) || 0) / 100, 0, 1);
        applyCut(v);
        action('setCut', v);
      });
      on(range, 'pointerdown', function () { S.draggingCut = true; });
      window.addEventListener('pointerup', function () { S.draggingCut = false; });
      window.addEventListener('pointercancel', function () { S.draggingCut = false; });
    }
    /* keyboard */
    window.addEventListener('keydown', onKeyDown);
    /* fullscreen state */
    doc.addEventListener('fullscreenchange', function () {
      if (S.els.btnFull) S.els.btnFull.setAttribute('aria-pressed', doc.fullscreenElement ? 'true' : 'false');
    });
    /* label chips: delegated hover feedback (chips are re-created on rebuild) */
    on(S.els.chips, 'mouseover', function (ev) {
      var c = ev.target && ev.target.closest ? ev.target.closest('.lbl') : null;
      if (c) setHover(c.getAttribute('data-id'));
    });
    on(S.els.chips, 'mouseout', function (ev) {
      var c = ev.target && ev.target.closest ? ev.target.closest('.lbl') : null;
      if (c) setHover(null);
    });
  }

  function onKeyDown(ev) {
    if (ev.ctrlKey || ev.metaKey || ev.altKey || ev.repeat) return;
    var t = ev.target;
    var tag = (t && t.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || (t && t.isContentEditable)) {
      if (ev.key === 'Escape') t.blur();
      return;
    }
    var k = ev.key || '';
    var lower = k.length === 1 ? k.toLowerCase() : k;
    var handled = true;
    if (k >= '1' && k <= '5') {
      var views = (S.app && S.app.views) || DEFAULT_VIEWS;
      var v = views[Number(k) - 1];
      if (v) action('setView', v.id);
      else handled = false;
    } else if (lower === 'c') {
      action('setMode', S.mode === 'cut' ? 'overall' : 'cut');
    } else if (lower === 'x') {
      action('setMode', S.mode === 'explode' ? 'overall' : 'explode');
    } else if (lower === 'n') {
      var a = S.app && S.app.actions;
      if (a && typeof a.toggleTime === 'function') a.toggleTime();
      else action('setTimeMode', S.time === 'night' ? 'day' : 'night');
    } else if (lower === 'l') {
      toggleLabels();
    } else if (lower === 'f') {
      action('toggleFullscreen');
    } else if (k === 'Escape') {
      closeTopLayer();
    } else if (k === '?' || lower === '/') {
      toggleHelp(true);
    } else {
      handled = false;
    }
    if (handled) ev.preventDefault();
  }

  function closeTopLayer() {
    if (S.els.help && !S.els.help.hidden) { toggleHelp(false); return; }
    if (S.selected) { action('selectPart', null); return; }
    if (S.mode !== 'overall') action('setMode', 'overall');
  }

  function toggleHelp(open) {
    var el = S.els.help;
    if (!el) return;
    var next = !!open;
    if (el.hidden === !next) return;
    el.hidden = !next;
    if (next) {
      if (S.els.helpClose && S.els.helpClose.focus) S.els.helpClose.focus({ preventScroll: true });
    } else if (S.els.btnHelp && S.els.btnHelp.focus) {
      S.els.btnHelp.focus({ preventScroll: true });
    }
    computeSafeRects();
  }

  function toggleLabels() {
    var a = S.app && S.app.actions;
    if (a && typeof a.toggleLabels === 'function') { a.toggleLabels(); return; }
    if (a && typeof a.setLabelsVisible === 'function') { a.setLabelsVisible(!S.labelsOn); return; }
    applyLabels(!S.labelsOn);
  }

  /* ==========================================================================
   * APP action helpers
   * ========================================================================*/
  function action(name, arg) {
    var a = S.app && S.app.actions;
    if (!a || typeof a[name] !== 'function') return undefined;
    try { return a[name](arg); } catch (err) { console.warn('[ui] action ' + name + ' failed', err); }
    return undefined;
  }
  function focusPart(id) {
    var a = S.app && S.app.actions;
    if (a && typeof a.focusPart === 'function') { a.focusPart(id); return; }
    action('selectPart', id);
  }

  /* ==========================================================================
   * state application (called by boot through HUD.*)
   * ========================================================================*/
  function applyMode(mode) {
    mode = (mode === 'cut' || mode === 'explode') ? mode : 'overall';
    S.mode = mode;
    var b = doc.body;
    b.classList.toggle('mode-overall', mode === 'overall');
    b.classList.toggle('mode-cut', mode === 'cut');
    b.classList.toggle('mode-explode', mode === 'explode');
    b.setAttribute('data-mode', mode);
    if (S.els.modes) {
      all('.mode', S.els.modes).forEach(function (btn) {
        var on = btn.getAttribute('data-mode') === mode;
        btn.classList.toggle('on', on);
        btn.setAttribute('aria-selected', on ? 'true' : 'false');
        btn.tabIndex = on ? 0 : -1;
      });
    }
    if (S.els.index) S.els.index.hidden = (mode === 'overall');
    if (S.els.cutbar) S.els.cutbar.hidden = (mode !== 'cut');
    if (mode === 'cut') applyCut(S.app && S.app.state ? S.app.state.cut : S.cut);
    queueMeasure();
    rebuildLabels();
  }

  function applyView(id) {
    if (!id) return;
    S.view = id;
    if (S.els.views) {
      all('.view', S.els.views).forEach(function (btn) {
        var on = btn.getAttribute('data-view') === id;
        btn.classList.toggle('on', on);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    }
  }

  function applyCut(v) {
    v = clamp(num(v), 0, 1);
    S.cut = v;
    var pct = Math.round(v * 100);
    if (S.els.cutRange && !S.draggingCut) S.els.cutRange.value = String(pct);
    if (S.els.cutFill) S.els.cutFill.style.width = pct + '%';
    if (S.els.cutVal) S.els.cutVal.textContent = String(pct);
    else if (S.els.cutOut) S.els.cutOut.textContent = pct + '%';
  }

  function applyExplode(t) {
    /* mode tab + labels already communicate the exploded state; nothing to
       mirror numerically (no fake telemetry). */
  }

  function applyTime(mode) {
    S.time = mode === 'night' ? 'night' : 'day';
    doc.body.classList.toggle('time-night', S.time === 'night');
    if (S.els.timeSeg) {
      all('button[data-time]', S.els.timeSeg).forEach(function (btn) {
        var on = btn.getAttribute('data-time') === S.time;
        btn.classList.toggle('on', on);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    }
  }

  function applyLabels(on) {
    S.labelsOn = !!on;
    doc.body.classList.toggle('labels-off', !S.labelsOn);
    if (S.els.btnLabels) {
      S.els.btnLabels.classList.toggle('off', !S.labelsOn);
      S.els.btnLabels.setAttribute('aria-pressed', S.labelsOn ? 'true' : 'false');
    }
  }

  function applySelected(id) {
    id = id || null;
    if (id && !entryOf(id)) id = null;
    S.selected = id;
    applySelectionClasses();
    if (id) showDetail(id);
    else hideDetail();
    computeSafeRects();
  }

  function applySelectionClasses() {
    if (S.els.indexGroups) {
      all('.idx-row', S.els.indexGroups).forEach(function (r) {
        r.classList.toggle('sel', r.getAttribute('data-id') === S.selected);
      });
    }
    for (var k in S.labels) {
      var rec = S.labels[k];
      if (rec && rec.chip) rec.chip.classList.toggle('sel', k === S.selected);
    }
  }

  function setHover(id) {
    id = id || null;
    if (S.hover === id) return;
    S.hover = id;
    if (S.els.indexGroups) {
      all('.idx-row', S.els.indexGroups).forEach(function (r) {
        r.classList.toggle('hov', r.getAttribute('data-id') === S.hover);
      });
    }
    for (var k in S.labels) {
      var rec = S.labels[k];
      if (rec && rec.chip) rec.chip.classList.toggle('hot', k === S.hover);
    }
  }

  /* ==========================================================================
   * registry (parts) -> structure index + label eligibility
   * ========================================================================*/
  function registryChanged() {
    var app = S.app;
    var parts = (app && app.parts) || {};
    var order = (app && app.partsOrder && app.partsOrder.length) ? app.partsOrder : Object.keys(parts);
    S.regSig = order.length + ':' + (order[0] || '') + ':' + (order[order.length - 1] || '');
    buildIndex();
    rebuildLabels();
    if (S.selected && !parts[S.selected]) applySelected(null);
    queueMeasure();
  }

  function buildIndex() {
    var app = S.app;
    var parts = (app && app.parts) || {};
    var order = (app && app.partsOrder && app.partsOrder.length) ? app.partsOrder : Object.keys(parts);
    var entries = [];
    for (var i = 0; i < order.length; i++) {
      var id = order[i];
      var m = parts[id];
      if (!m) continue;
      var indexable = m.index !== false;
      var section = m.section || (indexable ? '结构' : '发射场');
      entries.push({ id: id, meta: m, num: null, section: section, indexable: indexable });
    }
    /* number rows in grouped display order, so a manual reads 01..n top to bottom */
    var sectionOrder = [];
    var bySection = {};
    entries.forEach(function (e) {
      if (!e.indexable) return;
      if (!bySection[e.section]) { bySection[e.section] = []; sectionOrder.push(e.section); }
      bySection[e.section].push(e);
    });
    var numMap = {};
    var n = 0;
    sectionOrder.forEach(function (sec) {
      bySection[sec].forEach(function (e) {
        n++;
        e.num = pad2(n);
        numMap[e.id] = e.num;
      });
    });
    S.entries = entries;
    S.numOf = numMap;
    S.indexEntries = entries.filter(function (e) { return e.indexable; });
    if (S.els.indexCount) S.els.indexCount.textContent = S.indexEntries.length ? (S.indexEntries.length + ' 项') : '';
    renderIndex();
  }

  function renderIndex() {
    var box = S.els.indexGroups;
    if (!box) return;
    while (box.firstChild) box.removeChild(box.firstChild);
    if (!S.indexEntries.length) {
      var empty = doc.createElement('div');
      empty.className = 'idx-empty';
      var eb = doc.createElement('b');
      eb.textContent = '结构索引暂不可用';
      var es = doc.createElement('span');
      es.textContent = '当前预览未载入箭体与载荷模块。';
      empty.appendChild(eb);
      empty.appendChild(es);
      box.appendChild(empty);
      return;
    }
    var groups = {};
    var order = [];
    S.indexEntries.forEach(function (e) {
      if (!groups[e.section]) { groups[e.section] = []; order.push(e.section); }
      groups[e.section].push(e);
    });
    order.forEach(function (sec) {
      var g = doc.createElement('div');
      g.className = 'idx-grp';
      var head = doc.createElement('div');
      head.className = 'idx-grp-title';
      var hs = doc.createElement('span');
      hs.textContent = sec;
      var hc = doc.createElement('span');
      hc.textContent = String(groups[sec].length);
      head.appendChild(hs);
      head.appendChild(hc);
      g.appendChild(head);
      groups[sec].forEach(function (e) { g.appendChild(makeIndexRow(e)); });
      box.appendChild(g);
    });
    applySelectionClasses();
  }

  function makeIndexRow(e) {
    var b = doc.createElement('button');
    b.type = 'button';
    b.className = 'idx-row';
    b.setAttribute('data-id', e.id);
    var num = doc.createElement('span');
    num.className = 'idx-num';
    num.textContent = e.num || '';
    var zh = doc.createElement('span');
    zh.className = 'idx-zh';
    zh.textContent = e.meta.zh || e.id;
    var en = doc.createElement('span');
    en.className = 'idx-en';
    en.textContent = e.meta.en || '';
    b.appendChild(num);
    b.appendChild(zh);
    b.appendChild(en);
    b.addEventListener('click', function () { focusPart(e.id); });
    b.addEventListener('mouseenter', function () { setHover(e.id); });
    b.addEventListener('mouseleave', function () { setHover(null); });
    b.addEventListener('focus', function () { setHover(e.id); });
    b.addEventListener('blur', function () { setHover(null); });
    return b;
  }

  /* ==========================================================================
   * bar detail file
   * ========================================================================*/
  function showDetail(id) {
    var e = entryOf(id);
    if (!e) { hideDetail(); return; }
    var el = S.els.detail;
    if (!el) return;
    if (S.els.detailNum) S.els.detailNum.textContent = e.num || '';
    if (S.els.detailSection) S.els.detailSection.textContent = e.meta.section || '结构';
    if (S.els.detailZh) S.els.detailZh.textContent = e.meta.zh || id;
    if (S.els.detailEn) S.els.detailEn.textContent = e.meta.en || '';
    if (S.els.detailDesc) S.els.detailDesc.textContent = e.meta.desc || '该部件的说明文字尚未载入。';
    var dl = S.els.detailSpecs;
    if (dl) {
      while (dl.firstChild) dl.removeChild(dl.firstChild);
      var specs = e.meta.specs || [];
      specs.forEach(function (pair) {
        if (!pair || pair.length < 2) return;
        var row = doc.createElement('div');
        row.className = 'row';
        var dt = doc.createElement('dt');
        dt.textContent = pair[0];
        var dd = doc.createElement('dd');
        dd.textContent = pair[1];
        row.appendChild(dt);
        row.appendChild(dd);
        dl.appendChild(row);
      });
      dl.hidden = specs.length === 0;
    }
    var illustrative = e.meta.illustrative === true ||
      PAYLOAD_IDS.indexOf(id) >= 0 ||
      (e.meta.section || '').indexOf('探测') >= 0;
    if (S.els.detailNote) {
      S.els.detailNote.hidden = !illustrative;
      S.els.detailNote.textContent = illustrative ? '科普示意' : '';
    }
    el.hidden = false;
    doc.body.classList.add('has-detail');
    applySelectionClasses();
    computeSafeRects();
    queueMeasure();
  }

  function hideDetail() {
    var el = S.els.detail;
    if (!el || el.hidden) return;
    el.hidden = true;
    doc.body.classList.remove('has-detail');
    computeSafeRects();
    queueMeasure();
  }

  function entryOf(id) {
    for (var i = 0; i < S.entries.length; i++) if (S.entries[i].id === id) return S.entries[i];
    return null;
  }

  /* ==========================================================================
   * 3-D projected callout labels
   * ========================================================================*/
  function rebuildLabels() {
    var chips = S.els.chips;
    var svg = S.els.leaders;
    if (!chips || !svg) return;
    for (var k in S.labels) {
      var old = S.labels[k];
      if (old.chip && old.chip.parentNode) old.chip.parentNode.removeChild(old.chip);
      if (old.line && old.line.parentNode) old.line.parentNode.removeChild(old.line);
      if (old.dot && old.dot.parentNode) old.dot.parentNode.removeChild(old.dot);
    }
    S.labels = {};
    S.labelOrder = [];
    measureSvg();
    var app = S.app;
    if (!app || !app.parts) return;
    var eligible = [];
    S.entries.forEach(function (e) {
      var m = e.meta;
      if (!m || typeof m.anchor !== 'function') return;
      var modes = m.modes || ['cut', 'explode'];
      if (modes.indexOf(S.mode) < 0) return;
      eligible.push(e);
    });
    eligible = roundRobin(eligible);
    eligible.forEach(function (e, i) {
      var rec = makeLabel(e, i);
      S.labels[e.id] = rec;
      S.labelOrder.push(e.id);
    });
    remeasureLabels();
    computeSafeRects();
    applySelectionClasses();
  }

  function roundRobin(list) {
    var groups = {};
    var order = [];
    list.forEach(function (e) {
      var sec = (e.meta.section || '结构');
      if (!groups[sec]) { groups[sec] = []; order.push(sec); }
      groups[sec].push(e);
    });
    var out = [];
    var idx = 0;
    var guard = 0;
    while (out.length < list.length && guard < 400) {
      var added = false;
      for (var i = 0; i < order.length; i++) {
        var g = groups[order[i]];
        if (g[idx]) { out.push(g[idx]); added = true; }
      }
      if (!added) break;
      idx++; guard++;
    }
    return out;
  }

  function makeLabel(e, i) {
    var chip = doc.createElement('button');
    chip.type = 'button';
    chip.className = 'lbl off';
    chip.setAttribute('data-id', e.id);
    chip.setAttribute('aria-label', (e.meta.zh || e.id) + (e.meta.en ? ' ' + e.meta.en : ''));
    var n = doc.createElement('span');
    if (e.num) { n.className = 'n'; n.textContent = e.num; }
    else { n.className = 'n dot'; }
    var zh = doc.createElement('span');
    zh.className = 'zh';
    zh.textContent = e.meta.zh || e.id;
    chip.appendChild(n);
    chip.appendChild(zh);
    chip.style.animationDelay = (i * 34) + 'ms';
    chip.addEventListener('click', function (ev) {
      ev.stopPropagation();
      action('selectPart', e.id);
    });
    chip.addEventListener('mouseenter', function () { setHover(e.id); });
    chip.addEventListener('mouseleave', function () { setHover(null); });
    S.els.chips.appendChild(chip);

    var line = svgEl('polyline');
    line.setAttribute('visibility', 'hidden');
    S.els.leaders.appendChild(line);
    var dot = svgEl('circle');
    dot.setAttribute('r', '2.5');
    dot.setAttribute('visibility', 'hidden');
    S.els.leaders.appendChild(dot);
    return { e: e, i: i, chip: chip, line: line, dot: dot, w: 0, h: 24 };
  }

  function remeasureLabels() {
    for (var k in S.labels) {
      var rec = S.labels[k];
      if (!rec || !rec.chip) continue;
      var r = rec.chip.getBoundingClientRect();
      if (r.width > 1) { rec.w = Math.round(r.width); rec.h = Math.round(r.height) || 24; }
      else if (!rec.w) {
        var z = (rec.e.meta.zh || '').length;
        rec.w = Math.max(56, z * 13 + 34);
        rec.h = 24;
      }
    }
  }

  function measureSvg() {
    var svg = S.els.leaders;
    if (!svg) return;
    var w = window.innerWidth, h = window.innerHeight;
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    svg.setAttribute('width', String(w));
    svg.setAttribute('height', String(h));
  }

  function computeSafeRects() {
    var list = [];
    var add = function (el, pad) {
      if (!isEl(el)) return;
      var r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      var p = (pad === undefined) ? 8 : pad;
      list.push({ x: r.left - p, y: r.top - p, w: r.width + p * 2, h: r.height + p * 2 });
    };
    add(S.els.masthead);
    add(S.els.utilities);
    add(S.els.index);
    add(S.els.plate);
    add(S.els.dock);
    add(S.els.stamp);
    add(S.els.help, 0);
    add(S.els.detail);
    S.safe = list;

    /* hard label safe band: below the identity / utility bars, above the dock,
       never within 20 px of the viewport edges. */
    var w = window.innerWidth, h = window.innerHeight;
    var band = { left: 20, top: 96, right: w - 20, bottom: h - 20 };
    var raiseTop = function (el) {
      if (!isEl(el)) return;
      var r = el.getBoundingClientRect();
      if (r.height > 2) band.top = Math.max(band.top, r.bottom + 16);
    };
    raiseTop(S.els.masthead);
    raiseTop(S.els.utilities);
    if (isEl(S.els.dock)) {
      var dr = S.els.dock.getBoundingClientRect();
      if (dr.height > 2) band.bottom = Math.min(band.bottom, dr.top - 16);
    }
    S.band = band;
  }

  function labelPriorityOrder() {
    var out = [];
    var push = function (id) {
      if (id && S.labels[id] && out.indexOf(id) < 0) out.push(id);
    };
    push(S.selected);
    push(S.hover);
    var items = [];
    for (var i = 0; i < S.labelOrder.length; i++) {
      var rec = S.labels[S.labelOrder[i]];
      if (rec) items.push(rec);
    }
    items.sort(function (a, b) {
      var ra = labelRank(a), rb = labelRank(b);
      if (ra !== rb) return ra - rb;
      return a.i - b.i;
    });
    for (var j = 0; j < items.length; j++) push(items[j].e.id);
    return out;
  }

  function labelRank(rec) {
    var id = rec.e.id;
    var meta = rec.e.meta || {};
    var rank = 2000;
    var modeP = LABEL_PRIORITY[S.mode] || LABEL_PRIORITY.overall;
    var mi = modeP.indexOf(id);
    if (mi >= 0) rank = Math.min(rank, 300 + mi * 8);
    var viewP = VIEW_BOOST[S.view] || [];
    var vi = viewP.indexOf(id);
    if (vi >= 0) rank = Math.min(rank, 30 + vi * 6);
    /* interior / secondary anchors rank after structural index parts, except in
       the cutaway where tank + plumbing labels are the point of the section */
    if (meta.index === false && S.mode !== 'cut') rank += 300;
    return rank;
  }

  function hideLabel(rec) {
    if (!rec) return;
    rec.chip.classList.add('off');
    rec.line.setAttribute('visibility', 'hidden');
    rec.dot.setAttribute('visibility', 'hidden');
  }

  function showLabel(rec, pos, sx, sy, cw, ch) {
    var chip = rec.chip;
    chip.classList.remove('off');
    chip.style.transform = 'translate3d(' + Math.round(pos.x) + 'px,' + Math.round(pos.y) + 'px,0)';
    var ax = Math.round(sx), ay = Math.round(sy);
    var by = Math.round(pos.y + ch / 2);
    var edge = Math.round(pos.side > 0 ? pos.x - 7 : pos.x + cw + 7);
    var tip = Math.round(pos.side > 0 ? pos.x : pos.x + cw);
    rec.line.setAttribute('points', ax + ',' + ay + ' ' + edge + ',' + by + ' ' + tip + ',' + by);
    rec.line.setAttribute('visibility', 'visible');
    rec.dot.setAttribute('cx', String(ax));
    rec.dot.setAttribute('cy', String(ay));
    rec.dot.setAttribute('visibility', 'visible');
    var sel = rec.e.id === S.selected;
    chip.classList.toggle('sel', sel);
    chip.classList.toggle('hot', rec.e.id === S.hover);
    rec.line.style.stroke = sel ? 'var(--red)' : '';
    rec.dot.setAttribute('r', sel ? '3.2' : '2.5');
  }

  function hitsRects(x, y, w, h, rects, pad) {
    for (var i = 0; i < rects.length; i++) {
      var r = rects[i];
      if (x < r.x + r.w + pad && x + w + pad > r.x && y < r.y + r.h + pad && y + h + pad > r.y) return true;
    }
    return false;
  }

  function projectLabels() {
    var T = window.THREE;
    var app = S.app;
    if (!T || !app || !app.camera) return;
    var cam = app.camera;
    cam.updateMatrixWorld();
    var w = window.innerWidth, h = window.innerHeight;
    if (S._v1 === null) { S._v1 = new T.Vector3(); S._v2 = new T.Vector3(); }
    var v = S._v1, q = S._v2;
    var max = isMobile() ? 3 : (S.mode === 'overall' ? 4 : (S.view === 'payload' ? 3 : 6));
    S.maxLabels = max;
    var order = labelPriorityOrder();
    var placed = [];
    var placedLeft = 0, placedRight = 0;
    var count = 0;
    for (var i = 0; i < order.length; i++) {
      var id = order[i];
      var rec = S.labels[id];
      if (!rec) continue;
      var m = rec.e.meta;
      var a;
      try { a = m.anchor(); } catch (err) { hideLabel(rec); continue; }
      if (!a || typeof a.x !== 'number') { hideLabel(rec); continue; }
      /* in front of the camera? */
      v.copy(a).applyMatrix4(cam.matrixWorldInverse);
      if (v.z > -0.4) { hideLabel(rec); continue; }
      q.copy(a).project(cam);
      if (q.z > 1) { hideLabel(rec); continue; }
      var sx = (q.x * 0.5 + 0.5) * w;
      var sy = (-q.y * 0.5 + 0.5) * h;
      /* anchor off-screen entirely -> no callout */
      if (sx < -10 || sx > w + 10 || sy < -10 || sy > h + 10) { hideLabel(rec); continue; }
      if (count >= max) { hideLabel(rec); continue; }
      var cw = rec.w || 88;
      var ch = rec.h || 24;
      var band = S.band || { left: 20, top: 96, right: w - 20, bottom: h - 20 };
      if (band.right - band.left < cw + 8 || band.bottom - band.top < ch + 8) { hideLabel(rec); continue; }
      /* balance callouts around the rocket axis: near-centre anchors go to the
         emptier side so leaders fan out like a technical drawing */
      var centerX = w * 0.5;
      var side0;
      if (Math.abs(sx - centerX) < 150) {
        side0 = (placedLeft <= placedRight) ? -1 : 1;
      } else {
        side0 = sx < centerX ? -1 : 1;
      }
      var baseY = sy - ch * 0.5;
      /* fan out: try near placement first, then push the chip further into open
         space so dense clusters (payload view) never sit on the subject */
      var gaps = (S.view === 'payload') ? [26, 104, 182] : [20, 86, 152];
      var offs = [0, -28, 28, -56, 56, -84, 84, -112, 112, -140, 140];
      var best = null;
      for (var pass = 0; pass < 2 && !best; pass++) {
        var side = pass === 0 ? side0 : -side0;
        for (var gi = 0; gi < gaps.length && !best; gi++) {
          var gap = gaps[gi];
          for (var oi = 0; oi < offs.length; oi++) {
            var x = side > 0 ? (sx + gap) : (sx - gap - cw);
            var y = baseY + offs[oi];
            x = clamp(x, band.left, band.right - cw);
            y = clamp(y, band.top, band.bottom - ch);
            if (hitsRects(x, y, cw, ch, S.safe, 0)) continue;
            if (hitsRects(x, y, cw, ch, placed, 0)) continue;
            best = { x: x, y: y, side: side };
            break;
          }
        }
      }
      if (!best) { hideLabel(rec); continue; }
      showLabel(rec, best, sx, sy, cw, ch);
      placed.push({ x: best.x - 6, y: best.y - 6, w: cw + 12, h: ch + 12 });
      if (best.side < 0) placedLeft++; else placedRight++;
      count++;
    }
  }

  /* ==========================================================================
   * view dock (from APP.views)
   * ========================================================================*/
  function buildViews() {
    var box = S.els.views;
    if (!box) return;
    while (box.firstChild) box.removeChild(box.firstChild);
    var views = (S.app && S.app.views && S.app.views.length) ? S.app.views : DEFAULT_VIEWS;
    views.forEach(function (v, i) {
      var b = doc.createElement('button');
      b.type = 'button';
      b.className = 'view';
      b.setAttribute('data-view', v.id);
      b.setAttribute('aria-pressed', 'false');
      b.textContent = v.zh || v.id;
      var title = (v.en ? v.en : '') + ' · 数字键 ' + (i + 1);
      b.title = title;
      b.setAttribute('aria-label', (v.zh || v.id) + ' ' + (v.en || ''));
      b.addEventListener('click', function () { action('setView', v.id); });
      box.appendChild(b);
    });
  }

  /* ==========================================================================
   * toasts
   * ========================================================================*/
  function pushToast(text) {
    var box = S.els.toasts;
    if (!box || !text) return;
    while (box.children.length >= 3) box.removeChild(box.firstChild);
    var t = doc.createElement('div');
    t.className = 'toast';
    t.textContent = text;
    box.appendChild(t);
    window.setTimeout(function () { t.classList.add('out'); }, 2900);
    window.setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 3400);
  }

  /* ==========================================================================
   * layout measurement (fixed masthead/dock heights -> CSS custom properties)
   * ========================================================================*/
  function queueMeasure() {
    if (S.measureQueued) return;
    S.measureQueued = true;
    window.requestAnimationFrame(function () {
      S.measureQueued = false;
      measure();
    });
  }

  function measure() {
    var rs = doc.documentElement.style;
    var mast = S.els.masthead;
    if (isEl(mast)) {
      var mr = mast.getBoundingClientRect();
      if (mr.height > 2) rs.setProperty('--mast-h', Math.round(mr.bottom) + 'px');
    }
    var dock = S.els.dock;
    if (isEl(dock)) {
      var dr = dock.getBoundingClientRect();
      if (dr.height > 2) rs.setProperty('--dock-h', Math.round(dr.height) + 'px');
    }
    var plate = S.els.plate;
    if (isEl(plate)) {
      var pr = plate.getBoundingClientRect();
      rs.setProperty('--plate-h', Math.round(pr.height) + 'px');
    }
    measureSvg();
    computeSafeRects();
    remeasureLabels();
  }

  function onResize() {
    updateMobileClass();
    queueMeasure();
    rebuildLabels();
  }

  function updateMobileClass() {
    doc.body.classList.toggle('is-mobile', isMobile());
  }

  /* ==========================================================================
   * per-frame tick: registry/state reconciliation + label projection
   * ========================================================================*/
  function tick(dt) {
    var app = S.app;
    if (!app || Q.noui) return;
    /* reconcile on real wall time, not accumulated frame dt: headless / slow
       GPUs can render under 1 fps and must still pick up boot flag state. */
    var now = (window.performance && window.performance.now) ? window.performance.now() : Date.now();
    if (!S.lastSyncMs) S.lastSyncMs = now;
    if (now - S.lastSyncMs > 250) {
      S.lastSyncMs = now;
      checkRegistry();
      syncState();
    }
    if (S.labelsOn && !Q.nolabels) projectLabels();
  }

  function checkRegistry() {
    var app = S.app;
    if (!app || !app.parts) return;
    var parts = app.parts;
    var order = (app.partsOrder && app.partsOrder.length) ? app.partsOrder : Object.keys(parts);
    var sig = order.length + ':' + (order[0] || '') + ':' + (order[order.length - 1] || '');
    if (sig !== S.regSig) registryChanged();
  }

  function syncState() {
    var app = S.app;
    var st = (app && app.state) || {};
    if (typeof st.mode === 'string' && st.mode !== S.mode) applyMode(st.mode);
    if (typeof st.view === 'string' && st.view !== S.view) applyView(st.view);
    if (typeof st.time === 'string' && st.time !== S.time) applyTime(st.time);
    if (typeof st.labels === 'boolean' && st.labels !== S.labelsOn) applyLabels(st.labels);
    if (typeof st.cut === 'number' && Math.abs(st.cut - S.cut) > 0.002) applyCut(st.cut);
    var sel = st.selected || null;
    if (sel !== S.selected) applySelected(sel);
  }

})();
