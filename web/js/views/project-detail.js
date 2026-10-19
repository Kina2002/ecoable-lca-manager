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
    if (help) {
      const explanation = textElement('details', 'field-help', '');
      const summary = textElement('summary', '', '설명'); summary.setAttribute('aria-label', `${label} 설명`);
      explanation.append(summary, textElement('p', 'detail-help', help)); description.append(explanation);
    }
    item.append(term, description);
    return item;
  }

  function card(title, subtitle, fields) {
    const section = textElement('section', 'detail-card', '');
    section.append(textElement('h2', '', title));
    const guide = textElement('details', 'card-field-guide', '');
    guide.append(textElement('summary', '', '항목 설명'), textElement('p', 'detail-help', subtitle));
    for (const item of fields) {
      const help = item.querySelector('.field-help');
      if (!help) continue;
      guide.append(textElement('strong', '', item.querySelector('dt').textContent), help.querySelector('p')); help.remove();
    }
    const descriptionList = textElement('dl', 'detail-fields', '');
    descriptionList.append(...fields);
    section.append(descriptionList, guide);
    return section;
  }

  function scopeCard(project) {
    const unit = project.functionalUnit;
    const quantity = unit && unit.qty != null && unit.unit ? `${unit.qty} ${unit.unit}` : '미정';
    const status = field('범위 상태', project.scopeStatus || '미정', '경계가 적혀 있어도 고객과 합의한 확정안인지 따로 확인해요. 상태 버튼을 누르면 범위 기록으로 바로 이동해요.');
    const jump = textElement('button', 'scope-status-button', `${project.scopeStatus || '미정'} · ${project.stage <= 2 ? '수정' : '기록 보기'}`);
    jump.type = 'button';
    jump.dataset.editScope = '';
    jump.setAttribute('aria-controls', 'scope-editor');
    status.querySelector('.detail-value').replaceWith(jump);
    const researcher = field('담당 연구원', project.researcherName ? `${project.researcherName} · ${project.researcherId ? `RSR-${project.researcherId.split('-').at(-1).padStart(3, '0')}` : '기존 이름 기록'}` : '');
    if (project.researcherName) {
      const link = textElement('button', 'researcher-link', researcher.querySelector('.detail-value').textContent);
      link.type = 'button';
      link.dataset.openResearcher = project.researcherId || 'unlinked';
      link.setAttribute('aria-controls', 'researcher-view');
      link.setAttribute('aria-label', `${project.researcherName} 담당 연구원 화면으로 이동`);
      researcher.querySelector('.detail-value').replaceWith(link);
    }
    const scopeFields = [
      status,
      field('고객 담당자', project.customerContactName),
      researcher,
      field('평가 대상 제품', project.productName),
      field('평가 기준량', quantity,
        unit && unit.unit ? `${UNIT_HELP[unit.unit] || ''} 평가 결과를 제품 ${quantity} 기준으로 정리한다는 뜻이에요. 공장의 실제 생산량이 아니에요.`.trim() : '결과를 정리할 기준 수량과 단위를 정해요.'),
      field('시스템 경계', project.boundary,
        BOUNDARY_HELP[project.boundary] || '평가가 시작되고 끝나는 범위를 정해요.')
    ];
    scopeFields.push(field('기준기간', project.refStart && project.refEnd ? `${project.refStart} ~ ${project.refEnd}` : '미정'));
    scopeFields.push(field('적용 기준', project.standards || []));
    if (project.periodReason) scopeFields.push(field('기준기간 사유', project.periodReason));
    if (project.information) for (const [key,label] of Object.entries(LCA.projects.INFORMATION)) scopeFields.push(field(label, project.information[key] || '미기록'));
    const missingInfo = LCA.projects.missingInformation(project);
    if (missingInfo.length) scopeFields.push(field('추가 확인할 권장 정보', missingInfo, '상단 기본정보 수정에서 보충해요. 지금 단계의 필수 이동 조건과는 구분해요.'));
    scopeFields.push(field('협의 메모', project.scopeMemo || '기록한 메모가 없어요.'));
    if (project.modules) {
      scopeFields.push(field('평가 모듈', project.modules,
        project.modules === 'A1–A3' ? '건설제품 평가의 단계 표기예요. A1은 원료 공급, A2는 원료 운송, A3는 제품 제조를 뜻해요.' : '이 프로젝트에서 평가할 과정의 구분이에요.'));
    }
    const scope = card('제품과 평가 범위', '무엇을, 얼마만큼, 어디까지 살펴볼까요?', scopeFields);
    scope.querySelector('.card-field-guide').append(textElement('p', 'detail-note', '기능·선언 단위는 여기서 기준량으로 간단히 표시했어요. 실제로 제품을 비교하려면 기능·성능·수명 같은 조건도 함께 정해야 해요.'));
    scope.id = 'scope-summary';
    return scope;
  }

  function refreshScope(project) {
    const previous = document.querySelector('#scope-summary'); const next = scopeCard(project);
    next.querySelector('.card-field-guide').open = previous.querySelector('.card-field-guide')?.open || false;
    previous.replaceWith(next);
  }
  function stageField(project) {
    const stage = LCA.constants.stageByNo(project.stage);
    const element = field('현재 단계', stage ? `${stage.name} · ${stage.no}/${LCA.constants.STAGES.length}${project.amendment ? ` · ${project.amendment.number}차 제출 보완 중` : ''}` : '단계 확인 필요', stage ? '번호는 업무 순서이며 완료율이 아니에요.' : '');
    element.id = 'project-current-stage';
    return element;
  }
  function refreshStage(project) {
    document.querySelector('#project-current-stage').replaceWith(stageField(project));
    const edit = document.querySelector('[data-edit-project-basic]');
    if (edit) edit.textContent = (project.amendment?.fromStage || project.stage) >= 10 ? '기본정보·변경 이력' : '기본정보 수정';
  }

  function targetField(project) {
    const target = field('목표 완료일', project.targetDate ? project.targetDate.replaceAll('-', '.') : '미정', '프로젝트 목표일이에요. 자료 수집 마감일·개별 요청 기한과는 별개예요.'); target.id = 'project-target-date';
    if (project.targetDate) { const time = textElement('time', 'detail-value', project.targetDate.replaceAll('-', '.')); time.dateTime = project.targetDate; target.querySelector('.detail-value').replaceWith(time); }
    target.querySelector('dd').append(LCA.views.deadlines.badge(LCA.deadlines.project(project))); return target;
  }
  function purposeCard(project) {
    const result = card('업무 목적과 활용', '왜 시작했고, 결과를 어디에 쓸까요?', [
      field('업무 목적', project.purpose, PURPOSE_HELP[project.purpose] || '이 업무를 진행하는 이유예요.'),
      field('세부 동인', project.drivers, '이 업무와 관련해 확인할 구체적인 요구나 기준이에요. 실제 적용 조건은 프로젝트 범위를 정할 때 검토해요.'),
      field('결과 활용처', project.uses, '결과를 쓰려는 곳이에요. 여기에 인증 이름이 있어도 이미 인증을 받았다는 뜻은 아니에요.')
    ]); result.id = 'project-purpose-summary'; return result;
  }
  function classificationField(key, label, value) { const item = field(label, value); item.id = `project-${key}-summary`; return item; }
  function refreshBasics(project) {
    const title = document.querySelector('#project-detail-title'); title.replaceChildren(document.createTextNode(project.companyName));
    if (project.isFictional) title.append(textElement('span', 'fictional-tag', '가상'));
    document.querySelector('#project-detail-description').textContent = `${project.productName} · ${project.code}`;
    document.querySelector('#project-target-date').replaceWith(targetField(project));
    document.querySelector('#project-industry-summary').replaceWith(classificationField('industry', '고객사 업종', project.industry));
    document.querySelector('#project-type-summary').replaceWith(classificationField('type', '프로젝트 유형', project.type));
    const previousPurpose = document.querySelector('#project-purpose-summary'); const nextPurpose = purposeCard(project);
    nextPurpose.querySelector('.card-field-guide').open = previousPurpose.querySelector('.card-field-guide')?.open || false;
    previousPurpose.replaceWith(nextPurpose); refreshScope(project); refreshStage(project);
  }

  function render(project) {
    const fragment = document.createDocumentFragment();
    const heading = textElement('div', 'page-heading detail-heading', '');
    const identity = textElement('div', 'detail-identity', '');
    identity.append(textElement('p', 'eyebrow', 'PROJECT DETAIL'));
    const title = textElement('h1', 'detail-title', project.companyName);
    title.id = 'project-detail-title';
    title.tabIndex = -1;
    if (project.isFictional) title.append(textElement('span', 'fictional-tag', '가상'));
    const description = textElement('p', 'page-description', `${project.productName} · ${project.code}`); description.id = 'project-detail-description'; identity.append(title, description);
    const back = document.querySelector('#back-to-projects');
    heading.append(back, identity, textElement('span', 'demo-pill', project.origin === 'user' ? '직접 등록한 프로젝트' : '기본 샘플 · 삭제 대상 아님'));
    const edit = textElement('button', 'request-action-button', (project.amendment?.fromStage || project.stage) >= 10 ? '기본정보·변경 이력' : '기본정보 수정'); edit.type = 'button'; edit.dataset.editProjectBasic = project.id;
    edit.setAttribute('aria-haspopup', 'dialog'); edit.setAttribute('aria-controls', 'project-basic-dialog'); heading.append(edit);
    if (project.origin === 'user') {
      const remove = textElement('button', 'request-action-button project-delete-button', '프로젝트 삭제'); remove.type = 'button'; remove.dataset.deleteProject = project.id;
      remove.setAttribute('aria-haspopup', 'dialog'); remove.setAttribute('aria-controls', 'project-delete-dialog'); heading.append(remove);
    }
    fragment.append(heading);

    const summary = textElement('dl', 'detail-summary', '');
    summary.append(
      stageField(project),
      targetField(project),
      classificationField('industry', '고객사 업종', project.industry),
      classificationField('type', '프로젝트 유형', project.type)
    );
    fragment.append(summary);
    const transition = document.createElement('div');
    transition.id = 'collection-transition';

    const tabs = textElement('div', 'detail-tabs', '');
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', '프로젝트 상세 내용');
    for (const [key, label] of [['overview', '개요·범위'], ['requests', '자료 요청'], ['calculation', '계산 자료·결과'], ['interpretation', '결과 해석'], ['report', '보고서'], ['comments', '고객 검토'], ['opinions', '질문·의견'], ['verification', '검토·검증'], ['certification', '인증·등록']]) {
      const tab = textElement('button', 'detail-tab', label);
      tab.type = 'button';
      tab.id = `detail-${key}-tab`;
      tab.dataset.detailTab = key;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-controls', `project-${key}-panel`);
      tab.setAttribute('aria-selected', String(key === 'overview'));
      tab.tabIndex = key === 'overview' ? 0 : -1;
      if (key === 'requests') {
        const count = textElement('span', 'count-badge', '0');
        count.id = 'detail-request-count';
        tab.append(count);
      }
      tabs.append(tab);
    }
    fragment.append(tabs);

    const overview = textElement('div', '', '');
    overview.id = 'project-overview-panel';
    overview.setAttribute('role', 'tabpanel');
    overview.setAttribute('aria-labelledby', 'detail-overview-tab');
    overview.tabIndex = 0;
    const columns = textElement('div', 'detail-columns', '');
    columns.append(purposeCard(project));

    const scope = scopeCard(project);
    columns.append(scope);
    const kickoff = document.createElement('div');
    kickoff.id = 'kickoff-editor';
    const collection = document.createElement('div');
    collection.id = 'collection-deadline-editor';
    overview.append(kickoff, collection, columns);
    const editor = document.createElement('div');
    editor.id = 'scope-editor';
    overview.append(editor);
    const requests = textElement('div', '', '');
    requests.id = 'project-requests-panel';
    requests.setAttribute('role', 'tabpanel');
    requests.setAttribute('aria-labelledby', 'detail-requests-tab');
    requests.tabIndex = 0;
    requests.hidden = true;
    const requestContent = document.createElement('div');
    requestContent.id = 'project-request-content';
    requests.append(transition, requestContent);
    const calculation = textElement('div', '', '');
    calculation.id = 'project-calculation-panel';
    calculation.setAttribute('role', 'tabpanel');
    calculation.setAttribute('aria-labelledby', 'detail-calculation-tab');
    calculation.tabIndex = 0;
    calculation.hidden = true;
    const interpretation = textElement('div', '', '');
    interpretation.id = 'project-interpretation-panel';
    interpretation.setAttribute('role', 'tabpanel');
    interpretation.setAttribute('aria-labelledby', 'detail-interpretation-tab');
    interpretation.tabIndex = 0;
    interpretation.hidden = true;
    const report = textElement('div', '', '');
    report.id = 'project-report-panel';
    report.setAttribute('role', 'tabpanel');
    report.setAttribute('aria-labelledby', 'detail-report-tab');
    report.tabIndex = 0;
    report.hidden = true;
    const comments = textElement('div', '', '');
    comments.id = 'project-comments-panel'; comments.setAttribute('role', 'tabpanel');
    comments.setAttribute('aria-labelledby', 'detail-comments-tab'); comments.tabIndex = 0; comments.hidden = true;
    const verification = textElement('div', '', '');
    verification.id = 'project-verification-panel'; verification.setAttribute('role', 'tabpanel');
    verification.setAttribute('aria-labelledby', 'detail-verification-tab'); verification.tabIndex = 0; verification.hidden = true;
    const certification = textElement('div', '', '');
    certification.id = 'project-certification-panel'; certification.setAttribute('role', 'tabpanel');
    certification.setAttribute('aria-labelledby', 'detail-certification-tab'); certification.tabIndex = 0; certification.hidden = true;
    const opinions = textElement('div', '', ''); opinions.id = 'project-opinions-panel'; opinions.setAttribute('role', 'tabpanel');
    opinions.setAttribute('aria-labelledby', 'detail-opinions-tab'); opinions.tabIndex = 0; opinions.hidden = true;
    fragment.append(overview, requests, calculation, interpretation, report, comments, opinions, verification, certification);
    document.querySelector('#project-detail-content').replaceChildren(fragment);
  }

  return { render, refreshScope, refreshStage, refreshBasics };
})();
