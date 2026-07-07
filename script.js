/* ============================================================
   대기대순환 3D 학습자료 — script.js
   - 지구 전체 보기 ↔ 공기 흐름 단면 보기
   - 통합 조작 패널: 이해 순서(7단계) / 표시할 내용 / 계절 / 읽는 법
   - 바람·순환은 점이 아니라 "화살표" 중심으로 표현
   - 자연색 지구 텍스처(온라인) + 교육용 지구본 fallback(오프라인)
   - 위도대 클릭 → 쉬운 말 정보 카드
   오프라인 동작: libs/three.min.js(로컬, UMD) 필수
   ============================================================ */
(function () {
"use strict";

var loadingEl = document.getElementById("loading");
function fatal(msg) {
  loadingEl.classList.remove("hide");
  loadingEl.innerHTML = "<p style='color:#c2410c; max-width:340px; text-align:center; line-height:1.7'>" + msg + "</p>";
}
if (typeof THREE === "undefined") {
  fatal("3D 라이브러리를 불러오지 못했습니다.<br><b>libs/three.min.js</b> 파일이 폴더 안에 함께 있는지 확인해 주세요.");
  return;
}

const DEG = Math.PI / 180;
const REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ============================================================
   1. 색 · 데이터
   ============================================================ */
const COL = {
  heat:  "#ea5a3d",   // 적도(공기 올라감)
  arid:  "#dc9a2e",   // 30°(공기 내려감·건조)
  front: "#23967f",   // 60°(공기 다시 올라감)
  cold:  "#4f83db",   // 극(찬 공기 내려감)
  rise:  "#e2503a",   // 상승 화살표
  sink:  "#3b6fd8",   // 하강 화살표
  wet:   "#3f83e8",
  dry:   "#e0a23a",
  windTrade: "#ff8b2c",
  windWest:  "#7c5ce8",
  windPolar: "#e64980",
  cellH: "#ef5b3d",
  cellF: "#8a90ad",
  cellP: "#3e7fe0",
  labelInk: "#2a3a58"
};

/* 위도대(정보 카드) — 쉬운 말 우선, 교과 용어 병기 */
const ZONES = {
  eq: {
    id: "eq", lat: 0, color: COL.heat,
    title: "적도 — 공기가 올라가는 곳", term: "적도 저압대",
    move:   "햇빛을 많이 받은 공기가 데워져 <b>위로 올라갑니다</b>.",
    rain:   "상승하는 공기 때문에 구름이 잘 만들어지고 <b>비가 많이</b> 내립니다.",
    region: "아마존 분지, 콩고 분지, 인도네시아 — <b>열대 우림 기후</b>",
    sum:    "공기가 올라가는 곳은 대체로 비가 많습니다."
  },
  sub: {
    id: "sub", lat: 30, color: COL.arid,
    title: "30° 부근 — 공기가 내려오는 곳", term: "아열대 고압대",
    move:   "적도에서 올라간 공기가 위도 30° 부근에서 <b>아래로 내려옵니다</b>.",
    rain:   "하강하는 공기 때문에 구름이 잘 만들어지지 않아 <b>건조</b>합니다.",
    region: "사하라 사막, 아라비아 반도, 호주 내륙 — <b>사막 기후</b>",
    sum:    "공기가 내려오는 곳은 대체로 건조합니다."
  },
  front: {
    id: "front", lat: 60, color: COL.front,
    title: "60° 부근 — 공기가 다시 올라가는 곳", term: "한대 전선대",
    move:   "따뜻한 공기와 차가운 공기가 만나 공기가 <b>다시 위로 올라갑니다</b>.",
    rain:   "상승하는 공기와 전선 때문에 구름과 비가 만들어지기 쉽습니다.",
    region: "서유럽, 북태평양·북대서양 연안 — <b>서안 해양성 기후</b>와 관련",
    sum:    "서로 다른 성질의 공기가 만나는 곳에서는 비가 잘 내립니다."
  },
  pole: {
    id: "pole", lat: 90, color: COL.cold,
    title: "극지방 — 차가운 공기가 내려오는 곳", term: "극 고압대",
    move:   "차갑고 무거운 공기가 <b>아래로 내려옵니다</b>.",
    rain:   "공기가 내려오고 기온이 낮아 대체로 <b>건조</b>합니다.",
    region: "남극 대륙, 북극권 — <b>한대 기후</b>",
    sum:    "극지방은 춥고 건조한 고압대가 나타납니다."
  }
};

/* 순환(고리) — 상승 위도 / 하강 위도 */
const CELLS = [
  { id: "hadley", name: "해들리 순환", range: "0°~30°",  rise: 0,  sink: 30, color: COL.cellH },
  { id: "ferrel", name: "페렐 순환",   range: "30°~60°", rise: 60, sink: 30, color: COL.cellF },
  { id: "polar",  name: "극 순환",     range: "60°~90°", rise: 60, sink: 89, color: COL.cellP }
];

/* 지상 바람대 (dLon>0 = 서쪽으로 휨: 무역풍·극동풍은 편동풍, 편서풍은 편서풍) */
const WIND_BANDS = [
  { id: "trade",  name: "무역풍",  from: 27, to: 7,  dLon:  46, n: 9, lonOff: 0,  color: COL.windTrade },
  { id: "wester", name: "편서풍",  from: 33, to: 55, dLon: -48, n: 9, lonOff: 20, color: COL.windWest  },
  { id: "polar",  name: "극동풍",  from: 80, to: 64, dLon:  36, n: 6, lonOff: 10, color: COL.windPolar }
];

/* 이해 순서 — 7단계 (보기·레이어 자동 설정 + 강조 대상) */
const STEPS = [
  { title: "적도에서는 왜 공기가 올라갈까?", view: "cross",
    layers: { cells:true, belts:true, winds:false, coriolis:false, precip:false, grid:false },
    focus: ["cell-hadley", "rise0", "belt0"],
    body: "적도 부근은 햇빛을 많이 받아 지표와 공기가 강하게 데워집니다. 데워진 공기는 가벼워져 <b>위로 올라가고</b>, 이곳에는 공기가 모여드는 <b>저압대</b>가 만들어집니다.",
    q: "공기가 위로 올라가는 곳에서는 왜 구름과 비가 잘 만들어질까요?" },

  { title: "올라간 공기는 어디로 갈까?", view: "cross",
    layers: { cells:true, belts:true, winds:false, coriolis:false, precip:false, grid:false },
    focus: ["cell-hadley", "sink30", "belt30"],
    body: "적도에서 올라간 공기는 상층에서 남북으로 이동합니다. 이 공기는 <b>위도 30° 부근에서 다시 아래로 내려오며</b>, 이곳에는 <b>고압대</b>가 만들어집니다.",
    q: "공기가 아래로 내려오는 곳은 비가 많을까요, 적을까요?" },

  { title: "30° 부근에는 왜 사막이 많을까?", view: "cross",
    layers: { cells:true, belts:true, winds:false, coriolis:false, precip:true, grid:false },
    focus: ["sink30", "belt30", "dry"],
    body: "위도 30° 부근에서는 공기가 아래로 내려옵니다. 공기가 내려오면 구름이 잘 만들어지지 않아 <b>비가 적고 건조한</b> 지역이 많아집니다. 그래서 사하라 사막, 아라비아 반도, 호주 내륙처럼 건조한 지역이 많이 나타납니다.",
    q: "세계의 큰 사막들이 왜 대체로 위도 30° 부근에 많이 분포할까요?" },

  { title: "지구에는 공기의 큰 순환이 3개 있어요", view: "cross",
    layers: { cells:true, belts:true, winds:false, coriolis:false, precip:false, grid:false },
    focus: ["cell-hadley", "cell-ferrel", "cell-polar"],
    body: "지구의 대기는 하나의 큰 고리로만 도는 것이 아니라, 위도에 따라 여러 개의 순환을 이룹니다. 적도와 30° 사이에는 <b>해들리 순환</b>, 30°와 60° 사이에는 <b>페렐 순환</b>, 60°와 극 사이에는 <b>극 순환</b>이 나타납니다.",
    q: "공기가 올라가는 곳과 내려오는 곳을 기준으로 세 개의 순환을 구분해 볼 수 있을까요?" },

  { title: "땅 가까이에서는 바람이 어떻게 불까?", view: "globe",
    layers: { cells:false, belts:true, winds:true, coriolis:true, precip:false, grid:true },
    focus: ["winds"],
    body: "지표면 가까이의 바람은 대체로 <b>고압대에서 저압대로</b> 붑니다. 하지만 지구가 자전하기 때문에 바람은 곧게만 불지 않고 <b>휘어집니다</b>. 이 때문에 무역풍, 편서풍, 극동풍 같은 바람대가 만들어집니다.",
    q: "바람 휘어짐을 끄면 바람 방향이 어떻게 달라질까요?" },

  { title: "올라가는 곳은 비, 내려오는 곳은 건조", view: "globe",
    layers: { cells:false, belts:true, winds:true, coriolis:true, precip:true },
    focus: ["belt0", "belt30", "belt60", "wet", "dry"],
    body: "공기가 <b>올라가는 곳</b>에서는 구름이 만들어지기 쉬워 <b>비가 많습니다</b>. 반대로 공기가 <b>내려오는 곳</b>에서는 구름이 잘 만들어지지 않아 <b>건조합니다</b>. 이처럼 공기의 움직임은 세계 여러 지역의 강수량과 기후 차이를 만드는 중요한 원인입니다.",
    q: "아마존과 사하라 사막의 기후 차이는 공기의 움직임과 어떻게 연결될까요?" },

  { title: "계절에 따라 바람 띠가 움직여요", view: "globe",
    layers: { cells:false, belts:true, winds:true, coriolis:true, precip:true, grid:true },
    focus: null, seasonSpot: true,
    body: "태양의 위치가 계절에 따라 달라지면, 기압대와 바람대도 <b>남북으로 이동</b>합니다. 7월에는 북반구 쪽으로, 1월에는 남반구 쪽으로 이동하는 모습을 볼 수 있습니다. 이 이동은 계절풍, 사바나 기후, 지중해성 기후를 이해하는 데 중요한 단서가 됩니다.",
    q: "기압대가 계절에 따라 움직이면, 어떤 지역은 왜 우기와 건기가 뚜렷해질까요?" }
];

/* ============================================================
   2. Three.js 기본 설정
   ============================================================ */
const canvas = document.getElementById("scene");
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
} catch (e) {
  fatal("이 기기에서 3D 화면(WebGL)을 사용할 수 없습니다.<br>크롬(Chrome) 브라우저로 다시 열어 주세요.");
  return;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
if ("outputColorSpace" in renderer && THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const FOV = 45, TANF = Math.tan(FOV / 2 * DEG);
const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
camera.position.set(0, 0, 5.4);

scene.add(new THREE.AmbientLight(0xffffff, 0.55));
const hemi = new THREE.HemisphereLight(0xffffff, 0xd8e4f2, 1.1);
scene.add(hemi);
const key = new THREE.DirectionalLight(0xffffff, 1.7);
key.position.set(4, 3, 6);
scene.add(key);

const ROOT = new THREE.Group();       scene.add(ROOT);
const globeGroup = new THREE.Group(); ROOT.add(globeGroup);
const crossGroup = new THREE.Group(); ROOT.add(crossGroup);

const R = 1.5;              // 지구 반지름
const SHIFT_MAX = 10;       // 계절 이동 최대(도)

/* 상태 */
const state = {
  view: "globe",
  season: 0,                // -1(1월) .. 0 .. +1(7월)
  layers: { cells:false, belts:true, winds:true, coriolis:true, precip:false, grid:false },
  stepIndex: -1,
  focus: null
};
function seasonShift() { return state.season * SHIFT_MAX; }
function clampLat(v) { return Math.max(-89, Math.min(89, v)); }

/* ============================================================
   3. 공용 유틸
   ============================================================ */
function setSRGB(tex) {
  if ("colorSpace" in tex && THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
function latLonToVec(lat, lon, r) {
  const phi = (90 - lat) * DEG, theta = lon * DEG;
  return new THREE.Vector3(
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta)
  );
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

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
  const fontMain = weight + " " + fs + "px 'Pretendard','Malgun Gothic','Noto Sans KR',sans-serif";
  const fontSub = "600 " + subFs + "px 'Pretendard','Malgun Gothic','Noto Sans KR',sans-serif";
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
  const scale = (opts.worldHeight || 0.15);
  sp.scale.set(scale * (w / h), scale, 1);
  return sp;
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
  const tube = new THREE.TubeGeometry(curve, Math.max(10, points.length * 3), tubeR, 6, false);
  const end = points[points.length - 1];
  const tan = curve.getTangent(1);
  return { geom: mergeGeoms([tube, coneAt(end, tan, headR, headL, false)]), curve: curve };
}

/* 닫힌 순환 고리(튜브 + 진행 방향 화살촉들) → geometry */
function loopGeom(points, tubeR, headR, headL, arrowTs) {
  const curve = new THREE.CatmullRomCurve3(points, true, "catmullrom", 0.15);
  const parts = [new THREE.TubeGeometry(curve, 170, tubeR, 6, true)];
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
   4. 강조(포커스) 시스템 — 단계별로 볼 요소를 살리고 나머지는 흐리게
   ============================================================ */
const FOCUSABLES = [];   // { tag, mat, base }
function regFocus(tag, mat) {
  mat.transparent = true;
  FOCUSABLES.push({ tag: tag, mat: mat, base: mat.opacity });
}
function applyFocus() {
  const f = state.focus;
  FOCUSABLES.forEach(e => {
    e.mat.opacity = (!f || !f.length) ? e.base : (f.indexOf(e.tag) >= 0 ? e.base : e.base * 0.14);
  });
}
function pulseFocus(t) {
  const f = state.focus;
  if (!f || !f.length || REDUCED) return;
  const k = 0.82 + 0.18 * Math.sin(t * 2.7);
  FOCUSABLES.forEach(e => { if (f.indexOf(e.tag) >= 0) e.mat.opacity = e.base * k; });
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
    ctx.font = "800 30px 'Pretendard','Malgun Gothic',sans-serif";
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

const MAT = {};
(function buildSharedMats() {
  const chevUp = chevronTex(true), chevDown = chevronTex(false);

  MAT.beltEq    = new THREE.MeshBasicMaterial({ color: COL.heat,  map: chevUp,   transparent: true, opacity: 0.95, depthWrite: false });
  MAT.beltSub   = new THREE.MeshBasicMaterial({ color: COL.arid,  map: chevDown, transparent: true, opacity: 0.95, depthWrite: false });
  MAT.beltFront = new THREE.MeshBasicMaterial({ color: COL.front, map: chevUp,   transparent: true, opacity: 0.95, depthWrite: false });
  MAT.beltPole  = new THREE.MeshBasicMaterial({ color: COL.cold,  transparent: true, opacity: 0.55, depthWrite: false });
  regFocus("belt0",  MAT.beltEq);
  regFocus("belt30", MAT.beltSub);
  regFocus("belt60", MAT.beltFront);
  regFocus("belt90", MAT.beltPole);

  CELLS.forEach(c => {
    const m = new THREE.MeshBasicMaterial({ color: c.color, transparent: true, opacity: 0.96 });
    MAT["cell_" + c.id] = m;
    regFocus("cell-" + c.id, m);
  });

  WIND_BANDS.forEach(b => {
    const m = new THREE.MeshBasicMaterial({ color: b.color, transparent: true, opacity: 0.98 });
    MAT["wind_" + b.id] = m;
    regFocus("winds", m);
  });

  MAT.rise0  = new THREE.MeshBasicMaterial({ color: COL.rise, transparent: true, opacity: 0.98 });
  MAT.rise60 = new THREE.MeshBasicMaterial({ color: COL.rise, transparent: true, opacity: 0.98 });
  MAT.sink30 = new THREE.MeshBasicMaterial({ color: COL.sink, transparent: true, opacity: 0.98 });
  MAT.sink90 = new THREE.MeshBasicMaterial({ color: COL.sink, transparent: true, opacity: 0.98 });
  regFocus("rise0",  MAT.rise0);
  regFocus("rise60", MAT.rise60);
  regFocus("sink30", MAT.sink30);
  regFocus("sink90", MAT.sink90);

  MAT.wetIcon = new THREE.SpriteMaterial({ map: iconTex("rain"), transparent: true, depthWrite: false });
  MAT.dryIcon = new THREE.SpriteMaterial({ map: iconTex("dry"),  transparent: true, depthWrite: false });
  regFocus("wet", MAT.wetIcon);
  regFocus("dry", MAT.dryIcon);

  MAT.flowDot = new THREE.SpriteMaterial({ map: dotTex(), transparent: true, opacity: 0.9, depthTest: true, depthWrite: false });
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

/* ============================================================
   6. 지구 표면 텍스처 — 교육용 fallback을 즉시 그리고,
      인터넷이 되면 자연색(블루마블 계열) 텍스처로 교체
   ============================================================ */
const EARTH_URLS = [
  "https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-blue-marble.jpg",
  "https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg",
  "https://raw.githubusercontent.com/vasturiano/three-globe/master/example/img/earth-blue-marble.jpg"
];

/* 간략화한 대륙 윤곽(경도,위도 …) — 오프라인 fallback 지구본용 */
const LAND_MAIN = [
  /* 북아메리카 */
  [-166,66,-160,70,-150,71,-137,69,-125,70,-110,68,-96,70,-86,67,-82,62,-90,58,-93,56,-84,53,-79,57,-71,61,-64,58,-66,52,-57,52,-60,46,-66,44,-70,42,-74,39,-76,34,-81,30,-80,25,-83,29,-89,29,-96,27,-97,21,-94,17,-89,15,-86,12,-83,9,-79,8,-82,7,-86,11,-92,14,-97,16,-104,19,-110,24,-115,30,-118,33,-122,37,-124,42,-125,48,-129,51,-133,55,-138,58,-146,60,-152,58,-159,55,-165,59,-168,64],
  /* 그린란드 */
  [-46,60,-40,63,-32,68,-22,70,-19,74,-24,78,-35,82,-50,82,-60,79,-66,77,-59,74,-54,70,-51,66,-48,61],
  /* 남아메리카 */
  [-78,7,-73,11,-68,11,-61,10,-55,6,-51,4,-50,0,-44,-3,-37,-5,-35,-8,-37,-12,-39,-16,-41,-22,-46,-24,-48,-28,-53,-33,-57,-35,-58,-39,-62,-41,-65,-45,-66,-49,-69,-52,-71,-54,-73,-51,-72,-46,-72,-41,-71,-35,-71,-29,-70,-23,-70,-18,-76,-14,-78,-10,-81,-5,-81,-2,-80,1,-78,4],
  /* 아프리카 */
  [-9,35,-6,36,0,37,10,37,11,34,15,32,20,32,25,32,32,31,34,28,36,24,37,21,39,16,43,12,45,11,48,11,51,12,51,10,46,4,42,0,40,-4,39,-9,37,-15,35,-20,33,-26,28,-33,22,-35,18,-34,16,-29,14,-23,12,-17,13,-11,12,-5,9,-1,9,4,6,4,1,6,-4,5,-8,4,-13,8,-17,14,-16,20,-13,26,-10,30],
  /* 유라시아(지중해·홍해 등 내해는 이후 바다색으로 덮음) */
  [-9,36,-9,43,-2,44,-1,46,-4,48,0,50,4,52,8,54,7,57,5,59,5,62,12,66,18,70,26,71,31,70,42,67,45,68,55,69,68,70,74,68,80,72,90,76,104,78,113,74,130,72,145,71,160,69,172,67,179,65,177,63,170,60,162,56,157,51,155,57,150,59,143,54,137,49,132,43,129,40,129,35,126,34,125,38,122,40,118,39,122,34,121,31,120,28,116,23,110,21,108,17,109,13,106,9,102,12,100,14,101,8,104,1,101,4,98,9,97,15,94,17,91,22,88,21,85,19,81,16,80,13,77,8,74,13,71,19,68,23,66,25,61,25,57,26,58,22,55,17,50,15,44,12,43,13,39,20,35,27,33,29,35,32,36,36,33,37,30,36,27,37,26,38,26,40,22,40,19,42,14,45,13,45,10,44,7,43,5,43,3,42,3,40,0,39,-1,37,-5,36],
  /* 오스트레일리아 */
  [114,-22,114,-26,115,-31,118,-35,124,-33,129,-32,133,-32,136,-35,138,-35,140,-38,144,-39,147,-38,150,-37,153,-32,153,-27,151,-24,149,-20,146,-18,143,-14,142,-11,139,-17,136,-15,136,-12,132,-11,130,-12,129,-15,126,-14,122,-17,119,-20],
  /* 남극 */
  [-180,-73,-140,-75,-100,-73,-75,-72,-62,-64,-58,-65,-64,-70,-45,-71,-20,-70,10,-69,40,-67,70,-68,100,-66,140,-66,170,-71,180,-73,180,-90,-180,-90]
];
const LAND_ISLANDS = [
  [-5,50,-3,53,-5,56,-4,58,-2,58,-1,56,1,53,0,51],                       // 영국
  [-10,52,-6,52,-6,55,-8,55,-10,54],                                     // 아일랜드
  [-22,63.5,-15,63.7,-13,65,-15,66.5,-21,66.3,-24,65],                   // 아이슬란드
  [140,41,142,39,141,37,140,35,137,34.6,134,34,132,34,131,34.5,134,35.6,137,37,139,38.5], // 혼슈
  [140,42,143,42.8,145,43.4,144,44.6,141,45.4,140,43.6],                 // 홋카이도
  [130,31,131.6,31.4,131.6,33.5,130,33.6,129.5,32],                      // 규슈
  [120.2,22.6,121.8,22.2,121.8,25,120.8,25.2,120,23.8],                  // 대만
  [120,13.8,121.5,13.8,122.3,14.5,122,16.5,121.6,18.4,120.4,18.6,119.9,16.3], // 루손
  [122,7,124,5.7,126.2,6.5,126.5,8.7,124.5,9.5,122.5,8.4],               // 민다나오
  [95.2,5.6,97.8,4.8,101,2,103,-1,106,-3,106.2,-6,104,-5.6,100,-1,97,2.6,95,4.4], // 수마트라
  [105.4,-6.1,110,-6.5,114.4,-7.5,114.5,-8.6,109,-7.8,105.5,-7.2],       // 자와
  [109,0.5,110,2.5,113,4.6,117.5,7,119.2,5.2,117.5,1,116.2,-2.5,113,-3.6,110,-2], // 보르네오
  [119,0.8,121,1.3,123.5,0.8,122.3,-2,121.5,-5.4,119.3,-5.6,119.8,-2.5], // 술라웨시
  [131,-1,134,-1.3,137,-2,141,-3,145,-5.5,150,-9,148,-10.3,143,-9,139,-8,135,-4,131.5,-2.6], // 뉴기니
  [43.5,-21.5,44.5,-25,47.2,-25,50.2,-16,49.2,-12.2,45,-16,43.3,-19],    // 마다가스카르
  [79.8,8.8,81.5,8.4,81.8,6.5,80.2,5.9,79.7,7.4],                        // 스리랑카
  [-85,22.6,-80,23.2,-76.8,20.5,-74.8,20.1,-78,21.4,-84,22],             // 쿠바
  [-74.5,19.9,-71,20,-68.4,18.6,-71,17.8,-74.4,18.4],                    // 히스파니올라
  [173,-34.5,175.5,-36.5,178.5,-37.7,177,-39.5,175,-41.4,172.6,-40.5,174,-38], // 뉴질랜드 북섬
  [172.8,-40.8,174.3,-41.8,173,-43.5,170,-46.2,166.6,-46,166.4,-45.2,171,-42.4], // 뉴질랜드 남섬
  [144.8,-40.8,148.3,-40.9,148,-43.4,145.3,-43],                         // 태즈메이니아
  [11,78,20,78,25,80,17,80.3,10,79.4]                                    // 스발바르
];
const SEAS = [
  /* 지중해 */
  [-5,35.8,0,36.8,10,37,12,34,15,32.3,20,32.3,25,31.8,32,31.2,34,31.5,35.5,33,36,36,33,37,30,36,27,37,26,38,26,40,22,40,19,42,14,45,13,44.6,10,43.6,7,43,5,42.8,3,41.6,3,40,0,39,-1,37],
  /* 흑해 */
  [29,41.5,34,41.8,41,41.8,40,44,36,45.5,33,44.5,30,43],
  /* 카스피해 */
  [50,37,54,37.5,54.5,41,53,45,50,46.5,47.5,45,47,41,48.5,38],
  /* 발트해 */
  [10,54.3,14,54.6,19,55.3,21,57,22,59,27,59.7,29,60.3,24,60.4,22,62,23,64,21.5,65.7,18.5,63,19.5,60.5,17,57.5,12,56],
  /* 홍해 */
  [33,29.5,35,28,37,24,40,19,43,13.3,41.8,12.8,38.5,17.5,35.5,22.5,32.8,27.5,32.3,29.3],
  /* 페르시아만 */
  [48,30,50,29.8,53,27.5,56,26.8,56.5,25.8,54,24.3,51,24.5,50,26.5,47.8,28.5]
];
const LAND_INNER = [
  [8,44,10,44,13,42,15,42,16,41,18,40,17,40,16,38,15,38,15,40,13,41,11,42,9,44],  // 이탈리아
  [12.5,38,15,38.2,15.5,37,13,36.7,12.4,37.6],                                    // 시칠리아
  [20,42,23,41,26,41,26,40,24,40,23,38,22,36.8,21,37.5,21,39,20,40]               // 그리스
];

function buildFallbackEarthTexture() {
  const W = 2048, H = 1024;
  const X = lon => (lon + 180) / 360 * W;
  const Y = lat => (90 - lat) / 180 * H;

  function drawPoly(ctx, flat) {
    ctx.beginPath();
    ctx.moveTo(X(flat[0]), Y(flat[1]));
    for (let i = 2; i < flat.length; i += 2) ctx.lineTo(X(flat[i]), Y(flat[i + 1]));
    ctx.closePath();
  }
  function paintLandCanvas(polyLists) {
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const x = c.getContext("2d");
    x.fillStyle = "#5b8a52";
    polyLists.forEach(list => list.forEach(p => { drawPoly(x, p); x.fill(); }));
    // 위도별 자연색(툰드라~숲~사막~숲~빙설)
    x.globalCompositeOperation = "source-atop";
    const g = x.createLinearGradient(0, 0, 0, H);
    [[90,"#eef3f6"],[78,"#e5ebe7"],[70,"#93a48b"],[62,"#557a50"],[50,"#5d8a51"],[38,"#7d9c58"],
     [30,"#c9ae72"],[22,"#cda964"],[12,"#5c944f"],[0,"#3f8041"],[-8,"#4c8a4a"],[-20,"#b7a06d"],
     [-32,"#7a9b5c"],[-45,"#6d9160"],[-58,"#a9bba8"],[-68,"#e2eaec"],[-90,"#f1f5f7"]]
      .forEach(s => g.addColorStop((90 - s[0]) / 180, s[1]));
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.globalCompositeOperation = "source-over";
    return c;
  }

  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d");

  // 바다
  const og = ctx.createLinearGradient(0, 0, 0, H);
  [[90,"#c9dcec"],[80,"#7fa8cf"],[68,"#3d6fa9"],[40,"#3e78b4"],[0,"#4c8bc2"],
   [-40,"#3e78b4"],[-64,"#3d6fa9"],[-78,"#9fc0da"],[-90,"#d7e5ef"]]
    .forEach(s => og.addColorStop((90 - s[0]) / 180, s[1]));
  ctx.fillStyle = og; ctx.fillRect(0, 0, W, H);

  // 육지(대륙 + 바깥 섬)
  ctx.drawImage(paintLandCanvas([LAND_MAIN, LAND_ISLANDS]), 0, 0);

  // 내해(지중해·흑해·카스피·발트·홍해·페르시아만)
  ctx.fillStyle = "#4a83b9";
  SEAS.forEach(p => { drawPoly(ctx, p); ctx.fill(); });

  // 내해 안의 육지(이탈리아·그리스 등)
  ctx.drawImage(paintLandCanvas([LAND_INNER]), 0, 0);

  // 해안선(은은하게)
  ctx.strokeStyle = "rgba(28,58,92,0.30)";
  ctx.lineWidth = 2; ctx.lineJoin = "round";
  [LAND_MAIN, LAND_ISLANDS, LAND_INNER].forEach(list =>
    list.forEach(p => { drawPoly(ctx, p); ctx.stroke(); }));

  const tex = setSRGB(new THREE.CanvasTexture(cv));
  tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 1);
  return tex;
}

/* ============================================================
   7. 지구 전체 보기(지구본) 구성
   ============================================================ */
const globe = {};
buildGlobeBase();

function buildGlobeBase() {
  // 본체 — 우선 fallback 텍스처로 즉시 표시
  globe.mat = new THREE.MeshLambertMaterial({ map: buildFallbackEarthTexture() });
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(R, 72, 48), globe.mat);
  globeGroup.add(sphere);

  // 인터넷이 되면 자연색 텍스처로 교체(실패해도 조용히 fallback 유지)
  (function tryLoad(i) {
    if (i >= EARTH_URLS.length) return;
    try {
      const loader = new THREE.TextureLoader();
      loader.setCrossOrigin("anonymous");
      loader.load(EARTH_URLS[i], function (tex) {
        setSRGB(tex);
        tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 1);
        globe.mat.map = tex;
        globe.mat.needsUpdate = true;
      }, undefined, function () { tryLoad(i + 1); });
    } catch (e) { /* 오프라인 등 — fallback 유지 */ }
  })(0);

  // 은은한 대기 글로우(카메라를 향하는 후광)
  const gcv = document.createElement("canvas");
  gcv.width = 256; gcv.height = 256;
  const gctx = gcv.getContext("2d");
  const gg = gctx.createRadialGradient(128, 128, 70, 128, 128, 128);
  gg.addColorStop(0, "rgba(120,170,235,0)");
  gg.addColorStop(0.62, "rgba(120,170,235,0.24)");
  gg.addColorStop(0.82, "rgba(140,185,240,0.10)");
  gg.addColorStop(1, "rgba(150,190,240,0)");
  gctx.fillStyle = gg; gctx.fillRect(0, 0, 256, 256);
  const glowMat = new THREE.SpriteMaterial({ map: setSRGB(new THREE.CanvasTexture(gcv)), transparent: true, depthTest: false, depthWrite: false });
  const glow = new THREE.Sprite(glowMat);
  glow.scale.set(R * 3.05, R * 3.05, 1);
  glow.renderOrder = -1;
  globeGroup.add(glow);

  // 위도·경도선(레이어) — 은은하게, 0°·30°·60°는 라벨과 함께
  globe.grid = new THREE.Group(); globeGroup.add(globe.grid);
  buildGraticule();

  // 동적 그룹
  globe.belts   = new THREE.Group(); globeGroup.add(globe.belts);
  globe.precip  = new THREE.Group(); globeGroup.add(globe.precip);
  globe.cells   = new THREE.Group(); globeGroup.add(globe.cells);
  globe.windsCor = new THREE.Group(); globeGroup.add(globe.windsCor);      // 휘어진 바람
  globe.windsStr = new THREE.Group(); globeGroup.add(globe.windsStr);      // 곧게 부는 바람
  globe.pickers = new THREE.Group(); globeGroup.add(globe.pickers);
  globe.corDots = []; globe.strDots = [];

  buildGlobeBelts();
  buildGlobePrecip();
  buildGlobeCells();
  buildGlobeWinds();
  buildGlobePickers();
}

function buildGraticule() {
  const mat = new THREE.LineBasicMaterial({ color: 0x33507a, transparent: true, opacity: 0.22 });
  const matKey = new THREE.LineBasicMaterial({ color: 0x2b6fe3, transparent: true, opacity: 0.42 });
  function parallel(lat, m) {
    const pts = [];
    for (let i = 0; i <= 96; i++) pts.push(latLonToVec(lat, i / 96 * 360, R * 1.004));
    globe.grid.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), m));
  }
  [-60, -30, 30, 60].forEach(l => parallel(l, mat));
  parallel(0, matKey);
  for (let lon = 0; lon < 360; lon += 30) {
    const pts = [];
    for (let i = 0; i <= 48; i++) pts.push(latLonToVec(-90 + i / 48 * 180, lon, R * 1.004));
    globe.grid.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
  }
  [[0, "0°"], [30, "30°N"], [-30, "30°S"], [60, "60°N"], [-60, "60°S"]].forEach(d => {
    [12, 192].forEach(lon => {
      const l = makeLabel(d[1], { fontSize: 34, color: "#3a5480", halo: "rgba(255,255,255,0.9)", worldHeight: 0.085 });
      l.position.copy(latLonToVec(d[0] + 2.5, lon, R * 1.02));
      globe.grid.add(l);
    });
  });
}

/* 오르내리는 공기 띠(기압대) — 위도 밴드 + 오름/내림 무늬 */
function beltBand(latLo, latHi, mat) {
  const phi0 = (90 - latHi) * DEG, phi1 = (90 - latLo) * DEG;
  const geo = new THREE.SphereGeometry(R * 1.013, 96, 5, 0, Math.PI * 2, Math.min(phi0, phi1), Math.abs(phi1 - phi0));
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = 2;
  return m;
}
function buildGlobeBelts() {
  disposeGroup(globe.belts);
  const sh = seasonShift();
  const defs = [
    [clampLat(-6 + sh),  clampLat(6 + sh),   MAT.beltEq],
    [clampLat(25 + sh),  clampLat(35 + sh),  MAT.beltSub],
    [clampLat(-35 + sh), clampLat(-25 + sh), MAT.beltSub],
    [clampLat(55 + sh),  clampLat(65 + sh),  MAT.beltFront],
    [clampLat(-65 + sh), clampLat(-55 + sh), MAT.beltFront]
  ];
  defs.forEach(d => { if (d[1] - d[0] > 1.5) globe.belts.add(beltBand(d[0], d[1], d[2])); });
  // 극 캡
  const nCap = clampLat(78 + sh), sCap = clampLat(-78 + sh);
  if (nCap < 88) globe.belts.add(beltBand(nCap, 89.7, MAT.beltPole));
  if (sCap > -88) globe.belts.add(beltBand(-89.7, sCap, MAT.beltPole));
}

/* 비 많은 곳 / 건조한 곳 — 아이콘 스프라이트 */
function buildGlobePrecip() {
  disposeGroup(globe.precip);
  const sh = seasonShift();
  function ring(lat, mat, n, off, sc) {
    const l = clampLat(lat + sh);
    for (let i = 0; i < n; i++) {
      const sp = new THREE.Sprite(mat);
      sp.scale.set(sc * 0.84, sc, 1);
      sp.position.copy(latLonToVec(l, off + i / n * 360, R * 1.115));
      globe.precip.add(sp);
    }
  }
  ring(0,   MAT.wetIcon, 8, 24, 0.30);
  ring(60,  MAT.wetIcon, 6, 0,  0.27);
  ring(-60, MAT.wetIcon, 6, 30, 0.27);
  ring(30,  MAT.dryIcon, 7, 10, 0.27);
  ring(-30, MAT.dryIcon, 7, 36, 0.27);
  ring(80,  MAT.dryIcon, 3, 60, 0.22);
  ring(-80, MAT.dryIcon, 3, 0,  0.22);
}

/* 공기의 큰 순환 — 자오면 고리 화살표(세 경도에 배치) */
function buildGlobeCells() {
  disposeGroup(globe.cells);
  const sh = seasonShift();
  const rIn = R * 1.06, rOut = R * 1.30;
  const uv = roundedLoopUV(0.2);
  [15, 135, 255].forEach(lonM => {
    CELLS.forEach(c => {
      [1, -1].forEach(hemi => {
        const latRise = clampLat(c.rise * hemi + sh);
        const latSink = clampLat(c.sink * hemi + sh);
        if (Math.abs(latRise - latSink) < 8) return;
        const pts = uv.map(p => {
          const lat = latSink + (latRise - latSink) * p[0];
          const rad = rIn + (rOut - rIn) * p[1];
          return latLonToVec(lat, lonM, rad);
        });
        const lg = loopGeom(pts, 0.017, 0.05, 0.115, [0.14, 0.5, 0.86]);
        globe.cells.add(new THREE.Mesh(lg.geom, MAT["cell_" + c.id]));
      });
    });
  });
}

/* 땅 가까이 부는 바람 — 곡선 화살표 띠(휘어짐 ON/OFF 두 세트) */
function windArrowSet(group, dots, curved) {
  const sh = seasonShift();
  const rW = R * 1.038;
  WIND_BANDS.forEach(b => {
    const mat = MAT["wind_" + b.id];
    [1, -1].forEach(hemi => {
      const latA = clampLat(b.from * hemi + sh);
      const latB = clampLat(b.to * hemi + sh);
      const step = 360 / b.n;
      for (let k = 0; k < b.n; k++) {
        const lon0 = b.lonOff + hemi * 11 + k * step;
        const pts = [];
        for (let i = 0; i <= 12; i++) {
          const t = i / 12;
          pts.push(latLonToVec(latA + (latB - latA) * t, lon0 + (curved ? b.dLon * t : 0), rW));
        }
        const ar = arrowGeom(pts, 0.02, 0.052, 0.13);
        group.add(new THREE.Mesh(ar.geom, mat));
        if (k % 3 === 0) dots.push({ curve: ar.curve, t: Math.random(), sprite: null });
      }
    });
    // 바람 이름 라벨
    [1, -1].forEach(hemi => {
      const latM = clampLat((b.from + b.to) / 2 * hemi + sh);
      [55, 235].forEach(lon => {
        const l = makeLabel(b.name, {
          fontSize: 40, color: b.color, bg: "rgba(255,255,255,0.92)",
          border: b.color + "66", worldHeight: 0.125, pad: 16
        });
        l.position.copy(latLonToVec(latM, lon + (hemi > 0 ? 0 : 24), R * 1.17));
        group.add(l);
      });
    });
  });
  // 흐름 점(아주 약한 방향감 애니메이션)
  dots.forEach(d => {
    const sp = new THREE.Sprite(MAT.flowDot);
    sp.scale.set(0.055, 0.055, 1);
    d.sprite = sp;
    group.add(sp);
  });
}
function buildGlobeWinds() {
  disposeGroup(globe.windsCor); globe.corDots = [];
  disposeGroup(globe.windsStr); globe.strDots = [];
  windArrowSet(globe.windsCor, globe.corDots, true);
  windArrowSet(globe.windsStr, globe.strDots, false);
}

/* 클릭 픽킹용 투명 밴드 */
function buildGlobePickers() {
  disposeGroup(globe.pickers);
  const sh = seasonShift();
  const defs = [
    { lat: 0,  z: ZONES.eq,    span: 17 },
    { lat: 30, z: ZONES.sub,   span: 14 }, { lat: -30, z: ZONES.sub,   span: 14 },
    { lat: 60, z: ZONES.front, span: 14 }, { lat: -60, z: ZONES.front, span: 14 },
    { lat: 82, z: ZONES.pole,  span: 15 }, { lat: -82, z: ZONES.pole,  span: 15 }
  ];
  const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  defs.forEach(d => {
    const lat = clampLat(d.lat + sh);
    const phi0 = (90 - Math.min(89.5, lat + d.span / 2)) * DEG;
    const phi1 = (90 - Math.max(-89.5, lat - d.span / 2)) * DEG;
    const geo = new THREE.SphereGeometry(R * 1.05, 48, 8, 0, Math.PI * 2, Math.min(phi0, phi1), Math.abs(phi1 - phi0));
    const m = new THREE.Mesh(geo, mat);
    m.userData.zone = d.z;
    m.userData.hemi = d.lat >= 0 ? 1 : -1;
    globe.pickers.add(m);
  });
}

/* ============================================================
   8. 공기 흐름 단면 보기 구성
   좌: 남극(-90) — 중앙: 적도 — 우: 북극(+90)
   ============================================================ */
const XW = 2.45;
const GROUND_Y = -1.1;
const TOP_Y = 1.0;
function latToX(lat) { return (lat / 90) * XW; }

const cross = {};
buildCrossBase();

function buildCrossBase() {
  cross.static  = new THREE.Group(); crossGroup.add(cross.static);
  cross.belts   = new THREE.Group(); crossGroup.add(cross.belts);
  cross.cells   = new THREE.Group(); crossGroup.add(cross.cells);
  cross.winds   = new THREE.Group(); crossGroup.add(cross.winds);
  cross.precip  = new THREE.Group(); crossGroup.add(cross.precip);
  cross.pickers = new THREE.Group(); crossGroup.add(cross.pickers);
  cross.sunG    = new THREE.Group(); crossGroup.add(cross.sunG);
  cross.grid    = new THREE.Group(); crossGroup.add(cross.grid);
  cross.flowDots = [];

  // 하늘(둥근 카드 느낌)
  const scv = document.createElement("canvas");
  scv.width = 1024; scv.height = 512;
  const sctx = scv.getContext("2d");
  const sg = sctx.createLinearGradient(0, 0, 0, 512);
  sg.addColorStop(0, "#e9f4ff");
  sg.addColorStop(0.7, "#f4faff");
  sg.addColorStop(1, "#fbfdff");
  sctx.fillStyle = sg;
  roundRect(sctx, 2, 2, 1020, 508, 30); sctx.fill();
  sctx.strokeStyle = "rgba(70,105,160,0.22)"; sctx.lineWidth = 3;
  roundRect(sctx, 2, 2, 1020, 508, 30); sctx.stroke();
  const skyW = XW * 2 + 0.7, skyH = (TOP_Y - GROUND_Y) + 0.18;
  const sky = new THREE.Mesh(
    new THREE.PlaneGeometry(skyW, skyH),
    new THREE.MeshBasicMaterial({ map: setSRGB(new THREE.CanvasTexture(scv)), transparent: true })
  );
  sky.position.set(0, (TOP_Y + GROUND_Y) / 2 + 0.04, -0.06);
  cross.static.add(sky);

  // 지면(초록 띠) + 고정 위도 눈금
  const gcv = document.createElement("canvas");
  gcv.width = 1024; gcv.height = 64;
  const gctx = gcv.getContext("2d");
  const gg = gctx.createLinearGradient(0, 0, 0, 64);
  gg.addColorStop(0, "#a8cc8e"); gg.addColorStop(1, "#8fb877");
  gctx.fillStyle = gg;
  roundRect(gctx, 1, 1, 1022, 62, 16); gctx.fill();
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(skyW, 0.17),
    new THREE.MeshBasicMaterial({ map: setSRGB(new THREE.CanvasTexture(gcv)), transparent: true })
  );
  ground.position.set(0, GROUND_Y - 0.085, 0);
  cross.static.add(ground);

  // 고정 기준 눈금(위도) — 띠가 계절에 따라 움직이는 것을 비교하는 기준
  const tickMat = new THREE.LineBasicMaterial({ color: 0x5c7397, transparent: true, opacity: 0.6 });
  [[-60, "60°S"], [-30, "30°S"], [0, "적도 0°"], [30, "30°N"], [60, "60°N"]].forEach(d => {
    const x = latToX(d[0]);
    const g = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x, GROUND_Y - 0.17, 0.02), new THREE.Vector3(x, GROUND_Y - 0.01, 0.02)
    ]);
    cross.static.add(new THREE.Line(g, tickMat));
    const l = makeLabel(d[1], { fontSize: 30, color: "#4a5d7e", halo: "rgba(255,255,255,0.9)", worldHeight: 0.082 });
    l.position.set(x, GROUND_Y - 0.27, 0.03);
    cross.static.add(l);
  });
  const lS = makeLabel("남극", { fontSize: 30, color: "#4a5d7e", worldHeight: 0.082, halo: "rgba(255,255,255,0.9)" });
  lS.position.set(latToX(-85), GROUND_Y - 0.27, 0.03); cross.static.add(lS);
  const lN = makeLabel("북극", { fontSize: 30, color: "#4a5d7e", worldHeight: 0.082, halo: "rgba(255,255,255,0.9)" });
  lN.position.set(latToX(85), GROUND_Y - 0.27, 0.03); cross.static.add(lN);

  // 세로 위도선(위도·경도선 레이어로 켜고 끔)
  const glMat = new THREE.LineBasicMaterial({ color: 0x33507a, transparent: true, opacity: 0.18 });
  const glKey = new THREE.LineBasicMaterial({ color: 0x2b6fe3, transparent: true, opacity: 0.34 });
  [-60, -30, 0, 30, 60].forEach(lat => {
    const x = latToX(lat);
    const g = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x, GROUND_Y, 0.015), new THREE.Vector3(x, TOP_Y, 0.015)
    ]);
    cross.grid.add(new THREE.Line(g, lat === 0 ? glKey : glMat));
  });

  buildCrossBelts();
  buildCrossCells();
  buildCrossWinds();
  buildCrossPrecip();
  buildCrossSun();
  buildCrossPickers();

  crossGroup.visible = false;
}

/* 단면: 오르내리는 공기 띠(기둥 + 굵은 상승/하강 화살표 + 라벨) */
function buildCrossBelts() {
  disposeGroup(cross.belts);
  const sh = seasonShift();
  const defs = [
    { lat: 0,   colMat: MAT.colEq,    arrMat: MAT.rise0,  up: true,  z: ZONES.eq,    main: "공기 올라감", sub: "저압대 L" },
    { lat: 30,  colMat: MAT.colSub,   arrMat: MAT.sink30, up: false, z: ZONES.sub,   main: "공기 내려감", sub: "고압대 H" },
    { lat: -30, colMat: MAT.colSub,   arrMat: MAT.sink30, up: false, z: ZONES.sub,   main: "공기 내려감", sub: "고압대 H" },
    { lat: 60,  colMat: MAT.colFront, arrMat: MAT.rise60, up: true,  z: ZONES.front, main: "공기 올라감", sub: "저압대 L" },
    { lat: -60, colMat: MAT.colFront, arrMat: MAT.rise60, up: true,  z: ZONES.front, main: "공기 올라감", sub: "저압대 L" },
    { lat: 86,  colMat: MAT.colPole,  arrMat: MAT.sink90, up: false, z: ZONES.pole,  main: "공기 내려감", sub: "고압대 H" },
    { lat: -86, colMat: MAT.colPole,  arrMat: MAT.sink90, up: false, z: ZONES.pole,  main: "공기 내려감", sub: "고압대 H" }
  ];
  defs.forEach(d => {
    const lat = d.lat + sh;
    if (lat > 89 || lat < -89) return;
    const x = latToX(lat);

    // 기둥(은은한 색 배경)
    const colH = TOP_Y - GROUND_Y - 0.06;
    const col = new THREE.Mesh(new THREE.PlaneGeometry(0.34, colH), d.colMat);
    col.position.set(x, GROUND_Y + colH / 2 + 0.02, -0.03);
    cross.belts.add(col);

    // 굵은 상승/하강 화살표
    const y0 = d.up ? GROUND_Y + 0.16 : GROUND_Y + 1.16;
    const y1 = d.up ? GROUND_Y + 1.02 : GROUND_Y + 0.30;
    const ar = arrowGeom(
      [new THREE.Vector3(x, y0, 0.02), new THREE.Vector3(x, (y0 + y1) / 2, 0.02), new THREE.Vector3(x, y1, 0.02)],
      0.031, 0.085, 0.18
    );
    cross.belts.add(new THREE.Mesh(ar.geom, d.arrMat));

    // 바닥 배지: 쉬운 말 + 교과 용어
    const badge = makeLabel(d.main, {
      sub: d.sub, fontSize: 33, color: "#" + new THREE.Color(d.z.color).getHexString(),
      bg: "rgba(255,255,255,0.95)", border: d.z.color + "88", worldHeight: 0.17, pad: 15
    });
    badge.position.set(x, GROUND_Y + 0.30, 0.1);
    cross.belts.add(badge);

    // 위 라벨: 현재 위도(계절 이동 시 숫자가 함께 변함)
    const latTxt = Math.abs(d.lat) >= 86
      ? (d.lat > 0 ? "북극 부근" : "남극 부근")
      : Math.abs(Math.round(lat)) + "°" + (lat > 0.5 ? "N" : (lat < -0.5 ? "S" : ""));
    const ll = makeLabel(latTxt, { fontSize: 30, color: "#3a5480", halo: "rgba(255,255,255,0.9)", worldHeight: 0.085 });
    ll.position.set(x, TOP_Y + 0.12, 0.03);
    cross.belts.add(ll);
  });
}

/* 단면: 공기의 큰 순환(고리 화살표 + 흐름 점 + 이름표) */
function buildCrossCells() {
  disposeGroup(cross.cells);
  cross.flowDots = [];
  const sh = seasonShift();
  const uv = roundedLoopUV(0.16);
  const vB = GROUND_Y + 0.13, vT = TOP_Y - 0.15;

  CELLS.forEach(c => {
    [1, -1].forEach(hemi => {
      const latRise = clampLat(c.rise * hemi + sh);
      const latSink = clampLat(c.sink * hemi + sh);
      if (Math.abs(latRise - latSink) < 8) return;
      const inset = 0.09;
      const xR = latToX(latRise) + (latToX(latSink) > latToX(latRise) ? inset : -inset);
      const xS = latToX(latSink) + (latToX(latSink) > latToX(latRise) ? -inset : inset);
      const pts = uv.map(p => new THREE.Vector3(
        xS + (xR - xS) * p[0],
        vB + (vT - vB) * p[1],
        0
      ));
      const lg = loopGeom(pts, 0.020, 0.062, 0.135, [0.13, 0.42, 0.63, 0.9]);
      cross.cells.add(new THREE.Mesh(lg.geom, MAT["cell_" + c.id]));

      // 흐름 점 3개(아주 약한 애니메이션)
      for (let k = 0; k < 3; k++) {
        const sp = new THREE.Sprite(MAT.flowDot);
        sp.scale.set(0.06, 0.06, 1);
        cross.cells.add(sp);
        cross.flowDots.push({ curve: lg.curve, t: k / 3, sprite: sp });
      }

      // 이름표(북반구 쪽에만 — 과밀 방지)
      if (hemi > 0) {
        const lab = makeLabel(c.name, {
          sub: c.range, fontSize: 34, color: "#" + new THREE.Color(c.color).getHexString(),
          bg: "rgba(255,255,255,0.95)", border: c.color + "77", worldHeight: 0.155, pad: 14
        });
        lab.position.set((xR + xS) / 2, vT + 0.02, 0.12);
        cross.cells.add(lab);
      }
    });
  });
}

/* 단면: 땅 가까이 부는 바람(지면 화살표) */
function buildCrossWinds() {
  disposeGroup(cross.winds);
  const sh = seasonShift();
  const y = GROUND_Y + 0.30;
  const defs = [
    { latC: 16,  dir: -1, b: WIND_BANDS[0] }, { latC: -16, dir: 1,  b: WIND_BANDS[0] },
    { latC: 45,  dir: 1,  b: WIND_BANDS[1] }, { latC: -45, dir: -1, b: WIND_BANDS[1] },
    { latC: 74,  dir: -1, b: WIND_BANDS[2] }, { latC: -74, dir: 1,  b: WIND_BANDS[2] }
  ];
  defs.forEach(d => {
    const x = latToX(d.latC + sh);
    if (x < -XW + 0.3 || x > XW - 0.3) return;
    const half = 0.27 * d.dir;
    const ar = arrowGeom(
      [new THREE.Vector3(x - half, y, 0.05), new THREE.Vector3(x, y, 0.05), new THREE.Vector3(x + half, y, 0.05)],
      0.026, 0.075, 0.16
    );
    cross.winds.add(new THREE.Mesh(ar.geom, MAT["wind_" + d.b.id]));
    if (d.latC > 0) {
      const l = makeLabel(d.b.name, {
        fontSize: 30, color: d.b.color, bg: "rgba(255,255,255,0.93)",
        border: d.b.color + "66", worldHeight: 0.105, pad: 12
      });
      l.position.set(x, y + 0.20, 0.08);
      cross.winds.add(l);
    }
  });
}

/* 단면: 비 많은 곳 / 건조한 곳(아이콘) */
function buildCrossPrecip() {
  disposeGroup(cross.precip);
  const sh = seasonShift();
  function icon(lat, mat, yy, sc) {
    const x = latToX(lat + sh);
    if (x < -XW || x > XW) return;
    const sp = new THREE.Sprite(mat);
    sp.scale.set(sc * 0.84, sc, 1);
    sp.position.set(x, yy, 0.14);
    cross.precip.add(sp);
  }
  icon(0,   MAT.wetIcon, GROUND_Y + 1.52, 0.34);
  icon(60,  MAT.wetIcon, GROUND_Y + 1.52, 0.30);
  icon(-60, MAT.wetIcon, GROUND_Y + 1.52, 0.30);
  icon(30,  MAT.dryIcon, GROUND_Y + 1.52, 0.30);
  icon(-30, MAT.dryIcon, GROUND_Y + 1.52, 0.30);
  icon(86,  MAT.dryIcon, GROUND_Y + 1.30, 0.24);
  icon(-86, MAT.dryIcon, GROUND_Y + 1.30, 0.24);
}

/* 단면: 태양 위치 표시(계절 슬라이더와 연동) */
function buildCrossSun() {
  disposeGroup(cross.sunG);
  const cv = document.createElement("canvas");
  cv.width = 160; cv.height = 160;
  const ctx = cv.getContext("2d");
  ctx.fillStyle = "#ffcf4d"; ctx.strokeStyle = "#eba81f"; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.arc(80, 80, 34, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = "#ffcf4d"; ctx.lineWidth = 10; ctx.lineCap = "round";
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(80 + Math.cos(a) * 46, 80 + Math.sin(a) * 46);
    ctx.lineTo(80 + Math.cos(a) * 64, 80 + Math.sin(a) * 64);
    ctx.stroke();
  }
  const sunMat = new THREE.SpriteMaterial({ map: setSRGB(new THREE.CanvasTexture(cv)), transparent: true, depthWrite: false });
  sunMat.userData.own = true;
  cross.sun = new THREE.Sprite(sunMat);
  cross.sun.scale.set(0.3, 0.3, 1);
  cross.sunG.add(cross.sun);
  cross.sunLabel = makeLabel("햇빛이 가장 강한 곳", {
    fontSize: 27, color: "#9a6b09", bg: "rgba(255,248,222,0.95)", border: "rgba(214,164,50,0.6)",
    worldHeight: 0.095, pad: 12
  });
  cross.sunG.add(cross.sunLabel);
  updateCrossSun();
}
function updateCrossSun() {
  if (!cross.sun) return;
  const x = latToX(state.season * 23.5);
  cross.sun.position.set(x, TOP_Y + 0.30, 0.1);
  cross.sunLabel.position.set(x, TOP_Y + 0.30 - 0.22, 0.12);
  cross.sunLabel.visible = Math.abs(state.season) > 0.02 || state.stepIndex === 6;
}

/* 단면 클릭 픽킹용 투명 기둥 */
function buildCrossPickers() {
  disposeGroup(cross.pickers);
  const sh = seasonShift();
  const defs = [
    { lat: 0,  z: ZONES.eq,    w: 0.7 },
    { lat: 30, z: ZONES.sub,   w: 0.62 }, { lat: -30, z: ZONES.sub,   w: 0.62 },
    { lat: 60, z: ZONES.front, w: 0.62 }, { lat: -60, z: ZONES.front, w: 0.62 },
    { lat: 84, z: ZONES.pole,  w: 0.66 }, { lat: -84, z: ZONES.pole,  w: 0.66 }
  ];
  const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
  defs.forEach(d => {
    const lat = d.lat + sh;
    if (lat > 89 || lat < -89) return;
    const geo = new THREE.PlaneGeometry(d.w, TOP_Y - GROUND_Y + 0.5);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(latToX(lat), (TOP_Y + GROUND_Y) / 2, 0.2);
    m.userData.zone = d.z;
    m.userData.hemi = d.lat >= 0 ? 1 : -1;
    cross.pickers.add(m);
  });
}

/* ============================================================
   9. 레이어 가시성
   ============================================================ */
function applyVisibility() {
  const L = state.layers, isGlobe = state.view === "globe";
  globeGroup.visible = isGlobe;
  crossGroup.visible = !isGlobe;

  globe.belts.visible  = L.belts;
  globe.precip.visible = L.precip;
  globe.cells.visible  = L.cells;
  globe.grid.visible   = L.grid;
  globe.windsCor.visible = L.winds && L.coriolis;
  globe.windsStr.visible = L.winds && !L.coriolis;

  cross.belts.visible  = L.belts;
  cross.precip.visible = L.precip;
  cross.cells.visible  = L.cells;
  cross.winds.visible  = L.winds;
  cross.grid.visible   = L.grid;

  document.getElementById("controls-hint").textContent = isGlobe
    ? "드래그: 돌리기 · 휠/두 손가락: 확대·축소 · 색깔 띠 클릭: 설명 카드"
    : "색깔 띠(기둥)를 클릭: 설명 카드 · 휠/두 손가락: 확대·축소";
}

/* 계절 변경 → 위치 의존 요소 재생성(프레임당 1회로 제한) */
function rebuildSeasonDependent() {
  buildGlobeBelts(); buildGlobePrecip(); buildGlobeCells(); buildGlobeWinds(); buildGlobePickers();
  buildCrossBelts(); buildCrossCells(); buildCrossWinds(); buildCrossPrecip(); buildCrossPickers();
  updateCrossSun();
  applyVisibility();
}
let seasonPending = false;
function requestSeasonRebuild() {
  if (seasonPending) return;
  seasonPending = true;
  requestAnimationFrame(function () { seasonPending = false; rebuildSeasonDependent(); });
}

/* ============================================================
   10. 카메라 · 조작(드래그 회전, 휠·핀치 줌, 화면 크기 맞춤)
   ============================================================ */
let dragging = false, lastX = 0, lastY = 0, dragMoved = 0;
let pinching = false, pinchD = 0;
let userTouched = false;
const rot = { x: 0.3, y: -0.55 };
let camZ = 5.4, fitZ = 5.4;

function fitDist(view) {
  const aspect = Math.max(0.35, camera.aspect || 1);
  if (view === "globe") {
    const need = R * 1.52;
    return Math.max(need / TANF, need / (TANF * aspect));
  }
  const needH = 1.56, needW = XW + 0.55;
  return Math.max(needH / TANF, needW / (TANF * aspect));
}
function refitCamera(force) {
  const nf = fitDist(state.view);
  if (force || Math.abs(camZ - fitZ) < 0.02) camZ = nf;
  fitZ = nf;
  camZ = Math.max(fitZ * 0.45, Math.min(fitZ * 1.9, camZ));
  camera.position.set(0, 0, camZ);
  camera.lookAt(0, 0, 0);
}

function onPointerDown(e) {
  if (e.touches && e.touches.length === 2) {
    pinching = true; dragging = false;
    pinchD = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
    return;
  }
  dragging = true; userTouched = true; dragMoved = 0;
  const pt = e.touches ? e.touches[0] : e;
  lastX = pt.clientX; lastY = pt.clientY;
}
function onPointerMove(e) {
  if (pinching && e.touches && e.touches.length === 2) {
    const nd = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
    if (nd > 0) {
      camZ = Math.max(fitZ * 0.45, Math.min(fitZ * 1.9, camZ * pinchD / nd));
      camera.position.z = camZ;
      pinchD = nd;
    }
    return;
  }
  if (!dragging) return;
  const pt = e.touches ? e.touches[0] : e;
  const dx = pt.clientX - lastX, dy = pt.clientY - lastY;
  lastX = pt.clientX; lastY = pt.clientY;
  dragMoved += Math.abs(dx) + Math.abs(dy);
  if (state.view === "globe") {
    rot.y += dx * 0.006;
    rot.x += dy * 0.006;
    rot.x = Math.max(-1.35, Math.min(1.35, rot.x));
  }
}
function onPointerUp(e) {
  if (e.touches && e.touches.length > 0) { pinching = e.touches.length >= 2; return; }
  if (dragging && dragMoved < 7) tryPick(e);
  dragging = false; pinching = false;
}
function onWheel(e) {
  e.preventDefault();
  camZ = Math.max(fitZ * 0.45, Math.min(fitZ * 1.9, camZ + (e.deltaY > 0 ? 1 : -1) * fitZ * 0.06));
  camera.position.z = camZ;
}
canvas.addEventListener("mousedown", onPointerDown);
window.addEventListener("mousemove", onPointerMove);
window.addEventListener("mouseup", onPointerUp);
canvas.addEventListener("touchstart", onPointerDown, { passive: true });
canvas.addEventListener("touchmove", onPointerMove, { passive: true });
canvas.addEventListener("touchend", onPointerUp);
canvas.addEventListener("wheel", onWheel, { passive: false });

/* ============================================================
   11. 클릭 → 정보 카드
   ============================================================ */
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function tryPick(e) {
  const pt = (e.changedTouches ? e.changedTouches[0] : e);
  const rect = canvas.getBoundingClientRect();
  ndc.x = ((pt.clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((pt.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(ndc, camera);
  const targets = state.view === "globe" ? globe.pickers.children : cross.pickers.children;
  const hits = raycaster.intersectObjects(targets, false);
  if (hits.length) showCard(hits[0].object.userData.zone, hits[0].object.userData.hemi);
}

function showCard(z, hemi) {
  if (!z) return;
  document.getElementById("card-dot").style.background = z.color;
  document.getElementById("card-title").textContent = z.title;
  document.getElementById("card-term").textContent = z.term;
  let latTxt;
  if (z.id === "eq") latTxt = "0° 부근";
  else if (z.id === "pole") latTxt = hemi > 0 ? "북극 부근" : "남극 부근";
  else latTxt = z.lat + "°" + (hemi > 0 ? "N" : "S") + " 부근";
  document.getElementById("card-lat").textContent = latTxt;
  document.getElementById("card-move").innerHTML = z.move;
  document.getElementById("card-rain").innerHTML = z.rain;
  document.getElementById("card-region").innerHTML = z.region;
  document.getElementById("card-sum").textContent = z.sum;
  document.getElementById("card").classList.add("show");
}
function hideCard() { document.getElementById("card").classList.remove("show"); }
document.getElementById("card-close").addEventListener("click", hideCard);

/* ============================================================
   12. UI — 표시할 내용(레이어), 보기 전환, 사이드바, 계절, 이해 순서
   ============================================================ */
const LAYER_DEFS = [
  { id: "cells",    name: "공기의 큰 순환",        sub: "해들리·페렐·극 순환",       color: COL.cellH },
  { id: "belts",    name: "오르내리는 공기 띠",    sub: "기압대",                    color: COL.arid },
  { id: "winds",    name: "땅 가까이 부는 바람",   sub: "무역풍·편서풍·극동풍",      color: COL.windTrade },
  { id: "coriolis", name: "바람 휘어짐",           sub: "전향력 — 지구 자전 때문",   color: COL.windWest },
  { id: "precip",   name: "비 많은 곳 / 건조한 곳", sub: "강수 분포",                color: COL.wet },
  { id: "grid",     name: "위도·경도선",           sub: "0°·30°·60° 위도 확인",      color: "#8ea3c4" }
];
function buildLayerList() {
  const list = document.getElementById("layer-list");
  list.innerHTML = "";
  LAYER_DEFS.forEach(d => {
    const row = document.createElement("div");
    row.className = "layer";
    row.dataset.layer = d.id;
    row.setAttribute("role", "checkbox");
    row.setAttribute("tabindex", "0");
    row.setAttribute("aria-checked", String(state.layers[d.id]));
    row.innerHTML =
      '<span class="swatch" style="background:' + d.color + '"></span>' +
      '<span class="name">' + d.name + "<small>" + d.sub + "</small></span>" +
      '<span class="switch"></span>';
    const toggle = function () {
      state.layers[d.id] = !state.layers[d.id];
      row.setAttribute("aria-checked", String(state.layers[d.id]));
      applyVisibility();
    };
    row.addEventListener("click", toggle);
    row.addEventListener("keydown", function (ev) {
      if (ev.key === " " || ev.key === "Enter") { ev.preventDefault(); toggle(); }
    });
    list.appendChild(row);
  });
}
function refreshLayerList() {
  document.querySelectorAll("#layer-list .layer").forEach(function (row) {
    row.setAttribute("aria-checked", String(state.layers[row.dataset.layer]));
  });
}
/* --- 보기 전환 --- */
function setView(v) {
  state.view = v;
  document.getElementById("view-globe").setAttribute("aria-pressed", String(v === "globe"));
  document.getElementById("view-cross").setAttribute("aria-pressed", String(v === "cross"));
  refitCamera(true);
  applyVisibility();
}
document.getElementById("view-globe").addEventListener("click", function () { setView("globe"); });
document.getElementById("view-cross").addEventListener("click", function () { setView("cross"); });

/* --- 사이드바 접기/펴기 --- */
const sidebar = document.getElementById("sidebar");
document.getElementById("sidebar-close").addEventListener("click", function () { sidebar.classList.add("collapsed"); });
document.getElementById("sidebar-handle").addEventListener("click", function () { sidebar.classList.remove("collapsed"); });
if (window.innerWidth < 700) sidebar.classList.add("collapsed");

/* --- 계절 슬라이더 --- */
function seasonText(v) {
  if (Math.abs(v) < 0.06) return "춘·추분 — 기압대가 적도를 기준으로 대칭";
  const deg = Math.round(Math.abs(v) * SHIFT_MAX);
  return v > 0
    ? "<b>7월 쪽</b> — 기압대·바람대가 북쪽으로 약 " + deg + "° 이동"
    : "<b>1월 쪽</b> — 기압대·바람대가 남쪽으로 약 " + deg + "° 이동";
}
document.getElementById("season").addEventListener("input", function (e) {
  state.season = parseFloat(e.target.value);
  document.getElementById("season-readout").innerHTML = seasonText(state.season);
  requestSeasonRebuild();
});

/* --- 이해 순서(7단계) --- */
function buildStepList() {
  const ol = document.getElementById("step-list");
  ol.innerHTML = "";
  STEPS.forEach(function (s, i) {
    const li = document.createElement("li");
    li.innerHTML = '<span class="num">' + (i + 1) + "</span><span>" + s.title + "</span>";
    li.setAttribute("tabindex", "0");
    li.addEventListener("click", function () { applyStep(i); });
    li.addEventListener("keydown", function (ev) {
      if (ev.key === " " || ev.key === "Enter") { ev.preventDefault(); applyStep(i); }
    });
    ol.appendChild(li);
  });
}
function applyStep(i) {
  state.stepIndex = i;
  const s = STEPS[i];
  Object.keys(s.layers).forEach(function (k) { state.layers[k] = s.layers[k]; });
  state.focus = s.focus || null;
  if (s.view !== state.view) setView(s.view);
  refreshLayerList();
  applyVisibility();
  applyFocus();
  hideCard();
  updateCrossSun();

  document.getElementById("step-count").textContent = "단계 " + (i + 1) + " / " + STEPS.length;
  document.getElementById("step-title").textContent = s.title;
  document.getElementById("step-body").innerHTML = s.body;
  document.getElementById("step-q").hidden = !s.q;
  document.getElementById("step-q-text").textContent = s.q || "";
  document.getElementById("step-prev").disabled = i <= 0;
  document.getElementById("step-next").disabled = i >= STEPS.length - 1;

  document.querySelectorAll("#step-list li").forEach(function (li, k) {
    li.classList.toggle("on", k === i);
    if (k === i && li.scrollIntoView) li.scrollIntoView({ block: "nearest" });
  });
  document.getElementById("season-section").classList.toggle("spotlight", !!s.seasonSpot);
}
document.getElementById("step-prev").addEventListener("click", function () {
  if (state.stepIndex > 0) applyStep(state.stepIndex - 1);
});
document.getElementById("step-next").addEventListener("click", function () {
  if (state.stepIndex < STEPS.length - 1) applyStep(state.stepIndex + 1);
});

/* ============================================================
   13. 리사이즈 / 렌더 루프
   ============================================================ */
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.floor(w * renderer.getPixelRatio()) || canvas.height !== Math.floor(h * renderer.getPixelRatio())) {
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
    refitCamera(false);
  }
}
window.addEventListener("resize", resize);

let last = performance.now();
function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.05); last = now;
  const t = now / 1000;
  resize();

  globeGroup.rotation.x = rot.x;
  globeGroup.rotation.y = rot.y;

  if (state.view === "globe") {
    if (!userTouched && !REDUCED) rot.y += dt * 0.05;
    if (state.layers.winds && !REDUCED) {
      const dots = state.layers.coriolis ? globe.corDots : globe.strDots;
      for (let i = 0; i < dots.length; i++) {
        const d = dots[i];
        d.t = (d.t + dt * 0.16) % 1;
        d.sprite.position.copy(d.curve.getPointAt(d.t)).multiplyScalar(1.006);
      }
    }
  } else {
    if (state.layers.cells && !REDUCED) {
      for (let i = 0; i < cross.flowDots.length; i++) {
        const d = cross.flowDots[i];
        d.t = (d.t + dt * 0.055) % 1;
        const p = d.curve.getPointAt(d.t);
        d.sprite.position.set(p.x, p.y, 0.06);
      }
    }
  }

  pulseFocus(t);
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

/* ============================================================
   14. 시작
   ============================================================ */
function init() {
  buildLayerList();
  buildStepList();
  setView("globe");
  resize();
  refitCamera(true);
  applyVisibility();
  applyFocus();
  requestAnimationFrame(loop);
  setTimeout(function () { loadingEl.classList.add("hide"); }, 380);
}
try {
  init();
} catch (err) {
  fatal("프로그램을 시작하는 중 문제가 생겼습니다.<br>새로고침(F5)해 보시고, 계속되면 폴더 구조(index.html·style.css·script.js·libs/three.min.js)를 확인해 주세요.");
  if (window.console) console.error(err);
}

})();
