/* 데이터 수집 단계 안의 하위 필터. 회사별 상세 필터와 별도로 유지한다. */
window.LCA = window.LCA || {};
LCA.views = LCA.views || {};
LCA.views.collection = (() => {
  function text(tag, className, value) {
    const element = document.createElement(tag);
    element.className = className;
    element.textContent = value;
    return element;
  }
  function init(projects, store, onOpenRequest) {
    const section = document.querySelector('#collection-section');
    const find = (selector) => section.querySelector(selector);
    let selectedStatus = null;
    let currentStage = null;
    const buttons = new Map();
    for (const status of [null, ...LCA.requestFilter.STATUSES]) {
      const button = text('button', 'request-status-filter', '');
      button.type = 'button';
      button.dataset.collectionStatus = status || 'all';
      button.setAttribute('aria-controls', 'collection-items');
      const label = text('span', '', status || '전체');
      const count = text('span', 'count-badge', '0');
      label.setAttribute('aria-hidden', 'true');
      count.setAttribute('aria-hidden', 'true');
      button.append(label, count);
      find('#collection-status-filters').append(button);
      buttons.set(status, { button, count });
    }
    function row(item) {
      const project = projects.find((value) => value.id === item.projectId);
      const category = LCA.constants.CATEGORIES.find((value) => value.key === item.categoryKey);
      const element = text('li', 'collection-row', '');
      const company = text('div', 'collection-company', '');
      const companyLine = text('div', 'company-line', '');
      companyLine.append(text('strong', 'company-name', project.companyName));
      if (project.isFictional) companyLine.append(text('span', 'fictional-tag', '가상'));
      company.append(companyLine, text('p', 'collection-meta', `${project.code} · ${project.productName}`));
      const detail = text('div', 'collection-data', '');
      detail.append(text('h3', '', category.name), text('p', 'collection-meta', item.id));
      const description = text('p', 'collection-preview', item.detail);
      description.title = item.detail;
      detail.append(description);
      if (item.receipt) {
        const received = item.receipt.kind === 'quantity' ? `${LCA.receivedData.displayNumber(item.receipt.value)} ${item.receipt.unit}` : '문서·설명 자료';
        detail.append(text('p', 'collection-meta', `받은 자료: ${received} · ${item.receipt.periodStart}~${item.receipt.periodEnd}`));
      }
      if (item.review?.note) {
        const note = text('p', 'collection-preview', `${item.status === '보완 요청' ? '보완 사유' : '검토 메모'}: ${item.review.note}`);
        note.title = item.review.note;
        detail.append(note);
      }
      const progress = text('div', 'collection-progress', '');
      const tone = item.status === '보완 요청' ? ' request-state-revision' : item.receipt ? ' request-state-received' : '';
      progress.append(text('span', `request-state${tone}`, item.status));
      const due = text('p', 'collection-meta', '제출 기한 ');
      const date = text('time', '', item.dueDate.replaceAll('-', '.'));
      date.dateTime = item.dueDate;
      due.append(date);
      const button = text('button', 'request-action-button', '자료 보기');
      button.type = 'button';
      button.dataset.collectionRequest = item.id;
      button.dataset.collectionProject = item.projectId;
      button.setAttribute('aria-label', `${project.companyName} ${item.id} ${category.name} 자료 보기`);
      progress.append(due, button);
      element.append(company, detail, progress);
      return element;
    }
    function refresh() {
      if (currentStage !== 3) return;
      const result = store.listAll();
      find('#collection-error').hidden = result.ok;
      find('#collection-error').textContent = result.message || '';
      find('#collection-status-controls').hidden = !result.ok;
      if (!result.ok) {
        find('#collection-items').replaceChildren();
        find('#collection-empty').hidden = true;
        return;
      }
      const snapshot = LCA.requestFilter.collectionSnapshot(result.items, projects, selectedStatus);
      for (const [status, { button, count }] of buttons) {
        const number = status === null ? snapshot.total : snapshot.counts[status];
        count.textContent = number;
        button.setAttribute('aria-label', `${status || '전체'} ${number}건`);
        button.setAttribute('aria-pressed', String(status === selectedStatus));
      }
      find('#collection-context').textContent = `수집 단계 ${snapshot.projectCount}개 프로젝트 · 전체 자료 ${snapshot.total}건${selectedStatus ? ` 중 ‘${selectedStatus}’ ${snapshot.visible.length}건 표시` : ' 표시'}`;
      find('#collection-items').replaceChildren(...snapshot.visible.map(row));
      find('#collection-empty').hidden = snapshot.visible.length !== 0;
      find('#collection-empty').textContent = !snapshot.projectCount ? '데이터 수집 단계의 프로젝트가 없어요.'
        : selectedStatus ? `수집 단계 프로젝트에 ‘${selectedStatus}’ 상태의 자료가 없어요. 하위 필터의 ‘전체’를 눌러 다른 상태도 확인해 보세요.`
        : '수집 단계 프로젝트에 등록한 자료 요청이 없어요. 아래 프로젝트를 열어 필요한 자료를 등록해 주세요.';
    }
    function setStage(stageNo) {
      if (currentStage !== stageNo) selectedStatus = null;
      currentStage = stageNo;
      section.hidden = stageNo !== 3;
      refresh();
    }
    find('#collection-status-filters').addEventListener('click', (event) => {
      const button = event.target.closest('button[data-collection-status]');
      if (!button) return;
      const status = button.dataset.collectionStatus === 'all' ? null : button.dataset.collectionStatus;
      if (status !== null && !LCA.requestFilter.STATUSES.includes(status)) return;
      selectedStatus = status;
      refresh();
    });
    find('#collection-items').addEventListener('click', (event) => {
      const button = event.target.closest('button[data-collection-request]');
      if (button) onOpenRequest(button.dataset.collectionProject, button.dataset.collectionRequest, button);
    });
    function focusRequest(id) {
      const button = find(`button[data-collection-request="${id}"]`);
      (button || (!find('#collection-status-controls').hidden ? buttons.get(selectedStatus).button : find('#collection-title'))).focus({ preventScroll: true });
    }
    return { setStage, refresh, focusRequest };
  }
  return { init };
})();
