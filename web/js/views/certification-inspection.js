window.LCA = window.LCA || {};
LCA.views = LCA.views || {};
LCA.views.certificationInspection = (() => {
  let refreshCurrent = () => {};
  const { text, field, option } = LCA.views.verificationIssue;
  function init(host, project, store, onChanged) {
    const card = text('section', 'detail-card calculation-card', '');
    card.append(text('h2', '', 'International EPD 연간 점검'), text('p', 'detail-help', 'EPD 문서의 최신 버전일을 기준으로 매년 제품·생산 조건·자료의 변경 여부를 확인해요. 예정일 30일 전부터 할 일에 보여요. 점검 완료는 담당자가 결과와 필요한 조치를 확인했다는 업무 기록이에요.'));
    const summary = text('p', 'detail-note', ''); summary.setAttribute('role', 'status'); card.append(summary);
    function form(title) {
      const node = document.createElement('form'); node.noValidate = true;
      const fields = document.createElement('fieldset'); fields.className = 'calculation-fields';
      const save = text('button', 'primary-button', title); save.type = 'submit';
      const rebase = text('button', 'request-action-button', '입력을 유지하고 최신 기준 확인'); rebase.type = 'button';
      const error = text('p', 'field-error', ''); error.setAttribute('role', 'alert');
      node.append(fields, save, rebase, error); card.append(LCA.views.compact.form(node, title));
      const state = { dirty: false, revision: 0, version: '', versionOn: '' };
      node.addEventListener('input', () => { state.dirty = true; }); node.addEventListener('change', () => { state.dirty = true; });
      return { node, fields, save, rebase, error, state };
    }
    const plan = form('EPD 최신 버전·점검 기준 기록');
    const version = field(plan.fields, 'inspection-version', 'EPD 최신 버전 (필수 · 예: :002)', 'input', 80);
    const versionOn = dateField(plan.fields, 'inspection-version-on', 'EPD 최신 버전일 (필수 · 문서에서 확인)');
    const planDocument = field(plan.fields, 'inspection-plan-document', '버전일을 확인한 문서 이름 (필수)', 'input', 200);
    const planActor = field(plan.fields, 'inspection-plan-actor', '기록 담당자 (필수)'); planActor.value = project.researcherName || ''; LCA.views.inputAssist.person(planActor, project);
    const planReason = field(plan.fields, 'inspection-plan-reason', '확인 근거·버전 변경 사유 (필수)', 'textarea', 1000);
    const check = form('연간 점검 결과 기록');
    const dueOn = field(check.fields, 'inspection-due-on', '점검 대상일', 'select');
    const status = field(check.fields, 'inspection-status', '점검 상태', 'select'); for (const value of ['점검 중', '점검 완료']) option(status, value, value);
    const checkedOn = dateField(check.fields, 'inspection-checked-on', '이번 점검일 (필수)'); checkedOn.value = LCA.rules.today();
    const checkDocument = field(check.fields, 'inspection-document', '확인한 점검 기록·문서 이름 (필수)', 'input', 200);
    const checkActor = field(check.fields, 'inspection-actor', '점검 담당자 (필수)'); checkActor.value = project.researcherName || ''; LCA.views.inputAssist.person(checkActor, project);
    const checkReason = field(check.fields, 'inspection-reason', '확인 결과와 필요한 조치 (필수)', 'textarea', 1000);
    const label = text('label', 'calculation-confirmation', ''); const confirmed = document.createElement('input'); confirmed.type = 'checkbox';
    label.append(confirmed, document.createTextNode('변경 여부와 필요한 조치를 검토하고 이번 연간 점검을 완료했어요.')); check.fields.append(label);
    card.append(text('p', 'detail-help', '새 버전의 발행은 재검증·공식 갱신 절차와 구분해 확인하세요. 이 앱의 점검 기록만으로 기관의 승인이 완료되지는 않아요.'));
    const feedback = text('p', 'request-feedback', ''); feedback.setAttribute('role', 'status'); card.append(feedback); host.replaceChildren(card);
    let loaded; let busy = false; let selectedDueOn = '';
    function cycles() { return loaded?.process ? LCA.certification.inspectionCycles(loaded.process.details, loaded.process.status, loaded.inspectionPlan, loaded.inspections, loaded.validity?.expiryOn) : []; }
    function fillChecks(keepInputs = false) {
      const list = cycles(); const previous = dueOn.value;
      dueOn.replaceChildren(); for (const item of list) option(dueOn, item.date, `${item.date} · ${item.latest?.status || '점검 전'}`);
      dueOn.value = list.some((item) => item.date === previous) && keepInputs ? previous : list.find((item) => !item.completed)?.date || list.at(-1)?.date || '';
      selectedDueOn = dueOn.value;
      check.state.version = loaded.inspectionPlan?.version || ''; check.state.versionOn = loaded.inspectionPlan?.versionOn || '';
      if (!keepInputs) fillCheckFields();
    }
    function fillCheckFields() {
      const latest = cycles().find((item) => item.date === dueOn.value)?.latest;
      status.value = latest?.status || '점검 중'; checkedOn.value = latest?.checkedOn || LCA.rules.today();
      checkDocument.value = latest?.documentName || ''; checkReason.value = latest?.reason || ''; confirmed.checked = false;
    }
    function refresh() {
      loaded = store.load(project.id);
      if (!loaded.ok) { summary.textContent = loaded.error; for (const item of [plan, check]) item.fields.disabled = item.save.disabled = item.rebase.disabled = true; return; }
      const eligible = loaded.canRecordValidity && loaded.process?.details.kind === '등록' && loaded.process.details.scheme.trim() === 'International EPD';
      card.hidden = !loaded.process || loaded.process.details.kind !== '등록' || loaded.process.details.scheme.trim() !== 'International EPD';
      const schedule = loaded.process && LCA.certification.inspectionSchedule(loaded.process.details, loaded.process.status, loaded.inspectionPlan, loaded.inspections, LCA.rules.today(), loaded.validity?.expiryOn);
      summary.textContent = !eligible ? 'International EPD 승인·등록 후 점검 기준과 결과를 기록할 수 있어요.' : !loaded.inspectionPlan ? 'EPD 최신 버전과 버전일을 먼저 기록해 주세요. 발급일과 버전일이 다를 수 있어요.'
        : `기준 버전 ${loaded.inspectionPlan.version} · 버전일 ${loaded.inspectionPlan.versionOn} · ${schedule ? `다음 미완료 점검 ${schedule.date} · ${schedule.active ? schedule.days < 0 ? `${-schedule.days}일 경과` : `${schedule.days}일 남음` : `안내 시작 ${schedule.startDate}`}` : '현재 유효기간 안에 남은 연간 점검 예정이 없어요.'}`;
      for (const item of [plan, check]) { item.fields.disabled = item.save.disabled = busy || !eligible || (item === check && !cycles().length); item.rebase.disabled = busy; }
      if (!plan.state.dirty) {
        plan.state.revision = loaded.record.revision; version.value = loaded.inspectionPlan?.version || ''; versionOn.value = loaded.inspectionPlan?.versionOn || '';
        planDocument.value = loaded.inspectionPlan?.documentName || ''; planReason.value = '';
      }
      if (!check.state.dirty) { check.state.revision = loaded.record.revision; fillChecks(); }
      for (const item of [plan, check]) if (item.state.dirty && item.state.revision !== loaded.record.revision) item.error.textContent = '다른 기록이 저장됐어요. 입력을 유지했으니 최신 기준을 확인해 주세요.';
      LCA.views.inputAssist.sync(card);
    }
    async function save(item, action, draft) {
      if (busy) return; busy = true; const revision = item.state.revision; refresh();
      const result = await store.save(project.id, action, draft, revision); busy = false; item.error.textContent = result.error || '';
      if (result.ok) { item.state.dirty = false; feedback.textContent = action === 'inspection-plan' ? 'EPD 버전과 연간 점검 기준을 이력에 보관했어요.' : draft.status === '점검 완료' ? '이번 연간 점검을 완료로 기록했어요. 다음 미완료 점검을 확인해 주세요.' : '점검 중인 내용과 결과 메모를 보관했어요.'; onChanged(); }
      refresh(); const target = result.ok ? feedback : item.error; target.tabIndex = -1; target.focus();
    }
    plan.node.addEventListener('submit', (event) => { event.preventDefault(); save(plan, 'inspection-plan', { version: version.value, versionOn: versionOn.value, documentName: planDocument.value, actor: planActor.value, reason: planReason.value }); });
    check.node.addEventListener('submit', (event) => { event.preventDefault(); save(check, 'inspection', { dueOn: dueOn.value, checkedOn: checkedOn.value, status: status.value, documentName: checkDocument.value, actor: checkActor.value, reason: checkReason.value, confirmed: confirmed.checked, version: check.state.version, versionOn: check.state.versionOn }); });
    dueOn.addEventListener('change', () => {
      if (check.state.dirty && selectedDueOn !== dueOn.value && !window.confirm('작성 중인 점검 결과를 저장하지 않고 다른 대상일의 기록을 불러올까요?')) { dueOn.value = selectedDueOn; return; }
      selectedDueOn = dueOn.value; fillCheckFields();
    });
    for (const item of [plan, check]) item.rebase.addEventListener('click', () => {
      loaded = store.load(project.id); if (!loaded.ok) { refresh(); return; }
      item.state.revision = loaded.record.revision; item.state.dirty = true; item.error.textContent = '';
      if (item === check) { fillChecks(true); confirmed.checked = false; }
      feedback.textContent = '입력을 유지하고 최신 기준으로 맞췄어요. EPD 버전·대상일·확인 결과를 다시 검토해 주세요.'; refresh();
    });
    refreshCurrent = refresh; refresh();
  }
  function dateField(parent, id, label) {
    const input = field(parent, id, label, 'input', 10); input.inputMode = 'numeric'; input.placeholder = '예: 20261019';
    input.addEventListener('input', () => { input.value = LCA.requests.formatDateInput(input.value); }); LCA.views.inputAssist.date(input); return input;
  }
  return { init, refresh: () => refreshCurrent() };
})();
