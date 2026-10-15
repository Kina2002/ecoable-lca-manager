# 제품 LCA 업무 자료조사 — 에코에이블 LCA 관리 앱 설계용

조사일: 2026-10-15 · 버전: v02 (공개 데이터 추가 조사 반영: EU 배터리법 일정 정정, 국가 LCI DB 건수·EPD 유효기간 보완) · 범위: 에코에이블컨설팅 전과정정책본부의 **제품 전과정평가(LCA) 수행** (고객사 요구 대응 · 규제 대응 · 제품 환경성 진단). PCF·환경성적표지·해외 EPD는 "LCA 결과를 어디에 쓰는지"로만 다룬다.

> 모든 내용은 조사원이 직접 열어 본 웹페이지를 근거로 했다. 원문을 열지 못한 항목은 **확인 필요**로 표시했다. 출처 번호는 맨 아래 목록과 같다.

---

## 1. 한눈에 보기

- **LCA에서 가장 오래 걸리고 자주 막히는 단계는 데이터 수집**이다. 첫 LCA는 수집에만 2~3개월, 전체 3~6개월이 걸린다 [W1]. 그래서 앱의 중심은 **고객사 자료 요청 추적**이어야 한다.
- 검증·인증은 **"보완 요청 ↔ 보완 제출"을 여러 번 주고받는** 구조다 [W11]. 라운드 기록이 필요하다.
- 결과를 어디에 쓰느냐(환경성적표지, International EPD, 고객사 PCF 양식, EU 배터리법, CBAM)에 따라 **방법론·필수 데이터·검증 주체·유효기간이 모두 다르다**. 프로젝트마다 "목적/동인"을 기록해야 한다.
- 데이터마다 **단위, 기간, 증빙, 1차/2차 구분, 품질 등급**을 남겨야 검증을 통과한다 [R-GHG][R-CX][R-PEF].

---

## 2. 에코에이블의 LCA 업무 현황

- 2016년 설립, 비전 "Life Cycle Linker". 전과정정책본부 게시 인원 13명. 환경성적표지인증 (선임)심사원, EPD Norway 검증심사원, 국제통용발자국 검증심사원 등 보유 [C1][C2].
- 포트폴리오 LCA 탭 114건, EPD 탭 122건 [C3]. 2022년 이전 항목은 두 탭에 중복된 것이 많다.
- 대표 학술 발표(2023) 「국내 산업계의 전과정평가 활용」: EU 배터리법·CBAM 때문에 LCA가 자발적 활동에서 **규제 대응**으로 바뀐다는 내용 [C4].
- 한국환경산업기술원 국가 LCI DB 전면개편 사업(2022~2030) 참여. 자사 포트폴리오에는 2025~2026년 "총괄주관사"로 표기 [C3][C5].
- 자체 LCA 툴 **"LCABLE"**: 홈페이지에 이름 한 줄만 있고 기능 정보는 찾지 못함 [C2].

**포트폴리오 예시 (목적 분류는 제목을 보고 나눈 추정)** [C3]

| 목적 | 예시 |
|---|---|
| 고객사 요구 대응 | 2026 한국전구체 전구체 LCA 및 고객사 대응 · 2026 현대자동차 부품 LCA 검증 및 협력사 교육 · 2023 LG화학 Scope3 협력회사 PCF 관리 |
| 규제·인증 대응 | 2024 현대엔지니어링 P2E 수소 LCA + 청정수소인증제 · 2022 삼성SDI·에코프로·아모레퍼시픽 LCA + 카본트러스트 · 2021 삼양식품, 2022 LG이노텍 LCA + 환경성적표지 |
| 진단·에코디자인·비교 | 2023 KT&G 에코디자인 가이드라인 · 2024 LS일렉트릭 에코디자인 체계 · 2026 유한킴벌리 핸드타월 vs 핸드드라이어 비교 · 2024~2026 삼성서울병원 수술·치료 환경성 평가 |
| LCA + 툴·IT·내재화 (가장 많음) | 2025 S-OIL 전제품 LCA + 시스템 · 2026 금호석유화학 LCA IT 시스템 · 2023 유한킴벌리 10개 제품 + 사업장별 Tool · 2024 국도화학 10개 제품 + 내재화 |

- 여러 해 반복 고객: 조선내화(2024~2026), 현대케미칼(2023~2026), OCI(2023·2025·2026).
- 고객사 로고 59개. 석유화학·화학이 가장 많고, 배터리·소재, 전자·부품, 소비재·식품·유통, 자동차, 건자재, 공공기관 순(업종 분류는 추정) [C6].

---

## 3. LCA를 하는 이유 (동인)

### 3-1. 규제 대응

| 규제 | 대상 | 요구 내용 | 필요한 데이터 | 검증 | 주요 일정 |
|---|---|---|---|---|---|
| EU 배터리법 (EU) 2023/1542 | EV, 2kWh 초과 산업용, LMT 배터리. 모델·공장별 | 탄소발자국 선언 → 성능등급 → 최대 임계치 | 주 생산단계 1차 데이터 필수, kgCO2e/kWh, 생애단계별, 사용단계 제외, PEF 기반 규칙 [G2] | Notified body, 자가인증 불가 [G2] | 선언: EV 2025.2.18("위임법 발효 + 12개월"과 비교) / 산업용(외부저장 제외) 2026.2.18 / LMT 2028.8.18 / 외부저장 산업용 2030.8.18(각 "위임법 발효 + 18개월"과 비교), 둘 중 늦은 날 [G2][G32]. 산정 위임법은 2026.9 기사 기준 미채택 → **조건부·확인 필요** [G33]. 배터리 여권 2027.2.18 [G1] |
| EU CBAM (EU) 2023/956 | 시멘트·철강·알루미늄·비료·전력·수소 [G4]. 한국 생산자는 EU 수입자에게 데이터 제공 | 전환기 보고 → 확정기 인증서 구매·반납 [G5] | 설비·생산경로별 직접/간접 배출, 전구체 [G5] | 공인 검증인 [G6][G7] | 전환기 2023.10.1~2025.12, 확정기 2026.1.1~ [G4][G5]. 2026년분 신고 마감 2027.9.30 [G7] |
| EU ESPR (EU) 2024/1781 + DPP | 위임법 대상(철강·알루미늄, 섬유, 가구, 타이어, 매트리스 우선) [G10] | 제품별 위임법, 환경정보는 DPP로 [G10] | 위임법별(확인 필요) | — | 발효 2024.7.18 [G9]. 첫 DPP 적용은 대형 배터리 2027.2.18 [G11] |
| EU ECGT (EU) 2024/825 | B2C 환경주장 기업 | 일반적 환경주장·상쇄 기반 "중립" 주장 금지 [G13] | 전과정 근거 | 제3자 | 적용 2026.9.27 [G13] |
| EU CPR (EU) 2024/3110 + EN 15804+A2 | 철강·시멘트 등 건설자재 | 성능 선언에 환경성능(1단계 GWP) [G15] | EN 15804 LCA, EPD | Notified Body | 적용 2026.1.8 [G15]. 제품군별 의무 시점 확인 필요 |
| 국내 환경성적표지·저탄소제품·녹색제품 | 국내 제품 | 인증 후 저탄소 기준 충족 시 녹색제품 공공구매 [G16] | 작성지침 결과 + LCA 결과 + 근거자료 [K-L2] | KEITI 심사 | 4장 참고 |

### 3-2. 고객사 요구 대응 (공급망 PCF)

| 요구 유형 | 요구 주체 | 방법론 | 산출물 | 비고 |
|---|---|---|---|---|
| 업종 공통 | WBCSD PACT 참여사 | PACT Methodology V3, cradle-to-gate [G22] | 선언단위당 PCF, 1차 데이터 비중(PDS), 데이터 품질(DQR), 검증 정보 | V2 결과는 3년 유효, 공정 10% 넘게 바뀌면 재산정 [G22] |
| 자동차 | Catena-X (OEM·협력사) | PCF Rulebook v4 [G24] | PCF 값(바이오제닉 포함/제외), PDS, 시스템 경계, 할당, 품질 지표 [G23] | 제외 3% 이내, 연 1회 점검, 10% 넘게 늘면 재산정. PDS·DQR은 2027년 말 이후 의무 [G24] |
| 화학 | TfS | PCF Guideline 2024 업데이트 [G25] | PCF, 3단계 검증 | PACT·Catena-X와 정렬 |
| 전자 | Apple 등 | 2030 공급망 탄소중립 [G26] | 연간 보고 | 부품별 PCF 직접 요구 여부는 확인 필요 |
| 국제표준 | 고객사 전반 | ISO 14067 | PCF 보고서 + 제3자 검증서 | — |

### 3-3. 제품 환경성 진단 (핫스팟·에코디자인)

- **핫스팟(기여도) 분석**: 영향이 큰 공정·소재·단계를 찾는다 [W8].
- **누적 80% 랭킹(PEF 방식)**: 큰 순서로 누적 80%까지 영향범주·단계·공정을 고른다. 이 결과가 데이터 수집 우선순위가 된다 [W9].
- **민감도 분석**: 결과가 10% 넘게 바뀌면 민감한 데이터로 본다(ISO 21930) [W8].
- **개선 시나리오 vs 베이스라인**: 재생에너지·대체소재 효과를 % 변화로 비교 [W8].
- 관련 표준: ISO 14006(EMS에 에코디자인 통합), ISO/TR 14062(제품 설계에 환경측면 통합, 인증용 아님) [W14][W16].
- 권장 납품 패키지(일반적 관행): 진단 보고서, 핫스팟 랭킹표, 개선옵션·우선순위, 베이스라인 비교표, 실행 로드맵.

---

## 4. LCA 결과의 활용처별 요구사항

| 활용처 | 기준 | 절차 | 검증 | 유효기간·사후관리 |
|---|---|---|---|---|
| **환경성적표지 (국내)** | 환경성적표지 작성지침(공통지침: 일반제품·건축자재·에너지사용제품 + 개별지침) [K-L3] | 신청·수수료 → (사전심의) → 서류심사 → 현장심사 → 종합심사 → 심의위원회 → 결과통보 → 사용계획서 승인 → 인증서 → 사후관리 [K-E2][K-G]. 총 처리기간 **90일** [K-G] | KEITI 심사원 | **3년**, 연장 신청 시 3년 연장 [K-L1]. 공정·성분 변경 시 변경인증. 1년간 미유통이면 취소 사유 |
| 저탄소제품 | 저탄소제품 기준 [K-L5] | 환경성적표지 인증 제품 중 최대허용탄소배출량 이하 | — | 갱신 때 탄소발자국이 늘면 탈락 [K-L5] |
| International EPD | ISO 14040/44/14025 + PCR [G27] | PCR 선택 → LCA → EPD 작성 → 검증 → 등록·게시 [G27] | 개별 검증인 / 인증기관 / 사전검증 툴 | **5년**, 매년 내부 점검, 지표 10% 이상 증가 시 재검증 [G28] |
| EPD Norway | EN 15804+A2, ISO 14025 [G31] | PCR → LCA → 검증 → 게시 | 독립 검증인 | 5년(프로그램 규정 GPI v4, 2019 기준. 최신판 확인 필요) [G34]. 2024.11 한국 환경성적표지와 상호인정 협정 [K-E1] |
| UL EPD | ISO 14025, 14040/44, PCR [G29] | LCA → 제3자 검증 → 등록 | 작성자와 검증자 분리 | 선언일부터 5년, 만료 60일 전 갱신 요청(2018년판 약관 기준, 최신판 확인 필요) [G35] |
| Carbon Trust 라벨 | Requirements for Assurance [G30] | 산정 → 제3자 검증 → 라벨 | 독립 제3자 | 확인 필요. 탄소중립 클레임은 2023.9 폐지 |

**환경성적표지 상세** [K-E1][K-L2][K-L3][K-L4]
- 7대 영향범주를 모두 산정: 자원발자국, 탄소발자국, 오존층영향, 산성비, 부영양화, 광화학스모그, 물발자국. 표시는 일부만 선택 가능.
- 제출 서류: 인증신청서, 인증신청보고서(작성지침 별표 6)와 근거자료, 사업자등록증, 공장등록증, (중소기업) 중소기업확인증.
- 보고서에 들어가는 항목: 기능단위, 시스템경계, **공정도**, 제품 물질정보, 데이터 품질요건, 할당 방법, 단계별 결과(제조전·제조·사용·폐기).
- 2024 개정으로 재생에너지 전기 사용량, 수출제품의 유통·사용·폐기 데이터, 온실가스 배출량 명세서 활용이 명시됨.
- 수수료: 기본 제품당 5만원 + 심사비(고급기술자 노임단가 × 심사일수) + 제경비(심사비의 110%, 중소기업 면제) + 여비.
- 인증 유형: 신규, 갱신, 변경, 파생제품, 동일제품·제조원 인정, 동일제품 인정.
- 2026.12.10부터 EPD 인증을 받은 자의 컨설팅 비용 지원 근거 신설(법 제20조의2) [K-L1].
- 국가 LCI DB는 매년 제·개정, 상업용 목적 사용 금지. KEITI 전용 LCA 소프트웨어 TOTAL [K-E1].
- **확인 필요**: 단계별 심사일수, 데이터 수집기간, DB 적용 우선순위, 컷오프 기준(공통지침 별표 PDF에만 있음).

---

## 5. LCA 업무 프로세스 (통합)

ISO 14040/44 단계 [R-GHG][R-LEC]와 실무 흐름 [W1~W13]을 합친 것이다.

| # | 단계 | 주요 활동 | 산출물 | 일반 기간 | 자주 막히는 곳 |
|---|---|---|---|---|---|
| 1 | 문의·제안·계약 | 상담, 적용기준 선정(ISO 14040/44, 14067, PEF, PCR, Catena-X/PACT 등) | 제안서, 계약서 | — | 범위 불명확한 채 계약(일반적 관행) |
| 2 | 킥오프·목적/범위 합의 | 목적·독자·공개 비교주장 여부, 기능단위/선언단위, 시스템 경계, 컷오프·할당·품질 요건, 기준기간, 공정흐름도 | 범위정의서, 공정흐름도 | 2~4일 작업 [W1] | 범위 변경 |
| 3 | 스크리닝 | 대표제품으로 먼저 계산해 핫스팟 파악. Catena-X는 97% 커버리지 문서화 [R-CX] | 데이터 요청 목록 | — | — |
| 4 | 데이터 수집 | 양식 발송·작성요령 설명, 구매·생산·ERP·공급사 등 여러 제공자 [W7] | 수집 시트 | **2~3개월, 가장 긴 단계** [W1] | 복잡한 공급망, 공급사 기밀 우려, 무응답·수작업 독촉 [W10][W18] |
| 5 | 현장방문·인터뷰 | 현장에서 에너지·폐기물·자재 확인, 할당 회피에 도움 [W10] | 방문 기록 | — | 담당자 일정 |
| 6 | 데이터 검증·Q&A | 물질수지·누락 점검, 할당·계산 검증 [W6], 가정·공백 문서화 [W7] | 검증 로그, 가정 목록 | — | 할당 방식 합의 |
| 7 | 모델링·영향평가 | 배경 DB 연결, 영향범주 분류·특성화(필수), 정규화·가중(선택) [R-LEC] | 결과표 | 2~4주 [W1] | 배경 DB 선택 |
| 8 | 해석·핫스팟 | 기여도·민감도·시나리오 분석. 경제적 할당이면 민감도 분석 필수 [R-GPI] | 결론·한계, 개선안 | — | — |
| 9 | 보고서 초안·고객 검토 | 고객 검토·수정 | 보고서 초안 | — | 고객 내부 승인 지연 |
| 10 | 제3자 검증·비판적 검토 | 제출 → 사전점검 → 검증인 배정 → 보완요청 ↔ 보완제출(반복) → 완료 [W11]. 공개 비교주장은 3인 이상 패널 [R-ESU] | 검증 의견서 | 완비 서류 기준 2~3주, 응답 지연 시 1~2주 추가 [W12] | 불완전한 자료, PCR 불일치 [W13] |
| 11 | 인증·등록 | 환경성적표지(90일), IES 등록, 고객사 포털 제출 등 | 인증서, 등록 EPD | 제도별 | 보완 요청 |
| 12 | 납품 | LCA 보고서, 인증신청 보고서 [W2] | 최종 보고서 | — | — |
| 13 | 사후관리·갱신 | 매년 점검, 10% 이상 변화 시 재산정, 만료 전 갱신 [R-CX][G28][K-L1] | 갱신 이력 | — | 데이터 재수집 |

- 전체 기간: 스크리닝 4~8주, 전체 LCA 3~6개월, 복잡·다제품 6~10개월 [W1].
- 권고: 가장 중요한 공급사 5곳부터 일찍 수집 시작 [W1].

---

## 6. 고객사에서 받아야 할 자료 체크리스트

| 구분 | 구체 항목 | 단위 예 | 증빙 | 1차/2차 |
|---|---|---|---|---|
| 일반정보 | 사업장명·주소, 담당자, 사업장 생산제품과 비중, 데이터 기간 [R-EPA] | – | 사업장 개요 | 1차 |
| 제품정보 | 제품코드, 기능단위, 제품 중량, 구성재질, 공정 설명, 연간 생산량 [R-EPA] | kg/개 | BOM, 도면, 사양서 | 1차 |
| 원료·부자재 | 투입량, CAS/MSDS, 재생원료 비율(신재/사전/사후), 원산지, 세정제 등 부자재 [R-EPA] | kg/yr (부피면 밀도도) | 구매·입고 기록, MSDS | 투입량 1차, 배출계수는 2차 DB 또는 공급사 PCF |
| 에너지 | 전력, LNG, 유류, 스팀, 자가발전. 공정 외 사용분 제외·표시 [R-EPA]. 녹색전력 계약 [R-GPI] | kWh, Nm³, L | 계량기 검침, 고지서, REC·PPA 계약서 [R-CX] | 1차 |
| 용수·폐수 | 취수원별 사용량, 폐수량, 처리방법, 농도 [R-EPA] | m³, mg/L | 수도 고지서, 수질 측정기록 | 1차 |
| 포장재 | 재질과 중량. 자사 통제이거나 영향 10% 초과면 1차 필수 [R-GPI] | kg | 포장 사양서 | 1차/2차 |
| 운송 | 입고·출하별 수단, 거리, 적재율 [R-GPI] | tkm | 운송장, 물류계약 | 활동량 1차, 계수 2차 |
| 공정 배출·폐기물 | 대기배출(CO₂·CH₄·NOx·VOC 등), 탈루 배출 [R-CX], 폐기물 종류·양·처리(재활용/소각/매립) [R-EPA] | kg/yr | 측정기록, 폐기물 인계서 | 1차 |
| 생산량·할당 근거 | 제품별·공동제품별 생산량, 판매가격, 가동시간 [R-GHG][R-GPI] | kg, 원 | 생산실적, 판매가 | 1차 |
| 사용·폐기 단계 | 사용기간, 사용 중 에너지, 폐기 시나리오 [R-GPI] | kWh/yr | 시험성적서, 매뉴얼 | 주로 시나리오(2차) |
| 공급망 | 공급사 PCF, PDS, DQR, 기준기간, 검증 여부 [R-PTS] | kgCO₂e/단위 | 공급사 PCF 선언서 | 공급사가 1차로 선언한 경우만 1차 [R-CX] |
| (규제별 추가) CBAM | 설비, 생산경로, 직접/간접 배출, 전구체 [G5] | tCO₂e | 검증 보고서 | 1차 |
| (인증 추가) 환경성적표지 | 공정도, 사업자·공장등록증, 온실가스 명세서, 재생전기 증빙, 법정 인허가 증빙 [K-E1][K-L3] | – | 해당 서류 | – |

---

## 7. 데이터 품질 기준

- **1차 데이터**: 자사가 소유·통제하는 공정은 1차 수집 의무 [R-GHG]. 완제품 질량을 활동량으로 그대로 쓰면 1차로 인정 안 됨 [R-GHG]. Catena-X는 활동량과 배출계수가 모두 1차일 때만 PDS에 반영 [R-CX].
- **기간**: 1년 평균이 원칙. Catena-X 최대 3년, 벗어나면 사유 기재 [R-CX]. EN 15804도 1년 원칙 [R-ENO].
- **컷오프**: EPD 기본 1%, 영향·질량·에너지 각각 99% 이상 포함 [R-GPI]. Catena-X 제외분 합계 3% 미만 [R-CX]. PEFCR은 스크리닝 단계 컷오프 금지 [R-PEF].
- **할당 순서**: 할당 회피(공정 세분·시스템 확장) → 물리적 관계 → 경제적 관계 [R-GHG]. EPD는 시스템 확장 불인정, 경제적 할당이면 민감도 분석 필수 [R-GPI].
- **품질 지표**
  - GHG Protocol: 기술·지리·시간 대표성, 완결성, 신뢰성 5개를 수집 중에 평가 [R-GHG].
  - PEF: DQR = (TeR + GR + TiR + P) / 4, 1점이 최고. 자사 데이터는 DQR ≤ 1.6 [R-PEF][R-PRE].
  - PACT: 기술·지리·시간 DQR 각각 1~5 [R-PTS].
  - 실무 설문지: 값마다 측정/계산/추정/가정(M/C/E/A) 표시 [R-EPA].
- **전력 배출계수 우선순위**: GO(공급자 특정) → 공급사 잔여믹스 → 시장 잔여믹스 → 소비믹스 [R-GPI].

**흔한 문제와 대응**

| 문제 | 대응 |
|---|---|
| 1차 활동량에 2차 계수를 곱해 놓고 1차라고 함 [R-RT] | 활동량 출처와 계수 출처를 따로 기록 |
| 사업장 전체 총량만 있음 | 생산량·가동시간으로 나누고 공정 외 사용분 제외 [R-EPA] |
| 12개월 미만 데이터 | 정당화 + 민감도 분석, 1년치 확보 후 재평가 [R-ENO] |
| 부피·질량 혼재 | 밀도 함께 요청 [R-EPA] |
| 공급사 응답 저조 | 표준 템플릿, 공급사 교육 [R-RT] |
| 국내 DB 부족 (국가 LCI DB 794개 [R-KR], 2026.10 에코스퀘어 목록 849건 [K-E1]) | ecoinvent·Sphera로 대체하고 공개 |
| 품질 평가를 나중에 몰아서 함 | 수집 시점에 품질 입력 [R-GHG] |

- 배경 DB: 국가 LCI DB, ecoinvent(v3.12, 26,000개 이상) [R-ECO], Sphera. 소프트웨어: SimaPro, LCA for Experts(구 GaBi), openLCA, KEITI TOTAL.

---

## 8. 시중 LCA 플랫폼 기능 [W17~W27]

| 플랫폼 | 데이터 수집 | 협업/승인 | 품질관리 | 대시보드 |
|---|---|---|---|---|
| One Click LCA | PCR 맞춤 템플릿, 데이터 재사용 | 검증인 공유, 내부검증 제출 시 잠금·Verified/Rejected | 불일치 입력 표시, 감사추적 | 확인 못함 |
| Makersite | 공급사 PCF 요청(개별·일괄·사업장별) | 증빙 승인 시 기본값 자동 적용 | 증빙 유형·유효성, 1차 vs 2차 비교 | 부품-공급사 요청 추적표 |
| Sphera PCF Assessment | 공급사 PCF 대량 수집, 증빙 수집 | 개선 권고 자동 제공 | 품질 자동 점수 | 공급사 응답 대시보드 |
| openLCA Collaboration Server | 저장소 공유 | 버전관리, 리뷰, 역할 | 외부 검토 QA | 변경 로그 |
| EPD Hub(검증) | — | 9단계 상태, 보완 라운드 반복 | — | 지연 리마인더 |
| PACT | 데이터 교환 표준 모델 | 검증 정보 | 품질 지표 | — |

**관리 KPI**: 공급사 응답률·사용 가능 응답 비율, 데이터 커버리지(제품 중량 중 정밀 데이터 비율, 95% 권고 [W7]), 1차 데이터 비중, 검증 보완 라운드 수·고객 응답 대기일, 단계별 소요기간 vs 기준, 인증 접수 후 경과일(90일 대비), 연체 요청 수.

---

## 9. 우리 앱에 주는 시사점 (지금 앱과 비교)

**지금 앱에 이미 있는 것**: 프로젝트·데이터 요청 항목(6개 구분), 진행 단계 5개, 기한 초과·임박 관리와 자동 할 일, 보완 요청, AI 메일 초안 4종, 요청 항목 일괄 생성, 홈 현황.

| 우선순위 | 추가하면 좋은 것 | 근거 |
|---|---|---|
| P1 | 프로젝트 **목적/동인**(2단계 선택: 규제-EU배터리/CBAM/ESPR/CPR/국내 · 고객-PACT/Catena-X/TfS/OEM 양식/ISO 14067 · 진단) + **결과 활용처**(PCF/환경성적표지/IES/EPD Norway/UL/Carbon Trust) | 3·4장 |
| P1 | 범위 정의 필드: 적용기준, 기능단위(수량+단위), 시스템 경계, 기준기간 시작/종료, 컷오프 %, 할당 방법 | 5장 2단계, 7장 |
| P1 | 진행 단계 확장: 계약 → 범위 합의 → 스크리닝 → 데이터 수집 → 데이터 검증·Q&A → 모델링 → 해석 → 보고서 → 제3자 검증 → 인증·등록 → 납품 → 사후관리 | 5장 |
| P1 | 데이터 구분 확장: 일반정보·제품·원료·에너지·용수·포장·운송·배출/폐기물·생산량/할당·사용/폐기·공급망 | 6장 |
| P1 | 데이터 항목 필드: 수량, 단위(부피면 밀도), 기간, 증빙 파일·유형, 활동량/계수 각각 1차·2차, M/C/E/A, 검토 상태(요청→제출→검토→보완→승인/반려) | 6·7장 |
| P1 | Q&A·검증 코멘트: 보완요청↔보완제출 상태, 라운드 자동 카운트, 지적사항 종결 | 5장 10단계 |
| P2 | 제품·BOM, 사업장(단위공정), 공급사 PCF(PACT 필드: declaredUnit, 기준기간, geography, PCF, PDS, DQR, verification) | 6장, [R-PTS] |
| P2 | DQR 수식(TeR·GR·TiR·P), 프로젝트 평균 DQR·PDS·커버리지 롤업 | 7장 |
| P2 | 인증 관리: 인증번호, 만료일(환경성적표지 3년, IES 5년), 매년 점검·갱신 알림, 10% 변화 재산정 트리거 | 4장 |
| P2 | 조건부 마감일: 확정 / 조건부 / 확인 필요 (EU 배터리법처럼 위임법이 늦어지는 경우) | 3-1 |
| P2 | 핫스팟·시나리오 기록: 단계/소재별 기여도, 누적 80%, 베이스라인 대비 % | 3-3 |
| P2 | KPI 대시보드(8장) | 8장 |
| P3 | 고객사·공급사 포털(Experience Cloud): 양식 배포, 증빙 업로드, 리마인더 | 8장 |
| P3 | 환경성적표지 수수료 계산기, 컨설팅 비용 지원(2026.12.10~) 추적 | 4장 |
| P3 | 프로젝트 유형(LCA 수행 / PCF 산정 / LCA 검증 / Tool·IT / 내재화·교육 / 에코디자인 / 비교 LCA), 업종 필드, 원청-협력사 고객 계층, 고객사 연도별 재계약 이력 | 2장 |

---

## 10. 확인 필요 · 면접에서 물어볼 것

- 에코에이블이 쓰는 **표준 데이터 수집 양식**과 제품군별로 달라지는 항목
- LCABLE의 기능과 고객사별 Tool 개발과의 관계
- 환경성적표지 공통지침의 데이터 수집기간·컷오프·DB 우선순위 세부 규칙
- EU 배터리법 탄소발자국 산정 위임법 채택 시점
- EPD Norway·UL EPD 유효기간의 최신 규정(조사한 자료는 2019·2018년판), Carbon Trust 라벨 유효기간
- 프로젝트 관리에 지금 쓰는 도구(엑셀, 그룹웨어 등)와 가장 시간이 많이 드는 단계

> 앱에 쓸 수 있는 공개 데이터(환경성적표지 인증현황, 평가계수, PACT·Catena-X 모델, 공공 배출계수 등)와 이용 조건은 별도 문서 「LCA 관리 앱에 쓸 수 있는 공개 데이터 조사」(public-data-sources.md)에 정리했다.

---

## 출처

**회사** [C1] https://www.saramin.co.kr/zf_user/company-info/view/csn/ZzlQSG5JL081L0dJSWNuS0IyMEZCZz09 · [C2] https://www.ecoable.co.kr/what-we-do · [C3] https://www.ecoable.co.kr/portfolio?tab=lca , ?tab=epd · [C4] https://www.dbpia.co.kr/Journal/articleDetail?nodeId=NODE11440994 · [C5] http://k-netzero.net/sub/service/rnd05.do · [C6] https://www.ecoable.co.kr/client-company

**환경성적표지** [K-E1] https://ecosq.or.kr (EPD 소개·인증소개·LCI DB) · [K-E2] https://ecosq.or.kr/cm/images/sub-epd-img0201-3.svg · [K-G] https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=14800000255 · [K-L1] https://www.law.go.kr/법령/환경기술및환경산업지원법 · [K-L2] https://www.law.go.kr/법령/환경기술및환경산업지원법시행규칙 · [K-L3] https://www.law.go.kr/행정규칙/환경성적표지작성지침 · [K-L4] https://www.law.go.kr/행정규칙/환경성적표지인증신청수수료 · [K-L5] https://www.law.go.kr/행정규칙/저탄소제품기준

**LCA 표준·데이터** [R-GHG] https://ghgprotocol.org/sites/default/files/standards/Product-Life-Cycle-Accounting-Reporting-Standard_041613.pdf · [R-RT] https://GHGprotocol.org/sites/default/files/ghgp/road-testing-summary_product-life-cycle-accounting-and-reporting-standard_final.pdf · [R-LEC] https://moodle2.units.it/pluginfile.php/393848/mod_resource/content/2/04_LCA-3.pdf · [R-ESU] https://esu-services.ch/ourservices/review/ · [R-GPI] https://epd.inti.gob.ar/assets/uploads/1617181375-general-programme-instructions-v-4.pdf (v4.0, 최신 v5.0.1 확인 필요) · [R-PEF] https://eplca.jrc.ec.europa.eu/permalink/PEFCR_guidance_v6.3-2.pdf · [R-PRE] https://pre-sustainability.com/articles/pef-series-data-requirements-in-the-pef-approach/ · [R-CX] https://catena-x.net/wp-content/uploads/2025/10/Catena-X-Product-Carbon-Footprint-Rulebook_v4-with-line-numbers.pdf · [R-PTS] https://docs.carbon-transparency.org/tr/data-exchange-protocol/latest/ · [R-ENO] https://epd-global.com/faq/data-collection-periods-shorter-than-12-months · [R-EPA] https://19january2021snapshot.epa.gov/sites/static/files/2015-04/documents/wire_appendix.pdf · [R-KR] https://koreascience.or.kr/article/JAKO202315167127229.pdf · [R-ECO] https://ecoinvent.org/database/

**규제·고객 요구·해외 EPD** [G1] https://www.arianee.com/en/blog/battery-passport-timeline-2027-2036 · [G2] https://psqr.eu/publications-resources/carbon-footprint-batterie/ · [G4] https://taxation-customs.ec.europa.eu/carbon-border-adjustment-mechanism_en · [G5] https://taxation-customs.ec.europa.eu/carbon-border-adjustment-mechanism/cbam-archive_en · [G6] https://taxation-customs.ec.europa.eu/carbon-border-adjustment-mechanism/cbam-legislation-and-guidance_en · [G7] https://globaltaxnews.ey.com/news/2025-2136-eu-adopts-cbam-omnibus-regulation · [G9] https://environment.ec.europa.eu/strategy/circular-economy/ecodesign-sustainable-products-regulation_en · [G10] https://www.packagingeurope.com/steel-and-aluminium-held-to-new-eu-eco-design-and-energy-labelling-rules/ · [G11] https://circulareconomy.europa.eu/node/10178 · [G13] https://www.lw.com/en/insights/eu-empowering-consumers-directive-new-rules-on-green-claims-apply-from-27-september-2026 · [G15] https://www.kiwa.com/en/de/areas-of-expertise/sustainable-solutions/construction-products-regulation/ · [G16] https://news.seoul.go.kr/env/archives/10609 · [G22] https://www.wbcsd.org/resources/pact-methodology-version-3/ · [G23] https://catena-x.net/use-case-cluster/product-carbon-footprint/ · [G24] https://www.tanso.de/en/blog/from-iso-14067-to-catena-x-pcfs · [G25] https://www.tfs-initiative.com/news/tfs-announces-new-updates-to-the-pcf-guideline · [G26] https://www.apple.com/newsroom/2022/10/apple-calls-on-global-supply-chain-to-decarbonize-by-2030/ · [G27] https://environdec.com/services/epd-creation · [G28] https://environdec.com/news/epd-internal-follow-up · [G29] https://www.ul.com/services/environmental-product-declaration-epds-certification · [G30] https://www.carbontrust.com/what-we-do/product-carbon-footprint-labelling/product-carbon-footprint-label · [G31] https://www.epd-global.com/ · [G32] https://www.compliancegate.com/eu-batteries-regulation-timeline-and-dates/ · [G33] https://traceable.digital/resources/blog/battery-carbon-footprint-declaration-deadline-not-started/ · [G34] https://digi.epd-norge.no/epder/ (GPI v4) · [G35] https://spot.ul.com (UL EPD 약관, 2018)

**실무 흐름·플랫폼** [W1] https://projetcelsius.com/en/faq/acv-eco-conception/combien-de-temps-prend-une-premiere-acv-produit/ · [W2] https://ktr.or.kr/educonsulting/lca/contentsid/2024/index.do · [W6] https://www.keiti.re.kr/site/keiti/02/10202100000002023101610.jsp · [W7] https://helpcenter.ecochain.com/en/articles/9117564-how-to-obtain-data-for-lca · [W8] https://helpcenter.ecochain.com/en/articles/9686921-how-to-interpret-lca-results · [W9] https://pre-sustainability.com/articles/pef-series-hotspot-analysis-in-the-pef-approach/ · [W10] https://go.ipoint-systems.com/blog/obtain-lca-data-from-suppliers-insights-from-a-sustainability-consultant · [W11] https://www.epdhub.com/help/epd-verification-process · [W12] https://www.epdhub.com/help/duration-publishing-and-verification · [W13] https://circularecology.com/verification-process-of-an-epd.html · [W14] https://en.wikipedia.org/wiki/ISO_14006 · [W16] https://www.boutique.afnor.org/en-gb/standard/xp-iso-tr-14062/environmental-management-integrating-environmental-aspects-into-product-des/fa117399/547 · [W17] https://support.makersite.io/request-pcf-from-your-suppliers · [W18] https://makersite.io/masterclass-from-supplier-requests-to-usable-pcf-data-at-scale/ · [W19] https://oneclicklca.com/software/manufacturing/epd-generator · [W20] https://help.oneclicklca.com/en/articles/275657-internal-verification · [W21] https://sphera.com/solutions/supply-chain-transparency/supply-chain-sustainability-solution/product-carbon-footprint-assessment · [W23] https://greendelta.github.io/lca-collaboration-server-manual/print.html · [W27] https://www.wbcsd.org/news/pact-updated-tech-specifications-emissions-data/
