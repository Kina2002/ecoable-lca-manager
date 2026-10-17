/* 게시판 역할: 전달받은 프로젝트 명단을 화면에 옮긴다. 자료 자체를 수정하지 않는다. */
window.LCA = window.LCA || {};
LCA.views = LCA.views || {};

LCA.views.projectList = (() => {
  // textContent로 글자를 넣어, 데이터 안의 문장이 HTML 코드로 실행되지 않게 한다.
  function textElement(tag, className, value) {
    const element = document.createElement(tag);
    element.className = className;
    element.textContent = value;
    return element;
  }

  function cell(label) {
    const element = document.createElement('td');
    if (label) {
      const mobileLabel = textElement('span', 'mobile-label', label);
      mobileLabel.setAttribute('aria-hidden', 'true');
      element.append(mobileLabel);
    }
    return element;
  }

  function stageTone(stage) {
    if (stage === 10) return 'complete';
    if (stage >= 7) return 'verification';
    if (stage >= 4) return 'analysis';
    if (stage === 3) return 'collection';
    return 'setup';
  }

  function render(projects, selectedStage = null, totalCount = projects.length, filtersActive = false, deadlines = {}) {
    const rows = document.querySelector('#project-rows');
    const fragment = document.createDocumentFragment();

    projects.forEach((project) => {
      const row = document.createElement('tr');
      row.dataset.projectId = project.id;

      const company = cell();
      const companyLine = textElement('div', 'company-line', '');
      companyLine.append(textElement('strong', 'company-name', project.companyName));
      if (project.isFictional) companyLine.append(textElement('span', 'fictional-tag', '가상'));
      const detailButton = textElement('button', 'project-code', project.code);
      detailButton.type = 'button';
      detailButton.dataset.openProject = project.id;
      detailButton.setAttribute('aria-label', `${project.code} ${project.companyName} 상세 보기`);
      const arrow = textElement('span', 'project-code-arrow', '↗');
      arrow.setAttribute('aria-hidden', 'true');
      detailButton.append(arrow);
      company.append(companyLine, detailButton);
      company.append(textElement('p', 'project-researcher', `담당 연구원: ${project.researcherName || '미정'}${project.researcherId ? ` · ${LCA.projectFilter.researcherCode(project.researcherId)}` : project.researcherName ? ' · 기존 이름 기록' : ''}`));

      const product = cell();
      const unit = project.functionalUnit;
      const quantity = unit?.qty && unit?.unit ? `${unit.qty} ${unit.unit}` : '기준량 미정';
      const scope = `${quantity} · ${project.boundary || '경계 미정'}${project.modules ? ` (${project.modules})` : ''}`;
      product.append(
        textElement('span', 'product-name', project.productName),
        textElement('span', 'product-scope', scope),
        textElement('span', 'scope-status', `범위: ${project.scopeStatus || '미정'}`)
      );

      const purpose = cell('업무 목적');
      purpose.append(textElement('span', 'purpose', project.purpose));

      const stageCell = cell('현재 단계');
      const stage = LCA.constants.stageByNo(project.stage);
      if (stage) {
        const badge = textElement('span', `stage-badge stage-badge--${stageTone(stage.no)}`, '');
        const dot = textElement('span', 'small-dot', '');
        dot.setAttribute('aria-hidden', 'true');
        badge.append(dot, document.createTextNode(stage.name));
        stageCell.append(badge, textElement('span', 'stage-number', `${String(stage.no).padStart(2, '0')} / 10 단계`));
      } else {
        stageCell.append(textElement('span', 'purpose', '단계 확인 필요'));
      }

      const target = cell('일정 · 자료 현황');
      target.append(textElement('span', 'deadline-label', '프로젝트 목표'));
      target.append(LCA.views.deadlines.badge(LCA.deadlines.project(project)));
      if (project.targetDate) {
        const time = textElement('time', 'target-date', project.targetDate.replaceAll('-', '.'));
        time.dateTime = project.targetDate;
        target.append(time);
      } else {
        target.append(textElement('span', 'target-date', '미정'));
      }
      const materials = textElement('div', 'project-deadline-materials', '');
      materials.append(textElement('span', 'deadline-label', '자료 현황'));
      materials.append(LCA.views.deadlines.badge(deadlines.collectionDates?.ok === false
        ? { staticText: true, text: '수집 일정 확인 필요', tone: 'unknown' } : LCA.deadlines.collection(project)));
      if (deadlines.collectionDates?.ok !== false && project.collectionDueDate) materials.append(textElement('span', 'deadline-detail', `수집 마감 ${project.collectionDueDate.replaceAll('-', '.')}`));
      if (!deadlines.requests?.ok) {
        const warning = textElement('span', 'deadline-badge deadline-badge--unknown', '자료 확인 필요');
        warning.title = deadlines.requests?.message || '자료 기록을 읽을 수 없어요.';
        materials.append(warning);
      } else {
        const state = LCA.deadlines.summary(project.id, deadlines.requests.items);
        materials.append(textElement('span', 'deadline-detail', state.total ? `승인 ${state.approved}/${state.total}건` : '요청 기록 없음'));
        if (state.sourceId) materials.append(textElement('span', 'deadline-detail', `가장 이른 요청: ${state.sourceId} · ${state.status} · ${state.date}`));
      }
      target.append(materials);

      row.append(company, product, purpose, stageCell, target);
      fragment.append(row);
    });

    rows.replaceChildren(fragment);
    const stage = LCA.constants.stageByNo(selectedStage);
    document.querySelector('#project-list-label').textContent = stage ? `${stage.name} 프로젝트` : '전체 프로젝트';
    document.querySelector('#project-count').textContent = projects.length;
    document.querySelector('#list-context').textContent = stage
      ? `${stage.name} · 전체 ${totalCount}개 중 ${projects.length}개 표시`
      : `전체 ${totalCount}개 중 ${projects.length}개 표시`;
    document.querySelector('#empty-state').textContent = filtersActive ? '검색·필터 조건에 맞는 프로젝트가 없어요. 조건을 바꾸거나 초기화해 주세요.' : stage
      ? `${stage.name} 단계의 프로젝트가 없습니다.`
      : '아직 등록된 프로젝트가 없습니다.';
    document.querySelector('.project-table').hidden = projects.length === 0;
    document.querySelector('#empty-state').hidden = projects.length !== 0;
  }

  return { render };
})();
