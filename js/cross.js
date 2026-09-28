/* ============================================================
   대기대순환 3D — cross.js
   공기 흐름 단면 보기 — 남극(좌) ~ 적도 ~ 북극(우)
   ============================================================ */
"use strict";

/* ============================================================
   8. 공기 흐름 단면 보기 구성
   좌: 남극(-90) — 중앙: 적도 — 우: 북극(+90)
   ============================================================ */
const XW = 2.45;
const GROUND_Y = -1.1;
const TOP_Y = 1.0;
function latToX(lat) { return (lat / 90) * XW; }
/* 단면은 계절 이동 때 극 쪽 요소가 가장자리 너머(최대 약 96°)까지 밀려도 그대로 그림 —
   이동 중(평행 이동)과 이동 뒤(다시 만들기)의 모습이 같도록 */
const CROSS_LAT_MAX = 99;
function clampCross(l) { return Math.max(-CROSS_LAT_MAX, Math.min(CROSS_LAT_MAX, l)); }

const cross = {};
let crossReady = false;

function ensureCrossBuilt() {
  if (crossReady) return;
  buildCrossBase();
  crossReady = true;
  applyVisibility();
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
  cross.fx      = new THREE.Group(); crossGroup.add(cross.fx);     // 공기 덩어리 등 장면 효과
  regFadeGroup(cross.belts, "belts");
  regFadeGroup(cross.cells, "cells");
  regFadeGroup(cross.winds, "windsX");
  regFadeGroup(cross.precip, "precip");
  regFadeGroup(cross.grid, "grid");

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

  buildParcels(cross.fx);
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
  const bucket = growBucket("crossBelts");
  const sh = seasonShift();
  const defs = [
    { lat: 0,   arr: "rise0", tag: "belt0", colMat: MAT.colEq,    arrMat: MAT.rise0,  up: true,  z: ZONES.eq,    main: "공기 올라감", sub: "저압대 L" },
    { lat: 30,  arr: "sink30", tag: "belt30", colMat: MAT.colSub,   arrMat: MAT.sink30, up: false, z: ZONES.sub,   main: "공기 내려감", sub: "고압대 H" },
    { lat: -30, arr: "sink30", tag: "belt30", colMat: MAT.colSub,   arrMat: MAT.sink30, up: false, z: ZONES.sub,   main: "공기 내려감", sub: "고압대 H" },
    { lat: 60,  arr: "rise60", tag: "belt60", colMat: MAT.colFront, arrMat: MAT.rise60, up: true,  z: ZONES.front, main: "공기 올라감", sub: "저압대 L" },
    { lat: -60, arr: "rise60", tag: "belt60", colMat: MAT.colFront, arrMat: MAT.rise60, up: true,  z: ZONES.front, main: "공기 올라감", sub: "저압대 L" },
    { lat: 86,  arr: "sink90", tag: "belt90", colMat: MAT.colPole,  arrMat: MAT.sink90, up: false, z: ZONES.pole,  main: "공기 내려감", sub: "고압대 H" },
    { lat: -86, arr: "sink90", tag: "belt90", colMat: MAT.colPole,  arrMat: MAT.sink90, up: false, z: ZONES.pole,  main: "공기 내려감", sub: "고압대 H" }
  ];
  defs.forEach(d => {
    const lat = d.lat + sh;
    if (lat > CROSS_LAT_MAX || lat < -CROSS_LAT_MAX) return;
    const x = latToX(lat);

    // 기둥(은은한 색 배경)
    const colH = TOP_Y - GROUND_Y - 0.06;
    const col = new THREE.Mesh(new THREE.PlaneGeometry(0.34, colH), d.colMat);
    col.position.set(x, GROUND_Y + colH / 2 + 0.02, -0.03);
    cross.belts.add(col);

    // 상승·하강 공기 흐름 띠 — 셰브론이 위(상승)·아래(하강)로 흐르는 반투명 띠.
    // 등장할 때 아래→위(상승) / 위→아래(하강)로 늘어남
    makeFlowBand(cross.belts, bucket, x, d.up, d.arrMat, d.arr);

    // 지표의 기압 도장 — L(저기압) / H(고기압), 초록 지면 띠 위에 표시
    makeStamp(cross.belts, bucket, d.up ? "L" : "H", d.up ? "#e2503a" : "#2f63c9", d.up ? "저기압" : "고기압",
      0.25, [d.up ? "stamp-L" : "stamp-H", d.tag], "belts", "cross").position.set(x, GROUND_Y - 0.075, 0.2);

    // 바닥 배지: 쉬운 말 (교과 용어 저압대/고압대는 지면의 L·H 도장과 설명 카드에서)
    const badge = makeLabel(d.main, {
      fontSize: 33, color: "#" + new THREE.Color(d.z.color).getHexString(),
      bg: "rgba(255,255,255,0.95)", border: d.z.color + "88", worldHeight: 0.17, pad: 15
    });
    tagMat(badge.material, d.tag);
    badge.position.set(x, GROUND_Y + 0.30, 0.1);
    cross.belts.add(badge);

    // 위 라벨: 현재 위도(계절 이동 시 숫자가 함께 변함)
    const latTxt = Math.abs(d.lat) >= 86
      ? (d.lat > 0 ? "북극 부근" : "남극 부근")
      : Math.abs(Math.round(lat)) + "°" + (lat > 0.5 ? "N" : (lat < -0.5 ? "S" : ""));
    const ll = makeLabel(latTxt, { fontSize: 30, color: "#3a5480", halo: "rgba(255,255,255,0.9)", worldHeight: 0.085 });
    tagMat(ll.material, d.tag);
    ll.position.set(x, TOP_Y + 0.12, 0.03);
    cross.belts.add(ll);
  });
}

/* 단면 상승·하강 흐름 띠 (그리기 grow 대상: 태그 rise0·sink30…) */
function makeFlowBand(parent, bucket, x, up, mat, tag) {
  const yB = GROUND_Y + 0.14, yT = GROUND_Y + 1.14, len = yT - yB, w = 0.2;
  const band = new THREE.Mesh(new THREE.PlaneGeometry(w, len), mat);
  band.renderOrder = 1;
  parent.add(band);
  regGrow(bucket, {
    tags: [tag], key: "belts", view: "cross", mat: mat, max: 1, speed: 1 / DUR.base,
    set: function (v) {
      const e = Math.max(0.001, v);
      band.scale.y = e;
      band.position.set(x, up ? yB + len * e / 2 : yT - len * e / 2, 0.012);
      band.visible = v > 0;
    }
  });
}

/* 단면: 공기의 큰 순환(고리 화살표 + 흐름 줄무늬 + 이름표) */
/* 순환 고리를 그리기 시작하는 구간 — 수업 이야기 순서
   해들리: 적도 상승부터 / 페렐: 30°→60° 지표부터 / 극: 극 하강부터 */
const CELL_START = { hadley: "rise", ferrel: "ground", polar: "sink" };
function buildCrossCells() {
  disposeGroup(cross.cells);
  const bucket = growBucket("crossCells");
  GEARS.length = 0;
  const sh = seasonShift();
  const uv = roundedLoopUV(0.16);
  const vB = GROUND_Y + 0.13, vT = TOP_Y - 0.15;

  CELLS.forEach(c => {
    /* 위도별 층후 — 순환 상층 높이와 튜브 굵기를 함께 차등 */
    const cT = vB + (vT - vB) * c.top;
    const headR = Math.max(c.tubeX * 2.6, 0.040);
    const headL = Math.max(c.tubeX * 5.4, 0.088);
    [1, -1].forEach(hemi => {
      const latRise = clampCross(c.rise * hemi + sh);
      const latSink = clampCross(c.sink * hemi + sh);
      if (Math.abs(latRise - latSink) < 8) return;
      const inset = 0.09;
      const xR = latToX(latRise) + (latToX(latSink) > latToX(latRise) ? inset : -inset);
      const xS = latToX(latSink) + (latToX(latSink) > latToX(latRise) ? -inset : inset);
      const pts = uv.map(p => new THREE.Vector3(
        xS + (xR - xS) * p[0],
        vB + (cT - vB) * p[1],
        0
      ));
      /* 고리가 선을 긋듯 그려짐 — 구간(phase) 1: 첫 구간 … 4: 한 바퀴 완성 (steps.js의 draw 값) */
      const ol = orderLoop(pts, CELL_START[c.id]);
      /* 기온 색: 단면 x → 위도(계절 이동량 제외), y → 공기층 안의 높이 */
      makeGrowPath(cross.cells, bucket, {
        points: ol.pts, closed: true, phases: ol.phases, tubeR: c.tubeX, headR: headR, headL: headL,
        mat: MAT["cell_" + c.id], tags: ["cell-" + c.id], key: "cells", view: "cross", speed: 1 / DUR.base,
        latAlt: (x, y) => [x / XW * 90 - sh, (y - GROUND_Y) / (TOP_Y - GROUND_Y)]
      });
      /* 방향은 관 표면의 흐르는 줄무늬로 표시(흐름 점 없음) */

      // 톱니바퀴 — 이웃한 고리는 서로 반대 방향으로 돎 (북반구: 해들리·극 시계, 페렐 반시계)
      const gm = new THREE.SpriteMaterial({ map: gearTex(c.color), transparent: true, opacity: 0.95, depthWrite: false });
      gm.userData.own = true;
      tagMat(gm, ["gear", "cell-" + c.id]);
      const gear = new THREE.Sprite(gm);
      const gs = { hadley: 0.3, ferrel: 0.26, polar: 0.22 }[c.id];
      gear.scale.set(gs, gs, 1);
      gear.position.set((xR + xS) / 2, (vB + cT) / 2, 0.05);
      cross.cells.add(gear);
      GEARS.push({ mat: gm, dir: (c.id === "ferrel" ? 1 : -1) * hemi });

      // 이름표(북반구 쪽에만 — 과밀 방지)
      if (hemi > 0) {
        const lab = makeLabel(c.name, {
          sub: c.range, fontSize: 34, color: "#" + new THREE.Color(c.color).getHexString(),
          bg: "rgba(255,255,255,0.95)", border: c.color + "77", worldHeight: 0.155, pad: 14
        });
        tagMat(lab.material, "cell-" + c.id);
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
  const tpLine = new THREE.Line(tpGeo, tagMat(new THREE.LineDashedMaterial({
    color: 0x6b7fa3, dashSize: 0.07, gapSize: 0.05, transparent: true, opacity: 0.7
  }), "tropo"));
  tpLine.computeLineDistances();
  cross.cells.add(tpLine);
  const tpLab = makeLabel("공기층의 높이 — 적도는 두껍고, 극으로 갈수록 얇아요", {
    fontSize: 26, color: "#5b6f92", halo: "rgba(255,255,255,0.92)", worldHeight: 0.078, minPx: 12
  });
  tagMat(tpLab.material, "tropo");
  tpLab.position.set(latToX(-58), vB + (vT - vB) * (topP + (topH - topP) * 0.5) + 0.2, 0.05);   // 해들리 고리와 겹치지 않게 왼쪽(남쪽 중위도) 점선 위
  cross.cells.add(tpLab);
}

/* 단면: 땅 가까이 부는 바람(지면 화살표) */
function buildCrossWinds() {
  disposeGroup(cross.winds);
  const sh = seasonShift();
  /* 지표 바로 위를 따라 부는 바람 — 기압 배지(GROUND_Y+0.30)와 겹치지 않게 지면에 붙이고,
     바람 이름은 초록 지면 띠 안에 표시 */
  const y = GROUND_Y + 0.055;
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
    cross.winds.add(new THREE.Mesh(ar.geom, MAT["windX_" + d.b.id]));
    if (d.latC > 0) {
      const l = makeLabel(d.b.name, {
        fontSize: 30, color: d.b.color, bg: "rgba(255,255,255,0.93)",
        border: d.b.color + "66", worldHeight: 0.105, pad: 12
      });
      tagMat(l.material, ["winds", "wind-" + d.b.id]);
      l.position.set(x, GROUND_Y - 0.085, 0.08);
      cross.winds.add(l);
    }
  });
}

/* 단면: 비 많은 곳 / 건조한 곳(아이콘) */
function buildCrossPrecip() {
  disposeGroup(cross.precip);
  const bucket = growBucket("crossWx");
  WX.length = 0;
  const sh = seasonShift();
  /* 구름과 비(effects.js 7절) — 올라가는 곳은 구름→비, 내려오는 곳은 구름이 곧 사라짐 */
  [0, 60, -60].forEach(lat => { const x = latToX(lat + sh); if (x > -XW && x < XW) makeRainZone(cross.precip, bucket, x); });
  [30, -30, 86, -86].forEach(lat => { const l = lat + sh; if (l < CROSS_LAT_MAX && l > -CROSS_LAT_MAX) makeDryZone(cross.precip, latToX(l)); });
  function icon(lat, mat, yy, sc) {
    const x = latToX(lat + sh);
    if (Math.abs(x) > latToX(CROSS_LAT_MAX)) return;
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
  /* 태양이 가장 높이 뜨는 위도로 떨어지는 세로 빛줄기(계절 이동 때 함께 움직임) */
  const bcv = document.createElement("canvas");
  bcv.width = 8; bcv.height = 128;
  const bctx = bcv.getContext("2d");
  const bg = bctx.createLinearGradient(0, 0, 0, 128);
  bg.addColorStop(0, "rgba(255,206,70,0.62)"); bg.addColorStop(0.6, "rgba(255,206,70,0.32)"); bg.addColorStop(1, "rgba(255,206,70,0.12)");
  bctx.fillStyle = bg; bctx.fillRect(0, 0, 8, 128);
  const beamMat = new THREE.MeshBasicMaterial({ map: setSRGB(new THREE.CanvasTexture(bcv)), transparent: true, depthWrite: false });
  beamMat.userData.own = true;
  const beamH = TOP_Y - 0.02 - GROUND_Y;   // 공기층 안쪽만(위쪽 위도 숫자 라벨을 가리지 않게)
  cross.sunBeam = new THREE.Mesh(new THREE.PlaneGeometry(0.46, beamH), beamMat);
  cross.sunBeam.renderOrder = -1;
  cross.sunG.add(cross.sunBeam);
  cross.sun = makeSunDisc(0.16);
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
  const x = latToX(state.seasonCur * 23.5);   // 태양이 가장 높이 뜨는 위도(계절 이동 중 연속으로)
  cross.sun.position.set(x, TOP_Y + 0.4, 0.1);          // 위도 숫자 라벨(TOP_Y+0.12) 위쪽
  const beamH = TOP_Y - 0.02 - GROUND_Y;   // 공기층 안쪽만(위쪽 위도 숫자 라벨을 가리지 않게)
  cross.sunBeam.position.set(x, GROUND_Y + beamH / 2, -0.045);   // 순환 고리 뒤쪽에 은은하게
  cross.sunLabel.position.set(x + 0.62, TOP_Y + 0.4, 0.12);   // 태양 오른쪽 옆 (위도 라벨과 겹치지 않게)
  cross.sunLabel.visible = Math.abs(state.seasonCur) > 0.02;
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
    if (lat > CROSS_LAT_MAX || lat < -CROSS_LAT_MAX) return;
    const geo = new THREE.PlaneGeometry(d.w, TOP_Y - GROUND_Y + 0.5);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(latToX(lat), (TOP_Y + GROUND_Y) / 2, 0.2);
    m.userData.zone = d.z;
    m.userData.hemi = d.lat >= 0 ? 1 : -1;
    cross.pickers.add(m);
  });
}
