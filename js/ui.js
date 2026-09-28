/* ============================================================
   대기대순환 3D — ui.js
   조작 패널 — 보기 전환 · 사이드바/하단 시트 · 계절(내부) · 이해하기(단계 목록)
   ============================================================ */
"use strict";

/* ============================================================
   12. UI — 보기 전환, 사이드바, 계절, 이해하기 (레이어는 장면이 정함 — 패널 토글 없음)
   ============================================================ */
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
    zoomMul = 1.14;
    applyZoom();
    flyTo(null, null, 1, DUR.base * 1000);
  }
  applyVisibility();
}
document.getElementById("view-globe").addEventListener("click", function () { changeView("globe"); });
document.getElementById("view-cross").addEventListener("click", function () { changeView("cross"); });

/* --- 사이드바 —
   데스크톱: 좌측 패널(접기/펴기)
   모바일: 하단 시트 — 평소엔 축소 바(현재 단계 + ←→)만 보여 지구를 가리지 않고,
           위로 스와이프하면 패널 확장, 확장 상태에서 좌우 스와이프로 단계 이동 --- */
const sidebar = document.getElementById("sidebar");
/* 휴대전화 + 세로 태블릿 → 하단 시트 (style.css의 같은 조건과 짝) */
const mqMobile = window.matchMedia("(max-width: 700px), (orientation: portrait) and (max-width: 1100px)");
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

/* 장면 이동(스와이프·화살표 공용) — engine.js의 nextBeat/prevBeat */
function beatDelta(d) { if (d > 0) nextBeat(); else prevBeat(); }

/* 축소 바: 위/아래 스와이프 = 열고 닫기 · 좌/우 스와이프 = 장면 이동 · 탭 = 토글 */
const sheetBar = document.getElementById("sheet-bar");
document.getElementById("sheet-prev").addEventListener("click", function (e) { e.stopPropagation(); beatDelta(-1); });
document.getElementById("sheet-next").addEventListener("click", function (e) { e.stopPropagation(); beatDelta(1); });

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
  if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy) * 1.6) { beatDelta(dx < 0 ? 1 : -1); return; }
  if (Date.now() - shT < 350 && Math.abs(dx) < 10 && Math.abs(dy) < 10)
    sheetExpand(!sidebar.classList.contains("expanded"));
});
sheetBar.addEventListener("click", function (e) {
  if (e.target.closest(".sb-arrow")) return;
  if (!("ontouchstart" in window)) sheetExpand(!sidebar.classList.contains("expanded"));  // 마우스 환경 대비
});

/* 확장된 시트 본문: 좌/우로 크게 쓸면 장면 이동(세로 스크롤은 그대로 동작) */
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
  if (Math.abs(dx) > 64 && Math.abs(dx) > Math.abs(dy) * 2.2) beatDelta(dx < 0 ? 1 : -1);
});

/* --- 계절 슬라이더 --- */
function seasonText(v) {
  if (Math.abs(v) < 0.06) return "춘·추분 — 기압대가 적도를 기준으로 대칭";
  const deg = Math.round(Math.abs(v) * SHIFT_MAX);
  return v > 0
    ? "<b>7월 쪽</b> — 기압대·바람대가 북쪽으로 약 " + deg + "° 이동"
    : "<b>1월 쪽</b> — 기압대·바람대가 남쪽으로 약 " + deg + "° 이동";
}
/* 장면에서 계절을 바꿨을 때 (숨겨진) 슬라이더·설명도 맞춰 둠 */
function syncSeasonUI() {
  document.getElementById("season").value = String(state.season);
  document.getElementById("season-readout").innerHTML = seasonText(state.season);
}
document.getElementById("season").addEventListener("input", function (e) {
  setSeason(parseFloat(e.target.value), false);
});

/* --- 이해 순서(8단계) — 단계를 고르면 그 단계의 첫 장면부터 (engine.js) --- */
function buildStepList() {
  const ol = document.getElementById("step-list");
  ol.innerHTML = "";
  STEPS.forEach(function (s, i) {
    const li = document.createElement("li");
    li.innerHTML = '<span class="num">' + (i + 1) + "</span><span>" + s.title + "</span>";
    li.setAttribute("tabindex", "0");
    li.setAttribute("role", "button");
    const go = function () {
      goStep(i);
      if (isMobile()) sheetExpand(false);   // 지구가 보이도록 시트를 접음
    };
    li.addEventListener("click", go);
    li.addEventListener("keydown", function (ev) {
      if (ev.key === " " || ev.key === "Enter") { ev.preventDefault(); go(); }
    });
    ol.appendChild(li);
  });
}
