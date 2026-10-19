/* 한 프로젝트의 필요한 자료와 받은 자료를 연결해 보여준다. */
window.LCA = window.LCA || {};
LCA.views = LCA.views || {};

LCA.views.requests = (() => {
  let refreshCurrent = () => {};
  let focusCurrent = () => {};
  function textElement(tag, className, value) {
    const element = document.createElement(tag);
    element.className = className;
    element.textContent = value;
    return element;
  }

  function referenceContent(guide) {
    const fragment = document.createDocumentFragment();
    fragment.append(textElement('p', 'guideline-section', `${guide.source} · ${guide.section}`));
    const link = textElement('a', 'guideline-link', `원문 ${guide.page}쪽 보기 ↗`);
    link.href = `${guide.url}#page=${guide.page}`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.setAttribute('aria-label', `${guide.source} ${guide.page}쪽 (새 탭)`);
    fragment.append(link, textElement('p', 'input-help', `${guide.note} 확인일: ${guide.checkedOn}`));
    return fragment;
  }

  function init(project, store, onChanged = () => {}, getMessageState = null) {
    const panel = document.querySelector('#project-request-content');
    panel.replaceChildren(document.querySelector('#request-panel-template').content.cloneNode(true));
    const find = (selector) => panel.querySelector(selector);
    find('.request-intro').textContent = `${project.companyName}의 ${project.productName} 평가에 필요한 자료를 적어 두는 목록이에요.`;
    const messageEditor = LCA.views.requestMessage.init(panel, getMessageState || (() => {
      const result = store.list(project.id);
      return result.ok ? { ok: true, project, items: result.items, canGenerate: result.canWrite, reason: result.readOnlyReason } : { ok: false, error: result.message };
    }), store, project.id);
    const fields = {
      categoryKey: find('#request-category'), detail: find('#request-detail'), dueDate: find('#request-due-date')
    };
    const errorIds = { categoryKey: '#request-category-error', detail: '#request-detail-error', dueDate: '#request-date-error' };
    const defaultOption = textElement('option', '', '자료 구분을 골라 주세요');
    defaultOption.value = '';
    fields.categoryKey.append(defaultOption);
    LCA.constants.CATEGORIES.forEach((category) => {
      const option = textElement('option', '', category.name);
      option.value = category.key;
      fields.categoryKey.append(option);
    });
    let selectedCategory = '';
    let selectedStatus = null;
    const drafts = new Map();
    const contextDrafts = new Map();
    const statusButtons = new Map();
    const expandedRecords = new Set();
    const notApplicableDrafts = new Map();
    for (const status of [null, ...LCA.requestFilter.STATUSES]) {
      const button = textElement('button', 'request-status-filter', '');
      button.type = 'button';
      button.dataset.requestStatus = status || 'all';
      button.setAttribute('aria-controls', 'request-items');
      const label = textElement('span', '', status || '전체');
      const count = textElement('span', 'count-badge', '0');
      label.setAttribute('aria-hidden', 'true');
      count.setAttribute('aria-hidden', 'true');
      button.append(label, count);
      statusButtons.set(status, { button, count });
      find('#request-status-filters').append(button);
    }
    function showFeedback(item, message) {
      const hint = selectedStatus && item.status !== selectedStatus && !item.deletedAt
        ? ` 선택한 상태와 달라 현재 목록에서는 빠졌어요. ‘전체’ 또는 ‘${item.status}’에서 확인할 수 있어요.` : '';
      find('#request-feedback').textContent = `${message}${hint}`;
    }
    function focusChanged(item, kind) {
      const button = find(`#request-items button[data-${kind}-id="${item.id}"]`);
      (button || statusButtons.get(selectedStatus).button).focus({ preventScroll: true });
    }

    function showGuide() {
      const container = find('#request-guideline');
      const guide = LCA.constants.requestGuideline(fields.categoryKey.value);
      container.hidden = !guide;
      container.replaceChildren();
      if (guide) container.append(textElement('strong', '', '지침 근거 (참고)'), referenceContent(guide));
    }

    function showErrors(errors = {}) {
      for (const [key, field] of Object.entries(fields)) {
        field.setAttribute('aria-invalid', String(Boolean(errors[key])));
        const error = find(errorIds[key]);
        error.textContent = errors[key] || '';
        error.hidden = !errors[key];
      }
    }

    function clearError(key) {
      fields[key].removeAttribute('aria-invalid');
      const error = find(errorIds[key]);
      error.hidden = true;
      error.textContent = '';
    }
    for (const [key, field] of Object.entries(fields)) {
      field.addEventListener('input', () => clearError(key));
    }

    LCA.views.dateInput.bind(fields.dueDate, find('#request-calendar'), find('#request-calendar-button'), () => clearError('dueDate'), find('#request-date-error'));
    const receiptEditor = LCA.views.receivedData.init(panel, project, store, (item) => {
      renderItems();
      find('#request-action-error').hidden = true;
      showFeedback(item, `${item.id}의 받은 자료를 저장했어요. 상태는 ‘제출됨’이며 내용 검토는 다음 과정이에요.`);
      focusChanged(item, 'receipt');
    });
    const reviewEditor = LCA.views.review.init(panel, project, store, (item, message) => {
      renderItems();
      find('#request-action-error').hidden = true;
      showFeedback(item, `${item.id} · ${message}`);
      focusChanged(item, 'review');
    });
    const batchEditor = LCA.views.requestBatch.init(panel, project, store, () => {
      find('#request-action-error').hidden = true;
      renderItems();
    });

    function renderItems() {
      for (const details of panel.querySelectorAll('details[data-record-details]')) {
        if (details.open) expandedRecords.add(details.dataset.recordDetails); else expandedRecords.delete(details.dataset.recordDetails);
      }
      for (const details of panel.querySelectorAll('details[data-not-applicable-details]')) {
        const id = details.dataset.notApplicableDetails;
        if (details.open) expandedRecords.add(`na:${id}`); else expandedRecords.delete(`na:${id}`);
      }
      const result = store.list(project.id);
      messageEditor.refresh();
      batchEditor.render(result);
      onChanged(result);
      find('#request-storage-error').hidden = result.ok;
      find('#request-storage-error').textContent = result.message || '';
      find('#register-request').disabled = !result.ok || !result.canWrite;
      for (const input of find('#request-form').querySelectorAll('input, textarea, select, button')) input.disabled = !result.ok || !result.canWrite;
      if (result.ok && !result.canWrite) find('.request-intro').textContent = result.readOnlyReason;
      find('#request-status-controls').hidden = !result.ok;
      if (!result.ok) {
        find('#request-count').textContent = '—';
        document.querySelector('#detail-request-count').textContent = '—';
        find('#request-empty').hidden = true;
        find('#request-items').replaceChildren();
        find('#request-trash').hidden = true;
        return;
      }
      const snapshot = LCA.requestFilter.snapshot(result.items, project.id, selectedStatus);
      for (const [status, { button, count }] of statusButtons) {
        const total = status === null ? snapshot.total : snapshot.counts[status];
        count.textContent = total;
        button.setAttribute('aria-pressed', String(status === selectedStatus));
        button.setAttribute('aria-label', `${status || '전체'} ${total}건`);
      }
      find('#request-filter-summary').textContent = selectedStatus === null
        ? `전체 ${snapshot.total}건 표시`
        : `전체 ${snapshot.total}건 중 ‘${selectedStatus}’ ${snapshot.visible.length}건 표시`;
      function requestCard(item, deleted) {
        const category = LCA.constants.CATEGORIES.find((value) => value.key === item.categoryKey);
        const card = textElement('li', 'request-item', '');
        card.dataset.requestId = item.id;
        const top = textElement('div', 'request-item-header', '');
        const identity = textElement('div', 'request-item-identity', '');
        const actions = textElement('div', 'request-item-actions', '');
        const action = textElement('button', `request-action-button${deleted ? '' : ' request-delete-button'}`, deleted ? '복원' : '삭제');
        action.type = 'button';
        action.disabled = !result.canWrite;
        action.dataset.requestAction = deleted ? 'restore' : 'remove';
        action.dataset.requestId = item.id;
        action.setAttribute('aria-label', `${item.id} ${category.name} 자료 요청 ${deleted ? '복원' : '삭제'}`);
        const stateClass = !deleted && item.status === '보완 요청' ? ' request-state-revision' : !deleted && item.status === '해당 없음' ? ' request-state-na' : !deleted && item.receipt ? ' request-state-received' : '';
        identity.append(textElement('h3', '', category.name), textElement('span', 'request-code', item.id), textElement('span', `request-state${stateClass}`, deleted ? '삭제됨' : item.status));
        const due = textElement('p', 'request-item-due', '제출 기한 ');
        const date = textElement('time', '', item.dueDate.replaceAll('-', '.'));
        date.dateTime = item.dueDate;
        due.append(date);
        if (!deleted) due.append(document.createTextNode(' '), LCA.views.deadlines.badge(LCA.deadlines.item(item)));
        const reference = document.createElement('details');
        reference.className = 'request-reference';
        reference.append(textElement('summary', '', '지침 근거 보기'), referenceContent(item.guideline));
        const details = document.createElement('details'); details.className = 'request-record-details';
        const recordKey = `${deleted ? 'deleted' : 'active'}:${item.id}`; details.dataset.recordDetails = recordKey; details.open = expandedRecords.has(recordKey);
        const detailsToggle = textElement('summary', '', '요청 내용·자료·검토 기록'); detailsToggle.setAttribute('aria-label', `${item.id} ${category.name} 요청 내용·자료·검토 기록`);
        details.append(detailsToggle, textElement('p', 'request-item-detail', item.detail));
        if (item.receipt) details.append(LCA.views.receivedData.summary(item.receipt, item.status));
        if (item.review) details.append(LCA.views.review.summary(item));
        if (item.notApplicable) details.append(textElement('p', 'request-item-detail', `해당 없음 사유: ${item.notApplicable.reason}`));
        if (!deleted) {
          if (item.status !== '해당 없음') {
            const record = textElement('button', 'request-action-button receipt-open-button', item.receipt ? '받은 자료 보기·수정' : '받은 자료 기록');
            record.type = 'button';
            record.disabled = !result.canWrite;
            record.dataset.receiptId = item.id;
            record.setAttribute('aria-label', `${item.id} ${category.name} ${record.textContent}`);
            actions.append(record);
          } else {
            const restore = textElement('button', 'request-action-button', '다시 요청하기');
            restore.type = 'button'; restore.disabled = !result.canWrite; restore.dataset.applicableRestore = item.id;
            restore.setAttribute('aria-label', `${item.id} ${category.name} 해당 없음 취소하고 다시 요청하기`);
            actions.append(restore);
          }
          if (item.receipt) {
            const reviewLabel = item.status === '제출됨' ? '검토 시작' : item.status === '검토 중' ? '이어서 검토' : '검토 결과 보기';
            const reviewButton = textElement('button', 'request-action-button receipt-open-button review-open-button', reviewLabel);
            reviewButton.type = 'button';
            reviewButton.disabled = !result.canWrite;
            reviewButton.dataset.reviewId = item.id;
            reviewButton.setAttribute('aria-label', `${item.id} ${category.name} ${reviewLabel}`);
            actions.append(reviewButton);
          }
        }
        actions.append(action); top.append(identity, due, actions); card.append(top);
        if (item.receipt) card.append(textElement('p', 'request-item-value', item.receipt.kind === 'quantity'
          ? `${LCA.receivedData.displayNumber(item.receipt.value)} ${item.receipt.unit} · ${item.receipt.evidenceFileName}` : `문서 자료 · ${item.receipt.evidenceFileName}`));
        if (item.status === '보완 요청' && item.review?.note) card.append(textElement('p', 'request-revision-note', `보완 필요: ${item.review.note}`));
        if (item.notApplicable) card.append(textElement('p', 'request-revision-note', `해당 없음: ${item.notApplicable.reason}`));
        details.append(reference); card.append(details);
        if (!deleted) card.append(LCA.views.requestContext.editor(item, project, store, {
          open: expandedRecords.has(`context:${item.id}`), canWrite: result.canWrite, drafts: contextDrafts,
          onSaved: (saved) => {
            expandedRecords.add(`context:${item.id}`); renderItems();
            showFeedback(saved, `${saved.id} 취합 정보를 저장했어요. 고객사 담당자와 자료 전달 경로는 유지돼요.`);
            const target = [...find('#request-items').querySelectorAll('.request-context')].find((node) => node.dataset.recordDetails === `context:${saved.id}`)?.querySelector('summary');
            target?.focus({ preventScroll: true });
          }
        }));
        else if (item.collectionContext) card.append(textElement('p', 'detail-help', LCA.views.requestContext.summary(item)));
        if (!deleted && item.status === '요청' && result.canWrite) {
          const box = document.createElement('details'); box.className = 'request-na-details'; box.dataset.notApplicableDetails = item.id;
          box.open = expandedRecords.has(`na:${item.id}`);
          box.append(textElement('summary', '', '이 자료가 해당하지 않나요?'));
          const form = document.createElement('form'); form.dataset.notApplicableForm = item.id;
          const label = textElement('label', '', '해당하지 않는 이유');
          label.htmlFor = `na-reason-${item.id}`;
          const reason = document.createElement('textarea'); reason.id = label.htmlFor; reason.name = 'reason'; reason.maxLength = 1000; reason.rows = 2;
          reason.value = notApplicableDrafts.get(item.id) || '';
          reason.setAttribute('aria-describedby', `na-help-${item.id} na-error-${item.id}`);
          const help = textElement('p', 'input-help', '예: 해당 사업장에는 이 공정이 없어 이 자료가 발생하지 않아요.'); help.id = `na-help-${item.id}`;
          const error = textElement('p', 'form-error', ''); error.id = `na-error-${item.id}`; error.setAttribute('role', 'alert'); error.hidden = true;
          const save = textElement('button', 'request-action-button', '사유 저장 · 해당 없음'); save.type = 'submit';
          form.append(label, reason, help, error, save); box.append(form); card.append(box);
        }
        return card;
      }
      find('#request-items').replaceChildren(...snapshot.visible.map((item) => requestCard(item, false)));
      find('#request-trash-items').replaceChildren(...result.deletedItems.map((item) => requestCard(item, true)));
      find('#request-trash-count').textContent = result.deletedItems.length;
      find('#request-trash').hidden = result.deletedItems.length === 0;
      find('#request-count').textContent = snapshot.total;
      document.querySelector('#detail-request-count').textContent = snapshot.total;
      find('#request-empty').hidden = snapshot.visible.length !== 0;
      find('#request-empty').textContent = selectedStatus === null
        ? '아직 등록한 자료 요청이 없어요. 위에서 여러 자료를 선택하거나 한 개씩 등록해 보세요.'
        : `‘${selectedStatus}’ 상태의 자료 요청이 없어요. ‘전체’를 누르면 이 프로젝트의 현재 요청을 모두 볼 수 있어요.`;
      const registered = new Set(result.items.map((item) => item.categoryKey));
      for (const option of fields.categoryKey.options) {
        const category = LCA.constants.CATEGORIES.find((value) => value.key === option.value);
        option.disabled = registered.has(option.value);
        if (category) option.textContent = `${category.name}${option.disabled ? ' · 등록됨' : ''}`;
      }
    }

    find('#request-status-filters').addEventListener('click', (event) => {
      const button = event.target.closest('button[data-request-status]');
      if (!button) return;
      const status = button.dataset.requestStatus === 'all' ? null : button.dataset.requestStatus;
      if (status !== null && !LCA.requestFilter.STATUSES.includes(status)) return;
      selectedStatus = status;
      find('#request-feedback').textContent = '';
      renderItems();
    });

    find('.request-list-card').addEventListener('click', (event) => {
      const restoreApplicable = event.target.closest('button[data-applicable-restore]');
      if (restoreApplicable) {
        const result = store.restoreApplicable(project.id, restoreApplicable.dataset.applicableRestore);
        const error = find('#request-action-error'); error.hidden = result.ok; error.textContent = result.message || '';
        if (!result.ok) return;
        renderItems(); showFeedback(result.item, `${result.item.id}을 다시 요청 상태로 돌렸어요.`);
        focusChanged(result.item, 'receipt'); return;
      }
      const reviewButton = event.target.closest('button[data-review-id]');
      if (reviewButton) { reviewEditor.open(reviewButton.dataset.reviewId); return; }
      const receiptButton = event.target.closest('button[data-receipt-id]');
      if (receiptButton) { receiptEditor.open(receiptButton.dataset.receiptId, receiptButton); return; }
      const button = event.target.closest('button[data-request-action]');
      if (!button) return;
      const action = button.dataset.requestAction;
      const result = store[action](project.id, button.dataset.requestId);
      const error = find('#request-action-error');
      error.hidden = result.ok;
      error.textContent = result.message || '';
      find('#request-feedback').textContent = '';
      if (!result.ok) return;
      renderItems();
      showFeedback(result.item, action === 'remove'
        ? `${result.item.id} 자료 요청을 삭제했어요. 아래 ‘삭제한 자료 요청’에서 복원할 수 있어요.`
        : `${result.item.id} 자료 요청을 복원했어요.`);
      find('#request-list-title').focus({ preventScroll: true });
    });

    find('.request-list-card').addEventListener('input', (event) => {
      const form = event.target.closest('form[data-not-applicable-form]');
      if (form && event.target.name === 'reason') notApplicableDrafts.set(form.dataset.notApplicableForm, event.target.value);
    });
    find('.request-list-card').addEventListener('submit', (event) => {
      const form = event.target.closest('form[data-not-applicable-form]');
      if (!form) return;
      event.preventDefault();
      const id = form.dataset.notApplicableForm;
      const result = store.markNotApplicable(project.id, id, form.elements.reason.value);
      const error = form.querySelector('[role="alert"]');
      error.hidden = result.ok; error.textContent = result.errors?.reason || result.message || '';
      form.elements.reason.setAttribute('aria-invalid', String(!result.ok));
      if (!result.ok) { form.elements.reason.focus(); return; }
      notApplicableDrafts.delete(id); expandedRecords.delete(`na:${id}`);
      renderItems(); showFeedback(result.item, `${id}을 해당 없음으로 기록했어요. 사유는 요청 기록에서 볼 수 있어요.`);
      statusButtons.get(selectedStatus).button.focus({ preventScroll: true });
    });

    fields.categoryKey.addEventListener('change', () => {
      if (selectedCategory) drafts.set(selectedCategory, fields.detail.value);
      selectedCategory = fields.categoryKey.value;
      const category = LCA.constants.CATEGORIES.find((value) => value.key === selectedCategory);
      fields.detail.value = drafts.get(selectedCategory) ?? store.templates().values?.[selectedCategory] ?? category?.detail ?? '';
      if (fields.detail.value.trim()) clearError('detail');
      showGuide();
    });
    find('#request-form').addEventListener('submit', (event) => {
      event.preventDefault();
      find('#request-form-error').hidden = true;
      find('#request-action-error').hidden = true;
      find('#request-feedback').textContent = '';
      const draft = Object.fromEntries(Object.entries(fields).map(([key, field]) => [key, field.value]));
      const result = store.add(project.id, draft);
      showErrors(result.errors);
      if (!result.ok) {
        if (result.errors) fields[Object.keys(result.errors)[0]].focus();
        else {
          find('#request-form-error').textContent = result.message;
          find('#request-form-error').hidden = false;
        }
        return;
      }
      const category = LCA.constants.CATEGORIES.find((value) => value.key === result.item.categoryKey);
      drafts.delete(selectedCategory);
      selectedCategory = '';
      fields.categoryKey.value = '';
      fields.detail.value = '';
      // 이어서 등록하기 쉽도록 제출 기한은 유지한다.
      showGuide();
      renderItems();
      showFeedback(result.item, `${result.item.id} · ${category.name} 자료 요청을 이 브라우저에 저장했어요.`);
    });
    showGuide();
    refreshCurrent = renderItems;
    focusCurrent = (id) => {
      const loaded = store.list(project.id);
      const item = loaded.ok && loaded.items.find((entry) => entry.id === id);
      if (item && selectedStatus && item.status !== selectedStatus) selectedStatus = null;
      renderItems();
      const card = [...find('#request-items').children].find((node) => node.dataset.requestId === id);
      const target = card || find('#request-list-title'); target.tabIndex = -1;
      target.focus({ preventScroll: true }); target.scrollIntoView({ block: 'center' });
    };
    renderItems();
  }

  return { init, refresh: () => refreshCurrent(), focus: (id) => focusCurrent(id) };
})();
