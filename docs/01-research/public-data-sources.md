# LCA 관리 앱에 쓸 수 있는 공개 데이터 조사

조사일: 2026-10-15 · 버전: v01 · 목적: 가상 샘플 데이터로 만든 LCA 관리 웹앱을 **실제 제도·양식·규칙**에 맞게 만들기 위해, 공개된 데이터가 있는지와 어떤 조건으로 쓸 수 있는지 확인한다.

> 모든 내용은 조사원이 직접 열어 본 웹페이지를 근거로 했다. 데이터 파일은 내려받지 않았고 미리보기·메타데이터·안내 페이지만 읽었다. 가입·로그인·양식 제출도 하지 않았다. 원문을 확인하지 못한 항목은 **확인 필요**로 표시했다. 출처 번호는 맨 아래 목록과 같다.

---

## 1. 한눈에 보기

- **결론: 쓸 수 있는 공개 데이터가 있다.** 다만 앱은 탄소를 계산하는 LCA 툴이 아니라 **프로젝트·데이터 수집을 관리하는 앱**이므로, 공개 데이터는 계산이 아니라 **샘플 데이터·선택 목록·업무 규칙을 실제처럼 만드는 데** 쓴다.
- 가장 쓸모 있는 것은 공공데이터포털의 「환경성적표지 유효 인증현황」이다. 실제 인증 3,471건(2026-06-30 기준)에 인증번호, 제품군, 7개 영향범주 결과, 시작일·종료일이 있고, 이용 제한이 없다 [P1].
- 실제 데이터는 이용 조건에 따라 세 가지로 나뉜다.

| 구분 | 데이터 | 쓰는 방법 |
|---|---|---|
| 🟢 바로 사용 | 환경성적표지 인증현황·평가계수(공공데이터포털), 환경성적표지 작성지침(고시), Catena-X PCF 모델(CC-BY-4.0), 영국 DESNZ 배출계수(OGL), 미국 EPA 공급망 배출계수(공공 도메인) | 출처를 밝히고 사용 |
| 🟡 조건부 사용 | PACT 기술 명세(출처·면책조항 표기), 국가 LCI DB 목록(상업 사용 금지), 국가 전력 배출계수(원문 미확인) | 조건을 지키고, 원문 미확인 값은 "확인 필요" 표시 |
| 🔴 복사 금지 | International EPD·ECO Portal·EPD Norway의 실제 등록 기록, 에코스퀘어 웹 화면 자료 | 형식·규칙만 참고하고 실제 기록은 링크로만 연결 |

- **실제 회사 이름은 앱에 넣지 않는다.** 인증 목록·EPD 기록에는 실제 기업명이 있다. 이를 프로젝트나 고객사로 넣으면 그 기업이 에코에이블의 고객처럼 보인다. 앱에는 **실제 제품 종류 + 가상 회사**를 쓴다.

---

## 2. 국내 공개 데이터

| # | 데이터 (제공) | 내용 | 형식 · 이용 조건 | 앱 활용 | 주의 |
|---|---|---|---|---|---|
| P1 | **환경성적표지 유효 인증현황** (KEITI, 공공데이터포털) | 3,471행(2026-06-30 기준). 기업명, 인증구분(환경성적/저탄소제품), 인증번호, 제품군, 인증제품명, 7개 영향범주별 총량·단위·제조전·제조·사용·폐기, 시작일, 종료일 | CSV(API는 키 필요). 이용허락 "제한 없음", 무료, 로그인 불필요. 2026-07-29 수정, 연 1회 갱신 | 인증·사후관리 샘플. 만료 규칙 **시작일 + 3년 − 1일** 확인(예: 2023-07-31 ~ 2026-07-30). 기능단위(ton, m², m³, kg)와 단계별 결과 형식 | 실제 기업명 포함. 인증번호 자릿수 혼재(2020-402, 2024-1010) |
| P2 | **에코스퀘어 인증제품 현황** (KEITI) | 3,473건. 상세에 기능단위, 소재지, 7개 결과값. 매달 유효인증현황 XLSX 게시(최신 2026-09-30 기준). 인증취소 공지 | 웹 + XLSX. 저작권정책상 무단 복제·배포 금지, 공공누리 표시 자료만 자유 이용 | 상태값(유효·종료·취소) 설계 참고, 출처 링크 | 앱에 복사하지 않고 P1을 쓴다 |
| P3 | **환경성적표지 평가계수 (2021)** (KEITI, 공공데이터포털) | 398행. 대분류, 구분, 원료·에너지, 단위, 7개 영향범주 계수. 예: 구리 4.57 kgCO₂eq/kg | CSV, "제한 없음". 2025-08-05 수정, 1회성 | 원료·에너지·운송·폐기물의 2차 데이터(계수) 참고값 | 2021년 기준. 에코스퀘어는 평가계수·LCI DB의 상업용 사용 불가를 명시. 포트폴리오(비상업)도 이 문구를 함께 표기 |
| P4 | **환경성적표지 작성지침** (환경부 고시 제2025-165호, 2025-10-01 고시) | 공통지침(별표 1~3), 인증신청보고서 양식(별표 6), 수송거리(부속서 2), 폐기 시나리오(부속서 3), 탄소발자국 계산(부속서 5) | 법령정보센터 본문 + 별표. 고시는 저작권 보호 대상이 아님(저작권법 제7조) | 데이터 요청 항목의 근거 조항, 검토 기준, 운송·폐기 기본값 | 에코스퀘어 법령 페이지는 이전 호수(제2025-127호) 표기. 별표 세부 내용 **확인 필요** |
| P5 | 인증제품 수·업체 수 통계 (공공데이터포털) | 2002~2020년 누적 | CSV, "제한 없음" | 소개 화면 배경 통계 정도 | 오래됨 |
| P6 | 녹색제품 정보 (공공데이터포털) | 99,773행. 환경표지 인증번호, 시작·종료일 등 | CSV, "제한 없음" | 거의 쓰지 않음 | 환경표지(Type I)이며 LCA 기반 환경성적표지가 아님 |
| P7 | **국가 전력 배출계수** | 2023년도 0.4173 tCO₂eq/MWh(2025-12-18 발표). 직전 2020~2022 평균 0.4541. 갱신 주기 3년 → 1년 | 언론 보도로만 확인 | 에너지 항목 참고 표시 | 정부 원문 미확인 → **확인 필요**. 배출권거래제(Scope 2)용 값이라 LCA에는 국가 LCI DB의 전력 데이터가 더 맞음 |
| P8 | **국가 LCI DB 목록** (에코스퀘어) | 849건. 분류, 국문·영문명, 개발기관, 연도, 버전, Excel·XML. 화학물질 329, 금속 163, 수송 106, 폐기물 87, 전기 32(발전원별, 2022 v1.0.0) | 웹 목록 + 첨부. 상업용 사용 금지 | "계수 출처" 선택 목록(데이터셋명·버전·연도) | 다운로드 로그인 여부, XML 형식(ILCD 여부) **확인 필요** |

---

## 3. 해외 공개 데이터

| # | 데이터 (제공) | 내용 | 형식 · 이용 조건 | 앱 활용 | 주의 |
|---|---|---|---|---|---|
| P10 | **PACT Tech Spec v3.0.3** (WBCSD) | ProductFootprint 예시 JSON. 필드: declaredUnitOfMeasurement/Amount, pcfExcludingBiogenicUptake, referencePeriodStart/End, primaryDataShare, dqi(기술·시간·지리), verification, validityPeriodStart/End, exemptedEmissionsPercent | HTML 명세 + OpenAPI. 명세를 이용한 소프트웨어는 공유 가능하나 **출처 표기·WBCSD 명시·면책조항 게시** 필요. 상표 사용권 없음 | 공급망 항목의 필드 이름 | v2 필드 이름(declaredUnit, pCfExcludingBiogenic)은 v3에서 바뀜 |
| P11 | **Catena-X PCF 모델 10.0.0** (Eclipse Tractus-X) | 회사·제품, 평가 방법, 생애단계별 배출, 범위, 적합성 증명, 탄소 함량 등 7개 그룹. PDS·DQR 포함. 예시 JSON·JSON 스키마 | CC-BY-4.0, 무료 | 자동차 고객 "Catena-X 양식" 체크리스트, 단계별 입력 화면 구성 | 예시 값은 앞뒤가 맞지 않는 가짜 값이라 그대로 쓰지 않음 |
| P12 | TfS PCF Guideline V3.0 + Data Model | 화학업 PCF 규칙과 필드 정의 | PDF, "open source" 표기. 정식 라이선스 **확인 필요** | 동인 "TfS" 선택 시 참고 링크 | 세부 필드 **확인 필요** |
| P13 | **International EPD Library** (EPD International) | 등록번호(예: EPD-IES-0028354:002), 제품군, 소유자, 지역, PCR, 개정일(version date)과 유효일(validity date) | 웹 + 별도 승인 API. 약관: 원형 그대로만 사용, **분해·재배포·자체 DB 구축 금지** | 번호 형식, "개정일 ≠ 만료일" 화면 설계 | 기록 복사 금지 |
| P14 | ECO Portal (ECO Platform) | 여러 운영기관의 EPD 48,889건 | 열람 무료. 2026-11-01부터 개별 다운로드에 무료 계정 필요. API는 비상업 무료(승인 필요) | 외부 링크 | 재판매·파생 상품 금지 |
| P15 | EPD Norway | EPD 13,519건, valid from/to | 자기 목적 무료, 상업 이용·제3자 제공은 협의 | 유효기간 5년(GPI v4, 2019) | 최신 GPI **확인 필요** |
| P16 | UL EPD | 약관상 선언일부터 5년 유효, 만료 60일 전 서면 갱신 요청 | SPOT 사이트 열람 실패(403) | 만료 60일 전 갱신 알림 | 확인한 약관이 2018년판 → **확인 필요** |
| P17 | Federal LCA Commons (미국 USDA 등) | USLCI, 미국 전력, NIST 건설자재 | JSON-LD·openLCA, 무료. 라이선스 **확인 필요** | "배경 DB" 선택지 | 미국 데이터 |
| P18 | openLCA Nexus (GreenDelta) | Agribalyse 3.2 Core 무료(2026-06 공지) 등 | DB마다 다름 | 배경 DB 이름 목록 | 무료 목록 전체 **확인 필요** |
| P19 | **UK DESNZ 전환계수 2026** (영국 정부) | 연료, 전력, 운송, 폐기물 계수 | XLSX, **OGL v3.0**(출처 표기 시 상업 이용 가능) | 에너지·운송 계수 예시값 | 영국 기준 |
| P20 | **US EPA Supply Chain GHG EF v1.3** | NAICS 1,016개 품목, kgCO₂e/2022 USD | CSV, **공공 도메인** | "지출 기반 2차 데이터" 예시 | 정밀도 낮음 |
| P21 | IPCC EFDB | 배출계수 검색 | 사용자 책임 | 공정배출 계수 출처 링크 | 개편 중 |
| P22 | Climatiq | 계수 열람 | 사용에 대개 라이선스 필요 | **사용하지 않음** | 컨설팅은 상업 이용 |
| P23 | GHG Protocol Supplier Engagement Guidance | 공급사 설문 항목(배출원·경계·기간·활동량·계수 출처·불확도·할당), 협력 5단계(사전 공지 → 교육 → 정기 확인 → 미응답 조치 → 검토·감사) | PDF(2011). 라이선스 명시 없음 | 요청 항목·메일 흐름 참고 | 엑셀 양식 아님 |

---

## 4. 실제 공개 사례

> 아래는 공개된 인증·등록 사례로, **형식과 범위를 참고하기 위한 것**이다. 에코에이블 수행 여부와는 관계없으며, 앱에는 회사 이름을 쓰지 않는다.

| # | 사례 | 보여 주는 것 | 앱 활용 | 주의 |
|---|---|---|---|---|
| P30 | 철강 열연강판 International EPD | PCR 2019:14(EN 15804+A2), 버전 :002(2025-08-29), 유효기간 2030-08-21 | 인증 기록 필드: 등록번호·PCR·버전·유효기간 | 기능단위는 PDF에만 있음 |
| P31 | 철강 코일철근 International EPD | 게시 2024-01-12, 유효 2029-01-12, 버전 :004(2025-03-18). 1 t, A1–A3, 생산 데이터 2022년, ecoinvent 3.9.1 | 범위 정의 샘플값. 5년 사이 여러 번 개정 → "버전 이력" | 세부값 **확인 필요** |
| P32 | 알루미늄박·양극박 International EPD | PCR 2022:08, 2023-08-22 게시, 2028-08-22 만료 | 배터리 소재·포장재 샘플, 만료 알림 | 기능단위 **확인 필요** |
| P33 | 배터리 양극재 환경성적표지 | 2022 인증, 7대 영향범주 공개, 탄소발자국 22.0~25.9 kgCO₂/kg. 동인: 고객 요구 + EU 배터리법 | 동인 여러 개 선택, 결과값 "참고 범위" | 기능단위·경계 명시 없음 |
| P34 | 고로슬래그 미분말 저탄소제품 | 2025-04 인증 | 건자재 샘플, 인증구분 "저탄소제품" | 수치 없음 |
| P35 | 전자제품 한-영 공동 탄소발자국 인증 | 2019, KEITI와 Carbon Trust 동시 인증 | 결과 활용처 복수 선택 | 오래됨 |

- 국내 철강 EPD들의 전력 배출계수가 0.514~0.69 kgCO₂/kWh로 다르게 쓰인다(검색 요약, **확인 필요**). 그래서 "계수 출처·연도" 기록이 필요하다.
- 석유화학 제품의 공개 수치 사례는 찾지 못했다. ISCC PLUS(질량수지) 인증 기사가 많아 "질량수지 적용" 표시를 검토한다.

---

## 5. 데이터 수집 양식·템플릿

| # | 양식 | 요청 항목·단위 | 우리 앱 11개 데이터 구분과 비교 |
|---|---|---|---|
| P40 | Catena-X PCF 데이터 준비 가이드 (Cofinity-X, v9.0.0) | 선언단위(kg·kWh·tkm·piece)와 수량, 제품 질량, 기준기간, 제외 배출 0~10%, PDS 0~100, DQR 1~5, 할당, 질량수지, IPCC AR5/AR6, 검증 비율 | "공급망" 항목과 범위 정의 필드로 사용. 활동량이 아니라 결과값 양식 |
| P41 | Makersite 공급사 설문 | PCF 값·표준 또는 재질·공정별 kg, BOM, 인증서 첨부. 상태 Open → Submitted → Done, 반려 시 Rejected(코멘트) → 재제출 | 우리 상태 흐름(요청 → 제출됨 → 보완 요청 → 승인)과 같은 구조 |
| P42 | DEISO EPD 데이터 수집 템플릿 (엑셀 14시트, v1.2) | 개요, 기능단위, 경계, BOM, 공정 에너지, 배출계수 데이터셋, 품질 1~5, 할당 근거, 모듈별(A1–D) 활동량, 검증 위험 표시 | 일반·제품·원료·에너지·할당·운송·사용/폐기 일치. 우리 앱에 없는 "배출계수 데이터셋"·"검증 위험 표시" 추가 검토 |
| P43 | TfS PCF Exchange / 화학사 공급사 안내 | TfS 기준 PCF(cradle-to-gate), 2차 데이터 출처, 산정기간, PDS | 화학 고객사 요구 유형 샘플 |
| P44 | Battery Pass 데이터 속성 목록 v12 | DIN DKE SPEC 99100 기준 배터리 여권 속성 | 배터리 프로젝트 "규제별 추가" 항목 (세부 **확인 필요**) |
| P45 | 자동차 OEM 협력사 배출 관리 시스템 | 협력사 배출 모니터링에 차량 LCA 기능 추가(2024-12) | 자동차 협력사 대응 동인 (입력 항목 비공개) |

- **KEITI가 공개한 표준 데이터 수집 엑셀 양식은 찾지 못했다.** 작성지침 별표 6(인증신청보고서)과 부속서를 근거로 쓴다.

---

## 6. 실제 규제 일정 (마감일 성격 예시)

| 항목 | 날짜 | 마감일 성격 | 출처 |
|---|---|---|---|
| EU 배터리법 탄소발자국 선언: EV 배터리 | 2025-02-18과 "위임법 발효 + **12개월**" 중 늦은 날 | 조건부 | [P60][P62][P63] |
| 같은 규정: 산업용(외부저장 제외) / LMT / 외부저장 산업용 | 2026-02-18 / 2028-08-18 / 2030-08-18, 각각 "위임법 발효 + **18개월**"과 비교해 늦은 날 | 조건부 | [P60][P62][P63]. EUR-Lex 원문은 열리지 않아 2차 출처 기준 |
| 위 위임법 채택 상태 | 2026-09 기준 미채택 | 확인 필요 | [P60][P61] |
| 배터리 여권 | 2027-02 (대형 배터리부터) | 확정 | [P64] |
| CBAM 확정기 | 2026-01-01부터 | 확정 | [P65] |
| CBAM 연 50 t 이하 면제 | 2025-10-20 관보 게재 | 확정 | [P66] |
| CBAM 인증서 판매 / 2026년분 첫 신고 | 2027-02-01 / 2027-09-30 | 확정 (2차 출처) | [P67] |
| ESPR 작업계획 / DPP 레지스트리 가동 | 2025-04-16 / 2026-07-20 | 확정 | [P64][P68] |
| ESPR 철강 위임법 | 채택 후 최소 18개월 뒤 적용 (연도는 출처마다 다름) | 확인 필요 | [P68] |
| 환경성적표지 처리기간 | 약 90일 | 확정 | [P69] |

---

## 7. 에코에이블 공개 정보 (샘플 데이터 참고)

- 서비스: LCA·PCF(고객 요구·규제·진단), 내재화 교육, LCA IT 시스템, ESPR·에코디자인, LCC, 국내외 EPD, ISCC, GLEC, Scope 3·CDP. 자체 툴 LCABLE은 이름만 공개 [P50].
- 2025~2026년 포트폴리오의 제품 종류: BTX, MDI, 카본블랙, 전구체, 황산니켈, rPET·재생원사, 내화물, 태양광 패널, 자동차 부품 LCA 검증. 여러 건이 툴 개발을 함께 진행 [P50].
- 프로젝트 기간·단계를 설명한 공개 자료는 찾지 못했다 → 면접에서 물어볼 것.

---

## 8. 쓸 때 지킬 것

| 규칙 | 이유 |
|---|---|
| 실제 회사 이름을 프로젝트·고객사로 넣지 않는다. 가상 회사 이름 옆에 "가상"을 표시한다 | 에코에이블 고객으로 오해받지 않기 위해. 같은 이름의 실제 회사가 있을 수 있음 |
| EPD 등록 사이트의 기록은 복사하지 않는다. 형식·규칙만 쓰고 원문은 링크로 연결한다 | International EPD·ECO Portal·EPD Norway 약관 |
| 출처와 기준일을 앱의 "자료 출처" 화면에 표기한다 | 공공데이터·OGL·CC-BY 조건, 데이터 최신성 |
| PACT 필드를 쓰면 WBCSD 출처와 면책조항을 함께 게시한다 | PACT 명세 라이선스 |
| 국가 LCI DB·평가계수는 "상업용 사용 불가" 문구를 함께 표기한다 | 에코스퀘어 안내 |
| 원문을 확인하지 못한 값(전력 배출계수 등)은 화면에 "확인 필요"를 붙인다 | 틀린 값을 사실처럼 보이지 않기 위해 |
| 계수로 탄소를 계산하는 기능은 만들지 않는다. 계수는 참고값으로만 보여 준다 | 앱의 역할은 관리. 계산은 LCA 툴(LCABLE, SimaPro 등)의 역할 |

앱에 어떻게 반영하는지는 「LCA 관리 웹앱 설계서」 9장(공개 데이터 적용 계획)에 정리했다.

---

## 9. 찾지 못한 것 · 확인 필요

- KEITI 표준 데이터 수집 양식 (공개본 없음)
- 국가 전력 배출계수 정부 원문과 2024년도 값, GIR 연료별 국가 고유 배출계수 공개 파일
- 국가 LCI DB 다운로드 조건과 XML 형식
- 작성지침 제2025-165호 별표·부속서 세부 내용
- EPD Norway 최신 프로그램 규정, UL EPD 최신 약관, TfS Data Model 라이선스
- 에코에이블의 실제 프로젝트 기간·단계, 석유화학 제품의 공개 수치 사례

---

## 출처

**국내** [P1] https://www.data.go.kr/data/15089157/fileData.do · [P2] https://ecosq.or.kr (인증제품 현황, 국가 LCI DB, 저작권정책) · [P3] https://www.data.go.kr/data/15120968/fileData.do · [P4] https://www.law.go.kr/행정규칙/환경성적표지작성지침 · [P5] https://www.data.go.kr/data/15068129/fileData.do · [P6] https://www.data.go.kr/data/15087711/fileData.do · [P7] https://www.kukinews.com/article/view/kuk202512180131 · [P8] https://ecosq.or.kr (제도소개 > LCI DB > 국가 LCI DB)

**해외** [P10] https://docs.carbon-transparency.org/tr/data-exchange-protocol/latest/ · [P11] https://github.com/eclipse-tractusx/sldt-semantic-models/tree/main/io.catenax.pcf/10.0.0 · [P12] https://www.tfs-initiative.com/pcf-guideline · [P13] https://www.environdec.com/library · [P14] https://eco-portal.eco-platform.org/ · [P15] https://digi.epd-norge.no/epder/ · [P16] https://spot.ul.com · [P17] https://www.lcacommons.gov/ · [P18] https://nexus.openlca.org/ · [P19] https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2026 · [P20] https://catalog.data.gov/dataset/supply-chain-greenhouse-gas-emission-factors-v1-3-by-naics-6 · [P21] https://www.ipcc-nggip.iges.or.jp/EFDB/main.php · [P22] https://climatiq.io/licensing · [P23] https://ghgprotocol.org/sites/default/files/2022-12/Supplier%20Engagement%20Guidance.pdf

**사례** [P30] https://www.environdec.com/library/epd25436 · [P31] https://www.environdec.com/library/epd11679 · [P32] https://environdec.com/library/epd10281 , https://www.environdec.com/library/epd10273 · [P33] https://newsroom.posco.com/kr/?p=90180 · [P34] https://view.asiae.co.kr/article/2025041709012751826 · [P35] https://lg.co.kr/media/release/21309

**양식** [P40] https://userguide.cofinity-x.com/en/articles/758132-prepare-pcf-data-9-0-0 · [P41] https://support.makersite.io/supplier-questionnaire-submission · [P42] https://dei.so/epd-data-collection-framework-template/ · [P43] https://tfs-initiative.com/pcf-exchange-solution · [P44] https://en.acatech.de/publication/battery-passport-content-guidance/ · [P45] https://www.smarttoday.co.kr/ko-kr/articles/68541

**회사** [P50] https://www.ecoable.co.kr/what-we-do , https://www.ecoable.co.kr/portfolio

**규제 일정** [P60] https://traceable.digital/resources/blog/battery-carbon-footprint-declaration-deadline-not-started/ · [P61] https://www.cleolabs.co/en/blog/eu-battery-carbon-footprint-class-2026 · [P62] https://www.compliancegate.com/eu-batteries-regulation-timeline-and-dates/ · [P63] https://psqr.eu/publications-resources/carbon-footprint-batterie/ · [P64] https://transition-pathways.europa.eu/retail/news/digital-product-passport-registry-now-live · [P65] https://taxation-customs.ec.europa.eu/carbon-border-adjustment-mechanism_en · [P66] https://taxation-customs.ec.europa.eu/news/officially-published-simplifications-carbon-border-adjustment-mechanism-cbam-2025-10-20_en · [P67] https://cbamguide.com/news/2026-08-14-commission-ten-cbam-guidance-documents-definitive-period/ · [P68] https://green-forum.ec.europa.eu/news/ecodesign-sustainable-products-regulation-moves-implementation-2026-07-02_en · [P69] https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=14800000255
