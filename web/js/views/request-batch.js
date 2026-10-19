window.LCA = window.LCA || {};
LCA.views = LCA.views || {};
LCA.views.requestBatch = (() => {
  function text(tag, className, value) {
    const node = document.createElement(tag); node.className = className; node.textContent = value; return node;
  }
  function init(panel, project, store, onCreated) {
    const section = document.createElement('details'); section.className = 'request-batch';
    section.append(text('summary', '', '여러 자료 한 번에 등록'));
    section.append(text('p', 'detail-help', '필요한 자료만 선택하고 제출 기한을 한 번 정해 주세요. 구분별 기본 문장을 그대로 쓰거나 펼쳐 수정할 수 있어요. 이미 등록한 구분은 건너뛰어요.'));
    const form = document.createElement('form'); form.noValidate = true;
    const fields = document.createElement('fieldset'); fields.className = 'request-batch-fields';
    fields.append(text('legend', '', '자료 구분 선택과 공통 제출 기한'));
    const dateBox = text('div', 'interpretation-field', ''); const dateLabel = text('label', '', '공통 제출 기한 (필수)'); dateLabel.htmlFor = 'request-batch-due';
    const due = document.createElement('input'); due.type = 'text'; due.id = dateLabel.htmlFor;
    due.inputMode = 'numeric'; due.maxLength = 10; due.placeholder = 'YYYY-MM-DD';
    due.setAttribute('aria-describedby', 'request-batch-date-help request-batch-date-error');
    dateBox.append(dateLabel, due); fields.append(dateBox);
    due.addEventListener('input', () => { due.value = LCA.requests.formatDateInput(due.value); });
    LCA.views.inputAssist.date(due);
    const dateHelp = text('p', 'detail-help', '선택한 새 요청에 같은 기한을 적용해요. 기존 요청의 기한은 바꾸지 않아요.'); dateHelp.id = 'request-batch-date-help'; dateBox.append(dateHelp);
    const useCollection = text('button', 'request-action-button', '자료 수집 마감일 사용'); useCollection.type = 'button';
    const dateError = text('p', 'field-error', ''); dateError.id = 'request-batch-date-error'; dateError.setAttribute('role', 'alert'); dateBox.append(useCollection, dateError);
    const actions = text('div', 'request-batch-actions', '');
    const all = text('button', 'request-action-button', '미등록 구분 전체 선택'); all.type = 'button';
    const clear = text('button', 'request-action-button', '선택 해제'); clear.type = 'button'; actions.append(all, clear); fields.append(actions);
    const selectionError = text('p', 'field-error', ''); selectionError.id = 'request-batch-selection-error'; selectionError.setAttribute('role', 'alert'); fields.append(selectionError);
    const grid = text('div', 'request-batch-grid', ''); grid.setAttribute('role', 'group'); grid.setAttribute('aria-label', '일괄 등록할 자료 구분'); grid.setAttribute('aria-describedby', selectionError.id);
    const rows = new Map();
    for (const category of LCA.constants.CATEGORIES) {
      const row = text('section', 'request-batch-item', ''); const label = text('label', 'request-batch-choice', '');
      const check = document.createElement('input'); check.type = 'checkbox'; check.value = category.key;
      check.id = `request-batch-${category.key}`; label.htmlFor = check.id; label.append(check, document.createTextNode(category.name));
      const status = text('p', 'detail-help', '');
      const editor = document.createElement('details'); editor.className = 'request-batch-editor'; editor.hidden = true;
      editor.append(text('summary', '', '기본 요청 내용 확인·수정'));
      const contentLabel = text('label', '', `${category.name} 요청 내용 (필수 · 최대 1,000자)`); contentLabel.htmlFor = `request-batch-detail-${category.key}`;
      const detail = document.createElement('textarea'); detail.id = contentLabel.htmlFor; detail.rows = 3; detail.maxLength = LCA.requests.MAX_DETAIL; detail.value = store.templates().values?.[category.key] ?? category.detail;
      const error = text('p', 'field-error', ''); error.id = `${detail.id}-error`; error.setAttribute('role', 'alert'); detail.setAttribute('aria-describedby', error.id);
      editor.append(contentLabel, detail, error);
      const guide = LCA.constants.requestGuideline(category.key); const reference = document.createElement('details'); reference.className = 'request-reference';
      reference.append(text('summary', '', '지침 근거 보기'), text('p', 'guideline-section', `${guide.source} · ${guide.section}`));
      const link = text('a', 'guideline-link', `원문 ${guide.page}쪽 보기 ↗`); link.href = `${guide.url}#page=${guide.page}`; link.target = '_blank'; link.rel = 'noopener noreferrer';
      reference.append(link, text('p', 'detail-help', `${guide.note} 확인일: ${guide.checkedOn}`)); editor.append(reference);
      row.append(label, status, editor); grid.append(row); rows.set(category.key, { seed: detail.value, check, status, editor, detail, error });
      check.addEventListener('change', () => { selectionError.textContent = ''; feedback.textContent = ''; update(); });
      detail.addEventListener('input', () => { detail.removeAttribute('aria-invalid'); error.textContent = ''; feedback.textContent = ''; });
    }
    fields.append(grid);
    const count = text('p', 'request-feedback', ''); count.setAttribute('role', 'status'); count.setAttribute('aria-live', 'polite');
    const save = text('button', 'primary-button', '선택한 자료 일괄 등록'); save.type = 'submit';
    const formError = text('p', 'form-error', ''); formError.setAttribute('role', 'alert');
    const feedback = text('p', 'request-feedback', ''); feedback.setAttribute('role', 'status'); feedback.setAttribute('aria-live', 'polite');
    form.append(fields, count, save, formError, feedback, text('p', 'detail-help', '이 브라우저에 요청 상태로 저장해요. 메일 발송이나 프로젝트 단계 이동은 하지 않아요.'));
    section.append(form); panel.insertBefore(section, panel.querySelector('.request-workspace'));
    let state = null; let busy = false;
    function selected() { return [...rows.values()].filter((row) => row.check.checked); }
    section.addEventListener('toggle', () => { if (section.open) update(); });
    function update() {
      const templates = store.templates();
      if (templates.ok) for (const [key, row] of rows) if (row.detail.value === row.seed) { row.seed = templates.values[key]; row.detail.value = row.seed; }
      const disabled = busy || !state?.ok || !state.canWrite; fields.disabled = disabled;
      const registered = new Set(state?.ok ? state.items.map((item) => item.categoryKey) : []);
      for (const [key, row] of rows) {
        const exists = registered.has(key); row.check.disabled = disabled || exists;
        row.editor.hidden = !row.check.checked; row.detail.disabled = disabled || exists;
        row.status.textContent = exists ? '등록됨 · 기존 요청 유지' : state?.ok && state.deletedItems.some((item) => item.categoryKey === key)
          ? '삭제 기록 있음 · 선택하면 새 요청으로 등록해요. 이전 요청은 아래 삭제 목록에서 복원할 수 있어요.' : '미등록 · 기본 문장 사용 가능';
      }
      const checked = selected(); const pending = checked.filter((row) => !registered.has(row.check.value)).length;
      count.textContent = `선택 ${checked.length}개 · 새로 등록 ${pending}개${checked.length > pending ? ` · 이미 등록되어 건너뛸 항목 ${checked.length - pending}개` : ''}`;
      save.disabled = disabled || !checked.length; save.textContent = busy ? '등록 중…' : `선택한 자료 ${pending}개 일괄 등록`;
      all.disabled = disabled || registered.size === rows.size; clear.disabled = disabled || !checked.length;
      useCollection.hidden = !LCA.requests.validDate(project.collectionDueDate); useCollection.disabled = disabled;
      if (!state?.ok) formError.textContent = state?.message || '자료 요청을 읽지 못했어요.';
      else if (!state.canWrite) formError.textContent = state.readOnlyReason;
      LCA.views.inputAssist.sync(section);
    }
    function render(result) {
      state = result;
      update();
    }
    due.addEventListener('input', () => { dateError.textContent = ''; due.removeAttribute('aria-invalid'); feedback.textContent = ''; });
    useCollection.addEventListener('click', () => {
      if (fields.disabled || !LCA.requests.validDate(project.collectionDueDate)) return;
      due.value = project.collectionDueDate; due.dispatchEvent(new Event('input', { bubbles: true }));
    });
    all.addEventListener('click', () => { for (const row of rows.values()) if (!row.check.disabled) row.check.checked = true; selectionError.textContent = ''; feedback.textContent = ''; update(); });
    clear.addEventListener('click', () => { for (const row of rows.values()) row.check.checked = false; selectionError.textContent = ''; feedback.textContent = ''; update(); });
    form.addEventListener('submit', (event) => {
      event.preventDefault(); if (busy || fields.disabled) return;
      const chosen = selected(); const draft = { dueDate: due.value, items: chosen.map((row) => ({ categoryKey: row.check.value, detail: row.detail.value })) };
      dateError.textContent = ''; selectionError.textContent = ''; formError.textContent = ''; feedback.textContent = ''; due.removeAttribute('aria-invalid');
      for (const row of rows.values()) { row.error.textContent = ''; row.detail.removeAttribute('aria-invalid'); }
      busy = true; update(); let result;
      try { result = store.addMany(project.id, draft); }
      catch { result = { ok: false, message: '일괄 등록을 저장하지 못했어요. 입력을 유지했으니 다시 확인해 주세요.' }; }
      busy = false;
      if (!result.ok) {
        render(store.list(project.id)); formError.textContent = result.message || '입력 내용을 확인해 주세요.';
        dateError.textContent = result.errors?.dueDate || ''; selectionError.textContent = result.errors?.items || '';
        if (dateError.textContent) due.setAttribute('aria-invalid', 'true');
        let first = dateError.textContent ? due : selectionError.textContent ? all : null;
        for (const [key, row] of rows) if (result.errors?.[`detail_${key}`]) {
          row.error.textContent = result.errors[`detail_${key}`]; row.detail.setAttribute('aria-invalid', 'true'); row.editor.open = true; first ||= row.detail;
        }
        if (first) first.focus(); else { formError.tabIndex = -1; formError.focus(); }
        return;
      }
      for (const row of chosen) row.check.checked = false;
      onCreated(result); render(store.list(project.id));
      const names = result.skipped.map((item) => LCA.constants.CATEGORIES.find((category) => category.key === item.categoryKey).name).join(', ');
      feedback.textContent = `${result.items.length}개 새 요청을 등록했어요.${names ? ` 이미 등록된 ${names}은 그대로 두었어요.` : ''}${result.items.length ? ' 선택 상태 필터에 따라 일부 항목이 목록에서 숨겨질 수 있어요.' : ' 추가 저장은 하지 않았어요.'}`;
      feedback.tabIndex = -1; feedback.focus();
    });
    return { render };
  }
  return { init };
})();
