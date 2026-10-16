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

  function render(projects) {
    const rows = document.querySelector('#project-rows');
    const fragment = document.createDocumentFragment();

    projects.forEach((project) => {
      const row = document.createElement('tr');
      row.dataset.projectId = project.id;

      const company = cell();
      const companyLine = textElement('div', 'company-line', '');
      companyLine.append(textElement('strong', 'company-name', project.companyName));
      if (project.isFictional) companyLine.append(textElement('span', 'fictional-tag', '가상'));
      company.append(companyLine, textElement('span', 'project-code', project.code));

      const product = cell();
      const unit = project.functionalUnit;
      const scope = `${unit.qty} ${unit.unit} · ${project.boundary}${project.modules ? ` (${project.modules})` : ''}`;
      product.append(
        textElement('span', 'product-name', project.productName),
        textElement('span', 'product-scope', scope)
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

      const target = cell('목표 완료일');
      if (project.targetDate) {
        const time = textElement('time', 'target-date', project.targetDate.replaceAll('-', '.'));
        time.dateTime = project.targetDate;
        target.append(time);
      } else {
        target.append(textElement('span', 'target-date', '미정'));
      }

      row.append(company, product, purpose, stageCell, target);
      fragment.append(row);
    });

    rows.replaceChildren(fragment);
    document.querySelector('#project-count').textContent = projects.length;
    document.querySelector('.project-table').hidden = projects.length === 0;
    document.querySelector('#empty-state').hidden = projects.length !== 0;
  }

  return { render };
})();
