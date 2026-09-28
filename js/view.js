/* ============================================================
   대기대순환 3D — view.js
   레이어 가시성 · 카메라(화면 맞춤·연출) · 드래그/휠/핀치 조작 · 클릭 → 정보 카드
   ============================================================ */
"use strict";

/* ============================================================
   9. 레이어 가시성
   ============================================================ */
function applyVisibility() {
  const L = state.layers, isGlobe = state.view === "globe";
  if (!isGlobe) ensureCrossBuilt();
  if (L.insol) { ensureGlobeInsol(); ensureFixedSun(); }

  globeGroup.visible = isGlobe;
  crossGroup.visible = !isGlobe && crossReady;
  /* 레이어별 표시/숨김은 updateFades()가 매 프레임 서서히 처리 — 여기서는 재질 목록만 갱신 */
  sweepFadeMats();
  updateCloudTarget();

  document.getElementById("controls-hint").textContent = isGlobe
    ? "드래그: 돌리기 · 휠/두 손가락: 확대·축소 · 색깔 띠 클릭: 설명 카드"
    : "색깔 띠(기둥)를 클릭: 설명 카드 · 휠/두 손가락: 확대·축소";
}

/* 계절 변경 → 위치 의존 요소 재생성(프레임당 1회로 제한) */
let seasonBuiltSh = 0;      // 마지막으로 다시 만든 때의 기압대 이동량
function crossSeasonGroups() { return [cross.belts, cross.cells, cross.winds, cross.precip, cross.pickers]; }
function rebuildSeasonDependent() {
  if (globeLayersReady) {
    buildGlobeBelts(); buildGlobePrecip(); buildGlobeCells(); buildGlobeWinds(); buildGlobePickers();
    updateSeasonFx();
  }
  if (crossReady) {
    buildCrossBelts(); buildCrossCells(); buildCrossWinds(); buildCrossPrecip(); buildCrossPickers();
    crossSeasonGroups().forEach(g => { g.position.x = 0; });
    updateCrossSun();
    /* 다시 만든 화살표·고리는 처음부터 다시 그려지지 않고 바로 완성된 모습으로 */
    ["crossBelts", "crossCells", "crossWx"].forEach(k => (GROW_BUCKETS[k] || []).forEach(g => { g.cur = growTarget(g); g.set(g.cur); }));
  }
  seasonBuiltSh = seasonShift();
  applyVisibility();
  updateOrbitFigure();
}

/* ------------------------------------------------------------
   계절 이동 애니메이션 — 기압대·바람대가 연속으로 남북 이동
   이동 중에는 이미 만든 요소를 옮기기만 하고(단면: 평행 이동 / 지구본: 띠 재생성·라벨 이동),
   이동이 끝나면 한 번 정확히 다시 만듦(위도 숫자 라벨 등)
   ------------------------------------------------------------ */
const seasonAnim = { on: false, from: 0, to: 0, t: 0, dur: 2.4 };
function setSeason(s, animate) {
  state.season = s;
  syncSeasonUI();
  if (!animate || REDUCED) {
    seasonAnim.on = false;
    state.seasonCur = s;
    requestSeasonRebuild();
    return;
  }
  seasonAnim.on = true;
  seasonAnim.from = state.seasonCur; seasonAnim.to = s; seasonAnim.t = 0;
  seasonAnim.dur = DUR.long * (0.6 + 0.8 * Math.abs(s - state.seasonCur));   // 1월 ↔ 7월 전체 이동은 약 4초
}
function finishSeasonAnim() {
  if (!seasonAnim.on) return;
  seasonAnim.on = false;
  state.seasonCur = seasonAnim.to;
  rebuildSeasonDependent();
}
function updateSeasonAnim(dt) {
  if (!seasonAnim.on) return;
  seasonAnim.t = Math.min(1, seasonAnim.t + dt / seasonAnim.dur);
  const e = seasonAnim.t * seasonAnim.t * (3 - 2 * seasonAnim.t);
  state.seasonCur = seasonAnim.from + (seasonAnim.to - seasonAnim.from) * e;
  const sh = seasonShift();
  if (crossReady) {
    const dx = latToX(sh) - latToX(seasonBuiltSh);
    crossSeasonGroups().forEach(g => { g.position.x = dx; });
    updateCrossSun();
  }
  if (globeLayersReady) applyGlobeSeasonLive(sh);
  updateOrbitFigure();
  if (seasonAnim.t >= 1) finishSeasonAnim();
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
/* 확대 배율 — 카메라 거리 = 화면 맞춤 거리(fitZ) × zoomMul.
   패널·자막 높이가 바뀌어 fitZ가 달라져도 교사가 정한 확대 정도가 유지됨 */
let zoomMul = 1;
const ZOOM_MIN = 0.45, ZOOM_MAX = 1.9;
function clampZoom(z) { return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z)); }
function applyZoom() { camZ = fitZ * zoomMul; camera.position.z = camZ; }

/* ------------------------------------------------------------
   가려지지 않는 영역 맞춤 — 패널(데스크톱: 왼쪽 / 모바일: 하단 시트)이
   캔버스 위에 겹치므로, 카메라 화면 중심을 "보이는 영역"의 가운데로 옮긴다.
   viewInset.l/b = 왼쪽·아래가 가려진 픽셀(패널 여닫을 때 부드럽게 따라감)
   ------------------------------------------------------------ */
const viewInset = { l: 0, b: 0, t: 0, pb: 0, fx: 1, fy: 1 };   // t = 위쪽(그림 자료) 여백
function applyViewOffset() {
  const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight);
  camera.setViewOffset(w, h, -viewInset.l / 2, (viewInset.b - viewInset.t) / 2, w, h);
  viewInset.fx = Math.max(0.3, (w - viewInset.l) / w);
  viewInset.fy = Math.max(0.3, (h - viewInset.b - viewInset.t) / h);
}
/* 보이는 영역 기준 화면 절반 높이·절반 폭(거리 1 기준) */
function visHalfH() { return TANF * viewInset.fy; }
function visHalfW() { return TANF * Math.max(0.35 * viewInset.fy, (camera.aspect || 1) * viewInset.fx); }

function fitDist(view) {
  if (view === "globe") {
    const need = R * 1.52;
    return Math.max(need / visHalfH(), need / visHalfW());
  }
  const needH = 1.56, needW = XW + 0.55;
  return Math.max(needH / visHalfH(), needW / visHalfW());
}
function refitCamera(force) {
  fitZ = fitDist(state.view);
  if (force) zoomMul = 1;
  zoomMul = clampZoom(zoomMul);
  camZ = fitZ * zoomMul;
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
  const tz = clampZoom(zMul || 1);
  if (REDUCED) {
    camAnim.on = false;
    if (rx != null) rot.x = rx;
    if (ry != null) rot.y = ry;
    zoomMul = tz; applyZoom();
    return;
  }
  camAnim.on = true;
  camAnim.t0 = performance.now();
  camAnim.dur = (dur || DUR.base * 1000) / animSpeed;
  camAnim.fx = rot.x; camAnim.fy = rot.y; camAnim.fz = zoomMul;
  camAnim.tx = rx != null ? rx : rot.x;
  /* 가로 회전은 가장 가까운 방향으로(자동 회전으로 여러 바퀴 돈 뒤에도 되감기지 않게) */
  if (ry != null) {
    const TAU = Math.PI * 2;
    let d = (ry - rot.y) % TAU;
    if (d > Math.PI) d -= TAU; else if (d < -Math.PI) d += TAU;
    camAnim.ty = rot.y + d;
  } else camAnim.ty = rot.y;
  camAnim.tz = tz;
}
function updateCamAnim(now) {
  if (!camAnim.on) return;
  let u = (now - camAnim.t0) / camAnim.dur;
  if (u >= 1) { u = 1; camAnim.on = false; }
  const k = easeInOutCubic(u);
  rot.x = camAnim.fx + (camAnim.tx - camAnim.fx) * k;
  rot.y = camAnim.fy + (camAnim.ty - camAnim.fy) * k;
  zoomMul = camAnim.fz + (camAnim.tz - camAnim.fz) * k;
  applyZoom();
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
      zoomMul = clampZoom(zoomMul * pinchD / nd);
      applyZoom();
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
  zoomMul = clampZoom(zoomMul + (e.deltaY > 0 ? 1 : -1) * 0.06);
  applyZoom();
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
  /* 지역 마커를 먼저 확인 — 보이는 마커를 누르면 그 지역이 속한 위도대 카드 */
  if (state.view === "globe" && globe.regionPicks) {
    const pins = globe.regionPicks.filter(p => p.visible && p.material.opacity > 0.3);
    const ph = raycaster.intersectObjects(pins, false);
    if (ph.length) { const rg = ph[0].object.userData.region; showCard(ZONES[rg.zone], rg.lat >= 0 ? 1 : -1, rg); return; }
  }
  const targets = state.view === "globe" ? globe.pickers.children : cross.pickers.children;
  const hits = raycaster.intersectObjects(targets, false);
  if (hits.length) showCard(hits[0].object.userData.zone, hits[0].object.userData.hemi);
}

function showCard(z, hemi, region) {
  if (!z) return;
  document.getElementById("card-dot").style.background = z.color;
  document.getElementById("card-title").innerHTML = fmtKo(z.title);
  document.getElementById("card-term").textContent = z.term;
  let latTxt;
  if (z.id === "eq") latTxt = "0° 부근";
  else if (z.id === "pole") latTxt = hemi > 0 ? "북극 부근" : "남극 부근";
  else latTxt = z.lat + "°" + (hemi > 0 ? "N" : "S") + " 부근";
  document.getElementById("card-lat").textContent = latTxt;
  document.getElementById("card-move").innerHTML = fmtKo(z.move);
  document.getElementById("card-rain").innerHTML = fmtKo(z.rain);
  document.getElementById("card-region").innerHTML = fmtKo(region
    ? "<b>📍 " + region.name + "</b> — " + z.region
    : z.region);
  document.getElementById("card-sum").innerHTML = fmtKo(z.sum);
  document.getElementById("card").classList.add("show");
}
function hideCard() { document.getElementById("card").classList.remove("show"); }
document.getElementById("card-close").addEventListener("click", hideCard);
