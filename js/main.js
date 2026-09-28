/* ============================================================
   대기대순환 3D — main.js
   화면 크기 · 렌더 루프 · 시작
   ============================================================ */
"use strict";

/* ============================================================
   13. 리사이즈 / 렌더 루프
   ============================================================ */
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.floor(w * renderer.getPixelRatio()) || canvas.height !== Math.floor(h * renderer.getPixelRatio())) {
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    applyViewOffset();
    refitCamera(false);
  }
}

/* 패널이 가리는 폭/높이 목표값 — 데스크톱: 열린 사이드바 폭, 모바일: 하단 축소 바 높이 */
const SHEET_PEEK = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--sheet-peek")) || 78;
const stageEl = document.querySelector(".stage");
/* 화면 자막(장면 재생기) 높이 — 3D 장면이 자막 위쪽에 오도록 아래 여백에 포함 */
const playerEl = document.getElementById("player");
let playerH = 0;
function measurePlayer() { playerH = playerEl.offsetHeight ? playerEl.offsetHeight + 26 : 0; }
if (window.ResizeObserver) new ResizeObserver(measurePlayer).observe(playerEl);

/* l = 왼쪽 패널 폭, pb = 아래 패널(모바일 시트) 높이, b = pb + 자막 높이(카메라 맞춤용) */
function insetTarget() {
  let l = 0, pb = 0;
  if (!isPresent()) {                                    // 발표 모드: 패널 없음
    if (isMobile()) pb = SHEET_PEEK;
    else l = sidebar.classList.contains("collapsed") ? 0 : sidebar.offsetWidth;
  }
  if (!window.ResizeObserver) measurePlayer();
  /* 단면 보기는 가로로 넓어 그림 자료(왼쪽 위)와 겹치기 쉬움 → 그림이 떠 있으면 위쪽도 비움 */
  let t = 0;
  if (state.view === "cross" && !viewTrans.on) {
    const f = document.querySelector(".fig.show");
    if (f) t = (f.offsetHeight + 18) * 0.55;   // 그림 아래쪽 절반은 단면 윗부분(빈 하늘)과 겹쳐도 됨
  }
  return { l: l, pb: pb, b: pb + playerH, t: t };
}
/* 사이드바 여닫힘 애니메이션(0.28s)·자막 높이 변화에 맞춰 화면 중심도 부드럽게 이동 */
if (viewInset.pb == null) viewInset.pb = 0;
function updateViewInset(dt, snap) {
  const tg = insetTarget();
  const k = (snap || REDUCED) ? 1 : Math.min(1, dt * 9);
  const cur = viewInset, next = {};
  let moved = false;
  ["l", "pb", "b", "t"].forEach(function (p) {
    let v = cur[p] + (tg[p] - cur[p]) * k;
    if (Math.abs(tg[p] - v) < 0.5) v = tg[p];
    if (Math.abs(v - cur[p]) >= 0.01) moved = true;
    next[p] = v;
  });
  if (!snap && !moved) return;
  cur.l = next.l; cur.pb = next.pb; cur.b = next.b; cur.t = next.t;
  /* 화면 자막·조작 힌트는 패널에 가리지 않는 영역에 맞춰 배치 (style.css의 --inset-l/--inset-b) */
  stageEl.style.setProperty("--inset-l", cur.l.toFixed(1) + "px");
  stageEl.style.setProperty("--inset-b", cur.pb.toFixed(1) + "px");
  applyViewOffset();
  refitCamera(false);
}
window.addEventListener("resize", resize);

/* 저사양 PC 보호 — 몇 초 동안 평균 프레임이 느리면(약 26fps 미만) 렌더링 해상도를 1배로 낮춤.
   (화면이 멈췄다 돌아오는 경우처럼 한 프레임이 0.25초 넘게 걸린 경우는 계산에서 제외) */
const perf = { acc: 0, n: 0, lowered: false };
function perfGuard(raw) {
  if (perf.lowered || raw > 0.25 || document.hidden) return;
  perf.acc += raw; perf.n++;
  if (perf.acc < 4) return;
  const avg = perf.acc / perf.n;
  perf.acc = 0; perf.n = 0;
  if (avg > 1 / 26 && renderer.getPixelRatio() > 1) {
    renderer.setPixelRatio(1);
    perf.lowered = true;
    if (window.console) console.info("[대기대순환 3D] 화면이 느려 렌더링 해상도를 낮췄습니다.");
  }
}

let last = performance.now();
function loop(now) {
  const raw = (now - last) / 1000;
  const dt = Math.min(raw, 0.05); last = now;
  perfGuard(raw);
  const t = now / 1000;
  resize();
  updateViewInset(dt, false);
  updateCamAnim(now);

  globeGroup.rotation.x = rot.x;
  globeGroup.rotation.y = rot.y;
  const adt = dt * animSpeed;        // 애니메이션 속도 설정을 반영한 시간
  updateViewTransition(adt);         // 지구본 ↔ 단면 전환 중이면 회전·카메라를 덮어씀

  if (state.view === "globe") {
    /* 수업 시작 전 대기 화면에서만 천천히 자동 회전 — 수업 중에는 장면 구도를 유지 */
    if (!userTouched && !REDUCED && !camAnim.on && state.stepIndex < 0) rot.y += dt * 0.05;
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
      for (let i = 0; i < globe.insolDots.length; i++) {
        const d = globe.insolDots[i];
        const dfk = d.sprite.material.userData.fk;
        if (!REDUCED && !(dfk != null && dfk < 0.5)) d.t = (d.t + dt * 0.3) % 1;   // 강조 밖이면 멈춤
        d.sprite.position.copy(d.curve.getPointAt(d.t));
        d.sprite.visible = d.t <= d.grow.u();          // 그려진 광선 위에서만
      }
    }
    updateRegions(dt, t);
    updateSeasonLabels();
    updatePrecipFront();           // 강수 아이콘은 늘 화면 정면 양옆에
  } else {
  }

  settleTick(now);
  autoTick(now);
  updateFades(dt, t);
  updateSeasonAnim(adt);         // 계절 이동(8단계)
  updateGrows(adt);
  updateWinds(adt);              // 바람 휘어짐 모핑
  updateFlowMats(adt);           // 바람·순환 고리·상승/하강 띠의 흐르는 줄무늬
  updateEarthDim(dt);            // 설명 요소가 있을 때 지구 사진 밝기 낮춤
  updateWeather(dt, t);          // 단면의 구름·비
  updateParcels(dt);
  updateGears(dt);
  updateSunLighting(dt);
  /* 화면 오른쪽 고정 태양 — 확대·화면비가 바뀌어도 항상 같은 자리에 (1단계에서 커지며 등장) */
  if (sunFixed) sunFixed.visible = globeGroup.visible && FADE_KEYS.insol.a > 0.003;
  if (sunFixed && sunFixed.visible) {
    positionFixedSun();
  }
  updateLabelSizes();             // 3D 라벨 최소 글자 크기 보장
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

/* ============================================================
   14. 시작
   ============================================================ */
function init() {
  buildGlobeShell();
  buildStepList();
  buildEnergyFigure();
  buildOrbitFigure();
  setView("globe");
  resize();
  updateViewInset(0, true);
  refitCamera(true);
  applyVisibility();
  renderPlayer();
  requestAnimationFrame(loop);
  requestAnimationFrame(function () {
    renderer.render(scene, camera);
    loadingEl.classList.add("hide");
    requestAnimationFrame(function () {
      buildGlobeLayers();
      applyVisibility();
      openFromHash();
    });
    runWhenIdle(buildClouds);
    runWhenIdle(function () { if (!crossReady) ensureCrossBuilt(); });
  });
}
/* 캔버스로 그리는 3D 라벨은 글꼴이 준비된 뒤 만들어야 내장 글꼴로 그려짐 → 글꼴을 먼저 불러온 뒤 시작
   (글꼴을 못 불러와도 1.5초 뒤에는 기기 기본 글꼴로 시작) */
function whenFontsReady(cb) {
  let done = false;
  const go = function () { if (!done) { done = true; cb(); } };
  if (document.fonts && document.fonts.load) {
    Promise.all(["500", "600", "700", "800", "900"].map(function (w) { return document.fonts.load(w + " 20px AocSans", "가A0"); }))
      .then(go, go);
    setTimeout(go, 1500);
  } else go();
}
if (!APP_FAILED) whenFontsReady(function () { try {
  init();
} catch (err) {
  fatal("프로그램을 시작하는 중 문제가 생겼습니다.<br>새로고침(F5)해 보시고, 계속되면 폴더 구조(index.html·style.css·js 폴더·libs/three.min.js)를 확인해 주세요.");
  if (window.console) console.error(err);
} });
