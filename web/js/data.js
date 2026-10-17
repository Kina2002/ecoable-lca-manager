/* 명단 역할: 설계서 v02 9-3장의 가상 프로젝트 7개. 화면을 그리는 코드는 넣지 않는다. */
window.LCA = window.LCA || {};

LCA.data = (() => {
  // 목표일은 시연용 일정이다. 실제 회사의 계약일·마감일을 가져온 값이 아니다.
  // 앱을 연 날짜에 맞춰 새로 만들어, 나중에 열어도 일정을 체험할 수 있게 한다.
  function createSampleProjects(referenceDate = LCA.rules.today()) {
    const definitions = [
      {
        id: 'project-001', code: 'LCA-2026-001', companyName: '라온소재', industry: '배터리·소재',
        productName: '양극재 전구체', functionalUnit: { qty: 1, unit: 'kg' },
        boundary: '요람~문', modules: '', type: 'PCF 산정', purpose: '고객사 요구 대응',
        drivers: ['Catena-X', 'EU 배터리법'], uses: ['PCF', '환경성적표지'], stage: 3, targetOffset: 45, collectionOffset: 7
      },
      {
        id: 'project-002', code: 'LCA-2026-002', companyName: '솔뫼철강', industry: '철강·금속',
        productName: '코일 철근', functionalUnit: { qty: 1, unit: 't' },
        boundary: '요람~문', modules: 'A1–A3', type: 'LCA 수행', purpose: '규제 대응',
        drivers: ['EU CPR·EN 15804'], uses: ['International EPD'], stage: 8, targetOffset: 24
      },
      {
        id: 'project-003', code: 'LCA-2026-003', companyName: '다온케미칼', industry: '석유화학·화학',
        productName: '카본블랙', functionalUnit: { qty: 1, unit: 'kg' },
        boundary: '요람~문', modules: '', type: 'PCF 산정', purpose: '고객사 요구 대응',
        drivers: ['TfS', 'PACT'], uses: ['PCF', '고객사 제출'], stage: 4, targetOffset: 35
      },
      {
        id: 'project-004', code: 'LCA-2026-004', companyName: '새봄리사이클', industry: '포장재',
        productName: 'rPET 재생 칩', functionalUnit: { qty: 1, unit: 'kg' },
        boundary: '요람~문', modules: '', type: '환경성 진단(에코디자인)', purpose: '제품 환경성 진단',
        drivers: ['핫스팟 분석', '비교 평가'], uses: ['내부 진단'], stage: 6, targetOffset: 14
      },
      {
        id: 'project-005', code: 'LCA-2026-005', companyName: '해든솔라', industry: '전자·부품',
        productName: '태양광 패널', functionalUnit: { qty: 1, unit: '장' },
        boundary: '요람~무덤', modules: '', type: 'LCA 수행', purpose: '규제 대응',
        drivers: ['국내 환경성적표지·녹색제품'], uses: ['환경성적표지', '저탄소제품'], stage: 2, targetOffset: 75
      },
      {
        id: 'project-006', code: 'LCA-2026-006', companyName: '단단내화', industry: '건자재',
        productName: '내화물', functionalUnit: { qty: 1, unit: 't' },
        boundary: '요람~문', modules: '', type: 'LCA 수행', purpose: '규제 대응',
        drivers: ['국내 환경성적표지'], uses: ['환경성적표지'], stage: 10, targetOffset: -14
      },
      {
        id: 'project-007', code: 'LCA-2026-007', companyName: '이음모빌리티', industry: '자동차',
        productName: '자동차 부품', functionalUnit: { qty: 1, unit: '개' },
        boundary: '요람~문', modules: '', type: 'LCA 검증', purpose: '고객사 요구 대응',
        drivers: ['OEM 자체 양식', 'ISO 14067 검증'], uses: ['고객사 제출'], stage: 1, targetOffset: 100
      }
    ];

    // 프로젝트별 합의 상태를 명시한다. 단계 번호로 상태를 자동 추론하지 않는다.
    const scopeSamples = {
      'project-001': '확정', 'project-002': '확정', 'project-003': '확정',
      'project-004': '확정', 'project-005': '협의 중', 'project-006': '확정', 'project-007': '고객 요청안'
    };
    // 모두 시연용 인물이다. 실제 고객·회사 직원과 관계없는 가상 배정이다.
    const assignees = [
      ['김민서', 'researcher-sample-1', '김하늘'], ['이준호', 'researcher-sample-2', '박서연'],
      ['박지은', 'researcher-sample-1', '김하늘'], ['최유진', 'researcher-sample-3', '이도윤'],
      ['정서현', 'researcher-sample-3', '이도윤'], ['한도현', 'researcher-sample-2', '박서연'],
      ['윤지후', 'researcher-sample-1', '김하늘']
    ];
    return definitions.map(({ targetOffset, collectionOffset, ...project }, index) => ({
      ...project,
      isFictional: true,
      customerContactName: assignees[index][0], researcherId: assignees[index][1], researcherName: assignees[index][2],
      scopeStatus: scopeSamples[project.id],
      refStart: project.id === 'project-007' ? '' : '2025-01-01',
      refEnd: project.id === 'project-007' ? '' : '2025-12-31',
      periodReason: '',
      standards: project.id === 'project-007' ? [] : ['ISO 14040/44'],
      targetDate: LCA.rules.addDays(referenceDate, targetOffset),
      collectionDueDate: collectionOffset === undefined ? '' : LCA.rules.addDays(referenceDate, collectionOffset)
    }));
  }

  return { createSampleProjects };
})();
