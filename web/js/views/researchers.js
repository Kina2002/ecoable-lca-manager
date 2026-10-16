window.LCA = window.LCA || {};
LCA.views = LCA.views || {};
LCA.views.researchers = (() => {
  function text(tag, className, value) {
    const node = document.createElement(tag); node.className = className; node.textContent = value; return node;
  }
  function init(store, getProjects, onOpenProject) {
    const form = document.querySelector('#researcher-form');
    const input = document.querySelector('#researcher-name');
    const message = document.querySelector('#researcher-save-status');
    const results = document.querySelector('#researcher-results');
    const error = document.querySelector('#researcher-list-error');
    function projectList(projects, showRecordedName = false) {
      const list = text('ul', 'researcher-projects', '');
      if (!projects.length) list.append(text('li', 'detail-help', '맡은 프로젝트가 없어요. 계약 단계 상세에서 담당 연구원으로 선택할 수 있어요.'));
      for (const project of projects) {
        const row = document.createElement('li');
        const button = text('button', 'project-code', `${project.code} · ${project.companyName}`);
        button.type = 'button'; button.dataset.researcherProject = project.id;
        row.append(button, text('span', 'fictional-tag', '가상'));
        row.append(text('p', 'detail-help', `${project.productName} · ${LCA.constants.stageByNo(project.stage)?.name || '단계 확인 필요'}${showRecordedName ? ` · 기록된 이름: ${project.researcherName || '미정'}` : ''}`));
        list.append(row);
      }
      return list;
    }
    function refresh() {
      const roster = store.list();
      const projectResult = getProjects();
      if (!roster.ok || !projectResult.ok) {
        error.hidden = false;
        error.textContent = roster.error || projectResult.error;
        results.replaceChildren();
        document.querySelector('#researcher-count').textContent = '확인 필요';
        return;
      }
      error.hidden = true;
      document.querySelector('#researcher-count').textContent = `${roster.items.length}명`;
      const overview = LCA.researchers.overview(roster.items, projectResult.items);
      const cards = overview.rows.map((person) => {
        const card = text('section', 'detail-card researcher-card', '');
        const heading = text('h2', '', person.name);
        heading.append(text('span', 'fictional-tag', '가상'));
        card.append(heading, text('p', 'detail-help', `${person.code} · 담당 프로젝트 ${person.projects.length}개 (완료 포함)`), projectList(person.projects));
        return card;
      });
      if (overview.unlinked.length) {
        const card = text('section', 'detail-card researcher-card', '');
        card.append(text('h2', '', '연구원 연결 확인'), text('p', 'detail-help', '기존 이름만 기록했거나 연결을 확인할 수 없는 프로젝트예요. 이름은 유지했으며 등록 연구원의 담당 프로젝트로 자동 합산하지 않아요.'), projectList(overview.unlinked, true));
        cards.push(card);
      }
      if (overview.unassigned.length) {
        const card = text('section', 'detail-card researcher-card', '');
        card.append(text('h2', '', '담당 연구원 미정'), projectList(overview.unassigned));
        cards.push(card);
      }
      results.replaceChildren(...cards);
    }
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const result = store.add(input.value);
      message.textContent = result.ok ? `${result.item.name} · ${result.item.code} 연구원을 등록했어요. 프로젝트의 계약 단계 상세에서 선택해 주세요.` : result.error;
      input.setAttribute('aria-invalid', String(!result.ok));
      if (result.ok) { form.reset(); refresh(); }
      input.focus();
    });
    results.addEventListener('click', (event) => {
      const button = event.target.closest('[data-researcher-project]');
      if (button) onOpenProject(button.dataset.researcherProject, button);
    });
    return { refresh };
  }
  return { init };
})();
