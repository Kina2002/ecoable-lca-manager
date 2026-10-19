window.LCA = window.LCA || {};
LCA.views = LCA.views || {};
LCA.views.tasks = (() => {
  const HELP = {
    '': '전체: 기한·보완·검토·의견·정보 확인 등 지금 확인할 업무를 모두 보여줘요.',
    overdue: '기한 초과: 받기로 한 날이 지났는데 아직 제출되지 않은 자료예요.',
    soon: '마감 임박: 오늘부터 3일 안에 자료를 받기로 해서 제출 일정을 확인해야 해요.',
    revision: '보완 요청: 받은 자료에 부족한 부분이 있어 보충해서 다시 받아야 해요.',
    renewal: '갱신 확인: 문서의 만료일을 기록했다면 그 날짜를, 아직 없다면 예상일을 기준으로 안내해요.',
    inspection: '연간 점검: International EPD 최신 버전일을 기준으로 매년 확인해요. 예정일 30일 전부터 보이고 점검 완료를 기록하면 다음 차례로 넘어가요.',
    review: '자료 검토: 받은 자료의 내용·기간·증빙을 우리가 확인해야 해요.',
    comment: '고객 의견: 보고서에 남긴 고객 의견에 답변하거나 반영 여부를 확인해야 해요.',
    verification: '검증 지적: 외부 검증자가 남긴 지적에 답변하거나 보완 결과를 확인해야 해요.',
    info: '정보 확인: 담당자·평가 범위·자료 요청 등 진행에 필요한 정보를 확인해야 해요.'
  };
  function text(tag, className, value) { const node = document.createElement(tag); node.className = className; node.textContent = value; return node; }
  function init(getState, onOpen, onMessage) {
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
      const help = root.querySelector('#task-kind-help');
      if (help.textContent !== HELP[kind]) help.textContent = HELP[kind];
      const focused = list.contains(document.activeElement) ? document.activeElement.dataset.openTask : null;
      const focusedMessage = list.contains(document.activeElement) ? document.activeElement.dataset.messageTask : null;
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
      summary.textContent = `${state.today} 기준 · ${state.warnings.length ? '확인 가능한 기록의 ' : ''}전체 ${state.items.length}건 중 ${visible.length}건 표시 · 기한 초과·보완·갱신 확인 순`;
      for (const item of visible) {
        const card = text('li', 'task-card', ''); card.dataset.taskId = item.id;
        const badge = text('span', `task-kind task-kind-${item.kind}`, LCA.tasks.KINDS[item.kind]);
        const button = text('button', 'task-open', item.title); button.type = 'button'; button.dataset.openTask = item.id;
        button.setAttribute('aria-label', `${item.companyName} ${item.code} · ${item.title} 보기`);
        const titleActions = text('div', 'task-title-actions', ''); titleActions.append(button);
        const messageType = LCA.requestMessage.typeForTask(item);
        if (messageType && onMessage) {
          const compose = text('button', 'task-message-button', '요청문 만들기'); compose.type = 'button'; compose.dataset.messageTask = item.id;
          compose.setAttribute('aria-label', `${item.companyName} ${item.requestId} · ${LCA.requestMessage.TYPES[messageType]} 요청문 만들기`);
          titleActions.append(compose);
        }
        const project = text('div', 'task-project', '');
        project.append(text('span', '', `${item.companyName} (가상)`), text('small', '', `${item.code} · ${item.productName}`));
        const due = LCA.tasks.deadline(item); const deadline = text('div', `task-deadline task-deadline-${due.tone}`, '');
        deadline.title = `${due.label}${due.detail ? ` · ${due.detail}` : ''}`;
        deadline.setAttribute('aria-label', `${due.label} · ${due.text}${due.detail ? ` · ${due.detail}` : ''}`);
        deadline.append(text('strong', '', due.text), text('small', '', due.detail || due.label));
        if (item.kind === 'review') deadline.append(text('small', '', '제출 완료'));
        const details = text('details', 'task-details', ''); details.dataset.taskDetails = item.id;
        const toggle = text('summary', '', '내용'); toggle.setAttribute('aria-label', `${item.title} 내용`);
        details.append(toggle, text('p', 'task-description', item.description),
          text('p', 'detail-help', `${LCA.constants.stageByNo(item.stage)?.name || '단계 확인 필요'}${item.status ? ` · ${item.status}` : ''} · ${due.label}`));
        if (item.readOnly) details.append(text('p', 'calculation-notice', '현재 단계에서는 이 기록을 읽기만 할 수 있어요. 처리 이력을 확인해 주세요.'));
        details.open = expanded.has(item.id);
        details.addEventListener('toggle', () => { if (details.open) expanded.add(item.id); else expanded.delete(item.id); });
        card.append(badge, titleActions, project, text('span', 'task-person', item.researcherName || '담당 미정'), deadline, details);
        list.append(card);
      }
      if (!visible.length) list.append(text('li', 'empty-state', state.items.length ? '선택한 조건의 할 일이 없어요. 유형·연구원·검색 조건을 바꿔 보세요.'
        : state.warnings.length ? '확인 가능한 기록에서는 할 일이 없어요. 읽지 못한 기록은 위 안내를 확인해 주세요.' : '현재 규칙에 해당하는 할 일이 없어요. 프로젝트 전체가 완료됐다는 뜻은 아니에요.'));
      if (focused || focusedMessage) {
        const target = [...list.querySelectorAll('[data-open-task], [data-message-task]')].find((node) => focusedMessage ? node.dataset.messageTask === focusedMessage : node.dataset.openTask === focused) || summary;
        target.tabIndex = target === summary ? -1 : 0; target.focus({ preventScroll: true });
      }
    }
    const expanded = new Set();
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
      const button = event.target.closest('[data-open-task], [data-message-task]'); if (!button) return;
      feedback.textContent = '';
      const result = button.dataset.messageTask ? onMessage(button.dataset.messageTask, button) : onOpen(button.dataset.openTask, button);
      if (!result.ok) { refresh(); feedback.textContent = result.error; feedback.tabIndex = -1; feedback.focus(); }
    });
    return { refresh, focus(id, action) {
      const button = [...list.querySelectorAll(action === 'message' ? '[data-message-task]' : '[data-open-task]')]
        .find((node) => action === 'message' ? node.dataset.messageTask === id : node.dataset.openTask === id)
        || [...list.querySelectorAll('[data-open-task]')].find((node) => node.dataset.openTask === id);
      (button || root.querySelector('h1')).focus({ preventScroll: true });
    } };
  }
  return { init };
})();
