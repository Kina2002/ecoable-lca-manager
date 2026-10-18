window.LCA = window.LCA || {};
LCA.views = LCA.views || {};
LCA.views.modelling = (() => {
  let refreshCurrent = () => {};
  function text(tag, className, value) {
    const node = document.createElement(tag);
    node.className = className;
    node.textContent = value;
    return node;
  }
  function init(project, store, onSaved = () => {}) {
    const host = document.querySelector('#project-calculation-panel');
    const initial = store.load(project.id);
    let editingRecord = initial.record || null;
    let expectedRevision = editingRecord?.revision || 0;
    let sourceSignature = editingRecord?.source.signature || initial.source?.signature || '';
    let dirty = false;
    let serial = 0;
    const preparation = text('section', 'detail-card calculation-card', '');
    preparation.append(text('h2', '', '계산용 승인 자료'), text('p', 'detail-help', '승인된 원자료를 CSV로 정리해요. 제품 기준량당 사용량으로 자동 환산하지 않으며, 외부 LCA 도구의 입력 항목에 맞추는 작업은 계산 담당자가 확인해 주세요.'));
    const counts = text('p', '', '');
    counts.setAttribute('role', 'status');
    const exportButton = text('button', 'primary-button', '승인 자료 CSV 내려받기');
    exportButton.type = 'button';
    const exportFeedback = text('p', 'detail-help', '');
    exportFeedback.setAttribute('role', 'status');
    const details = document.createElement('details');
    const summary = text('summary', '', '승인 자료 보기');
    const sources = text('ul', 'calculation-sources', '');
    details.append(summary, sources);
    preparation.append(counts, exportButton, exportFeedback, details);

    const editor = text('section', 'detail-card calculation-card', '');
    editor.append(text('h2', '', '외부 계산 결과'), text('p', 'detail-help', '외부 도구에서 계산한 결과와 산정 근거를 기록해요. 지표별 값을 입력한 그대로 보관하며, 파일은 이름만 기록해요.'));
    const saved = text('div', 'calculation-saved', '');
    const context = text('p', 'detail-note', '');
    const notice = text('p', 'calculation-notice', '');
    notice.setAttribute('role', 'status');
    const sourceWarning = text('p', 'calculation-notice', '');
    sourceWarning.setAttribute('role', 'status');
    const refreshBasis = text('button', 'request-action-button', '입력 기준 다시 확인');
    refreshBasis.type = 'button';
    const form = document.createElement('form');
    form.noValidate = true;
    const fieldset = document.createElement('fieldset');
    fieldset.className = 'calculation-fields';
    const legend = text('legend', '', '외부 계산 결과 입력');
    const grid = text('div', 'scope-form', '');
    fieldset.append(legend, grid);
    const controls = {};
    function field(key, label, multiline = false) {
      const box = document.createElement('div');
      const caption = text('label', '', label);
      const input = document.createElement(multiline ? 'textarea' : 'input');
      input.id = `calculation-${key}`;
      caption.htmlFor = input.id;
      if (!multiline) input.type = 'text';
      else input.rows = 2;
      input.maxLength = LCA.modelling.LIMITS[key] || 10;
      controls[key] = input;
      box.append(caption, input);
      grid.append(box);
      return box;
    }
    field('tool', '계산 도구 · 버전 (필수)');
    controls.tool.placeholder = '외부 계산에 사용한 도구와 버전';
    field('database', '배경 DB·버전 (필수)');
    field('method', '평가 방법·버전 (필수)');
    const dateBox = field('calculatedOn', '외부 계산일 (필수 · 숫자 8자리 입력 가능)');
    controls.calculatedOn.inputMode = 'numeric';
    const calendar = document.createElement('input');
    calendar.type = 'date'; calendar.min = '0001-01-01'; calendar.max = '9999-12-31';
    calendar.className = 'scope-calendar'; calendar.tabIndex = -1; calendar.setAttribute('aria-hidden', 'true');
    const picker = text('button', 'request-action-button', '외부 계산일 달력');
    picker.type = 'button';
    dateBox.append(calendar, picker);
    field('allocation', '할당 방법·적용 근거 (필수)', true);
    controls.allocation.placeholder = '할당하지 않았다면 그 근거를 적어 주세요.';
    field('resultFileName', '결과 파일 이름 (필수)');
    controls.resultFileName.placeholder = '예: 가상_LCA계산결과.xlsx';
    field('note', '계산 메모 (선택)', true);
    const indicators = text('div', 'calculation-indicators', '');
    const addIndicator = text('button', 'request-action-button', '결과 지표 추가');
    addIndicator.type = 'button';
    const indicatorsHelp = text('p', 'detail-help', '지표 이름·결과값·단위를 1~20개 기록해요. 결과값은 음수·소수·지수 표기(예: 1.2e-3)가 가능하며 쉼표는 빼 주세요.');
    indicatorsHelp.id = 'calculation-indicators-help';
    fieldset.append(text('h3', '', '지표별 결과'), indicatorsHelp, indicators, addIndicator);
    const confirmation = text('label', 'calculation-confirmation', '');
    const confirmed = document.createElement('input');
    confirmed.type = 'checkbox'; confirmed.id = 'calculation-scope-confirmed';
    confirmation.append(confirmed, document.createTextNode('이 프로젝트의 평가 기준량·범위와 같은 기준으로 계산한 결과임을 확인했어요.'));
    fieldset.append(confirmation);
    const errors = text('p', 'field-error', '');
    errors.setAttribute('role', 'alert');
    const feedback = text('p', '', '');
    feedback.setAttribute('role', 'status');
    const saveButton = text('button', 'primary-button', '외부 계산 결과 저장');
    saveButton.type = 'submit';
    form.append(fieldset, errors, saveButton, feedback);
    editor.append(saved, context, notice, sourceWarning, refreshBasis, LCA.views.compact.form(form, '계산 결과 입력·수정'));
    host.replaceChildren(preparation, editor);

    function updateRows() {
      const rows = Array.from(indicators.children);
      rows.forEach((row, index) => {
        row.querySelector('legend').textContent = `결과 지표 ${index + 1}`;
        for (const [key, label] of [['indicator', '지표 이름'], ['value', '결과값'], ['unit', '결과 단위']]) row.querySelector(`label[data-label="${key}"]`).textContent = `${label} ${index + 1}`;
        row.querySelector('button').disabled = rows.length === 1;
      });
      addIndicator.disabled = rows.length >= 20;
    }
    function addRow(value = { indicator: '', value: '', unit: '' }) {
      const row = document.createElement('fieldset');
      row.className = 'calculation-indicator-row';
      row.append(text('legend', '', ''));
      const index = ++serial;
      for (const [key, placeholder] of [['indicator', '예: 지구온난화'], ['value', '예: 1.23'], ['unit', '예: kgCO₂e']]) {
        const box = document.createElement('div');
        const caption = document.createElement('label');
        const input = document.createElement('input');
        input.type = 'text'; input.dataset.resultField = key;
        input.id = `calculation-indicator-${index}-${key}`;
        input.maxLength = key === 'indicator' ? 100 : key === 'unit' ? 60 : 50;
        input.value = value[key]; input.placeholder = placeholder;
        input.setAttribute('aria-describedby', indicatorsHelp.id);
        caption.htmlFor = input.id; caption.dataset.label = key;
        box.append(caption, input); row.append(box);
      }
      const remove = text('button', 'request-action-button', '지표 삭제');
      remove.type = 'button';
      remove.addEventListener('click', () => {
        if (indicators.children.length <= 1) return;
        row.remove(); dirty = true; updateRows(); indicators.querySelector('input').focus();
      });
      row.append(remove); indicators.append(row); updateRows();
    }
    function fill(record) {
      for (const [key, input] of Object.entries(controls)) input.value = record?.[key] || (key === 'calculatedOn' ? LCA.rules.today() : '');
      indicators.replaceChildren();
      for (const value of record?.indicators || [{ indicator: '', value: '', unit: '' }]) addRow(value);
      confirmed.checked = false;
    }
    fill(editingRecord);
    form.addEventListener('input', () => { dirty = true; errors.textContent = ''; });
    form.addEventListener('change', () => { dirty = true; errors.textContent = ''; });
    LCA.views.dateInput.bind(controls.calculatedOn, calendar, picker, () => { dirty = true; }, errors);
    addIndicator.addEventListener('click', () => {
      if (indicators.children.length >= 20) return;
      addRow(); dirty = true; indicators.lastElementChild.querySelector('input').focus();
    });
    function showRecord(record, stale) {
      saved.replaceChildren(text('h3', '', '저장된 외부 계산 결과'));
      if (!record) { saved.append(text('p', 'detail-help', '아직 등록한 외부 계산 결과가 없어요.')); return; }
      saved.append(text('p', stale ? 'calculation-notice' : 'detail-help', stale ? '근거 자료 변경 · 재계산 결과 확인 필요' : '현재 승인 자료·평가 범위와 저장 기준이 같아요.'));
      const list = text('dl', 'detail-fields', '');
      for (const [key, label] of Object.entries(LCA.modelling.LABELS)) {
        if (!record[key]) continue;
        const item = document.createElement('div');
        item.append(text('dt', '', label), text('dd', '', record[key])); list.append(item);
      }
      const table = document.createElement('table');
      table.className = 'calculation-results';
      const caption = text('caption', '', `외부 계산일 ${record.calculatedOn} · 기준량 ${record.source.project.functionalUnit.qty} ${record.source.project.functionalUnit.unit}당 결과`);
      const head = document.createElement('thead');
      const headRow = document.createElement('tr');
      for (const value of ['지표', '결과값', '단위']) { const th = text('th', '', value); th.scope = 'col'; headRow.append(th); }
      head.append(headRow);
      const body = document.createElement('tbody');
      for (const indicator of record.indicators) {
        const row = document.createElement('tr');
        for (const value of [indicator.indicator, indicator.value, indicator.unit]) row.append(text('td', '', value));
        body.append(row);
      }
      table.append(caption, head, body);
      saved.append(list, table, text('p', 'detail-help', `저장 버전 ${record.revision} · ${new Intl.DateTimeFormat('ko-KR', {dateStyle:'medium', timeStyle:'short'}).format(new Date(record.updatedAt))}`));
      const basis = record.source.project;
      saved.append(text('p', 'detail-help', `저장 당시 범위: ${basis.productName} · ${basis.boundary} · ${basis.refStart} ~ ${basis.refEnd}`));
      const used = document.createElement('details');
      used.append(text('summary', '', `계산 당시 승인 자료 ${record.source.requests.length}건 보기`));
      const usedList = text('ul', 'calculation-sources', '');
      for (const item of record.source.requests) {
        const r = item.receipt;
        usedList.append(text('li', '', `${item.id} · ${r.kind === 'quantity' ? `${r.value} ${r.unit}` : r.description} · ${r.periodStart} ~ ${r.periodEnd} · ${r.evidenceFileName}`));
      }
      used.append(usedList); saved.append(used);
    }
    function refresh() {
      const state = store.load(project.id);
      exportButton.disabled = !state.ok || !state.source.approved.length;
      fieldset.disabled = !state.ok || state.project.stage < 5 || state.project.stage >= 9;
      saveButton.disabled = !state.ok || state.project.stage < 5 || state.project.stage >= 9 || !state.source.ready;
      refreshBasis.disabled = saveButton.disabled;
      if (!state.ok) {
        counts.textContent = state.error; notice.textContent = state.error;
        saved.replaceChildren(text('p', 'calculation-notice', '저장된 외부 계산 결과를 확인하지 못했어요.'));
        return;
      }
      if (!dirty && (state.record?.revision || 0) !== expectedRevision) {
        editingRecord = state.record; expectedRevision = editingRecord?.revision || 0;
        sourceSignature = editingRecord?.source.signature || state.source.signature; fill(editingRecord);
      }
      if (!dirty && !editingRecord) sourceSignature = state.source.signature;
      counts.textContent = `승인 ${state.source.approved.length}/${state.source.total}건 · 미승인 ${state.source.excluded}건은 내보내기에서 제외해요.`;
      summary.textContent = `승인 자료 ${state.source.approved.length}건 보기`;
      sources.replaceChildren(...state.source.approved.map((item) => {
        const row = document.createElement('li');
        const r = item.receipt;
        const category = LCA.constants.CATEGORIES.find((value) => value.key === item.categoryKey);
        row.append(text('strong', '', `${item.id} · ${category?.name || item.categoryKey}`),
          text('p', '', r.kind === 'quantity' ? `${r.value} ${r.unit}${r.density ? ` · 밀도 ${r.density} kg/m³` : ''}` : r.description),
          text('p', 'detail-help', `${r.periodStart} ~ ${r.periodEnd} · ${r.evidenceFileName}`));
        return row;
      }));
      const p = state.project;
      context.textContent = `결과 기준: ${p.productName} · ${p.functionalUnit?.qty || '미정'} ${p.functionalUnit?.unit || ''} · ${p.boundary || '경계 미정'} · ${p.refStart || '기간 미정'} ~ ${p.refEnd || '미정'}`;
      notice.textContent = p.stage >= 9 ? '인증·등록 준비 이후의 계산 결과는 읽기 전용이에요.' : p.stage < 5 ? '계산 단계(5)부터 외부 계산 결과를 등록할 수 있어요.'
        : !state.source.ready ? '현재 자료가 최소 한 건 있고 모두 승인돼야 결과를 저장할 수 있어요.' : '외부 도구에서 같은 기준으로 계산한 결과를 기록해 주세요.';
      sourceWarning.textContent = sourceSignature !== state.source.signature ? '입력 기준이 현재 자료와 달라요. 외부 계산 결과를 다시 확인한 뒤 입력 기준 다시 확인을 눌러 주세요.' : '';
      showRecord(state.record, state.stale);
    }
    refreshCurrent = refresh;
    refresh();
    exportButton.addEventListener('click', () => {
      const result = store.csv(project.id);
      if (!result.ok) { exportFeedback.textContent = result.error; refresh(); return; }
      const url = URL.createObjectURL(new Blob([result.csv], {type:'text/csv;charset=utf-8'}));
      const link = document.createElement('a');
      link.href = url; link.download = result.filename;
      document.body.append(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      exportFeedback.textContent = `승인 자료 ${result.count}건을 내려받았어요. 미승인 ${result.excluded}건은 제외했어요.`;
    });
    refreshBasis.addEventListener('click', () => {
      const state = store.load(project.id);
      if (!state.ok || !state.source.ready) { refresh(); return; }
      sourceSignature = state.source.signature; confirmed.checked = false; dirty = true;
      feedback.textContent = '입력 기준을 최신 승인 자료로 바꿨어요. 외부 계산의 결과값·기준량·범위를 다시 확인한 뒤 저장해 주세요.';
      refresh();
    });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const draft = { ...Object.fromEntries(Object.entries(controls).map(([key, input]) => [key, input.value])),
        scopeConfirmed: confirmed.checked, indicators: Array.from(indicators.children).map((row) =>
          Object.fromEntries(Array.from(row.querySelectorAll('input')).map((input) => [input.dataset.resultField, input.value]))) };
      draft.calculatedOn = LCA.requests.formatDateInput(draft.calculatedOn.trim());
      const result = store.save(project.id, draft, expectedRevision, sourceSignature);
      errors.textContent = result.error || Object.values(result.errors || {}).join(' ');
      if (!result.ok) {
        const first = Object.keys(result.errors || {})[0];
        if (!first) { errors.tabIndex = -1; errors.focus(); }
        else (controls[first] || (first === 'scopeConfirmed' ? confirmed : indicators.querySelector('input')))?.focus();
        return;
      }
      editingRecord = result.record; expectedRevision = result.record.revision; sourceSignature = result.record.source.signature;
      dirty = false; feedback.textContent = '외부 계산 결과를 저장했어요. 프로젝트 단계는 그대로예요.';
      refresh();
      onSaved();
    });
  }
  return { init, refresh: () => refreshCurrent() };
})();
