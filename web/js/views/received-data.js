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
  function summary(receipt) {
    const section = text('section', 'receipt-summary', '');
    section.setAttribute('aria-label', '받은 자료');
    section.append(text('h4', '', '받은 자료'), text('p', 'receipt-review-note', '제출됨 · 내용 검토 전'));
    if (receipt.kind === 'quantity') {
      section.append(text('p', 'receipt-value', `${LCA.receivedData.displayNumber(receipt.value)} ${receipt.unit}`));
      if (receipt.density) section.append(text('p', 'receipt-meta', `밀도 ${LCA.receivedData.displayNumber(receipt.density)} kg/m³`));
    } else section.append(text('p', 'receipt-document', receipt.description));
    section.append(text('p', 'receipt-meta', `자료 기간 ${receipt.periodStart} ~ ${receipt.periodEnd}`));
    section.append(text('p', 'receipt-meta', `증빙 파일 ${receipt.evidenceFileName}`));
    return section;
  }

  function init(panel, project, store, onSaved) {
    panel.append(document.querySelector('#receipt-editor-template').content.cloneNode(true));
    const find = (selector) => panel.querySelector(selector);
    const dialog = find('#receipt-dialog');
    const form = find('#receipt-form');
    const keys = ['kind', 'value', 'unit', 'density', 'description', 'periodStart', 'periodEnd', 'evidenceFileName'];
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
    }
    for (const key of keys) fields[key].addEventListener('input', () => clearError(key));
    fields.kind.addEventListener('change', () => { showErrors(); showKind(); });
    fields.unit.addEventListener('change', () => { clearError('unit'); clearError('density'); showKind(); });
    for (const [key, prefix] of [['periodStart', 'start'], ['periodEnd', 'end']]) {
      LCA.views.dateInput.bind(fields[key], find(`#receipt-${prefix}-calendar`), find(`#receipt-${prefix}-button`), () => clearError(key), find(`#receipt-${key}-error`));
    }
    for (const selector of ['#receipt-close', '#receipt-cancel']) find(selector).addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => { if (opener?.isConnected) opener.focus({ preventScroll: true }); });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const draft = Object.fromEntries(keys.map((key) => [key, fields[key].value]));
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
      for (const key of keys) fields[key].value = values[key] || '';
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
