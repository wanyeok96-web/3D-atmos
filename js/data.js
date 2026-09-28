/* ============================================================
   대기대순환 3D — data.js
   색 · 위도대 카드 · 순환/바람 정의 · 레이어 목록
   ============================================================ */
"use strict";

const COL = {
  heat:  "#ea5a3d",   // 적도(공기 올라감)
  arid:  "#dc9a2e",   // 30°(공기 내려감·건조)
  front: "#23967f",   // 60°(공기 다시 올라감)
  cold:  "#4f83db",   // 극(찬 공기 내려감)
  rise:  "#e2503a",   // 상승 화살표
  sink:  "#3b6fd8",   // 하강 화살표
  wet:   "#3f83e8",
  dry:   "#e0a23a",
  windTrade: "#0fb3a3",   // 무역풍 — 적도(빨강)·30°(주황) 띠 위에서도 구분되는 청록
  windWest:  "#7048e8",
  windPolar: "#d6336c",
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
  },
  /* 계절에 따라 두 기압대의 영향을 번갈아 받는 곳 (8단계 지역 마커로 열림) */
  savanna: {
    id: "savanna", lat: 15, color: "#b7791f",
    title: "10°~20° 부근 — 우기와 건기가 번갈아", term: "사바나 기후",
    move:   "계절에 따라 기압대가 남북으로 이동해 <b>여름</b>에는 적도 저압대, <b>겨울</b>에는 아열대 고압대의 영향을 받습니다.",
    rain:   "여름에는 비가 많이 내리는 <b>우기</b>, 겨울에는 건조한 <b>건기</b>가 나타납니다.",
    region: "아프리카 사바나, 브라질 고원, 오스트레일리아 북부 — <b>사바나 기후</b>",
    sum:    "기압대가 계절에 따라 이동하면 우기와 건기가 번갈아 나타납니다."
  },
  med: {
    id: "med", lat: 35, color: "#8e44ad",
    title: "30°~40° 대륙 서안 — 여름 건조, 겨울 비", term: "지중해성 기후",
    move:   "<b>여름</b>에는 북쪽으로 올라온 아열대 고압대, <b>겨울</b>에는 편서풍대의 영향을 받습니다.",
    rain:   "여름에는 공기가 내려와 <b>맑고 건조</b>하고, 겨울에는 편서풍과 전선의 영향으로 <b>비</b>가 옵니다.",
    region: "지중해 연안, 미국 캘리포니아, 칠레 중부 — <b>지중해성 기후</b>",
    sum:    "여름 건조·겨울 습윤은 기압대가 계절에 따라 이동하기 때문입니다."
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

/* 지상 바람대 — dLon: 휘어짐(전향력)으로 바뀌는 경도 (+ 동쪽 / − 서쪽으로 휨)
   무역풍·극동풍은 서쪽으로(편동풍), 편서풍은 동쪽으로 휨 */
const WIND_BANDS = [
  { id: "trade",  name: "무역풍",  from: 27, to: 7,  dLon: -46, n: 5, lonOff: 0,  color: COL.windTrade },
  { id: "wester", name: "편서풍",  from: 33, to: 55, dLon:  48, n: 5, lonOff: 20, color: COL.windWest  },
  { id: "polar",  name: "극동풍",  from: 80, to: 64, dLon: -36, n: 4, lonOff: 10, color: COL.windPolar }
];

/* 대표 지역 마커 (위도, 경도 — 동경 +, 서경 −) — 7단계 등에서 장면별로 표시 */
const REGION_TYPES = {
  rf:     { tag: "rg-rf",     color: "#1f9d55", climate: "열대 우림 기후" },
  desert: { tag: "rg-desert", color: "#d9861a", climate: "사막 기후" },
  marine: { tag: "rg-marine", color: "#1f8fa6", climate: "서안 해양성 기후" },
  savanna:{ tag: "rg-savanna",color: "#b7791f", climate: "사바나 기후" },
  med:    { tag: "rg-med",    color: "#8e44ad", climate: "지중해성 기후" }
};
const REGIONS = [
  { id: "amazon",  type: "rf",     name: "아마존 분지",        lat: -4,  lon: -62, zone: "eq" },
  { id: "congo",   type: "rf",     name: "콩고 분지",          lat: 0,   lon: 22,  zone: "eq" },
  { id: "indo",    type: "rf",     name: "인도네시아",          lat: -1,  lon: 114, zone: "eq" },
  { id: "sahara",  type: "desert", name: "사하라 사막",        lat: 23,  lon: 10,  zone: "sub" },
  { id: "arabia",  type: "desert", name: "아라비아반도",        lat: 23,  lon: 46,  zone: "sub" },
  { id: "aus",     type: "desert", name: "오스트레일리아 내륙", lat: -25, lon: 132, zone: "sub" },
  { id: "weurope", type: "marine", name: "서유럽",            lat: 50,  lon: 2,   zone: "front" },
  { id: "afsav",   type: "savanna", name: "아프리카 사바나",    lat: 10,  lon: 22,  zone: "savanna" },
  { id: "brazil",  type: "savanna", name: "브라질 고원",        lat: -14, lon: -48, zone: "savanna" },
  { id: "naus",    type: "savanna", name: "오스트레일리아 북부", lat: -16, lon: 134, zone: "savanna" },
  { id: "medsea",  type: "med",    name: "지중해 연안",        lat: 39,  lon: 14,  zone: "med" },
  { id: "calif",   type: "med",    name: "캘리포니아",          lat: 36,  lon: -120, zone: "med" },
  { id: "chile",   type: "med",    name: "칠레 중부",           lat: -33, lon: -71, zone: "med" }
];
/* 평소에는 숨기고, 장면의 show 목록에 있을 때만 보이는 요소 */
const OPTIONAL_TAGS = ["spin", "sunlat", "front60", "rg-rf", "rg-desert", "rg-marine", "rg-savanna", "rg-med"];

const LAYER_DEFS = [
  { id: "insol",    name: "햇빛과 기온",           sub: "위도별 일사 — 열적 불균형", color: "#f6a821" },
  { id: "cells",    name: "공기의 큰 순환",        sub: "해들리·페렐·극 순환",       color: COL.cellH },
  { id: "belts",    name: "오르내리는 공기 띠",    sub: "기압대",                    color: COL.arid },
  { id: "winds",    name: "땅 가까이 부는 바람",   sub: "무역풍·편서풍·극동풍",      color: COL.windTrade },
  { id: "coriolis", name: "바람 휘어짐",           sub: "전향력 — 지구 자전 때문",   color: COL.windWest },
  { id: "precip",   name: "비 많은 곳 / 건조한 곳", sub: "강수 분포",                color: COL.wet },
  { id: "grid",     name: "위도·경도선",           sub: "0°·30°·60° 위도 확인",      color: "#8ea3c4" }
];
