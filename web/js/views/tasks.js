window.LCA = window.LCA || {};
LCA.views = LCA.views || {};
LCA.views.tasks = (() => {
  function text(tag, className, value) { const node = document.createElement(tag); node.className = className; node.textContent = value; return node; }
  function init(getState, onOpen) {
    const root = document.querySelector('#tasks-view');
    const filters = root.querySelector('#task-kind-filters'); const people = root.querySelector('#task-researcher');
    const search = root.querySelector('#task-search'); const list = root.querySelector('#task-items');
    const error = root.querySelector('#task-error'); const summary = root.querySelector('#task-summary');
    const feedback = root.querySelector('#task-feedback'); let kind = ''; let state = null; let stateKey = '';
    const buttons = new Map();
    for (const [key, label] of [['', '전체'], ...Object.entries(LCA.tasks.KINDS)]) {
      const button = text('button', 'request-status-filter', label); button.type = 'button'; button.dataset.taskKind = key;
      button.setAttribute('aria-controls', 'task-items'); filters.append(button); buttons.set(key, { button, label });
    }
    const personKey = (project) => project.researcherId ? `id:${project.researcherId}` : project.researcherName ? `name:${project.researcherName}` : 'unassigned';
    function render() {
      const focused = list.contains(document.activeElement) ? document.activeElement.dataset.openTask : null;
      list.replaceChildren(); error.hidden = state.ok && !state.warnings.length;
      error.textContent = !state.ok ? state.error : state.warnings.join(' ');
      for (const [key, entry] of buttons) {
        const count = state.ok ? state.items.filter((item) => !key || item.kind === key).length : '—';
        entry.button.textContent = `${entry.label} ${count}`; entry.button.setAttribute('aria-pressed', String(kind === key)); entry.button.disabled = !state.ok;
      }
      if (!state.ok) { summary.textContent = '기록을 확인하지 못해 할 일을 계산하지 않았어요.'; return; }
      const query = search.value.trim().toLocaleLowerCase('ko-KR');
      const visible = state.items.filter((item) => (!kind || kind === item.kind) && (!people.value || people.value === personKey(item))
        && (!query || [item.code, item.companyName, item.productName, item.title, item.description, item.researcherName].join(' ').toLocaleLowerCase('ko-KR').includes(query)));
      summary.textContent = `${state.today} 기준 · ${state.warnings.length ? '확인 가능한 기록의 ' : ''}전체 ${state.items.length}건 중 ${visible.length}건 표시 · 기한 초과·보완·마감 임박 순`;
      for (const item of visible) {
        const card = text('li', 'task-card', ''); card.dataset.taskId = item.id;
        const top = text('div', 'task-card-top', ''); top.append(text('span', `task-kind task-kind-${item.kind}`, LCA.tasks.KINDS[item.kind]));
        if (item.date) top.append(text('span', 'detail-help', `${item.date} · ${item.days === null ? '기한 확인 필요' : item.days < 0 ? `D+${-item.days}` : item.days === 0 ? '오늘 마감' : `D-${item.days}`}`));
        const button = text('button', 'task-open', item.title); button.type = 'button'; button.dataset.openTask = item.id;
        button.setAttribute('aria-label', `${item.companyName} ${item.code} · ${item.title} 보기`);
        card.append(top, button, text('p', 'task-project', `${item.companyName} (가상) · ${item.code} · ${item.productName}`),
          text('p', 'detail-help', `담당: ${item.researcherName || '미정'} · ${LCA.constants.stageByNo(item.stage)?.name || '단계 확인 필요'}${item.status ? ` · ${item.status}` : ''}`),
          text('p', 'task-description', item.description));
        if (item.readOnly) card.append(text('p', 'calculation-notice', '현재 단계에서는 이 기록을 읽기만 할 수 있어요. 처리 이력을 확인해 주세요.'));
        list.append(card);
      }
      if (!visible.length) list.append(text('li', 'empty-state', state.items.length ? '선택한 조건의 할 일이 없어요. 유형·연구원·검색 조건을 바꿔 보세요.'
        : state.warnings.length ? '확인 가능한 기록에서는 할 일이 없어요. 읽지 못한 기록은 위 안내를 확인해 주세요.' : '현재 규칙에 해당하는 할 일이 없어요. 프로젝트 전체가 완료됐다는 뜻은 아니에요.'));
      if (focused) {
        const target = [...list.querySelectorAll('[data-open-task]')].find((node) => node.dataset.openTask === focused) || summary;
        target.tabIndex = target === summary ? -1 : 0; target.focus({ preventScroll: true });
      }
    }
    function refresh() {
      try { state = getState(); } catch { state = { ok: false, error: '할 일에 필요한 기록을 읽지 못했어요. 기존 데이터는 변경하지 않았어요.' }; }
      const key = JSON.stringify(state); if (key === stateKey) return state; stateKey = key;
      const previous = people.value; const option = text('option', '', '담당 연구원 전체'); option.value = ''; people.replaceChildren(option);
      if (state.ok) {
        const entries = new Map(state.items.map((item) => [personKey(item), item.researcherName || '담당 미정']));
        for (const [key, name] of entries) {
          const code = /^id:researcher-(sample|user)-\d+$/.test(key) ? ` · RSR-${key.split('-').at(-1).padStart(3, '0')}` : '';
          const node = text('option', '', `${name}${code}`); node.value = key; people.append(node);
        }
        if (previous && !entries.has(previous)) { const node = text('option', '', '이전 선택 · 현재 할 일 없음'); node.value = previous; people.append(node); }
      }
      people.value = previous; render(); return state;
    }
    filters.addEventListener('click', (event) => { const button = event.target.closest('[data-task-kind]'); if (button) { kind = button.dataset.taskKind; render(); } });
    people.addEventListener('change', render); search.addEventListener('input', render);
    root.querySelector('#task-filter-clear').addEventListener('click', () => { kind = ''; people.value = ''; search.value = ''; render(); });
    root.querySelector('#task-refresh').addEventListener('click', () => { feedback.textContent = ''; refresh(); });
    list.addEventListener('click', (event) => {
      const button = event.target.closest('[data-open-task]'); if (!button) return;
      const result = onOpen(button.dataset.openTask, button);
      if (!result.ok) { refresh(); feedback.textContent = result.error; feedback.tabIndex = -1; feedback.focus(); }
    });
    return { refresh, focus(id) {
      const button = [...list.querySelectorAll('[data-open-task]')].find((node) => node.dataset.openTask === id);
      (button || root.querySelector('h1')).focus({ preventScroll: true });
    } };
  }
  return { init };
})();
