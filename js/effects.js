/* ============================================================
   대기대순환 3D — effects.js
   장면 애니메이션 도구
   1) 그리기(grow)  — 화살표·순환 고리가 선을 긋듯 자라남 (진행 방향 화살촉이 앞장섬)
   2) 도장(stamp)   — L / H 표시가 튀어나오듯 등장
   3) 공기 덩어리   — 데워져 부풀며 상승 / 식어 줄어들며 하강
   4) 톱니바퀴      — 이웃한 순환이 서로 반대 방향으로 도는 모습
   5) 단면 전환     — 지구본을 세로로 잘라 단면으로 펼치기 ↔ 다시 감기
   6) 그림 자료     — 위도별 에너지 과잉·부족 그래프(HTML)
   ============================================================ */
"use strict";

/* ============================================================
   1. 그리기(grow)
   - 장면의 draw 값(steps.js)이 목표, 없으면 끝까지(max)
   - 요소가 숨겨져 있다가 나타나면 0부터 자라남 → "새로 등장하는 것은 그려지며 등장"
   - 앞으로 한 장면씩 진행할 때만 애니메이션, 뒤로 가거나 건너뛰면 즉시 그 상태
   ============================================================ */
const GROW_BUCKETS = {};
function growBucket(name) { GROW_BUCKETS[name] = []; return GROW_BUCKETS[name]; }
function forEachGrow(fn) { for (const k in GROW_BUCKETS) GROW_BUCKETS[k].forEach(fn); }

function regGrow(bucket, g) { g.cur = 0; g.set(0); bucket.push(g); return g; }
function growTarget(g) {
  const d = state.draw;
  if (d) for (let i = 0; i < g.tags.length; i++) if (g.tags[i] in d) return Math.max(0, Math.min(g.max, d[g.tags[i]]));
  return g.max;
}
/* 완전히 안 보이는 상태(다른 보기 / 레이어 꺼짐 / 숨김 태그)면 true */
function growHidden(g) {
  if (!(g.view === "cross" ? crossGroup.visible : globeGroup.visible)) return true;
  const f = FADE_KEYS[g.key];
  if (!f || f.a <= 0.003) return true;
  const fk = g.mat.userData.fk;
  return fk != null && fk <= 0.003;
}
function updateGrows(dt) {
  const hold = performance.now() < (player.growHoldUntil || 0);   // 카메라 이동 중에는 새로 그리기를 잠시 미룸
  forEachGrow(function (g) {
    if (growHidden(g)) { if (g.cur !== 0) { g.cur = 0; g.set(0); } return; }
    const tg = growTarget(g);
    if (g.cur === tg) return;
    if (hold && g.cur < tg) return;
    const step = REDUCED ? 1e9 : g.speed * dt;
    g.cur = g.cur < tg ? Math.min(tg, g.cur + step) : Math.max(tg, g.cur - step);
    g.set(g.cur);
  });
}
/* 뒤로 가기·건너뛰기: 보이는 요소는 목표 상태로 즉시 */
function snapGrows() {
  forEachGrow(function (g) {
    if (growHidden(g)) return;
    g.cur = growTarget(g); g.set(g.cur);
  });
}

/* 구간(phase) 값 → 곡선 길이 비율 */
function phaseToU(ph, v) {
  if (v <= 0) return 0;
  if (v >= ph.length - 1) return 1;
  const i = Math.floor(v);
  return ph[i] + (ph[i + 1] - ph[i]) * (v - i);
}

/* 자라나는 곡선 화살표 / 순환 고리
   o = { points, closed, tubeR, headR, headL, mat, tags, key, view, phases?, speed?, headsAtMid? } */
const _tipQ = new THREE.Quaternion();
function makeGrowPath(parent, bucket, o) {
  const curve = o.closed
    ? new THREE.CatmullRomCurve3(o.points, true, "catmullrom", 0.15)
    : new THREE.CatmullRomCurve3(o.points);
  const segs = o.segs || (o.closed ? 110 : Math.max(16, o.points.length * 4));
  const radial = o.closed ? 10 : 8;
  const geo = new THREE.TubeGeometry(curve, segs, o.tubeR, radial, !!o.closed);
  if (o.latAlt) colorizeByTemp(geo, o.latAlt);          // 순환 고리: 꼭짓점 기온 색
  const tube = new THREE.Mesh(geo, o.mat);
  parent.add(tube);
  const perSeg = radial * 6;

  const phases = o.phases || [0, 1];
  /* 진행 방향 화살촉: 닫힌 고리는 각 구간 가운데, 열린 화살표는 끝 */
  const heads = [];
  if (o.closed) {
    for (let i = 0; i < phases.length - 1; i++) {
      const t = (phases[i] + phases[i + 1]) / 2;
      const cg = coneAt(curve.getPointAt(t), curve.getTangentAt(t), o.headR, o.headL, true);
      if (o.latAlt) colorizeByTemp(cg, o.latAlt);
      const m = new THREE.Mesh(cg, o.mat);
      parent.add(m); heads.push({ t: t, m: m });
    }
  } else {
    const m = new THREE.Mesh(coneAt(curve.getPointAt(1), curve.getTangentAt(1), o.headR, o.headL, false), o.mat);
    parent.add(m); heads.push({ t: 1, m: m });
  }
  /* 그리는 중 선 끝을 따라가는 화살촉 */
  const tipGeo = new THREE.ConeGeometry(o.headR, o.headL, 10);
  tipGeo.translate(0, o.headL * 0.35, 0);
  if (o.latAlt) colorizeByTemp(tipGeo, () => [0, 0]);   // 그리는 중 위치에 맞춰 색을 바꿈(set)
  const tip = new THREE.Mesh(tipGeo, o.mat);
  parent.add(tip);

  const g = {
    tags: [].concat(o.tags), key: o.key, view: o.view, mat: o.mat,
    max: phases.length - 1, speed: o.speed || 1.1, curve: curve, phases: phases,
    set: function (v) {
      const u = phaseToU(phases, v);
      geo.setDrawRange(0, Math.round(u * segs) * perSeg);
      for (let i = 0; i < heads.length; i++) heads[i].m.visible = u > 0 && u >= heads[i].t - 1e-4;
      const growing = u > 0.002 && u < 0.998;
      tip.visible = growing;
      if (growing) {
        tip.position.copy(curve.getPointAt(u));
        tip.quaternion.copy(_tipQ.setFromUnitVectors(UP, curve.getTangentAt(u)));
        if (o.latAlt) {                                    // 앞장서는 화살촉도 그 자리 기온 색
          const la = o.latAlt(tip.position.x, tip.position.y, tip.position.z);
          tempColor(tempAt(la[0], la[1]), _tc);
          const ca = tipGeo.attributes.color;
          for (let i = 0; i < ca.count; i++) ca.setXYZ(i, _tc.r, _tc.g, _tc.b);
          ca.needsUpdate = true;
        }
      }
    },
    u: function () { return phaseToU(phases, this.cur); }
  };
  return regGrow(bucket, g);
}

/* 순환 고리 점 배열을 시작 구간에 맞춰 회전 + 구간 경계(길이 비율) 계산
   roundedLoopUV 점 순서: 지면(0) → 상승(11) → 상층(22) → 하강(33) → (44=처음)
   start: "ground" | "rise" | "sink" */
const LOOP_LEG = { ground: 0, rise: 11, top: 22, sink: 33 };
function orderLoop(points, start) {
  const s = LOOP_LEG[start] || 0, n = points.length;
  const pts = points.slice(s).concat(points.slice(0, s));
  const cum = [0];
  for (let i = 1; i <= n; i++) cum.push(cum[i - 1] + pts[i % n].distanceTo(pts[i - 1]));
  const total = cum[n];
  return { pts: pts, phases: [0, cum[11] / total, cum[22] / total, cum[33] / total, 1] };
}

/* ============================================================
   2. 도장 — L / H 원형 표시 (튀어나오듯 등장)
   ============================================================ */
function stampTex(letter, color, sub) {
  const cv = document.createElement("canvas");
  cv.width = 160; cv.height = 160;
  const ctx = cv.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.beginPath(); ctx.arc(80, 80, 72, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 9; ctx.strokeStyle = color; ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = "900 78px " + FONT_STACK;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(letter, 80, sub ? 70 : 84);
  if (sub) { ctx.font = "800 24px " + FONT_STACK; ctx.fillText(sub, 80, 121); }
  const t = setSRGB(new THREE.CanvasTexture(cv));
  t.minFilter = THREE.LinearFilter;
  return t;
}
function easeOutBack(u) { const c = 1.9; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); }
function makeStamp(parent, bucket, letter, color, sub, size, tags, key, view) {
  const mat = new THREE.SpriteMaterial({ map: stampTex(letter, color, sub), transparent: true, depthTest: false, depthWrite: false });
  mat.userData.own = true;
  tagMat(mat, tags);
  const sp = new THREE.Sprite(mat);
  sp.renderOrder = 8;
  parent.add(sp);
  regGrow(bucket, {
    tags: [].concat(tags), key: key, view: view, mat: mat, max: 1, speed: 1 / DUR.short,
    set: function (v) { const s = size * Math.max(0.0001, easeOutBack(Math.min(1, v))); sp.scale.set(s, s, 1); sp.visible = v > 0; }
  });
  return sp;
}

/* ============================================================
   3. 공기 덩어리 — 단면 보기에서 반복 재생
   warm0 : 적도에서 데워져 부풀며 상승 / cold90 : 극에서 식어 줄어들며 하강
   ============================================================ */
const PARCELS = {};
function parcelTex() {
  const cv = document.createElement("canvas");
  cv.width = 128; cv.height = 128;
  const ctx = cv.getContext("2d");
  const g = ctx.createRadialGradient(64, 58, 6, 64, 64, 60);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.55, "rgba(255,255,255,0.92)");
  g.addColorStop(0.8, "rgba(255,255,255,0.45)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  return setSRGB(new THREE.CanvasTexture(cv));
}
/* 공기 덩어리 옆 기호 — 온도계(따뜻함: 빨강·높은 눈금 / 차가움: 파랑·낮은 눈금) + 오르내림 화살표 */
function parcelSignTex(warm) {
  const cv = document.createElement("canvas");
  cv.width = 96; cv.height = 128;
  const ctx = cv.getContext("2d");
  const col = warm ? "#e2503a" : "#2f63c9";
  /* 온도계 */
  ctx.fillStyle = "#ffffff"; ctx.strokeStyle = "#5b6f92"; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(22, 16); ctx.arc(30, 16, 8, Math.PI, 0); ctx.lineTo(38, 84);
  ctx.arc(30, 98, 17, -Math.PI * 0.32, Math.PI * 1.32); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.arc(30, 98, 11, 0, Math.PI * 2); ctx.fill();
  const top = warm ? 22 : 64;
  ctx.fillRect(26, top, 8, 90 - top);
  /* 화살표 ▲(상승) / ▼(하강) */
  ctx.fillStyle = col;
  ctx.beginPath();
  if (warm) { ctx.moveTo(72, 18); ctx.lineTo(90, 46); ctx.lineTo(79, 46); ctx.lineTo(79, 84); ctx.lineTo(65, 84); ctx.lineTo(65, 46); ctx.lineTo(54, 46); }
  else      { ctx.moveTo(72, 110); ctx.lineTo(90, 82); ctx.lineTo(79, 82); ctx.lineTo(79, 44); ctx.lineTo(65, 44); ctx.lineTo(65, 82); ctx.lineTo(54, 82); }
  ctx.closePath(); ctx.fill();
  const t = setSRGB(new THREE.CanvasTexture(cv));
  t.minFilter = THREE.LinearFilter;
  return t;
}
function buildParcels(group) {
  const tex = parcelTex(), signWarm = parcelSignTex(true), signCold = parcelSignTex(false);
  function one(id, lat, up, c0, c1, s0, s1, text, sub) {
    const mat = new THREE.SpriteMaterial({ map: tex, color: new THREE.Color(c0), transparent: true, depthTest: false, depthWrite: false, opacity: 0 });
    const sp = new THREE.Sprite(mat); sp.renderOrder = 9; group.add(sp);
    const lab = makeLabel(text, { sub: sub, fontSize: 28, color: c1, bg: "rgba(255,255,255,0.94)", border: c1 + "88", worldHeight: 0.17, pad: 11, depthTest: false });
    lab.renderOrder = 9; group.add(lab);
    const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: up ? signWarm : signCold, transparent: true, depthTest: false, depthWrite: false, opacity: 0 }));
    sign.scale.set(0.15, 0.2, 1); sign.renderOrder = 9; group.add(sign);
    return { id: id, lat: lat, up: up, sp: sp, lab: lab, sign: sign, c0: new THREE.Color(c0), c1: new THREE.Color(c1), s0: s0, s1: s1, t: 0, a: 0 };
  }
  /* 경로를 따라 움직이는 공기 덩어리 — keys: [[시각 0..1, 위도, 높이 0..1], …] (북반구 기준, 남반구는 위도 뒤집음) */
  function mover(id, hemi, keys, c0, c1, size, text, sub) {
    const mat = new THREE.SpriteMaterial({ map: tex, color: new THREE.Color(c0), transparent: true, depthTest: false, depthWrite: false, opacity: 0 });
    const sp = new THREE.Sprite(mat); sp.renderOrder = 9; group.add(sp);
    let lab = null;
    if (text && hemi > 0) {                                  // 라벨은 북반구에만(화면이 복잡하지 않게)
      lab = makeLabel(text, { sub: sub, fontSize: 26, color: c1, bg: "rgba(255,255,255,0.94)", border: c1 + "88", worldHeight: 0.14, pad: 9, depthTest: false });
      lab.renderOrder = 9; group.add(lab);
    }
    return { id: id, hemi: hemi, keys: keys, sp: sp, lab: lab, sign: null, c0: new THREE.Color(c0), c1: new THREE.Color(c1), s0: size, s1: size, t: 0, a: 0 };
  }
  const SPL = "#f2b35a", SPL1 = "#d9861a";
  /* 2단계: 30°에서 내려온 공기가 지표에서 두 갈래로 — 적도 쪽 / 60° 쪽 */
  PARCELS.split30 = [];
  [1, -1].forEach(h => {
    PARCELS.split30.push(
      mover("split30", h, [[0, 30, 0.6], [0.35, 30, 0.04], [0.92, 7, 0.04]],  SPL, SPL1, 0.16, "적도 쪽으로", null),
      mover("split30", h, [[0, 30, 0.6], [0.35, 30, 0.04], [0.92, 53, 0.04]], SPL, SPL1, 0.16, "60° 쪽으로", null));
  });
  /* 3단계: 30° 쪽에서 온 따뜻한 공기와 극에서 온 차가운 공기가 60°에서 만나 → 따뜻한 공기가 올라탐 */
  PARCELS.front60 = [];
  [1, -1].forEach(h => {
    PARCELS.front60.push(
      mover("front60", h, [[0, 38, 0.04], [0.45, 57, 0.05], [0.95, 66, 0.72]], "#ffb347", "#e2503a", 0.17, "따뜻한 공기", "올라타요"),
      mover("front60", h, [[0, 84, 0.04], [0.5, 63, 0.04], [0.95, 62, 0.06]], "#9cc7ff", "#2f63c9", 0.19, "차가운 공기", "아래로 파고들어요"));
  });
  PARCELS.warm0 = [one("warm0", 0, true, "#ffb347", "#e2503a", 0.13, 0.22, "데워진 공기", "가벼워져 올라가요")];
  PARCELS.cold90 = [
    one("cold90", 86, false, "#9cc7ff", "#2f63c9", 0.21, 0.13, "차가운 공기", "무거워져 내려와요"),
    one("cold90", -86, false, "#9cc7ff", "#2f63c9", 0.21, 0.13, "차가운 공기", "무거워져 내려와요")
  ];
}
const _pc = new THREE.Color();
/* 경로형 공기 덩어리 한 개 갱신 — 한 번 4.2초, 끝나면 처음부터 반복 */
function updateMover(p, dt, vB, vT) {
  if (!REDUCED) p.t = (p.t + dt / 4.2) % 1; else p.t = 0.7;
  const u = p.t, K = p.keys;
  let i = 0;
  while (i < K.length - 2 && u > K[i + 1][0]) i++;
  const a = K[i], b = K[i + 1];
  let f = Math.max(0, Math.min(1, (u - a[0]) / Math.max(1e-4, b[0] - a[0])));
  f = f * f * (3 - 2 * f);
  const lat = (a[1] + (b[1] - a[1]) * f) * p.hemi, h = a[2] + (b[2] - a[2]) * f;
  const x = latToX(clampCross(lat + seasonShift())), y = vB + (vT - vB) * h;
  const fade = Math.min(1, u / 0.1) * Math.min(1, (1 - u) / 0.1);
  p.sp.position.set(x, y, 0.3);
  p.sp.scale.set(p.s0, p.s0, 1);
  p.sp.material.color.copy(_pc.copy(p.c0).lerp(p.c1, u));
  p.sp.material.opacity = 0.95 * fade * p.a;
  p.sp.visible = p.a > 0.01;
  if (p.lab) {
    p.lab.position.set(x, y + p.s0 * 0.5 + 0.13, 0.32);
    p.lab.material.opacity = Math.min(1, fade * 1.4) * p.a;
    p.lab.visible = p.a > 0.01;
  }
}
function updateParcels(dt) {
  const active = state.parcel || [];
  const inCross = state.view === "cross" && !viewTrans.on;
  const vB = GROUND_Y + 0.14, vT = TOP_Y - 0.18;
  for (const id in PARCELS) {
    const on = inCross && active.indexOf(id) >= 0;
    PARCELS[id].forEach(function (p, idx) {
      p.a += ((on ? 1 : 0) - p.a) * Math.min(1, dt * 5);
      if (p.a < 0.01 && !on) { p.a = 0; p.t = 0; }
      if (p.keys) { updateMover(p, dt, vB, vT); return; }
      if (!REDUCED) p.t = (p.t + dt / 3.6) % 1; else p.t = 0.4;   // 움직임 줄이기: 공기층 중간쯤에 멈춘 모습
      const u = p.t;
      const k = Math.min(1, u / 0.7);                          // 부풀거나 줄어드는 정도
      const e = k * k * (3 - 2 * k);
      const y = p.up ? vB + (vT - vB) * e * 0.92 : vT - (vT - vB) * e * 0.92;
      const fade = Math.min(1, u / 0.12) * Math.min(1, (1 - u) / 0.14);
      const x = latToX(clampCross(p.lat + seasonShift())) + (p.up ? 0.22 : (p.lat > 0 ? -0.24 : 0.24));
      const s = p.s0 + (p.s1 - p.s0) * e;
      p.sp.position.set(x, y, 0.3);
      p.sp.scale.set(s, s, 1);
      p.sp.material.color.copy(_pc.copy(p.c0).lerp(p.c1, e));
      p.sp.material.opacity = 0.95 * fade * p.a;
      p.sp.visible = p.a > 0.01;
      const side = p.up ? 1 : (p.lat > 0 ? -1 : 1);          // 라벨이 놓이는 쪽(기호는 반대쪽)
      p.lab.position.set(x + side * 0.4, y + 0.02, 0.32);
      p.lab.material.opacity = Math.min(1, fade * 1.4) * p.a;
      p.lab.visible = p.a > 0.01;
      p.sign.position.set(x, y + s * 0.5 + 0.14, 0.32);     // 공기 덩어리 바로 위 — 옆의 배지·라벨과 겹치지 않게
      p.sign.material.opacity = Math.min(1, fade * 1.4) * p.a;
      p.sign.visible = p.a > 0.01;
    });
  }
}

/* ============================================================
   4. 톱니바퀴 — 순환 고리 가운데에서 회전 (서로 맞물려 반대로 돔)
   ============================================================ */
function gearTex(hex) {
  const cv = document.createElement("canvas");
  cv.width = 160; cv.height = 160;
  const ctx = cv.getContext("2d");
  ctx.translate(80, 80);
  const teeth = 10, rO = 70, rI = 56;
  ctx.beginPath();
  for (let i = 0; i < teeth * 2; i++) {
    const a0 = (i / (teeth * 2)) * Math.PI * 2, a1 = ((i + 1) / (teeth * 2)) * Math.PI * 2;
    const r = i % 2 === 0 ? rO : rI;
    ctx.arc(0, 0, r, a0, a1);
  }
  ctx.closePath();
  ctx.fillStyle = hex + "2e"; ctx.fill();
  ctx.lineWidth = 9; ctx.strokeStyle = hex; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI * 2);
  ctx.fillStyle = hex; ctx.fill();
  /* 회전 방향이 보이도록 바퀴살 */
  ctx.lineWidth = 8; ctx.lineCap = "round"; ctx.strokeStyle = hex;
  for (let i = 0; i < 3; i++) {
    const a = i / 3 * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(Math.cos(a) * 24, Math.sin(a) * 24); ctx.lineTo(Math.cos(a) * 46, Math.sin(a) * 46); ctx.stroke();
  }
  const t = setSRGB(new THREE.CanvasTexture(cv));
  t.minFilter = THREE.LinearFilter;
  return t;
}
const GEARS = [];   // { mat, dir }
function updateGears(dt) {
  if (REDUCED) return;
  for (let i = 0; i < GEARS.length; i++) {
    const fk = GEARS[i].mat.userData.fk;
    if (fk != null && fk < 0.5) continue;               // 강조 밖(흐려진) 톱니바퀴는 멈춤
    GEARS[i].mat.rotation += GEARS[i].dir * dt * 0.9;
  }
}

/* ============================================================
   5. 단면 전환 — 지구본을 세로로 잘라(단면) 대기층을 펼쳐 단면 보기로 ↔ 반대로 감기
   진행 u(0..1):  A 0~.32  카메라 정렬 + 앞쪽 반구를 잘라냄(자른 면 표시)
                  B .32~.52 자른 면을 90° 돌려 북극을 오른쪽으로
                  C .52~.88 대기층(띠)을 곧게 펴 단면 모양으로 + 지구 사라짐
                  D .88~1  단면 보기 등장
   ============================================================ */
const viewTrans = { on: false, dir: 1, u: 0, dur: 3.2, onDone: null, rx0: 0, ry: 0, zG: 0, zX: 0 };
const cut = {};
let cutReady = false;
function smooth01(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }
function span(u, a, b) { return smooth01((u - a) / (b - a)); }

const CUT_RIN = R - 0.13, CUT_ROUT = R + 0.62;     // 자른 면의 지면·대기층 반지름(두께는 과장)
const CUT_NU = 72, CUT_NV = 6;

function stripTex() {
  const cv = document.createElement("canvas");
  cv.width = 512; cv.height = 160;
  const ctx = cv.getContext("2d");
  const groundH = 160 * 0.13 / (CUT_ROUT - CUT_RIN) * 1.0;
  const sg = ctx.createLinearGradient(0, 0, 0, 160);
  sg.addColorStop(0, "#e9f4ff"); sg.addColorStop(0.75, "#f4faff"); sg.addColorStop(1, "#fbfdff");
  ctx.fillStyle = sg; ctx.fillRect(0, 0, 512, 160);
  const gg = ctx.createLinearGradient(0, 160 - groundH, 0, 160);
  gg.addColorStop(0, "#a8cc8e"); gg.addColorStop(1, "#8fb877");
  ctx.fillStyle = gg; ctx.fillRect(0, 160 - groundH, 512, groundH);
  ctx.strokeStyle = "rgba(70,105,160,0.35)"; ctx.lineWidth = 3; ctx.strokeRect(1.5, 1.5, 509, 157);
  return setSRGB(new THREE.CanvasTexture(cv));
}
function capTex() {
  const cv = document.createElement("canvas");
  cv.width = 256; cv.height = 256;
  const ctx = cv.getContext("2d");
  const g = ctx.createRadialGradient(128, 128, 4, 128, 128, 128);
  g.addColorStop(0, "#ffd36b"); g.addColorStop(0.35, "#f0a347"); g.addColorStop(0.62, "#c7743c");
  g.addColorStop(0.9, "#8a5a3a"); g.addColorStop(1, "#5d8a52");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(128, 128, 128, 0, Math.PI * 2); ctx.fill();
  return setSRGB(new THREE.CanvasTexture(cv));
}
function buildCut() {
  if (cutReady) return;
  cut.plane = new THREE.Plane(new THREE.Vector3(0, 0, -1), R * 1.4);
  /* 자른 면(지구 속) — 회전 받침(pivot)에 두어 B 단계에서 지구본과 함께 돎 */
  cut.pivot = new THREE.Group();
  ROOT.add(cut.pivot);
  cut.cap = new THREE.Mesh(new THREE.CircleGeometry(R, 64),
    new THREE.MeshBasicMaterial({ map: capTex(), transparent: true, opacity: 1, depthWrite: true }));
  cut.cap.visible = false;
  cut.pivot.add(cut.cap);
  /* 반대쪽(오른쪽) 반원 대기층 — 펼칠 때 사라짐 */
  cut.ringR = new THREE.Mesh(new THREE.RingGeometry(CUT_RIN + 0.13, CUT_ROUT, 48, 1, -Math.PI / 2, Math.PI),
    new THREE.MeshBasicMaterial({ color: 0xc4defa, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
  cut.ringR.visible = false;
  cut.pivot.add(cut.ringR);
  /* 펼쳐지는 대기층 띠 — 장면 좌표에서 직접 계산 */
  const n = (CUT_NU + 1) * (CUT_NV + 1);
  const pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), idx = [];
  for (let i = 0; i <= CUT_NU; i++) for (let j = 0; j <= CUT_NV; j++) {
    const k = i * (CUT_NV + 1) + j;
    uv[k * 2] = i / CUT_NU; uv[k * 2 + 1] = j / CUT_NV;
    if (i < CUT_NU && j < CUT_NV) {
      const a = k, b = k + CUT_NV + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  cut.strip = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: stripTex(), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
  cut.strip.renderOrder = 6;
  cut.strip.visible = false;
  scene.add(cut.strip);
  cut.label = makeLabel("대기층 (두께는 크게 과장)", { fontSize: 28, color: "#3a5480", bg: "rgba(255,255,255,0.93)", worldHeight: 0.14, pad: 10, depthTest: false });
  cut.tintArc = new THREE.Color(0xc4defa); cut.tintFlat = new THREE.Color(0xffffff);
  cut.label.renderOrder = 9; cut.label.visible = false;
  scene.add(cut.label);
  cutReady = true;
}
/* 띠 꼭짓점: 호(자른 면, 회전각 rho) ↔ 평평한 단면 사이를 m(0..1)로 보간 */
function layoutStrip(rho, m) {
  const pos = cut.strip.geometry.attributes.position.array;
  const cr = Math.cos(rho), sr = Math.sin(rho);
  const yB = GROUND_Y - 0.17, yT = TOP_Y + 0.09;
  for (let i = 0; i <= CUT_NU; i++) {
    const lat = -90 + 180 * i / CUT_NU;
    const th = (180 - lat) * DEG;               // 회전 전: 북극 위, 적도 왼쪽, 남극 아래 (왼쪽 반원)
    const c = Math.cos(th), s = Math.sin(th);
    for (let j = 0; j <= CUT_NV; j++) {
      const v = j / CUT_NV, r = CUT_RIN + (CUT_ROUT - CUT_RIN) * v;
      let ax = r * c, ay = r * s;
      const bx = ax * cr - ay * sr, by = ax * sr + ay * cr;
      const fx = latToX(lat) * 1.04, fy = yB + (yT - yB) * v;
      const k = (i * (CUT_NV + 1) + j) * 3;
      pos[k] = bx + (fx - bx) * m; pos[k + 1] = by + (fy - by) * m; pos[k + 2] = 0.02;
    }
  }
  cut.strip.geometry.attributes.position.needsUpdate = true;
  cut.strip.geometry.computeBoundingSphere();
}
function setGlobeClipping(on) {
  globeGroup.traverse(function (o) {
    if (!o.material) return;
    [].concat(o.material).forEach(function (m) {
      if (m.isShaderMaterial) return;                 // 대기 산란 셰이더는 제외(가장자리 빛만 남음)
      m.clippingPlanes = on ? [cut.plane] : null;
    });
  });
}

/* 보기 전환 시작 — dir +1: 지구본→단면(자르기), -1: 단면→지구본(감기) */
function startViewTransition(dir, onDone) {
  if (viewTrans.on) finishViewTransition();
  buildCut();
  ensureCrossBuilt();
  renderer.localClippingEnabled = true;
  /* 자르기·감기 연출은 각각 처음 한 번만 전체(3.2초), 이후에는 같은 과정을 짧게(1.1초) */
  const first = dir > 0 ? !viewTrans.cutShown : !viewTrans.wrapShown;
  if (dir > 0) viewTrans.cutShown = true; else viewTrans.wrapShown = true;
  viewTrans.dur = first ? 3.2 : 1.1;
  viewTrans.on = true; viewTrans.dir = dir; viewTrans.u = dir > 0 ? 0 : 1;
  viewTrans.onDone = onDone || null;
  viewTrans.rx0 = dir > 0 ? rot.x : 0;
  viewTrans.ry = rot.y;
  viewTrans.zG = fitDist("globe");
  viewTrans.zX = fitDist("cross");
  camAnim.on = false;
  setGlobeClipping(true);
  cut.cap.visible = true; cut.ringR.visible = true; cut.strip.visible = true; cut.label.visible = true;
}
function finishViewTransition() {
  if (!viewTrans.on) return;
  viewTrans.u = viewTrans.dir > 0 ? 1 : 0;
  applyViewTransition();
  endViewTransition();
}
function endViewTransition() {
  viewTrans.on = false;
  setGlobeClipping(false);
  globeGroup.rotation.z = 0; cut.pivot.rotation.z = 0;
  cut.cap.visible = false; cut.ringR.visible = false; cut.strip.visible = false; cut.label.visible = false;
  globeGroup.visible = state.view === "globe";
  crossGroup.visible = state.view === "cross";
  if (viewTrans.dir < 0) { rot.x = 0; rot.y = viewTrans.ry; }
  zoomMul = 1; refitCamera(false);
  const cb = viewTrans.onDone; viewTrans.onDone = null;
  if (cb) cb();
}
function updateViewTransition(dt) {
  if (!viewTrans.on) return;
  viewTrans.u += viewTrans.dir * dt / viewTrans.dur;
  if ((viewTrans.dir > 0 && viewTrans.u >= 1) || (viewTrans.dir < 0 && viewTrans.u <= 0)) {
    viewTrans.u = viewTrans.dir > 0 ? 1 : 0;
    applyViewTransition();
    endViewTransition();
    return;
  }
  applyViewTransition();
}
function applyViewTransition() {
  const u = viewTrans.u;
  const eA = span(u, 0.0, 0.32), eCut = span(u, 0.08, 0.32), eB = span(u, 0.34, 0.52);
  const eC = span(u, 0.54, 0.88), eD = span(u, 0.88, 1.0), eRing = span(u, 0.26, 0.36);

  /* 지구본: 옆에서 보도록 기울기 0으로 + 앞쪽 반구 잘라냄 */
  globeGroup.visible = eC < 0.999;
  globeGroup.rotation.x = viewTrans.rx0 * (1 - eA);
  globeGroup.rotation.y = viewTrans.ry;
  const zc = R * 1.4 * (1 - eCut);
  /* 지구본이 사라진 뒤에는 자르기 해제 — 단면과 같이 쓰는 재질이 잘리지 않게 */
  cut.plane.constant = globeGroup.visible ? zc : 1e3;
  const rc = zc < R ? Math.sqrt(R * R - zc * zc) : 0;
  cut.cap.position.z = Math.min(zc, R) + 0.002;
  cut.cap.scale.setScalar(Math.max(0.0001, rc / R));
  cut.cap.material.opacity = 1 - eC;
  cut.cap.visible = rc > 0.001 && eC < 0.999;

  /* 자른 면을 시계 방향 90° — 북극이 오른쪽, 적도가 위 (지구본은 ZXY 회전 순서라 화면 기준으로 돎) */
  const rho = -Math.PI / 2 * eB;
  globeGroup.rotation.z = rho;
  cut.pivot.rotation.z = rho;

  /* 대기층 띠: 자른 면 둘레(왼쪽 반원) → 곧게 펴짐 */
  cut.ringR.material.opacity = eRing * (1 - span(u, 0.54, 0.66));
  cut.ringR.visible = cut.ringR.material.opacity > 0.01;
  cut.strip.material.opacity = eRing * (1 - eD);
  cut.strip.visible = cut.strip.material.opacity > 0.01;
  if (cut.strip.visible) {
    layoutStrip(rho, eC);
    cut.strip.material.color.copy(cut.tintArc).lerp(cut.tintFlat, eC);   // 자른 면에서는 하늘색 → 펼치면 단면 하늘색
  }
  cut.label.material.opacity = eRing * (1 - span(u, 0.5, 0.6));
  cut.label.visible = cut.label.material.opacity > 0.01;
  cut.label.position.set(-CUT_ROUT + 0.1, CUT_ROUT * 0.72, 0.3);   // 자른 면 왼쪽 위 대기층 옆

  /* 단면 보기: 마지막에 등장 */
  crossGroup.visible = eD > 0.001;

  /* 카메라 거리: 지구본 맞춤 → 단면 맞춤 */
  camZ = viewTrans.zG + (viewTrans.zX - viewTrans.zG) * eC;
  camera.position.set(0, 0, camZ);
}

/* 보기 바꾸기(애니메이션 포함) — 엔진·보기 버튼 공용 */
function changeView(v, onDone) {
  if (state.view === v) { if (onDone) onDone(); return; }
  if (REDUCED) { setView(v); if (onDone) onDone(); return; }
  const dir = v === "cross" ? 1 : -1;
  state.view = v;
  startViewTransition(dir, onDone);
  applyVisibility();
}

/* ============================================================
   6. 그림 자료 — 위도별 에너지 흡수·방출 그래프 (1단계 마지막 장면)
   ============================================================ */
function buildEnergyFigure() {
  const W = 320, H = 190, x0 = 30, x1 = 306, y0 = 150, y1 = 22;
  const X = function (lat) { return x0 + (lat + 90) / 180 * (x1 - x0); };
  const Y = function (v) { return y0 - v * (y0 - y1); };
  const absorb = function (lat) { return 0.08 + 0.86 * Math.pow(Math.cos(lat * DEG), 1.25); };
  const emit = function (lat) { return 0.36 + 0.36 * Math.cos(lat * DEG); };
  let pa = "", pe = "", surplus = "", defN = "", defS = "";
  const pts = [];
  for (let lat = -90; lat <= 90; lat += 2) pts.push(lat);
  pts.forEach(function (lat, i) {
    pa += (i ? "L" : "M") + X(lat).toFixed(1) + " " + Y(absorb(lat)).toFixed(1);
    pe += (i ? "L" : "M") + X(lat).toFixed(1) + " " + Y(emit(lat)).toFixed(1);
  });
  /* 교차 위도(약 ±38°) 찾기 */
  let cross = 0;
  for (let lat = 0; lat <= 90; lat += 0.5) if (absorb(lat) < emit(lat)) { cross = lat; break; }
  function band(a, b, top, bot) {
    let d = "", back = "";
    for (let lat = a; lat <= b + 0.01; lat += 1) {
      d += (d ? "L" : "M") + X(lat).toFixed(1) + " " + Y(top(lat)).toFixed(1);
      back = "L" + X(lat).toFixed(1) + " " + Y(bot(lat)).toFixed(1) + back;
    }
    return d + back + "Z";
  }
  surplus = band(-cross, cross, absorb, emit);
  defN = band(cross, 90, emit, absorb);
  defS = band(-90, -cross, emit, absorb);
  const svg =
    '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="위도별 흡수·방출 에너지 그래프">' +
    '<path d="' + surplus + '" fill="rgba(234,90,61,0.28)"/>' +
    '<path d="' + defN + '" fill="rgba(79,131,219,0.26)"/><path d="' + defS + '" fill="rgba(79,131,219,0.26)"/>' +
    '<line x1="' + x0 + '" y1="' + y0 + '" x2="' + x1 + '" y2="' + y0 + '" stroke="#9aa9c2" stroke-width="1.2"/>' +
    '<path d="' + pa + '" fill="none" stroke="#f08a24" stroke-width="3" stroke-linecap="round"/>' +
    '<path d="' + pe + '" fill="none" stroke="#3a4a66" stroke-width="2.4" stroke-dasharray="6 4" stroke-linecap="round"/>' +
    '<text x="' + X(0) + '" y="' + (Y(0.79) + 5) + '" text-anchor="middle" class="t-hot">에너지 과잉</text>' +
    '<text x="' + X(68) + '" y="' + (Y(0.16)) + '" text-anchor="middle" class="t-cold">부족</text>' +
    '<text x="' + X(-68) + '" y="' + (Y(0.16)) + '" text-anchor="middle" class="t-cold">부족</text>' +
    '<path d="M' + X(14) + ' ' + Y(0.93) + ' L' + X(56) + ' ' + Y(0.93) + '" stroke="#e2503a" stroke-width="3" marker-end="url(#ah)"/>' +
    '<path d="M' + X(-14) + ' ' + Y(0.93) + ' L' + X(-56) + ' ' + Y(0.93) + '" stroke="#e2503a" stroke-width="3" marker-end="url(#ah)"/>' +
    '<text x="' + X(35) + '" y="' + (Y(0.93) - 7) + '" text-anchor="middle" class="t-move">열 이동</text>' +
    '<text x="' + X(-35) + '" y="' + (Y(0.93) - 7) + '" text-anchor="middle" class="t-move">열 이동</text>' +
    '<defs><marker id="ah" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10z" fill="#e2503a"/></marker></defs>' +
    [[-90, "90°S"], [-60, "60°"], [-30, "30°"], [0, "0°"], [30, "30°"], [60, "60°"], [90, "90°N"]].map(function (d) {
      return '<text x="' + X(d[0]) + '" y="' + (y0 + 15) + '" text-anchor="middle" class="t-ax">' + d[1] + "</text>";
    }).join("") +
    "</svg>";
  const el = document.getElementById("fig-energy");
  el.querySelector(".fig-plot").innerHTML = svg;
}
function showFigure(id) {
  document.querySelectorAll(".fig").forEach(function (f) { f.classList.toggle("show", f.dataset.fig === id); });
}

/* ============================================================
   7. 날씨 — 단면 보기(5단계 강수)
   올라가는 곳: 구름이 뭉게뭉게 생긴 뒤 비가 내림 / 내려오는 곳: 구름이 생기다 곧 사라짐
   ============================================================ */
const WX = [];
let _cloudTex = null;
function cloudTexture() {
  if (_cloudTex) return _cloudTex;
  const cv = document.createElement("canvas");
  cv.width = 256; cv.height = 160;
  const ctx = cv.getContext("2d");
  const blobs = [[70, 98, 44], [120, 74, 56], [178, 94, 46], [98, 112, 40], [150, 114, 42], [206, 112, 30], [44, 116, 28]];
  blobs.forEach(b => {
    const g = ctx.createRadialGradient(b[0], b[1] - b[2] * 0.3, b[2] * 0.2, b[0], b[1], b[2]);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.7, "rgba(238,243,250,0.97)");
    g.addColorStop(1, "rgba(214,224,238,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(b[0], b[1], b[2], 0, Math.PI * 2); ctx.fill();
  });
  _cloudTex = setSRGB(new THREE.CanvasTexture(cv));
  return _cloudTex;
}
function wxY() { return GROUND_Y + 1.12; }   // 구름 높이 (GROUND_Y는 cross.js — 실행 시점에 읽음)
function makeRainZone(parent, bucket, x) {
  const cm = tagMat(new THREE.SpriteMaterial({ map: cloudTexture(), color: 0xeef3fa, transparent: true, depthWrite: false }), "wet");
  cm.userData.own = true;
  const cloud = new THREE.Sprite(cm);
  cloud.position.set(x, wxY(), 0.16); cloud.renderOrder = 7;
  parent.add(cloud);
  const N = 24, drops = [];
  for (let i = 0; i < N; i++) drops.push({ dx: (Math.random() * 2 - 1) * 0.17, ph: Math.random(), sp: 0.9 + Math.random() * 0.5 });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N * 6), 3));
  const lm = tagMat(new THREE.LineBasicMaterial({ color: 0x2f74e0, transparent: true, opacity: 0.85, depthWrite: false }), "wet");
  lm.userData.own = true;
  const lines = new THREE.LineSegments(geo, lm);
  lines.frustumCulled = false; lines.renderOrder = 6;
  parent.add(lines);
  const g = regGrow(bucket, {
    tags: ["wet"], key: "precip", view: "cross", mat: cm, max: 1, speed: 1 / DUR.long,
    set: function (v) { const s = smooth01(v); cloud.scale.set(0.56 * s + 1e-4, 0.35 * s + 1e-4, 1); cloud.visible = v > 0; }
  });
  WX.push({ kind: "rain", x: x, drops: drops, geo: geo, lines: lines, g: g });
}
function makeDryZone(parent, x) {
  const pm = tagMat(new THREE.SpriteMaterial({ map: cloudTexture(), color: 0xffffff, transparent: true, depthWrite: false }), "dry");
  pm.userData.own = true;
  const puffs = [0, 0.5].map(ph => {
    const sp = new THREE.Sprite(pm); sp.renderOrder = 7; parent.add(sp);
    return { sp: sp, ph: ph };
  });
  WX.push({ kind: "dry", x: x, puffs: puffs });
}
function updateWeather(dt, t) {
  if (!crossGroup.visible || !WX.length) return;
  const yTop = wxY() - 0.1, yBot = GROUND_Y + 0.03;
  for (let i = 0; i < WX.length; i++) {
    const w = WX[i];
    if (w.kind === "rain") {
      if (w.lines.material.userData.fk != null && w.lines.material.userData.fk < 0.5) continue;   // 강조 밖이면 멈춤
      /* 구름이 거의 다 생긴 뒤부터 빗줄기가 늘어남 */
      const amt = Math.max(0, Math.min(1, (w.g.cur - 0.55) / 0.45));
      const n = Math.round(w.drops.length * amt);
      const a = w.geo.attributes.position.array;
      for (let k = 0; k < n; k++) {
        const d = w.drops[k];
        const u = REDUCED ? d.ph : (d.ph + t * 0.55 * d.sp) % 1;
        const y = yTop - u * (yTop - yBot), x = w.x + d.dx;
        a[k * 6] = x; a[k * 6 + 1] = y; a[k * 6 + 2] = 0.14;
        a[k * 6 + 3] = x - 0.012; a[k * 6 + 4] = y - 0.07; a[k * 6 + 5] = 0.14;
      }
      w.geo.setDrawRange(0, n * 2);
      w.geo.attributes.position.needsUpdate = true;
    } else {
      /* 생기다가 곧 줄어들며 사라지는 구름(공기가 내려오며 데워짐) */
      w.puffs.forEach(p => {
        const u = REDUCED ? 0.45 : (t * 0.3 + p.ph) % 1;
        const s = u < 0.18 ? u / 0.18 : Math.max(0, (1 - u) / 0.82);
        p.sp.scale.set(0.4 * s + 1e-4, 0.25 * s + 1e-4, 1);
        p.sp.position.set(w.x + (p.ph - 0.25) * 0.26, wxY() - u * 0.22, 0.16);
      });
    }
  }
}

/* ============================================================
   8. 그림 자료 — 지구의 공전과 자전축 기울기(23.5°) (8단계)
   북반구 여름(7월 무렵): 북극 쪽이 태양을 향함 → 태양이 북회귀선 쪽을 가장 높이 비춤
   계절 이동 애니메이션에 맞춰 지구가 궤도를 따라 움직임
   ============================================================ */
const ORB = { cx: 160, cy: 92, rx: 118, ry: 50, er: 14, tilt: 23.5 };
function orbitPos(s) {
  /* s: -1(1월, 오른쪽) · 0(춘·추분, 앞쪽) · 1(7월, 왼쪽) */
  const a = (90 + s * 90) * DEG;
  return { x: ORB.cx + ORB.rx * Math.cos(a), y: ORB.cy + ORB.ry * Math.sin(a) };
}
function buildOrbitFigure() {
  const el = document.getElementById("fig-orbit");
  if (!el) return;
  const t = ORB.tilt * DEG, ax = Math.sin(t) * 24, ay = Math.cos(t) * 24;
  const pJ = orbitPos(1), pD = orbitPos(-1), pE = orbitPos(0);
  el.querySelector(".fig-plot").innerHTML =
    '<svg viewBox="0 0 320 172" role="img" aria-label="지구의 공전과 자전축 기울기">' +
    '<defs><radialGradient id="sunG"><stop offset="0" stop-color="#fff3b0"/><stop offset="0.6" stop-color="#ffc21a"/><stop offset="1" stop-color="#f59e0b"/></radialGradient></defs>' +
    '<ellipse cx="' + ORB.cx + '" cy="' + ORB.cy + '" rx="' + ORB.rx + '" ry="' + ORB.ry + '" fill="none" stroke="#9aa9c2" stroke-width="1.4" stroke-dasharray="5 4"/>' +
    '<circle cx="' + ORB.cx + '" cy="' + ORB.cy + '" r="19" fill="url(#sunG)"/>' +
    '<text x="' + ORB.cx + '" y="' + (ORB.cy + 4) + '" text-anchor="middle" class="t-sun">태양</text>' +
    '<text x="' + pJ.x + '" y="' + (pJ.y - 34) + '" text-anchor="middle" class="t-m">7월 무렵</text>' +
    '<text x="' + pJ.x + '" y="' + (pJ.y + 42) + '" text-anchor="middle" class="t-s">북반구 여름</text>' +
    '<text x="' + pD.x + '" y="' + (pD.y - 34) + '" text-anchor="middle" class="t-m">1월 무렵</text>' +
    '<text x="' + pD.x + '" y="' + (pD.y + 42) + '" text-anchor="middle" class="t-s">북반구 겨울</text>' +
    '<text x="' + (pE.x + 58) + '" y="' + (pE.y + 4) + '" text-anchor="start" class="t-s">춘분·추분 무렵</text>' +
    '<g id="orb-earth">' +
      '<line id="orb-ray" x1="' + ORB.cx + '" y1="' + ORB.cy + '" x2="0" y2="0" stroke="#f5b400" stroke-width="2.4" stroke-dasharray="4 3"/>' +
      '<circle id="orb-e" r="' + ORB.er + '" fill="#3f83e8" stroke="#1d4f9a" stroke-width="1.5"/>' +
      '<path id="orb-night" fill="rgba(15,30,60,0.55)"/>' +
      '<line id="orb-eq" stroke="#ffffff" stroke-width="1.3" stroke-opacity="0.85"/>' +
      '<line id="orb-axis" stroke="#1f2d45" stroke-width="2" stroke-linecap="round"/>' +
      '<text id="orb-n" class="t-n" text-anchor="middle">N</text>' +
    '</g>' +
    '</svg>';
  updateOrbitFigure();
}
function updateOrbitFigure() {
  const root = document.getElementById("fig-orbit");
  if (!root || !root.querySelector("#orb-e")) return;
  const s = state.seasonCur, p = orbitPos(s), er = ORB.er;
  const t = ORB.tilt * DEG, ax = Math.sin(t), ay = Math.cos(t);
  const q = function (id) { return root.querySelector(id); };
  q("#orb-e").setAttribute("cx", p.x.toFixed(1)); q("#orb-e").setAttribute("cy", p.y.toFixed(1));
  q("#orb-ray").setAttribute("x2", p.x.toFixed(1)); q("#orb-ray").setAttribute("y2", p.y.toFixed(1));
  /* 자전축: 북쪽이 늘 오른쪽 위로 23.5° 기울어짐(공간에서 방향 고정) */
  q("#orb-axis").setAttribute("x1", (p.x - ax * 24).toFixed(1)); q("#orb-axis").setAttribute("y1", (p.y + ay * 24).toFixed(1));
  q("#orb-axis").setAttribute("x2", (p.x + ax * 24).toFixed(1)); q("#orb-axis").setAttribute("y2", (p.y - ay * 24).toFixed(1));
  q("#orb-eq").setAttribute("x1", (p.x - ay * er).toFixed(1)); q("#orb-eq").setAttribute("y1", (p.y - ax * er).toFixed(1));
  q("#orb-eq").setAttribute("x2", (p.x + ay * er).toFixed(1)); q("#orb-eq").setAttribute("y2", (p.y + ax * er).toFixed(1));
  q("#orb-n").setAttribute("x", (p.x + ax * 31).toFixed(1)); q("#orb-n").setAttribute("y", (p.y - ay * 31 + 3).toFixed(1));
  /* 밤 쪽 반원 — 태양 반대편 */
  const ang = Math.atan2(ORB.cy - p.y, ORB.cx - p.x);
  const a0 = ang + Math.PI / 2, a1 = ang - Math.PI / 2;
  q("#orb-night").setAttribute("d",
    "M" + (p.x + er * Math.cos(a0)).toFixed(1) + " " + (p.y + er * Math.sin(a0)).toFixed(1) +
    " A" + er + " " + er + " 0 0 1 " + (p.x + er * Math.cos(a1)).toFixed(1) + " " + (p.y + er * Math.sin(a1)).toFixed(1) + "Z");
  const lat = Math.round(Math.abs(s) * 23.5 * 2) / 2;          // 0.5° 단위 (끝은 23.5°)
  const cap = root.querySelector(".fig-note");
  if (cap) cap.innerHTML = fmtKo("태양이 가장 높이 뜨는 위도: <b>" + (lat === 0 ? "적도(0°)" : lat + "°" + (s > 0 ? "N" : "S")) + "</b>"
    + (lat === 23.5 ? (s > 0 ? " (북회귀선)" : " (남회귀선)") : ""));
}
