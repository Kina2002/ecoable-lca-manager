/* 한 요청에서 받은 자료를 기록·다시 확인하는 창. 저장 성공 때만 목록을 바꾼다. */
window.LCA = window.LCA || {};
LCA.views = LCA.views || {};
LCA.views.receivedData = (() => {
  const text = (tag, className, value) => {
    const element = document.createElement(tag);
    element.className = className;
    element.textContent = value;
    return element;
  };
  function summary(receipt, status = '제출됨') {
    const section = text('section', 'receipt-summary', '');
    section.setAttribute('aria-label', '받은 자료');
    const notes = { '제출됨': '제출됨 · 내용 검토 전', '검토 중': '검토 중 · 담당자가 확인하고 있어요', '보완 요청': '보완 요청 · 추가 자료를 기다리고 있어요', '승인': '승인 · 담당자가 요청에 맞는 자료로 확인했어요' };
    section.append(text('h4', '', '받은 자료'), text('p', 'receipt-review-note', notes[status] || status));
    if (receipt.kind === 'quantity') {
      section.append(text('p', 'receipt-value', `${LCA.receivedData.displayNumber(receipt.value)} ${receipt.unit}`));
      if (receipt.density) section.append(text('p', 'receipt-meta', `밀도 ${LCA.receivedData.displayNumber(receipt.density)} kg/m³`));
    } else section.append(text('p', 'receipt-document', receipt.description));
    section.append(text('p', 'receipt-meta', `자료 기간 ${receipt.periodStart} ~ ${receipt.periodEnd}`));
    section.append(text('p', 'receipt-meta', `증빙 파일 ${receipt.evidenceFileName}`));
    const source = receipt.provenance;
    if (!source) section.append(text('p', 'receipt-meta', '자료 출처: 아직 기록하지 않았어요.'));
    else {
      section.append(text('p', 'receipt-meta', `활동량 출처 ${source.activitySource || '미기록'}${source.activitySourceDetail ? ` · ${source.activitySourceDetail}` : ''} · 획득 방법 ${source.acquisitionMethod || '미기록'}`));
      if (receipt.kind === 'quantity') section.append(text('p', 'receipt-meta', `계수 출처 ${LCA.receivedData.factorSourceLabel(source.factorSource)}`));
      if (source.factorSource === '2차') section.append(text('p', 'receipt-meta', `계수 데이터셋: ${source.datasetDatabase} · ${source.datasetName} · ${source.datasetVersion} · ${source.datasetYear} · ${source.datasetSource}`));
    }
    return section;
  }

  function init(panel, project, store, onSaved) {
    panel.append(document.querySelector('#receipt-editor-template').content.cloneNode(true));
    const find = (selector) => panel.querySelector(selector);
    const dialog = find('#receipt-dialog');
    const form = find('#receipt-form');
    const coreKeys = ['kind', 'value', 'unit', 'density', 'description', 'periodStart', 'periodEnd', 'evidenceFileName'];
    const sourceKeys = LCA.receivedData.SOURCE_FIELDS;
    const keys = [...coreKeys, ...sourceKeys];
    const fields = Object.fromEntries(keys.map((key) => [key, find(`#receipt-${key}`)]));
    let activeId = null;
    let opener = null;
    const unitPlaceholder = text('option', '', '단위를 골라 주세요');
    unitPlaceholder.value = '';
    fields.unit.append(unitPlaceholder);
    for (const unit of LCA.receivedData.UNITS) {
      const option = text('option', '', unit);
      option.value = unit;
      fields.unit.append(option);
    }
    function clearError(key) {
      fields[key].removeAttribute('aria-invalid');
      find(`#receipt-${key}-error`).hidden = true;
      find(`#receipt-${key}-error`).textContent = '';
    }
    function showErrors(errors = {}) {
      for (const key of keys) {
        const error = find(`#receipt-${key}-error`);
        error.textContent = errors[key] || '';
        error.hidden = !errors[key];
        fields[key].setAttribute('aria-invalid', String(Boolean(errors[key])));
      }
      if (sourceKeys.some((key) => errors[key]) || errors.provenance) find('#receipt-source-details').open = true;
    }
    function showSource() {
      const quantity = fields.kind.value === 'quantity';
      const dataset = quantity && fields.factorSource.value === '2차';
      find('#receipt-factor-source-field').hidden = !quantity;
      find('#receipt-dataset-fields').hidden = !dataset;
      fields.factorSource.disabled = !quantity;
      for (const key of ['datasetDatabase', 'datasetName', 'datasetVersion', 'datasetYear', 'datasetSource']) fields[key].disabled = !dataset;
    }
    function showKind() {
      const quantity = fields.kind.value === 'quantity';
      const volume = quantity && LCA.receivedData.VOLUME_UNITS.includes(fields.unit.value);
      find('#receipt-quantity-fields').hidden = !quantity;
      find('#receipt-document-fields').hidden = quantity;
      find('#receipt-density-field').hidden = !volume;
      for (const key of ['value', 'unit']) fields[key].disabled = !quantity;
      fields.density.disabled = !volume;
      fields.density.required = volume;
      fields.description.disabled = quantity;
      fields.description.required = !quantity;
      showSource();
    }
    for (const key of keys) fields[key].addEventListener('input', () => clearError(key));
    fields.kind.addEventListener('change', () => { showErrors(); showKind(); });
    fields.factorSource.addEventListener('change', () => { showErrors(); showSource(); });
    fields.activitySource.addEventListener('change', () => clearError('activitySourceDetail'));
    fields.unit.addEventListener('change', () => { clearError('unit'); clearError('density'); showKind(); });
    for (const [key, prefix] of [['periodStart', 'start'], ['periodEnd', 'end']]) {
      LCA.views.dateInput.bind(fields[key], find(`#receipt-${prefix}-calendar`), find(`#receipt-${prefix}-button`), () => clearError(key), find(`#receipt-${key}-error`));
    }
    for (const selector of ['#receipt-close', '#receipt-cancel']) find(selector).addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => { if (opener?.isConnected) opener.focus({ preventScroll: true }); });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const draft = { ...Object.fromEntries(coreKeys.map((key) => [key, fields[key].value])), provenance: Object.fromEntries(sourceKeys.map((key) => [key, fields[key].value])) };
      if (draft.kind !== 'quantity') draft.provenance.factorSource = '';
      const result = store.recordReceipt(project.id, activeId, draft);
      showErrors(result.errors);
      const error = find('#receipt-form-error');
      error.hidden = result.ok || Boolean(result.errors);
      error.textContent = result.message || '';
      if (!result.ok) {
        if (result.errors) fields[Object.keys(result.errors)[0]].focus();
        return;
      }
      dialog.close();
      onSaved(result.item);
    });
    function open(id, button) {
      const result = store.list(project.id);
      const item = result.ok && result.items.find((value) => value.id === id);
      if (!item) {
        const error = find('#request-action-error');
        error.textContent = result.message || '자료 요청을 찾지 못했습니다. 프로젝트를 다시 열어 확인해 주세요.';
        error.hidden = false;
        return;
      }
      activeId = id;
      opener = button;
      form.reset();
      showErrors();
      find('#receipt-form-error').hidden = true;
      const category = LCA.constants.CATEGORIES.find((value) => value.key === item.categoryKey);
      const values = item.receipt || { kind: category.unit ? 'quantity' : 'document', unit: category.unit };
      find('#receipt-intro').textContent = item.review
        ? '저장하면 이전 체크·검토 메모·승인 또는 보완 결과를 초기화하고 ‘제출됨’으로 돌아가요. 바뀐 자료를 다시 검토해야 해요. 취소하면 기존 기록을 유지해요.'
        : '고객사에서 받은 자료를 보고 적어 주세요. 저장하면 ‘제출됨’이 되며, 이후 담당자가 요청한 내용에 맞는지 검토해요.';
      for (const key of coreKeys) fields[key].value = values[key] || '';
      for (const key of sourceKeys) fields[key].value = values.provenance?.[key] || '';
      find('#receipt-source-details').open = Boolean(item.receipt?.provenance);
      find('#receipt-title').textContent = item.receipt ? '받은 자료 확인·수정' : '받은 자료 기록하기';
      find('#receipt-request-context').replaceChildren(text('strong', '', `${item.id} · ${category.name}`), text('p', '', item.detail));
      showKind();
      dialog.showModal();
      (item.receipt ? fields.kind : fields.kind.value === 'quantity' ? fields.value : fields.description).focus();
    }
    return { open };
  }
  return { init, summary };
})();
