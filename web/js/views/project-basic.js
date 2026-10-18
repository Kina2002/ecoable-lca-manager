window.LCA = window.LCA || {};
LCA.views = LCA.views || {};
LCA.views.projectBasic = (() => {
  const LABELS = { companyName: '회사명', productName: '제품명', purpose: '업무 목적', targetDate: '목표 완료일' };
  function text(tag, className, value) { const node = document.createElement(tag); node.className = className; node.textContent = value; return node; }
  function init(store, onChanged) {
    const dialog = document.querySelector('#project-basic-dialog'); const form = document.querySelector('#project-basic-form');
    const heading = document.querySelector('#project-basic-title'); const notice = document.querySelector('#project-basic-help');
    const fields = document.querySelector('#project-basic-fields'); const history = document.querySelector('#project-basic-history');
    const feedback = document.querySelector('#project-basic-error'); const save = document.querySelector('#project-basic-save');
    const cancel = document.querySelector('#project-basic-cancel');
    const controls = {};
    for (const [key, label] of Object.entries(LABELS)) {
      const box = text('div', 'interpretation-field', ''); const caption = text('label', '', label);
      caption.htmlFor = `project-basic-${key}`; const input = document.createElement(key === 'purpose' ? 'select' : 'input');
      input.id = caption.htmlFor; input.name = key; input.setAttribute('aria-describedby', 'project-basic-help project-basic-error');
      if (key === 'purpose') for (const value of LCA.projects.PURPOSES) { const option = text('option', '', value); option.value = value; input.append(option); }
      else { input.type = 'text'; input.maxLength = key === 'targetDate' ? 10 : 100; }
      box.append(caption, input); fields.append(box); controls[key] = input;
      if (key === 'targetDate') {
        input.inputMode = 'numeric'; input.placeholder = 'YYYY-MM-DD';
        input.addEventListener('input', () => { input.value = LCA.requests.formatDateInput(input.value); }); LCA.views.inputAssist.date(input);
      }
    }
    const reasonBox = text('div', 'interpretation-field', ''); const reasonLabel = text('label', '', '변경 사유 (선택 · 최대 1,000자)');
    reasonLabel.htmlFor = 'project-basic-reason'; const reason = document.createElement('textarea'); reason.id = reasonLabel.htmlFor; reason.maxLength = 1000; reason.rows = 2; reasonBox.append(reasonLabel, reason); fields.append(reasonBox);
    let state = null; let opener = null; let busy = false; let saved = null;
    function clearError() { feedback.textContent = ''; for (const input of Object.values(controls)) input.removeAttribute('aria-invalid'); }
    function renderHistory(items) {
      history.replaceChildren();
      if (!items.length) { history.append(text('p', 'detail-help', '아직 기본정보 변경 이력이 없어요.')); return; }
      for (const event of items.slice().reverse()) {
        const item = text('details', 'customer-review-event', '');
        const at = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Seoul' }).format(new Date(event.at));
        item.append(text('summary', '', `${at} (한국 시간) · ${event.stage}단계에서 변경`));
        for (const [key, label] of Object.entries(LABELS)) if (event.before[key] !== event.after[key]) item.append(text('p', 'detail-help', `${label}: ${event.before[key]} → ${event.after[key]}`));
        if (event.reason) item.append(text('p', 'interpretation-text', `변경 사유: ${event.reason}`)); history.append(item);
      }
    }
    function sync() {
      fields.disabled = busy || !state || state.stage >= 10; save.disabled = fields.disabled;
      save.hidden = !!state && state.stage >= 10; cancel.disabled = busy;
      for (const [key, input] of Object.entries(controls)) input.disabled = fields.disabled || (key !== 'targetDate' && state.stage !== 1);
      LCA.views.inputAssist.sync(fields);
    }
    function open(id, button) {
      opener = button; state = null; clearError(); form.reset(); history.replaceChildren();
      const loaded = store.basic(id);
      if (loaded.ok) {
        state = loaded; heading.textContent = `${loaded.project.code} · 기본정보와 변경 이력`;
        for (const key of Object.keys(controls)) controls[key].value = loaded.project[key];
        notice.textContent = loaded.stage === 1 ? '회사명·제품명·업무 목적·목표일을 수정할 수 있어요. 바뀐 내용과 저장 시각은 이력에 남아요.'
          : loaded.stage >= 10 ? '완료한 프로젝트는 읽기 전용이에요. 기존 정보와 변경 이력을 볼 수 있어요.'
            : '범위 정의 이후 회사명·제품명·업무 목적은 고정하고 목표일만 수정할 수 있어요. 개별 자료 제출 기한·자료 수집 마감일은 별도예요.';
        renderHistory(loaded.history);
      } else { heading.textContent = '기본정보와 변경 이력'; notice.textContent = ''; feedback.textContent = loaded.error; }
      sync(); dialog.showModal();
      if (!state || state.stage >= 10) cancel.focus(); else (state.stage === 1 ? controls.companyName : controls.targetDate).focus();
    }
    cancel.addEventListener('click', () => { if (!busy) dialog.close(); });
    dialog.addEventListener('cancel', (event) => { if (busy) event.preventDefault(); });
    dialog.addEventListener('close', () => {
      state = null; if (opener?.isConnected) opener.focus({ preventScroll: true });
      if (saved) { const outcome = saved; saved = null; onChanged(outcome.id, outcome.result); }
    });
    form.addEventListener('input', clearError); form.addEventListener('change', clearError);
    form.addEventListener('submit', async (event) => {
      event.preventDefault(); if (busy || !state || state.stage >= 10) return;
      clearError(); const id = state.project.id;
      const expected = { revision: state.revision, basic: LCA.projects.basicSnapshot(state.project), stage: state.stage };
      const draft = { ...Object.fromEntries(Object.entries(controls).map(([key, input]) => [key, input.value])), reason: reason.value };
      busy = true; sync(); let result;
      try { result = await store.updateBasic(id, draft, expected); }
      catch { result = { ok: false, error: '기본정보를 저장하지 못했어요. 입력은 유지했으니 다시 시도해 주세요.' }; }
      busy = false; if (!dialog.open) return; sync();
      if (result.ok) { saved = { id, result }; dialog.close(); return; }
      feedback.textContent = result.error || Object.values(result.errors || {}).join(' ');
      for (const key of Object.keys(result.errors || {})) controls[key]?.setAttribute('aria-invalid', 'true');
      const first = Object.keys(result.errors || {})[0];
      if (controls[first] && !controls[first].disabled) controls[first].focus(); else { feedback.tabIndex = -1; feedback.focus(); }
    });
    return { open };
  }
  return { init };
})();
