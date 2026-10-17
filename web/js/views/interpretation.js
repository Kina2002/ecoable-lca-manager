window.LCA = window.LCA || {};
LCA.views = LCA.views || {};
LCA.views.interpretation = (() => {
  let refreshCurrent = () => {};
  function text(tag, className, value) {
    const node = document.createElement(tag); node.className = className; node.textContent = value; return node;
  }
  function init(project, store, scopeStore, onMoved, onSaved = () => {}) {
    const host = document.querySelector('#project-interpretation-panel');
    const initial = store.load(project.id);
    let expectedScope = LCA.scope.snapshot(project);
    let expectedRevision = initial.record?.revision || 0;
    let calculationKey = initial.record ? LCA.interpretation.key(initial.record.calculation) : initial.calculationKey || '';
    let dirty = false;
    const start = text('section', 'detail-card calculation-card', '');
    start.append(text('h2', '', '결과 해석 시작'), text('p', 'detail-help', '모든 자료를 승인하고 최신 자료·범위와 일치하는 외부 계산 결과를 저장한 뒤, 별도 버튼으로 결과 해석 단계에 들어가요.'));
    const readiness = text('p', '', ''); readiness.setAttribute('role', 'status');
    const moveButton = text('button', 'primary-button', '결과 해석 시작'); moveButton.type = 'button';
    const moveError = text('p', 'field-error', ''); moveError.setAttribute('role', 'alert');
    start.append(readiness, moveButton, moveError);
    const editor = text('section', 'detail-card calculation-card', '');
    editor.append(text('h2', '', '결과 해석 기록'), text('p', 'detail-help', '외부 계산과 기여도 분석을 사람이 읽고 직접 적어요. 원인을 자동으로 추정하지 않아요. 확인하지 못한 내용은 미확인이라고 적고 이유를 남겨 주세요.'));
    const result = text('div', 'calculation-saved', '');
    const saved = text('div', 'calculation-saved', '');
    const warning = text('p', 'calculation-notice', ''); warning.setAttribute('role', 'status');
    const adopt = text('button', 'request-action-button', '해석 기준 다시 확인'); adopt.type = 'button';
    const form = document.createElement('form'); form.noValidate = true;
    const fields = document.createElement('fieldset'); fields.className = 'calculation-fields';
    fields.append(text('legend', '', '담당자의 결과 해석'));
    const controls = {};
    const examples = {
      summary: '예: 가상 제품 1kg의 지구온난화 결과는 1.23 kgCO₂e예요.',
      causes: '예: 외부 기여도 분석에서 전력 사용의 영향이 크게 나타났어요. 근거가 없으면 미확인이라고 적어요.',
      improvements: '예: 전력 절감 방안을 검토해요. 절감 효과는 별도 계산으로 확인해야 해요.',
      limitations: '예: 운송 거리는 추정값이므로 실제 경로 확인 후 결과를 다시 확인해야 해요.'
    };
    for (const [key, label] of Object.entries(LCA.interpretation.LABELS)) {
      const box = text('div', 'interpretation-field', '');
      const caption = text('label', '', `${label} (필수)`);
      const input = document.createElement('textarea'); input.id = `interpretation-${key}`; input.rows = 4; input.maxLength = LCA.interpretation.LIMIT;
      input.placeholder = examples[key]; caption.htmlFor = input.id;
      box.append(caption, input); fields.append(box); controls[key] = input;
    }
    const label = text('label', 'calculation-confirmation', '');
    const confirmed = document.createElement('input'); confirmed.type = 'checkbox';
    label.append(confirmed, document.createTextNode('표시된 계산 결과와 근거를 읽고 해석 내용을 확인했어요.'));
    fields.append(label);
    const errors = text('p', 'field-error', ''); errors.setAttribute('role', 'alert');
    const saveButton = text('button', 'primary-button', '결과 해석 저장'); saveButton.type = 'submit';
    const feedback = text('p', '', ''); feedback.setAttribute('role', 'status');
    form.append(fields, errors, saveButton, feedback); editor.append(result, saved, warning, adopt, form); host.replaceChildren(start, editor);
    function fill(record) { for (const [key, input] of Object.entries(controls)) input.value = record?.[key] || ''; confirmed.checked = false; }
    function showCalculation(calculation, target, title) {
      target.replaceChildren(text('h3', '', title));
      if (!calculation) { target.append(text('p', 'detail-help', '아직 저장한 외부 계산 결과가 없어요. 계산 자료·결과 탭에서 등록해 주세요.')); return; }
      const basis = calculation.source.project;
      target.append(text('p', 'detail-help', `계산 결과 버전 ${calculation.revision} · 계산일 ${calculation.calculatedOn} · ${basis.productName} ${basis.functionalUnit.qty} ${basis.functionalUnit.unit} · ${basis.boundary} · ${basis.refStart} ~ ${basis.refEnd}`));
      const list = document.createElement('ul');
      for (const row of calculation.indicators) list.append(text('li', '', `${row.indicator}: ${row.value} ${row.unit}`));
      target.append(list, text('p', 'detail-help', `${calculation.tool} · ${calculation.method} · 결과 파일 ${calculation.resultFileName}`));
    }
    fill(initial.record);
    function refresh() {
      const state = store.load(project.id);
      moveButton.disabled = !state.ok || state.project.stage !== 5 || !state.ready;
      fields.disabled = !state.ok || ![6, 7].includes(state.project.stage) || !state.ready;
      saveButton.disabled = fields.disabled; adopt.disabled = fields.disabled;
      if (!state.ok) { readiness.textContent = state.error; warning.textContent = state.error; return; }
      expectedScope = LCA.scope.snapshot(state.project);
      moveButton.hidden = state.project.stage !== 5;
      if (!dirty && (state.record?.revision || 0) !== expectedRevision) {
        expectedRevision = state.record?.revision || 0; fill(state.record);
        calculationKey = state.record ? LCA.interpretation.key(state.record.calculation) : state.calculationKey;
      }
      if (!dirty && !state.record) calculationKey = state.calculationKey;
      readiness.textContent = state.project.stage < 5 ? '계산 단계(5)에서 결과 해석을 시작할 수 있어요.'
        : state.project.stage === 5 ? state.ready ? '준비됐어요. 버튼을 누르면 결과 해석 단계(6)로 이동해요.' : '현재 자료가 최소 한 건이고 모두 승인돼야 하며, 최신 자료·범위와 일치하는 외부 계산 결과가 필요해요.'
        : state.project.stage === 6 ? '결과 해석 단계(6)예요. 해석을 저장해도 보고서 단계로 자동 이동하지 않아요.'
        : state.project.stage === 7 ? '보고서 단계(7)에서도 해석을 수정할 수 있어요. 수정하면 보고서 초안도 다시 확인해 주세요.' : '후속 단계의 기록은 조회만 할 수 있어요.';
      showCalculation(state.calculation, result, '현재 저장된 외부 계산 결과');
      saved.replaceChildren(text('h3', '', '저장된 해석'));
      if (!state.record) saved.append(text('p', 'detail-help', '아직 저장한 해석이 없어요.'));
      else {
        saved.append(text('p', state.stale ? 'calculation-notice' : 'detail-help', state.stale ? '계산 결과 또는 근거 변경 · 해석 재확인 필요' : '현재 계산 결과와 같은 기준의 해석이에요.'));
        for (const [key, label] of Object.entries(LCA.interpretation.LABELS)) saved.append(text('h4', '', label), text('p', 'interpretation-text', state.record[key]));
        saved.append(text('p', 'detail-help', `해석 버전 ${state.record.revision} · ${new Intl.DateTimeFormat('ko-KR', {dateStyle:'medium', timeStyle:'short'}).format(new Date(state.record.updatedAt))}`));
        const details = document.createElement('details'); details.append(text('summary', '', '해석 당시 계산 결과 보기'));
        const snapshot = document.createElement('div'); showCalculation(state.record.calculation, snapshot, '해석 당시 결과'); details.append(snapshot); saved.append(details);
      }
      warning.textContent = !state.ready ? '최신 승인 자료와 일치하는 외부 계산 결과를 먼저 준비해 주세요. 기존 해석과 작성 중인 내용은 유지돼요.'
        : calculationKey !== state.calculationKey ? '입력 기준과 현재 계산 결과가 달라요. 최신 결과를 읽고 해석 기준 다시 확인을 눌러 주세요.' : '';
    }
    refreshCurrent = refresh; refresh();
    form.addEventListener('input', () => { dirty = true; errors.textContent = ''; });
    form.addEventListener('change', () => { dirty = true; errors.textContent = ''; });
    adopt.addEventListener('click', () => {
      const state = store.load(project.id);
      if (!state.ok || !state.ready || ![6, 7].includes(state.project.stage)) { refresh(); return; }
      calculationKey = state.calculationKey; confirmed.checked = false; dirty = true;
      feedback.textContent = '해석 기준을 최신 계산 결과로 바꿨어요. 작성 내용은 유지했으니 다시 읽고 수정한 뒤 확인해 주세요.'; refresh();
    });
    moveButton.addEventListener('click', () => {
      const moved = scopeStore.startInterpretation(project.id, expectedScope);
      if (!moved.ok) { moveError.textContent = moved.error; refresh(); return; }
      expectedScope = LCA.scope.snapshot(project); moveError.textContent = ''; onMoved(); refresh();
      readiness.textContent = '결과 해석 단계(6)로 이동했어요. 아래에 해석을 기록해 주세요.'; readiness.tabIndex = -1; readiness.focus();
    });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!confirmed.checked) { errors.textContent = '계산 결과와 근거를 읽고 해석 내용을 확인해 주세요.'; confirmed.focus(); return; }
      const draft = { ...Object.fromEntries(Object.entries(controls).map(([key, input]) => [key, input.value])), confirmed: confirmed.checked };
      const stored = store.save(project.id, draft, expectedRevision, calculationKey);
      errors.textContent = stored.error || Object.values(stored.errors || {}).join(' ');
      if (!stored.ok) { const first = Object.keys(stored.errors || {})[0]; if (first) controls[first].focus(); else { errors.tabIndex = -1; errors.focus(); } return; }
      expectedRevision = stored.record.revision; dirty = false; confirmed.checked = false;
      feedback.textContent = '결과 해석을 저장했어요. 보고서 탭에서 초안을 작성하거나 최신 해석을 반영할 수 있어요.'; refresh(); onSaved();
    });
  }
  return { init, refresh: () => refreshCurrent() };
})();
