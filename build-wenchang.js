/* build-wenchang.js — assemble the single-file CZ-5 / Chang'e 7 / Wenchang scene.
 *
 *   node build-wenchang.js
 *   node build-wenchang.js --out=qa-wenchang/site/preview.html --bundle=qa-wenchang/site/app.js
 *   node build-wenchang.js --stub=site,payload
 *   node build-wenchang.js --out=... --list
 *
 * Missing modules are stubbed automatically. The Lead owns this file.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname);
const SRC = path.join(ROOT, 'src-wenchang');
const OUT_DEFAULT = 'wenchang-cz5-change7.html';

const MODULES = [
  { file: '10-util.js', owner: 'Lead' },
  { file: '20-sky.js', owner: 'Lead', builder: 'buildSky' },
  { file: '30-site.js', owner: 'site', builder: 'buildSite' },
  { file: '40-rocket.js', owner: 'rocket', builder: 'buildRocket' },
  { file: '45-interior.js', owner: 'interior', builder: 'buildInterior' },
  { file: '50-payload.js', owner: 'payload', builder: 'buildPayload' },
  { file: '60-atmos.js', owner: 'Lead', builder: 'buildAtmos' },
  { file: '65-post.js', owner: 'Lead', builder: 'buildPost' },
  { file: '70-ui.js', owner: 'ui' },
  { file: '80-cinematic.js', owner: 'Lead', builder: 'buildCinematic' },
  { file: '90-boot.js', owner: 'Lead' },
];

const STUBS = {
  buildSky: `window.buildSky = function (APP) {
  var g = U.group('stub-sky'); APP.scene.add(g);
  APP.scene.background = new T.Color(0x9fb6c2);
  APP.scene.fog = new T.Fog(0xb7c6cb, 320, 2800);
  var hemi = new T.HemisphereLight(0xe7f1f5, 0x5b5e50, 1.15); APP.scene.add(hemi);
  var sun = new T.DirectionalLight(0xfff1d8, 2.2); sun.position.set(120, 160, 80);
  sun.castShadow = true; APP.scene.add(sun);
  APP.modules.sky = { group: g, sun: sun };
  return APP.modules.sky;
};`,
  buildSite: `window.buildSite = function (APP) {
  var g = U.group('stub-site'); APP.scene.add(g);
  var mat = U.matStandard({color: 0x6d7166, roughness: .95});
  var ground = U.planeMesh(2400, 2400, mat, {rx: -Math.PI / 2, y: 0.0});
  ground.receiveShadow = true; g.add(ground);
  var pad = U.cylMesh(42, 42, 6.8, 40, U.matStandard({color: 0x8d8d85, roughness: .9}), {y: 3.4});
  pad.receiveShadow = true; g.add(pad);
  APP.modules.site = { group: g };
  return APP.modules.site;
};`,
  buildRocket: `window.buildRocket = function (APP) {
  var g = U.group('stub-rocket'); APP.scene.add(g);
  var m = U.matMetal(0xe8e8e2, .5);
  var core = U.cylMesh(2.5, 2.5, 33.16, 32, m, {y: SPEC.rocket.baseY + 16.58});
  core.castShadow = true; g.add(core);
  var fair = U.cylMesh(2.6, 2.6, 12.27, 32, m, {y: SPEC.rocket.baseY + 50.5});
  g.add(fair);
  APP.modules.rocket = { group: g, setCut: function (t) {}, setExplode: function (t) {} };
  return APP.modules.rocket;
};`,
  buildInterior: `window.buildInterior = function (APP) {
  var g = U.group('stub-interior'); APP.scene.add(g);
  APP.modules.interior = { group: g };
  return APP.modules.interior;
};`,
  buildPayload: `window.buildPayload = function (APP) {
  var g = U.group('stub-payload'); APP.scene.add(g);
  APP.modules.payload = { group: g, setExplode: function (t) {} };
  return APP.modules.payload;
};`,
  buildAtmos: `window.buildAtmos = function (APP) {
  var g = U.group('stub-atmos'); APP.scene.add(g);
  APP.modules.atmos = { group: g, setTimeMode: function () {} };
  return APP.modules.atmos;
};`,
  buildPost: `window.buildPost = function (APP) {
  APP.modules.post = { group: null };
  return APP.modules.post;
};`,
  buildCinematic: `window.buildCinematic = function (APP) {
  APP.cinematic = { onReady: function () {} };
  return APP.cinematic;
};`,
};

function parseArgs(argv) {
  const o = { stub: [], out: null, bundle: null, list: false };
  for (const a of argv.slice(2)) {
    if (a === '--list') o.list = true;
    else if (a.startsWith('--stub=')) o.stub = a.slice(7).split(',').map(s => s.trim()).filter(Boolean);
    else if (a.startsWith('--out=')) o.out = a.slice(6);
    else if (a.startsWith('--bundle=')) o.bundle = a.slice(9);
    else if (!a.startsWith('--')) o.out = a;
  }
  return o;
}

const args = parseArgs(process.argv);
if (args.list) {
  for (const m of MODULES) console.log((m.builder || '-').padEnd(16), m.file.padEnd(18), m.owner);
  process.exit(0);
}

const readIf = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null);
const readStrict = (p) => {
  const buf = fs.readFileSync(p);
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(buf);
    return text;
  } catch (e) {
    console.warn('WARN invalid UTF-8 in', p, '— Chinese text may be corrupt:', e.message);
    return buf.toString('utf8');
  }
};
const stubbed = new Set();

const parts = [];
for (const m of MODULES) {
  const p = path.join(SRC, m.file);
  let src = fs.existsSync(p) ? readStrict(p) : null;
  if (src !== null && src.includes('\uFFFD')) {
    console.warn('WARN U+FFFD replacement char in', p, '— inspect encoding');
  }
  const wantsStub = args.stub.includes(m.builder) ||
    args.stub.includes(m.file.replace(/\.js$/, '')) ||
    args.stub.includes(m.file.replace(/^\d+-|\.js$/g, ''));
  if (wantsStub && m.file === '70-ui.js') {
    parts.push(`/* ---- ${m.file} (stubbed) ---- */\n`);
    stubbed.add(m.file);
  } else if (wantsStub && m.builder) {
    parts.push(`/* ---- ${m.file} (stubbed) ---- */\n` + STUBS[m.builder] + '\n');
    stubbed.add(m.file);
  } else if (src === null) {
    if (m.builder && STUBS[m.builder]) {
      parts.push(`/* ---- ${m.file} (missing -> stub) ---- */\n` + STUBS[m.builder] + '\n');
      stubbed.add(m.file);
    } else if (m.file === '70-ui.js') {
      /* no UI is fine */
    } else {
      console.warn('WARN missing required module', m.file);
    }
  } else {
    src = src.replace(/^\uFEFF/, '');
    parts.push(`/* ---- ${m.file} ---- */\n` + src + '\n');
  }
}
const app = parts.join('\n');

const shell = fs.readFileSync(path.join(SRC, 'shell.html'), 'utf8');
const three = fs.readFileSync(path.join(ROOT, 'vendor', 'three.classic.js'), 'utf8');
const query = `(function(){var q={};try{location.search.replace(/^\\?/,"").split("&").forEach(function(kv){if(!kv)return;var i=kv.indexOf("=");var k=i<0?kv:kv.slice(0,i);q[decodeURIComponent(k)]=i<0?"1":decodeURIComponent(kv.slice(i+1));});}catch(e){}window.__Q__=q;})();`;
const appTag = '<script>\n' + query + '\n' + app + '\n</' + 'script>';
const threeTag = '<script>\n' + three + '\n</' + 'script>';

let out = shell;
if (out.includes('<!--THREE-->')) out = out.replace('<!--THREE-->', () => threeTag);
else out = out.replace('</head>', threeTag + '\n</head>');
if (out.includes('<!--APP-->')) out = out.replace('<!--APP-->', () => appTag);
else out = out.replace('</body>', appTag + '\n</body>');

const outRel = args.out || OUT_DEFAULT;
const outPath = path.isAbsolute(outRel) ? outRel : path.join(ROOT, outRel);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, out);
if (args.bundle) {
  const bp = path.isAbsolute(args.bundle) ? args.bundle : path.join(ROOT, args.bundle);
  fs.mkdirSync(path.dirname(bp), { recursive: true });
  fs.writeFileSync(bp, app);
}
console.log('Built', path.relative(ROOT, outPath), Buffer.byteLength(out), 'bytes',
  '(' + app.length + ' bytes app)', stubbed.size ? 'stubbed: ' + [...stubbed].join(',') : '');
