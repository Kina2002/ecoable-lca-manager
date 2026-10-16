/* 업무 설명서 역할: 목록과 같은 프로젝트 한 건을 읽어 자세히 보여준다. */
window.LCA = window.LCA || {};
LCA.views = LCA.views || {};

LCA.views.projectDetail = (() => {
  // WEB-001 SPEC에서 함께 정리한 용어 설명. 규제 적용 여부를 판정하는 규칙은 아니다.
  const PURPOSE_HELP = {
    '고객사 요구 대응': '제품을 사가는 거래처가 요청한 환경정보를 준비하는 일이에요.',
    '규제 대응': '관련 규제·인증 제도에서 요구하는 환경정보와 근거를 준비하는 일이에요.',
    '제품 환경성 진단': '제품의 환경영향이 큰 원인을 찾고, 줄일 방법을 검토하는 일이에요.'
  };
  const BOUNDARY_HELP = {
    '요람~문': '원료를 얻고 운반해 제품을 만들어 공장 문을 나갈 때까지 살펴봐요. 출하 후 사용·최종 폐기는 이 범위에 포함하지 않아요.',
    '요람~무덤': '원료 확보·제조부터 유통·사용, 수명이 끝난 뒤 폐기나 재활용 처리까지 살펴봐요.'
  };
  const UNIT_HELP = {
    kg: 'kg은 킬로그램이에요.',
    t: 't는 톤이에요. 1 t는 1,000 kg이에요.',
    '장': '태양광 패널 한 장처럼 제품의 수를 세는 단위예요.',
    '개': '제품의 수를 세는 단위예요.'
  };

  function textElement(tag, className, value) {
    const element = document.createElement(tag);
    element.className = className;
    element.textContent = value;
    return element;
  }

  function field(label, value, help = '') {
    const item = textElement('div', 'detail-field', '');
    const term = textElement('dt', '', label);
    const description = document.createElement('dd');
    if (Array.isArray(value)) {
      if (value.length) {
        const tags = textElement('ul', 'detail-tags', '');
        value.forEach((tag) => tags.append(textElement('li', '', tag)));
        description.append(tags);
      } else {
        description.append(textElement('span', 'detail-value', '미정'));
      }
    } else {
      description.append(textElement('span', 'detail-value', value || '미정'));
    }
    if (help) description.append(textElement('p', 'detail-help', help));
    item.append(term, description);
    return item;
  }

  function card(title, subtitle, fields) {
    const section = textElement('section', 'detail-card', '');
    section.append(textElement('h2', '', title), textElement('p', 'detail-card-intro', subtitle));
    const descriptionList = textElement('dl', 'detail-fields', '');
    descriptionList.append(...fields);
    section.append(descriptionList);
    return section;
  }

  function render(project) {
    const fragment = document.createDocumentFragment();
    const heading = textElement('div', 'page-heading detail-heading', '');
    const identity = document.createElement('div');
    identity.append(textElement('p', 'eyebrow', 'PROJECT DETAIL'));
    const title = textElement('h1', 'detail-title', project.companyName);
    title.id = 'project-detail-title';
    title.tabIndex = -1;
    if (project.isFictional) title.append(textElement('span', 'fictional-tag', '가상'));
    identity.append(title, textElement('p', 'page-description', `${project.productName} · ${project.code}`));
    heading.append(identity, textElement('span', 'demo-pill', '가상 프로젝트 상세'));
    fragment.append(heading);

    const stage = LCA.constants.stageByNo(project.stage);
    const summary = textElement('dl', 'detail-summary', '');
    const target = field('목표 완료일', project.targetDate ? project.targetDate.replaceAll('-', '.') : '미정', '앱을 연 날짜로 만든 시연용 일정이에요.');
    if (project.targetDate) {
      const time = textElement('time', 'detail-value', project.targetDate.replaceAll('-', '.'));
      time.dateTime = project.targetDate;
      target.querySelector('.detail-value').replaceWith(time);
    }
    summary.append(
      field('고객사 업종', project.industry),
      field('프로젝트 유형', project.type),
      field('현재 단계', stage ? stage.name : '단계 확인 필요', stage ? `${stage.no} / ${LCA.constants.STAGES.length} 단계 · 번호는 업무 순서이며 완료율이 아니에요.` : ''),
      target
    );
    fragment.append(summary);

    const columns = textElement('div', 'detail-columns', '');
    columns.append(card('업무 목적과 활용', '왜 시작했고, 결과를 어디에 쓸까요?', [
      field('업무 목적 · 왜 하나요?', project.purpose, PURPOSE_HELP[project.purpose] || '이 업무를 진행하는 이유예요.'),
      field('세부 동인 · 어떤 요구가 있나요?', project.drivers,
        '이 업무와 관련해 확인할 구체적인 요구나 기준이에요. 실제 적용 조건은 프로젝트 범위를 정할 때 검토해요.'),
      field('결과 활용처 · 어디에 쓰나요?', project.uses,
        '결과를 쓰려는 곳이에요. 여기에 인증 이름이 있어도 이미 인증을 받았다는 뜻은 아니에요.')
    ]));

    const unit = project.functionalUnit;
    const quantity = unit && unit.qty != null && unit.unit ? `${unit.qty} ${unit.unit}` : '미정';
    const scopeFields = [
      field('평가 대상 제품', project.productName),
      field('평가 기준량 · 얼마만큼을 기준으로 하나요?', quantity,
        unit && unit.unit ? `${UNIT_HELP[unit.unit] || ''} 평가 결과를 제품 ${quantity} 기준으로 정리한다는 뜻이에요. 공장의 실제 생산량이 아니에요.`.trim() : '결과를 정리할 기준 수량과 단위를 정해요.'),
      field('시스템 경계 · 어디까지 살펴보나요?', project.boundary,
        BOUNDARY_HELP[project.boundary] || '평가가 시작되고 끝나는 범위를 정해요.')
    ];
    if (project.modules) {
      scopeFields.push(field('평가 모듈', project.modules,
        project.modules === 'A1–A3' ? '건설제품 평가의 단계 표기예요. A1은 원료 공급, A2는 원료 운송, A3는 제품 제조를 뜻해요.' : '이 프로젝트에서 평가할 과정의 구분이에요.'));
    }
    const scope = card('제품과 평가 범위', '무엇을, 얼마만큼, 어디까지 살펴볼까요?', scopeFields);
    scope.append(textElement('p', 'detail-note', '기능·선언 단위는 여기서 기준량으로 간단히 표시했어요. 실제로 제품을 비교하려면 기능·성능·수명 같은 조건도 함께 정해야 해요.'));
    columns.append(scope);
    fragment.append(columns);
    document.querySelector('#project-detail-content').replaceChildren(fragment);
  }

  return { render };
})();
