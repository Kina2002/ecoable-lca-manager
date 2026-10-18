window.LCA = window.LCA || {};
LCA.views = LCA.views || {};
LCA.views.researchers = (() => {
  function text(tag, className, value) {
    const node = document.createElement(tag); node.className = className; node.textContent = value; return node;
  }
  function init(store, getProjects, onOpenProject) {
    const form = document.querySelector('#researcher-form');
    const input = document.querySelector('#researcher-name');
    const company = document.querySelector('#researcher-company'); const department = document.querySelector('#researcher-department');
    const dialog = document.querySelector('#researcher-edit-dialog'); const editForm = document.querySelector('#researcher-edit-form');
    const editFields = Object.fromEntries(['name', 'company', 'department'].map((key) => [key, document.querySelector(`#researcher-edit-${key}`)]));
    const editError = document.querySelector('#researcher-edit-error'); let editing = null;
    const message = document.querySelector('#researcher-save-status');
    const results = document.querySelector('#researcher-results');
    const error = document.querySelector('#researcher-list-error');
    const jumpStatus = document.querySelector('#researcher-jump-status');
    const cardsById = new Map();
    let unlinkedProjects = [];
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
      cardsById.clear();
      unlinkedProjects = [];
      jumpStatus.hidden = true;
      jumpStatus.textContent = '';
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
      unlinkedProjects = overview.unlinked;
      const cards = overview.rows.map((person) => {
        const card = text('section', 'detail-card researcher-card', '');
        cardsById.set(person.id, card);
        card.setAttribute('aria-label', `${person.name} ${person.code} 담당 프로젝트`);
        const heading = text('h2', '', person.name);
        heading.append(text('span', 'fictional-tag', '가상'));
        const edit = text('button', 'request-action-button', '연구원 정보 수정'); edit.type = 'button'; edit.dataset.editResearcher = person.id; edit.setAttribute('aria-haspopup', 'dialog'); edit.setAttribute('aria-controls', 'researcher-edit-dialog'); edit.setAttribute('aria-label', `${person.name} ${person.code} 연구원 정보 수정`);
        card.append(heading, text('p', 'detail-help', `회사: ${person.company || '미정'} · 부서: ${person.department || '미정'}`), text('p', 'detail-help', `${person.code} · 담당 프로젝트 ${person.projects.length}개 (완료 포함)`), edit, projectList(person.projects, person.projects.some((p) => p.researcherName !== person.name)));
        return card;
      });
      if (overview.unlinked.length) {
        const card = text('section', 'detail-card researcher-card', '');
        cardsById.set('unlinked', card);
        card.setAttribute('aria-label', '연구원 연결 확인');
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
      const result = store.add(input.value, company.value, department.value);
      message.textContent = result.ok ? `${result.item.name} · ${result.item.code} 연구원을 등록했어요. 프로젝트의 계약 단계 상세에서 선택해 주세요.` : result.error;
      input.setAttribute('aria-invalid', String(!result.ok));
      if (result.ok) { form.reset(); refresh(); }
      input.focus();
    });
    results.addEventListener('click', (event) => {
      const edit = event.target.closest('[data-edit-researcher]');
      if (edit) {
        const loaded = store.list(); const person = loaded.ok && loaded.items.find((p) => p.id === edit.dataset.editResearcher);
        if (!person) { message.textContent = loaded.error || '연구원을 찾을 수 없어요.'; return; }
        editing = { ...person }; editError.textContent = '';
        for (const [key, field] of Object.entries(editFields)) field.value = person[key];
        dialog.showModal(); editFields.name.focus(); return;
      }
      const button = event.target.closest('[data-researcher-project]');
      if (button) onOpenProject(button.dataset.researcherProject, button);
    });
    document.querySelector('#researcher-edit-cancel').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => {
      if (editing) results.querySelector(`[data-edit-researcher="${editing.id}"]`)?.focus({ preventScroll: true }); editing = null;
    });
    editForm.addEventListener('input', () => { editError.textContent = ''; });
    editForm.addEventListener('submit', (event) => {
      event.preventDefault(); if (!editing) return;
      const result = store.update(editing.id, Object.fromEntries(Object.entries(editFields).map(([key, field]) => [key, field.value])), editing);
      if (!result.ok) { editError.textContent = result.error; editError.tabIndex = -1; editError.focus(); return; }
      message.textContent = `${result.item.name} · ${result.item.code}의 회사·부서·이름을 저장했어요. 새 요청문에 최신 정보가 들어가요.`;
      refresh(); dialog.close();
    });
    function focusResearcher(id) {
      refresh();
      const card = cardsById.get(id) || (unlinkedProjects.some((project) => project.researcherId === id) ? cardsById.get('unlinked') : null);
      jumpStatus.hidden = false;
      jumpStatus.textContent = card ? (cardsById.get('unlinked') === card ? '기존 이름 또는 연결 확인이 필요한 기록으로 이동했어요.' : '선택한 연구원의 담당 프로젝트로 이동했어요.') : '선택한 연구원 연결을 찾지 못했어요. 현재 목록과 안내를 확인해 주세요.';
      if (card) {
        card.classList.add('researcher-card--selected');
        card.tabIndex = -1;
        card.focus({ preventScroll: true });
        card.scrollIntoView({ block: 'center' });
      } else document.querySelector('#researcher-title').focus();
    }
    return { refresh, focusResearcher };
  }
  return { init };
})();
