/* ============================================================
   대기대순환 3D — core.js
   Three.js 기본 설정 · 상태 · 공용 유틸 · 강조 시스템 · 공유 재질 · 3D 태양
   ============================================================ */
"use strict";

/* 여러 스크립트 파일이 전역 스코프를 공유합니다(더블클릭 실행을 위해 ES 모듈 대신 일반 <script> 사용).
   준비 실패 시 fatal()로 안내를 띄우고 예외를 던져 이후 초기화를 멈춥니다. */
var loadingEl = document.getElementById("loading");
var APP_FAILED = false;
function fatal(msg) {
  APP_FAILED = true;
  loadingEl.classList.remove("hide");
  loadingEl.innerHTML = "<p style='color:#c2410c; max-width:340px; text-align:center; line-height:1.7'>" + msg + "</p>";
}
if (typeof THREE === "undefined") {
  fatal("3D 라이브러리를 불러오지 못했습니다.<br><b>libs/three.min.js</b> 파일이 폴더 안에 함께 있는지 확인해 주세요.");
  throw new Error("THREE not loaded");
}

const DEG = Math.PI / 180;
const REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* 애니메이션 속도 — 교사가 화면에서 고름(느리게 0.65 · 보통 1 · 빠르게 1.5).
   그리기·보기 전환·계절 이동·바람 휘어짐·카메라 이동·자동 재생 대기 시간에 적용 */
const ANIM_SPEEDS = [{ v: 0.65, name: "느리게" }, { v: 1, name: "보통" }, { v: 1.5, name: "빠르게" }];
let animSpeed = 1;

/* 움직임 시간 토큰(초) — 모든 연출은 이 세 가지 길이 중 하나를 씀
   short: 튀어나오기·강조 전환 / base: 화살표 그리기·카메라 이동 / long: 휘어짐·구름 생성 등 큰 변화 */
const DUR = { short: 0.4, base: 0.9, long: 1.8 };

/* ============================================================
   2. Three.js 기본 설정
   ============================================================ */
const canvas = document.getElementById("scene");
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
} catch (e) {
  fatal("이 기기에서 3D 화면(WebGL)을 사용할 수 없습니다.<br>크롬(Chrome) 브라우저로 다시 열어 주세요.");
  throw e;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
if ("outputColorSpace" in renderer && THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const FOV = 45, TANF = Math.tan(FOV / 2 * DEG);
const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
camera.position.set(0, 0, 5.4);

const ambient = new THREE.AmbientLight(0xffffff, 0.55);
scene.add(ambient);
const hemi = new THREE.HemisphereLight(0xffffff, 0xd8e4f2, 1.1);
scene.add(hemi);
const key = new THREE.DirectionalLight(0xffffff, 1.7);
key.position.set(4, 3, 6);
scene.add(key);
/* 반대편 은은한 푸른 역광 — 튜브·지구의 어두운 면이 죽지 않게 */
const rimLight = new THREE.DirectionalLight(0xbcd6ff, 0.55);
rimLight.position.set(-5, -2, -4);
scene.add(rimLight);

const ROOT = new THREE.Group();       scene.add(ROOT);
const globeGroup = new THREE.Group(); ROOT.add(globeGroup);
globeGroup.rotation.order = "ZXY";   // z(화면 기준 회전)는 단면 전환 연출에서만 사용
const crossGroup = new THREE.Group(); ROOT.add(crossGroup);

const R = 1.5;              // 지구 반지름
const SHIFT_MAX = 10;       // 계절 이동 최대(도)

/* 상태 */
const state = {
  view: "globe",
  season: 0,                // 목표 계절: -1(1월) .. 0 .. +1(7월) — 8단계에서 장면별로 설정
  seasonCur: 0,             // 화면에 보이는 계절 (목표를 향해 서서히 이동)
  layers: { insol:false, cells:false, belts:true, winds:true, coriolis:true, precip:false, grid:false },
  stepIndex: -1,            // 현재 단계(-1 = 시작 전)
  beatIndex: -1,            // 현재 장면
  focus: null,              // 강조할 태그 목록 (나머지는 흐리게)
  hide: OPTIONAL_TAGS.slice(),   // 숨길 태그 목록 (장면 연출용) — 자전 표시·지역 마커는 기본 숨김
  showPressure: true,       // 지구본 기압대의 저기압 L / 고기압 H 라벨
  draw: {},                 // 그리기 진행도 (태그 → 값, effects.js)
  parcel: []                // 재생 중인 공기 덩어리 (effects.js)
};
/* 기압대 이동량(도) — 지금 화면에 보이는 계절(seasonCur, 애니메이션 중 연속으로 변함) 기준 */
function seasonShift() { return state.seasonCur * SHIFT_MAX; }
function clampLat(v) { return Math.max(-89, Math.min(89, v)); }

/* ============================================================
   3. 공용 유틸
   ============================================================ */
function setSRGB(tex) {
  if ("colorSpace" in tex && THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
/* 위도·경도 → 지구본 좌표. 지구 사진(텍스처)과 같은 방향: 경도가 커질수록 동쪽 */
function latLonToVec(lat, lon, r) {
  const phi = (90 - lat) * DEG, theta = lon * DEG;
  return new THREE.Vector3(
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    -r * Math.sin(phi) * Math.sin(theta)
  );
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

/* 한국어 표기 다듬기 — 화면에 넣는 문장(HTML)에 적용
   · 숫자+단위(23.5°N, 10°~20°, 60°)는 줄 끝에서 떨어지지 않게 <span class="nw">로 감쌈
   · "위도 30°"처럼 앞말과 숫자, "바람 — 무역풍"의 줄표는 앞말에 붙여 줄 맨 앞에 오지 않게
   (태그 안쪽은 건드리지 않음) */
function fmtKo(html) {
  return String(html == null ? "" : html).split(/(<[^>]+>)/).map(function (part) {
    if (part.charAt(0) === "<") return part;
    return part
      .replace(/(\d+(?:\.\d+)?°[NS]?(?:\s*~\s*\d+(?:\.\d+)?°[NS]?)?)/g, '<span class="nw">$1</span>')
      .replace(/(위도|북위|남위|약)\s+(?=\d)/g, "$1\u00a0")
      .replace(/ (—|–) /g, "\u00a0$1 ");
  }).join("");
}

/* 3D 라벨·도장 등 캔버스 글씨 — 내장 글꼴 AocSans(assets/fonts) 우선, 없으면 기기 기본 한글 글꼴 */
const FONT_STACK = "'AocSans','Pretendard','Malgun Gothic','Apple SD Gothic Neo','Noto Sans KR',sans-serif";

/* 라벨 스프라이트 (본문 + 작은 교과 용어) */
function makeLabel(text, opts) {
  opts = opts || {};
  const color = opts.color || "#2a3a58";
  const sub = opts.sub || null;
  const fs = opts.fontSize || 46;
  const subFs = Math.round(fs * 0.62);
  const pad = opts.pad != null ? opts.pad : (opts.bg ? 20 : 8);
  const weight = opts.weight || 800;
  const dpr = 2;
  const cv = document.createElement("canvas");
  const ctx = cv.getContext("2d");
  const fontMain = weight + " " + fs + "px " + FONT_STACK;
  const fontSub = "600 " + subFs + "px " + FONT_STACK;
  ctx.font = fontMain;
  let w = Math.ceil(ctx.measureText(text).width);
  if (sub) { ctx.font = fontSub; w = Math.max(w, Math.ceil(ctx.measureText(sub).width)); }
  w += pad * 2;
  const gap = sub ? Math.round(fs * 0.28) : 0;
  const h = fs + (sub ? gap + subFs : 0) + pad * 2;
  cv.width = w * dpr; cv.height = h * dpr;
  ctx.scale(dpr, dpr);
  if (opts.bg) {
    ctx.fillStyle = opts.bg;
    roundRect(ctx, 1, 1, w - 2, h - 2, Math.min(14, h / 2 - 1)); ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = opts.border || "rgba(60,90,140,0.28)";
    ctx.stroke();
  }
  ctx.textBaseline = "middle"; ctx.textAlign = "center";
  if (opts.halo) {
    ctx.font = fontMain; ctx.lineWidth = 7; ctx.lineJoin = "round";
    ctx.strokeStyle = opts.halo;
    ctx.strokeText(text, w / 2, pad + fs / 2);
  }
  ctx.font = fontMain; ctx.fillStyle = color;
  ctx.fillText(text, w / 2, pad + fs / 2);
  if (sub) {
    ctx.font = fontSub;
    if (opts.halo) { ctx.lineWidth = 6; ctx.strokeStyle = opts.halo; ctx.strokeText(sub, w / 2, pad + fs + gap + subFs / 2); }
    ctx.fillStyle = opts.subColor || "#63718c";
    ctx.fillText(sub, w / 2, pad + fs + gap + subFs / 2);
  }
  const tex = setSRGB(new THREE.CanvasTexture(cv));
  tex.minFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: opts.depthTest !== false, depthWrite: false });
  mat.userData.own = true;
  const sp = new THREE.Sprite(mat);
  sp.renderOrder = 5;   // 같은 그룹의 반투명 면(기온 색·띠)보다 나중에 그려 흐려지지 않게
  const scale = (opts.worldHeight || 0.15);
  sp.scale.set(scale * (w / h), scale, 1);
  /* 화면 기준 최소 글자 크기 — 본문 14px, 보조 글씨가 있으면 본문 18px(보조 약 11px) 이상 (updateLabelSizes) */
  sp.userData.lbl = { h: scale, asp: w / h, frac: fs / h, min: opts.minPx || (sub ? 18 : 14) };
  LABELS.push(sp);
  return sp;
}

/* ------------------------------------------------------------
   3D 라벨 최소 크기 보장 — 라벨은 공간 속 크기라 멀어지면 작아짐.
   매 프레임 화면에 보이는 본문 글자 높이(px)를 계산해 최소값보다 작으면 키움(최대 2.6배).
   발표 모드에서는 최소값을 1.35배로.
   ------------------------------------------------------------ */
const LABELS = [];
const _lblPos = new THREE.Vector3(), _camDir = new THREE.Vector3();
/* 지구본 위 라벨인지(조상에 globeGroup이 있는지) — 처음 한 번만 확인해 기억 */
function isOnGlobe(sp) {
  if (sp.userData.onGlobe != null) return sp.userData.onGlobe;
  let o = sp.parent;
  while (o && o !== globeGroup) o = o.parent;
  sp.userData.onGlobe = !!o;
  return sp.userData.onGlobe;
}
function updateLabelSizes() {
  const pxPerUnit = (canvas.clientHeight || 1) / (2 * TANF);    // 거리 1에서 1 단위가 차지하는 화면 픽셀
  const pres = (typeof isPresent === "function" && isPresent()) ? 1.35 : 1;
  _camDir.copy(camera.position).normalize();          // 지구 중심(원점) → 카메라 방향
  let w = 0;
  for (let i = 0; i < LABELS.length; i++) {
    const sp = LABELS[i], L = sp.userData.lbl;
    if (sp.userData.dead) continue;                     // 재생성되며 버려진 라벨은 목록에서 뺌
    LABELS[w++] = sp;
    if (!sp.visible || !sp.parent) continue;
    sp.getWorldPosition(_lblPos);
    const dist = Math.max(0.2, _lblPos.distanceTo(camera.position));
    const px = L.h * L.frac * pxPerUnit / dist;
    const f = Math.min(2.6, Math.max(1, (L.min * pres) / px));
    sp.scale.set(L.h * L.asp * f, L.h * f, 1);
    /* 지구본 가장자리·뒤쪽으로 돌아간 라벨은 흐리게 → 지구에 반쯤 가려지거나 서로 겹치는 것 방지.
       (표시 관리 updateFades가 매 프레임 투명도를 새로 정하므로, 그 뒤에 곱해도 누적되지 않음) */
    if (sp.material.userData.fk != null && isOnGlobe(sp)) {
      const facing = _lblPos.normalize().dot(_camDir);            // 1 = 정면, 0 = 가장자리, <0 = 뒤쪽
      const k = Math.max(0, Math.min(1, (facing - 0.12) / 0.3));
      sp.material.opacity *= k * k * (3 - 2 * k);
    }
  }
  LABELS.length = w;
}

/* 인덱스드 BufferGeometry 병합 (튜브 + 화살촉을 한 메시로) */
function mergeGeoms(geos) {
  let vCount = 0, iCount = 0;
  geos.forEach(g => { vCount += g.attributes.position.count; iCount += g.index.count; });
  const pos = new Float32Array(vCount * 3);
  const nor = new Float32Array(vCount * 3);
  const uv  = new Float32Array(vCount * 2);
  const idx = vCount > 65000 ? new Uint32Array(iCount) : new Uint16Array(iCount);
  let vo = 0, io = 0;
  geos.forEach(g => {
    pos.set(g.attributes.position.array, vo * 3);
    nor.set(g.attributes.normal.array, vo * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, vo * 2);
    const gi = g.index.array;
    for (let i = 0; i < gi.length; i++) idx[io + i] = gi[i] + vo;
    vo += g.attributes.position.count; io += gi.length;
    g.dispose();
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  out.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}

const UP = new THREE.Vector3(0, 1, 0);
function coneAt(point, dir, headR, headL, centered) {
  const cone = new THREE.ConeGeometry(headR, headL, 10);
  if (!centered) cone.translate(0, headL / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize());
  cone.applyQuaternion(q);
  cone.translate(point.x, point.y, point.z);
  return cone;
}

/* 열린 곡선 화살표(튜브 + 끝 화살촉) → geometry */
function arrowGeom(points, tubeR, headR, headL) {
  const curve = new THREE.CatmullRomCurve3(points);
  const tube = new THREE.TubeGeometry(curve, Math.max(10, points.length * 3), tubeR, 8, false);
  const end = points[points.length - 1];
  const tan = curve.getTangent(1);
  return { geom: mergeGeoms([tube, coneAt(end, tan, headR, headL, false)]), curve: curve };
}

/* 꼬리가 가늘어지는 곡선 화살표 → geometry (바람용)
   튜브 고리(ring)마다 중심선에서의 거리를 꼬리 쪽으로 줄여 붓으로 그은 듯한 모양 */
function taperedArrowGeom(points, tubeR, headR, headL, tailScale) {
  const curve = new THREE.CatmullRomCurve3(points);
  const segs = Math.max(12, points.length * 3), radial = 8;
  const tube = new THREE.TubeGeometry(curve, segs, tubeR, radial, false);
  const pos = tube.attributes.position, c = new THREE.Vector3(), v = new THREE.Vector3();
  const minS = tailScale != null ? tailScale : 0.3;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const k = Math.min(1, t / 0.55), s = minS + (1 - minS) * k * k * (3 - 2 * k);
    curve.getPointAt(t, c);
    for (let j = 0; j <= radial; j++) {
      const idx = i * (radial + 1) + j;
      v.fromBufferAttribute(pos, idx).sub(c).multiplyScalar(s).add(c);
      pos.setXYZ(idx, v.x, v.y, v.z);
    }
  }
  const end = points[points.length - 1];
  return { geom: mergeGeoms([tube, coneAt(end, curve.getTangent(1), headR, headL, false)]), curve: curve };
}

/* ------------------------------------------------------------
   기온 색 — 위도(적도 따뜻 → 극 차가움)와 높이(위로 갈수록 차가움)로 정함.
   순환 고리를 기온 분포대로 칠해 "데워져 오르고, 식어서 내려옴"이 색으로 보이게 함
   ------------------------------------------------------------ */
const TEMP_STOPS = [[0, "#3a6fd8"], [0.3, "#62a0e6"], [0.5, "#f2c14e"], [0.72, "#f28a2e"], [1, "#e0412b"]].map(s => [s[0], new THREE.Color(s[1])]);
const _tc = new THREE.Color();
function tempAt(lat, alt) {
  const c = Math.pow(Math.max(0, Math.cos(lat * DEG)), 1.4);
  return Math.max(0, Math.min(1, 0.1 + 0.9 * c - 0.35 * Math.max(0, Math.min(1, alt))));
}
function tempColor(T, out) {
  for (let i = 1; i < TEMP_STOPS.length; i++) {
    if (T <= TEMP_STOPS[i][0]) {
      const a = TEMP_STOPS[i - 1], b = TEMP_STOPS[i];
      return out.copy(a[1]).lerp(b[1], (T - a[0]) / (b[0] - a[0]));
    }
  }
  return out.copy(TEMP_STOPS[TEMP_STOPS.length - 1][1]);
}
/* 지오메트리 꼭짓점마다 기온 색(color 속성) — latAlt(x,y,z) → [위도, 높이 0..1] */
function colorizeByTemp(geo, latAlt) {
  const p = geo.attributes.position, n = p.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const la = latAlt(p.getX(i), p.getY(i), p.getZ(i));
    tempColor(tempAt(la[0], la[1]), _tc);
    col[i * 3] = _tc.r; col[i * 3 + 1] = _tc.g; col[i * 3 + 2] = _tc.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return geo;
}

/* ------------------------------------------------------------
   흐르는 줄무늬 — 관(튜브) 표면의 "›" 무늬가 진행 방향으로 흘러 방향을 보여 줌.
   텍스처 오프셋만 움직이므로 가벼움. 강조되지 않은(흐려진) 재질은 멈춤 (updateFlowMats)
   ------------------------------------------------------------ */
const FLOW_MATS = [];      // { tex, axis: "x"|"y", speed, mat }
const _flowCanvases = {};
let _chevUpCanvas = null, _chevDownCanvas = null;
/* dark: 띠의 가장 진한 밝기(0~255) — 굵은 바람 화살표는 진하게, 여러 겹 겹치는 순환 고리는 옅게 */
function flowCanvas(dark) {
  dark = dark == null ? 55 : dark;
  if (_flowCanvases[dark]) return _flowCanvases[dark];
  const cv = document.createElement("canvas");
  cv.width = 64; cv.height = 32;
  const ctx = cv.getContext("2d");
  /* 진행 방향(u)으로 점점 진해지다 앞끝에서 끊기는 톱니 모양 띠 — 가는 관에서도 흐르는 방향이 또렷함.
     (관 둘레 v 방향으로는 무늬가 같아서 어느 쪽에서 봐도 보임) */
  const g = ctx.createLinearGradient(0, 0, 64, 0);
  g.addColorStop(0, "rgb(255,255,255)");
  g.addColorStop(0.42, "rgb(255,255,255)");
  g.addColorStop(0.8, "rgb(" + dark + "," + Math.round(dark * 1.1) + "," + Math.round(dark * 1.4) + ")");
  g.addColorStop(0.82, "rgb(255,255,255)");
  g.addColorStop(1, "rgb(255,255,255)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 32);
  _flowCanvases[dark] = cv;
  return cv;
}
function flowTexture(repeatU, dark) {
  const t = setSRGB(new THREE.CanvasTexture(flowCanvas(dark)));
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatU, 1);
  /* 관 둘레 방향으로 텍스처가 크게 줄어들어 밉맵(흐린 축소본)이 쓰이면 무늬가 뭉개짐 → 밉맵 끔 */
  t.generateMipmaps = false;
  t.minFilter = THREE.LinearFilter;
  return t;
}
/* 관 재질에 흐르는 줄무늬를 붙임 (speed: 초당 무늬 이동량) */
function addFlow(mat, repeatU, speed, dark) {
  mat.map = flowTexture(repeatU, dark);
  mat.needsUpdate = true;
  FLOW_MATS.push({ tex: mat.map, axis: "x", speed: speed, mat: mat });
  return mat;
}
/* 세로로 흐르는 셰브론 띠 텍스처(단면의 상승·하강 공기 흐름 띠) */
function chevBandCanvas(up) {
  const cv = document.createElement("canvas");
  cv.width = 64; cv.height = 64;
  const ctx = cv.getContext("2d");
  ctx.clearRect(0, 0, 64, 64);
  ctx.strokeStyle = "rgba(255,255,255,0.95)"; ctx.lineWidth = 9; ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.beginPath();
  if (up) { ctx.moveTo(10, 44); ctx.lineTo(32, 20); ctx.lineTo(54, 44); }
  else    { ctx.moveTo(10, 20); ctx.lineTo(32, 44); ctx.lineTo(54, 20); }
  ctx.stroke();
  return cv;
}
function flowBandMat(hex, up, tag) {
  if (up && !_chevUpCanvas) _chevUpCanvas = chevBandCanvas(true);
  if (!up && !_chevDownCanvas) _chevDownCanvas = chevBandCanvas(false);
  const t = setSRGB(new THREE.CanvasTexture(up ? _chevUpCanvas : _chevDownCanvas));
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 4.3);
  const m = new THREE.MeshBasicMaterial({ color: hex, map: t, transparent: true, opacity: 0.62, depthWrite: false, side: THREE.DoubleSide });
  const bg = tagMat(m, tag);
  FLOW_MATS.push({ tex: t, axis: "y", speed: up ? 0.55 : -0.55, mat: m });
  return bg;
}
function updateFlowMats(dt) {
  if (REDUCED) return;
  for (let i = 0; i < FLOW_MATS.length; i++) {
    const f = FLOW_MATS[i], fk = f.mat.userData.fk;
    if (fk != null && fk < 0.5) continue;               // 흐려진(강조 밖) 요소는 흐름도 멈춤
    if (f.axis === "x") f.tex.offset.x -= f.speed * dt; else f.tex.offset.y -= f.speed * dt;
  }
}

/* 바람 화살표 흰 테두리 — 뒷면만 법선 방향으로 조금 부풀려 그리는 윤곽선(모핑과 함께 움직임) */
function outlineMat(tags, width) {
  const m = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.BackSide, transparent: true, opacity: 0.92, depthWrite: false });
  m.onBeforeCompile = function (sh) {
    /* 모핑(휘어짐) 계산 뒤에 부풀려야 함 — 모핑이 1이면 원래 모양에 0을 곱하므로 앞에서 더한 값이 사라짐.
       MeshBasic 셰이더엔 objectNormal이 없어 법선 속성(normal)을 직접 씀 */
    sh.vertexShader = sh.vertexShader.replace("#include <morphtarget_vertex>",
      "#include <morphtarget_vertex>\n  transformed += normalize(normal) * " + width.toFixed(4) + ";");
  };
  m.customProgramCacheKey = function () { return "outline" + width; };
  return tagMat(m, tags);
}

/* 닫힌 순환 고리(튜브 + 진행 방향 화살촉들) → geometry */
function loopGeom(points, tubeR, headR, headL, arrowTs) {
  const curve = new THREE.CatmullRomCurve3(points, true, "catmullrom", 0.15);
  const parts = [new THREE.TubeGeometry(curve, 88, tubeR, 10, true)];
  arrowTs.forEach(t => {
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    parts.push(coneAt(p, tan, headR, headL, true));
  });
  return { geom: mergeGeoms(parts), curve: curve };
}

/* 정규화 좌표(0..1)의 모서리 둥근 사각 고리 점 배열
   a=0: 하강 위도 쪽, a=1: 상승 위도 쪽 / b=0: 지면, b=1: 상층
   진행: 지면(하강→상승) → 상승 → 상층(상승→하강) → 하강  */
function roundedLoopUV(r) {
  const pts = [];
  const seg = 5;
  function arc(cx, cy, a0, a1) {
    for (let i = 1; i <= seg; i++) {
      const a = a0 + (a1 - a0) * (i / seg);
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  }
  function line(x0, y0, x1, y1) {
    for (let i = 0; i <= seg; i++) pts.push([x0 + (x1 - x0) * (i / seg), y0 + (y1 - y0) * (i / seg)]);
  }
  line(r, 0, 1 - r, 0);            // 지면
  arc(1 - r, r, -Math.PI / 2, 0);  // 상승 시작 모서리
  line(1, r, 1, 1 - r);            // 상승
  arc(1 - r, 1 - r, 0, Math.PI / 2);
  line(1 - r, 1, r, 1);            // 상층
  arc(r, 1 - r, Math.PI / 2, Math.PI);
  line(0, 1 - r, 0, r);            // 하강
  arc(r, r, Math.PI, Math.PI * 1.5);
  return pts;
}

/* 재생성되는 그룹 정리(지오메트리 + 자체 라벨 텍스처 폐기) */
function disposeGroup(g) {
  g.traverse(o => {
    o.userData.dead = true;             // 라벨 크기 목록(LABELS)에서 빠지도록 표시
    if (o.geometry) o.geometry.dispose();
    const m = o.material;
    if (m && m.userData && m.userData.own) {
      if (m.map) m.map.dispose();
      m.dispose();
    }
  });
  g.clear();
}

/* ============================================================
   4. 표시 관리 — 레이어 페이드 + 강조(포커스) + 숨김
   - 레이어(키)마다 투명도 a(0..1)가 목표값으로 부드럽게 따라가 "서서히 나타나고 사라짐"
   - 재질에 붙인 태그(tags)로 장면별 강조(focus: 나머지 흐리게) / 숨김(hide) 처리
   - 최종 투명도 = 원래 투명도 × 레이어 a × 강조 계수(fk)
   ============================================================ */
const FADE_KEYS = {};      // key → { want: () => bool, a: 현재값 }
const FADE_GROUPS = [];    // { group, key }
let fadeMats = [];         // { m, key } — sweepFadeMats()로 갱신
function defFade(key, want) { FADE_KEYS[key] = { want: want, a: 0 }; }
function regFadeGroup(group, key) { FADE_GROUPS.push({ group: group, key: key }); }

/* 재질에 강조 태그 부여 (태그가 없는 재질은 강조·숨김의 영향을 받지 않음) */
function tagMat(mat, tags) {
  mat.transparent = true;
  mat.userData.tags = [].concat(tags);
  if (mat.userData.base == null) mat.userData.base = mat.opacity;
  return mat;
}
function regFocus(tag, mat) { tagMat(mat, tag); }

/* 흐름 점 재질 — 태그별로 따로 만들어, 숨긴 고리·바람의 점이 남지 않게 함 */
const _dotMats = {};
function dotMat(tags) {
  const k = [].concat(tags).join("|");
  if (!_dotMats[k]) {
    _dotMats[k] = tagMat(new THREE.SpriteMaterial({ map: MAT.dotTex, transparent: true, opacity: 0.9, depthTest: true, depthWrite: false }), tags);
  }
  return _dotMats[k];
}

/* 레이어 그룹 안의 재질 목록 갱신 — 그룹이 새로 만들어지거나 재생성된 뒤 호출 */
function sweepFadeMats() {
  const seen = new Set();
  fadeMats = [];
  FADE_GROUPS.forEach(fg => {
    fg.group.traverse(o => {
      if (!o.material) return;
      [].concat(o.material).forEach(m => {
        if (seen.has(m)) return;
        seen.add(m);
        m.transparent = true;
        if (m.userData.base == null) m.userData.base = m.opacity;
        if (m.userData.fk == null) m.userData.fk = focusTarget(m.userData.tags).ft;   // 재생성된 재질도 현재 장면 상태로 시작
        fadeMats.push({ m: m, key: fg.key });
      });
    });
  });
}

function hitTags(tags, list) {
  if (!list || !list.length) return false;
  for (let i = 0; i < tags.length; i++) if (list.indexOf(tags[i]) >= 0) return true;
  return false;
}
/* 태그의 목표 강조 계수 — 숨김 0 / 강조 대상 1 / 강조 중 나머지 0.13 / 태그 없음 1 */
function focusTarget(tags) {
  const focus = state.focus;
  if (!tags) return { ft: 1, focused: false };
  if (hitTags(tags, state.hide)) return { ft: 0, focused: false };
  if (focus && focus.length) {
    const on = hitTags(tags, focus);
    return { ft: on ? 1 : 0.13, focused: on };
  }
  return { ft: 1, focused: false };
}
/* 매 프레임: 레이어 투명도·강조 계수를 목표로 보간해 재질에 반영 */
function updateFades(dt, t) {
  const k = REDUCED ? 1 : Math.min(1, dt * 2.4 / DUR.short);   // 나타나기·흐려지기 ≈ 짧은 동작(0.4초)
  for (const key in FADE_KEYS) {
    const f = FADE_KEYS[key];
    const target = f.want() ? 1 : 0;
    f.a += (target - f.a) * k;
    if (Math.abs(target - f.a) < 0.003) f.a = target;
  }
  FADE_GROUPS.forEach(fg => { fg.group.visible = FADE_KEYS[fg.key].a > 0.003; });

  const hasFocus = !!(state.focus && state.focus.length);
  const pulse = (hasFocus && !REDUCED) ? 0.84 + 0.16 * Math.sin(t * 2.7) : 1;
  for (let i = 0; i < fadeMats.length; i++) {
    const e = fadeMats[i], m = e.m;
    const r = focusTarget(m.userData.tags), ft = r.ft, focused = r.focused;
    m.userData.fk += (ft - m.userData.fk) * k;
    if (Math.abs(ft - m.userData.fk) < 0.003) m.userData.fk = ft;
    m.opacity = m.userData.base * FADE_KEYS[e.key].a * m.userData.fk * (focused ? pulse : 1);
  }
}

/* ============================================================
   5. 공유 재질 (한 번만 생성 — 계절 재생성 시에도 유지)
   ============================================================ */
function chevronTex(up) {
  const cv = document.createElement("canvas");
  cv.width = 128; cv.height = 128;
  const ctx = cv.getContext("2d");
  ctx.fillStyle = "rgba(255,255,255,0.40)";
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.lineWidth = 17; ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.beginPath();
  if (up) { ctx.moveTo(22, 86); ctx.lineTo(64, 40); ctx.lineTo(106, 86); }
  else    { ctx.moveTo(22, 42); ctx.lineTo(64, 88); ctx.lineTo(106, 42); }
  ctx.stroke();
  const tex = setSRGB(new THREE.CanvasTexture(cv));
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.set(26, 1);
  return tex;
}
function iconTex(kind) {
  const cv = document.createElement("canvas");
  cv.width = 168; cv.height = 200;
  const ctx = cv.getContext("2d");
  if (kind === "rain") {
    // 구름
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = COL.wet; ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(58, 74, 30, Math.PI * 0.5, Math.PI * 1.5);
    ctx.arc(84, 52, 32, Math.PI * 0.95, Math.PI * 1.9);
    ctx.arc(116, 72, 28, Math.PI * 1.25, Math.PI * 0.5);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // 빗줄기
    ctx.strokeStyle = COL.wet; ctx.lineWidth = 9; ctx.lineCap = "round";
    [[56, 0], [84, 8], [112, 0]].forEach(d => {
      ctx.beginPath(); ctx.moveTo(d[0] + 4, 118 + d[1]); ctx.lineTo(d[0] - 6, 150 + d[1]); ctx.stroke();
    });
    pill("비 많음", COL.wet);
  } else {
    // 해
    ctx.fillStyle = "#f6b93c";
    ctx.strokeStyle = "#e29a17"; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(84, 82, 34, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = "#f6b93c"; ctx.lineWidth = 9; ctx.lineCap = "round";
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(84 + Math.cos(a) * 46, 82 + Math.sin(a) * 46);
      ctx.lineTo(84 + Math.cos(a) * 60, 82 + Math.sin(a) * 60);
      ctx.stroke();
    }
    pill("건조", COL.dry);
  }
  function pill(text, color) {
    ctx.font = "800 30px " + FONT_STACK;
    const tw = ctx.measureText(text).width + 28;
    ctx.fillStyle = "rgba(255,255,255,0.94)";
    roundRect(ctx, 84 - tw / 2, 158, tw, 40, 20); ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 3;
    roundRect(ctx, 84 - tw / 2, 158, tw, 40, 20); ctx.stroke();
    ctx.fillStyle = color;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(text, 84, 179);
  }
  const tex = setSRGB(new THREE.CanvasTexture(cv));
  tex.minFilter = THREE.LinearFilter;
  return tex;
}
function dotTex() {
  const cv = document.createElement("canvas");
  cv.width = 64; cv.height = 64;
  const ctx = cv.getContext("2d");
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.5, "rgba(255,255,255,0.85)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  return setSRGB(new THREE.CanvasTexture(cv));
}

/* 입체감용 재질 — 빛을 받아 튜브 표면에 음영과 하이라이트가 생김 */
function volMat(hex, opacity) {
  return new THREE.MeshPhongMaterial({
    color: hex,
    transparent: true,
    opacity: opacity != null ? opacity : 0.97,
    shininess: 60,
    specular: 0x667788,
    emissive: hex,
    emissiveIntensity: 0.22
  });
}

/* ------------------------------------------------------------
   태양 — 화면 디자인과 어울리는 일러스트형 원반(밝은 원 + 짧은 햇살 + 부드러운 빛 번짐).
   지구본 일사(1단계)와 단면 보기의 태양에 공용 사용
   ------------------------------------------------------------ */
function sunGlowTex() {
  const cv = document.createElement("canvas");
  cv.width = 128; cv.height = 128;
  const ctx = cv.getContext("2d");
  const g = ctx.createRadialGradient(64, 64, 6, 64, 64, 62);
  g.addColorStop(0, "rgba(255,238,170,0.9)");
  g.addColorStop(0.35, "rgba(255,210,110,0.45)");
  g.addColorStop(0.7, "rgba(255,190,90,0.14)");
  g.addColorStop(1, "rgba(255,190,90,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  return setSRGB(new THREE.CanvasTexture(cv));
}
function sunDiscTex() {
  const S = 256, c = S / 2, cv = document.createElement("canvas");
  cv.width = S; cv.height = S;
  const ctx = cv.getContext("2d");
  /* 짧은 햇살 12개 */
  ctx.fillStyle = "#ffc93a";
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2, a0 = a - 0.1, a1 = a + 0.1;
    ctx.beginPath();
    ctx.moveTo(c + Math.cos(a0) * 78, c + Math.sin(a0) * 78);
    ctx.lineTo(c + Math.cos(a) * 118, c + Math.sin(a) * 118);
    ctx.lineTo(c + Math.cos(a1) * 78, c + Math.sin(a1) * 78);
    ctx.closePath(); ctx.fill();
  }
  /* 원반 — 가운데가 밝고 가장자리로 갈수록 주황 */
  const g = ctx.createRadialGradient(c - 16, c - 18, 6, c, c, 74);
  g.addColorStop(0, "#fff7cf"); g.addColorStop(0.5, "#ffd84a"); g.addColorStop(0.92, "#ffb21f"); g.addColorStop(1, "#f59e0b");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(c, c, 72, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 4; ctx.strokeStyle = "rgba(230,140,10,0.55)"; ctx.stroke();
  const t = setSRGB(new THREE.CanvasTexture(cv));
  t.minFilter = THREE.LinearFilter;
  return t;
}
/* radius = 원반 반지름(햇살 포함 그림 크기는 약 1.6배, 빛 번짐은 약 4배) */
function makeSunDisc(radius) {
  const g = new THREE.Group();
  const glowMat = new THREE.SpriteMaterial({ map: sunGlowTex(), transparent: true, opacity: 0.85, depthWrite: false });
  glowMat.userData.own = true;
  const glow = new THREE.Sprite(glowMat);
  glow.scale.set(radius * 4.2, radius * 4.2, 1);
  g.add(glow);
  const discMat = new THREE.SpriteMaterial({ map: sunDiscTex(), transparent: true, depthWrite: false });
  discMat.userData.own = true;
  const disc = new THREE.Sprite(discMat);
  disc.scale.set(radius * 3.3, radius * 3.3, 1);   // 캔버스 안의 원반이 반지름의 약 1배가 되도록
  disc.renderOrder = 2;
  g.add(disc);
  g.userData.glow = glow;
  return g;
}

/* ------------------------------------------------------------
   1단계의 태양 — 평행 광선이 들어오는 방향(태양 쪽)에 작은 원반으로 둠.
   광선 방향을 화면에 비춘 쪽으로, 지구 옆 보이는 영역 안쪽에 매 프레임 배치 → 광선이 태양에서 나오는 것처럼 보임
   ------------------------------------------------------------ */
const SUN_R = 0.3;            // 원반 반지름(월드 단위)
const SUN_DIST = 2.7;         // 지구 중심에서 태양 원반까지(화면 평면 기준)
let sunFixed = null;
const _sq = new THREE.Quaternion(), _sd = new THREE.Vector3();
function ensureFixedSun() {
  if (sunFixed) return;
  sunFixed = makeSunDisc(1);
  sunFixed.visible = false;
  scene.add(sunFixed);
  positionFixedSun();
}
function positionFixedSun() {
  if (!sunFixed) return;
  let dx = 1, dy = 0.1;
  if (typeof globe !== "undefined" && globe.insolSpin && globe.insolDir) {
    globe.insolSpin.updateWorldMatrix(true, false);
    globe.insolSpin.getWorldQuaternion(_sq);
    _sd.copy(globe.insolDir).applyQuaternion(_sq);          // 광선이 들어오는 방향(태양 쪽)
    dx = _sd.x; dy = _sd.y;
  }
  const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
  /* 보이는 영역(패널·자막 제외) 안쪽에 들어오도록 거리 제한 — 좁은 화면에서는 가장자리에 걸침 */
  const halfW = visHalfW() * camZ, halfH = visHalfH() * camZ;
  const lim = Math.min((halfW - SUN_R * 0.2) / Math.max(0.01, Math.abs(dx)), (halfH - SUN_R * 0.6) / Math.max(0.01, Math.abs(dy)));
  const dist = Math.max(R + SUN_R * 1.4, Math.min(SUN_DIST, lim));
  /* 1단계 진입 시 태양이 커지며 떠오르는 연출 — '햇빛과 기온' 레이어 투명도에 맞춰 크기 조절 */
  const grow = FADE_KEYS.insol ? 0.35 + 0.65 * FADE_KEYS.insol.a : 1;
  sunFixed.scale.setScalar(SUN_R * grow);
  sunFixed.position.set(dx * dist, dy * dist, 0.3);
}

const MAT = {};
(function buildSharedMats() {
  const chevUp = chevronTex(true), chevDown = chevronTex(false);

  /* 지구본 기압대 띠 — 반투명하게 해 아래 대륙이 비쳐 보이게.
     (셰브론 ^·v는 상승·하강을 뜻하는 기호 — 지구본 표면에서 움직이면 남북 흐름으로 오해할 수 있어 움직이지 않음.
      위아래로 흐르는 표현은 단면의 상승·하강 띠가 맡음) */
  MAT.beltEq    = new THREE.MeshBasicMaterial({ color: COL.heat,  map: chevUp,   transparent: true, opacity: 0.66, depthWrite: false });
  MAT.beltSub   = new THREE.MeshBasicMaterial({ color: COL.arid,  map: chevDown, transparent: true, opacity: 0.66, depthWrite: false });
  MAT.beltFront = new THREE.MeshBasicMaterial({ color: COL.front, map: chevUp,   transparent: true, opacity: 0.66, depthWrite: false });
  MAT.beltPole  = new THREE.MeshBasicMaterial({ color: COL.cold,  transparent: true, opacity: 0.45, depthWrite: false });
  regFocus("belt0",  MAT.beltEq);
  regFocus("belt30", MAT.beltSub);
  regFocus("belt60", MAT.beltFront);
  regFocus("belt90", MAT.beltPole);

  /* 순환 고리 — 꼭짓점 기온 색(colorizeByTemp)을 쓰므로 재질 색은 흰색, 흐르는 줄무늬로 방향 표시.
     고리 구분은 이름표·굵기로 (고리별 재질은 강조 태그용으로 따로 둠) */
  CELLS.forEach(c => {
    const m = volMat(0xffffff, 0.96);
    m.vertexColors = true;
    m.emissive.set(0x202020);
    addFlow(m, 16, 0.9, 165);
    MAT["cell_" + c.id] = m;
    regFocus("cell-" + c.id, m);
  });

  /* 바람 재질 — 지구본(흐르는 줄무늬 + 흰 테두리) / 단면 세트 */
  WIND_BANDS.forEach(b => {
    MAT["wind_" + b.id] = tagMat(addFlow(volMat(b.color, 0.98), 3.2, 1.1), ["winds", "wind-" + b.id]);
    MAT["windO_" + b.id] = outlineMat(["winds", "wind-" + b.id], 0.0085);
    MAT["windX_" + b.id] = tagMat(addFlow(volMat(b.color, 0.98), 2.4, 1.0, 90), ["winds", "wind-" + b.id]);
  });

  /* 단면의 상승·하강 — 굵은 관 대신 셰브론이 위(상승)·아래(하강)로 흐르는 반투명 띠 */
  MAT.rise0  = flowBandMat(COL.rise, true,  "rise0");
  MAT.rise60 = flowBandMat(COL.rise, true,  "rise60");
  MAT.sink30 = flowBandMat(COL.sink, false, "sink30");
  MAT.sink90 = flowBandMat(COL.sink, false, "sink90");

  MAT.wetIcon = new THREE.SpriteMaterial({ map: iconTex("rain"), transparent: true, depthWrite: false });
  MAT.dryIcon = new THREE.SpriteMaterial({ map: iconTex("dry"),  transparent: true, depthWrite: false });
  regFocus("wet", MAT.wetIcon);
  regFocus("dry", MAT.dryIcon);

  MAT.dotTex = dotTex();   // 흐름 점 텍스처(재질은 dotMat()으로 태그별 생성)

  // 1단계 — 일사(햇빛과 기온) 시각화용
  MAT.sunRay    = tagMat(volMat(0xf5a623, 0.95), "ray");
  MAT.patchHot  = tagMat(new THREE.MeshBasicMaterial({ color: COL.heat, transparent: true, opacity: 0.42, depthWrite: false }), "patch-hot");
  MAT.patchCold = tagMat(new THREE.MeshBasicMaterial({ color: COL.cold, transparent: true, opacity: 0.42, depthWrite: false }), "patch-cold");
})();

/* 단면용 기압대 세로 기둥(은은한 그라데이션) 재질 */
function columnTex(hex) {
  const cv = document.createElement("canvas");
  cv.width = 64; cv.height = 256;
  const ctx = cv.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, hex + "00");
  g.addColorStop(0.75, hex + "3d");
  g.addColorStop(1, hex + "55");
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 256);
  return setSRGB(new THREE.CanvasTexture(cv));
}
MAT.colEq    = new THREE.MeshBasicMaterial({ map: columnTex(COL.heat),  transparent: true, depthWrite: false });
MAT.colSub   = new THREE.MeshBasicMaterial({ map: columnTex(COL.arid),  transparent: true, depthWrite: false });
MAT.colFront = new THREE.MeshBasicMaterial({ map: columnTex(COL.front), transparent: true, depthWrite: false });
MAT.colPole  = new THREE.MeshBasicMaterial({ map: columnTex(COL.cold),  transparent: true, depthWrite: false });
regFocus("belt0",  MAT.colEq);
regFocus("belt30", MAT.colSub);
regFocus("belt60", MAT.colFront);
regFocus("belt90", MAT.colPole);
