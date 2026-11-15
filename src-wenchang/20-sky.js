/* ============================================================================
 * 20-sky.js — Hainan sky, sea and atmosphere backdrop.
 * Owner: Lead.
 * ==========================================================================*/
(function () {
  'use strict';
  window.buildSky = function (APP) {
    const T = window.THREE, U = window.U, FLAGS = window.FLAGS;
    const g = U.group('sky'); APP.scene.add(g);
    const DAY_SUN = new T.Vector3(-.58, .335, .74).normalize();
    const day = { sun: DAY_SUN.clone() };
    const moon = new T.Vector3(.25, .30, -.92).normalize();
    const S = {
      dayMix: 1, target: 1, time: 0,
      warm: 0, warmTarget: 0, sunTarget: DAY_SUN.clone(),
      sunColor: new T.Color(1.0, .82, .56),
      horizonWarm: new T.Color(.86, .71, .52),
      hour: null, mode: 'day',
      skyMat: null, oceanMat: null, stars: null, cloudGroup: null, sunSprite: null, moonSprite: null,
      envDay: null, envNight: null
    };

    /* ---- sky dome -------------------------------------------------------*/
    const skyVert = `
      varying vec3 vDir;
      void main(){
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`;
    const skyFrag = `
      uniform vec3 uSunDir; uniform vec3 uMoonDir;
      uniform vec3 uSunColor; uniform vec3 uWarmHorizon;
      uniform float uWarm;
      uniform float uDayMix; uniform float uTime;
      varying vec3 vDir;
      float hash21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
      float hash31(vec3 p){ p = fract(p*0.3183099 + .1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
      float noise2(vec2 p){
        vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        float a = hash21(i), b = hash21(i+vec2(1,0)), c = hash21(i+vec2(0,1)), d = hash21(i+vec2(1,1));
        return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
      }
      float fbm(vec2 p){ float s=0.0, a=0.5; for(int i=0;i<5;i++){ s+=a*noise2(p); p=p*2.03+vec2(17.1,9.2); a*=0.5; } return s; }
      void main(){
        vec3 dir = normalize(vDir);
        float h = clamp(dir.y, 0.0, 1.0);
        // day: hazy tropical blue, warm sea haze at the horizon
        vec3 zenith = vec3(0.040,0.180,0.380);
        vec3 horizon = vec3(0.61,0.68,0.67);
        vec3 day = mix(horizon, zenith, pow(h, 0.62));
        day = mix(day, uWarmHorizon, exp(-h*13.0)*(0.22 + 0.30*uWarm));
        float sd = max(dot(dir, normalize(uSunDir)), 0.0);
        day += uWarmHorizon * 0.55 * pow(sd, 2.0) * exp(-h*5.0) * (0.35 + uWarm);
        day += uSunColor * pow(sd, 1400.0) * 2.8;
        day += uSunColor * pow(sd, 10.0) * (0.10 + 0.10*uWarm);
        // high cloud deck — soft, sparse, wind-sheared
        if (dir.y > 0.006) {
          vec2 p = dir.xz / (dir.y + 0.10) * 1.8 + vec2(uTime*0.0022, 0.0);
          float c = fbm(p * vec2(1.2,1.6));
          c += 0.22 * fbm(p * vec2(3.2,2.1) + vec2(4.0,9.0));
          c = smoothstep(0.60, 0.84, c) * smoothstep(0.005, 0.18, dir.y);
          vec3 cloudCol = mix(vec3(0.92,0.92,0.88), mix(vec3(1.0,0.93,0.82), uSunColor, 0.55*uWarm), pow(sd,2.2));
          day = mix(day, cloudCol, c * 0.46);
          // distant tropical shower veil
          float veil = smoothstep(0.6, 0.9, fbm(p*0.7+vec2(11.0,3.0))) * smoothstep(0.0,0.12,dir.y);
          day = mix(day, mix(vec3(0.70,0.75,0.75), uWarmHorizon, 0.35*uWarm), veil*0.12);
        }
        // night: deep ocean sky, stars, moon
        vec3 nz = vec3(0.008,0.016,0.036);
        vec3 nh = vec3(0.028,0.055,0.082);
        vec3 night = mix(nh, nz, pow(h, 0.5));
        night = mix(night, vec3(0.06,0.10,0.14), exp(-h*7.0)*0.35);
        // round, twinkling procedural stars (no square hash cells)
        if (dir.y > 0.015) {
          vec3 sp = dir * 300.0;
          vec3 ip = floor(sp);
          vec3 fp = fract(sp) - 0.5;
          float h1 = hash31(ip);
          vec3 jit = vec3(hash31(ip + 11.0), hash31(ip + 23.0), hash31(ip + 37.0)) - 0.5;
          float d = length(fp - jit * 0.55);
          float tw = 0.60 + 0.40 * sin(uTime * (1.2 + h1 * 2.2) + h1 * 37.0);
          float star = smoothstep(0.22, 0.0, d) * step(0.9978, h1) * tw;
          float halo = smoothstep(0.42, 0.0, d) * step(0.9978, h1) * 0.20;
          float horiz = smoothstep(0.01, 0.20, dir.y);
          night += vec3(0.86, 0.91, 1.0) * (star * 2.6 + halo) * horiz;
          // sparse brighter stars
          vec3 sp2 = dir * 190.0;
          vec3 ip2 = floor(sp2);
          float h2 = hash31(ip2 + 5.0);
          float d2 = length(fract(sp2) - 0.5 - (vec3(hash31(ip2 + 2.0), hash31(ip2 + 3.0), hash31(ip2 + 4.0)) - 0.5) * 0.5);
          night += vec3(0.95, 0.97, 1.0) * smoothstep(0.08, 0.0, d2) * step(0.99935, h2) * 2.2 * smoothstep(0.03, 0.22, dir.y);
        }
        float md = max(dot(dir, normalize(uMoonDir)), 0.0);
        night += vec3(0.80,0.87,0.96) * pow(md, 2400.0) * 2.3;
        night += vec3(0.46,0.56,0.78) * pow(md, 22.0) * 0.10;
        vec3 col = mix(night, day, clamp(uDayMix,0.0,1.0));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`;
    const skyMat = new T.ShaderMaterial({
      uniforms: {
        uSunDir: { value: day.sun.clone() },
        uMoonDir: { value: moon.clone() },
        uSunColor: { value: new T.Color(1.0, .82, .56) },
        uWarmHorizon: { value: new T.Color(.86, .71, .52) },
        uWarm: { value: 0 },
        uDayMix: { value: 1 },
        uTime: { value: 0 }
      },
      vertexShader: skyVert, fragmentShader: skyFrag,
      side: T.BackSide, depthWrite: false, fog: false, toneMapped: true
    });
    const skyDome = new T.Mesh(new T.SphereGeometry(4600, 64, 32), skyMat);
    skyDome.frustumCulled = false;
    skyDome.renderOrder = -100;
    g.add(skyDome);
    S.skyMat = skyMat;
    APP.scene.background = new T.Color(0xbfd2d7);
    APP.scene.fog = new T.FogExp2(0xc3c9c1, .00062);

    /* ---- environment map ------------------------------------------------*/
    function buildEnv() {
      let rt = null;
      try {
        const pmrem = new T.PMREMGenerator(APP.renderer);
        pmrem.compileEquirectangularShader();
        const envScene = new T.Scene();
        const mat = skyMat.clone();
        mat.uniforms = {
          uSunDir: { value: day.sun.clone() }, uMoonDir: { value: moon.clone() },
          uDayMix: { value: 1 }, uTime: { value: 0 }
        };
        mat.side = T.BackSide; mat.depthWrite = false;
        const dome = new T.Mesh(new T.SphereGeometry(100, 32, 16), mat);
        envScene.add(dome);
        rt = pmrem.fromScene(envScene, 0.03);
        APP.scene.environment = rt.texture;
        pmrem.dispose();
      } catch (e) {
        // environment map is a nice-to-have; never fatal
        console.warn('env map skipped', e && e.message);
      }
      return rt;
    }
    S.envDay = buildEnv();

    /* ---- night starfield (Points, guaranteed round) ---------------------*/
    const starTex = U.texRadial(64, [[0, 'rgba(255,255,255,1)'], [.28, 'rgba(235,244,255,.9)'], [.6, 'rgba(200,225,255,.25)'], [1, 'rgba(200,225,255,0)']]);
    const starCount = 2600;
    const starPos = new Float32Array(starCount * 3);
    const starCol = new Float32Array(starCount * 3);
    const sr = U.rng(20261114);
    for (let i = 0; i < starCount; i++) {
      // random point on upper hemisphere, radius 3900
      let u = sr.next() * 2 - 1, th = sr.next() * TAU;
      let y = Math.abs(u) * .96 + .04;
      let r = Math.sqrt(Math.max(0, 1 - y * y));
      starPos[i * 3] = Math.cos(th) * r * 3900;
      starPos[i * 3 + 1] = y * 3900;
      starPos[i * 3 + 2] = Math.sin(th) * r * 3900;
      const c = .55 + sr.next() * .45;
      const warm = sr.next() < .18;
      starCol[i * 3] = c * (warm ? 1 : .86);
      starCol[i * 3 + 1] = c * (warm ? .88 : .93);
      starCol[i * 3 + 2] = c;
    }
    const starGeo = new T.BufferGeometry();
    starGeo.setAttribute('position', new T.BufferAttribute(starPos, 3));
    starGeo.setAttribute('color', new T.BufferAttribute(starCol, 3));
    const starMat = new T.PointsMaterial({
      map: starTex, size: 3.2, sizeAttenuation: false, vertexColors: true,
      transparent: true, opacity: 0, depthWrite: false, depthTest: true,
      blending: T.AdditiveBlending, fog: false, alphaTest: .01
    });
    const starPoints = new T.Points(starGeo, starMat);
    starPoints.frustumCulled = false;
    starPoints.renderOrder = -50;
    g.add(starPoints);
    S.starPoints = starPoints;

    /* ---- sun / moon glints ----------------------------------------------*/
    const glowTex = U.texRadial(128, [[0, 'rgba(255,255,255,1)'], [.22, 'rgba(255,244,220,.65)'], [1, 'rgba(255,240,210,0)']]);
    const glow = U.sprite(glowTex, 0xfff0d2, 155, .40);
    glow.position.copy(day.sun).multiplyScalar(3900);
    glow.material.depthWrite = false; glow.material.fog = false;
    g.add(glow);
    S.sunSprite = glow;
    const moonTex = U.texRadial(128, [[0, 'rgba(255,255,255,1)'], [.28, 'rgba(214,228,248,.85)'], [.42, 'rgba(190,210,240,.24)'], [1, 'rgba(180,200,235,0)']]);
    const moonSprite = U.sprite(moonTex, 0xcfe1ff, 290, 0);
    moonSprite.position.copy(moon).multiplyScalar(3800);
    moonSprite.material.depthWrite = false; moonSprite.material.fog = false;
    g.add(moonSprite);
    S.moonSprite = moonSprite;

    /* ---- clouds ---------------------------------------------------------*/
    function cloudTexture(seed) {
      const c = U.texCanvas(512, 256, (ctx, cv) => {
        const r = U.rng(seed);
        ctx.clearRect(0, 0, cv.width, cv.height);
        for (let i = 0; i < 60; i++) {
          const x = r.range(70, 440), y = r.range(80, 195), rad = r.range(30, 105);
          const gr = ctx.createRadialGradient(x, y, 0, x, y, rad);
          gr.addColorStop(0, 'rgba(255,255,255,' + r.range(.06, .19) + ')');
          gr.addColorStop(.55, 'rgba(250,250,248,' + r.range(.03, .10) + ')');
          gr.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(x, y, rad * 1.6, rad * .58, 0, 0, TAU); ctx.fill();
        }
        // soft base shading
        const lg = ctx.createLinearGradient(0, 60, 0, 256);
        lg.addColorStop(0, 'rgba(255,255,255,0)');
        lg.addColorStop(.62, 'rgba(180,190,192,.10)');
        lg.addColorStop(1, 'rgba(150,165,170,0)');
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = lg; ctx.fillRect(0, 0, cv.width, cv.height);
      }, { srgb: true });
      return c.tex;
    }
    const cloudGroup = U.group('clouds'); g.add(cloudGroup);
    const cloudDefs = [
      { d: 1500, az: -72, y: 300, w: 950, h: 260, op: .34, seed: 3 },
      { d: 2300, az: -34, y: 380, w: 1350, h: 330, op: .26, seed: 8 },
      { d: 2900, az: 18, y: 420, w: 1500, h: 380, op: .20, seed: 21 },
      { d: 1900, az: 66, y: 310, w: 1000, h: 270, op: .24, seed: 14 },
      { d: 3400, az: -120, y: 460, w: 1800, h: 420, op: .22, seed: 32 },
      { d: 2600, az: 150, y: 360, w: 1300, h: 320, op: .2, seed: 44 }
    ];
    S.cloudSprites = [];
    cloudDefs.forEach(d => {
      const tex = cloudTexture(d.seed);
      const mat = new T.SpriteMaterial({
        map: tex, transparent: true, opacity: d.op, depthWrite: false, fog: true,
        color: 0xf7f4ea, toneMapped: true
      });
      const sp = new T.Sprite(mat);
      sp.position.set(Math.sin(d.az * U.DEG) * d.d, d.y, Math.cos(d.az * U.DEG) * d.d);
      sp.scale.set(d.w, d.h, 1);
      cloudGroup.add(sp);
      S.cloudSprites.push(sp);
    });

    /* ---- sea ------------------------------------------------------------*/
    const seaUniforms = {
      uTime: { value: 0 },
      uDayMix: { value: 1 },
      uSunDir: { value: day.sun.clone() },
      uDeep: { value: new T.Color(0x0d4a58) },
      uShallow: { value: new T.Color(0x2f8f92) },
      uSky: { value: new T.Color(0xa9c7cf) },
      uHorizon: { value: new T.Color(0xc6d4d3) },
      uFogColor: { value: new T.Color(0xc7d3d2) },
      uFogDensity: { value: .00052 }
    };
    const seaVert = `
      uniform float uTime;
      varying vec3 vWorld; varying vec2 vUv; varying vec3 vNormal;
      void main(){
        vUv = uv;
        vec3 p = position;
        float w1 = sin(p.x*0.045 + uTime*0.55)*0.22;
        float w2 = sin(p.y*0.061 - uTime*0.71 + 1.7)*0.16;
        float w3 = sin((p.x+p.y)*0.023 + uTime*0.33)*0.28;
        p.z += w1 + w2 + w3;
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vWorld = wp.xyz;
        vec3 n = normalize(vec3(
          -0.045*cos(p.x*0.045 + uTime*0.55)*0.22 - 0.023*cos((p.x+p.y)*0.023 + uTime*0.33)*0.28,
          -0.061*cos(p.y*0.061 - uTime*0.71 + 1.7)*0.16 - 0.023*cos((p.x+p.y)*0.023 + uTime*0.33)*0.28,
          1.0));
        vNormal = normalize(mat3(modelMatrix) * n);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`;
    const seaFrag = `
      uniform float uTime; uniform float uDayMix;
      uniform vec3 uSunDir; uniform vec3 uDeep; uniform vec3 uShallow;
      uniform vec3 uSky; uniform vec3 uHorizon; uniform vec3 uFogColor; uniform float uFogDensity;
      varying vec3 vWorld; varying vec2 vUv; varying vec3 vNormal;
      float hash21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
      float hash31(vec3 p){ p = fract(p*0.3183099 + .1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
      float noise2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        float a=hash21(i), b=hash21(i+vec2(1,0)), c=hash21(i+vec2(0,1)), d=hash21(i+vec2(1,1));
        return mix(mix(a,b,f.x), mix(c,d,f.x), f.y); }
      void main(){
        vec3 V = normalize(cameraPosition - vWorld);
        vec3 N = normalize(vNormal);
        // micro ripple normal
        vec2 rp = vWorld.xz * 0.11;
        float r1 = noise2(rp + vec2(uTime*.12, uTime*.07));
        float r2 = noise2(rp*2.7 - vec2(uTime*.2, uTime*.09) + 4.0);
        vec2 grad = vec2(r1-r2, r2-r1) * 0.10;
        N = normalize(N + vec3(grad.x, 0.0, grad.y));
        float ndv = max(dot(N, V), 0.0);
        float fres = pow(1.0 - ndv, 3.2);
        vec3 R = reflect(-V, N);
        float skyLift = clamp(R.y, 0.0, 1.0);
        vec3 skyRef = mix(uHorizon, uSky, pow(skyLift, .6));
        vec3 water = mix(uDeep, uShallow, clamp(0.36 + 0.26*noise2(vWorld.xz*0.013) - 0.3*fres, 0.0, 1.0));
        vec3 col = mix(water, skyRef, fres*0.82);
        col += uSky * 0.06;
        // sun glints
        vec3 sunR = normalize(uSunDir);
        float spec = pow(max(dot(reflect(-V, N), sunR), 0.0), 260.0);
        float glint = smoothstep(0.55, 1.0, noise2(vWorld.xz*0.35 + uTime*0.3));
        col += vec3(1.0,0.9,0.68) * spec * (0.35 + 1.3*glint) * uDayMix;
        float md = pow(max(dot(reflect(-V,N), normalize(vec3(-0.32,0.48,-0.81))),0.0), 180.0);
        col += vec3(0.65,0.80,1.0) * md * (1.0-uDayMix) * 0.5;
        // fog / horizon blend by distance
        float dist = length(vWorld - cameraPosition);
        float fog = 1.0 - exp(-pow(dist*uFogDensity, 1.55));
        col = mix(col, uFogColor, clamp(fog,0.0,0.96));
        // horizon lift
        col = mix(col, uHorizon, smoothstep(2200.0, 5200.0, dist) * 0.5);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`;
    const seaMat = new T.ShaderMaterial({
      uniforms: seaUniforms, vertexShader: seaVert, fragmentShader: seaFrag,
      toneMapped: true
    });
    const seaGeo = new T.PlaneGeometry(16000, 16000, 180, 180);
    const sea = new T.Mesh(seaGeo, seaMat);
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = -2.6;
    sea.frustumCulled = false;
    sea.name = 'ocean';
    g.add(sea);
    S.oceanMat = seaMat;
    S.ocean = sea;
    APP.registerPart('sea', {
      zh: '南海', en: 'SOUTH CHINA SEA', section: '发射场', index: false, modes: ['overall'],
      anchor: () => new T.Vector3(620, 8, 480),
      specs: [['海况', '南海北部 · 近岸'], ['能见度', '约 18 km（示意）']],
      desc: '文昌发射场位于海南岛东北岸，火箭航向多面向东南，发射后的残骸落区在南海。'
    });

    /* ---- day / night ----------------------------------------------------*/
    const fogDay = new T.Color(0xc3c9c1), fogNight = new T.Color(0x0e1a26);
    const shallowDay = new T.Color(0x2a8186), shallowNight = new T.Color(0x0a2c39);
    const deepDay = new T.Color(0x083f4e), deepNight = new T.Color(0x04141d);
    const skyColDay = new T.Color(0x9dbcc2), skyColNight = new T.Color(0x132330);
    const horizonDay = new T.Color(0xc4cabf), horizonNight = new T.Color(0x18242e);
    // ---- time-of-day light rig ------------------------------------------
    // The cinematic tour drives a continuous 24 h sun arc.  The ordinary
    // day/night toggle still snaps back to the art-directed defaults.
    const SUN_WARM = new T.Color(1.0, .40, .14);
    const SUN_DAY = new T.Color(1.0, .90, .76);
    const HORIZON_WARM = new T.Color(.98, .52, .24);
    const HORIZON_HAZE = new T.Color(.86, .71, .52);
    const SEA_WARM = new T.Color(.86, .48, .28);
    const CLOUD_WARM = new T.Color(1.0, .80, .62);
    const CLOUD_COOL = new T.Color(.97, .97, .94);
    const WARM_FOG = new T.Color(.55, .42, .32);

    function setTimeMode(mode, instant) {
      S.mode = mode === 'night' ? 'night' : 'day';
      S.hour = null;
      S.target = mode === 'night' ? 0 : 1;
      S.sunTarget.copy(DAY_SUN);
      S.warmTarget = 0;
      if (instant) {
        S.dayMix = S.target;
        day.sun.copy(S.sunTarget);
        S.warm = 0;
        update(1.0, S.time || 0);
      }
    }
    function setHour(hour, instant) {
      S.hour = hour;
      S.mode = 'hour';
      const H = ((hour % 24) + 24) % 24;
      const th = (H - 6) / 12 * Math.PI;   // 06:00 east, 12:00 high, 18:00 west
      const alt = Math.sin(th);
      S.sunTarget.set(Math.cos(th), alt * 0.80 + 0.025, 0.58).normalize();
      const daylight = U.smoothstep(-0.10, 0.18, S.sunTarget.y);
      S.target = daylight;
      // warm glow near the horizon, strongest at dawn/dusk, absent at noon/night
      const horizon = 1 - U.smoothstep(0.03, 0.38, Math.abs(S.sunTarget.y));
      S.warmTarget = U.clamp(horizon * (0.35 + 0.65 * daylight), 0, 1);
      if (instant) {
        S.dayMix = S.target;
        S.warm = S.warmTarget;
        day.sun.copy(S.sunTarget);
        update(1.0, S.time || 0);
      }
    }
    function update(dt, t) {
      S.time = t;
      S.dayMix = U.lerp(S.dayMix, S.target, 1 - Math.pow(.06, dt));
      S.warm = U.lerp(S.warm, S.warmTarget, 1 - Math.pow(.10, dt));
      day.sun.lerp(S.sunTarget, 1 - Math.pow(.02, dt));
      if (day.sun.lengthSq() < .01) day.sun.copy(S.sunTarget);
      const k = S.dayMix;
      const warm = S.warm;
      const high = U.smoothstep(0.04, 0.40, Math.abs(day.sun.y));
      S.sunColor.copy(SUN_WARM).lerp(SUN_DAY, high);
      S.horizonWarm.copy(HORIZON_WARM).lerp(HORIZON_HAZE, high);

      skyMat.uniforms.uSunDir.value.copy(day.sun);
      skyMat.uniforms.uDayMix.value = k;
      skyMat.uniforms.uTime.value = t;
      skyMat.uniforms.uWarm.value = warm;
      skyMat.uniforms.uSunColor.value.copy(S.sunColor);
      skyMat.uniforms.uWarmHorizon.value.copy(S.horizonWarm);

      seaUniforms.uDayMix.value = k;
      seaUniforms.uTime.value = t;
      seaUniforms.uSunDir.value.copy(day.sun);
      seaUniforms.uShallow.value.copy(shallowNight).lerp(shallowDay, k);
      seaUniforms.uDeep.value.copy(deepNight).lerp(deepDay, k);
      seaUniforms.uSky.value.copy(skyColNight).lerp(skyColDay, k).lerp(SEA_WARM, warm * 0.24 * k);
      seaUniforms.uHorizon.value.copy(horizonNight).lerp(horizonDay, k).lerp(HORIZON_WARM, warm * 0.45 * k);
      seaUniforms.uFogColor.value.copy(fogNight).lerp(fogDay, k).lerp(WARM_FOG, warm * 0.22 * k);
      APP.scene.fog.color.copy(fogNight).lerp(fogDay, k).lerp(WARM_FOG, warm * 0.22 * k);
      APP.scene.fog.density = U.lerp(.00102, .00062, k);
      seaUniforms.uFogDensity.value = APP.scene.fog.density;
      APP.renderer.toneMappingExposure = U.lerp(1.0, 1.0, k);

      S.sunSprite.position.copy(day.sun).multiplyScalar(3900);
      S.sunSprite.material.color.copy(S.sunColor);
      glow.position.copy(day.sun).multiplyScalar(3900);
      glow.material.color.copy(S.sunColor);
      S.sunSprite.material.opacity = U.lerp(.0, .42, k);
      S.moonSprite.material.opacity = U.lerp(.92, 0, k);
      if (S.starPoints) { S.starPoints.material.opacity = U.lerp(.95, 0, k); S.starPoints.visible = k < .99; }
      S.cloudSprites.forEach((sp, i) => {
        sp.material.opacity = cloudDefs[i].op * U.lerp(.10, 1, k);
        sp.material.color.copy(CLOUD_COOL).lerp(CLOUD_WARM, warm * 0.7);
        sp.position.x += dt * (1.2 + i * .35);
        if (i % 2) sp.position.z -= dt * .45;
        if (sp.position.x > 4200) sp.position.x = -4200;
      });
      glow.material.opacity = U.lerp(0, .40, k);
      if (APP.modules.atmos && APP.modules.atmos.setDayMix) APP.modules.atmos.setDayMix(k);
    }
    APP.updaters.push(update);

    APP.modules.sky = {
      group: g, sun: day.sun, moon, setTimeMode, setHour, update,
      skyMat, seaMat,
      get dayMix() { return S.dayMix; },
      get warm() { return S.warm; },
      get hour() { return S.hour; }
    };
    return APP.modules.sky;
  };
})();
