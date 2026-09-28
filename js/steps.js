/* ============================================================
   대기대순환 3D — steps.js
   이해 순서(수업 시나리오) — 8단계 × 장면(beat)
   ※ 자막·질문·답 문구를 고칠 때는 이 파일만 수정하면 됩니다.
   ============================================================ */
"use strict";

/* ------------------------------------------------------------
   작성 방법
   STEPS[i] = {
     title : 단계 제목(패널 목록)
     short : 짧은 제목(화면 자막 위 작은 글씨)
     body  : 패널에 보이는 단계 전체 설명(교사용 요약)
     base  : 단계 시작 상태 — 이후 장면은 여기에 "바뀌는 것만" 덧붙임
     beats : 장면 목록 — 한 번 누를 때마다 한 장면씩 진행
   }
   장면(beat)에 쓸 수 있는 항목 (적지 않으면 앞 장면 상태 유지)
     cap      : 화면 자막 (한두 문장, <b>굵게</b> 가능)
     view     : "globe"(지구 전체) | "cross"(공기 흐름 단면)
     layers   : 표시할 내용 켜기/끄기 — insol·cells·belts·winds·coriolis·precip·grid
     focus    : 강조할 대상(나머지는 흐리게) — null이면 강조 없음
     hide     : 숨길 대상 — 장면에서 아직 등장하지 않은 요소
     pressure : 지구본에 저기압 L / 고기압 H 표시
     season   : 계절 — -1(1월) · 0(춘·추분) · 1(7월)  (앞으로 진행하면 기압대가 서서히 이동)
     cam      : 카메라 — 지구본 { rx: 위아래 기울기, ry: 좌우 회전, z: 거리 배율 } / 단면 { z }
     q, a     : 생각해 볼 질문과 답 — 이 장면에서 자동 재생이 멈춤, [답 보기]로 답 표시
     draw     : 그리기 진행도 — 순환 고리는 0~4 구간(1구간씩 그려짐), 적지 않으면 끝까지
                예) { "cell-hadley": 2 } → 적도 상승 + 상층 흐름까지만
                (해들리: 상승→상층→하강→지표 / 극: 하강→지표→상승→상층 / 페렐: 지표→상승→상층→하강)
     parcel   : 공기 덩어리 애니메이션 — ["warm0"] 적도 상승 / ["cold90"] 극 하강 / ["split30"] 30°에서 두 갈래 / ["front60"] 60°에서 만남 / [] 없음
     fig      : 그림 자료 — "energy"(위도별 에너지 과잉·부족 그래프) · "orbit"(공전과 자전축 기울기) / null
     show     : 평소 숨겨 둔 요소 보이기 — "spin"(지구 자전 표시) · "sunlat"(태양이 가장 높이 뜨는 위도·회귀선)
                · "rg-rf"(열대 우림) · "rg-desert"(사막) · "rg-marine"(서안 해양성) · "rg-savanna"(사바나) · "rg-med"(지중해성) 지역
                (다음 장면에서도 유지되며, show: [] 로 다시 숨김)
   강조·숨김 대상 이름
     순환 고리   cell-hadley · cell-ferrel · cell-polar
     기압대      belt0(적도) · belt30 · belt60 · belt90(극)
     상승·하강   rise0 · rise60 · sink30 · sink90   (단면 보기의 굵은 화살표)
     바람        winds(전체) · wind-trade · wind-wester · wind-polar
     강수        wet(비 많음) · dry(건조)
     햇빛        ray(태양 광선) · beam-hot/beam-cold(햇빛 다발) · patch-hot/patch-cold(입사 면적) · temp(기온 색)
     이름표      name-hadley · name-ferrel · name-polar (단면 순환 고리 이름)
     전선        front60 (한대 전선 — show로 보이게)
     기타        tropo(공기층 높이 점선) · gear(톱니바퀴) · stamp-L · stamp-H(지표 기압 도장)
     지역 마커   rg-rf · rg-desert · rg-marine   /  자전 표시  spin
   ------------------------------------------------------------ */

const ALL_OFF = { insol:false, cells:false, belts:false, winds:false, coriolis:false, precip:false, grid:false };
function layersOf(on) { return Object.assign({}, ALL_OFF, on); }

/* 지구본 좌우 회전(ry) — 화면 정면에 오는 지역 */
const CAM_AMERICA = -0.55;   // 남아메리카·대서양 (기본)
const CAM_AFRICA  = -1.83;   // 아프리카(사하라)·아라비아
const CAM_EUROPE  = -1.57;   // 서유럽·지중해

/* 단면에서 저위도만 먼저 보여줄 때 숨길 요소 */
const HIDE_MID_HIGH = ["belt30", "sink30", "belt60", "rise60", "belt90", "sink90", "cell-ferrel", "cell-polar"];
/* 2~3단계에서는 아직 등장하지 않는 요소 — L/H 도장(4단계), 톱니바퀴(3단계 끝) */
const HIDE_LATER = ["stamp-L", "stamp-H", "gear"];
/* 순환 고리 이름표 — 고리가 완성되는 장면에서 이름이 나타나도록 그 전에는 숨김 */
const NAMES = ["name-hadley", "name-ferrel", "name-polar"];

const STEPS = [
  /* ---------------------------------------------------------- 1 */
  { title: "대기대순환이란? — 위도별 일사량과 열적 불균형", short: "위도별 일사량과 열적 불균형",
    body: "지구는 둥글기 때문에 위도에 따라 태양 에너지를 받는 <b>면적이 다릅니다</b>. 적도는 <b>좁은 면적에 에너지가 집중</b>되어 기온이 높고, 극지방은 <b>넓은 면적으로 분산</b>되어 기온이 낮습니다. 이 <b>열적 불균형</b>을 해소하는 지구 규모의 공기 흐름이 <b>대기대순환</b>입니다.",
    base: { view: "globe", layers: layersOf({ insol: true, grid: true }), focus: null,
            hide: ["beam-hot", "beam-cold", "patch-hot", "patch-cold", "temp"],
            pressure: false, season: 0, cam: { rx: 0.12, ry: -0.55, z: 1.00 } },
    beats: [
      { cap: "지구는 태양 에너지를 받아요. 햇빛은 아주 먼 곳에서 와서 <b>거의 평행하게</b> 도착해요.",
        focus: ["ray"] },
      { cap: "같은 굵기의 햇빛 다발을 <b>적도</b>에 비추면, 거의 수직으로 닿아 <b>좁은 면적</b>에 에너지가 모여요.",
        hide: ["beam-cold", "patch-cold", "temp"], focus: ["beam-hot", "patch-hot"] },
      { cap: "같은 햇빛이 <b>위도 60°</b>에는 비스듬히 닿아 약 <b>2배 넓은 면적</b>에 퍼져요. 에너지가 그만큼 분산돼요.",
        hide: ["temp"], focus: ["beam-cold", "patch-cold"] },
      { cap: "그래서 적도는 기온이 높고 극지방은 기온이 낮아요. 이 차이를 <b>열적 불균형</b>이라고 해요.",
        hide: [], focus: ["temp", "patch-hot", "patch-cold"] },
      { cap: "저위도는 에너지가 남고(<b>과잉</b>), 고위도는 모자라요(<b>부족</b>). 남는 열은 극 쪽으로 옮겨져야 해요.",
        focus: null, fig: "energy",
        q: "적도에는 열이 남고 극지방에는 열이 모자라요. 지구는 이 불균형을 어떻게 해소할까요?",
        a: "대기(바람)와 바다(해류)가 적도의 열을 극지방으로 옮겨요. 그중 지구 전체를 도는 큰 공기의 흐름이 바로 <b>대기대순환</b>이에요." }
    ] },

  /* ---------------------------------------------------------- 2 */
  { title: "저위도 지역의 공기 흐름", short: "저위도의 공기 흐름 — 해들리 순환",
    body: "적도는 기온이 높아 데워진 공기가 <b>위로 올라갑니다</b>. 올라간 공기는 일정한 높이에서 <b>남북으로 퍼지고</b>, <b>위도 30° 부근에서 다시 내려와</b> 지표에서 두 갈래로 흩어집니다. 적도 쪽으로 돌아가는 고리가 <b>해들리 순환</b>이고, 일부는 <b>60° 쪽</b>으로 흘러갑니다.",
    base: { view: "cross", layers: layersOf({ grid: true }), focus: null, hide: HIDE_MID_HIGH.concat(HIDE_LATER, NAMES),
            pressure: false, season: 0, cam: { z: 1 } },
    beats: [
      { cap: "지구를 세로로 잘라 옆에서 본 모습이에요. <b>왼쪽은 남극, 가운데는 적도, 오른쪽은 북극</b>이에요." },
      { cap: "적도 부근은 햇빛을 많이 받아 공기가 데워져요. 데워진 공기는 가벼워져 <b>위로 올라가요</b>.",
        layers: { belts: true }, focus: ["belt0", "rise0"], parcel: ["warm0"] },
      { cap: "올라간 공기는 일정한 높이(점선)에 이르면 더 올라가지 못하고 <b>남북 양쪽으로 퍼져 나가요</b>.",
        layers: { cells: true }, draw: { "cell-hadley": 2 }, focus: ["cell-hadley", "tropo"], parcel: [] },
      { cap: "퍼져 나간 공기는 식으면서 <b>위도 30° 부근에서 다시 내려와요</b>.",
        hide: ["belt60", "rise60", "belt90", "sink90", "cell-ferrel", "cell-polar"].concat(HIDE_LATER, NAMES),
        draw: { "cell-hadley": 3 }, focus: ["cell-hadley", "belt30", "sink30"] },
      { cap: "내려온 공기는 지표에서 <b>두 갈래</b>로 퍼져요. 일부는 적도 쪽으로, 일부는 <b>60° 쪽</b>으로 흘러가요.",
        hide: ["belt60", "rise60", "belt90", "sink90", "cell-polar"].concat(HIDE_LATER, NAMES),
        draw: { "cell-hadley": 4, "cell-ferrel": 1 }, focus: ["cell-hadley", "cell-ferrel", "belt30"], parcel: ["split30"] },
      { cap: "적도 쪽으로 돌아간 공기가 고리를 이루어요. 이것이 <b>해들리 순환</b>이에요.",
        hide: ["belt60", "rise60", "belt90", "sink90", "cell-polar", "name-ferrel", "name-polar"].concat(HIDE_LATER),
        focus: ["cell-hadley"], parcel: [] },
      { cap: "적도에서 올라가고 30°에서 내려오는 고리가 남반구와 북반구에 하나씩 생겼어요.",
        focus: null,
        q: "올라간 공기는 왜 우주로 나가지 않고 위도 30° 부근에서 다시 내려올까요?",
        a: "공기는 올라갈수록 식고, 공기층(대류권)의 꼭대기에 막혀 더 올라가지 못해요. 옆으로 퍼져 나가던 공기가 식어 무거워지면서 30° 부근에서 내려와요." }
    ] },

  /* ---------------------------------------------------------- 3 */
  { title: "고위도 지역의 공기 흐름", short: "고위도의 공기 흐름 — 극 순환과 페렐 순환",
    body: "극지방의 차가운 공기는 <b>아래로 내려와</b> 지표를 따라 <b>위도 60° 부근</b>으로 퍼집니다. 30° 쪽에서 온 따뜻한 공기와 60°에서 만나 따뜻한 공기가 <b>올라가고</b>(한대 전선), 위에서 다시 갈라져 극 쪽으로는 <b>극 순환</b>, 30° 쪽으로는 <b>페렐 순환</b>이 만들어집니다.",
    base: { view: "cross", layers: layersOf({ grid: true, belts: true, cells: true }), focus: null,
            hide: ["belt60", "rise60", "belt90", "sink90", "cell-polar", "name-ferrel", "name-polar"].concat(HIDE_LATER),
            draw: { "cell-ferrel": 1 }, pressure: false, season: 0, cam: { z: 1 } },
    beats: [
      { cap: "극지방은 햇빛을 적게 받아 공기가 차가워요. 차갑고 무거운 공기는 <b>아래로 내려와요</b>.",
        focus: ["belt90", "sink90"], parcel: ["cold90"] },
      { cap: "내려온 공기는 땅을 따라 <b>60° 쪽</b>으로 퍼져요. 30°에서 온 공기도 60° 쪽으로 오고 있어요.",
        hide: ["belt60", "rise60", "name-ferrel", "name-polar"].concat(HIDE_LATER), draw: { "cell-polar": 2 },
        focus: ["cell-polar", "cell-ferrel", "belt90", "sink90"], parcel: [] },
      { cap: "두 공기가 <b>60° 부근에서 만나요</b>. 따뜻한 공기가 찬 공기 위로 올라타요 — <b>한대 전선</b>이에요.",
        hide: ["rise60", "name-ferrel", "name-polar"].concat(HIDE_LATER), show: ["front60"],
        focus: ["front60", "belt60", "cell-polar", "cell-ferrel"], parcel: ["front60"] },
      { cap: "그래서 60° 부근에서는 공기가 <b>위로 올라가요</b>.",
        hide: ["name-ferrel", "name-polar"].concat(HIDE_LATER), draw: { "cell-polar": 3, "cell-ferrel": 2 },
        focus: ["cell-polar", "cell-ferrel", "belt60", "rise60", "front60"], parcel: [] },
      { cap: "올라간 공기는 위에서 다시 갈라져요. 극 쪽으로 돌아가는 고리가 <b>극 순환</b>이에요.",
        hide: ["name-ferrel"].concat(HIDE_LATER), draw: { "cell-polar": 4, "cell-ferrel": 3 },
        focus: ["cell-polar", "cell-ferrel"] },
      { cap: "30° 쪽으로 온 공기는 해들리 순환과 함께 내려와요. 이 고리가 <b>페렐 순환</b>이에요.",
        hide: HIDE_LATER, draw: { "cell-ferrel": 4 }, focus: ["cell-ferrel", "cell-hadley", "belt30", "sink30"] },
      { cap: "세 고리는 <b>톱니바퀴처럼 맞물려</b> 돌아요. 이웃한 고리끼리는 도는 방향이 서로 반대예요.",
        hide: ["stamp-L", "stamp-H"], focus: null,
        q: "위도 60° 부근에서 공기가 다시 올라가는 까닭은 무엇일까요?",
        a: "극지방에서 온 <b>차가운 공기</b>와 저위도에서 온 <b>따뜻한 공기</b>가 만나면, 가벼운 따뜻한 공기가 찬 공기를 타고 올라가요. 이 경계를 <b>한대 전선</b>이라고 해요." }
    ] },

  /* ---------------------------------------------------------- 4 */
  { title: "대기대순환 시스템의 형성", short: "3개의 순환과 기압대",
    body: "저위도와 고위도의 공기 흐름이 이어져 <b>3개의 순환</b>(해들리·페렐·극 순환)이 만들어집니다. 공기가 <b>올라가는 적도와 60°</b>의 지표에는 <b>저기압(L)</b>이, 공기가 <b>내려오는 30°와 극지방</b>의 지표에는 <b>고기압(H)</b>이 나타납니다.",
    base: { view: "cross", layers: layersOf({ grid: true, belts: true, cells: true }), focus: null, hide: ["stamp-L", "stamp-H"],
            pressure: false, season: 0, cam: { z: 1 } },
    beats: [
      { cap: "해들리·페렐·극 순환 — <b>3개의 고리</b>가 이어져 지구 전체의 공기 흐름을 만들어요." },
      { cap: "공기가 <b>올라가는</b> 적도와 60° 부근의 지표는 공기가 적어져 <b>저기압(L)</b>이 돼요.",
        hide: ["stamp-H"], focus: ["stamp-L", "belt0", "belt60", "rise0", "rise60"] },
      { cap: "공기가 <b>내려오는</b> 30°와 극지방의 지표는 공기가 쌓여 <b>고기압(H)</b>이 돼요.",
        hide: [], focus: ["stamp-H", "belt30", "belt90", "sink30", "sink90"] },
      { cap: "단면을 다시 지구에 감아 보면, 기압대가 <b>띠 모양</b>으로 지구를 둘러싸요.",
        view: "globe", focus: null, pressure: true, cam: { rx: 0.38, ry: -0.55, z: 1.03 } },
      { cap: "적도 저압대 · 아열대 고압대 · 한대 전선대(고위도 저압대) · 극 고압대가 번갈아 나타나요.",
        cam: { rx: 0.22, z: 0.98 },
        q: "공기가 올라가는 곳과 내려오는 곳의 지표 기압은 왜 달라질까요?",
        a: "공기가 올라가면 지표를 누르는 공기가 줄어 기압이 <b>낮아지고</b>(저기압), 공기가 내려오면 지표에 공기가 쌓여 기압이 <b>높아져요</b>(고기압)." }
    ] },

  /* ---------------------------------------------------------- 5 */
  { title: "강수 — 저기압은 비, 고기압은 맑음", short: "기압대와 강수",
    body: "공기가 <b>올라가는 곳(저기압)</b>에서는 공기가 식으며 구름이 만들어져 <b>비가 많이</b> 내립니다. 공기가 <b>내려오는 곳(고기압)</b>에서는 구름이 생기기 어려워 <b>맑고 건조</b>합니다.",
    base: { view: "cross", layers: layersOf({ grid: true, belts: true, cells: true, precip: true }), focus: null,
            hide: ["dry", "gear"], pressure: true, season: 0, cam: { z: 1 } },
    beats: [
      { cap: "공기가 올라가면 점점 식어요. 식은 공기 속 수증기가 작은 물방울로 바뀌어 <b>구름</b>이 생겨요.",
        draw: { "wet": 0.55 }, focus: ["wet", "belt0", "belt60", "rise0", "rise60"] },
      { cap: "구름 속 물방울이 커지면 <b>비</b>가 되어 내려요. 그래서 공기가 올라가는 곳은 <b>비가 많아요</b>.",
        draw: { "wet": 1 } },
      { cap: "공기가 내려오는 곳은 공기가 데워져서 구름이 생겨도 곧 사라져요. 그래서 <b>맑고 건조</b>해요.",
        hide: ["gear"], focus: ["dry", "belt30", "belt90", "sink30", "sink90"] },
      { cap: "지구 전체로 보면 — 적도와 60° 부근은 <b>비가 많고</b>, 30°와 극지방은 <b>건조</b>해요.",
        view: "globe", layers: { cells: false }, focus: null, cam: { rx: 0.28, ry: -0.55, z: 0.97 } },
      { cap: "위도 30° 부근에 <b>사하라 사막·아라비아반도·오스트레일리아 내륙</b> 같은 큰 사막이 모여 있어요.",
        cam: { rx: 0.35, ry: CAM_AFRICA, z: 0.95 }, show: ["rg-desert"], focus: ["dry", "belt30", "rg-desert"],
        q: "적도 부근에는 열대 우림이, 위도 30° 부근에는 사막이 많은 이유는 무엇일까요?",
        a: "적도는 공기가 올라가는 <b>적도 저압대</b>라 1년 내내 비가 많아요. 30° 부근은 공기가 내려오는 <b>아열대 고압대</b>라 비가 적어 사막이 돼요." }
    ] },

  /* ---------------------------------------------------------- 6 */
  { title: "바람 — 무역풍·편서풍·극동풍", short: "지표의 바람",
    body: "지표에서 공기는 <b>고기압에서 저기압으로</b> 이동합니다. 지구 자전 때문에 바람 방향이 <b>휘어지면서</b>(전향력), 30°→적도의 <b>무역풍</b>, 30°→60°의 <b>편서풍</b>, 극→60°의 <b>극동풍</b>이 나타납니다.",
    base: { view: "globe", layers: layersOf({ belts: true, winds: true, coriolis: false }), focus: null, hide: [],
            pressure: true, season: 0, cam: { rx: 0.20, ry: -0.55, z: 0.93 } },
    beats: [
      { cap: "바람은 고기압(H)에서 저기압(L)으로 불어요. 지구가 돌지 않는다면 <b>남북으로 곧게</b> 불겠지요." },
      { cap: "그런데 지구는 서쪽에서 동쪽으로 <b>자전</b>하고 있어요. 그래서 움직이는 공기의 방향이 휘어져요.",
        show: ["spin"], focus: ["spin"], cam: { rx: 0.55, z: 0.95 } },
      { cap: "바람은 <b>북반구는 오른쪽, 남반구는 왼쪽</b>으로 휘어져요. 이 힘을 <b>전향력</b>이라고 해요.",
        layers: { coriolis: true }, focus: ["winds"], cam: { rx: 0.20, z: 0.93 } },
      { cap: "30°에서 적도로 부는 바람 — <b>무역풍</b>. 북반구에서는 북동쪽, 남반구에서는 남동쪽에서 불어와요.",
        show: [], focus: ["wind-trade", "belt0", "belt30"] },
      { cap: "30°에서 60°로 부는 바람 — <b>편서풍</b>. 서쪽에서 불어오며, 우리나라도 편서풍의 영향을 받아요.",
        focus: ["wind-wester", "belt30", "belt60"], cam: { rx: 0.45, z: 0.95 } },
      { cap: "극에서 60°로 부는 바람 — <b>극동풍</b>. 동쪽에서 불어와요.",
        focus: ["wind-polar", "belt60", "belt90"], cam: { rx: 0.75, z: 0.95 } },
      { cap: "왼쪽 패널에서 <b>바람 휘어짐</b>을 껐다 켜면 바람이 곧게 폈다가 다시 휘어져요.",
        focus: null, cam: { rx: 0.20, z: 0.93 },
        q: "바람 휘어짐(전향력)이 없다면 바람의 방향은 어떻게 달라질까요?",
        a: "바람은 고기압에서 저기압을 향해 <b>남북 방향으로 곧게</b> 불었을 거예요. 지구 자전 때문에 휘어져 동서 방향 성분을 가진 무역풍·편서풍·극동풍이 돼요." }
    ] },

  /* ---------------------------------------------------------- 7 */
  { title: "결론 — 대기대순환과 위도별 기후", short: "대기대순환과 세계의 기후",
    body: "위도별 <b>일사량 차이</b> → <b>열적 불균형</b> → <b>대기대순환</b> → 위도대별 <b>기압·강수·바람</b>의 차이 → 위도대별로 <b>다양한 기후</b>가 나타납니다. 지역 마커나 색깔 띠를 눌러 위도대별 기후를 확인해 보세요.",
    base: { view: "globe", layers: layersOf({ cells: true, belts: true, winds: true, coriolis: true, precip: true }),
            focus: null, hide: [], pressure: true, season: 0, cam: { rx: 0.44, ry: -0.55, z: 1.06 } },
    beats: [
      { cap: "일사량 차이 → 열적 불균형 → <b>대기대순환</b> → 기압·강수·바람의 차이" },
      { cap: "<b>적도 저압대</b> — 1년 내내 비가 많아 <b>열대 우림 기후</b> (아마존 분지·콩고 분지·인도네시아)",
        show: ["rg-rf"], focus: ["belt0", "wet", "rg-rf"], cam: { rx: 0.10, z: 0.95 } },
      { cap: "<b>아열대 고압대</b> — 건조해 <b>사막 기후</b> (사하라 사막·아라비아반도·오스트레일리아 내륙)",
        show: ["rg-desert"], focus: ["belt30", "dry", "rg-desert"], cam: { rx: 0.30, ry: CAM_AFRICA, z: 0.95 } },
      { cap: "<b>편서풍대</b>의 대륙 서안 — 바다에서 부는 편서풍으로 온화하고 습한 <b>서안 해양성 기후</b> (서유럽)",
        show: ["rg-marine"], focus: ["belt60", "wind-wester", "rg-marine"], cam: { rx: 0.60, ry: CAM_EUROPE, z: 0.95 } },
      { cap: "<b>지역 마커</b>나 <b>색깔 띠</b>를 누르면 그 위도대의 기후 설명 카드가 나타나요.",
        layers: { cells: false, winds: false, precip: false },     // 정리 장면: 기압대·L/H·지역 마커만 남겨 깔끔하게
        show: ["rg-rf", "rg-desert", "rg-marine"], focus: null, cam: { rx: 0.40, ry: CAM_AFRICA, z: 1.04 },
        q: "대기대순환을 알면 세계의 기후 분포를 어떻게 설명할 수 있을까요?",
        a: "위도에 따라 공기가 <b>오르내리는 방향</b>과 부는 바람이 정해져요. 그래서 비가 많은 곳·건조한 곳과 여러 기후가 위도를 따라 <b>띠 모양</b>으로 나타나요." }
    ] },

  /* ---------------------------------------------------------- 8 */
  { title: "계절에 따른 기압대의 이동", short: "계절에 따른 기압대 이동",
    body: "지구의 자전축이 <b>23.5°</b> 기울어진 채 공전하기 때문에, 태양이 가장 높이 뜨는 위도가 계절에 따라 남북으로 이동하고 <b>기압대와 바람대도 함께 이동</b>합니다. 그래서 두 기압대의 영향을 번갈아 받는 곳에서는 <b>사바나 기후</b>(우기·건기)와 <b>지중해성 기후</b>(여름 건조·겨울 비)가 나타납니다.",
    base: { view: "cross", layers: layersOf({ grid: true, belts: true, winds: true, coriolis: true, precip: true }), focus: null, hide: ["gear"],
            pressure: true, season: 0, fig: "orbit", cam: { z: 1 } },
    beats: [
      { cap: "지구는 자전축이 <b>23.5° 기울어진 채</b> 공전해요. 춘분·추분에는 태양이 <b>적도</b>를 가장 높이 비춰요." },
      { cap: "북반구 여름(<b>7월</b>)에는 태양이 북쪽을 가장 높이 비춰요. 기압대와 바람대도 <b>북쪽으로 이동</b>해요.",
        season: 1 },
      { cap: "북반구 겨울(<b>1월</b>)에는 태양이 남쪽을 가장 높이 비춰요. 기압대와 바람대도 <b>남쪽으로 이동</b>해요.",
        season: -1 },
      { cap: "위도 10°~20°의 사바나 지역은 <b>여름</b>에 올라온 <b>적도 저압대</b>의 영향으로 비가 많아요(우기).",
        view: "globe", season: 1, layers: { winds: false, grid: false }, show: ["sunlat", "rg-savanna"],
        focus: ["belt0", "wet", "rg-savanna", "sunlat"], cam: { rx: 0.18, ry: CAM_AFRICA, z: 0.95 } },
      { cap: "<b>겨울</b>에는 아열대 고압대가 내려와 건조해요(건기). 우기와 건기가 뚜렷한 <b>사바나 기후</b>예요.",
        season: -1, focus: ["belt30", "dry", "rg-savanna", "sunlat"] },
      { cap: "지중해 연안(30°~40° 대륙 서안)은 <b>여름</b>에 올라온 <b>아열대 고압대</b>의 영향으로 맑고 건조해요.",
        season: 1, show: ["sunlat", "rg-med"], focus: ["belt30", "dry", "rg-med", "sunlat"], cam: { rx: 0.45, ry: CAM_EUROPE, z: 0.95 } },
      { cap: "<b>겨울</b>에는 기압대가 내려가 편서풍과 전선의 영향으로 비가 와요. 여름 건조·겨울 비 — <b>지중해성 기후</b>",
        season: -1, focus: ["belt60", "wet", "rg-med", "sunlat"] },
      { cap: "기압대가 계절에 따라 이동해서, 같은 곳도 계절마다 날씨가 달라요. <b>지역 마커</b>를 눌러 보세요.",
        season: 0, layers: { precip: false }, show: ["sunlat", "rg-savanna", "rg-med"], focus: null, cam: { rx: 0.3, ry: CAM_AFRICA, z: 1.02 },
        q: "지중해 연안은 왜 여름에 비가 적고 건조할까요?",
        a: "여름에는 북쪽으로 올라온 <b>아열대 고압대</b>에서 공기가 내려와 구름이 생기기 어려워요. 겨울에는 <b>편서풍</b>과 전선의 영향으로 비가 와요." }
    ] }
];
