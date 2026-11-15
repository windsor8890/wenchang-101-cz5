/* ============================================================================
 * 80-cinematic.js — cinematic camera tour + 24-hour light cycle.
 * Owner: Lead.
 *
 * A 92 s continuous film:
 *   dawn — orbit from far to near — whole vehicle — cutaway — payload close-up —
 *   stage separation — sunset / dusk / night — pull-away.
 *
 * Adds an overlay with letterboxing, chapter captions, a 24 h clock, timeline
 * and transport controls.  All camera/state changes go through APP.cinema.
 * ==========================================================================*/
(function () {
  'use strict';

  const DURATION = 118;
  const A = (x) => Math.abs(x);
  const PI = Math.PI;

  window.buildCinematic = function (APP) {
    const Q = window.Q || {};
    const HUD = window.HUD || null;
    const reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    /* ======================================================================
     * Timeline data
     * ====================================================================*/
    const CHAPTERS = [
      { t: 0, zh: '黎明之前', en: 'BEFORE FIRST LIGHT', line: '南海的夜色尚未退去，101 工位的灯火先醒来。' },
      { t: 10, zh: '日出', en: 'SUNRISE', line: '晨光越过海平面，塔架与箭体被重新描出。' },
      { t: 24, zh: '环绕', en: 'ORBIT', line: '由远及近，镜头绕行 101 工位。' },
      { t: 38, zh: '剖视', en: 'CUTAWAY', line: '切开箭体，低温贮箱、级间与发动机依次显形。' },
      { t: 46, zh: '载荷', en: "CHANG'E-7", line: '整流罩内，轨道器、着陆器、巡视器与飞跃器静候奔月。' },
      { t: 58, zh: '分解', en: 'SEPARATION', line: '一级、二级、上面级与载荷分层展开。' },
      { t: 70, zh: '暮色', en: 'DUSK', line: '夕阳退场，泛光灯接管发射场。' },
      { t: 82, zh: '夜色', en: 'NIGHTFALL', line: '镜头拉远，灯火与星海之间，等待点火。' },
      { t: 88, zh: '点火升空', en: 'IGNITION / LIFTOFF', line: '倒计时归零，长五托举嫦娥七号离开 101 工位。' }
    ];

    // camera keyframes: target is world [x,y,z]; az/elev in degrees.
    // hour is a continuous clock (values >24 are the following morning).
    const KF = [
      { t: 0,  target: [0, 40, 0], az: 34,  elev: 16, dist: 430, fov: 42, hour: 5.90, cut: 0, explode: 0, mode: 'overall' },
      { t: 8,  target: [0, 39, 0], az: 50,  elev: 14, dist: 380, fov: 40, hour: 6.30, cut: 0, explode: 0, mode: 'overall' },
      { t: 16, target: [0, 38, 0], az: 74,  elev: 11, dist: 300, fov: 38, hour: 7.00, cut: 0, explode: 0, mode: 'overall' },
      { t: 24, target: [0, 38, 0], az: 99,  elev: 8,  dist: 220, fov: 37, hour: 8.50, cut: 0, explode: 0, mode: 'overall' },
      { t: 32, target: [0, 40, 0], az: 126, elev: 6,  dist: 155, fov: 36, hour: 10.20, cut: 0, explode: 0, mode: 'overall' },
      { t: 38, target: [0, 41, 0], az: 108, elev: 7,  dist: 116, fov: 35, hour: 11.70, cut: 0.15, explode: 0, mode: 'cut' },
      { t: 42, target: [0, 41, 0], az: 102, elev: 7,  dist: 110, fov: 35, hour: 12.80, cut: 1, explode: 0, mode: 'cut' },
      { t: 46, target: [0, 64, 0], az: 98,  elev: 4,  dist: 46,  fov: 33, hour: 14.00, cut: 1, explode: 0, mode: 'cut' },
      { t: 51, target: [0, 63, 0], az: 78,  elev: 6,  dist: 40,  fov: 32, hour: 15.70, cut: 1, explode: 0, mode: 'cut' },
      { t: 55, target: [0, 52, 0], az: 45,  elev: 8,  dist: 100, fov: 35, hour: 17.00, cut: 0.90, explode: 0, mode: 'cut' },
      { t: 60, target: [0, 46, 0], az: 18,  elev: 8,  dist: 190, fov: 38, hour: 18.10, cut: 0, explode: 0.75, mode: 'explode' },
      { t: 66, target: [0, 47, 0], az: -16, elev: 7,  dist: 155, fov: 38, hour: 18.60, cut: 0, explode: 1, mode: 'explode' },
      { t: 71, target: [0, 45, 0], az: -30, elev: 7,  dist: 135, fov: 38, hour: 19.10, cut: 0, explode: 1, mode: 'explode' },
      { t: 76, target: [0, 42, 0], az: -6,  elev: 9,  dist: 160, fov: 38, hour: 20.20, cut: 0, explode: 0.5, mode: 'overall' },
      { t: 82, target: [0, 40, 0], az: 8,   elev: 11, dist: 250, fov: 39, hour: 26.20, cut: 0, explode: 0, mode: 'overall' },
      { t: 87, target: [0, 38, 0], az: 7,   elev: 8,  dist: 180, fov: 40, hour: 28.20, cut: 0, explode: 0, mode: 'overall' },
      { t: 92, target: [0, 42, 0], az: 6,   elev: 3,  dist: 138, fov: 42, hour: 28.80, cut: 0, explode: 0, mode: 'overall' },
      { t: DURATION, target: [0, 42, 0], az: 6, elev: 3, dist: 138, fov: 42, hour: 28.80, cut: 0, explode: 0, mode: 'overall' }
    ];

    const clamp01 = (v) => v < 0 ? 0 : v > 1 ? 1 : v;
    const lerp = (a, b, u) => a + (b - a) * u;
    const smooth = (u) => u * u * (3 - 2 * u);
    const smoother = (u) => u * u * u * (u * (u * 6 - 15) + 10);

    function sampleAt(t) {
      t = Math.max(0, Math.min(DURATION, t));
      let i = 0;
      for (; i < KF.length - 1; i++) {
        if (t <= KF[i + 1].t) break;
      }
      const a = KF[i], b = KF[Math.min(i + 1, KF.length - 1)];
      const span = Math.max(0.001, b.t - a.t);
      const u = smoother(clamp01((t - a.t) / span));
      const cam = {
        target: [lerp(a.target[0], b.target[0], u), lerp(a.target[1], b.target[1], u), lerp(a.target[2], b.target[2], u)],
        az: lerp(a.az, b.az, u),
        elev: lerp(a.elev, b.elev, u),
        dist: lerp(a.dist, b.dist, u),
        fov: lerp(a.fov, b.fov, u)
      };
      // gentle breathing / handheld presence, stronger in the wide shots
      if (!reduced) {
        const m = 0.20 + 0.80 * clamp01(cam.dist / 420);
        cam.az += (Math.sin(t * 0.37) * 0.42 + Math.sin(t * 0.13 + 1.7) * 0.25) * m;
        cam.elev += Math.sin(t * 0.29 + 0.8) * 0.11 * m;
        cam.target[1] += Math.sin(t * 0.21) * 0.09 * m;
      }
      return {
        cam,
        cut: clamp01(lerp(a.cut, b.cut, u)),
        explode: clamp01(lerp(a.explode, b.explode, u)),
        hour: lerp(a.hour, b.hour, u),
        mode: a.mode
      };
    }

    function chapterAt(t) {
      let idx = 0;
      for (let i = 0; i < CHAPTERS.length; i++) if (t >= CHAPTERS[i].t) idx = i;
      return idx;
    }

    function clockText(hour) {
      const next = hour >= 24;
      let h = ((hour % 24) + 24) % 24;
      const hh = Math.floor(h);
      const mm = Math.floor((h - hh) * 60);
      const phase =
        h < 4.7 ? '深夜' : h < 6.1 ? '黎明' : h < 8.8 ? '清晨' :
        h < 11.2 ? '上午' : h < 13.6 ? '正午' : h < 16.4 ? '午后' :
        h < 18.2 ? '黄昏' : h < 19.8 ? '暮色' : h < 22.6 ? '夜间' : '深夜';
      return {
        time: (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm,
        phase,
        next
      };
    }

    function timecode(t) {
      const s = Math.max(0, Math.min(DURATION, t));
      const m = Math.floor(s / 60);
      const ss = Math.floor(s % 60);
      return (m < 10 ? '0' : '') + m + ':' + (ss < 10 ? '0' : '') + ss;
    }

    /* ======================================================================
     * Styles & DOM
     * ====================================================================*/
    const css = `
    #btnCinema .cine-tri{width:0;height:0;border-left:4px solid var(--red);border-top:3px solid transparent;border-bottom:3px solid transparent;display:inline-block;margin-right:2px}
    body.cine #hud,body.cine #labels{opacity:0!important;visibility:hidden!important;pointer-events:none!important}
    body.cine #stage{cursor:default}
    #cine{position:fixed;inset:0;z-index:120;display:none;pointer-events:none;color:#f1ecdf;font-family:var(--sans);opacity:0;transition:opacity .7s ease}
    body.cine #cine{display:block;opacity:1}
    #cine .cine-bar{position:absolute;left:0;right:0;background:#070908;pointer-events:auto}
    #cine .cine-bar.top{top:0;height:8.4vh;min-height:54px;display:flex;align-items:center;justify-content:space-between;padding:0 clamp(20px,4.8vw,64px);border-bottom:1px solid rgba(239,233,220,.08)}
    #cine .cine-bar.bottom{bottom:0;height:12vh;min-height:82px;padding:0 clamp(20px,4.8vw,64px);display:flex;align-items:center;gap:22px}
    #cine .cine-brand{display:flex;align-items:center;gap:14px;font-family:var(--serif);font-size:15px;letter-spacing:.12em}
    #cine .cine-brand i{display:block;width:18px;height:18px;border:1px solid rgba(241,236,223,.45);border-radius:50%;position:relative}
    #cine .cine-brand i:after{content:"";position:absolute;width:10px;height:10px;background:#f1ecdf;border-radius:50%;left:-3px;top:4px}
    #cine .cine-brand small{display:block;margin-top:4px;font-family:var(--sans);font-size:8px;letter-spacing:.22em;color:#8f9386;text-transform:uppercase}
    #cine .cine-clock{display:flex;align-items:center;gap:14px;text-align:right}
    #cine .cine-clock .clock-copy small{display:block;font-size:8px;letter-spacing:.18em;color:#989b8d}
    #cine .cine-clock .clock-val{font-size:22px;letter-spacing:.04em;line-height:1;font-variant-numeric:tabular-nums;color:#f1ecdf}
    #cine .cine-clock .clock-val em{font-style:normal;font-size:9px;color:var(--red);letter-spacing:.12em;margin-left:6px;vertical-align:middle}
    #cine .cine-clock .clock-phase{color:#c2c3b7;font-size:10px;letter-spacing:.1em;margin-top:5px}
    #cine .cine-sun{
      width:48px;height:24px;position:relative;flex:0 0 auto;
      border-top:1px solid rgba(241,236,223,.22);
      border-radius:50% 50% 0 0/100% 100% 0 0;
    }
    #cine .cine-sun i{position:absolute;width:5px;height:5px;border-radius:50%;background:var(--red);top:-3px;left:50%;transform:translateX(-50%);box-shadow:0 0 10px rgba(196,58,36,.6)}
    #cine .cine-caption{
      position:absolute;left:clamp(20px,5.2vw,72px);bottom:calc(12vh + 30px);
      max-width:min(600px,54vw);padding:18px 24px 17px;background:rgba(7,9,8,.66);
      border-left:2px solid var(--red);pointer-events:none;
      transition:opacity .5s ease,transform .5s ease
    }
    #cine .cine-caption.swap{opacity:0;transform:translateY(8px)}
    #cine .cine-kicker{display:flex;gap:11px;align-items:center;font-size:8px;letter-spacing:.22em;color:#a5a698;text-transform:uppercase}
    #cine .cine-kicker b{font-weight:400;color:var(--red)}
    #cine .cine-caption h2{font-family:var(--serif);font-weight:500;font-size:clamp(25px,2.6vw,40px);letter-spacing:.1em;line-height:1.2;margin:7px 0 7px;color:#f4efe3}
    #cine .cine-caption p{margin:0;font-size:11px;line-height:1.8;letter-spacing:.06em;color:#c9c8bb}

    #cine .cine-controls{display:flex;align-items:center;gap:18px;width:100%}
    #cine .cine-transport{display:flex;align-items:center;gap:10px;flex:0 0 auto}
    #cine .cine-btn{
      border:1px solid rgba(241,236,223,.32);background:transparent;color:#f1ecdf;
      height:30px;min-width:30px;padding:0 10px;font:10px var(--sans);letter-spacing:.08em;cursor:pointer;
      transition:.2s ease;
    }
    #cine .cine-btn:hover{border-color:var(--red);color:#fff;background:rgba(196,58,36,.12)}
    #cine .cine-btn.play{width:40px;min-width:40px;height:36px;border-color:rgba(241,236,223,.55);font-size:0}
    #cine .cine-btn.play .play-glyph{display:block;width:0;height:0;border-top:5px solid transparent;border-bottom:5px solid transparent;border-left:7px solid #f1ecdf;margin:auto}
    #cine .cine-btn.play.playing .play-glyph{width:7px;height:10px;border:0;border-left:2px solid #f1ecdf;border-right:2px solid #f1ecdf}
    #cine .cine-time{font:9px var(--sans);letter-spacing:.09em;color:#a8aa9d;white-space:nowrap;font-variant-numeric:tabular-nums}
    #cine .cine-speed{display:flex;align-items:center;gap:3px;flex:0 0 auto}
    #cine .cine-speed .spd-label{font-size:8px;letter-spacing:.16em;color:#858a7d;margin-right:5px}
    #cine .cine-spd{
      min-width:30px;height:24px;padding:0 4px;border:1px solid rgba(241,236,223,.20);
      background:transparent;color:#a8aa9d;font:9px var(--sans);letter-spacing:.03em;cursor:pointer;
      font-variant-numeric:tabular-nums;transition:.2s ease
    }
    #cine .cine-spd:hover{border-color:rgba(241,236,223,.55);color:#f1ecdf}
    #cine .cine-spd.on{border-color:var(--red);background:rgba(196,58,36,.18);color:#fff}
    #cine .cine-progress{position:relative;flex:1 1 auto;height:24px;display:flex;align-items:center;cursor:pointer}
    #cine .cine-progress:before{content:"";position:absolute;left:0;right:0;top:50%;height:1px;background:rgba(241,236,223,.18)}
    #cine .cine-fill{position:absolute;left:0;top:50%;height:1px;background:var(--red);width:0;pointer-events:none}
    #cine .cine-head{position:absolute;top:50%;left:0;width:2px;height:13px;background:#f1ecdf;transform:translate(-1px,-50%);pointer-events:none}
    #cine .cine-tick{position:absolute;top:50%;width:6px;height:6px;transform:translate(-50%,-50%);background:#070908;border:1px solid rgba(241,236,223,.5);padding:0;cursor:pointer;z-index:2}
    #cine .cine-tick:hover{border-color:var(--red)}
    #cine .cine-tick.on{background:var(--red);border-color:var(--red)}
    #cine .cine-exit{flex:0 0 auto}
    #cine .cine-end{
      position:absolute;left:50%;top:50%;transform:translate(-50%,-46%);width:min(520px,84vw);
      background:rgba(7,9,8,.90);border:1px solid rgba(241,236,223,.24);padding:34px 36px 28px;
      opacity:0;visibility:hidden;transition:opacity .6s ease,transform .6s ease;pointer-events:auto
    }
    #cine .cine-end.show{opacity:1;visibility:visible;transform:translate(-50%,-50%)}
    #cine .cine-end .end-kicker{font-size:8px;letter-spacing:.24em;color:#9b9d90;text-transform:uppercase}
    #cine .cine-end h2{font-family:var(--serif);font-weight:500;font-size:38px;letter-spacing:.12em;margin:16px 0 8px;color:#f4efe3}
    #cine .cine-end p{font-size:11px;line-height:1.9;letter-spacing:.08em;color:#b7b8ab;margin:0 0 24px}
    #cine .cine-end .end-actions{display:flex;gap:10px}
    #cine .cine-end .cine-btn{padding:0 18px;height:36px}
    #cine .cine-fade{position:absolute;inset:0;background:#050706;opacity:0;pointer-events:none}
    #cine .cine-help{position:absolute;right:clamp(20px,4.8vw,64px);bottom:calc(12vh + 10px);font-size:8px;letter-spacing:.12em;color:#858a7d;pointer-events:none}
    body.cine.reduced #cine *,body.cine.reduced #cine{transition:none!important}
    @media(max-width:760px){
      #cine .cine-bar.top{height:auto;min-height:54px;padding:11px 16px}
      #cine .cine-brand{font-size:12px;gap:9px}
      #cine .cine-brand small{display:none}
      #cine .cine-clock .clock-val{font-size:17px}
      #cine .cine-clock .clock-copy small{font-size:7px}
      #cine .cine-sun{display:none}
      #cine .cine-bar.bottom{height:auto;min-height:92px;padding:10px 14px}
      #cine .cine-controls{flex-wrap:wrap;gap:9px}
      #cine .cine-speed{gap:2px;margin-left:auto}
      #cine .cine-speed .spd-label{display:none}
      #cine .cine-spd{min-width:29px;height:25px;padding:0 2px;font-size:8.5px}
      #cine .cine-progress{order:5;flex:1 1 100%;height:18px}
      #cine .cine-caption{left:14px;right:14px;bottom:calc(12vh + 22px);max-width:none;padding:13px 16px}
      #cine .cine-caption h2{font-size:23px;margin:5px 0 5px}
      #cine .cine-caption p{font-size:9.5px;line-height:1.65}
      #cine .cine-help{display:none}
      #cine .cine-end{padding:26px 22px 22px}
      #cine .cine-end h2{font-size:30px}
    }
    `;
    const style = document.createElement('style');
    style.id = 'cineStyle';
    style.textContent = css;
    document.head.appendChild(style);

    // launch button — inserted into the existing paper utilities bar
    let launchBtn = null;
    (function injectLaunch() {
      const utilities = document.getElementById('utilities');
      if (!utilities) return;
      launchBtn = document.createElement('button');
      launchBtn.type = 'button';
      launchBtn.className = 'util cine-launch';
      launchBtn.id = 'btnCinema';
      launchBtn.title = '播放电影运镜（P）';
      launchBtn.setAttribute('aria-label', '播放电影运镜');
      launchBtn.innerHTML = '<i class="cine-tri" aria-hidden="true"></i>电影';
      utilities.insertBefore(launchBtn, utilities.firstChild);
      launchBtn.addEventListener('click', () => start());
    })();

    /* ======================================================================
     * Overlay DOM
     * ====================================================================*/
    const root = document.createElement('div');
    root.id = 'cine';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', '电影运镜播放');
    root.innerHTML = `
      <div class="cine-bar top">
        <div class="cine-brand"><i></i><div>文昌 101<small>CINEMATIC FIELD FILM · 01</small></div></div>
        <div class="cine-clock">
          <div class="cine-sun" aria-hidden="true"><i id="cineSunDot"></i></div>
          <div class="clock-copy"><small>SIMULATED LIGHT · 24H</small><div class="clock-val" id="cineClock">05:09<em id="cineNext"></em></div><div class="clock-phase" id="cinePhase">黎明</div></div>
        </div>
      </div>
      <div class="cine-caption" id="cineCaption">
        <div class="cine-kicker"><b id="cineChapterNo">01</b><span id="cineChapterEn">BEFORE FIRST LIGHT</span></div>
        <h2 id="cineChapterZh">黎明之前</h2>
        <p id="cineChapterLine">南海的夜色尚未退去，101 工位的灯火先醒来。</p>
      </div>
      <div class="cine-bar bottom">
        <div class="cine-controls">
          <div class="cine-transport">
            <button type="button" class="cine-btn play playing" id="cinePlay" aria-label="暂停"><span class="play-glyph"></span></button>
            <span class="cine-time" id="cineTime">00:00 / 01:32</span>
          </div>
          <div class="cine-speed" role="group" aria-label="播放速度">
            <span class="spd-label">SPEED</span>
            <button type="button" class="cine-spd on" data-speed="1" aria-pressed="true">1×</button>
            <button type="button" class="cine-spd" data-speed="1.5" aria-pressed="false">1.5×</button>
            <button type="button" class="cine-spd" data-speed="2" aria-pressed="false">2×</button>
            <button type="button" class="cine-spd" data-speed="3" aria-pressed="false">3×</button>
          </div>
          <div class="cine-progress" id="cineProgress" role="slider" aria-label="影片进度" aria-valuemin="0" aria-valuemax="92" aria-valuenow="0" tabindex="0">
            <div class="cine-fill" id="cineFill"></div>
            <div class="cine-head" id="cineHead"></div>
          </div>
          <button type="button" class="cine-btn cine-exit" id="cineExit">退出</button>
        </div>
      </div>
      <div class="cine-help">SPACE 暂停 · S 速度 · ← → 快进 · 1–9 章节 · ESC 退出</div>
      <div class="cine-fade" id="cineFade"></div>
      <div class="cine-end" id="cineEnd">
        <div class="end-kicker">FILM 01 · 24H LIGHT CYCLE</div>
        <h2>巡演结束</h2>
        <p>从黎明到深夜，从整箭到内部，再点火升空。<br>长五托举嫦娥七号，飞向月球南极。</p>
        <div class="end-actions">
          <button type="button" class="cine-btn" id="cineReplay">重播</button>
          <button type="button" class="cine-btn" id="cineExplore">返回探索</button>
        </div>
      </div>
    `;
    document.body.appendChild(root);

    const el = {
      clock: document.getElementById('cineClock'),
      next: document.getElementById('cineNext'),
      phase: document.getElementById('cinePhase'),
      caption: document.getElementById('cineCaption'),
      chapterNo: document.getElementById('cineChapterNo'),
      chapterEn: document.getElementById('cineChapterEn'),
      chapterZh: document.getElementById('cineChapterZh'),
      chapterLine: document.getElementById('cineChapterLine'),
      play: document.getElementById('cinePlay'),
      time: document.getElementById('cineTime'),
      speedBtns: Array.prototype.slice.call(document.querySelectorAll('#cine .cine-spd')),
      progress: document.getElementById('cineProgress'),
      fill: document.getElementById('cineFill'),
      head: document.getElementById('cineHead'),
      exit: document.getElementById('cineExit'),
      fade: document.getElementById('cineFade'),
      end: document.getElementById('cineEnd'),
      replay: document.getElementById('cineReplay'),
      explore: document.getElementById('cineExplore'),
      sunDot: document.getElementById('cineSunDot')
    };

    CHAPTERS.forEach((c, i) => {
      const tick = document.createElement('button');
      tick.type = 'button';
      tick.className = 'cine-tick';
      tick.style.left = (c.t / DURATION * 100) + '%';
      tick.title = c.zh;
      tick.setAttribute('aria-label', '跳转到 ' + c.zh);
      tick.dataset.idx = String(i);
      tick.addEventListener('click', (ev) => {
        ev.stopPropagation();
        seek(c.t);
      });
      el.progress.appendChild(tick);
    });

    /* ======================================================================
     * Playback state / helpers
     * ====================================================================*/
    const state = {
      active: false,
      playing: false,
      t: 0,
      ended: false,
      chapter: -1,
      mode: null,
      saved: null,
      lastCut: -1,
      lastExplode: -1,
      lastHour: -999,
      speed: 1,
      seed: 0
    };

    /* ======================================================================
     * Launch rig & exhaust effects.
     * Built once after the 3D modules exist.  At rest the pivot/lift cancels
     * out, so the normal interactive scene is unchanged.
     * ====================================================================*/
    const T3 = window.THREE, UU = window.U;
    const ROCKET_BASE = window.SPEC ? window.SPEC.rocket.baseY : 13.8;
    const LAUNCH = { igniteStart: 86.3, igniteFull: 89.6, liftoff: 92, end: DURATION };
    const launch = { rig: null, active: false, clipOff: false, clipWas: true };

    function buildLaunchRig() {
      const rocket = APP.modules && APP.modules.rocket;
      const interior = APP.modules && APP.modules.interior;
      const payload = APP.modules && APP.modules.payload;
      if (!T3 || !UU || !rocket || !rocket.group) return;
      const pivot = new T3.Group();
      pivot.name = 'launch-pivot';
      pivot.position.set(0, ROCKET_BASE, 0);
      APP.scene.add(pivot);
      const lift = new T3.Group();
      lift.name = 'launch-lift';
      lift.position.set(0, -ROCKET_BASE, 0);
      pivot.add(lift);
      [rocket.group, interior && interior.group, payload && payload.group].forEach(function (g) {
        if (g) lift.add(g);
      });

      const fx = new T3.Group();
      fx.name = 'launch-fx';
      fx.visible = false;
      rocket.group.add(fx);

      const outerMat = new T3.MeshBasicMaterial({
        color: 0xff6418, transparent: true, opacity: 0,
        blending: T3.AdditiveBlending, depthWrite: false, side: T3.DoubleSide, toneMapped: false
      });
      const innerMat = new T3.MeshBasicMaterial({
        color: 0xffe6b0, transparent: true, opacity: 0,
        blending: T3.AdditiveBlending, depthWrite: false, side: T3.DoubleSide, toneMapped: false
      });
      const glowTex = UU.texRadial(96, [
        [0, 'rgba(255,225,180,1)'], [.25, 'rgba(255,155,70,.70)'],
        [.65, 'rgba(255,100,30,.16)'], [1, 'rgba(255,80,20,0)']
      ]);
      const plumes = [];
      function makePlume(x, z, k, len) {
        const outer = new T3.Mesh(new T3.CylinderGeometry(0.55 * k, 2.8 * k, len, 16, 1, true), outerMat);
        outer.position.set(x, -len / 2, z);
        const inner = new T3.Mesh(new T3.CylinderGeometry(0.20 * k, 1.15 * k, len * .72, 12, 1, true), innerMat);
        inner.position.set(x, -len * .36, z);
        const glow = UU.sprite(glowTex, 0xffb066, 9 * k, 0);
        glow.position.set(x, -1.2, z);
        fx.add(outer); fx.add(inner); fx.add(glow);
        plumes.push({ outer: outer, inner: inner, glow: glow });
      }
      makePlume(0, 0, 1.10, 23);
      makePlume(-1.7, 0, .62, 17);
      makePlume(1.7, 0, .62, 17);
      (rocket.boosters || []).forEach(function (b) {
        try { makePlume(b.position.x, b.position.z, .55, 15); } catch (e) { /* non-fatal */ }
      });

      const light = new T3.PointLight(0xff7b35, 0, 130, 2);
      light.position.set(0, -3, 0);
      fx.add(light);
      const rim = new T3.PointLight(0xc3d6ff, 0, 150, 2);
      rim.position.set(16, 38, 22);
      fx.add(rim);
      const padLight = new T3.PointLight(0xff8a4a, 0, 170, 2);
      padLight.position.set(0, 18, 0);
      APP.scene.add(padLight);

      const smokeGroup = new T3.Group();
      smokeGroup.visible = false;
      APP.scene.add(smokeGroup);
      const smokeTex = UU.texRadial(128, [
        [0, 'rgba(255,255,255,.55)'], [.35, 'rgba(235,238,236,.32)'],
        [.68, 'rgba(210,218,218,.10)'], [1, 'rgba(200,210,210,0)']
      ]);
      const srng = UU.rng(9191);
      const smoke = [];
      for (let i = 0; i < 64; i++) {
        const m = new T3.SpriteMaterial({
          map: smokeTex,
          color: srng.next() < .35 ? 0xd8cdbf : 0xb9c3c3,
          transparent: true, opacity: 0, depthWrite: false,
          blending: T3.NormalBlending, toneMapped: false
        });
        const sp = new T3.Sprite(m);
        smokeGroup.add(sp);
        smoke.push({
          s: sp, ang: srng.range(0, Math.PI * 2), rad: srng.range(2, 18),
          y: srng.range(8, 22), sc: srng.range(9, 26), ph: srng.range(0, Math.PI * 2)
        });
      }

      const trail = [];
      for (let i = 0; i < 20; i++) {
        const m = new T3.SpriteMaterial({
          map: smokeTex, color: 0xb9c3c3, transparent: true, opacity: 0,
          depthWrite: false, blending: T3.NormalBlending, toneMapped: false
        });
        const sp = new T3.Sprite(m);
        sp.position.set(srng.range(-2.5, 2.5), -18 - i * 3.2, srng.range(-2.5, 2.5));
        sp.scale.setScalar(srng.range(7, 16));
        fx.add(sp);
        trail.push(sp);
      }

      const groundGlow = UU.sprite(UU.texRadial(64, [
        [0, 'rgba(255,220,170,.9)'], [.4, 'rgba(255,150,70,.35)'], [1, 'rgba(255,100,30,0)']
      ]), 0xffc08a, 52, 0);
      groundGlow.position.set(0, 13, 0);
      APP.scene.add(groundGlow);

      launch.rig = {
        pivot: pivot, lift: lift, fx: fx, plumes: plumes,
        outerMat: outerMat, innerMat: innerMat, light: light, rim: rim, padLight: padLight,
        smokeGroup: smokeGroup, smoke: smoke, trail: trail, groundGlow: groundGlow,
        fairingInterior: payload && payload.fairingInterior
      };
      resetLaunch();
    }

    function resetLaunch() {
      const r = launch.rig;
      launch.active = false;
      if (launch.clipOff) {
        if (APP.renderer) APP.renderer.localClippingEnabled = launch.clipWas;
        launch.clipOff = false;
      }
      if (!r) return;
      r.pivot.position.set(0, ROCKET_BASE, 0);
      r.pivot.rotation.set(0, 0, 0);
      r.fx.visible = false;
      r.outerMat.opacity = 0;
      r.innerMat.opacity = 0;
      r.plumes.forEach(function (p) { p.glow.material.opacity = 0; });
      r.light.intensity = 0;
      r.rim.intensity = 0;
      r.padLight.intensity = 0;
      r.groundGlow.material.opacity = 0;
      r.smokeGroup.visible = false;
      r.smoke.forEach(function (p) { p.s.material.opacity = 0; });
      r.trail.forEach(function (sp) { sp.material.opacity = 0; sp.visible = false; });
      if (r.fairingInterior) r.fairingInterior.visible = true;
    }

    function launchState(t) {
      const dt = Math.max(0, t - LAUNCH.liftoff);
      const throttle = smooth(clamp01((t - LAUNCH.igniteStart) / (LAUNCH.igniteFull - LAUNCH.igniteStart)));
      const dy = 0.45 * dt * dt;
      const dx = 0.075 * dt * dt;
      const pitch = Math.min(0.13, dt * 0.0055);
      return { t: t, dt: dt, throttle: throttle, dy: dy, dx: dx, pitch: pitch, active: t > LAUNCH.igniteStart };
    }

    function applyLaunch(t) {
      const r = launch.rig;
      if (!r) return null;
      const L = launchState(t);
      if (!L.active) {
        if (launch.active) resetLaunch();
        return L;
      }
      launch.active = true;
      if (!launch.clipOff) {
        launch.clipWas = APP.renderer ? APP.renderer.localClippingEnabled : true;
        if (APP.renderer) APP.renderer.localClippingEnabled = false;
        launch.clipOff = true;
      }
      r.pivot.position.set(L.dx, ROCKET_BASE + L.dy, 0);
      r.pivot.rotation.set(0, 0, -L.pitch);
      const flick = Math.max(0, 0.84 + 0.16 * Math.sin(t * 41.3) + 0.06 * Math.sin(t * 73.1 + 1.2));
      const ign = L.throttle;
      r.fx.visible = ign > 0.01;
      r.outerMat.opacity = ign * .50 * flick;
      r.innerMat.opacity = ign * .82 * flick;
      r.plumes.forEach(function (p, i) {
        const sy = 1.0 + ign * .5 + Math.min(2.2, L.dy * .0045);
        p.outer.scale.set(.8 + ign * .2, sy, .8 + ign * .2);
        p.inner.scale.set(.8 + ign * .2, sy * .95, .8 + ign * .2);
        p.glow.material.opacity = ign * .75 * flick;
        p.glow.scale.setScalar((9 + 3 * Math.sin(t * 31 + i)) * (0.75 + ign * .5));
      });
      r.light.intensity = ign * 2600 * flick;
      r.rim.intensity = ign * 900 * flick;
      r.padLight.intensity = ign * 1100 * flick;
      r.groundGlow.material.opacity = ign * .55 * flick;

      const age = Math.max(0, t - 87);
      r.smokeGroup.visible = age > 0;
      r.smoke.forEach(function (p) {
        const spread = 1 + age * .20;
        p.s.position.set(
          Math.cos(p.ang) * p.rad * spread + Math.sin(t * .55 + p.ph) * 1.6,
          7.5 + age * .65 + Math.sin(t * .42 + p.ph) * 1.8,
          Math.sin(p.ang) * p.rad * spread + Math.cos(t * .48 + p.ph) * 1.5
        );
        p.s.scale.setScalar(p.sc * (.8 + Math.min(age, 30) * .075));
        p.s.material.opacity = Math.min(1, ign * 1.35) * Math.max(0, 1 - age / 42) *
          (.22 + .08 * Math.sin(t * .7 + p.ph));
      });
      r.trail.forEach(function (sp, i) {
        sp.visible = ign > .02;
        sp.material.opacity = ign * .16 * (1 - i / r.trail.length * .7);
        sp.scale.setScalar((6 + i * .55) * (0.8 + ign * .4));
      });
      if (r.fairingInterior) r.fairingInterior.visible = !(L.dt > .15);
      return L;
    }
    buildLaunchRig();

    function setMode(mode) {
      if (mode === state.mode) return;
      state.mode = mode;
      if (APP.cinema) APP.cinema.mode(mode);
    }

    function applyFrame(t, force) {
      const f = sampleAt(t);
      const L = applyLaunch(t);
      if (L && L.active && t >= LAUNCH.liftoff) {
        const p = smoother(clamp01((t - LAUNCH.liftoff) / (DURATION - LAUNCH.liftoff)));
        f.cam.target[0] = L.dx * .72;
        f.cam.target[1] = ROCKET_BASE + 30 + L.dy * .93;
        f.cam.target[2] = 0;
        f.cam.az = lerp(6, 16, p);
        f.cam.elev = lerp(3, -7, p);
        f.cam.dist = lerp(138, 460, p);
        f.cam.fov = lerp(42, 40, p);
        if (t < 98) {
          const sh = (1 - smooth(clamp01((t - 92) / 6))) * clamp01((t - 88) / 2);
          f.cam.az += Math.sin(t * 47.3) * .5 * sh;
          f.cam.target[0] += Math.sin(t * 53.7) * .45 * sh;
          f.cam.target[1] += Math.sin(t * 41.1 + 1.0) * .35 * sh;
        }
      }
      if (force || A(f.cut - state.lastCut) > 0.0015) {
        state.lastCut = f.cut;
        if (APP.cinema) APP.cinema.cut(f.cut);
      }
      if (force || A(f.explode - state.lastExplode) > 0.0015) {
        state.lastExplode = f.explode;
        if (APP.cinema) APP.cinema.explode(f.explode);
      }
      setMode(f.mode);
      if (APP.cinema.camera) APP.cinema.camera(f.cam);
      if (force || A(f.hour - state.lastHour) > 0.001) {
        state.lastHour = f.hour;
        if (APP.cinema.hour) APP.cinema.hour(f.hour, !!force);
      }
      updateChapter(chapterAt(t));
      updateClock(f.hour);
      updateProgress(t);
    }

    function updateChapter(idx) {
      if (idx === state.chapter) return;
      state.chapter = idx;
      const c = CHAPTERS[idx];
      el.chapterNo.textContent = (idx + 1 < 10 ? '0' : '') + (idx + 1);
      el.chapterEn.textContent = c.en;
      el.chapterZh.textContent = c.zh;
      el.chapterLine.textContent = c.line;
      el.caption.classList.add('swap');
      setTimeout(() => el.caption.classList.remove('swap'), 260);
      const ticks = el.progress.querySelectorAll('.cine-tick');
      for (let i = 0; i < ticks.length; i++) ticks[i].classList.toggle('on', i === idx);
    }

    function updateClock(hour) {
      const c = clockText(hour);
      el.clock.firstChild.nodeValue = c.time;
      el.next.textContent = c.next ? '次日' : '';
      el.phase.textContent = c.phase;
      if (el.sunDot) {
        const h = ((hour % 24) + 24) % 24;
        const day = h >= 6 && h <= 18;
        const p = day ? (h - 6) / 12 : 0;
        el.sunDot.style.left = (50 - 50 * Math.cos(p * PI)) + '%';
        el.sunDot.style.top = (-2 + 24 * (1 - Math.sin(p * PI))) + 'px';
        el.sunDot.style.opacity = day ? '1' : '.22';
      }
    }

    function updateProgress(t) {
      const p = Math.max(0, Math.min(1, t / DURATION));
      el.fill.style.width = (p * 100) + '%';
      el.head.style.left = (p * 100) + '%';
      el.time.textContent = timecode(t) + ' / ' + timecode(DURATION);
      el.progress.setAttribute('aria-valuenow', Math.round(t));
      // final fade
      const fade = state.ended ? 1 : U.clamp((t - (DURATION - 3.2)) / 3.2, 0, 1);
      el.fade.style.opacity = String(fade);
    }

    const U = {
      clamp: (v, a, b) => v < a ? a : v > b ? b : v
    };

    function setPlaying(on) {
      if (state.ended) return;
      state.playing = !!on;
      el.play.classList.toggle('playing', state.playing);
      el.play.setAttribute('aria-label', state.playing ? '暂停' : '播放');
    }

    const SPEEDS = [1, 1.5, 2, 3];
    function setSpeed(v) {
      v = Number(v);
      if (SPEEDS.indexOf(v) === -1) v = 1;
      state.speed = v;
      el.speedBtns.forEach(function (b) {
        const on = Math.abs(parseFloat(b.dataset.speed) - v) < 0.001;
        b.classList.toggle('on', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    }
    function cycleSpeed() {
      const i = SPEEDS.indexOf(state.speed);
      setSpeed(SPEEDS[(i + 1) % SPEEDS.length]);
    }
    setSpeed(parseFloat(Q.speed) || 1);

    function seek(t) {
      state.t = U.clamp(t, 0, DURATION);
      state.ended = false;
      el.end.classList.remove('show');
      state.chapter = -1;
      state.lastCut = -1; state.lastExplode = -1; state.lastHour = -999;
      applyFrame(state.t, true);
      setPlaying(true);
      if (state.t >= DURATION) { finish(); }
    }

    function finish() {
      state.t = DURATION;
      state.playing = false;
      state.ended = true;
      el.play.classList.remove('playing');
      updateProgress(DURATION);
      el.fade.style.opacity = '1';
      setTimeout(() => el.end.classList.add('show'), 500);
    }

    function start(opts) {
      if (state.active) return;
      state.active = true;
      state.ended = false;
      state.t = 0;
      state.chapter = -1;
      state.lastCut = -1; state.lastExplode = -1; state.lastHour = -999;
      resetLaunch();
      state.saved = {
        state: APP.actions.getState(),
        camera: APP.cinema.getCamera(),
        labels: APP.state ? APP.state.labels : true
      };
      document.body.classList.add('cine');
      if (reduced) document.body.classList.add('reduced');
      root.setAttribute('aria-hidden', 'false');
      el.end.classList.remove('show');
      el.fade.style.opacity = '0';
      // reset to the beginning of the film
      if (APP.cinema) APP.cinema.setActive(true);
      if (APP.actions) {
        APP.actions.setLabelsVisible(false);
        APP.actions.setMode('overall', { keepView: true, tour: true });
        APP.actions.setCut(0);
      }
      state.mode = 'overall';
      applyFrame(0, true);
      setPlaying(true);
      if (opts && opts.at !== undefined) seek(opts.at);
      if (opts && opts.paused) setPlaying(false);
    }

    function restoreSaved() {
      const sv = state.saved;
      if (!sv) return;
      if (APP.actions) {
        APP.actions.setTimeMode(sv.state.time);
        APP.actions.setMode(sv.state.mode, { keepView: true });
      }
      if (APP.cinema) {
        APP.cinema.cut(sv.state.cut);
        APP.cinema.explode(sv.state.explode);
        APP.cinema.camera(sv.camera);
      }
      if (APP.actions) {
        APP.actions.setLabelsVisible(!!sv.labels);
        if (sv.state.selected) APP.actions.selectPart(sv.state.selected);
      }
      if (window.HUD && window.HUD.setView) window.HUD.setView(sv.state.view);
      if (APP.state) APP.state.view = sv.state.view;
    }

    function leave(night) {
      if (!state.active) return;
      state.active = false;
      state.playing = false;
      document.body.classList.remove('cine');
      document.body.classList.remove('reduced');
      root.setAttribute('aria-hidden', 'true');
      el.end.classList.remove('show');
      resetLaunch();
      if (APP.cinema) APP.cinema.setActive(false);
      if (night) {
        // end on the night scene, interactive
        if (APP.actions) {
          APP.actions.setTimeMode('night');
          APP.actions.setMode('overall', { keepView: true });
          APP.actions.setCut(0);
          APP.actions.setLabelsVisible(true);
        }
        if (APP.cinema) {
          APP.cinema.cut(0);
          APP.cinema.explode(0);
          APP.cinema.camera({ target: [0, 40, 0], az: 10, elev: 11, dist: 330, fov: 40 });
        }
        if (window.HUD && window.HUD.setView) window.HUD.setView('hero');
        if (APP.state) { APP.state.view = 'hero'; APP.state.selected = null; }
      } else {
        restoreSaved();
      }
      state.saved = null;
    }

    function exit() { leave(false); }
    function explore() { leave(true); }

    function replay() {
      if (!state.active) return start();
      resetLaunch();
      state.ended = false;
      state.t = 0;
      state.chapter = -1;
      state.lastCut = -1; state.lastExplode = -1; state.lastHour = -999;
      el.end.classList.remove('show');
      el.fade.style.opacity = '0';
      if (APP.actions) {
        APP.actions.setMode('overall', { keepView: true, tour: true });
        APP.actions.setCut(0);
      }
      state.mode = 'overall';
      applyFrame(0, true);
      setPlaying(true);
    }

    function togglePlay() {
      if (!state.active) return start();
      if (state.ended) return replay();
      setPlaying(!state.playing);
    }

    /* ======================================================================
     * Controls
     * ====================================================================*/
    el.play.addEventListener('click', () => {
      if (state.ended) replay();
      else setPlaying(!state.playing);
    });
    el.speedBtns.forEach(function (b) {
      b.addEventListener('click', function () { setSpeed(parseFloat(b.dataset.speed)); });
    });
    el.exit.addEventListener('click', exit);
    el.replay.addEventListener('click', replay);
    el.explore.addEventListener('click', explore);
    el.progress.addEventListener('click', (ev) => {
      if (ev.target.closest('.cine-tick')) return;
      const r = el.progress.getBoundingClientRect();
      seek(U.clamp((ev.clientX - r.left) / Math.max(1, r.width), 0, 1) * DURATION);
    });
    el.progress.addEventListener('keydown', (ev) => {
      if (ev.key === 'ArrowLeft') { seek(state.t - 3); ev.preventDefault(); }
      else if (ev.key === 'ArrowRight') { seek(state.t + 3); ev.preventDefault(); }
    });

    const onKey = (ev) => {
      const code = ev.code || '';
      if (!state.active) {
        if (code === 'KeyP') {
          ev.preventDefault();
          start();
        }
        return;
      }
      // swallow all other UI shortcuts while the film is playing
      if (code === 'Space') { togglePlay(); ev.preventDefault(); ev.stopImmediatePropagation(); return; }
      if (code === 'Escape') { exit(); ev.preventDefault(); ev.stopImmediatePropagation(); return; }
      if (code === 'ArrowLeft') { seek(state.t - 5); ev.preventDefault(); ev.stopImmediatePropagation(); return; }
      if (code === 'ArrowRight') { seek(state.t + 5); ev.preventDefault(); ev.stopImmediatePropagation(); return; }
      if (code === 'KeyR') { replay(); ev.preventDefault(); ev.stopImmediatePropagation(); return; }
      if (code === 'KeyS') { cycleSpeed(); ev.preventDefault(); ev.stopImmediatePropagation(); return; }
      if (code.indexOf('Digit') === 0) {
        const n = parseInt(code.slice(5), 10);
        if (n >= 1 && n <= CHAPTERS.length) { seek(CHAPTERS[n - 1].t); ev.preventDefault(); ev.stopImmediatePropagation(); return; }
      }
      ev.preventDefault();
      ev.stopImmediatePropagation();
    };
    window.addEventListener('keydown', onKey, true);

    /* ======================================================================
     * Drive loop (runs before sky/atmos so the hour is current)
     * ====================================================================*/
    function tick(dt) {
      if (!state.active) return;
      if (state.playing && !state.ended) {
        state.t += dt * state.speed;
        if (state.t >= DURATION) { state.t = DURATION; finish(); }
        applyFrame(state.t, false);
      }
    }
    APP.updaters.unshift(tick);

    /* ======================================================================
     * Public API / auto-start
     * ====================================================================*/
    APP.cinematic = {
      start,
      exit,
      replay,
      pause: () => setPlaying(false),
      resume: () => setPlaying(true),
      seek,
      explore,
      onReady() {
        if (Q.tour) {
          const at = Q.tourat !== undefined ? parseFloat(Q.tourat) : 0;
          const paused = Q.tourat !== undefined;
          setTimeout(() => {
            if (!state.active) start({ at: isFinite(at) ? at : 0, paused: paused });
          }, 600);
        } else if (!Q.instant && launchBtn) {
          setTimeout(() => {
            if (!state.active && window.HUD && window.HUD.toast) window.HUD.toast('点击「电影」或按 P 播放 92 秒运镜');
          }, 2600);
        }
      },
      setSpeed,
      get state() { return { active: state.active, playing: state.playing, t: state.t, ended: state.ended, chapter: state.chapter, speed: state.speed }; },
      get duration() { return DURATION; },
      get launch() { const r = launch.rig; return { active: launch.active, rocketY: r ? r.pivot.position.y : null, fx: !!(r && r.fx.visible) }; },
      get chapters() { return CHAPTERS.map(c => ({ ...c })); }
    };
    window.__CINE__ = APP.cinematic;
    return APP.cinematic;
  };
})();
