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

/* 순환(고리) — 상승 위도 / 하강 위도
   + 위도별 층후: 공기층(대류권)은 저위도에서 두껍고 고위도로 갈수록 얇음
     tubeG/tubeX = 지구본/단면 튜브 반지름, top = 순환 상층 높이 비율 */
const CELLS = [
  { id: "hadley", name: "해들리 순환", range: "0°~30°",  rise: 0,  sink: 30, color: COL.cellH, tubeG: 0.026, tubeX: 0.030, top: 1.00 },
  { id: "ferrel", name: "페렐 순환",   range: "30°~60°", rise: 60, sink: 30, color: COL.cellF, tubeG: 0.017, tubeX: 0.020, top: 0.80 },
  { id: "polar",  name: "극 순환",     range: "60°~90°", rise: 60, sink: 89, color: COL.cellP, tubeG: 0.011, tubeX: 0.013, top: 0.58 }
];

/* 지상 바람대 (dLon>0 = 서쪽으로 휨: 무역풍·극동풍은 편동풍, 편서풍은 편서풍) */
const WIND_BANDS = [
  { id: "trade",  name: "무역풍",  from: 27, to: 7,  dLon:  46, n: 9, lonOff: 0,  color: COL.windTrade },
  { id: "wester", name: "편서풍",  from: 33, to: 55, dLon: -48, n: 9, lonOff: 20, color: COL.windWest  },
  { id: "polar",  name: "극동풍",  from: 80, to: 64, dLon:  36, n: 6, lonOff: 10, color: COL.windPolar }
];

/* 이해 순서 — 7단계 (지구본 기준 수업 시나리오, 보기·레이어 자동 설정 + 강조 대상)
   pressure: true인 단계부터 지구본에 저기압 L / 고기압 H 라벨 표시 */
const STEPS = [
  { title: "대기대순환이란? — 위도별 일사량과 열적 불균형", view: "globe",
    layers: { insol:true, cells:false, belts:false, winds:false, coriolis:false, precip:false, grid:true },
    focus: null, pressure: false,
    body: "지구는 둥글기 때문에 위도에 따라 태양 에너지를 받아들이는 <b>면적이 다릅니다</b>. 적도 부근은 <b>좁은 면적에 태양 에너지가 집중</b>되어 기온이 높고, 극지방으로 갈수록 <b>넓은 면적으로 분산</b>되어 기온이 낮습니다. 이렇게 생긴 적도와 극지방의 <b>열적 불균형</b>을 해소하기 위한 지구의 대기 흐름이 바로 <b>대기대순환</b>입니다.",
    q: "같은 양의 햇빛인데, 왜 적도는 덥고 극지방은 추울까요?" },

  { title: "저위도 지역의 공기 흐름", view: "globe",
    layers: { insol:false, cells:true, belts:true, winds:false, coriolis:false, precip:false, grid:false },
    focus: ["cell-hadley", "rise0", "sink30", "belt0", "belt30"], pressure: false,
    body: "적도 지방은 태양 에너지가 좁은 면적에 집중되어 기온이 높고, 데워진 공기가 <b>위로 올라갑니다</b>. 상승한 공기는 우주 밖으로 나가지 않고 특정 고도에 이르면 <b>양옆으로 퍼지며</b>, <b>위도 30° 부근에서 다시 하강</b>합니다. 하강한 공기는 지표를 따라 다시 양옆 — 적도 쪽과 위도 60° 쪽 — 으로 흘러갑니다.",
    q: "상승한 공기는 왜 우주로 나가지 않고 위도 30° 부근에서 다시 내려올까요?" },

  { title: "고위도 지역의 공기 흐름", view: "globe",
    layers: { insol:false, cells:true, belts:true, winds:false, coriolis:false, precip:false, grid:false },
    focus: ["cell-polar", "cell-ferrel", "rise60", "sink90", "belt60", "belt90"], pressure: false,
    body: "극지방은 태양 에너지가 넓은 면적에 분산되어 기온이 낮고, 차가워진 공기가 <b>아래로 하강</b>합니다. 하강한 공기는 지표면을 따라 퍼져 <b>위도 60° 부근까지</b> 내려오고, 저위도에서 올라오는 공기와 맞닿아 <b>다시 상승</b>합니다. 상승한 공기는 또다시 양옆 — 극지방 쪽과 위도 30° 쪽 — 으로 퍼집니다.",
    q: "위도 60° 부근에서 공기가 다시 올라가는 까닭은 무엇일까요?" },

  { title: "대기대순환 시스템의 형성", view: "globe",
    layers: { insol:false, cells:true, belts:true, winds:false, coriolis:false, precip:false, grid:false },
    focus: null, pressure: true,
    body: "저위도와 고위도의 공기 흐름이 이어지면서 지구 대기에는 <b>3개의 순환 고리</b>(해들리·페렐·극 순환)가 만들어집니다. 공기가 <b>상승하는 적도와 위도 60° 부근</b>의 지표에서는 <b>저기압(L)</b>이, 공기가 <b>하강하는 위도 30°와 극지방 부근</b>의 지표에서는 <b>고기압(H)</b>이 나타납니다.",
    q: "공기가 올라가는 곳과 내려오는 곳의 지표 기압은 왜 달라질까요?" },

  { title: "강수 — 저기압은 비, 고기압은 맑음", view: "globe",
    layers: { insol:false, cells:false, belts:true, winds:false, coriolis:false, precip:true, grid:false },
    focus: null, pressure: true,
    body: "공기가 <b>상승하는 지점(저기압)</b>에서는 대기 중에 구름이 만들어져 <b>강수가 발생</b>합니다. 반대로 공기가 <b>하강하는 지점(고기압)</b>에서는 구름이 적어 <b>맑은 날씨</b>가 나타납니다. 그래서 적도·위도 60° 부근은 비가 많고, 위도 30°·극지방 부근은 건조합니다.",
    q: "적도 부근에는 열대 우림이, 위도 30° 부근에는 사막이 많은 이유는 무엇일까요?" },

  { title: "바람 — 무역풍·편서풍·극동풍", view: "globe",
    layers: { insol:false, cells:false, belts:true, winds:true, coriolis:true, precip:false, grid:false },
    focus: ["winds"], pressure: true,
    body: "대기대순환 속에서 지표면을 따라 움직이는 공기의 흐름이 <b>바람</b>입니다. 공기는 <b>고기압에서 저기압으로</b> 이동합니다. 여기에 지구 자전으로 바람의 방향이 <b>휘어지면서</b>, 30°→적도의 <b>무역풍</b>, 30°→60°의 <b>편서풍</b>, 극→60°의 <b>극동풍</b>이 나타납니다. <b>바람 휘어짐</b>을 껐다 켜며 비교해 보세요.",
    q: "바람 휘어짐(전향력)을 끄면 바람의 방향은 어떻게 달라질까요?" },

  { title: "결론 — 대기대순환과 위도별 기후", view: "globe",
    layers: { insol:false, cells:true, belts:true, winds:true, coriolis:true, precip:true, grid:false },
    focus: null, pressure: true,
    body: "위도에 따른 <b>일사량의 차이</b>가 적도와 극지방의 <b>열적 불균형</b>을 만들고, 이를 해소하는 과정에서 <b>대기대순환</b>이 나타납니다. 이 시스템 아래에서 위도대·지역별로 기압, 강수, 바람 같은 기후 요소에 차이가 생기고, 지구에는 <b>위도대별로 다양한 기후</b>가 나타납니다. 색깔 띠를 클릭해 위도대별 기후를 확인해 보세요.",
    q: "대기대순환을 알면 세계의 기후 분포를 어떻게 설명할 수 있을까요?" }
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
/* 반대편 은은한 푸른 역광 — 튜브·지구의 어두운 면이 죽지 않게 */
const rimLight = new THREE.DirectionalLight(0xbcd6ff, 0.55);
rimLight.position.set(-5, -2, -4);
scene.add(rimLight);

const ROOT = new THREE.Group();       scene.add(ROOT);
const globeGroup = new THREE.Group(); ROOT.add(globeGroup);
const crossGroup = new THREE.Group(); ROOT.add(crossGroup);

const R = 1.5;              // 지구 반지름
const SHIFT_MAX = 10;       // 계절 이동 최대(도)

/* 상태 */
const state = {
  view: "globe",
  season: 0,                // -1(1월) .. 0 .. +1(7월) — 계절 이동은 8단계에서 활용 예정(현재 UI 숨김)
  layers: { insol:false, cells:false, belts:true, winds:true, coriolis:true, precip:false, grid:false },
  stepIndex: -1,
  focus: null,
  showPressure: true        // 지구본 기압대의 저기압 L / 고기압 H 라벨 (4단계부터)
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
  const tube = new THREE.TubeGeometry(curve, Math.max(10, points.length * 3), tubeR, 8, false);
  const end = points[points.length - 1];
  const tan = curve.getTangent(1);
  return { geom: mergeGeoms([tube, coneAt(end, tan, headR, headL, false)]), curve: curve };
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
/* 재생성되는 라벨 재질의 포커스 등록 해제(중복 등록 방지) */
function unregFocusMats(mats) {
  for (let i = FOCUSABLES.length - 1; i >= 0; i--) {
    if (mats.indexOf(FOCUSABLES[i].mat) >= 0) FOCUSABLES.splice(i, 1);
  }
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
   3D 태양 — 발광 구(표면 무늬) + 프레넬 코로나 + 부드러운 글로우
   지구본 일사(1단계)와 단면 보기의 태양에 공용 사용
   ------------------------------------------------------------ */
function sunSurfaceTex() {
  const cv = document.createElement("canvas");
  cv.width = 256; cv.height = 128;
  const ctx = cv.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, "#ffdd66"); g.addColorStop(0.5, "#ffc837"); g.addColorStop(1, "#ffdd66");
  ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 128);
  /* 쌀알 무늬(입상반) 느낌 — 밝고 어두운 반점을 흩뿌려 회전할 때 구가 살아 보임 */
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * 256, y = Math.random() * 128, r = 4 + Math.random() * 14;
    const gg = ctx.createRadialGradient(x, y, 0, x, y, r);
    const warm = Math.random() < 0.5;
    gg.addColorStop(0, warm ? "rgba(255,166,38,0.5)" : "rgba(255,242,190,0.55)");
    gg.addColorStop(1, "rgba(255,200,80,0)");
    ctx.fillStyle = gg;
    [-256, 0, 256].forEach(off => { ctx.beginPath(); ctx.arc(x + off, y, r, 0, Math.PI * 2); ctx.fill(); });
  }
  return setSRGB(new THREE.CanvasTexture(cv));
}
function sunGlowTex() {
  const cv = document.createElement("canvas");
  cv.width = 128; cv.height = 128;
  const ctx = cv.getContext("2d");
  const g = ctx.createRadialGradient(64, 64, 6, 64, 64, 62);
  g.addColorStop(0, "rgba(255,238,170,0.95)");
  g.addColorStop(0.35, "rgba(255,210,110,0.55)");
  g.addColorStop(0.7, "rgba(255,190,90,0.18)");
  g.addColorStop(1, "rgba(255,190,90,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  return setSRGB(new THREE.CanvasTexture(cv));
}
function makeSun3D(radius) {
  const g = new THREE.Group();
  /* 스스로 빛나는 천체 — 음영 없이 표면 무늬만 (Basic) */
  const coreMat = new THREE.MeshBasicMaterial({ map: sunSurfaceTex() });
  coreMat.userData.own = true;
  const core = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 24), coreMat);
  g.add(core);
  /* 코로나 — 가장자리로 갈수록 진해지는 프레넬 발광 */
  const coronaMat = new THREE.ShaderMaterial({
    uniforms: { cTint: { value: new THREE.Color(0xffb52e) } },
    vertexShader:
      "varying float vF;" +
      "void main(){" +
      "  vec3 n = normalize(normalMatrix * normal);" +
      "  vec4 mv = modelViewMatrix * vec4(position, 1.0);" +
      "  vF = pow(1.0 - abs(dot(n, normalize(-mv.xyz))), 2.0);" +
      "  gl_Position = projectionMatrix * mv;" +
      "}",
    fragmentShader:
      "uniform vec3 cTint; varying float vF;" +
      "void main(){ gl_FragColor = vec4(cTint, vF * 0.9); }",
    transparent: true, depthWrite: false
  });
  coronaMat.userData.own = true;
  g.add(new THREE.Mesh(new THREE.SphereGeometry(radius * 1.22, 32, 24), coronaMat));
  /* 넓게 퍼지는 글로우(빌보드) */
  const glowMat = new THREE.SpriteMaterial({ map: sunGlowTex(), transparent: true, opacity: 0.9, depthWrite: false });
  glowMat.userData.own = true;
  const glow = new THREE.Sprite(glowMat);
  glow.scale.set(radius * 5.2, radius * 5.2, 1);
  g.add(glow);
  g.userData.core = core;
  g.userData.glow = glow;
  return g;
}

/* ------------------------------------------------------------
   화면 오른쪽에 고정되는 큰 태양
   - 지구본과 함께 회전하지 않도록 scene에 직접 붙임
   - 지구보다 뒤(-z)에 두어, 겹치는 부분은 지구에 자연스럽게 가려짐
   - 화면 비율·확대 정도가 바뀌어도 항상 오른쪽 가장자리에 절반쯤 걸치도록 매 프레임 재배치
   ------------------------------------------------------------ */
const SUN_BASE_R = 1;          // makeSun3D 기준 반지름(스케일로 조절)
const SUN_Z = -2.2;            // 지구 뒤쪽 깊이
const SUN_SIZE = 1.62;         // 지구 겉보기 크기의 배수 (1보다 크면 지구보다 크게 보임)
const SUN_EDGE_MIN = 0.04;     // 가장 많이 보일 때(약 절반 노출)
const SUN_EDGE_MAX = 0.72;     // 가장 적게 보일 때(세로 화면 — 가장자리에 걸침)
let sunFixed = null;
function ensureFixedSun() {
  if (sunFixed) return;
  sunFixed = makeSun3D(SUN_BASE_R);
  sunFixed.visible = false;
  scene.add(sunFixed);
  positionFixedSun();
}
function positionFixedSun() {
  if (!sunFixed) return;
  const asp = Math.max(0.35, camera.aspect || 1);
  const d = camZ - SUN_Z;
  const halfW  = TANF * d * asp;                // 태양 깊이에서의 화면 절반 폭
  const halfW0 = TANF * camZ * asp;             // 지구 깊이에서의 화면 절반 폭
  const rad = R * SUN_SIZE * (d / camZ);        // 원근 보정 — 화면상 지구보다 크게
  /* 노출량 자동 조절: 지구를 덮지 않는 선에서 최대한(최대 절반) 보이게.
     가로로 넓은 화면은 절반쯤, 세로로 좁은 화면은 가장자리에 걸치는 정도로 자동 축소 */
  const earthEdge = R / halfW0 + 0.05;
  let edge = 1 - (1 - earthEdge) * halfW / rad;
  edge = Math.max(SUN_EDGE_MIN, Math.min(SUN_EDGE_MAX, edge));
  sunFixed.scale.setScalar(rad / SUN_BASE_R);
  sunFixed.position.set(halfW + rad * edge, 0, SUN_Z);
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
    const m = volMat(c.color, 0.96);
    MAT["cell_" + c.id] = m;
    regFocus("cell-" + c.id, m);
  });

  WIND_BANDS.forEach(b => {
    const m = volMat(b.color, 0.98);
    MAT["wind_" + b.id] = m;
    regFocus("winds", m);
  });

  MAT.rise0  = volMat(COL.rise, 0.98);
  MAT.rise60 = volMat(COL.rise, 0.98);
  MAT.sink30 = volMat(COL.sink, 0.98);
  MAT.sink90 = volMat(COL.sink, 0.98);
  regFocus("rise0",  MAT.rise0);
  regFocus("rise60", MAT.rise60);
  regFocus("sink30", MAT.sink30);
  regFocus("sink90", MAT.sink90);

  MAT.wetIcon = new THREE.SpriteMaterial({ map: iconTex("rain"), transparent: true, depthWrite: false });
  MAT.dryIcon = new THREE.SpriteMaterial({ map: iconTex("dry"),  transparent: true, depthWrite: false });
  regFocus("wet", MAT.wetIcon);
  regFocus("dry", MAT.dryIcon);

  MAT.flowDot = new THREE.SpriteMaterial({ map: dotTex(), transparent: true, opacity: 0.9, depthTest: true, depthWrite: false });

  // 1단계 — 일사(햇빛과 기온) 시각화용
  MAT.sunRay    = volMat(0xf5a623, 0.95);
  MAT.patchHot  = new THREE.MeshBasicMaterial({ color: COL.heat, transparent: true, opacity: 0.42, depthWrite: false });
  MAT.patchCold = new THREE.MeshBasicMaterial({ color: COL.cold, transparent: true, opacity: 0.42, depthWrite: false });
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
  const W = 1024, H = 512;
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

  const og = ctx.createLinearGradient(0, 0, 0, H);
  [[90,"#c9dcec"],[80,"#7fa8cf"],[68,"#3d6fa9"],[40,"#3e78b4"],[0,"#4c8bc2"],
   [-40,"#3e78b4"],[-64,"#3d6fa9"],[-78,"#9fc0da"],[-90,"#d7e5ef"]]
    .forEach(s => og.addColorStop((90 - s[0]) / 180, s[1]));
  ctx.fillStyle = og; ctx.fillRect(0, 0, W, H);

  ctx.drawImage(paintLandCanvas([LAND_MAIN, LAND_ISLANDS]), 0, 0);
  ctx.fillStyle = "#4a83b9";
  SEAS.forEach(p => { drawPoly(ctx, p); ctx.fill(); });
  ctx.drawImage(paintLandCanvas([LAND_INNER]), 0, 0);

  const tex = setSRGB(new THREE.CanvasTexture(cv));
  tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 1);
  return tex;
}

/* 즉시 표시용 저해상도 지구 텍스처 — 상세 fallback은 유휴 시간에 교체 */
let quickEarthTex = null;
function getQuickEarthTexture() {
  if (quickEarthTex) return quickEarthTex;
  const cv = document.createElement("canvas");
  cv.width = 512; cv.height = 256;
  const ctx = cv.getContext("2d");
  const og = ctx.createLinearGradient(0, 0, 0, 256);
  [[90,"#c9dcec"],[68,"#3d6fa9"],[0,"#4c8bc2"],[-68,"#3d6fa9"],[-90,"#d7e5ef"]]
    .forEach(s => og.addColorStop((90 - s[0]) / 180, s[1]));
  ctx.fillStyle = og; ctx.fillRect(0, 0, 512, 256);
  const lg = ctx.createLinearGradient(0, 0, 0, 256);
  [[90,"#e8eef2"],[50,"#6a9e5a"],[30,"#c4a96a"],[0,"#3f8041"],[-50,"#6a9e5a"],[-90,"#e8eef2"]]
    .forEach(s => lg.addColorStop((90 - s[0]) / 180, s[1]));
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = lg; ctx.fillRect(0, 0, 512, 256);
  quickEarthTex = setSRGB(new THREE.CanvasTexture(cv));
  quickEarthTex.userData = { quick: true };
  return quickEarthTex;
}

function runWhenIdle(fn) {
  if (window.requestIdleCallback) window.requestIdleCallback(fn, { timeout: 1400 });
  else setTimeout(fn, 60);
}

/* ------------------------------------------------------------
   구름층 — 절차 생성 텍스처 2겹(구름 + 표면 그림자)으로 깊이감
   대기대순환의 실제 구름 분포를 반영: 적도·중위도·60°에 많고 30°는 적음
   ------------------------------------------------------------ */
function cloudTex() {
  const W = 1024, H = 512;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d");
  function puff(x, y, r, a) {
    const g = ctx.createRadialGradient(x, y, r * 0.12, x, y, r);
    g.addColorStop(0, "rgba(255,255,255," + a.toFixed(3) + ")");
    g.addColorStop(0.65, "rgba(255,255,255," + (a * 0.45).toFixed(3) + ")");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  function cluster(lat, spread, sx, aMax) {
    const cx = Math.random() * W;
    const cy = (90 - (lat + (Math.random() * 2 - 1) * spread)) / 180 * H;
    const n = 4 + Math.floor(Math.random() * 5);
    for (let i = 0; i < n; i++) {
      const dx = (Math.random() * 2 - 1) * 46 * sx;
      const dy = (Math.random() * 2 - 1) * 13;
      const r = 10 + Math.random() * 22;
      const a = aMax * (0.55 + Math.random() * 0.45);
      /* 좌우 경계에서 이어지도록(심리스) 세 번 그림 */
      [-W, 0, W].forEach(off => puff(cx + dx + off, cy + dy, r, a));
    }
  }
  for (let i = 0; i < 26; i++) cluster(0, 9, 1.6, 0.9);     // 적도 수렴대 — 구름 많음
  for (let i = 0; i < 15; i++) cluster(48, 12, 2.4, 0.85);  // 중위도 편서풍대 — 길게 흐르는 구름
  for (let i = 0; i < 15; i++) cluster(-48, 12, 2.4, 0.85);
  for (let i = 0; i < 7; i++)  cluster(66, 7, 1.8, 0.8);    // 한대 전선대
  for (let i = 0; i < 7; i++)  cluster(-66, 7, 1.8, 0.8);
  for (let i = 0; i < 3; i++)  cluster(30, 5, 1.1, 0.45);   // 아열대 고압대 — 구름 적음
  for (let i = 0; i < 3; i++)  cluster(-30, 5, 1.1, 0.45);
  return setSRGB(new THREE.CanvasTexture(cv));
}
function buildClouds() {
  if (globe.clouds || !globeShellReady) return;
  const tex = cloudTex();
  /* 표면 그림자층 — 구름보다 살짝 안쪽·비껴난 각도로 배치해 높이감(패럴랙스)을 냄 */
  const shadow = new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.004, 48, 32),
    new THREE.MeshBasicMaterial({ map: tex, color: 0x24354f, transparent: true, opacity: 0, depthWrite: false })
  );
  shadow.renderOrder = 1;
  const clouds = new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.022, 48, 32),
    new THREE.MeshLambertMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false })
  );
  clouds.renderOrder = 1.5;
  globeGroup.add(shadow); globeGroup.add(clouds);
  globe.clouds = clouds; globe.cloudsShadow = shadow;
  updateCloudTarget();
}
/* 학습 레이어가 켜져 있으면 구름을 옅게 — 내용 가독성 우선 */
function updateCloudTarget() {
  const L = state.layers;
  const busy = L.belts || L.cells || L.winds || L.precip || L.insol;
  globe.cloudTarget = busy ? 0.2 : 0.8;
}

let detailedEarthQueued = false;
function queueDetailedEarth() {
  if (detailedEarthQueued) return;
  detailedEarthQueued = true;
  const tex = buildFallbackEarthTexture();
  if (globe.mat && globe.mat.map && globe.mat.map.userData && globe.mat.map.userData.quick) {
    globe.mat.map.dispose();
    globe.mat.map = tex;
    globe.mat.needsUpdate = true;
  }
}

function startRemoteEarthLoad() {
  (function tryLoad(i) {
    if (i >= EARTH_URLS.length) return;
    try {
      const loader = new THREE.TextureLoader();
      loader.setCrossOrigin("anonymous");
      loader.load(EARTH_URLS[i], function (tex) {
        setSRGB(tex);
        tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 1);
        if (globe.mat) {
          if (globe.mat.map) globe.mat.map.dispose();
          globe.mat.map = tex;
          globe.mat.needsUpdate = true;
        }
      }, undefined, function () { tryLoad(i + 1); });
    } catch (e) { /* 오프라인 등 — fallback 유지 */ }
  })(0);
}

/* ============================================================
   7. 지구 전체 보기(지구본) 구성
   ============================================================ */
const globe = {};
let globeShellReady = false;
let globeLayersReady = false;
let insolReady = false;
let windsStrReady = false;

function needsGlobeLayers(L) {
  return L.belts || L.cells || L.winds || L.precip || L.grid;
}

function buildGlobeShell() {
  if (globeShellReady) return;
  /* 바다의 은은한 광택(스페큘러) — 빛 방향에 따라 표면이 살아 보임 */
  globe.mat = new THREE.MeshPhongMaterial({ map: getQuickEarthTexture(), specular: 0x2e3b4d, shininess: 13 });
  globeGroup.add(new THREE.Mesh(new THREE.SphereGeometry(R, 48, 32), globe.mat));
  startRemoteEarthLoad();

  /* 대기 산란 느낌 — 프레넬 림: 지구 가장자리가 하늘색으로 은은하게 빛남 */
  const atmo = new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.028, 48, 32),
    new THREE.ShaderMaterial({
      uniforms: { cTint: { value: new THREE.Color(0x86b8f4) } },
      vertexShader:
        "varying float vF;" +
        "void main(){" +
        "  vec3 n = normalize(normalMatrix * normal);" +
        "  vec4 mv = modelViewMatrix * vec4(position, 1.0);" +
        "  vF = pow(1.0 - abs(dot(n, normalize(-mv.xyz))), 2.4);" +
        "  gl_Position = projectionMatrix * mv;" +
        "}",
      fragmentShader:
        "uniform vec3 cTint; varying float vF;" +
        "void main(){ gl_FragColor = vec4(cTint, vF * 0.85); }",
      transparent: true, depthWrite: false
    })
  );
  atmo.renderOrder = 1;
  globeGroup.add(atmo);

  globe.clouds = null; globe.cloudsShadow = null; globe.cloudTarget = 0.8;

  const gcv = document.createElement("canvas");
  gcv.width = 256; gcv.height = 256;
  const gctx = gcv.getContext("2d");
  const gg = gctx.createRadialGradient(128, 128, 70, 128, 128, 128);
  gg.addColorStop(0, "rgba(120,170,235,0)");
  gg.addColorStop(0.62, "rgba(120,170,235,0.24)");
  gg.addColorStop(0.82, "rgba(140,185,240,0.10)");
  gg.addColorStop(1, "rgba(150,190,240,0)");
  gctx.fillStyle = gg; gctx.fillRect(0, 0, 256, 256);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: setSRGB(new THREE.CanvasTexture(gcv)), transparent: true, depthTest: false, depthWrite: false
  }));
  glow.scale.set(R * 3.05, R * 3.05, 1);
  glow.renderOrder = -1;
  globeGroup.add(glow);

  globe.grid = new THREE.Group(); globeGroup.add(globe.grid);
  globe.belts = new THREE.Group(); globeGroup.add(globe.belts);
  globe.beltLH = new THREE.Group(); globeGroup.add(globe.beltLH);
  globe.precip = new THREE.Group(); globeGroup.add(globe.precip);
  globe.cells = new THREE.Group(); globeGroup.add(globe.cells);
  globe.windsCor = new THREE.Group(); globeGroup.add(globe.windsCor);
  globe.windsStr = new THREE.Group(); globeGroup.add(globe.windsStr);
  globe.insol = new THREE.Group(); globeGroup.add(globe.insol);
  globe.pickers = new THREE.Group(); globeGroup.add(globe.pickers);
  globe.corDots = []; globe.strDots = []; globe.insolDots = []; globe.lhMats = [];
  globeShellReady = true;
}

function buildGlobeLayers() {
  if (globeLayersReady) return;
  buildGraticule();
  buildGlobeBelts();
  buildGlobePrecip();
  buildGlobeCells();
  buildGlobeWinds();
  buildGlobePickers();
  globeLayersReady = true;
}

function ensureGlobeLayers() {
  if (!globeShellReady) buildGlobeShell();
  if (!globeLayersReady) buildGlobeLayers();
}

function ensureGlobeInsol() {
  if (!globeShellReady) buildGlobeShell();
  if (insolReady) return;
  buildGlobeInsol();
  insolReady = true;
}

function ensureGlobeWindsStr() {
  if (!globeLayersReady) ensureGlobeLayers();
  if (windsStrReady) return;
  windArrowSet(globe.windsStr, globe.strDots, false);
  windsStrReady = true;
}

function buildGraticule() {
  const mat = new THREE.LineBasicMaterial({ color: 0x33507a, transparent: true, opacity: 0.22 });
  const matKey = new THREE.LineBasicMaterial({ color: 0x2b6fe3, transparent: true, opacity: 0.42 });
  function parallel(lat, m) {
    const pts = [];
    for (let i = 0; i <= 48; i++) pts.push(latLonToVec(lat, i / 48 * 360, R * 1.004));
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
  const geo = new THREE.SphereGeometry(R * 1.013, 48, 4, 0, Math.PI * 2, Math.min(phi0, phi1), Math.abs(phi1 - phi0));
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = 2;
  return m;
}
function buildGlobeBelts() {
  disposeGroup(globe.belts);
  disposeGroup(globe.beltLH);
  if (globe.lhMats && globe.lhMats.length) unregFocusMats(globe.lhMats);
  globe.lhMats = [];
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

  // 저기압 L / 고기압 H 라벨 (4단계부터 표시 — state.showPressure)
  const lhDefs = [
    { lat: 0,   txt: "저기압 L", color: COL.heat,  tag: "belt0"  },
    { lat: 30,  txt: "고기압 H", color: COL.arid,  tag: "belt30" },
    { lat: -30, txt: "고기압 H", color: COL.arid,  tag: "belt30" },
    { lat: 60,  txt: "저기압 L", color: COL.front, tag: "belt60" },
    { lat: -60, txt: "저기압 L", color: COL.front, tag: "belt60" },
    { lat: 76,  txt: "고기압 H", color: COL.cold,  tag: "belt90" },
    { lat: -76, txt: "고기압 H", color: COL.cold,  tag: "belt90" }
  ];
  lhDefs.forEach(d => {
    const lat = clampLat(d.lat + sh);
    [80, 260].forEach(lon => {
      const l = makeLabel(d.txt, {
        fontSize: 40, color: d.color, bg: "rgba(255,255,255,0.93)",
        border: d.color + "66", worldHeight: 0.115, pad: 14
      });
      l.position.copy(latLonToVec(lat, lon, R * 1.10));
      globe.beltLH.add(l);
      globe.lhMats.push(l.material);
      regFocus(d.tag, l.material);
    });
  });
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
  const rIn = R * 1.06;
  const uv = roundedLoopUV(0.2);
  [15, 135, 255].forEach(lonM => {
    CELLS.forEach(c => {
      /* 위도별 층후 — 저위도(해들리)는 두껍고 높게, 고위도(극)는 얇고 낮게 */
      const rOut = rIn + R * 0.245 * c.top;
      const headR = Math.max(c.tubeG * 2.4, 0.034);
      const headL = Math.max(c.tubeG * 5.2, 0.078);
      [1, -1].forEach(hemi => {
        const latRise = clampLat(c.rise * hemi + sh);
        const latSink = clampLat(c.sink * hemi + sh);
        if (Math.abs(latRise - latSink) < 8) return;
        const pts = uv.map(p => {
          const lat = latSink + (latRise - latSink) * p[0];
          const rad = rIn + (rOut - rIn) * p[1];
          return latLonToVec(lat, lonM, rad);
        });
        const lg = loopGeom(pts, c.tubeG, headR, headL, [0.14, 0.5, 0.86]);
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
  windArrowSet(globe.windsCor, globe.corDots, true);
  if (windsStrReady) {
    disposeGroup(globe.windsStr); globe.strDots = [];
    windArrowSet(globe.windsStr, globe.strDots, false);
  } else {
    disposeGroup(globe.windsStr); globe.strDots = [];
  }
}

/* 햇빛과 기온(일사) — 평행 광선·입사 면적으로 열적 불균형 표현 (1단계)
   태양은 화면 오른쪽에 고정되어 있으므로, 광선·입사면은 지구를 돌려도
   항상 태양 쪽을 향하도록 insolSpin 그룹의 회전을 매 프레임 보정한다. */
const INSOL_LON = 10;         // 광선이 붙는 기준 경도(그룹 회전으로 태양 쪽에 정렬됨)
const INSOL_FACE = -0.55;     // 태양을 향하도록 하는 기준 각(라디안)
function buildGlobeInsol() {
  disposeGroup(globe.insol);
  globe.insolDots = [];
  const n = latLonToVec(0, INSOL_LON, 1);   // 태양 방향 단위 벡터(그룹 기준)

  /* 지구 회전과 무관하게 태양 쪽을 향하는 하위 그룹 */
  const spin = new THREE.Group();
  globe.insol.add(spin);
  globe.insolSpin = spin;

  const sunLab = makeLabel("태양 빛", {
    sub: "지구에 거의 평행하게 도달", fontSize: 32, color: "#9a6b09",
    bg: "rgba(255,248,222,0.95)", border: "rgba(214,164,50,0.6)", worldHeight: 0.14, pad: 13
  });
  sunLab.position.copy(n).multiplyScalar(R * 2.22);
  sunLab.position.y -= 0.50;
  spin.add(sunLab);

  // 평행 광선 — 적도는 수직 입사, 고위도는 비스듬히 입사
  [0, 45, -45, 75, -75].forEach(lat => {
    const end = latLonToVec(lat, INSOL_LON, R * 1.02);
    const start = end.clone().addScaledVector(n, 1.45);
    const mid = end.clone().addScaledVector(n, 0.72);
    const ar = arrowGeom([start, mid, end], 0.018, 0.05, 0.12);
    spin.add(new THREE.Mesh(ar.geom, MAT.sunRay));
    for (let k = 0; k < 2; k++) {
      const sp = new THREE.Sprite(MAT.flowDot);
      sp.scale.set(0.06, 0.06, 1);
      spin.add(sp);
      globe.insolDots.push({ curve: ar.curve, t: k / 2, sprite: sp });
    }
  });

  // 입사 면적 — 적도(좁은 면적·고온) vs 극(넓은 면적·저온)
  function patch(latLo, latHi, lonLo, lonHi, mat) {
    const t0 = (90 - latHi) * DEG, t1 = (90 - latLo) * DEG;
    const geo = new THREE.SphereGeometry(R * 1.012, 24, 8,
      Math.PI - lonHi * DEG, (lonHi - lonLo) * DEG,
      Math.min(t0, t1), Math.abs(t1 - t0));
    const m = new THREE.Mesh(geo, mat);
    m.renderOrder = 2;
    spin.add(m);
  }
  patch(-8, 8, INSOL_LON - 9, INSOL_LON + 9, MAT.patchHot);
  patch(58, 84, INSOL_LON - 26, INSOL_LON + 26, MAT.patchCold);
  patch(-84, -58, INSOL_LON - 26, INSOL_LON + 26, MAT.patchCold);

  const eqLab = makeLabel("좁은 면적에 집중", {
    sub: "기온 높음", fontSize: 34, color: COL.heat,
    bg: "rgba(255,255,255,0.95)", border: COL.heat + "88", worldHeight: 0.155, pad: 14
  });
  eqLab.position.copy(latLonToVec(0, INSOL_LON, R * 1.20));
  spin.add(eqLab);

  [1, -1].forEach(hemi => {
    const l = makeLabel("넓은 면적으로 분산", {
      sub: "기온 낮음", fontSize: 34, color: COL.cold,
      bg: "rgba(255,255,255,0.95)", border: COL.cold + "88", worldHeight: 0.155, pad: 14
    });
    l.position.copy(latLonToVec(60 * hemi, INSOL_LON - 38, R * 1.30));
    spin.add(l);
  });
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
let crossReady = false;

function ensureCrossBuilt() {
  if (crossReady) return;
  buildCrossBase();
  crossReady = true;
  applyVisibility();
  applyFocus();
}

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
    /* 위도별 층후 — 순환 상층 높이와 튜브 굵기를 함께 차등 */
    const cT = vB + (vT - vB) * c.top;
    const headR = Math.max(c.tubeX * 2.6, 0.040);
    const headL = Math.max(c.tubeX * 5.4, 0.088);
    [1, -1].forEach(hemi => {
      const latRise = clampLat(c.rise * hemi + sh);
      const latSink = clampLat(c.sink * hemi + sh);
      if (Math.abs(latRise - latSink) < 8) return;
      const inset = 0.09;
      const xR = latToX(latRise) + (latToX(latSink) > latToX(latRise) ? inset : -inset);
      const xS = latToX(latSink) + (latToX(latSink) > latToX(latRise) ? -inset : inset);
      const pts = uv.map(p => new THREE.Vector3(
        xS + (xR - xS) * p[0],
        vB + (cT - vB) * p[1],
        0
      ));
      const lg = loopGeom(pts, c.tubeX, headR, headL, [0.13, 0.42, 0.63, 0.9]);
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
        lab.position.set((xR + xS) / 2, cT + 0.02, 0.12);
        cross.cells.add(lab);
      }
    });
  });

  /* 층후 안내선 — 공기층(대류권)의 높이: 적도에서 두껍고 극으로 갈수록 얇음 */
  const topH = CELLS[0].top, topP = CELLS[2].top;
  const tpPts = [];
  for (let lat = -90; lat <= 90; lat += 4) {
    const ratio = topP + (topH - topP) * Math.pow(Math.max(0, Math.cos(lat * DEG)), 0.9);
    tpPts.push(new THREE.Vector3(latToX(lat), vB + (vT - vB) * ratio + 0.06, -0.01));
  }
  const tpGeo = new THREE.BufferGeometry().setFromPoints(tpPts);
  const tpLine = new THREE.Line(tpGeo, new THREE.LineDashedMaterial({
    color: 0x6b7fa3, dashSize: 0.07, gapSize: 0.05, transparent: true, opacity: 0.55
  }));
  tpLine.computeLineDistances();
  cross.cells.add(tpLine);
  const tpLab = makeLabel("공기층의 높이 — 적도는 두껍고, 극으로 갈수록 얇아요", {
    fontSize: 26, color: "#5b6f92", halo: "rgba(255,255,255,0.92)", worldHeight: 0.078
  });
  tpLab.position.set(latToX(-42), vB + (vT - vB) * (topP + (topH - topP) * 0.62) + 0.20, 0.05);
  cross.cells.add(tpLab);
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

/* 단면: 태양 위치 표시(계절 슬라이더와 연동) — 3D 태양 */
function buildCrossSun() {
  disposeGroup(cross.sunG);
  cross.sun = makeSun3D(0.14);
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
  cross.sun.position.set(x, TOP_Y + 0.32, 0.1);
  cross.sunLabel.position.set(x, TOP_Y + 0.32 - 0.30, 0.12);
  cross.sunLabel.visible = Math.abs(state.season) > 0.02;
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
  if (!isGlobe) ensureCrossBuilt();
  if (L.insol) { ensureGlobeInsol(); ensureFixedSun(); }
  if (L.winds && !L.coriolis) ensureGlobeWindsStr();

  globeGroup.visible = isGlobe;
  crossGroup.visible = !isGlobe && crossReady;

  globe.belts.visible  = globeLayersReady && L.belts;
  globe.beltLH.visible = globeLayersReady && L.belts && state.showPressure;
  globe.precip.visible = globeLayersReady && L.precip;
  globe.cells.visible  = globeLayersReady && L.cells;
  globe.grid.visible   = globeLayersReady && L.grid;
  globe.insol.visible  = insolReady && L.insol;
  if (sunFixed) sunFixed.visible = isGlobe && insolReady && L.insol;
  globe.windsCor.visible = globeLayersReady && L.winds && L.coriolis;
  globe.windsStr.visible = windsStrReady && L.winds && !L.coriolis;

  if (crossReady) {
    cross.belts.visible  = L.belts;
    cross.precip.visible = L.precip;
    cross.cells.visible  = L.cells;
    cross.winds.visible  = L.winds;
    cross.grid.visible   = L.grid;
  }

  updateCloudTarget();

  document.getElementById("controls-hint").textContent = isGlobe
    ? "드래그: 돌리기 · 휠/두 손가락: 확대·축소 · 색깔 띠 클릭: 설명 카드"
    : "색깔 띠(기둥)를 클릭: 설명 카드 · 휠/두 손가락: 확대·축소";
}

/* 계절 변경 → 위치 의존 요소 재생성(프레임당 1회로 제한) */
function rebuildSeasonDependent() {
  if (globeLayersReady) {
    buildGlobeBelts(); buildGlobePrecip(); buildGlobeCells(); buildGlobeWinds(); buildGlobePickers();
  }
  if (crossReady) {
    buildCrossBelts(); buildCrossCells(); buildCrossWinds(); buildCrossPrecip(); buildCrossPickers();
    updateCrossSun();
  }
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

/* ------------------------------------------------------------
   카메라 연출(트윈) — 단계 전환 시 부드럽게 이동/줌
   사용자가 드래그·휠을 시작하면 즉시 취소되어 조작을 방해하지 않음
   ------------------------------------------------------------ */
const camAnim = { on: false, t0: 0, dur: 0, fx: 0, fy: 0, fz: 0, tx: 0, ty: 0, tz: 0 };
function easeInOutCubic(u) { return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; }
function flyTo(rx, ry, zMul, dur) {
  const tz = Math.max(fitZ * 0.45, Math.min(fitZ * 1.9, fitZ * (zMul || 1)));
  if (REDUCED) {
    if (rx != null) rot.x = rx;
    if (ry != null) rot.y = ry;
    camZ = tz; camera.position.z = camZ;
    return;
  }
  camAnim.on = true;
  camAnim.t0 = performance.now();
  camAnim.dur = dur || 900;
  camAnim.fx = rot.x; camAnim.fy = rot.y; camAnim.fz = camZ;
  camAnim.tx = rx != null ? rx : rot.x;
  camAnim.ty = ry != null ? ry : rot.y;
  camAnim.tz = tz;
}
function updateCamAnim(now) {
  if (!camAnim.on) return;
  let u = (now - camAnim.t0) / camAnim.dur;
  if (u >= 1) { u = 1; camAnim.on = false; }
  const k = easeInOutCubic(u);
  rot.x = camAnim.fx + (camAnim.tx - camAnim.fx) * k;
  rot.y = camAnim.fy + (camAnim.ty - camAnim.fy) * k;
  camZ = camAnim.fz + (camAnim.tz - camAnim.fz) * k;
  camera.position.z = camZ;
}

/* 단계별 카메라 프리셋 — 저위도 단계는 적도 정면, 고위도 단계는 극이 보이게 기울임 */
const STEP_CAM = [
  { rx: 0.30, ry: -0.55, z: 1.00 },  // 1 일사 — 태양·광선 정렬
  { rx: 0.10, z: 0.90 },             // 2 저위도 — 적도 정면 + 살짝 확대
  { rx: 0.80, z: 0.95 },             // 3 고위도 — 극이 보이게 기울임
  { rx: 0.38, z: 1.03 },             // 4 시스템 — 살짝 물러나 전체 조망
  { rx: 0.28, z: 0.97 },             // 5 강수
  { rx: 0.20, z: 0.93 },             // 6 바람
  { rx: 0.44, z: 1.06 }              // 7 결론 — 전체 조망
];

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
  camAnim.on = false;   // 사용자 조작 시 카메라 연출 즉시 중단
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
  camAnim.on = false;
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
  { id: "insol",    name: "햇빛과 기온",           sub: "위도별 일사 — 열적 불균형", color: "#f6a821" },
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
      if (needsGlobeLayers(state.layers)) ensureGlobeLayers();
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
  const changed = state.view !== v;
  state.view = v;
  if (v === "cross") ensureCrossBuilt();
  document.getElementById("view-globe").setAttribute("aria-pressed", String(v === "globe"));
  document.getElementById("view-cross").setAttribute("aria-pressed", String(v === "cross"));
  refitCamera(true);
  /* 보기 전환 시 살짝 물러났다 제자리로 다가오는 정착 연출 */
  if (changed && !REDUCED) {
    camZ = fitZ * 1.14;
    camera.position.z = camZ;
    flyTo(null, null, 1, 650);
  }
  applyVisibility();
}
document.getElementById("view-globe").addEventListener("click", function () { setView("globe"); });
document.getElementById("view-cross").addEventListener("click", function () { setView("cross"); });

/* --- 사이드바 —
   데스크톱: 좌측 패널(접기/펴기)
   모바일: 하단 시트 — 평소엔 축소 바(현재 단계 + ←→)만 보여 지구를 가리지 않고,
           위로 스와이프하면 패널 확장, 확장 상태에서 좌우 스와이프로 단계 이동 --- */
const sidebar = document.getElementById("sidebar");
const mqMobile = window.matchMedia("(max-width: 700px)");
function isMobile() { return mqMobile.matches; }

function sheetExpand(open) {
  if (open) { sidebar.classList.add("expanded"); sidebar.classList.remove("collapsed"); }
  else { sidebar.classList.remove("expanded"); sidebar.classList.add("collapsed"); }
}
document.getElementById("sidebar-close").addEventListener("click", function () { sheetExpand(false); });
document.getElementById("sidebar-handle").addEventListener("click", function () { sidebar.classList.remove("collapsed"); });
if (isMobile()) sidebar.classList.add("collapsed");   // 모바일: 축소 바 상태로 시작

if (mqMobile.addEventListener) {
  mqMobile.addEventListener("change", function (e) {
    if (e.matches) sheetExpand(false);
    else sidebar.classList.remove("collapsed", "expanded");
  });
}

/* 단계 이동(스와이프·화살표 공용) — 아직 시작 전이면 1단계부터 */
function stepDelta(d) {
  const n = state.stepIndex < 0 ? (d > 0 ? 0 : -1) : state.stepIndex + d;
  if (n >= 0 && n < STEPS.length) applyStep(n);
}

/* 축소 바: 위/아래 스와이프 = 열고 닫기 · 좌/우 스와이프 = 단계 이동 · 탭 = 토글 */
const sheetBar = document.getElementById("sheet-bar");
document.getElementById("sheet-prev").addEventListener("click", function (e) { e.stopPropagation(); stepDelta(-1); });
document.getElementById("sheet-next").addEventListener("click", function (e) { e.stopPropagation(); stepDelta(1); });

let shX = 0, shY = 0, shT = 0;
sheetBar.addEventListener("touchstart", function (e) {
  if (e.target.closest(".sb-arrow")) return;
  shX = e.touches[0].clientX; shY = e.touches[0].clientY; shT = Date.now();
}, { passive: true });
sheetBar.addEventListener("touchend", function (e) {
  if (e.target.closest(".sb-arrow")) return;
  const dx = e.changedTouches[0].clientX - shX;
  const dy = e.changedTouches[0].clientY - shY;
  if (Math.abs(dy) > 26 && Math.abs(dy) > Math.abs(dx)) { sheetExpand(dy < 0); return; }
  if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy) * 1.6) { stepDelta(dx < 0 ? 1 : -1); return; }
  if (Date.now() - shT < 350 && Math.abs(dx) < 10 && Math.abs(dy) < 10)
    sheetExpand(!sidebar.classList.contains("expanded"));
});
sheetBar.addEventListener("click", function (e) {
  if (e.target.closest(".sb-arrow")) return;
  if (!("ontouchstart" in window)) sheetExpand(!sidebar.classList.contains("expanded"));  // 마우스 환경 대비
});

/* 확장된 시트 본문: 좌/우로 크게 쓸면 단계 이동(세로 스크롤은 그대로 동작) */
const sheetBody = document.querySelector(".sidebar-body");
let sbX = 0, sbY = 0, sbOK = false;
sheetBody.addEventListener("touchstart", function (e) {
  sbOK = isMobile() && sidebar.classList.contains("expanded") && !e.target.closest("input, button");
  sbX = e.touches[0].clientX; sbY = e.touches[0].clientY;
}, { passive: true });
sheetBody.addEventListener("touchend", function (e) {
  if (!sbOK) return;
  const dx = e.changedTouches[0].clientX - sbX;
  const dy = e.changedTouches[0].clientY - sbY;
  if (Math.abs(dx) > 64 && Math.abs(dx) > Math.abs(dy) * 2.2) stepDelta(dx < 0 ? 1 : -1);
});

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
  state.showPressure = !!s.pressure;
  if (needsGlobeLayers(s.layers)) ensureGlobeLayers();
  /* 보기 유지 — 단면을 보고 있으면 단면인 채로 다음 단계가 이어짐.
     단, 1단계(일사 애니메이션)는 지구본 전용이라 지구본으로 전환 */
  if (s.layers.insol && state.view !== "globe") setView("globe");
  // 단계별 카메라 연출 — 그 단계 내용이 잘 보이는 각도·거리로 부드럽게 이동
  const cp = STEP_CAM[i];
  if (state.view === "globe" && cp) {
    flyTo(cp.rx, cp.ry != null ? cp.ry : null, cp.z, 950);
  } else if (state.view === "cross" && !REDUCED && Math.abs(camZ - fitZ) < fitZ * 0.05) {
    /* 단면 보기: 사용자가 줌을 바꾸지 않았을 때만 살짝 물러났다 제자리로 (전환 피드백) */
    camZ = fitZ * 1.07;
    camera.position.z = camZ;
    flyTo(null, null, 1, 550);
  }
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

  /* 모바일 하단 시트 바 동기화 + 지구가 보이도록 시트는 축소 상태로 */
  const sbStep = document.getElementById("sheet-step");
  if (sbStep) {
    sbStep.textContent = (i + 1) + " / " + STEPS.length;
    document.getElementById("sheet-title").textContent = s.title;
  }
  if (isMobile()) sheetExpand(false);
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
  updateCamAnim(now);

  globeGroup.rotation.x = rot.x;
  globeGroup.rotation.y = rot.y;

  if (state.view === "globe") {
    if (!userTouched && !REDUCED && !camAnim.on && !state.layers.insol) rot.y += dt * 0.05;
    /* 구름층 — 지구와 별개로 아주 느리게 흐르고, 그림자는 살짝 비껴 따라감(높이감) */
    if (globe.clouds) {
      if (!REDUCED) globe.clouds.rotation.y += dt * 0.007;
      globe.cloudsShadow.rotation.y = globe.clouds.rotation.y - 0.035;
      const cm = globe.clouds.material;
      if (Math.abs(cm.opacity - globe.cloudTarget) > 0.004) {
        cm.opacity += (globe.cloudTarget - cm.opacity) * Math.min(1, dt * 2.5);
        globe.cloudsShadow.material.opacity = cm.opacity * 0.38;
      }
    }
    if (state.layers.insol && insolReady) {
      /* 광선·입사면이 항상 태양(화면 오른쪽) 쪽을 향하도록 보정 */
      if (globe.insolSpin) globe.insolSpin.rotation.y = INSOL_FACE - rot.y;
      if (!REDUCED) for (let i = 0; i < globe.insolDots.length; i++) {
        const d = globe.insolDots[i];
        d.t = (d.t + dt * 0.3) % 1;
        d.sprite.position.copy(d.curve.getPointAt(d.t));
      }
    }
    if (state.layers.winds && globeLayersReady && !REDUCED) {
      const dots = state.layers.coriolis ? globe.corDots : globe.strDots;
      for (let i = 0; i < dots.length; i++) {
        const d = dots[i];
        d.t = (d.t + dt * 0.16) % 1;
        d.sprite.position.copy(d.curve.getPointAt(d.t)).multiplyScalar(1.006);
      }
    }
  } else {
    if (cross.sun && cross.sun.userData.core && !REDUCED)
      cross.sun.userData.core.rotation.y += dt * 0.18;   // 태양 자전
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
  /* 화면 오른쪽 고정 태양 — 확대·화면비가 바뀌어도 항상 같은 자리에 */
  if (sunFixed && sunFixed.visible) {
    positionFixedSun();
    if (!REDUCED) sunFixed.userData.core.rotation.y += dt * 0.09;   // 태양 자전
  }
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

/* ============================================================
   14. 시작
   ============================================================ */
function init() {
  buildGlobeShell();
  buildLayerList();
  buildStepList();
  setView("globe");
  resize();
  refitCamera(true);
  applyVisibility();
  applyFocus();
  requestAnimationFrame(loop);
  requestAnimationFrame(function () {
    renderer.render(scene, camera);
    loadingEl.classList.add("hide");
    requestAnimationFrame(function () {
      buildGlobeLayers();
      applyVisibility();
      applyFocus();
    });
    runWhenIdle(queueDetailedEarth);
    runWhenIdle(buildClouds);
    runWhenIdle(function () { if (!crossReady) ensureCrossBuilt(); });
  });
}
try {
  init();
} catch (err) {
  fatal("프로그램을 시작하는 중 문제가 생겼습니다.<br>새로고침(F5)해 보시고, 계속되면 폴더 구조(index.html·style.css·script.js·libs/three.min.js)를 확인해 주세요.");
  if (window.console) console.error(err);
}

})();
