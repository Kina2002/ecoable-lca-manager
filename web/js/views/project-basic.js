window.LCA = window.LCA || {};
LCA.views = LCA.views || {};
LCA.views.projectBasic = (() => {
  const LABELS = { companyName: '회사명', productName: '제품명', purpose: '업무 목적', targetDate: '목표 완료일' };
  const PROFILE_LABELS = { industry: '고객사 업종', type: '프로젝트 유형', drivers: '세부 동인', uses: '결과 활용처' };
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
    const profileFields = document.createElement('fieldset'); profileFields.className = 'project-profile-fields'; profileFields.append(text('legend', '', '프로젝트 추가정보'));
    profileFields.append(text('p', 'detail-help', '업종은 고객사의 분야, 유형은 수행할 업무, 동인은 의뢰한 계기, 활용처는 결과를 쓸 곳이에요. 활용처에 인증을 골라도 인증을 받았다는 뜻은 아니에요.'));
    fields.append(profileFields);
    const profileControls = {}; const multi = {};
    for (const key of ['industry', 'type']) {
      const box = text('div', 'interpretation-field', ''); const caption = text('label', '', PROFILE_LABELS[key]); caption.htmlFor = `project-profile-${key}`;
      const select = document.createElement('select'); select.id = caption.htmlFor;
      for (const value of ['', ...LCA.projects.PROFILE_OPTIONS[key]]) { const option = text('option', '', value || '미정'); option.value = value; select.append(option); }
      box.append(caption, select); profileFields.append(box); profileControls[key] = select;
    }
    for (const key of ['drivers', 'uses']) {
      const group = text('details', 'project-profile-group', ''); const summary = text('summary', '', PROFILE_LABELS[key]); const options = text('div', 'project-profile-options', '');
      const inputs = new Map();
      for (const value of LCA.projects.PROFILE_OPTIONS[key]) {
        const label = text('label', 'request-message-check', ''); const input = document.createElement('input'); input.type = 'checkbox'; input.value = value;
        label.append(input, document.createTextNode(value === '국내 환경성적표지' ? `${value} (기존 표현)` : value)); options.append(label); inputs.set(value, input);
      }
      group.append(summary, options); profileFields.append(group); multi[key] = { summary, inputs };
    }
    const informationControls = {};
    const informationGroup = text('details', 'project-profile-group', ''); informationGroup.append(text('summary', '', '고객·제품·평가 방법 보충 정보'));
    informationGroup.append(text('p', 'detail-help', '빈칸은 나중에 확인할 권장 정보예요. 중량과 생산량은 단위를 함께 적어요. 컷오프는 작은 투입을 어디까지 포함할지, 할당은 여러 제품 사이의 영향을 어떻게 나눌지 정한 근거예요. 배경 DB는 외부 계산에서 사용할 자료집이에요. 실제 계산 결과에 쓴 방법은 계산 탭에 따로 남겨요.'));
    for (const [key,label] of Object.entries(LCA.projects.INFORMATION)) {
      const box = text('div', 'interpretation-field', ''); const caption = text('label','',label); caption.htmlFor = `project-information-${key}`;
      const input = document.createElement('input'); input.type = key === 'contactEmail' ? 'email' : 'text'; input.id = caption.htmlFor; input.maxLength = key.endsWith('On') ? 10 : 500;
      box.append(caption,input); informationGroup.append(box); informationControls[key] = input;
      if (key.endsWith('On')) { input.inputMode = 'numeric'; input.placeholder = 'YYYY-MM-DD'; input.addEventListener('input', () => { input.value = LCA.requests.formatDateInput(input.value); }); LCA.views.inputAssist.date(input); }
    }
    profileFields.append(informationGroup);
    function profileDraft() { const information = Object.fromEntries(Object.entries(informationControls).map(([key,input]) => [key,input.value.trim()])); return { industry: profileControls.industry.value, type: profileControls.type.value,
      drivers: [...multi.drivers.inputs.values()].filter((input) => input.checked).map((input) => input.value),
      uses: [...multi.uses.inputs.values()].filter((input) => input.checked).map((input) => input.value), ...(state?.project.information || Object.values(information).some(Boolean) ? { information } : {}) }; }
    function updateCounts() { for (const key of ['drivers', 'uses']) multi[key].summary.textContent = `${PROFILE_LABELS[key]} 선택 · ${[...multi[key].inputs.values()].filter((input) => input.checked).length}개`; }
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
        item.append(text('summary', '', `${at} (한국 시간) · ${event.stage}단계에서 ${event.profile ? '추가정보' : '기본정보'} 변경`));
        const display = (value) => (Array.isArray(value) ? value.join(' / ') : value) || '미정';
        for (const [key, label] of Object.entries({ ...LABELS, ...PROFILE_LABELS })) if (JSON.stringify(event.before[key]) !== JSON.stringify(event.after[key])) item.append(text('p', 'detail-help', `${label}: ${display(event.before[key])} → ${display(event.after[key])}`));
        for (const [key,label] of Object.entries(LCA.projects.INFORMATION)) if ((event.before.information?.[key] || '') !== (event.after.information?.[key] || '')) item.append(text('p','detail-help',`${label}: ${display(event.before.information?.[key])} → ${display(event.after.information?.[key])}`));
        if (event.reason) item.append(text('p', 'interpretation-text', `변경 사유: ${event.reason}`)); history.append(item);
      }
    }
    function sync() {
      fields.disabled = busy || !state || state.stage >= 10; save.disabled = fields.disabled;
      save.hidden = !!state && state.stage >= 10; cancel.disabled = busy;
      for (const [key, input] of Object.entries(controls)) input.disabled = fields.disabled || (key !== 'targetDate' && state.stage !== 1);
      profileFields.disabled = fields.disabled || state.stage >= 9;
      LCA.views.inputAssist.sync(fields);
    }
    function open(id, button) {
      opener = button; state = null; clearError(); form.reset(); history.replaceChildren();
      const loaded = store.basic(id);
      if (loaded.ok) {
        state = loaded; heading.textContent = `${loaded.project.code} · 기본정보와 변경 이력`;
        for (const key of Object.keys(controls)) controls[key].value = loaded.project[key];
        for (const [key,input] of Object.entries(informationControls)) input.value = loaded.project.information?.[key] || '';
        informationGroup.open = false;
        for (const key of ['industry', 'type']) profileControls[key].value = loaded.project[key] || '';
        for (const key of ['drivers', 'uses']) for (const [value, input] of multi[key].inputs) { input.checked = loaded.project[key]?.includes(value) || false; input.parentElement.hidden = value === '국내 환경성적표지' && !input.checked; }
        updateCounts();
        notice.textContent = loaded.stage === 1 ? '기본정보와 추가정보를 수정할 수 있어요. 바뀐 내용과 저장 시각은 이력에 남아요.'
          : loaded.stage >= 10 ? '완료한 프로젝트는 읽기 전용이에요. 기존 정보와 변경 이력을 볼 수 있어요.'
            : loaded.stage >= 9 ? '인증·등록을 시작한 뒤에는 목표일만 수정할 수 있어요. 제출 근거를 보호하기 위해 추가정보는 읽기 전용이에요.'
              : '회사명·제품명·업무 목적은 고정하고 목표일·추가정보를 수정할 수 있어요. 보고서에 반영한 정보가 달라지면 보고서 기준을 다시 확인해 주세요.';
        renderHistory([...loaded.history, ...loaded.profileHistory.map((event) => ({ ...event, profile: true }))].sort((a, b) => a.at.localeCompare(b.at)));
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
    form.addEventListener('input', clearError); form.addEventListener('change', () => { clearError(); updateCounts(); });
    form.addEventListener('submit', async (event) => {
      event.preventDefault(); if (busy || !state || state.stage >= 10) return;
      clearError(); const id = state.project.id;
      const expected = { revision: state.revision, basic: LCA.projects.basicSnapshot(state.project), stage: state.stage,
        profileRevision: state.profileRevision, profile: LCA.projects.profileSnapshot(state.project) };
      const draft = { ...Object.fromEntries(Object.entries(controls).map(([key, input]) => [key, input.value])), profile: profileDraft(), reason: reason.value };
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
