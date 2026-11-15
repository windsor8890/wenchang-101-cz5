# 文昌 101 · 长征五号 / 嫦娥七号 · 3D 剖视场景
## 制作契约 · AUTHORING CONTRACT (v1 — 2026-11-14, Lead)

Read this whole file before writing code. It is the single source of truth for
coordinates, module boundaries, shared helpers, flags, quality bar and QA commands.
If something is wrong or missing, **do not silently change shared conventions** —
write self-contained code and report the deviation to the Lead.

---

## 0. Deliverable

One self-contained HTML file that works from `file://` with no network and no build step
at runtime:

**`wenchang-cz5-change7.html`** — an interactive, cinematic 3D dossier of
**中国文昌航天发射场 101 工位** with a vertical **长征五号（CZ-5 / 遥十四）**
carrying the **嫦娥七号** lunar probe. The rocket has a beautiful, physically
credible **cutaway** that reveals stage tanks, domes, feed lines, engine plumbing,
the YZ-2 upper stage, and the four-part Chang'e 7 payload (orbiter / lander / rover /
hopper). It also has a stage-separation **exploded** view.

Three.js r160 is inlined by the build script. Everything is procedural: geometry,
canvas textures, decals, UI. No image / font / model downloads at runtime.

### Aesthetic direction — “南海之滨的航天档案 / AEROSPACE FIELD DOSSIER”

A refined, contemporary museum/technical-atlas interface laid over a cinematic
Hainan morning (or night) launch complex. Not a sci-fi game HUD, not a dark glass
dashboard. Think: a printed engineering folio on warm paper, precise vermilion
annotation marks, giant Chinese serif display type, and a real, breathing 3D scene
with tropical haze, turquoise sea, white lattice masts and the fat white CZ-5.

* UI palette: paper `#efe9dc`, ink `#1a1e1d`, secondary ink `#666a62`,
  vermilion accent `#c43a24`, faint warm rule `rgba(26,30,29,.16)`.
  The UI is opaque / near-opaque paper, **not** glassy blurred panels.
* Type: Noto Serif SC (display), Noto Sans SC (body) with system fallbacks.
  Two families only. Large display sizes, tight leading. No tiny all-caps
  letterspaced eyebrow labels. No rounded cards or pill buttons.
* Motion: calm, engineered. One slow opening reveal, smooth cutaway interpolation,
  restrained label draw-in. Everything must respect `prefers-reduced-motion`.
* The 3D scene is the hero. UI must frame it, never cover the rocket or the cutaway.

---

## 1. Coordinates, scale, layout (metres, 1 unit = 1 m)

Y up. Sea level / surrounding terrain = y 0. The launch pad is centred on the origin.

| anchor | value |
| --- | --- |
| pad deck top (concrete hardstand) | **y = 7.0** |
| mobile launch platform (MLP) footprint | 24 × 24 m centred, top **y = 12.2**, height 5.2 m |
| CZ-5 axis | **(x, z) = (0, 0)** |
| CZ-5 local y=0 (nozzle exit plane) | world **y = 13.8**; rocket top = world **y = 70.77** |
| rocket total height | **56.97 m** (CZ-5 / YZ-2 configuration) |
| core / stage diameter | **5.0 m** |
| payload fairing diameter | **5.2 m** |
| boosters | 4 × ⌀3.35 m × 27.6 m long |
| fixed service tower | centred **(-18.5, 0, 0)**, 16 × 16 m footprint, top **y ≈ 98.7** (91.7 m above deck) |
| lightning masts (4) | approx. (-58,±52) and (+58,±52), ~110 m tall, white lattice, catenary wires |
| water tower | approx. (-78, 0, -74), ~62 m tall |
| LOX / LH₂ tank farm | approx. (-145, 0, 48), low white/grey spheres + pipe racks |
| VAB (vertical assembly building) | distant landmark around (-900, 0, -650); two high bays, ~100 m tall |
| coastline | sea east of roughly **x ≈ +230** (irregular), coastal plain west of it |
| hero camera view | from the south-west (negative x / positive z), looking north-east across the pad — tower left of the rocket, sea horizon in the haze beyond the pad |

### CZ-5 local structure (local y from nozzle exit plane)

All modules must use these stations. Do not invent different tank boundaries.

| local y | element |
| --- | --- |
| 0.0 | YF-77 nozzle exit plane (2 engines, centres x = ±1.25, z = 0) |
| 0 – 2.9 | engine bells / engine bay |
| 2.6 – 4.4 | thrust structure |
| 4.4 – 16.2 | core **LH₂ tank** (aft); insulated, dome bottom |
| 16.2 – 17.0 | **common bulkhead** |
| 17.0 – 29.4 | core **LOX tank** (forward) |
| 29.4 – 33.16 | forward skirt (interstage lower) |
| 33.16 | **stage 1 / stage 2 separation plane** |
| 33.16 – 35.6 | stage-2 engine bay; 2 × YF-75D nozzles reach down to local y ≈ 31.7 |
| 35.6 – 43.4 | stage-2 LH₂ + LOX tanks (common bulkhead at ~39.4) |
| 43.4 – 44.70 | stage-2 forward skirt |
| 44.70 | **fairing separation plane** |
| 44.70 – 52.9 | YZ-2 upper stage (⌀3.8 m, 2 × YF-50D) + payload adapter |
| 49.8 – 56.3 | Chang'e 7 payload stack (adapter at 49.8–50.6) |
| 44.70 – 52.85 | fairing cylindrical / boat-tail section |
| 52.85 – 56.97 | fairing ogive nose |
| boosters | 4 × 27.6 m long: local y **1.6 → 29.2** |
| booster angles | 45°, 135°, 225°, 315° measured from +X toward +Z; centre distance **4.15 m** from rocket axis |
| booster engine centres | 2 × YF-100 per booster; separation plane same as stage 1 |

Payload (Chang'e 7) stack — the Lead owns the final positions; see `50-payload.js`
for exact anchors. Roughly: adapter 49.8; lander 50.7–53.0; orbiter 53.0–54.8;
rover folded under/inside lander; hopper small, docked to the lander side. Everything
must fit inside a 4.4 m usable fairing envelope. The payload is an **informed
illustration**, not an engineering drawing; all such text in the UI must say
`科普示意` where appropriate.

### World anchors for labels / cameras

Use `SPEC` for constants; return live `THREE.Vector3` getters from part metadata.

### Camera presets (Lead tunes, UI must drive)

| id | zh | intent |
| --- | --- | --- |
| `hero` | 全景 | wide 3/4 of pad + rocket + tower + sea haze; rocket about 55–65% of frame height |
| `tower` | 塔架 | closer, lower, highlights MLP, tower base, four lightning masts, tropical foreground |
| `cut` | 剖面 | right-of-axis 3/4, cutaway fills frame, payload visible |
| `payload` | 载荷 | tight on fairing/payload stack |
| `engine` | 动力 | low angle on engine section and boosters, showing engine bells |

Intro flies from a wide sea-side view into `hero` over ~3.5 s. `?instant=1&still=1`
must skip all intros/drift.

---

## 2. Files, ownership, write scopes

Work only in these paths. Do not edit files owned by another member. Do not run the
final build against the shared deliverable name — build only your own preview.

| file | owner | contents |
| --- | --- | --- |
| `src-wenchang/CONTRACT.md` | Lead | this file |
| `src-wenchang/10-util.js` | Lead | shared helpers, SPEC, palette, canvas textures, materials |
| `src-wenchang/20-sky.js` | Lead | sky dome, sun/moon/stars, clouds, sea surface, environment, fog |
| `src-wenchang/30-site.js` | **site** | terrain, coast, pad deck, flame trench, MLP, fixed service tower, swing arms, lightning masts, water tower, tank farm, VAB + distant site, roads, fences, vegetation |
| `src-wenchang/40-rocket.js` | **rocket** | CZ-5 exterior: core, boosters, interstage, stage 2, fairing, engine bells, decals, cutaway shell behaviour, stage explode motion, part metadata |
| `src-wenchang/45-interior.js` | **interior** | rocket internals: tanks, domes, ring frames, stringers, common bulkheads, feed lines, valves, turbopumps, thrust structure, interstage, stage-2 / YZ-2 internals, booster internals, cut faces, internal labels metadata |
| `src-wenchang/50-payload.js` | **payload** | YZ-2 upper stage (external + inner tank detail? coordinate with interior), Chang'e 7 orbiter / lander / rover / hopper, payload adapter, fairing interior acoustic blanket + separation rail, payload exploded motion, metadata |
| `src-wenchang/60-atmos.js` | Lead | lighting rig day/night, pad floodlights, cryogenic vent vapour, dust/motes, cutaway fill light, shadow tuning |
| `src-wenchang/65-post.js` | Lead | (optional) cheap post or CSS-only; no external requests |
| `src-wenchang/70-ui.js` | **ui** | all DOM behaviour: boot overlay, top bar, mode tabs, cut slider, view dock, part index, detail card, labels projection, toasts, mobile layout wiring |
| `src-wenchang/shell.html` | **ui** | HTML + CSS for the whole page (Lead seeded a v0 skeleton; you own it from now on) |
| `src-wenchang/90-boot.js` | Lead | assembly, renderer, camera, cutaway/explode controller, labels registry, flags, QA hooks |
| `src-wenchang/88-fonts.css`? | Lead | optional embedded font subset (do not touch) |
| `build-wenchang.js` | Lead | build tool |
| `qa-wenchang/**` | Lead | screenshot / interactions / probe scripts |
| `qa-wenchang/<owner>/**` | each owner | your own previews/screenshots — never write outside your folder |

Tell the Lead (send_message) when your module is done, with (a) files, (b) exact
preview/screenshot paths, (c) what you verified, (d) what is intentionally left out.

---

## 3. Build, preview, screenshot

```powershell
# full build (Lead only) — writes wenchang-cz5-change7.html
node build-wenchang.js

# member build — writes YOUR preview html + optional app bundle
node build-wenchang.js --out=qa-wenchang/site/preview.html --bundle=qa-wenchang/site/app.js
```

Missing modules are auto-stubbed, so a member build always works. Your own module is
never stubbed. Use these query flags while iterating:

`?instant=1&still=1&lq=1&pr=1` fastest state · `?noui=1` hide HUD ·
`?nolabels=1` hide labels · `?mode=cut` / `?mode=explode` / `?mode=overall` ·
`?cut=0.65` fixed cut amount · `?view=hero|tower|cut|payload|engine` ·
`?time=night` · `?cam=azim,elev,dist,tx,ty,tz[,fov]` free camera.

```powershell
# screenshot: Playwright + installed Chrome (SwiftShader). ~10–40 s per shot. Be patient.
python qa-wenchang/shot.py --file qa-wenchang/site/preview.html `
  --query "instant=1&still=1&lq=1&pr=1&view=hero&noui=1" --out qa-wenchang/site/a.png --w 1440 --h 900
```

The page sets `window.__READY__ = true` after the first rendered frame and exposes
`window.__METRICS__ = {draws, tris, fps, build}`. It shows a red `#err` panel on a
thrown error; a screenshot with that panel is a fail. Keep the console error-free.

---

## 4. Scene assembly API

Every builder is a global function with this signature: `function buildX(APP)`. The
Lead's boot calls them in this order:

```js
buildSky(APP);      // APP.modules.sky
buildSite(APP);     // APP.modules.site
buildRocket(APP);   // APP.modules.rocket   — exterior shells, clipping
buildInterior(APP); // APP.modules.interior — internals
buildPayload(APP);  // APP.modules.payload  — Chang'e 7 + YZ-2 + fairing interior
buildAtmos(APP);    // APP.modules.atmos
if (window.HUD) HUD.init(APP);
```

Each builder must:

1. create content under its **own** `T.Group`, added to `APP.scene` (except pure data);
2. not add lights unless explicitly allowed (interior may add 2 small point lights at
   most for the cutaway; site may add none; tell the Lead where floodlights are);
3. finish comfortably within ~1 s CPU; no network, no external images/fonts;
4. use `APP.registerPart(id, meta)` for annotatable parts (see §5);
5. register motion callbacks with `APP.cutables.push(fn)`, `APP.explodables.push(fn)`,
   `APP.timeables.push(fn)` as needed. The Lead drives them with normalised `t`;
6. use `U.shadowize` deliberately, cast/receive shadows on major structures;
7. be idempotent-safe (builders are called once).

### Shared globals (provided by `10-util.js` / boot)

```js
T                   // window.THREE
PI, TAU, DEG, RAD, clamp, lerp, smooth, smoothstep, fract
Q                   // parsed URL query
FLAGS               // {instant, still, raw, lq, pr, view, mode, cut, time, noui, nolabels, cam, only}
SPEC                // constants: pad, rocket stations, booster layout, tower, palette
APP                 // { scene, camera, renderer, modules, parts, cutables, explodables,
                    //   timeables, updaters, actions, views, quality, cutPlane, registerPart }
U                   // helpers (see §6)
MAT                 // material registry via MAT.get(name)
reportError(msg)    // appends to #err + console.error
```

### Labels / part metadata — use this exact schema

```js
APP.registerPart('stage1', {
  zh: '芯一级', en: 'CORE STAGE 1',
  section: '火箭结构',        // UI index grouping
  modes: ['cut', 'explode'],  // where the label should be eligible to show
  anchor: () => worldVec3,    // required: a live THREE.Vector3 getter (world space)
  group,                      // optional Object3D for selection/flying
  specs: [['长度', '33.16 m'], ['推进剂', '液氢 / 液氧']],
  desc: '……两段式低温贮箱……',  // 40–90 Chinese characters, write real content
  index: true                 // false for site landmarks not in the structure index
});
```

Required part ids (use these exact ids; register from the named module):

`fairing` (rocket), `change7` (payload), `orbiter` (payload), `lander` (payload),
`rover` (payload), `hopper` (payload), `yz2` (payload), `stage2` (rocket),
`stage1` (rocket), `booster` (rocket), `core_engine` (rocket), `booster_engine`
(rocket), plus site-only: `tower`, `launch_mount`, `lightning`, `vab`, `sea`.
Site ones have `index:false`, `modes:['overall']`.

`APP.views` is Lead-provided: `[{id, zh, en}]` in hero, tower, cut, payload, engine order.

---

## 5. Module interfaces in detail

### `30-site.js` (owner: site)

`window.buildSite = function(APP) -> { group, ... }`

Build, in priority order (detail > object count; aim for a believable real place,
not a low-poly launch icon):

1. **Coastal ground**: a large gently irregular terrain / hardstand apron in warm
   concrete and sandy tropical grass; coastline with wet sand, rocks and shallow
   turquoise water transition at x ≈ +230 (the Lead owns the open sea surface; you
   own the beach/shore band and land). Dense but low tree line beyond the apron
   (casuarina / coconut palms). Haze handles the distance.
2. **101 pad**: 78 × 70 m raised concrete hardstand, expansion joints, blast staining,
   painted safety lines, hazard chevrons, access stairs, bollards, floodlight poles.
   Flame trench opening under the MLP, steel flame deflector, deluge pipes and nozzles,
   water runoff channels.
3. **Mobile launch platform**: 24 × 24 m dark steel box at y 7.0–12.2, hold-down
   posts / clamps reaching up around the rocket tail, umbilical mast, exhaust duct
   openings, railings, stairs, cable trays. This is the rocket's visible base — high
   detail here pays off in hero and engine shots.
4. **Fixed service tower** at (-18.5, 0, 0): 91.7 m tall. A convincing Chinese
   launch-tower read: grey/white steel lattice frame, large blue-grey enclosed
   service building panels on the exterior, orange/vermilion platform edges,
   elevators, stairs, handrails, cable trays, 3–4 retractable swing arms toward the
   rocket at ~30/44/58/66 m, a hammerhead crane on top, red aviation obstruction
   lights. Reference photos in `refs/wenchang/cz5-pad-01..03.jpg`.
5. **Four lightning masts**: white lattice towers ~110 m at approximately (-58,±52)
   and (+58,±52) with finials and catenary wires, plus warm floodlight heads at
   ~2/3 height (physical geometry only; Lead lights them).
6. **Site services + distance**: water tower at (-78,0,-74); LOX/LH₂ tank farm west;
   propellant pipe racks; perimeter fence; service roads; small blockhouses; sea-side
   beach; VAB far landmark with two high bays + a faint second pad; a few service
   vehicles / tiny human figures for scale; coconut palms. Keep the hero sightline
   clear: no tall structure between the hero camera and the rocket except the frame
   of masts/trees at the edges.
7. **Night read**: everything must look good unlit/day, and be ready for Lead's night
   rig: add emissive lamp heads, obstruction lights, window strips, tower work lights.
   Register `tower`, `launch_mount`, `lightning`, `vab`, `sea` metadata. Site does not
   add actual lights.

Budget ≈ 300k triangles, ≤ 180 draw calls. Use instancing for palm fronds, fence
posts, railings, bolts; merged geometry for lattice members. No giant single texture
over 2048². Keep hero-camera-relevant detail dense and distant detail economical.

### `40-rocket.js` (owner: rocket)

`window.buildRocket = function(APP) -> { group, setCut(t), setExplode(t), ... }`

Build the complete exterior of CZ-5 in the **遥十四 / 嫦娥七号** configuration:

* core stage (5 m ⌀, 33.16 m), interstage ring, second stage (11.54 m), payload
  fairing (5.2 m ⌀, 12.27 m, ogive nose), 4 boosters (3.35 m ⌀, 27.6 m, X-layout).
* surfaces: warm white paint, subtle panel seams, longitudinal raceways, ring
  stiffener highlights, frost / vent streaks, black thermal bands, hardware. Real
  CZ-5 markings via canvas decals: PRC flag, CASC logo, 「中国航天」 vertical text,
  serial numbers, fairing separation stripe, “CZ-5” marking, hazard marks near engines.
  Use the reference photos in `refs/wenchang/`.
* engine section exterior: 2 × YF-77 bells under the core and 2 × YF-100 bells under
  each booster (8 total), with ribbed/cooling-tube exterior, gimbal hardware visible
  from below, dark heat-stained metal; MLP clamps should grip the tail (positions from
  the site module are not required — just leave the tail geometry clear).
* **cutaway shells**: core / interstage / stage 2 / fairing shells must be clipped by
  `APP.cutPlane` (`T.Plane`, world-space, normal -X at x≈+2.8 → 0). Attach the same
  plane to your shell materials; expose `setCut(t)` that the Lead also drives. At
  t=0 the plane is parked outboard (no visual change), at t=1 only x < 0 remains:
  the camera-side half is removed, exposing the interior. Use `DoubleSide`, correct
  normals, and add a slim warm-red cut-edge strip / section band so the cut reads as
  a deliberate section, not missing geometry. Do not clip the engine bells.
* **boosters in cut mode**: do not half-clip the four boosters (they'd look odd).
  Fade booster outer shells to ~0.18 opacity + faint wireframe / seam lines when
  `t > 0.02`, so the interior can be seen. Restore opaque in overall/explode.
* **explode mode**: `setExplode(t)` separates the stack vertically with clear gaps:
  stage-1 + its engines stay fixed; **stage-2 shell +4.0 m up**; **fairing shell
  +14.0 m up**; **boosters radially outward +2.0 m and up +0.8 m**. YZ-2 / payload
  and their internals move **+4.0 m** with stage 2 (moved by payload/interior).
  Animate smooth; keep the assembly anchored at the thrust structure. The Lead will
  combine with labels. Do not move payload/YZ-2 geometry from this module.
* engine ownership: this module builds the exterior of **2 × YF-77** and
  **8 × YF-100** only; `45-interior.js` builds the 2 × YF-75D engines (including
  their outer bells) that reach down into the interstage.
* register `fairing`, `stage2`, `stage1`, `booster`, `core_engine`, `booster_engine`
  metadata with good anchor getters and 2–5 real specs each. Interior will not
  overwrite stage1/stage2.
* expose `userData.shells`, `userData.boosterShells` if useful to the Lead.

### Explode offsets — single source of truth

Global `分解` mode drives all `APP.explodables` with `t 0→1`:

| module | movement |
| --- | --- |
| rocket | stage-1/engines fixed; stage-2 shell **+4.0 m**; fairing shell **+14.0 m**; booster shells **+2.0 m radial, +0.8 m up** |
| interior | stage-2 internals **+4.0 m**; YZ-2 internals **+4.0 m**; booster internals **+2.0 m radial, +0.8 m up**; core internals fixed; hide cut-face caps when plane constant > 2.5 |
| payload | YZ-2 + payload stack **+4.0 m**; then orbiter **+2.2 m**, rover **+1.4 m +Z**, hopper **−1.2 m X / −0.6 m Z**, lander fixed |
| site / sky | fixed |

The boot owns `APP.cutPlane.constant`; geometry modules must never write it. The boot
updates it **before** calling cutables, so `setCut` should read it for section caps.
Interior materials must not attach the clipping plane (only exterior shells clip).

Budget ≈ 140k triangles, ≤ 100 draw calls. Reuse geometries. Prefer quality close
to the hero framing (rocket occupies 50–65% of frame height at hero, and close-ups
at cut/payload/engine).

### `45-interior.js` (owner: interior)

`window.buildInterior = function(APP) -> { group, setCut(t), ... }`

This is the **heart of the cutaway**. Build in metres, using the station table in §1.
All geometry lies inside the shells; it will only be seen through the cutaway, but it
must be complete enough to hold close inspection.

Required:

* **Core stage 1**: LH₂ tank (aft) + LOX tank (fwd), thin inner walls + stringers +
  ring frames + slosh baffles; ellipsoidal domes; common bulkhead with thickness;
  insulated tank exteriors (warm gold/white MLI); propellant feed ducts running to
  the thrust structure; pressurisation lines, helium bottles, valves and sensors;
  cable raceways; engine thrust frame; tail section internals; 2 × YF-77 turbopumps,
  gas generators, gimbal actuators, heat exchangers, pipework and bell interiors.
* **Stage 2**: 2 × YF-75D engine plumbing + tanks + common bulkhead + attitude
  control thruster modules; interstage truss; separation pushers; avionics boxes.
* **YZ-2**: compact 3.8 m stage: propellant tanks, 2 × YF-50D engines, avionics,
  separation hardware (payload module may build the exterior; coordinate by keeping
  your YZ-2 internals in the 44.7–49.8 m band; the payload module owns its skirt and
  the 49.8+ adapter).
* **Boosters** (4): each with LOX tank (upper), kerosene tank (lower), common
  bulkhead, feed lines, turbopumps, 2 × YF-100 engines, gimbal actuators, separation
  struts and pyro covers. The camera side boosters are ghosted in cut mode.
* **Cut faces**: add section bands / annular wall thickness / a painted cut edge at
  the x≈0 cut plane so the section reads as material; include a few deliberately
  “cut” pipes and a visible cross-section of a tank wall. Warm-red accent permitted.
* **Internal lighting**: add at most 2 small point lights (warm white, low intensity,
  physically small) inside the core to make the cutaway legible; these are allowed
  by contract. Do not add shadows to them (shadow maps only from Lead's key light).
* **Labels**: register `stage1`, `stage2`, plus anchor sub-parts? Register only the
  required ids; extra anchors via `APP.registerPart` are allowed for `tank_lh2`,
  `tank_lox`, `yf77`, `yf100` if you want richer labels — but the UI will show at most
  6 at a time. Keep descriptions factual.
* Respect `setCut(t)`: optional internal cross-section caps can fade in; venting
  effects are Lead's.
* Register `APP.cutables.push(fn)` if your cut faces fade; otherwise no callback.

Budget ≈ 160k triangles, ≤ 150 draw calls. Use instancing for bolts, stringers,
baffles, pipes where sensible. No zero-length normals / NaN transforms.

### `50-payload.js` (owner: payload)

`window.buildPayload = function(APP) -> { group, setExplode(t), ... }`

Build the upper stack in the 44.7–56.97 m envelope:

* **YZ-2 upper stage exterior** (44.7–49.8, ⌀3.8 m, white/MLI, 2 small YF-50D
  nozzles pointing down, separation hardware, small avionics; the interior module
  adds internal detail). Adapter cone/ring 49.8–50.6.
* **Chang'e 7**: a fictional-but-informed, physically coherent stack:
  * **orbiter** — main bus, folded solar wings along the sides, high-gain antenna,
    relay/science instruments, RCS pods, gold MLI; sits above the lander;
  * **lander** — 4 landing legs folded against the body, main descent engine bell,
    propellant tanks inside a central cylinder, deck with instrument package, hazard
    avoidance sensors, gold/white thermal blankets, national flag / mission markings;
  * **rover** — 6 wheels, foldable solar panel, mast with cameras, folded in its
    launch cradle on the lander;
  * **hopper（飞跃器）** — compact 4-legged jumping robot docked to the lander, with
    its own thruster cluster / instruments (this is the mission's signature element —
    make it recognizable, ~1.2 m);
  * structural stack, hold-down / separation mechanisms, cabling.
* Fairing interior surfaces: acoustic blanket texture, separation rails/ordnance,
  vents — visible through the cutaway (coordinate with rocket: don't duplicate the
  fairing shell).
* **setExplode(t)**: payload-only explode for the “载荷” close-up: orbiter lifts
  ~2.5 m, lander stays, rover slides out +Z, hopper slides out -X/-Z, all with
  floating labels. This should look like a clean museum display, not an explosion.
* register `change7`, `orbiter`, `lander`, `rover`, `hopper`, `yz2` metadata.
  Descriptions must be mission-accurate and marked `科普示意` in the UI where needed.
* Budget ≈ 120k triangles, ≤ 100 draw calls. Gold MLI should read as gold foil via
  material + subtle procedural texture, not a flat yellow.

### `70-ui.js` + `shell.html` (owner: ui)

The UI is first-class. Read `APP.parts`, `APP.views`, `APP.actions`, register callbacks
with `HUD`; never mutate 3D geometry directly (call actions).

Required layout on desktop (1440×900 and 1920×1080):

* **Boot overlay**: warm paper, an abstract but real line drawing of the CZ-5
  silhouette (SVG), huge serif 「文昌」, subline 「中国文昌航天发射场 · 101 工位」,
  a thin progress/status line that actually tracks load/first frame, then fades.
* **Top-left identity block**: small SVG mission mark (can be a red rocket/crescent),
  title in large serif: 「长征五号 · 嫦娥七号」, subline: 「中国文昌航天发射场 101 工位」,
  a live status line `待发状态 / READY ON PAD` with a subtle red dot. Do not use a
  tiny uppercase eyebrow label.
* **Top-right utilities**: 日间/夜间 toggle, 标注 toggle, 全屏. Text buttons, flat,
  square corners, hover/focus states. Maybe a short “?” help.
* **Left part index** (appears in `cut` and `explode` modes; hidden in `hero`):
  grouped list (`火箭结构` / `探测器`), 6–8 rows, Chinese + small English; hover
  previews label, click selects part + flies camera + opens detail card. Active row
  has vermilion mark. No rounded pills, no glass.
* **Bottom dock** (always): mode tabs `整体 / 剖视 / 分解` (large-ish type), a cut
  slider visible in 剖视 (0–100%), and 5 view buttons `全景 / 塔架 / 剖面 / 载荷 /
  动力`. Keyboard 1–5 for views, C for cut, X for explode, N for night, L for labels,
  F fullscreen, Esc closes detail. Ensure focus styles.
* **Readout plate** (bottom-left or top-left under title): 高度 56.97 m · 芯级直径
  5.0 m · 起飞质量 851.8 t · 起飞推力 1,078 tf · 地月转移轨道 8.8–9.4 t. Terse,
  typographic, tabular numerals. Mark `数据来自公开资料` small. Do not invent
  launch dates or a countdown; status is “待发 / 任务准备中”.
* **Detail card** (right side): part name (serif), EN, description, specs rows,
  “定位 / LOCATE” + close. Opaque paper, subtle drop shadow only because it floats.
  Must not cover the cutaway centre; max-width ~340px.
* **3D labels**: project `APP.parts[*].anchor()` with `APP.camera`; show up to 6
  at once for the current mode, with a 1 px leader line and a small dot; the text
  sits on a paper chip or directly on the scene with a subtle paper backing. Labels
  must not overlap the title or dock; clamp to safe area. On hover/click they set
  the active part. Must keep 60 fps (no layout thrash per part if avoidable; use
  transforms, one rAF shared with APP).
* **Mobile ≤ 760 px**: identity shrinks; top utilities condense; part index becomes
  a horizontal strip or closed sheet; dock becomes a bottom sheet with mode tabs +
  view buttons; labels show max 3; detail card is a bottom sheet. No horizontal
  overflow at 390 × 844. Touch drag orbits.
* **Reduced motion**: disable boot line animation, label draw-ins, and any looping
  UI motion; keep transitions short or none.
* Use `Noto Serif SC` + `Noto Sans SC` via local font stacks; Chinese must render.
  Palette per §0. No external assets, no blur/glass, no gradients as UI surfaces.
* **Do not add a fake launch countdown, fake telemetry or a fake mission date.**
  Values must be public-data accurate. Mark illustrative structure as 科普示意.

Stub-compatible: on load, `70-ui.js` defines `window.HUD`. `boot` calls
`HUD.init(APP)` after builders. `HUD.init` may be called when modules are missing;
guard all reads. Provide these methods:

```js
window.HUD = {
  init(APP) {},
  ready() {},                     // fade out boot
  setMode(mode) {},               // overall | cut | explode
  setView(id) {},
  setCut(v) {},                   // 0..1
  setSelectedPart(idOrNull) {},
  setLabelsVisible(on) {},
  setTimeMode(mode) {},           // day | night
  toast(text) {},
  update(dt, t, metrics) {},      // label projection, clock, tiny live bits
};
```

`APP.actions` (Lead-provided): `setMode(mode)`, `setView(id)`, `setCut(v)`,
`setTimeMode(mode)`, `setLabelsVisible(on)`, `selectPart(id)`, `focusPart(id)`,
`toggleFullscreen()`, `getState()`. `APP.views` as above.
`APP.parts` is `{id: meta}`; `APP.partsOrder` is the ordered id list.

The UI must be visible and usable even if WebGL is slow: the boot overlay must resolve
on `__READY__` or after a 6 s fallback; never trap the user behind a spinner.

---

## 6. Shared helpers — `10-util.js`

Core helpers (full list in file; this is the contract surface):

```js
U.group(name, parent)
U.matStandard({color, roughness, metalness, map, normalMap, emissive, emissiveIntensity, ...})
U.matMetal(color, roughness)      U.matEmissive(color, intensity)
U.matBasic({color,...})           U.matGlass({color, opacity, ...})
U.texCanvas(w, h, draw)           // -> {cv, ctx, tex}
U.texText(text, opts)             // canvas label / decal texture
U.texRadial(size, stops)          // white radial falloff for glow sprites
U.texNoise(size, opts)            // greyscale fbm
U.texStripe(w, h, {a,b,stripe})   // hazard stripes
U.texConcrete(opts)               // {map, bump, rough} for pads/hardstand
U.decal(parent, tex, opts)        // transparent plane decal
U.sprite(tex, color, size, opacity)
U.boxMesh(w,h,d,mat,opts)         U.cylMesh(rt,rb,h,seg,mat,opts)
U.planeMesh(w,h,mat,opts)         U.lathe(points, seg, opts)
U.tube(points, radius, seg, radialSeg)
U.instanced(geo, mat, list, opts)
U.mergeGeometries(geos)
U.shadowize(obj, cast, receive)
U.roundedBox(w,h,d,r,seg)
```

`MAT.get(name)` lazily returns a material; register shared ones with
`U.defineMat(name, factory)`. The Lead prepopulates: `paintWhite`, `paintGrey`,
`steel`, `steelDark`, `concrete`, `concretePale`, `asphalt`, `goldMLI`, `foilSilver`,
`nozzleMetal`, `copper`, `hazard`, `glowWarm`, `glowRed`, `glowWhite`, `ocean`,
`foliage`, `trunk`, `sand`, `blackMatte`. If you need a missing material, create your
own locally and name it clearly; do not silently override another module's.

**Geometry hygiene**: no NaN transforms, no zero-length normals, no degenerate
extrusions. Known workspace bug: zero-area faces bloom into black clouds. Guard.

---

## 7. Technical data to use (public sources)

CZ-5 / YZ-2 configuration (Chang'e 7 / 遥十四):
* height **56.97 m**, core ⌀ **5 m**, liftoff mass **851.8 t** (CZ-5; ~869 t often
  quoted for earlier configs — use 851.8 t and say 公开资料)
* liftoff thrust **~1,078 tf / 10,565 kN** (8 × YF-100 + 2 × YF-77)
* LEO 25 t (CZ-5B), GTO 14.5 t, **TLI 8.8–9.4 t**
* stage 1: 2 × YF-77, LH₂/LOX, 33.16 m, 5 m
* boosters: 4 × 27.6 m × ⌀3.35 m, 2 × YF-100 each, LOX/kerosene
* stage 2: 2 × YF-75D, LH₂/LOX, 11.54 m, 5 m
* YZ-2 upper stage: ⌀3.8 m, 2 × YF-50D (N₂O₄/UDMH), optional third stage
* fairing: ⌀5.2 m, ~12.27 m

Chang'e 7:
* mission: lunar south pole (Shackleton crater highland), `绕、落、巡、飞跃` integrated
  exploration; consists of **orbiter / lander / rover / hopper (飞跃器)** plus the
  **鹊桥二号** relay satellite (already in lunar orbit, not part of this stack)
* goals: lunar surface environment, regolith water ice / volatiles, south-pole
  topography, shallow subsurface structure, moonquakes, magnetic field, thermal
  properties, lunar-based astronomy, international payloads
* launch: Wenchang LC-101, CZ-5 Y14; planned/held in 2026→2027 — do not state a
  launch date, just 待发状态 / 任务准备中

Wenchang LC-101: fixed service tower 91.7 m; four lightning masts; coastal tropical
site; VAB about 2.8 km from the pads. References: `refs/wenchang/cz5-pad-01.jpg`
(day, real tower + 4 masts + tree line), `cz5-pad-02.jpg` (night lighting),
`cz5-pad-03.jpg` (launch plume, not needed), `cz5-model.png` (fairing markings /
booster arrangement), `cz5-rollout-y8.jpg` (rollout).

If the UI says 科普示意 or 公开资料整理 anywhere, that is correct and desirable.

---

## 8. Quality bar / acceptance

* Reads instantly as **Wenchang LC-101 with a CZ-5 on the pad**, not a generic
  launch pad: tropical haze, white lattice masts, blue-grey service structure,
  fat white core with four boosters, the sea beyond.
* Cutaway is the signature moment: half-section is clean and deliberate, internals
  are dense and plausible, labels are legible, no z-fighting/floating parts, no
  black artifacts, no obviously missing tank walls. A non-expert should understand
  “一级 / 二级 / 上面级 / 整流罩里的嫦娥七号”.
* UI looks designed for this subject, not a template: paper/ink/vermilion dossier,
  strong type, calm motion. No glass, gradients, pill nav, emoji, fake dashboards.
* 60 fps target at 1440×900 on a real GPU; SwiftShader headless renders a shot
  within ~45 s. Total scene ≤ 700k tris, ≤ 320 draw calls, one 2048/4096 shadow map.
* Console error-free; no network requests; works from `file://`; Chinese renders.
* Mobile 390×844 usable: no overflow, controls reachable, rocket readable.
* `prefers-reduced-motion` respected.

## 9. Reporting

When complete, message the Lead with:
`module done` + files touched + build/screenshot commands + exact screenshot paths
+ verification notes (console, fps/tris, mobile) + anything intentionally omitted.
Keep it short. Do not edit another owner's files.
