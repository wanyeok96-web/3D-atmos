# 대기대순환 3D — 작업일지 · 인수인계 (HANDOFF)

> **이 파일을 먼저 읽고 작업을 이어가세요.** Claude Code, Cursor, ChatGPT 등 어떤 도구로 작업하든 이 파일 하나로 현재 상태·규칙·다음 할 일을 파악할 수 있도록 정리했습니다.
> 작업을 마칠 때마다 맨 아래 **「7. 작업 기록」**에 한 줄 이상 추가해 주세요.

- 마지막 갱신: 2026-09-28 (Claude Code) — **5절 개편 13개 항목 모두 완료 (A·B-1·C·B-2)**
- 사용자: 고등학교 교사 (통합사회·한국지리·세계지리). **보고·설명은 한국어로**.
- 개편 전 원본 백업: 옆 폴더 `대기대순환 3D_백업_개편전`
- 배포본: 옆 폴더의 `대기대순환3D_배포.zip` (작업 후 다시 만들어야 최신이 됨)
- **GitHub**: https://github.com/wanyeok96-web/3D-atmos (main 브랜치). 작업을 마치면 커밋·푸시하고 7절에 기록.

---

## 1. 프로젝트 한눈에 보기

수업용 3D 대기대순환 교구. **선생님이 한 번 누를 때마다 자막 한두 문장 + 그에 맞는 애니메이션 한 장면**이 진행된다. 8단계 · 46장면.

| 단계 | 내용 | 보기 |
|---|---|---|
| 1 | 위도별 일사량(빛기둥·입사 면적)·기온 색·에너지 과잉/부족 그래프 | 지구본 |
| 2 | 지구본을 잘라 단면으로 펼침 → 해들리 순환이 구간별로 그려짐, 데워진 공기 덩어리 상승 | 단면 |
| 3 | 극 순환 → 페렐 순환 → 톱니바퀴처럼 맞물림 | 단면 |
| 4 | L/H 도장 → 단면을 다시 지구에 감기 | 단면→지구본 |
| 5 | 구름 생성→비 / 구름 소멸(건조) → 사막 마커 | 단면→지구본 |
| 6 | 곧은 바람 → 자전 표시 → 바람이 휘어지는 모핑(전향력) | 지구본 |
| 7 | 열대 우림·사막·서안 해양성 지역 마커 → 카드 | 지구본 |
| 8 | 공전·자전축 23.5° 그림, 기압대 연속 계절 이동, 사바나·지중해성 | 단면→지구본 |

### 절대 지켜야 할 제약
1. **index.html 더블클릭(file://)으로 실행**되어야 함 → **ES 모듈·빌드 도구·외부 CDN·외부 통신 금지.** 일반 `<script>`를 순서대로 불러옴.
2. file://에서는 이미지·글꼴 파일을 WebGL/캔버스가 못 읽는 경우가 있음 → **이미지·글꼴은 data URI(JS 파일)로 내장** (예: `assets/earth-texture.js`).
3. Three.js는 `libs/three.min.js` (r160, UMD 전역 `THREE`).
4. 코드 주석·UI 문구는 **한국어**, 기존 코드 스타일(주석 밀도·명명) 유지.
5. 교과 수준: 통합사회·지리. 지구과학 전문 용어는 피하고 쉬운 말 + 교과 용어 병기.
6. 수업 진행은 **클릭할 때마다 한 장면**(자동 재생은 선택). 음성(TTS) 불필요.
7. 자막 문구는 AI가 초안 → **선생님 검토**.

---

## 2. 파일 구조와 로드 순서

```
index.html          ← 스크립트 로드 순서가 중요 (아래)
style.css
교사용_안내.html     ← 교사용 인쇄 안내
README.md           ← 사용자용 기능 설명 + 개편 이력
HANDOFF.md          ← 이 파일
assets/earth-texture.js   window.EARTH_TEXTURE_DATA (NASA Blue Marble 2048×1024, data URI)
assets/fonts/aocsans.css  앱 글꼴 AocSans @font-face (data URI, woff2 약 440KB) — Pretendard(OFL) 추림본
assets/fonts/OFL.txt      글꼴 라이선스 전문 (배포 시 반드시 함께)
libs/three.min.js
js/
  data.js     색(COL)·위도대 카드(ZONES)·순환(CELLS)·바람(WIND_BANDS)·지역(REGIONS, REGION_TYPES)·OPTIONAL_TAGS·LAYER_DEFS
  steps.js    ★ 수업 시나리오 STEPS (8단계 × 장면). 자막·질문·답은 여기만 수정. 파일 머리 주석에 작성법
  core.js     렌더러·조명·state·유틸(latLonToVec, makeLabel, arrowGeom…)·표시 관리(페이드/강조/숨김)·공유 재질·3D 태양
  effects.js  그리기(grow)·도장·공기 덩어리·톱니바퀴·단면 전환(cut)·에너지 그래프·날씨(구름·비)·공전 그림
  globe.js    지구본: 텍스처·구름·기압대·순환·바람(모핑)·일사(빛기둥)·자전 표시·지역 마커·회귀선
  cross.js    단면 보기: 기둥·상승/하강 화살표·L/H 도장·순환 고리·톱니·바람·강수·태양
  view.js     applyVisibility·계절 재생성/계절 애니메이션·카메라(맞춤·줌·flyTo)·입력·클릭→카드
  ui.js       레이어 목록·보기 전환 버튼·사이드바/모바일 시트·계절 슬라이더(숨김)·단계 목록
  engine.js   장면 재생기(beatState/goBeat)·자막·진행 점·자동 재생·속도·키보드·발표 모드·#단계-장면 주소
  main.js     resize·보이는 영역 맞춤(viewInset)·렌더 루프·저사양 보호·init
```

**로드 순서**: `(CSS: aocsans.css → style.css)` `three → earth-texture → data → steps → core → effects → globe → cross → view → ui → engine → main`
- main.js는 **글꼴(AocSans)을 불러온 뒤 init()** 실행(`whenFontsReady`, 최대 1.5초 대기) — 캔버스 라벨이 내장 글꼴로 그려지도록.

- 모든 파일이 **전역 스코프를 공유**(classic script). 최상위 `const/let`은 다른 파일에서도 보임.
- ⚠️ **TDZ 주의**: 파일 **최상위에서 즉시 실행되는 코드**가 뒤에 로드되는 파일의 `const`를 참조하면 오류. (예: effects.js에서 `GROUND_Y`(cross.js) 사용 → 함수 안에서만 사용. engine.js의 `$`는 정의 전에 쓰지 말 것.) 함수 선언은 호출 시점에만 참조하므로 괜찮음.
- core.js에서 준비 실패 시 `fatal()` 후 `throw` → `APP_FAILED`.

---

## 3. 핵심 구조 (수정 전 반드시 이해)

### 3-1. 상태 `state` (core.js)
`view`("globe"|"cross"), `layers`{insol,cells,belts,winds,coriolis,precip,grid}, `stepIndex`, `beatIndex`, `focus`(강조 태그 배열|null), `hide`(숨김 태그), `showPressure`, `season`(목표 −1..1), `seasonCur`(화면에 보이는 값), `draw`(그리기 진행도), `parcel`(공기 덩어리 id 배열).

### 3-2. 장면 엔진 (engine.js)
- `beatState(i,k)` = 단계 `base` + 1..k 장면 변경분 **누적** → 앞뒤 이동해도 정확히 복원.
- `goBeat(i,k)`: `forward`(한 장면 앞으로)일 때만 애니메이션, 아니면 `snapGrows()`·`snapWinds()`·계절 즉시.
- 보기가 바뀌면 `changeView()` → 단면 자르기/감기 전환(`startViewTransition`), 끝난 뒤 카메라 이동.
- 장면 필드: `cap, view, layers, focus, hide, pressure, season, cam{rx,ry,z}, q, a, draw, parcel, fig, show` (steps.js 머리 주석 참고).
- `show`: 기본 숨김 요소(OPTIONAL_TAGS: spin, sunlat, rg-*)를 보이게. 다음 장면에도 유지, `show: []`로 숨김.

### 3-3. 표시 관리 (core.js 4절) — 페이드·강조·숨김
- 레이어 그룹을 `regFadeGroup(group, key)`로 등록, `defFade(key, want)`로 보일 조건 정의.
- 재질에 `tagMat(mat, tags)`로 태그 → `state.focus`(강조, 나머지 0.13) / `state.hide`(0).
- 매 프레임 `updateFades`: 재질 투명도 = 원래 × 레이어 a × 강조 계수. **그룹이 새로 만들어지면 `sweepFadeMats()`** (applyVisibility가 호출).
- 태그 목록은 steps.js 머리 주석에 정리됨 (cell-hadley, belt0, rise0, wind-trade, wet, ray, beam-hot, temp, tropo, gear, stamp-L, rg-desert, sunlat …).
- 흐름 점 재질은 `dotMat(tags)`로 태그별 생성(공유 재질 쓰면 숨김이 안 먹음).
- 지구본 레이어 그룹은 `renderOrder`(그룹 순서)로 대기·구름 껍질 뒤에 그려짐. 라벨 스프라이트는 `renderOrder = 5`.

### 3-4. 그리기 grow (effects.js 1절)
- `makeGrowPath(parent, bucket, {...})`: TubeGeometry `setDrawRange`로 선 긋듯 등장 + 앞장서는 화살촉.
- 순환 고리는 구간(phase) 0~4: `orderLoop(pts, "rise"|"sink"|"ground")`로 시작 구간 지정 (해들리 rise, 극 sink, 페렐 ground).
- 요소가 숨겨졌다가 보이면 0부터 자람. 버킷은 `growBucket(name)`로 재생성 시 초기화.

### 3-5. 좌표·보기
- `latLonToVec(lat, lon, r)`: **경도 +가 동쪽**(지구 사진과 일치하도록 2026-09-23 수정). 지역 마커는 실제 위경도 그대로.
- 지구본 좌우 회전 `rot.y` ↔ 정면 경도: `frontLon = -rot.y/DEG - 90`. 상수 `CAM_AMERICA -0.55`, `CAM_AFRICA -1.83`, `CAM_EUROPE -1.57` (steps.js).
- `globeGroup.rotation.order = "ZXY"` (z는 단면 전환 연출 전용).
- 단면: `latToX(lat)`, `GROUND_Y=-1.1`, `TOP_Y=1.0`, `XW=2.45`. 계절 이동 시 극 쪽이 ±99°까지 밀려도 그리도록 `clampCross`.
- **보이는 영역 맞춤**: 사이드바·하단 시트·자막(player)·그림 자료 높이만큼 `camera.setViewOffset`으로 중심 이동 (`viewInset`, main.js `insetTarget`). 카메라 거리 = `fitZ × zoomMul`.

### 3-6. 계절 이동 (view.js)
- `setSeason(s, animate)` → 애니메이션 중에는 **다시 만들지 않고 옮기기만**(단면 그룹 `position.x` 평행 이동, 지구본은 띠만 재생성 + 라벨·아이콘 위치 이동 `applyGlobeSeasonLive`). 끝나면 `rebuildSeasonDependent()` 한 번 + 재생성된 grow는 즉시 완성 상태로.

### 3-7. 글자 표현 (A 글자 정비, 2026-09-23)
- **글꼴**: CSS `--font`와 캔버스 `FONT_STACK`(core.js) 모두 `AocSans` 우선. AocSans = Pretendard를 앱 사용 글자 + 상용 한글 2,350자(KS X 1001)로 추린 수정본. **OFL 예약 글꼴 이름 조항 때문에 이름을 바꿈 → 수정본을 다시 만들 때도 "Pretendard" 이름을 쓰면 안 됨.** 2,350자 밖의 글자를 자막에 쓰면 그 글자만 기기 기본 글꼴로 보임.
  - 다시 만드는 법: fontTools로 `pyftsubset PretendardVariable.woff2 --text-file=<글자목록> --flavor=woff2 --layout-features='*' --no-hinting` → name 테이블의 Pretendard를 AocSans로 바꾼 뒤 base64로 `aocsans.css`에 넣음.
- **줄바꿈**: `body { word-break: keep-all; overflow-wrap: break-word }`, 문단 `text-wrap: pretty`, 제목·짧은 글 `text-wrap: balance`.
- **`fmtKo(html)`**(core.js): 숫자+단위(23.5°N, 10°~20°)를 `<span class="nw">`(줄바꿈 금지)로 감싸고, "위도 30°"의 앞말·"— " 줄표를 앞말에 붙임. **자막·질문·답·패널 본문·단계 제목·카드·그림 설명 등 화면에 넣는 문장은 모두 fmtKo를 거침** — 새로 문장을 넣는 곳이 생기면 fmtKo를 쓸 것.
- **3D 라벨 최소 크기**: `makeLabel()`이 라벨을 `LABELS`에 등록 → 매 프레임 `updateLabelSizes()`가 화면 글자 높이를 계산해 본문 14px(보조 글씨가 있으면 본문 18px ≈ 보조 11px) 미만이면 키움(최대 2.6배, 발표 모드는 기준 1.35배). 라벨별 기준은 `makeLabel(…, { minPx })`로 바꿀 수 있음. `disposeGroup`이 `userData.dead`로 표시해 목록에서 빠짐.
- **지구본 가장자리·뒤쪽 라벨은 자동으로 흐려짐**(`updateLabelSizes`, 표시 관리 대상 라벨만). 늘 정면에 두는 라벨(회귀선·태양 고리)은 `depthTest: false`.
- 단면 배지의 보조 글씨(저압대 L/고압대 H)는 L/H 도장과 중복이라 삭제.

### 3-8. 디자인·움직임 (B·C 개편, 2026-09-28)
- **시간 토큰** `DUR = { short: 0.4, base: 0.9, long: 1.8 }`(core.js). 새 연출은 이 값만 쓸 것(grow `speed: 1 / DUR.base` 등).
- **기온 색**: `tempAt(lat, alt)`·`tempColor()`·`colorizeByTemp(geo, latAlt)`(core.js) — 순환 고리는 꼭짓점 색(vertexColors)으로 위도·높이에 따라 따뜻함(빨강)→차가움(파랑). `makeGrowPath(…, { latAlt })`에 넘기면 적용.
- **흐르는 줄무늬**: `addFlow(mat, repeatU, speed, dark)` / `flowBandMat(hex, up, tag)` → `FLOW_MATS`, 매 프레임 `updateFlowMats`가 텍스처 오프셋을 움직임. 강조 밖(fk<0.5) 재질은 멈춤. 흐름 텍스처는 밉맵을 끔(가는 관에서 무늬가 뭉개지는 문제).
- **바람 화살표**: `taperedArrowGeom`(꼬리 가늘게) + 흰 테두리 `outlineMat`(BackSide, 셰이더에서 **`morphtarget_vertex` 뒤**에 법선 방향으로 부풀림 — 앞에 넣으면 모핑 1일 때 사라짐). 개수는 무역풍·편서풍 5, 극동풍 4(반구별). 흐름 점 없음.
- **단면 상승·하강**: `makeFlowBand`(cross.js) — 셰브론이 위/아래로 흐르는 반투명 띠(grow 대상, 태그 rise0·sink30…).
- **태양**: `makeSunDisc(radius)` 일러스트형 원반(원반+햇살+빛 번짐 스프라이트). 1단계 태양은 광선이 들어오는 방향의 화면 위치에 매 프레임 배치(`positionFixedSun`). 단면 태양은 세로 빛줄기(`cross.sunBeam`) 동반.
- **장면 안 순서**: 카메라가 움직이는 장면은 `player.growHoldUntil`(0.6초)까지 새 그리기를 미룸. `settleTick`이 전환·계절·카메라·그리기·바람 휘어짐이 모두 끝났는지 보고 `#cap-text.settled` → 자막 핵심어(`<b>`) 밑줄. 자동 재생 대기는 settledAt부터.
- **보기 전환**: 자르기·감기 연출은 각각 첫 1회만 3.2초, 이후 1.1초(`viewTrans.cutShown/wrapShown`).
- **강조 밖 움직임 정지**: 톱니바퀴·빗줄기·광선 흐름 점·줄무늬.
- **지구 사진 밝기**: 기압대·순환·바람·강수가 보이면 약 72%(`updateEarthDim`). 강수 장면은 구름층을 조금 진하게.
- **강수 아이콘**: 위도대마다 2개, 매 프레임 화면 정면 경도 ±30~40°로 옮김(`updatePrecipFront`).
- **색**: 무역풍을 청록(#0fb3a3)으로 바꿔 적도(빨강)·30°(주황) 띠와 구분. 기압대 띠 투명도 0.66.
- **공기 덩어리 기호**: 온도계 + ▲/▼(`parcelSignTex`), 덩어리 바로 위.

### 3-9. 기타
- 애니메이션 속도 `animSpeed`(0.65/1/1.5, localStorage `aoc3d-speed`): main.js에서 `adt = dt*animSpeed`를 전환·계절·grow·바람에, flyTo 시간·자동 재생 대기에 반영.
- 저사양 보호: 평균 26fps 미만이 4초 이어지면 pixelRatio 1로 (main.js `perfGuard`).
- 동작 줄이기(prefers-reduced-motion) → `REDUCED`: 애니메이션 없이 완성 장면.
- 모바일/세로 태블릿 조건: `(max-width:700px), (orientation:portrait) and (max-width:1100px)` — **style.css와 ui.js `mqMobile`이 같은 조건이어야 함.**

---

## 4. 테스트 방법

### 4-1. 로컬 서버(개발 중 확인)
```bash
python -m http.server 8123
```
→ `http://localhost:8123/#2-3` (주소 끝 `#단계-장면`으로 바로 열기)

### 4-2. 전체 장면 회귀 테스트 (브라우저 콘솔에 붙여넣기)
```js
const errs=[]; window.addEventListener('error',e=>errs.push(e.message));
goBeat(0,0); let n=1;
while(true){ const i=state.stepIndex,k=state.beatIndex;
  if(i===STEPS.length-1 && k===STEPS[i].beats.length-1) break;
  try{ nextBeat(); }catch(e){ errs.push(i+':'+k+' '+e.message); break; }
  n++; await new Promise(r=>setTimeout(r,60)); }
for (let i=STEPS.length-1;i>=0;i--){ try{ goBeat(i,STEPS[i].beats.length-1); prevBeat(); }catch(e){ errs.push('back '+i+' '+e.message);} }
finishViewTransition(); finishSeasonAnim(); ({n, errs})   // 기대: n=46, errs=[]
```

### 4-3. 장면 스크린샷 (윈도우, 헤드리스 엣지)
동작 줄이기 플래그를 주면 애니메이션 없이 완성 장면이 찍힘. 파일 경로 대신 로컬 서버 주소 사용 권장(한글 경로 인코딩 문제).
```powershell
& "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless=new --force-prefers-reduced-motion --use-angle=swiftshader --enable-unsafe-swiftshader --window-size=1400,860 --virtual-time-budget=9000 --screenshot=C:\temp\shot.png "http://localhost:8123/index.html#7-5"
```
- 헤드리스는 창 최소 폭 제한이 있어 **휴대전화 폭(<500px)은 부정확** → 브라우저 개발자 도구 기기 모드로 확인.
- 소프트웨어 렌더링이라 애니메이션 **실제 속도는 확인 불가** → 실제 PC에서 확인.
- ⚠️ 브라우저 패널도 JS를 캐시함 → 개발 서버는 캐시 금지 헤더를 보내는 간단한 파이썬 서버를 쓰거나, 콘솔에서 `fetch(파일,{cache:'reload'})` 후 새로고침.
- ⚠️ 헤드리스 엣지가 **이전 JS를 캐시**해서 수정이 안 보일 수 있음 → 찍기 전에 `--user-data-dir` 폴더를 지울 것(`Remove-Item -Recurse -Force $env:TEMP\edge-hl`).

### 4-4. 확인할 해상도
1920×1080(TV) · 1366×768(노트북) · 1024×768(가로 태블릿) · 768×1024(세로 태블릿→하단 시트) · 375×812(휴대전화)

---

## 5. 개편 제언 우선순위 (2026-09-23 제안) — **전부 완료 (2026-09-28)**

> 13개 항목 모두 반영됨. 이후 작업은 선생님 피드백(실제 교실 기기 확인·자막 검토)에 따라 새로 정함.

| 순위 | 작업 | 묶음 | 효과 | 작업량 | 상태 |
|---|---|---|---|---|---|
| 1 | 한국어 줄바꿈: `word-break: keep-all; overflow-wrap: break-word;` 자막 `text-wrap: pretty`, 제목·라벨 `balance`, 숫자+단위(23.5°N, 10°~20°)·줄표 뒤 단어 붙이기(`fmtKo`), 휴대전화 하단 바 제목 두 줄 허용 | A 글자 | 매우 큼 | 작음 | ✅ 완료 (2026-09-23) |
| 2 | 3D 라벨 **화면 기준 최소 크기**(본문 14px, 보조 글씨 있으면 18px·보조 약 11px, 발표 모드 1.35배), 단면 배지 보조 글씨 삭제, **지구본 가장자리·뒤쪽 라벨 자동 흐림**, 겹치던 라벨 위치 조정(공기층 높이·회귀선·태양 고리) | A 글자 | 매우 큼 | 중간 | ✅ 완료 (2026-09-23) |
| 3 | Pretendard 글꼴 **내장**(앱 사용 글자 + 상용 한글 2,350자, 이름 AocSans로 변경·OFL 동봉, data URI) + 글꼴 준비 후 앱 시작 | A 글자 | 중간 | 작음 | ✅ 완료 (2026-09-23) |
| 4 | 색 체계 정리: 순환 고리를 **기온 색**(따뜻함→차가움), 무역풍 청록으로 변경(띠와 구분), 바람 **흰 테두리**, 설명 장면에서 지구 사진 밝기 ~72% | B 디자인 | 큼 | 작음 | ✅ 완료 (2026-09-28) |
| 5 | 바람 화살표: 48→28개, 굵고 꼬리 가늘게, 넓은 화살촉, 흐름 점 대신 **흐르는 줄무늬** | B 디자인 | 큼 | 중간 | ✅ 완료 (2026-09-28) |
| 6 | 순환 고리: 흐르는 줄무늬 + 위도·높이별 기온 색(상승=따뜻 → 하강=차가움), 흐름 점 제거 | B 디자인 | 큼 | 중간 | ✅ 완료 (2026-09-28) |
| 7 | 장면 안 순서(카메라 이동 중 0.6초 그리기 대기 → 움직임이 끝나면 자막 핵심어 밑줄) + 강조 밖 요소 움직임 정지 | C 움직임 | 큼 | 중간 | ✅ 완료 (2026-09-28) |
| 8 | 태양: 일러스트형 작은 원반, 1단계는 광선이 들어오는 방향에 놓여 광선이 태양에서 나오는 모습, 단면 태양 + 세로 빛줄기 | B 디자인 | 중간 | 중간 | ✅ 완료 (2026-09-28) |
| 9 | 기압대 띠 투명도 낮춤(대륙이 비침), 강수 아이콘 40→14개(위도대마다 화면 정면 2개) + 강수 장면 구름층 진하게 (※ 지구본 셰브론은 남북 흐름으로 오해할 수 있어 움직이지 않기로 함 — 흐르는 표현은 단면 띠가 담당) | B 디자인 | 중간 | 작음 | ✅ 완료 (2026-09-28) |
| 10 | 자르기·감기 3.2초 연출은 첫 1회만(이후 1.1초) / 시간 토큰 `DUR` 0.4·0.9·1.8초로 통일 / 자동 재생 대기를 움직임이 끝난 뒤부터 | C 움직임 | 중간 | 작음 | ✅ 완료 (2026-09-28) |
| 11 | 단면의 굵은 상승·하강 화살표 → 셰브론이 흐르는 반투명 공기 흐름 띠 | B 디자인 | 중간 | 작음 | ✅ 완료 (2026-09-28) |
| 12 | 자막 **2줄·55자 이내**, 강조어 장면당 2개 이하, 답 80자 안팎으로 다듬기(초안 작성 → 사용자 검토) | A 글자 | 중간 | 작음 | ✅ 완료 (2026-09-23, 자막 23개·답 3개 수정 — **선생님 검토 대기**) |
| 13 | 공기 덩어리에 온도계·▲▼ 기호 | B 디자인 | 작음 | 작음 | ✅ 완료 (2026-09-28) |

**진행 순서**: ~~A(1·2·3·12)~~ ✅ → ~~B-1(4·5·6·11)~~ ✅ → ~~C(7·10)~~ ✅ → ~~B-2(8·9·13)~~ ✅ **모두 완료**

**A 완료 후 수치**: 자막 46개 평균 47자(이전 52자)·최장 56자(이전 84자)·강조 장면당 최대 2개, 답 최장 83자(이전 122자). 3D 라벨 최소 본문 14px 보장. 글꼴 모든 기기 동일(AocSans).

### 점검에서 확인된 사실 (근거)
- CSS에 `word-break: keep-all` 없음 → 실제 줄바꿈 사례: "바람대/가", "맑/고", "전향/력", "(북/회귀선)", "해/요".
- `--font`의 Pretendard는 **파일이 포함되지 않음** → 기기마다 맑은 고딕/Noto/애플 산돌고딕으로 달라짐.
- 자막 46개: 평균 52자, 60자 초과 10개, 최장 84자(8-1). 답 최장 122자. 줄표(—) 사용 자막 9개.
- 3D 라벨 추정 크기(1400×860): 위도 눈금·회귀선 7~9px, 배지·마커 보조 글씨 6~7px, 바람·기압 10px, 지역·순환 이름 12px.
- 지구본 강수 아이콘 40개, 바람 화살표 48개. 무역풍(주황)·30° 띠(주황)·적도 띠·해들리(빨강) 색이 겹침.
- 1단계 큰 태양이 화면 약 1/4 차지, 평행 광선이 태양 원반에서 나오지 않음.

### 사용자가 직접 확인할 것 (AI가 확인 불가)
- 교실 기기에서의 실제 애니메이션 속도 체감 (속도 버튼으로 조정 가능)
- `js/steps.js` 자막 문구 검토

---

## 6. 작업 시 주의 사항 (자주 틀리는 곳)

- 새 레이어 그룹을 만들면 `regFadeGroup` + `defFade` 등록, 그 뒤 `sweepFadeMats()`(applyVisibility)가 불려야 페이드·강조가 적용됨.
- 공유 재질을 서로 다른 fade key 그룹이 같이 쓰면 투명도가 싸움 → 그룹별 재질 분리(예: `wind_` 지구본 / `windX_` 단면).
- 지구본 요소를 새로 놓을 때 **위경도는 실제 지리 값**(동경 +). 화면 정면 기준 배치는 `frontLon()` 사용.
- 단면 요소 위치는 계절 이동 중 그룹 평행 이동으로 처리되므로 `seasonShift()`로 만든 위치를 그대로 쓰면 됨. 경계는 `CROSS_LAT_MAX`.
- 스프라이트 라벨은 `makeLabel()`(캔버스 텍스처, `userData.own` → disposeGroup 시 해제).
- 단계·장면을 추가/삭제하면 README·교사용_안내.html의 **장면 수(현재 46)**와 수업 흐름 표도 함께 수정.
- 작업이 끝나면 **배포 zip 재생성**:
  ```powershell
  Compress-Archive -Path "…\대기대순환 3D" -DestinationPath "…\대기대순환3D_배포.zip" -Force
  ```
  (임시 폴더 `.claude/` 등이 남아 있지 않은지 먼저 확인)

---

## 7. 작업 기록

| 날짜 | 도구 | 내용 |
|---|---|---|
| 2026-09-23 | Claude Code | 개편 1단계: 버그 수정(빈 질문 상자·패널이 화면 가림·단면 바람/배지 겹침), 1단계 조명, 지구 사진 내장(완전 오프라인), script.js → js/ 8개 파일 분리 |
| 2026-09-23 | Claude Code | 개편 2단계: 장면 재생기(자막·진행 점·질문/답·자동 재생·키보드/리모컨·발표 모드), 페이드·강조·숨김 표시 관리, 8단계 추가, 자막 초안 |
| 2026-09-23 | Claude Code | 개편 3단계: 1~4단계 애니메이션(빛기둥·입사 면적·기온 색·에너지 그래프, 지구본 자르기/감기 전환, 공기 덩어리, 구간별 고리 그리기, 톱니바퀴, L/H 도장), `#단계-장면` 주소 |
| 2026-09-23 | Claude Code | 개편 4단계: 5~7단계(구름→비·구름 소멸, 바람 휘어짐 모핑, 자전 표시, 지역 마커+카드), `latLonToVec` 경도 방향 수정 |
| 2026-09-23 | Claude Code | 개편 5단계: 8단계 계절 연속 이동, 공전·자전축 그림, 회귀선·태양 직하 고리, 사바나·지중해성 마커/카드 (46장면) |
| 2026-09-23 | Claude Code | 개편 6단계: 교사용_안내.html, 세로 태블릿 하단 시트, 낮은 화면 자막 축소, 저사양 자동 화질, 배포 zip |
| 2026-09-23 | Claude Code | 후속: 애니메이션 속도(느리게·보통·빠르게, S키), 7·8단계 정리 장면 단순화, 회귀선 라벨 정면 추적 |
| 2026-09-23 | Claude Code | 전체 점검 → 글자·디자인·움직임 개편 제언(5절) 작성. 이 HANDOFF.md 작성 |
| 2026-09-23 | Claude Code | **A 글자 정비 완료(5절 1·2·3·12)**: 한국어 줄바꿈(keep-all·pretty/balance·fmtKo), 3D 라벨 최소 크기+가장자리 라벨 흐림, Pretendard 추림본 AocSans 내장(OFL 동봉), 자막·답 다듬기. 46장면 회귀 테스트 통과. 다음: B-1 |
| 2026-09-28 | Claude Code | **B-1·C·B-2 완료(5절 4~11·13)**: 순환 고리 기온 색+흐르는 줄무늬, 바람 화살표 개편(28개·꼬리 가늘게·흰 테두리·줄무늬, 무역풍 청록), 단면 상승·하강 흐름 띠, 지구 사진 밝기 조절, 시간 토큰 DUR, 장면 안 순서·자막 밑줄·강조 밖 움직임 정지, 반복 전환 1.1초, 자동 재생 대기 보정, 태양 일러스트 원반+단면 빛줄기, 기압대 띠 반투명·강수 아이콘 14개, 공기 덩어리 온도계 기호. 46장면 회귀 테스트 통과, 셰이더 오류 0. 5절 전부 완료 |
