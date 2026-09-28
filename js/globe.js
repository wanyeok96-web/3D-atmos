/* ============================================================
   대기대순환 3D — globe.js
   지구 전체 보기(지구본) — 지구 텍스처 · 구름 · 기압대 · 순환 · 바람 · 일사
   ============================================================ */
"use strict";

/* ============================================================
   6. 지구 표면 텍스처 — 저해상도 임시 지구를 즉시 그리고,
      내장 위성사진(assets/earth-texture.js)으로 교체.
      내장 파일이 없거나 읽지 못하면 교육용 지구본(대륙 윤곽)으로 대체.
      ※ 외부 통신 없음 — 인터넷·학교망 차단과 무관하게 항상 같은 지구가 보입니다.
   ============================================================ */

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
  /* 강수를 설명할 때는 구름층을 조금 진하게(비 많은 적도·60°에 구름이 모여 있음), 그 밖의 설명 중에는 옅게 */
  globe.cloudTarget = L.precip ? 0.55 : (busy ? 0.2 : 0.8);
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

function startEarthLoad() {
  const data = window.EARTH_TEXTURE_DATA;
  if (!data) { runWhenIdle(queueDetailedEarth); return; }
  new THREE.TextureLoader().load(data, function (tex) {
    setSRGB(tex);
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 1);
    if (globe.mat) {
      if (globe.mat.map) globe.mat.map.dispose();
      globe.mat.map = tex;
      globe.mat.needsUpdate = true;
    }
  }, undefined, function () { runWhenIdle(queueDetailedEarth); });
}

/* ============================================================
   7. 지구 전체 보기(지구본) 구성
   ============================================================ */
const globe = {};
let globeShellReady = false;
let globeLayersReady = false;
let insolReady = false;

function needsGlobeLayers(L) {
  return L.belts || L.cells || L.winds || L.precip || L.grid;
}

function buildGlobeShell() {
  if (globeShellReady) return;
  /* 바다의 은은한 광택(스페큘러) — 빛 방향에 따라 표면이 살아 보임 */
  globe.mat = new THREE.MeshPhongMaterial({ map: getQuickEarthTexture(), specular: 0x2e3b4d, shininess: 13 });
  globeGroup.add(new THREE.Mesh(new THREE.SphereGeometry(R, 48, 32), globe.mat));
  startEarthLoad();

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
  globe.winds = new THREE.Group(); globeGroup.add(globe.winds);
  globe.insol = new THREE.Group(); globeGroup.add(globe.insol);
  globe.spinInd = new THREE.Group(); globeGroup.add(globe.spinInd);   // 자전 표시(6단계)
  globe.regions = new THREE.Group(); globeGroup.add(globe.regions);   // 지역 마커(5·7·8단계)
  globe.seasonFx = new THREE.Group(); globeGroup.add(globe.seasonFx); // 태양 직하 위도·회귀선(8단계)
  globe.pickers = new THREE.Group(); globeGroup.add(globe.pickers);
  globe.windMeshes = []; globe.insolDots = [];
  globe.windMorph = state.layers.coriolis ? 1 : 0;                    // 0 = 곧은 바람, 1 = 휜 바람

  /* 레이어별 페이드 등록 — 켜고 끌 때 서서히 나타나고 사라짐 (core.js 4절) */
  const L = state.layers;
  defFade("insol",    () => L.insol);
  defFade("cells",    () => L.cells);
  defFade("belts",    () => L.belts);
  defFade("pressure", () => L.belts && state.showPressure);
  defFade("winds",    () => L.winds);
  defFade("spinInd",  () => true);            // 보이기·숨기기는 장면의 show 목록(태그)으로
  defFade("regions",  () => true);
  defFade("seasonFx", () => true);
  defFade("windsX",   () => L.winds);
  defFade("precip",   () => L.precip);
  defFade("grid",     () => L.grid);
  regFadeGroup(globe.insol, "insol");
  regFadeGroup(globe.cells, "cells");
  regFadeGroup(globe.belts, "belts");
  regFadeGroup(globe.beltLH, "pressure");
  regFadeGroup(globe.winds, "winds");
  regFadeGroup(globe.spinInd, "spinInd");
  regFadeGroup(globe.regions, "regions");
  regFadeGroup(globe.seasonFx, "seasonFx");
  regFadeGroup(globe.precip, "precip");
  regFadeGroup(globe.grid, "grid");
  /* 그리기 순서 — 투명한 대기·구름 껍질 뒤에 그려져 라벨·화살표가 흐려지지 않게 */
  globe.belts.renderOrder = 2;
  globe.insol.renderOrder = 3;
  globe.cells.renderOrder = 3;
  globe.winds.renderOrder = 3;
  globe.spinInd.renderOrder = 4;
  globe.regions.renderOrder = 6;
  globe.seasonFx.renderOrder = 3;
  globe.grid.renderOrder = 4;
  globe.precip.renderOrder = 4;
  globe.beltLH.renderOrder = 5;
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
  buildSpinIndicator();
  buildRegions();
  buildSeasonFx();
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
/* 기압대 띠만 다시 만들기 — 계절 이동 애니메이션 중 매 프레임 호출(가벼움) */
function buildGlobeBands(sh) {
  disposeGroup(globe.belts);
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
function buildGlobeBelts() {
  disposeGroup(globe.beltLH);
  const sh = seasonShift();
  buildGlobeBands(sh);

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
      l.userData.geo = { lat: d.lat, lon: lon, r: R * 1.10 };   // 계절 이동 중 위치만 옮기기 위한 기준
      globe.beltLH.add(l);
      regFocus(d.tag, l.material);
    });
  });
}

/* 계절 이동 애니메이션 중: 띠는 다시 만들고, 라벨·아이콘은 위치만 옮김
   (순환 고리·바람 등 무거운 요소는 이동이 끝난 뒤 한 번에 다시 만듦) */
function applyGlobeSeasonLive(sh) {
  buildGlobeBands(sh);
  [globe.beltLH, globe.precip].forEach(g => g.children.forEach(o => {
    const q = o.userData.geo;
    if (q) o.position.copy(latLonToVec(clampLat(q.lat + sh), q.lon, q.r));
  }));
  updateSeasonFx();
}

/* 태양이 가장 높이 뜨는 위도(태양 직하점) 고리 + 북회귀선·남회귀선 (8단계) */
function buildSeasonFx() {
  const g = globe.seasonFx;
  const Rr = R * 1.016;
  function ringAt(lat, tube, mat) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(1, tube, 6, 120), mat);
    m.rotation.x = Math.PI / 2;
    const c = Math.cos(lat * DEG);
    m.scale.set(Rr * c, Rr * c, 1);
    m.position.y = Rr * Math.sin(lat * DEG);
    g.add(m);
    return m;
  }
  const tMat = tagMat(new THREE.MeshBasicMaterial({ color: 0xe08a1e, transparent: true, opacity: 0.75, depthWrite: false }), "sunlat");
  ringAt(23.5, 0.006, tMat); ringAt(-23.5, 0.006, tMat);
  globe.tropicLabs = [];
  [[23.5, "북회귀선 23.5°N"], [-23.5, "남회귀선 23.5°S"]].forEach(d => {
    /* 늘 화면 정면 쪽에 놓이므로 지구 표면에 반쯤 묻히지 않게 깊이 가림을 끔 */
    const l = makeLabel(d[1], { fontSize: 30, color: "#b56a0c", halo: "rgba(255,255,255,0.95)", worldHeight: 0.085, depthTest: false });
    tagMat(l.material, "sunlat");
    l.userData.lat = d[0];
    g.add(l);
    globe.tropicLabs.push(l);
  });
  const sMat = tagMat(new THREE.MeshBasicMaterial({ color: 0xffc21a, transparent: true, opacity: 0.95, depthWrite: false }), "sunlat");
  globe.sunRing = ringAt(0, 0.017, sMat);
  globe.sunRingLab = makeLabel("태양이 가장 높이 뜨는 위도", { fontSize: 32, color: "#9a6b09", bg: "rgba(255,248,222,0.96)", border: "rgba(214,164,50,0.7)", worldHeight: 0.12, pad: 11, depthTest: false });
  tagMat(globe.sunRingLab.material, "sunlat");
  g.add(globe.sunRingLab);
  updateSeasonFx();
}
/* 화면 정면에 오는 경도 — 지구본 좌우 회전(rot.y)에서 계산 (CAM_* 상수와 같은 관계) */
function frontLon() { return -rot.y / DEG - 90; }
function updateSeasonFx() {
  if (!globe.sunRing) return;
  const lat = state.seasonCur * 23.5, Rr = R * 1.016, c = Math.cos(lat * DEG);
  globe.sunRing.scale.set(Rr * c, Rr * c, 1);
  globe.sunRing.position.y = Rr * Math.sin(lat * DEG);
  updateSeasonLabels();
}
/* 회귀선·태양 고리 라벨은 지구를 돌려도 늘 화면 정면 가까이에(태양 고리는 왼쪽, 회귀선은 오른쪽) — 잘리거나 서로 겹치지 않게 */
function updateSeasonLabels() {
  if (!globe.sunRingLab || !globe.seasonFx.visible) return;
  const f = frontLon(), lat = state.seasonCur * 23.5;
  globe.sunRingLab.position.copy(latLonToVec(lat + 5, f - 16, R * 1.1));
  globe.tropicLabs.forEach(l => l.position.copy(latLonToVec(l.userData.lat + 3, f + 38, R * 1.04)));   // 태양 고리 라벨(왼쪽)과 반대편
}

/* 비 많은 곳 / 건조한 곳 — 아이콘 스프라이트
   위도대마다 2개만, 지구를 돌려도 늘 화면 정면 양옆(정면 경도 ±32°)에 오도록 매 프레임 위치를 옮김 */
function buildGlobePrecip() {
  disposeGroup(globe.precip);
  const sh = seasonShift();
  function band(lat, mat, sc, offs) {
    const l = clampLat(lat + sh);
    offs.forEach(off => {
      const sp = new THREE.Sprite(mat);
      sp.scale.set(sc * 0.84, sc, 1);
      sp.userData.geo = { lat: lat, lon: off, r: R * 1.115, frontOff: off };
      sp.position.copy(latLonToVec(l, off, R * 1.115));
      globe.precip.add(sp);
    });
  }
  band(0,   MAT.wetIcon, 0.30, [-32, 32]);
  band(60,  MAT.wetIcon, 0.27, [-30, 30]);
  band(-60, MAT.wetIcon, 0.27, [-30, 30]);
  band(30,  MAT.dryIcon, 0.27, [-34, 34]);
  band(-30, MAT.dryIcon, 0.27, [-34, 34]);
  band(80,  MAT.dryIcon, 0.22, [-40, 40]);
  band(-80, MAT.dryIcon, 0.22, [-40, 40]);
  updatePrecipFront();
}
/* 강수 아이콘을 화면 정면 경도 기준으로 다시 배치 */
function updatePrecipFront() {
  if (!globe.precip || !globe.precip.visible) return;
  const f = frontLon(), sh = seasonShift();
  globe.precip.children.forEach(o => {
    const q = o.userData.geo;
    if (!q || q.frontOff == null) return;
    q.lon = f + q.frontOff;
    o.position.copy(latLonToVec(clampLat(q.lat + sh), q.lon, q.r));
  });
}

/* 공기의 큰 순환 — 자오면 고리 화살표(세 경도에 배치) */
function buildGlobeCells() {
  disposeGroup(globe.cells);
  const sh = seasonShift();
  const rIn = R * 1.06;
  const uv = roundedLoopUV(0.2);
  /* 순환 고리를 세울 경도 — 대서양·인도양·태평양 위 (지역 마커가 있는 대륙을 가리지 않게) */
  [-30, 90, 210].forEach(lonM => {
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
        /* 기온 색: 위도는 꼭짓점 높이(y)에서, 높이는 지구 중심 거리에서 */
        colorizeByTemp(lg.geom, (x, y, z) => {
          const r = Math.sqrt(x * x + y * y + z * z);
          return [Math.asin(Math.max(-1, Math.min(1, y / r))) / DEG - sh, (r - rIn) / (R * 0.245)];
        });
        globe.cells.add(new THREE.Mesh(lg.geom, MAT["cell_" + c.id]));
      });
    });
  });
}

/* 땅 가까이 부는 바람 — 곡선 화살표 띠
   화살표마다 "곧은 모양(휘어짐 없음)"과 "휜 모양(전향력)" 두 형태를 만들어 두고
   모핑(morph)으로 그 사이를 부드럽게 변형 → 바람 휘어짐을 켜고 끄면 화살표가 실제로 휘어짐 */
function buildGlobeWinds() {
  disposeGroup(globe.winds);
  globe.windMeshes = [];
  const sh = seasonShift();
  const rW = R * 1.04;
  WIND_BANDS.forEach(b => {
    const tags = ["winds", "wind-" + b.id];
    const mat = MAT["wind_" + b.id], omat = MAT["windO_" + b.id];
    [1, -1].forEach(hemi => {
      const latA = clampLat(b.from * hemi + sh);
      const latB = clampLat(b.to * hemi + sh);
      const step = 360 / b.n;
      for (let k = 0; k < b.n; k++) {
        const lon0 = b.lonOff + hemi * 11 + k * step;
        const ptsS = [], ptsC = [];
        for (let i = 0; i <= 12; i++) {
          const t = i / 12, lat = latA + (latB - latA) * t;
          ptsS.push(latLonToVec(lat, lon0, rW));
          ptsC.push(latLonToVec(lat, lon0 + b.dLon * t, rW));
        }
        /* 굵고 꼬리가 가는 화살표 + 넓은 화살촉 — 개수는 줄이고 하나하나를 또렷하게 */
        const aS = taperedArrowGeom(ptsS, 0.03, 0.078, 0.17, 0.3);
        const aC = taperedArrowGeom(ptsC, 0.03, 0.078, 0.17, 0.3);
        /* 두 형태는 꼭짓점 수·순서가 같음 → 휜 모양을 모핑 대상으로 */
        aS.geom.morphAttributes.position = [aC.geom.attributes.position];
        aS.geom.morphAttributes.normal = [aC.geom.attributes.normal];
        /* 흰 테두리(뒷면을 법선 방향으로 조금 부풀림) → 색 띠 위에서도 바람이 도드라짐 */
        const outline = new THREE.Mesh(aS.geom, omat);
        const mesh = new THREE.Mesh(aS.geom, mat);
        [outline, mesh].forEach(m => {
          m.updateMorphTargets();
          m.morphTargetInfluences[0] = globe.windMorph;
          globe.winds.add(m);
          globe.windMeshes.push(m);
        });
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
        tagMat(l.material, tags);
        l.position.copy(latLonToVec(latM, lon + (hemi > 0 ? 0 : 24), R * 1.17));
        globe.winds.add(l);
      });
    });
  });
  /* 방향은 화살표 표면의 흐르는 줄무늬(core.js addFlow)로 표시 — 흐름 점은 쓰지 않음 */
}
/* 뒤로 가기·건너뛰기: 휘어짐을 목표 상태로 즉시 */
function snapWinds() {
  if (!globeLayersReady) return;
  globe.windMorph = state.layers.coriolis ? 1 : 0;
  for (let i = 0; i < globe.windMeshes.length; i++) globe.windMeshes[i].morphTargetInfluences[0] = globe.windMorph;
}
/* 매 프레임: 휘어짐 정도를 목표(바람 휘어짐 켬 = 1)로 천천히 변형 */
function updateWinds(dt) {
  if (!globeLayersReady) return;
  const target = state.layers.coriolis ? 1 : 0;
  if (globe.windMorph === target) return;
  const step = REDUCED ? 1 : dt / 1.8;                         // 약 1.8초(긴 동작)에 걸쳐 휘어짐
  globe.windMorph = target > globe.windMorph ? Math.min(target, globe.windMorph + step) : Math.max(target, globe.windMorph - step);
  const e = smooth01(globe.windMorph);
  for (let i = 0; i < globe.windMeshes.length; i++) globe.windMeshes[i].morphTargetInfluences[0] = e;
}

/* 지구 자전 표시 — 자전축 + 북극 위의 회전 화살표(서 → 동, 북쪽에서 보면 시계 반대 방향) */
function buildSpinIndicator() {
  const bucket = growBucket("spin");
  const mat = tagMat(volMat(0x2b6fe3, 0.95), "spin");
  const axMat = tagMat(new THREE.MeshBasicMaterial({ color: 0x5c7397, transparent: true, opacity: 0.7, depthWrite: false }), "spin");
  const axis = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, R * 2.9, 8), axMat);
  globe.spinInd.add(axis);
  const y = R * 1.2, r = 0.42, pts = [];
  for (let i = 0; i < 40; i++) {
    const a = i / 40 * Math.PI * 2;
    pts.push(new THREE.Vector3(r * Math.cos(a), y, -r * Math.sin(a)));   // 경도가 커지는 쪽(동쪽)으로 진행
  }
  makeGrowPath(globe.spinInd, bucket, {
    points: pts, closed: true, phases: [0, 1 / 3, 2 / 3, 1], tubeR: 0.022, headR: 0.06, headL: 0.13,
    mat: mat, tags: ["spin"], key: "spinInd", view: "globe", speed: 1 / DUR.base
  });
  const lab = makeLabel("지구 자전 (서 → 동)", { fontSize: 34, color: "#2b6fe3", bg: "rgba(255,255,255,0.95)", border: "rgba(43,111,227,0.5)", worldHeight: 0.13, pad: 12 });
  tagMat(lab.material, "spin");
  lab.position.set(0.95, y - 0.05, 0);   // 고리 옆(화면 밖으로 잘리지 않게)
  globe.spinInd.add(lab);
}

/* 대표 지역 마커 — 핀 + 이름(기후) + 퍼지는 고리. 누르면 그 위도대 설명 카드 */
function pinTex(color) {
  const cv = document.createElement("canvas");
  cv.width = 96; cv.height = 128;
  const ctx = cv.getContext("2d");
  ctx.fillStyle = color; ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(48, 44, 36, Math.PI * 0.82, Math.PI * 2.18);
  ctx.lineTo(48, 122);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath(); ctx.arc(48, 44, 14, 0, Math.PI * 2); ctx.fill();
  const t = setSRGB(new THREE.CanvasTexture(cv));
  t.minFilter = THREE.LinearFilter;
  return t;
}
function buildRegions() {
  const bucket = growBucket("regions");
  globe.regionPicks = []; globe.regionRings = [];
  const texCache = {};
  REGIONS.forEach(r => {
    const ty = REGION_TYPES[r.type];
    const pos = latLonToVec(r.lat, r.lon, R * 1.012);
    const nrm = pos.clone().normalize();
    if (!texCache[r.type]) texCache[r.type] = pinTex(ty.color);
    const pm = tagMat(new THREE.SpriteMaterial({ map: texCache[r.type], transparent: true, depthWrite: false }), ty.tag);
    const pin = new THREE.Sprite(pm);
    pin.center.set(0.5, 0);
    pin.position.copy(pos);
    pin.userData.region = r;
    globe.regions.add(pin);
    globe.regionPicks.push(pin);

    const lab = makeLabel(r.name, { sub: ty.climate, fontSize: 34, color: ty.color, bg: "rgba(255,255,255,0.96)", border: ty.color + "99", worldHeight: 0.19, pad: 12 });
    tagMat(lab.material, ty.tag);
    lab.position.copy(nrm).multiplyScalar(R * 1.26);
    globe.regions.add(lab);

    const rm = tagMat(new THREE.MeshBasicMaterial({ color: ty.color, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }), ty.tag);
    rm.userData.own = true;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.05, 0.068, 36), rm);
    ring.position.copy(nrm).multiplyScalar(R * 1.014);
    ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), nrm);   // 지표에 붙여 눕힘(지구본 기준 좌표)
    ring.userData.ph = Math.random();
    globe.regions.add(ring);
    globe.regionRings.push(ring);

    regGrow(bucket, {
      tags: [ty.tag], key: "regions", view: "globe", mat: pm, max: 1, speed: 1 / DUR.short,
      set: function (v) {
        const s = Math.max(0.0001, easeOutBack(Math.min(1, v)));
        pin.scale.set(0.15 * s, 0.2 * s, 1);
        pin.visible = v > 0; lab.visible = v > 0.6; ring.visible = v > 0.9;
      }
    });
  });
}
/* 지역 고리가 퍼지며 사라지는 반복 효과 */
function updateRegions(dt, t) {
  if (!globe.regionRings) return;
  for (let i = 0; i < globe.regionRings.length; i++) {
    const g = globe.regionRings[i];
    const p = REDUCED ? 0.3 : (t * 0.7 + g.userData.ph) % 1;
    g.scale.setScalar(1 + p * 2.2);
    g.material.userData.base = 0.85 * (1 - p);
  }
}

/* 햇빛과 기온(일사) — 평행 광선·입사 면적으로 열적 불균형 표현 (1단계)
   태양은 화면 오른쪽에 고정되어 있으므로, 광선·입사면은 지구를 돌려도
   항상 태양 쪽을 향하도록 insolSpin 그룹의 회전을 매 프레임 보정한다. */
const INSOL_LON = 10;         // 광선이 붙는 기준 경도(그룹 회전으로 태양 쪽에 정렬됨)
const INSOL_FACE = -1.1485;   // 태양을 향하도록 하는 기준 각(라디안) — 입사면이 관찰자 쪽으로 보이도록 약간 앞쪽으로
function buildGlobeInsol() {
  disposeGroup(globe.insol);
  const bucket = growBucket("insol");
  globe.insolDots = [];
  const n = latLonToVec(0, INSOL_LON, 1);   // 태양 방향 단위 벡터(그룹 기준)

  /* 지구 회전과 무관하게 태양 쪽을 향하는 하위 그룹 */
  const spin = new THREE.Group();
  globe.insol.add(spin);
  globe.insolSpin = spin;
  globe.insolDir = n.clone();

  const sunLab = makeLabel("태양 빛", {
    sub: "지구에 거의 평행하게 도달", fontSize: 32, color: "#9a6b09",
    bg: "rgba(255,248,222,0.95)", border: "rgba(214,164,50,0.6)", worldHeight: 0.14, pad: 13
  });
  tagMat(sunLab.material, "ray");
  sunLab.position.copy(n).multiplyScalar(R * 2.22);
  sunLab.position.y -= 0.50;
  spin.add(sunLab);

  // 평행 광선 — 태양 쪽에서 지구로 그려지며 도착
  [0, 45, -45, 75, -75].forEach(lat => {
    const end = latLonToVec(lat, INSOL_LON, R * 1.02);
    const start = end.clone().addScaledVector(n, 1.45);
    const mid = end.clone().addScaledVector(n, 0.72);
    const g = makeGrowPath(spin, bucket, {
      points: [start, mid, end], closed: false, tubeR: 0.018, headR: 0.05, headL: 0.12,
      mat: MAT.sunRay, tags: ["ray"], key: "insol", view: "globe", speed: 1 / DUR.base
    });
    for (let k = 0; k < 2; k++) {
      const sp = new THREE.Sprite(dotMat(["ray"]));
      sp.scale.set(0.06, 0.06, 1);
      spin.add(sp);
      globe.insolDots.push({ curve: g.curve, t: k / 2, sprite: sp, grow: g });
    }
  });

  /* 같은 굵기의 햇빛 다발(빛기둥) — 적도와 위도 60°에 하나씩.
     지표에 닿은 자리(입사 면적)는 빛기둥 단면을 구면에 그대로 투영해 계산 →
     위도 60°에서는 같은 햇빛이 약 2배 넓은 면적으로 퍼짐 */
  const Y = new THREE.Vector3(0, 1, 0);
  const V = new THREE.Vector3().crossVectors(n, Y).normalize();
  const BEAM_W = 0.36, BEAM_OUT = 1.6, BEAM_IN = 0.35;
  function footprint(pc, mat) {
    const N = 18, Rs = R * 1.012, pos = [], idx = [];
    const d = n.clone().negate();
    for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
      const a = (i / N - 0.5) * BEAM_W, b = (j / N - 0.5) * BEAM_W;
      const o = pc.clone().addScaledVector(Y, a).addScaledVector(V, b).addScaledVector(n, 4);
      const od = o.dot(d), disc = od * od - (o.lengthSq() - Rs * Rs);
      const t = -od - Math.sqrt(Math.max(0, disc));
      const q = o.addScaledVector(d, t);
      pos.push(q.x, q.y, q.z);
      if (i < N && j < N) { const k = i * (N + 1) + j; idx.push(k, k + N + 1, k + 1, k + N + 1, k + N + 2, k + 1); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    const m = new THREE.Mesh(geo, mat);
    m.renderOrder = 2;
    return m;
  }
  function beam(lat, tag, patchMat, label, labLat, labLon, labR) {
    const pc = latLonToVec(lat, INSOL_LON, R);
    const mat = tagMat(new THREE.MeshBasicMaterial({ color: 0xffd54a, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide }), tag);
    mat.userData.own = true;
    const edgeMat = tagMat(new THREE.LineBasicMaterial({ color: 0xe0a21a, transparent: true, opacity: 0.85 }), tag);
    edgeMat.userData.own = true;
    const L = BEAM_OUT + BEAM_IN;
    const box = new THREE.BoxGeometry(BEAM_W, BEAM_W, L);
    box.translate(0, 0, L / 2);
    const pivot = new THREE.Group();
    pivot.position.copy(pc).addScaledVector(n, BEAM_OUT);
    pivot.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n.clone().negate());
    /* 빛기둥 단면이 위도 방향(Y)과 나란하도록 z축 둘레 정렬 */
    const localY = new THREE.Vector3(0, 1, 0).applyQuaternion(pivot.quaternion);
    const twist = Math.atan2(localY.clone().cross(Y).dot(n.clone().negate()), localY.dot(Y));
    pivot.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), twist));
    pivot.add(new THREE.Mesh(box, mat));
    pivot.add(new THREE.LineSegments(new THREE.EdgesGeometry(box), edgeMat));
    spin.add(pivot);

    const fp = footprint(pc, patchMat);
    spin.add(fp);
    const lab = makeLabel(label[0], {
      sub: label[1], fontSize: 34, color: label[2],
      bg: "rgba(255,255,255,0.95)", border: label[2] + "88", worldHeight: 0.21, pad: 14
    });
    tagMat(lab.material, patchMat.userData.tags);
    lab.position.copy(latLonToVec(labLat, INSOL_LON + labLon, R * labR));
    spin.add(lab);
    const beamLab = makeLabel("같은 양의 햇빛", { fontSize: 26, color: "#9a6b09", bg: "rgba(255,248,222,0.95)", border: "rgba(214,164,50,0.6)", worldHeight: 0.11, pad: 9 });
    tagMat(beamLab.material, tag);
    beamLab.position.copy(pc).addScaledVector(n, BEAM_OUT + 0.08).addScaledVector(Y, BEAM_W / 2 + 0.07);
    spin.add(beamLab);

    const arrive = BEAM_OUT / L;                  // 빛기둥 앞끝이 지표에 닿는 진행도
    regGrow(bucket, {
      tags: [tag], key: "insol", view: "globe", mat: mat, max: 1, speed: 1 / (DUR.base * 1.3),
      set: function (v) {
        const e = smooth01(v);
        pivot.scale.set(1, 1, Math.max(0.001, e));
        pivot.visible = v > 0;
        fp.visible = e >= arrive;
        lab.visible = e >= arrive;
        beamLab.visible = v > 0.15;
      }
    });
  }
  /* 라벨은 입사 면적 옆(화면 가운데 쪽)에 — 빛기둥에 가리지 않게 */
  beam(0, "beam-hot", MAT.patchHot, ["좁은 면적에 집중", "기온 높음", COL.heat], -15, -30, 1.1);
  beam(60, "beam-cold", MAT.patchCold, ["넓은 면적으로 분산", "기온 낮음", COL.cold], 46, -50, 1.07);

  /* 위도별 기온 — 적도(빨강) → 극(파랑) 색 입히기 */
  const tcv = document.createElement("canvas");
  tcv.width = 8; tcv.height = 256;
  const tctx = tcv.getContext("2d");
  const tg = tctx.createLinearGradient(0, 0, 0, 256);
  [[90, "#3b6fd8"], [66, "#5f95ec"], [45, "#9cc3f0"], [32, "#ffd166"], [16, "#ff9a3c"], [0, "#ea5a3d"],
   [-16, "#ff9a3c"], [-32, "#ffd166"], [-45, "#9cc3f0"], [-66, "#5f95ec"], [-90, "#3b6fd8"]]
    .forEach(d => tg.addColorStop((90 - d[0]) / 180, d[1]));
  tctx.fillStyle = tg; tctx.fillRect(0, 0, 8, 256);
  const tmat = tagMat(new THREE.MeshBasicMaterial({ map: setSRGB(new THREE.CanvasTexture(tcv)), transparent: true, opacity: 0.5, depthWrite: false }), "temp");
  tmat.userData.own = true;
  const tsph = new THREE.Mesh(new THREE.SphereGeometry(R * 1.007, 48, 32), tmat);
  tsph.renderOrder = 1;
  globe.insol.add(tsph);
}

/* 설명 요소(기압대·순환·바람·강수)가 보일 때는 지구 사진을 약 72% 밝기로 낮춰 화살표·띠가 도드라지게 */
function updateEarthDim(dt) {
  if (!globe.mat) return;
  const L = state.layers;
  const busy = L.belts || L.cells || L.winds || L.precip;
  const target = busy ? 0.72 : 1;
  const c = globe.mat.color, v = c.r + (target - c.r) * (REDUCED ? 1 : Math.min(1, dt * 3));
  if (Math.abs(v - c.r) > 0.001) c.setRGB(v, v, v);
}

/* 1단계 조명 — 햇빛이 광선과 같은 방향(태양 쪽)에서 비추도록 주광을 옮기고,
   보조광을 줄여 낮·밤 경계가 드러나게 함. 다른 단계로 가면 원래 조명으로 부드럽게 복귀 */
const LIGHT_BASE = { amb: 0.55, hemi: 1.1, key: 1.7, rim: 0.55, keyPos: new THREE.Vector3(4, 3, 6) };
const LIGHT_SUN  = { amb: 0.16, hemi: 0.38, key: 2.5, rim: 0.12 };
const _lq = new THREE.Quaternion(), _lp = new THREE.Vector3();
let sunMix = 0;
function updateSunLighting(dt) {
  const on = state.view === "globe" && state.layers.insol && insolReady;
  const target = on ? 1 : 0;
  if (sunMix === target && !on) return;
  sunMix += (target - sunMix) * (REDUCED ? 1 : Math.min(1, dt * 3));
  if (Math.abs(sunMix - target) < 0.002) sunMix = target;
  ambient.intensity  = LIGHT_BASE.amb  + (LIGHT_SUN.amb  - LIGHT_BASE.amb)  * sunMix;
  hemi.intensity     = LIGHT_BASE.hemi + (LIGHT_SUN.hemi - LIGHT_BASE.hemi) * sunMix;
  key.intensity      = LIGHT_BASE.key  + (LIGHT_SUN.key  - LIGHT_BASE.key)  * sunMix;
  rimLight.intensity = LIGHT_BASE.rim  + (LIGHT_SUN.rim  - LIGHT_BASE.rim)  * sunMix;
  _lp.copy(LIGHT_BASE.keyPos);
  if (globe.insolSpin && sunMix > 0) {
    globe.insolSpin.updateWorldMatrix(true, false);
    globe.insolSpin.getWorldQuaternion(_lq);
    const sunPos = globe.insolDir.clone().applyQuaternion(_lq).multiplyScalar(8);
    _lp.lerp(sunPos, sunMix);
  }
  key.position.copy(_lp);
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
