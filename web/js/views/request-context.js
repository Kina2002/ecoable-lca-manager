/* 고객사 담당자가 내부 자료를 취합할 때 참고하는 요청별 안내. */
window.LCA = window.LCA || {};
LCA.views = LCA.views || {};
LCA.views.requestContext = (() => {
  const text = (tag, cls, value) => { const node = document.createElement(tag); node.className = cls; node.textContent = value; return node; };
  function summary(item) {
    const context = item.collectionContext;
    return `고객사 내부 취합 부서: ${context?.department || '미정'} · 필요한 증빙 종류: ${context?.evidenceType || '미정'}`;
  }
  function editor(item, project, store, options) {
    const details = text('details', 'request-context', ''); details.dataset.recordDetails = `context:${item.id}`; details.open = options.open;
    const missing = !item.collectionContext?.department || !item.collectionContext?.evidenceType;
    const toggle = text('summary', '', `취합 부서·증빙 안내${missing ? ' · 미정 항목 있음' : ''}`); toggle.setAttribute('aria-label', `${item.id} ${toggle.textContent}`);
    details.append(toggle, text('p', 'detail-help', `고객사 담당자 ${project.customerContactName || '(미정)'}님이 내부 자료를 모아 전달할 때 참고하는 정보예요. 아래 항목은 선택 사항이에요.`), text('p', 'request-context-summary', summary(item)));
    if (!options.canWrite) return details;
    const pending = options.drafts.get(item.id);
    const expected = pending ? pending.expected : item.collectionContext ? { ...item.collectionContext } : null;
    const values = pending?.draft || item.collectionContext || { department: '', evidenceType: '' };
    const form = text('form', 'request-context-form', ''); const fields = {};
    for (const [key, label, choices] of [['department', '고객사 내부 취합 부서', LCA.constants.DEPTS], ['evidenceType', '필요한 증빙 종류', LCA.constants.EVIDENCE_TYPES.filter((v) => v !== '기타')]]) {
      const group = text('div', '', ''); const id = `context-${item.id}-${key}`;
      const caption = text('label', '', label); caption.htmlFor = id;
      const select = document.createElement('select'); select.id = id;
      for (const [value, name] of [['', '미정'], ...choices.map((v) => [v, v]), ['__custom__', '직접 입력']]) {
        const option = text('option', '', name); option.value = value; select.append(option);
      }
      const customLabel = text('label', 'input-help', `${label} 직접 입력`); customLabel.htmlFor = `${id}-custom`;
      const custom = document.createElement('input'); custom.id = customLabel.htmlFor; custom.maxLength = 100; custom.type = 'text';
      select.value = !values[key] || choices.includes(values[key]) ? values[key] || '' : '__custom__'; custom.value = values[key] || '';
      function visible() { custom.hidden = customLabel.hidden = select.value !== '__custom__'; custom.disabled = custom.hidden; }
      visible(); select.addEventListener('change', visible);
      fields[key] = { select, custom, customLabel }; group.append(caption, select, customLabel, custom); form.append(group);
    }
    function draft() { return Object.fromEntries(Object.entries(fields).map(([key, field]) => [key, field.select.value === '__custom__' ? field.custom.value : field.select.value])); }
    function remember() { options.drafts.set(item.id, { draft: draft(), expected }); }
    form.addEventListener('input', remember); form.addEventListener('change', remember);
    const actions = text('div', 'request-context-actions', '');
    function button(label) { const node = text('button', 'request-action-button', label); node.type = 'button'; actions.append(node); return node; }
    const suggest = button('구분별 예시 채우기');
    const clear = button('입력 비우기'); const save = button('취합 정보 저장'); save.type = 'submit';
    const error = text('p', 'form-error', ''); error.setAttribute('role', 'alert');
    const help = text('p', 'input-help', '예시는 고객사에 확인해서 바꿔 주세요. 저장한 안내는 요청문에 포함돼요. 실제로 받은 파일 이름은 ‘받은 자료 기록’에 따로 남겨요.');
    let saving = false;
    function fill(values) {
      for (const [key, field] of Object.entries(fields)) {
        const existing = [...field.select.options].some((option) => option.value === values[key]);
        field.select.value = existing ? values[key] : '__custom__'; field.custom.value = values[key];
        field.custom.hidden = field.customLabel.hidden = field.select.value !== '__custom__'; field.custom.disabled = field.custom.hidden;
      }
      remember(); error.textContent = '';
    }
    suggest.addEventListener('click', () => fill(LCA.requests.suggestedContext(item.categoryKey)));
    clear.addEventListener('click', () => fill({ department: '', evidenceType: '' }));
    form.addEventListener('submit', async (event) => {
      event.preventDefault(); remember(); const input = draft();
      if (saving) return; saving = true;
      for (const node of form.querySelectorAll('input, select, button')) node.disabled = true;
      let result; try { result = await store.saveContext(project.id, item.id, input, expected); }
      catch { result = { ok: false, message: '취합 정보를 저장하지 못했어요. 입력은 유지했어요.' }; }
      saving = false;
      if (!details.isConnected) { if (result.ok) { options.drafts.delete(item.id); LCA.views.requests.refresh(); } return; }
      for (const node of form.querySelectorAll('input, select, button')) node.disabled = false;
      for (const field of Object.values(fields)) field.custom.disabled = field.custom.hidden;
      error.textContent = result.message || '';
      if (!result.ok) return;
      options.drafts.delete(item.id); options.onSaved(result.item);
    });
    form.append(help, actions, error); details.append(form); return details;
  }
  return { editor, summary };
})();
