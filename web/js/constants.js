/* 앱 전체에서 쓰는 정해진 값(선택 목록, 단계, 데이터 구분 등). 설계서 3·5장 기준. */
window.LCA = window.LCA || {};

LCA.constants = (() => {
  // 진행 단계 10개 (설계서 3장). gate: 다음 단계로 가기 위한 조건 이름(rules.js에서 판단)
  const STAGES = [
    { no: 1, name: '계약·착수', short: '계약', gate: 'assigned',
      guide: '고객 담당자와 담당 연구원을 지정하고 킥오프 일정을 잡으세요.' },
    { no: 2, name: '범위 정의', short: '범위', gate: 'scope',
      guide: '적용 기준, 기능단위, 시스템 경계, 기준기간(보통 12개월), 컷오프·할당 방법을 정하고 스크리닝으로 중요한 자료를 고르세요.' },
    { no: 3, name: '데이터 수집', short: '수집', gate: 'allSubmitted',
      guide: '요청 항목을 보내고 기한을 관리하세요. 받은 값은 단위·데이터 기간·증빙과 함께 입력합니다.' },
    { no: 4, name: '데이터 검토', short: '검토', gate: 'allApproved',
      guide: '물질수지와 누락을 점검하고, 문제가 있으면 보완 요청, 쓸 수 있으면 승인하세요.' },
    { no: 5, name: '계산(모델링)', short: '계산', gate: 'manual',
      guide: '배경 DB(국가 LCI DB, ecoinvent 등)를 연결해 영향평가를 계산하세요.' },
    { no: 6, name: '결과 해석', short: '해석', gate: 'manual',
      guide: '기여도·민감도·시나리오 분석으로 핫스팟을 찾고 개선안을 정리하세요.' },
    { no: 7, name: '보고서', short: '보고서', gate: 'customerReviewClosed',
      guide: '보고서 초안을 고객에게 보내고, 고객 검토 의견을 모두 반영해 종결하세요.' },
    { no: 8, name: '검토·검증', short: '검토·검증', gate: 'verificationClosed',
      guide: '내부 검토를 기록하고 보고서를 확정하세요. 외부 검토를 선택했다면 검증기관의 차수별 지적·답변·종결 근거도 남깁니다.' },
    { no: 9, name: '인증·등록', short: '인증', gate: 'manual',
      guide: '환경성적표지 심사(처리 90일), EPD 등록, 고객사 포털 제출 등 결과 활용처별 절차를 진행하세요.' },
    { no: 10, name: '완료·사후관리', short: '완료', gate: null,
      guide: '납품을 마쳤어요. 매년 점검하고, 공정·배출이 10% 이상 바뀌거나 만료가 다가오면 갱신을 준비하세요.' }
  ];

  // 데이터 구분 11개와 기본 요청 문장 (자료조사 6장)
  const CATEGORIES = [
    { key: 'general', name: '일반정보', unit: '', detail: '사업장명·주소, 사업장 생산제품과 생산 비중, 데이터 기간' },
    { key: 'product', name: '제품정보', unit: 'kg', detail: '제품 사양, 단위 중량, 구성 재질(BOM), 연간 생산량' },
    { key: 'material', name: '원료·부자재', unit: 'kg', detail: '주요 원료·부자재 연간 투입량, 재생원료 비율, 원산지(MSDS 포함)' },
    { key: 'energy', name: '에너지', unit: 'kWh', detail: '공정별 연간 전력·연료(LNG, 유류, 스팀) 사용량, 녹색전력 계약 여부' },
    { key: 'water', name: '용수·폐수', unit: 'm³', detail: '취수원별 연간 용수 사용량, 폐수 발생량과 처리 방법' },
    { key: 'packaging', name: '포장재', unit: 'kg', detail: '제품 포장재 종류와 개당 중량' },
    { key: 'transport', name: '운송', unit: 'tkm', detail: '원료 입고·제품 출하 운송수단, 거리, 적재율' },
    { key: 'emission', name: '공정 배출·폐기물', unit: 'kg', detail: '공정 대기배출, 폐기물 종류·발생량과 처리 방법(재활용·소각·매립)' },
    { key: 'allocation', name: '생산량·할당 근거', unit: 'kg', detail: '제품별·공동제품별 연간 생산량, 판매가격, 가동시간' },
    { key: 'useEol', name: '사용·폐기 단계', unit: '', detail: '사용기간, 사용 중 에너지, 폐기 시나리오' },
    { key: 'supply', name: '공급망', unit: 'kgCO₂e', detail: '주요 공급사 PCF, 1차 데이터 비중, 기준기간, 검증 여부' }
  ];

  // 구분은 앱의 분류다. 확인한 별표 6의 관련 칸을 자료 준비용 근거로 연결한다.
  // 모든 프로젝트에 국내 인증 지침이 의무 적용된다고 판정하는 기능은 아니다.
  const REQUEST_GUIDELINE = {
    source: '환경성적표지 작성지침 별표 6 · 인증신청보고서',
    url: 'https://law.go.kr/flDownload.do?bylClsCd=200201&flNm=' + encodeURIComponent('[별표 6] 환경성적표지 인증신청보고서(제4조제7항 관련)') + '&flSeq=154685071',
    checkedOn: '2026-10-16',
    note: '국내 환경성적표지의 자료 준비를 위한 참고 근거예요. 프로젝트에 적용할 기준과 범위를 함께 확인하세요.'
  };
  const CATEGORY_REFERENCES = {
    general: { section: 'I. 제품 개요 / II.3 데이터 수집', page: 2 },
    product: { section: 'I. 제품정보 / II.1 계산기준', page: 2 },
    material: { section: 'III.2.1 원부자재', page: 8 },
    energy: { section: 'III.3.1 제품 생산 · 투입물 자료', page: 14 },
    water: { section: 'III.3.1 제품 생산 · 투입·산출물 자료', page: 14 },
    packaging: { section: 'III.1.2·1.3 / III.2.2·2.3 포장재', page: 7 },
    transport: { section: 'III.2.4 원료 수송 / III.3.2 제품 유통', page: 13 },
    emission: { section: 'III.3.1 제품 생산 · 산출물 자료', page: 14 },
    allocation: { section: 'II.4 할당 / III.3.1 제품 생산', page: 4 },
    useEol: { section: 'III.4 제품사용 / III.5 제품 폐기', page: 17 },
    supply: { section: 'III.2.1 원부자재 · 근거자료와 LCI DB', page: 8,
      note: '원료의 근거자료와 DB 기록을 참고해요. PCF·1차 데이터 비중 등의 세부 항목은 PACT·TfS 등 프로젝트의 적용 지침도 확인하세요.' }
  };
  function requestGuideline(categoryKey) {
    const reference = CATEGORY_REFERENCES[categoryKey];
    return reference ? { ...REQUEST_GUIDELINE, ...reference } : null;
  }

  // 데이터 요청 항목 상태 (요청 → 제출됨 → 검토 중 → 보완 요청 → 승인 / 해당 없음)
  const STATUSES = ['요청', '제출됨', '검토 중', '보완 요청', '승인', '해당 없음'];
  const OPEN_STATUSES = ['요청', '보완 요청']; // 고객사가 아직 내야 하는 상태
  const SUBMITTED_STATUSES = ['제출됨', '검토 중', '승인']; // 제출 이상

  const PROJECT_TYPES = ['LCA 수행', 'PCF 산정', 'LCA 검증', '환경성 진단(에코디자인)', '비교 LCA'];
  const PURPOSES = ['고객사 요구 대응', '규제 대응', '제품 환경성 진단'];
  const DRIVERS = {
    '규제': ['EU 배터리법', 'EU CBAM', 'EU ESPR·DPP', 'EU CPR·EN 15804', '국내 환경성적표지·녹색제품'],
    '고객 요구': ['PACT', 'Catena-X', 'TfS', 'OEM 자체 양식', 'ISO 14067 검증'],
    '진단': ['핫스팟 분석', '에코디자인', '비교 평가']
  };
  const USES = ['PCF', '환경성적표지', '저탄소제품', 'International EPD', 'EPD Norway', 'UL EPD', 'Carbon Trust', '고객사 제출', '내부 진단'];
  const STANDARDS = ['ISO 14040/44', 'ISO 14067', 'GHG Protocol Product', 'PEF', 'EN 15804+A2', '환경성적표지 작성지침', 'PACT', 'Catena-X'];
  const BOUNDARIES = ['요람~문 (cradle-to-gate)', '요람~무덤 (cradle-to-grave)', '기타'];
  const DEADLINE_TYPES = ['확정', '조건부', '확인 필요'];
  const INDUSTRIES = ['석유화학·화학', '배터리·소재', '철강·금속', '전자·부품', '포장재', '소비재·식품', '자동차', '건자재', '공공', '기타'];
  const DEPTS = ['구매', '생산', '시설관리', '환경안전', '물류', '재무·ERP', '품질', '연구개발', '협력사'];
  const DATA_SOURCES = ['1차', '2차'];
  const METHODS = ['측정', '계산', '추정', '가정'];
  const EVIDENCE_TYPES = ['고지서', '계량기 검침표', '생산실적', '구매·입고 기록', 'BOM·사양서', 'MSDS', '폐기물 인계서', '운송장', '측정기록', '공급사 PCF 선언서', '기타'];
  const COMMENT_KINDS = ['자료 질의', '고객 검토', '제3자 검증'];
  const COMMENT_STATUSES = ['열림', '답변됨', '종결'];

  // 메일 종류 4가지
  const MAIL_TYPES = [
    { key: 'reminder', name: '독촉 메일', icon: '🔴', desc: '기한 지난·보완 필요 자료 (임박 자료도 함께)' },
    { key: 'dueSoon', name: '마감 임박 안내', icon: '🟡', desc: '3일 이내에 마감되는 자료만' },
    { key: 'revision', name: '보완 요청', icon: '🟠', desc: '받은 자료 중 다시 받을 것만' },
    { key: 'info', name: '정보 확인', icon: '🔵', desc: '담당자·목표일·범위 등 빈 정보 문의' }
  ];

  return {
    STAGES, CATEGORIES, REQUEST_GUIDELINE, requestGuideline, STATUSES, OPEN_STATUSES, SUBMITTED_STATUSES, PROJECT_TYPES, PURPOSES, DRIVERS, USES,
    STANDARDS, BOUNDARIES, DEADLINE_TYPES, INDUSTRIES, DEPTS, DATA_SOURCES, METHODS, EVIDENCE_TYPES,
    COMMENT_KINDS, COMMENT_STATUSES, MAIL_TYPES,
    categoryByName: (name) => CATEGORIES.find((c) => c.name === name),
    stageByNo: (no) => STAGES.find((s) => s.no === no)
  };
})();
