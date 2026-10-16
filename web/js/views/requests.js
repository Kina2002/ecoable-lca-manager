/* 한 프로젝트의 필요한 자료 목록과 입력창. 실제 제출 값은 다음 기능에서 다룬다. */
window.LCA = window.LCA || {};
LCA.views = LCA.views || {};

LCA.views.requests = (() => {
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

  function init(project, store) {
    const panel = document.querySelector('#project-requests-panel');
    panel.replaceChildren(document.querySelector('#request-panel-template').content.cloneNode(true));
    const find = (selector) => panel.querySelector(selector);
    find('.request-intro').textContent = `${project.companyName}의 ${project.productName} 평가에 필요한 자료를 적어 두는 목록이에요.`;
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
    const drafts = new Map();

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

    fields.dueDate.addEventListener('keydown', (event) => {
      const field = fields.dueDate;
      if (field.selectionStart !== field.selectionEnd) return;
      const cursor = field.selectionStart;
      // 구분 기호를 지우다 월·일이 연도에 합쳐지지 않도록 기호만 건너뛴다.
      if (event.key === 'Backspace' && field.value[cursor - 1] === '-') {
        event.preventDefault();
        field.setSelectionRange(cursor - 1, cursor - 1);
      } else if (event.key === 'Delete' && field.value[cursor] === '-') {
        event.preventDefault();
        field.setSelectionRange(cursor + 1, cursor + 1);
      }
    });
    fields.dueDate.addEventListener('input', () => {
      const field = fields.dueDate;
      const before = field.value;
      const digitCount = before.slice(0, field.selectionStart).replace(/\D/g, '').length;
      field.value = LCA.requests.formatDateInput(before);
      // 구분 기호가 생겨도 사용자가 고치던 숫자 위치에 커서를 둔다.
      let cursor = 0;
      let digits = 0;
      while (cursor < field.value.length && digits < digitCount) {
        if (/\d/.test(field.value[cursor])) digits++;
        cursor++;
      }
      field.setSelectionRange(cursor, cursor);
    });
    const calendar = find('#request-calendar');
    const calendarButton = find('#request-calendar-button');
    calendarButton.hidden = typeof calendar.showPicker !== 'function';
    calendarButton.addEventListener('click', () => {
      calendar.value = LCA.requests.validDate(fields.dueDate.value) ? fields.dueDate.value : '';
      try {
        calendar.showPicker();
      } catch {
        const error = find('#request-date-error');
        error.textContent = '달력을 열 수 없어요. 날짜를 숫자 8자리로 입력해 주세요.';
        error.hidden = false;
        fields.dueDate.focus();
      }
    });
    calendar.addEventListener('change', () => {
      fields.dueDate.value = LCA.requests.formatDateInput(calendar.value);
      clearError('dueDate');
      fields.dueDate.focus();
    });

    function renderItems() {
      const result = store.list(project.id);
      find('#request-storage-error').hidden = result.ok;
      find('#request-storage-error').textContent = result.message || '';
      find('#register-request').disabled = !result.ok;
      if (!result.ok) {
        find('#request-count').textContent = '—';
        document.querySelector('#detail-request-count').textContent = '—';
        find('#request-empty').hidden = true;
        find('#request-items').replaceChildren();
        find('#request-trash').hidden = true;
        return;
      }
      function requestCard(item, deleted) {
        const category = LCA.constants.CATEGORIES.find((value) => value.key === item.categoryKey);
        const card = textElement('li', 'request-item', '');
        card.dataset.requestId = item.id;
        const top = textElement('div', 'request-item-top', '');
        const actions = textElement('div', 'request-item-actions', '');
        const action = textElement('button', `request-action-button${deleted ? '' : ' request-delete-button'}`, deleted ? '복원' : '삭제');
        action.type = 'button';
        action.dataset.requestAction = deleted ? 'restore' : 'remove';
        action.dataset.requestId = item.id;
        action.setAttribute('aria-label', `${item.id} ${category.name} 자료 요청 ${deleted ? '복원' : '삭제'}`);
        actions.append(textElement('span', 'request-state', deleted ? '삭제됨' : item.status), action);
        top.append(textElement('span', 'request-code', item.id), actions);
        const due = textElement('p', 'request-item-due', '제출 기한 ');
        const date = textElement('time', '', item.dueDate.replaceAll('-', '.'));
        date.dateTime = item.dueDate;
        due.append(date);
        const reference = document.createElement('details');
        reference.className = 'request-reference';
        reference.append(textElement('summary', '', '지침 근거 보기'), referenceContent(item.guideline));
        card.append(top, textElement('h3', '', category.name), textElement('p', 'request-item-detail', item.detail), due, reference);
        return card;
      }
      find('#request-items').replaceChildren(...result.items.map((item) => requestCard(item, false)));
      find('#request-trash-items').replaceChildren(...result.deletedItems.map((item) => requestCard(item, true)));
      find('#request-trash-count').textContent = result.deletedItems.length;
      find('#request-trash').hidden = result.deletedItems.length === 0;
      find('#request-count').textContent = result.items.length;
      document.querySelector('#detail-request-count').textContent = result.items.length;
      find('#request-empty').hidden = result.items.length !== 0;
      const registered = new Set(result.items.map((item) => item.categoryKey));
      for (const option of fields.categoryKey.options) {
        const category = LCA.constants.CATEGORIES.find((value) => value.key === option.value);
        option.disabled = registered.has(option.value);
        if (category) option.textContent = `${category.name}${option.disabled ? ' · 등록됨' : ''}`;
      }
    }

    find('.request-list-card').addEventListener('click', (event) => {
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
      find('#request-feedback').textContent = action === 'remove'
        ? `${result.item.id} 자료 요청을 삭제했어요. 아래 ‘삭제한 자료 요청’에서 복원할 수 있어요.`
        : `${result.item.id} 자료 요청을 복원했어요.`;
      find('#request-list-title').focus({ preventScroll: true });
    });

    fields.categoryKey.addEventListener('change', () => {
      if (selectedCategory) drafts.set(selectedCategory, fields.detail.value);
      selectedCategory = fields.categoryKey.value;
      const category = LCA.constants.CATEGORIES.find((value) => value.key === selectedCategory);
      fields.detail.value = drafts.get(selectedCategory) ?? category?.detail ?? '';
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
      find('#request-feedback').textContent = `${result.item.id} · ${category.name} 자료 요청을 이 브라우저에 저장했어요.`;
      drafts.delete(selectedCategory);
      selectedCategory = '';
      fields.categoryKey.value = '';
      fields.detail.value = '';
      // 이어서 등록하기 쉽도록 제출 기한은 유지한다.
      showGuide();
      renderItems();
    });
    showGuide();
    renderItems();
  }

  return { init };
})();
