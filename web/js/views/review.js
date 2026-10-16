/* 담당자의 체크·메모와 검토 결과를 기록하는 창. */
window.LCA = window.LCA || {};
LCA.views = LCA.views || {};
LCA.views.review = (() => {
  function text(tag, className, value) {
    const element = document.createElement(tag);
    element.className = className;
    element.textContent = value;
    return element;
  }
  function summary(item) {
    const section = text('section', 'review-summary', '');
    section.setAttribute('aria-label', '담당자 검토 기록');
    const count = LCA.review.CHECKS.filter(({ key }) => item.review.checks[key]).length;
    section.append(text('h4', '', `${item.status} · 확인 ${count}/3`));
    if (item.review.note) section.append(text('p', '', `${item.status === '보완 요청' ? '보완 사유' : '검토 메모'}: ${item.review.note}`));
    const time = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.review.updatedAt));
    section.append(text('p', 'input-help', `검토 기록 ${time}`));
    return section;
  }
  function init(panel, project, store, onChanged) {
    panel.append(document.querySelector('#review-editor-template').content.cloneNode(true));
    const find = (selector) => panel.querySelector(selector);
    const dialog = find('#review-dialog');
    const note = find('#review-note');
    let activeId = null;
    let expectedReview = null;
    const boxes = {};
    for (const { key, label } of LCA.review.CHECKS) {
      const row = text('label', 'review-check-row', '');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = `review-check-${key}`;
      checkbox.setAttribute('aria-describedby', 'review-checks-help review-checks-error');
      boxes[key] = checkbox;
      row.append(checkbox, text('span', '', label));
      find('#review-checks').append(row);
      checkbox.addEventListener('change', () => { find('#review-checks-error').hidden = true; find('#review-checklist').removeAttribute('aria-invalid'); });
    }
    note.addEventListener('input', () => { find('#review-note-error').hidden = true; note.removeAttribute('aria-invalid'); });
    find('#review-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => find(`#request-items button[data-review-id="${activeId}"]`)?.focus({ preventScroll: true }));
    find('#review-form').addEventListener('submit', (event) => {
      event.preventDefault();
      const draft = { checks: Object.fromEntries(Object.entries(boxes).map(([key, box]) => [key, box.checked])), note: note.value };
      const action = event.submitter?.value || 'draft';
      const result = store.saveReview(project.id, activeId, draft, action, expectedReview);
      const errors = result.errors || {};
      for (const key of ['checks', 'note']) {
        const error = find(`#review-${key}-error`);
        error.textContent = errors[key] || '';
        error.hidden = !errors[key];
      }
      find('#review-checklist').setAttribute('aria-invalid', String(Boolean(errors.checks)));
      note.setAttribute('aria-invalid', String(Boolean(errors.note)));
      const error = find('#review-form-error');
      error.textContent = result.message || errors.action || '';
      error.hidden = !error.textContent;
      if (!result.ok) {
        if (errors.checks) boxes.period.focus();
        else if (errors.note) note.focus();
        return;
      }
      dialog.close();
      const message = action === 'approve' ? '담당자가 요청에 맞는 자료로 승인했어요.' : action === 'revision' ? '보완 요청과 사유를 저장했어요. 새 자료를 받으면 ‘받은 자료 보기·수정’에서 다시 기록해 주세요.' : '검토 내용과 체크를 저장했어요. 상태는 ‘검토 중’이에요.';
      onChanged(result.item, message);
    });
    function open(id) {
      const result = store.list(project.id);
      let item = result.ok && result.items.find((value) => value.id === id && value.receipt);
      let message = result.message;
      if (item?.status === '제출됨') {
        const started = store.startReview(project.id, id);
        if (started.ok) { item = started.item; onChanged(item, '검토를 시작했어요. 회사에서 받은 자료가 요청에 맞는지 확인해 주세요.'); }
        else { item = null; message = started.message; }
      }
      if (!item?.review) {
        find('#request-action-error').textContent = message || '검토할 자료를 찾지 못했습니다. 프로젝트를 다시 열어 주세요.';
        find('#request-action-error').hidden = false;
        return;
      }
      activeId = id;
      expectedReview = item.review;
      const readOnly = item.status !== '검토 중';
      const category = LCA.constants.CATEGORIES.find((value) => value.key === item.categoryKey);
      find('#review-title').textContent = readOnly ? '받은 자료 검토 결과' : '받은 자료 검토';
      find('#review-request-context').replaceChildren(text('strong', '', `${item.id} · ${category.name}`), text('p', '', `요청 내용: ${item.detail}`));
      find('#review-receipt-context').replaceChildren(LCA.views.receivedData.summary(item.receipt, item.status));
      find('#review-current-status').textContent = `현재 상태: ${item.status}`;
      for (const { key } of LCA.review.CHECKS) boxes[key].checked = item.review.checks[key];
      find('#review-checklist').disabled = readOnly;
      find('#review-checklist').removeAttribute('aria-invalid');
      note.value = item.review.note;
      note.readOnly = readOnly;
      note.removeAttribute('aria-invalid');
      for (const key of ['checks', 'note', 'form']) find(`#review-${key}-error`).hidden = true;
      find('#review-actions').hidden = readOnly;
      find('#review-save-note').textContent = readOnly
        ? '담당자가 저장한 결과예요. 받은 자료를 다시 저장하면 이 결과와 체크를 초기화하고 새로 검토해요. 이전 검토 이력은 별도로 보관하지 않아요.'
        : '검토 시작은 상태에 저장돼요. 체크·메모 변경은 아래 버튼을 눌러야 저장돼요. 닫으면 아직 저장하지 않은 입력은 버려져요.';
      dialog.showModal();
      (readOnly ? find('#review-close') : boxes.period).focus();
    }
    return { open };
  }
  return { init, summary };
})();
