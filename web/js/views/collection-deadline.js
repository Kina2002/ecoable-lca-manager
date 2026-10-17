window.LCA = window.LCA || {};
LCA.views = LCA.views || {};
LCA.views.collectionDeadline = (() => {
  let isDirty = () => false;
  function init(project, store, loadResult, onChanged, onDraftChanged = () => {}) {
    isDirty = () => false;
    const completed = project.stage >= 4;
    const host = document.querySelector('#collection-deadline-editor');
    const section = document.createElement('section');
    section.className = 'detail-card';
    const heading = document.createElement('h2');
    heading.textContent = '자료 수집 일정';
    const help = document.createElement('p');
    help.className = 'detail-help';
    help.id = 'collection-deadline-help';
    help.textContent = completed ? '자료 수집이 완료된 프로젝트의 일정 기록이에요.'
      : '자료를 모두 모으기로 한 날짜예요. 프로젝트 목표일·개별 자료 제출 기한과 따로 정해요. 아직 협의하지 않았다면 비워 두면 미정으로 표시해요.';
    const summary = document.createElement('p');
    function refresh() {
      summary.replaceChildren(LCA.views.deadlines.badge(LCA.deadlines.collection(project)));
      if (project.collectionDueDate || !completed) summary.append(document.createTextNode(` · 수집 마감 ${project.collectionDueDate || '미정'}`));
    }
    if (loadResult.ok) refresh();
    else summary.textContent = '수집 일정 확인 필요';
    const feedback = document.createElement('p');
    feedback.setAttribute('role', 'status');
    section.append(heading, help, summary, feedback);
    host.replaceChildren(section);
    if (!loadResult.ok) { feedback.textContent = loadResult.error; return; }
    if (project.stage >= 4) return;
    const form = document.createElement('form');
    form.className = 'scope-form';
    form.noValidate = true;
    const box = document.createElement('div');
    const label = document.createElement('label');
    label.htmlFor = 'collection-due-date';
    label.textContent = '자료 수집 마감일 (선택)';
    const input = document.createElement('input');
    input.id = label.htmlFor;
    input.type = 'text';
    input.inputMode = 'numeric';
    input.maxLength = 10;
    input.placeholder = '미정 · YYYY-MM-DD';
    input.value = project.collectionDueDate || '';
    input.setAttribute('aria-describedby', help.id);
    const calendar = document.createElement('input');
    calendar.type = 'date';
    calendar.min = '0001-01-01';
    calendar.max = '9999-12-31';
    calendar.tabIndex = -1;
    calendar.className = 'scope-calendar';
    calendar.setAttribute('aria-hidden', 'true');
    const picker = document.createElement('button');
    picker.type = 'button';
    picker.className = 'request-action-button';
    picker.textContent = '자료 수집 마감일 달력';
    box.append(label, input, calendar, picker);
    isDirty = () => LCA.requests.formatDateInput(input.value.trim()) !== (project.collectionDueDate || '');
    LCA.views.dateInput.bind(input, calendar, picker, onDraftChanged, feedback);
    const save = document.createElement('button');
    save.type = 'submit';
    save.className = 'primary-button';
    save.textContent = '수집 마감일 저장';
    form.append(box, save);
    section.append(form);
    let expected = project.collectionDueDate || '';
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const date = LCA.requests.formatDateInput(input.value.trim());
      const result = store.saveCollectionDeadline(project.id, date, expected);
      feedback.textContent = result.ok ? (date ? '자료 수집 마감일을 저장했어요.' : '자료 수집 마감일을 미정으로 저장했어요.') : result.error;
      if (!result.ok) return;
      project.collectionDueDate = date;
      expected = date;
      input.value = date;
      refresh();
      onChanged();
      onDraftChanged();
    });
  }
  return { init, isDirty: () => isDirty() };
})();
