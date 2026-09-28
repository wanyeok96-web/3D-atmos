/* ============================================================
   대기대순환 3D — engine.js
   장면 재생기 — 단계(step) 안의 장면(beat)을 한 번에 하나씩 진행
   - 장면 상태 = 단계 시작 상태(base) + 1..k번째 장면의 변경분 누적
     → 앞·뒤 어느 쪽으로 이동해도 그 장면의 화면이 정확히 복원됨
   - 화면 자막 · 질문/답 보기 · 진행 점 · 자동 재생
   - 키보드/발표용 리모컨: → Space PageDown 다음 · ← PageUp 이전 · Shift+←/→ 단계 이동
                           R 다시 · F 발표 모드 · A 답 보기 · Home 처음
   - 발표 모드: 전체 화면 + 패널 숨김 + 큰 자막
   ============================================================ */
"use strict";

/* ------------------------------------------------------------
   장면 상태 계산
   ------------------------------------------------------------ */
function beatState(i, k) {
  const st = STEPS[i], b = st.base;
  const s = {
    view: b.view, layers: Object.assign({}, b.layers), focus: b.focus || null, hide: (b.hide || []).slice(),
    pressure: !!b.pressure, season: b.season || 0, cam: Object.assign({}, b.cam), cap: "", q: null, a: null,
    draw: Object.assign({}, b.draw), parcel: (b.parcel || []).slice(), fig: b.fig || null,
    show: (b.show || []).slice()
  };
  for (let j = 0; j <= k; j++) {
    const bt = st.beats[j];
    if ("view" in bt) s.view = bt.view;
    if (bt.layers) Object.assign(s.layers, bt.layers);
    if ("focus" in bt) s.focus = bt.focus;
    if ("hide" in bt) s.hide = (bt.hide || []).slice();
    if ("pressure" in bt) s.pressure = !!bt.pressure;
    if ("season" in bt) s.season = bt.season;
    if (bt.cam) Object.assign(s.cam, bt.cam);
    if (bt.draw) Object.assign(s.draw, bt.draw);
    if ("parcel" in bt) s.parcel = (bt.parcel || []).slice();
    if ("fig" in bt) s.fig = bt.fig || null;
    if ("show" in bt) s.show = (bt.show || []).slice();
  }
  const cur = st.beats[k];
  s.cap = cur.cap || ""; s.q = cur.q || null; s.a = cur.a || null;
  return s;
}

/* ------------------------------------------------------------
   재생 상태
   ------------------------------------------------------------ */
const player = {
  auto: false,          // 자동 재생
  beatT0: 0,            // 현재 장면 시작 시각
  answer: false,        // 답 보기 펼침
  lastCamKey: null      // 직전에 적용한 카메라(같으면 다시 움직이지 않아 교사의 회전을 존중)
};

function stripTags(h) { return String(h).replace(/<[^>]+>/g, ""); }

function goBeat(i, k) {
  if (i < 0 || i >= STEPS.length) return;
  k = Math.max(0, Math.min(STEPS[i].beats.length - 1, k));
  const s = beatState(i, k);
  /* 한 장면 앞으로 진행할 때만 그리기 애니메이션 — 뒤로·건너뛰기는 그 장면 상태로 즉시 */
  const pi = state.stepIndex, pk = state.beatIndex;
  const forward = (i === pi && k === pk + 1)
    || (pi >= 0 && i === pi + 1 && k === 0 && pk === STEPS[pi].beats.length - 1)
    || (pi < 0 && i === 0 && k === 0);
  if (viewTrans.on) finishViewTransition();

  state.stepIndex = i;
  state.beatIndex = k;
  Object.keys(s.layers).forEach(function (key) { state.layers[key] = s.layers[key]; });
  state.focus = s.focus && s.focus.length ? s.focus.slice() : null;
  /* 자전 표시·지역 마커 등은 show 목록에 있을 때만 */
  state.hide = s.hide.concat(OPTIONAL_TAGS.filter(function (t) { return s.show.indexOf(t) < 0; }));
  state.showPressure = s.pressure;
  state.draw = s.draw;
  state.parcel = s.parcel;
  if (needsGlobeLayers(state.layers)) ensureGlobeLayers();
  showFigure(s.fig);

  /* 계절: 앞으로 진행하면 기압대가 서서히 이동, 뒤로·건너뛰기는 바로 그 계절 */
  if (state.season !== s.season) setSeason(s.season, forward);
  else if (!forward) finishSeasonAnim();

  /* 카메라 — 장면의 카메라 값이 바뀌었을 때만 이동 (보기가 바뀌면 전환 연출이 끝난 뒤) */
  const camKey = s.view + JSON.stringify(s.cam);
  const needCam = camKey !== player.lastCamKey;
  player.lastCamKey = camKey;
  function flyCam() {
    const c = s.cam;
    if (s.view === "globe") flyTo(c.rx != null ? c.rx : null, c.ry != null ? c.ry : null, c.z || 1, DUR.base * 1000);
    else flyTo(null, null, c.z || 1, DUR.base * 1000);
  }
  /* 장면 안 순서: 카메라가 움직이는 장면은 카메라가 거의 멈출 무렵(약 0.6초 뒤)부터 새 요소를 그림 */
  player.growHoldUntil = performance.now() + (forward && needCam ? 600 / animSpeed : 0);
  if (state.view !== s.view) changeView(s.view, flyCam);   // 지구본 ↔ 단면: 자르기/감기 전환
  else if (needCam) flyCam();

  refreshLayerList();
  applyVisibility();
  hideCard();
  updateCrossSun();
  if (!forward) { snapGrows(); snapWinds(); }

  player.answer = false;
  player.beatT0 = performance.now();
  player.settledAt = 0;                 // 이 장면의 움직임이 모두 끝난 시각 (settleTick)
  renderPlayer();
  /* 주소 끝에 현재 장면 기록(#단계-장면) — 새로고침하거나 즐겨찾기로 바로 그 장면을 열 수 있음 */
  try { history.replaceState(null, "", "#" + (i + 1) + "-" + (k + 1)); } catch (e) { /* file:// 등에서 막히면 무시 */ }
}
/* 시작할 때 주소의 #단계-장면 읽기 (예: index.html#2-3 → 2단계 3번째 장면) */
function openFromHash() {
  const m = /^#(\d+)(?:-(\d+))?$/.exec(location.hash || "");
  if (!m) return false;
  const i = parseInt(m[1], 10) - 1, k = m[2] ? parseInt(m[2], 10) - 1 : 0;
  if (i < 0 || i >= STEPS.length) return false;
  goBeat(i, k);
  return true;
}

function nextBeat() {
  const i = state.stepIndex, k = state.beatIndex;
  if (i < 0) { goBeat(0, 0); return; }
  if (k < STEPS[i].beats.length - 1) goBeat(i, k + 1);
  else if (i < STEPS.length - 1) goBeat(i + 1, 0);
  else { player.auto = false; renderPlayer(); flashEnd(); }
}
function prevBeat() {
  const i = state.stepIndex, k = state.beatIndex;
  if (i < 0) return;
  if (k > 0) goBeat(i, k - 1);
  else if (i > 0) goBeat(i - 1, STEPS[i - 1].beats.length - 1);
}
function goStep(i) { goBeat(i, 0); }
function nextStep() { if (state.stepIndex < STEPS.length - 1) goStep(state.stepIndex + 1); }
function prevStep() { if (state.stepIndex > 0) goStep(state.stepIndex - 1); else if (state.stepIndex === 0) goStep(0); }
function replayStep() { if (state.stepIndex >= 0) { player.lastCamKey = null; goStep(state.stepIndex); } }
function toggleAnswer() {
  const s = currentBeat();
  if (!s || !s.a) return;
  player.answer = !player.answer;
  renderPlayer();
}
function currentBeat() {
  return state.stepIndex >= 0 ? STEPS[state.stepIndex].beats[state.beatIndex] : null;
}
function setAuto(on) {
  player.auto = !!on;
  player.beatT0 = performance.now();
  renderPlayer();
}

/* 애니메이션 속도 — 느리게 → 보통 → 빠르게 순환, 브라우저에 기억(다음에 열어도 유지) */
function setAnimSpeed(idx) {
  const n = ANIM_SPEEDS.length;
  const i = ((idx % n) + n) % n;
  animSpeed = ANIM_SPEEDS[i].v;
  const btn = document.getElementById("tp-speed");   // ($는 아래에서 정의되므로 여기서는 직접 찾음)
  if (btn) {
    btn.textContent = ANIM_SPEEDS[i].name;
    btn.setAttribute("aria-label", "애니메이션 속도: " + ANIM_SPEEDS[i].name + " (누르면 바뀜)");
  }
  try { localStorage.setItem("aoc3d-speed", String(i)); } catch (e) { /* 저장이 막혀도 동작 */ }
}
function speedIndex() { for (let i = 0; i < ANIM_SPEEDS.length; i++) if (ANIM_SPEEDS[i].v === animSpeed) return i; return 1; }
function cycleSpeed() { setAnimSpeed(speedIndex() + 1); }
(function restoreSpeed() {
  let i = 1;
  try { const v = localStorage.getItem("aoc3d-speed"); if (v != null && !isNaN(+v)) i = +v; } catch (e) {}
  setAnimSpeed(i);
})();

/* 장면의 움직임(전환·계절 이동·카메라·그리기·바람 휘어짐)이 모두 끝났는지 — 끝나면 자막 핵심어에 밑줄 */
function settleTick(now) {
  if (state.stepIndex < 0 || player.settledAt) return;
  if (now < player.beatT0 + 350 || now < (player.growHoldUntil || 0)) return;
  if (viewTrans.on || seasonAnim.on || camAnim.on) return;
  if (globeLayersReady && globe.windMorph !== (state.layers.coriolis ? 1 : 0)) return;
  let busy = false;
  forEachGrow(function (g) { if (!busy && !growHidden(g) && g.cur !== growTarget(g)) busy = true; });
  if (busy) return;
  player.settledAt = now;
  $("cap-text").classList.add("settled");
}

/* 자동 재생 — 움직임이 끝난 뒤 자막 길이에 맞춰 머문 다음 장면으로. 질문 장면에서는 멈추고 교사의 진행을 기다림 */
function autoTick(now) {
  if (!player.auto || state.stepIndex < 0 || !player.settledAt) return;
  const b = currentBeat();
  if (!b || b.q) return;
  const hold = (1800 + stripTags(b.cap || "").length * 55) / animSpeed;
  if (now - player.settledAt > hold) nextBeat();
}

/* ------------------------------------------------------------
   화면 자막 · 진행 점 · 패널 동기화
   ------------------------------------------------------------ */
const $ = function (id) { return document.getElementById(id); };

function renderPlayer() {
  const i = state.stepIndex, k = state.beatIndex;
  const started = i >= 0;
  const st = started ? STEPS[i] : null;
  const b = started ? st.beats[k] : null;

  /* 자막 */
  $("cap-step").innerHTML = started ? fmtKo((i + 1) + " / " + STEPS.length + "  ·  " + st.short) : "시작하기";
  $("cap-text").innerHTML = started ? fmtKo(b.cap)
    : (isMobile() ? "아래 바의 <b>›</b> 버튼을 누르면 1단계부터 수업이 시작돼요."
                  : "<b>▶</b> 버튼이나 키보드 <b>→</b>를 누르면 1단계부터 수업이 시작돼요.");
  const hasQ = started && !!b.q;
  $("cap-q").hidden = !hasQ;
  if (hasQ) {
    $("cap-q-text").innerHTML = fmtKo(b.q);
    $("cap-a").innerHTML = fmtKo(b.a || "");
    $("cap-a").hidden = !player.answer;
    $("cap-a-btn").hidden = !b.a;
    $("cap-a-btn").firstChild.textContent = player.answer ? "답 숨기기 " : "답 보기 ";
  }
  $("cap-text").classList.remove("settled");
  /* 자막이 바뀔 때마다 살짝 떠오르는 효과 */
  const cap = $("cap");
  cap.classList.remove("enter"); void cap.offsetWidth; cap.classList.add("enter");

  /* 진행 점 */
  const dots = $("tp-dots");
  dots.innerHTML = "";
  if (started) {
    st.beats.forEach(function (bt, j) {
      const d = document.createElement("button");
      d.className = "dot" + (j === k ? " on" : "") + (j < k ? " done" : "") + (bt.q ? " q" : "");
      d.setAttribute("aria-label", "장면 " + (j + 1) + (bt.q ? " (질문)" : ""));
      d.addEventListener("click", function () { goBeat(i, j); });
      dots.appendChild(d);
    });
  }
  const atEnd = started && i === STEPS.length - 1 && k === st.beats.length - 1;
  $("tp-prev").disabled = !started || (i === 0 && k === 0);
  $("tp-next").disabled = atEnd;
  $("tp-next").title = !started ? "수업 시작 (→)"
    : (k === st.beats.length - 1 ? "다음 단계로 (→)" : "다음 장면 (→)");
  $("tp-next").classList.toggle("step-end", started && k === st.beats.length - 1 && !atEnd);
  $("tp-replay").disabled = !started;
  $("tp-auto").setAttribute("aria-pressed", String(player.auto));

  /* 패널: 단계 카드 */
  $("step-count").textContent = started
    ? "단계 " + (i + 1) + " / " + STEPS.length + "  ·  장면 " + (k + 1) + " / " + st.beats.length : "시작하기";
  $("step-title").innerHTML = started ? fmtKo(st.title) : "1단계부터 차례로 진행해 보세요";
  $("step-body").innerHTML = started ? fmtKo(st.body)
    : "화면 아래 <b>▶</b>(또는 키보드 <b>→</b>)를 누를 때마다 설명과 함께 장면이 하나씩 진행됩니다. 위 목록에서 단계를 바로 고를 수도 있어요.";
  $("step-prev").disabled = !started || i <= 0;
  $("step-next").disabled = started && i >= STEPS.length - 1;
  document.querySelectorAll("#step-list li").forEach(function (li, n) {
    li.classList.toggle("on", n === i);
    li.setAttribute("aria-current", n === i ? "step" : "false");
  });
  const onLi = document.querySelector("#step-list li.on");
  if (onLi && onLi.scrollIntoView && !isMobile()) onLi.scrollIntoView({ block: "nearest" });

  /* 모바일 하단 시트 바 */
  $("sheet-step").textContent = started ? (i + 1) + "단계 · 장면 " + (k + 1) + "/" + st.beats.length : "시작하기";
  $("sheet-title").innerHTML = started ? fmtKo(st.title) : "▶ 눌러 시작 · 위로 쓸어올려 패널 열기";
  $("sheet-prev").disabled = $("tp-prev").disabled;
  $("sheet-next").disabled = atEnd;
}

function flashEnd() {
  $("cap-step").textContent = "수업 끝";
  $("cap-text").innerHTML = "모든 단계를 마쳤어요. 목록에서 단계를 골라 다시 볼 수 있어요.";
  $("cap-q").hidden = true;
}

/* ------------------------------------------------------------
   발표 모드 — 전체 화면 + 패널·상단바 숨김 + 큰 자막
   ------------------------------------------------------------ */
function isPresent() { return document.body.classList.contains("present"); }
function setPresent(on) {
  document.body.classList.toggle("present", on);
  $("present-btn").setAttribute("aria-pressed", String(on));
  const de = document.documentElement;
  if (on && de.requestFullscreen && !document.fullscreenElement) {
    de.requestFullscreen().catch(function () { /* 전체 화면이 막혀도 발표 모드는 유지 */ });
  } else if (!on && document.fullscreenElement && document.exitFullscreen) {
    document.exitFullscreen().catch(function () {});
  }
}
document.addEventListener("fullscreenchange", function () {
  if (!document.fullscreenElement && isPresent()) setPresent(false);   // Esc로 전체 화면을 빠져나오면 발표 모드도 종료
});

/* ------------------------------------------------------------
   입력 연결
   ------------------------------------------------------------ */
$("tp-next").addEventListener("click", nextBeat);
$("tp-prev").addEventListener("click", prevBeat);
$("tp-replay").addEventListener("click", replayStep);
$("tp-auto").addEventListener("click", function () { setAuto(!player.auto); });
$("tp-speed").addEventListener("click", cycleSpeed);
$("cap-a-btn").addEventListener("click", toggleAnswer);
$("present-btn").addEventListener("click", function () { setPresent(!isPresent()); });
$("present-exit").addEventListener("click", function () { setPresent(false); });
$("step-prev").addEventListener("click", prevStep);
$("step-next").addEventListener("click", function () { if (state.stepIndex < 0) goStep(0); else nextStep(); });

document.addEventListener("keydown", function (e) {
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  const t = e.target, tag = t && t.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (t && t.isContentEditable)) return;
  /* 버튼·토글에 포커스가 있으면 Space/Enter는 그 컨트롤이 처리 */
  const onControl = t && t.closest && t.closest("button, [role=checkbox], #step-list li");
  const key = e.key;
  let handled = true;
  if (key === "ArrowRight" || key === "PageDown" || ((key === " " || key === "Spacebar") && !onControl)) {
    if (e.shiftKey && key === "ArrowRight") nextStep(); else nextBeat();
  } else if (key === "ArrowLeft" || key === "PageUp") {
    if (e.shiftKey && key === "ArrowLeft") prevStep(); else prevBeat();
  } else if (key === "Home") goStep(0);
  else if (key === "r" || key === "R" || key === "ㄱ") replayStep();
  else if (key === "f" || key === "F" || key === "ㄹ") setPresent(!isPresent());
  else if (key === "a" || key === "A" || key === "ㅁ") toggleAnswer();
  else if (key === "s" || key === "S" || key === "ㄴ") cycleSpeed();
  else if (key === "Escape" && isPresent() && !document.fullscreenElement) setPresent(false);
  else handled = false;
  if (handled) e.preventDefault();
});
