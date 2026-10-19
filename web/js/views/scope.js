window.LCA = window.LCA || {};
LCA.views = LCA.views || {};
LCA.views.scope = (() => {
  let refreshActiveResearchers = () => {};
  function init(project, store, loadResult, onChanged, researcherStore) {
    refreshActiveResearchers = () => {};
    const kickoffHost = document.querySelector('#kickoff-editor');
    kickoffHost.replaceChildren();
    const host = document.querySelector('#scope-editor');
    const section = document.createElement('section');
    section.className = 'detail-card scope-editor';
    const title = document.createElement('h2');
    title.id = 'scope-editor-title';
    title.tabIndex = -1;
    title.textContent = '범위 합의 기록';
    section.append(title);
    const intro = document.createElement('p');
    intro.className = 'detail-help';
    intro.textContent = '범위 상태는 합의 여부, 프로젝트 단계는 전체 업무 진행을 뜻해요. 이 샘플의 범위 정보는 모두 가상이에요.';
    section.append(intro);
    const message = document.createElement('p');
    message.setAttribute('role', 'status');
    message.setAttribute('aria-live', 'polite');
    section.append(message);
    host.replaceChildren(section);
    if (!loadResult.ok) { message.textContent = loadResult.error; return; }
    if (project.stage >= 3) {
      const text = document.createElement('p');
      text.textContent = `범위 상태: ${project.scopeStatus}. 수집 이후의 범위 재협의·단계 되돌리기는 별도 기능으로 구현할 예정이에요.`;
      section.classList.add('scope-readonly');
      const details = document.createElement('details'); const summary = document.createElement('summary');
      summary.append(title); details.append(summary, intro, message, text); section.replaceChildren(details);
      return;
    }
    let expected = LCA.scope.snapshot(project);
    let scopeDirty = false;
    let assigneesDirty = false;
    let kickoffStart = null;
    let kickoffReadiness = null;
    let rosterAvailable = true;
    function updateKickoff() {
      if (!kickoffStart) return;
      kickoffStart.disabled = !rosterAvailable || scopeDirty || assigneesDirty || !LCA.scope.assigned(project);
      kickoffReadiness.textContent = !rosterAvailable ? '연구원 목록을 확인하지 못했어요. 담당 연구원 탭의 안내를 확인해 주세요.' : scopeDirty || assigneesDirty ? '입력 중인 담당자 또는 범위 변경을 먼저 저장해 주세요.'
        : LCA.scope.assigned(project) ? '두 담당자가 저장됐어요. 범위 정의 시작을 누르면 다음 단계로 이동해요.' : '고객 담당자와 담당 연구원을 모두 저장하면 범위 정의를 시작할 수 있어요.';
    }
    if (project.stage === 1) {
      const section = document.createElement('section');
      section.className = 'detail-card kickoff-card';
      const heading = document.createElement('h2');
      heading.textContent = '담당자와 착수 준비';
      const intro = document.createElement('p');
      intro.className = 'detail-help';
      intro.textContent = '고객 담당자는 이름을 적고, 담당 연구원은 등록된 목록에서 선택해요. 새 연구원은 담당 연구원 탭에서 등록할 수 있어요. 저장만으로 단계가 바뀌지는 않아요.';
      const form = document.createElement('form');
      form.className = 'scope-form';
      form.noValidate = true;
      const controls = {};
      for (const [key, label, help] of [
        ['customerContactName', '고객 담당자', '고객 회사에서 자료 요청이나 범위 협의를 할 사람이에요.'],
        ['researcherId', '담당 연구원', '우리 쪽에서 이 프로젝트를 맡을 사람이에요. 동명이인은 번호로 구분해요.']
      ]) {
        const box = document.createElement('div');
        const caption = document.createElement('label');
        caption.textContent = key === 'researcherId' ? label : `${label} (최대 100자)`;
        caption.htmlFor = `kickoff-${key}`;
        const input = document.createElement(key === 'researcherId' ? 'select' : 'input');
        input.id = caption.htmlFor;
        if (key !== 'researcherId') { input.type = 'text'; input.maxLength = 100; input.value = project[key] || ''; }
        const description = document.createElement('p');
        description.className = 'detail-help';
        description.id = `kickoff-${key}-help`;
        description.textContent = help;
        input.setAttribute('aria-describedby', description.id);
        box.append(caption, input, description);
        form.append(box);
        controls[key] = input;
      }
      const feedback = document.createElement('p');
      feedback.setAttribute('role', 'status');
      feedback.setAttribute('aria-live', 'polite');
      const save = document.createElement('button');
      save.type = 'submit';
      save.className = 'primary-button';
      save.textContent = '담당자 저장';
      let firstFill = true;
      refreshActiveResearchers = () => {
        const select = controls.researcherId;
        const chosen = firstFill ? (project.researcherId || (project.researcherName ? 'legacy' : '')) : select.value;
        const roster = researcherStore.list();
        rosterAvailable = roster.ok;
        select.disabled = !roster.ok;
        save.disabled = !roster.ok;
        if (!roster.ok) { feedback.textContent = roster.error; updateKickoff(); return; }
        firstFill = false;
        const options = [['', '연구원을 선택해 주세요'], ...roster.items.map((person) => [person.id, `${person.name} · ${person.code} · 가상`])];
        if (project.researcherName && !project.researcherId) options.push(['legacy', `${project.researcherName} · 기존 이름 기록 유지`]);
        if (project.researcherId && !roster.items.some((person) => person.id === project.researcherId)) {
          options.push([project.researcherId, `${project.researcherName} · 연결 확인 필요`]);
          if (chosen === project.researcherId) assigneesDirty = true;
        }
        select.replaceChildren(...options.map(([value, label]) => {
          const option = document.createElement('option'); option.value = value; option.textContent = label; return option;
        }));
        select.value = chosen;
        updateKickoff();
      };
      kickoffStart = document.createElement('button');
      kickoffStart.type = 'button';
      kickoffStart.className = 'request-action-button';
      kickoffStart.textContent = '범위 정의 시작';
      kickoffReadiness = document.createElement('p');
      kickoffReadiness.className = 'detail-help';
      const actions = document.createElement('div');
      actions.className = 'scope-actions';
      actions.append(save, kickoffStart);
      form.append(actions, kickoffReadiness, feedback);
      form.addEventListener('input', () => { assigneesDirty = true; updateKickoff(); });
      form.addEventListener('change', () => { assigneesDirty = true; updateKickoff(); });
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const draft = { customerContactName: controls.customerContactName.value,
          ...(controls.researcherId.value === 'legacy' ? { researcherName: project.researcherName } : { researcherId: controls.researcherId.value }) };
        const result = store.saveAssignees(project.id, draft, expected);
        feedback.textContent = result.ok ? '담당자를 저장했어요. 현재 단계는 계약·착수 그대로예요.' : result.error;
        if (result.ok) {
          expected = LCA.scope.snapshot(project);
          controls.customerContactName.value = project.customerContactName;
          controls.researcherId.value = project.researcherId || (project.researcherName ? 'legacy' : '');
          assigneesDirty = false;
          updateKickoff();
          onChanged(false);
        }
      });
      kickoffStart.addEventListener('click', () => {
        const result = store.startScope(project.id, expected);
        if (!result.ok) { feedback.textContent = result.error; return; }
        onChanged(true);
      });
      section.append(heading, intro, form);
      kickoffHost.append(section);
      refreshActiveResearchers();
    }
    const form = document.createElement('form');
    form.className = 'scope-form';
    form.noValidate = true;
    const controls = {};
    function field(key, label, value, options) {
      const box = document.createElement('div');
      const caption = document.createElement('label');
      caption.htmlFor = `scope-${key}`;
      caption.textContent = label;
      const input = document.createElement(options ? 'select' : ['periodReason', 'scopeMemo'].includes(key) ? 'textarea' : 'input');
      input.id = caption.htmlFor;
      input.name = key;
      if (options) for (const option of options) {
        const node = document.createElement('option');
        node.value = option;
        node.textContent = option || '미정';
        input.append(node);
      }
      else input.maxLength = key === 'scopeMemo' ? 2000 : key === 'periodReason' ? 1000 : 30;
      input.value = value || '';
      box.append(caption, input);
      form.append(box);
      controls[key] = input;
      return input;
    }
    field('scopeStatus', '범위 상태', project.scopeStatus, LCA.scope.STATUSES);
    const memo = field('scopeMemo', '협의 메모 (선택 · 최대 2,000자)', project.scopeMemo);
    memo.rows = 4;
    memo.parentElement.className = 'scope-memo-field';
    memo.placeholder = '예: 고객은 요람~무덤을 요청했으며, 사용 단계 자료를 확보할 수 있는지 확인 중이에요.';
    field('qty', '평가 기준량 (0보다 큰 수)', project.functionalUnit?.qty);
    controls.qty.inputMode = 'decimal';
    field('unit', '기준량 단위 (예: kg, t, 장)', project.functionalUnit?.unit);
    field('boundary', '시스템 경계', project.boundary, ['', '요람~문', '요람~무덤', '기타']);
    for (const [key, label] of [['refStart', '기준기간 시작일'], ['refEnd', '기준기간 종료일']]) {
      const input = field(key, `${label} (숫자 8자리 입력 가능)`, project[key]);
      input.maxLength = 10;
      input.inputMode = 'numeric';
      const calendar = document.createElement('input');
      calendar.type = 'date';
      calendar.min = '0001-01-01';
      calendar.max = '9999-12-31';
      calendar.tabIndex = -1;
      calendar.setAttribute('aria-hidden', 'true');
      calendar.className = 'scope-calendar';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'request-action-button';
      button.textContent = `${label} 달력`;
      input.parentElement.append(calendar, button);
      LCA.views.dateInput.bind(input, calendar, button, () => updateReadiness(true), message);
    }
    field('periodReason', '12개월이 아닌 기간을 사용하는 사유', project.periodReason);
    const periodHelp = document.createElement('p');
    periodHelp.id = 'scope-period-help';
    periodHelp.className = 'detail-help';
    periodHelp.textContent = '선택한 자료 기간이 12개월과 다른 이유예요. 예: 7월에 생산을 시작해 6개월 자료만 있어요. 이 앱의 기본 기간은 12개월이며 실제 기간은 적용 기준과 상황에 맞춰 확인해요.';
    controls.periodReason.parentElement.append(periodHelp);
    controls.periodReason.setAttribute('aria-describedby', periodHelp.id);
    const standards = document.createElement('fieldset');
    const legend = document.createElement('legend');
    legend.textContent = '적용 기준 (하나 이상 선택)';
    standards.append(legend);
    const standardHelp = document.createElement('p'); standardHelp.className = 'detail-help';
    standardHelp.textContent = '체크박스는 적용 여부를 선택하고, 기준 이름은 용어사전 설명을 열어요. 설명을 본 뒤 돌아와도 작성 중인 내용은 유지돼요.';
    standards.append(standardHelp);
    for (const [index, standard] of LCA.scope.STANDARDS.entries()) {
      const row = document.createElement('div'); row.className = 'scope-standard-option';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.id = `scope-standard-${index}`; input.setAttribute('aria-label', standard);
      input.value = standard;
      input.checked = project.standards.includes(standard);
      row.append(input, LCA.views.glossary.standardLink(standard));
      standards.append(row);
    }
    form.append(standards);
    const help = document.createElement('p');
    help.className = 'detail-help';
    help.textContent = '미정·고객 요청안·협의 중은 빈 항목을 남겨 저장할 수 있어요. 확정은 필수 정보가 필요해요. 적용 기준 선택은 자동 적합성 판정이 아니에요. 기타 경계의 상세 설명과 컷오프·할당 등 추가 범위 조건은 후속 구현 대상이에요.';
    form.append(help);
    const actions = document.createElement('div');
    actions.className = 'scope-actions';
    const save = document.createElement('button');
    save.type = 'submit';
    save.className = 'primary-button';
    save.textContent = '범위 저장';
    const start = document.createElement('button');
    start.type = 'button';
    start.className = 'request-action-button';
    start.textContent = '데이터 수집 시작';
    start.hidden = project.stage !== 2;
    const readiness = document.createElement('p');
    readiness.className = 'detail-help';
    function updateReadiness(dirty = false) {
      scopeDirty = dirty;
      updateKickoff();
      const missing = LCA.scope.missing(project);
      start.disabled = dirty || project.scopeStatus !== '확정' || missing.length > 0;
      readiness.textContent = project.stage === 1 ? '현재는 계약·착수 단계예요. 이 버튼은 범위 정의 단계에서 사용할 수 있어요.'
        : dirty ? '변경 내용을 먼저 범위 저장으로 저장해 주세요.'
        : missing.length ? `확정 전 필요한 정보: ${missing.join(', ')}`
        : project.scopeStatus !== '확정' ? '합의가 끝났다면 상태를 확정으로 바꾸고 저장해 주세요.' : '확정된 범위가 저장됐어요. 수집 시작 버튼을 누르면 프로젝트가 데이터 수집 단계로 넘어가요.';
    }
    form.addEventListener('input', () => updateReadiness(true));
    form.addEventListener('change', () => updateReadiness(true));
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const draft = {
        scopeStatus: controls.scopeStatus.value,
        functionalUnit: { qty: controls.qty.value.trim(), unit: controls.unit.value.trim() },
        boundary: controls.boundary.value, refStart: controls.refStart.value, refEnd: controls.refEnd.value,
        periodReason: controls.periodReason.value.trim(),
        scopeMemo: controls.scopeMemo.value.trim(),
        standards: Array.from(standards.querySelectorAll('input:checked'), (input) => input.value)
      };
      const result = store.save(project.id, draft, expected);
      message.textContent = result.ok ? '범위를 저장했어요. 프로젝트 단계는 그대로예요.' : result.error;
      if (result.ok) { expected = LCA.scope.snapshot(project); updateReadiness(); onChanged(false); }
    });
    start.addEventListener('click', () => {
      const result = store.start(project.id, expected);
      if (!result.ok) { message.textContent = result.error; return; }
      onChanged(true);
    });
    actions.append(save, start);
    form.append(actions, readiness);
    section.append(form);
    updateReadiness();
  }
  function focusEditor() {
    const target = document.querySelector('#scope-scopeStatus') || document.querySelector('#scope-editor-title');
    if (!target) return;
    const details = target.closest('details'); if (details) details.open = true;
    target.focus({ preventScroll: true });
    document.querySelector('#scope-editor').scrollIntoView({ block: 'start' });
  }
  return { init, focusEditor, refreshResearchers: () => refreshActiveResearchers() };
})();
