window.LCA = window.LCA || {};
LCA.views = LCA.views || {};
LCA.views.certification = (() => {
  let refreshCurrent = () => {};
  const { text, field, option, date } = LCA.views.verificationIssue;
  function init(project, store, onChanged, onOpenReport, onOpenVerification) {
    const host = document.querySelector('#project-certification-panel');
    const intro = text('section', 'detail-card calculation-card', '');
    intro.append(text('h2', '', '검증 완료와 인증·등록'), text('p', 'detail-help', '검증을 마친 최종 보고서와 완료 근거를 보관하고, 프로젝트 목적에 맞는 인증·등록 또는 고객 제출의 진행 상황을 기록해요. 모든 LCA가 인증을 받아야 하는 것은 아니에요.'));
    const notice = text('p', 'calculation-notice', ''); notice.setAttribute('role', 'status');
    const toVerification = text('button', 'request-action-button', '검증 차수·지적 확인'); toVerification.type = 'button'; toVerification.addEventListener('click', onOpenVerification);
    intro.append(notice, toVerification);
    const completionCard = text('section', 'detail-card calculation-card', ''); completionCard.append(text('h2', '', '검증 완료 기록'));
    const completionInfo = text('div', '', '');
    const completionForm = document.createElement('form'); completionForm.noValidate = true;
    const completionFields = document.createElement('fieldset'); completionFields.className = 'calculation-fields'; completionFields.append(text('legend', '', '최종 보고서와 검증 완료 근거'));
    const completedOn = dateField(completionFields, 'certification-completed-on', '검증 완료일 (필수 · 연월일 8자리)');
    const documentName = field(completionFields, 'certification-document-name', '검증 결과 문서 이름 (필수 · 파일 이름만 기록)', 'input', 200);
    const completionActor = field(completionFields, 'certification-completion-actor', '완료 기록 담당자 (필수)'); completionActor.value = project.researcherName || '';
    const completionReason = field(completionFields, 'certification-completion-reason', '검증 완료 확인 근거 (필수)', 'textarea', 1000);
    const completionCheck = checkbox(completionFields, '최종 보고서와 모든 지적의 종결, 검증기관의 완료 근거를 확인했어요.');
    const completionSave = text('button', 'primary-button', '검증 완료 기록 보관'); completionSave.type = 'submit';
    const completionError = text('p', 'field-error', ''); completionError.setAttribute('role', 'alert');
    completionForm.append(completionFields, completionSave, completionError);
    completionCard.append(completionInfo, completionForm, text('p', 'detail-help', '완료 기록을 보관해도 8단계에 머물러요. 보고서나 지적을 보완하면 완료 근거를 다시 기록해 주세요. 보관한 이전 사본은 이력에 남아요.'));
    const processCard = text('section', 'detail-card calculation-card', ''); const processTitle = text('h2', '', '인증·등록 또는 고객 제출 시작'); processCard.append(processTitle);
    const processForm = document.createElement('form'); processForm.noValidate = true;
    const processFields = document.createElement('fieldset'); processFields.className = 'calculation-fields'; processFields.append(text('legend', '', '제출 진행 정보'));
    const status = field(processFields, 'certification-status', '진행 상태', 'select');
    const kind = field(processFields, 'certification-kind', '진행 유형 (필수)', 'select');
    for (const value of ['인증', '등록', '고객 제출']) option(kind, value, value);
    const organization = field(processFields, 'certification-organization', '제출기관·고객 (필수)', 'input', 200);
    const scheme = field(processFields, 'certification-scheme', '제도·제출 요구명 (필수)', 'input', 200);
    const submittedOn = dateField(processFields, 'certification-submitted-on', '제출일 (제출 완료부터 필수)');
    const registrationNumber = field(processFields, 'certification-number', '인증·등록 번호 / 고객 접수·확인 번호 (승인·등록 시 필수)', 'input', 200);
    const issuedOn = dateField(processFields, 'certification-issued-on', '발급·확인일 (승인·등록 시 필수)');
    const note = field(processFields, 'certification-note', '제출·보완·결과 메모 (선택)', 'textarea', 2000);
    const actor = field(processFields, 'certification-actor', '기록 담당자 (필수)'); actor.value = project.researcherName || '';
    const reason = field(processFields, 'certification-reason', '확인 근거·변경 사유 (필수)', 'textarea', 1000);
    const startLabel = text('div', '', ''); const startCheck = checkbox(startLabel, '완료 근거를 확인했고 9단계로 이동할게요. 이동 후 이전 단계의 자료·계산·해석·보고서·검증은 읽기 전용이에요.'); processFields.append(startLabel);
    const processSave = text('button', 'primary-button', '인증·등록 준비 시작 · 9단계로'); processSave.type = 'submit';
    const processError = text('p', 'field-error', ''); processError.setAttribute('role', 'alert');
    processForm.append(processFields, processSave, processError);
    processCard.append(processForm, text('p', 'detail-help', '제출 준비 → 제출 완료 → 보완 요청 → 재제출 또는 승인·등록/반려로 기록해요. 승인·등록과 반려 후에는 상태를 유지하며 오기 정정만 사유와 함께 남길 수 있어요. 앱 기록이 기관의 공식 결정을 대신하지 않아요.'));
    const rebase = text('button', 'request-action-button', '최신 기준 다시 확인'); rebase.type = 'button';
    const feedback = text('p', '', ''); feedback.setAttribute('role', 'status');
    const history = text('section', 'detail-card calculation-card', ''); history.append(text('h2', '', '완료·제출 변경 이력')); const historyList = text('div', '', ''); history.append(historyList);
    host.replaceChildren(intro, completionCard, processCard, rebase, feedback, history);
    let state; let busy = false; let dirty = false; let revision = 0; let basis = null; let formRevision = -1;
    const controls = { kind, organization, scheme, submittedOn, registrationNumber, issuedOn, note };
    function adopt(loaded) {
      revision = loaded.record.revision;
      basis = loaded.latest && loaded.verification ? { reportRevision: loaded.latest.revision, sourceKey: loaded.latest.sourceKey, verificationRevision: loaded.verification.revision } : null;
    }
    function refresh() {
      state = store.load(project.id);
      if (!state.ok) { notice.textContent = state.error; completionFields.disabled = true; completionSave.disabled = true; processFields.disabled = true; processSave.disabled = true; return; }
      if (!dirty) adopt(state);
      if (!dirty && state.record.revision !== formRevision) {
        if (state.process) {
          for (const [key, input] of Object.entries(controls)) input.value = state.process.details[key];
          actor.value = state.process.actor; reason.value = ''; startCheck.checked = false;
        }
        formRevision = state.record.revision;
      }
      const previousStatus = status.value;
      status.replaceChildren();
      for (const value of state.process ? LCA.certification.TRANSITIONS[state.process.status] : ['제출 준비']) option(status, value, value);
      if (dirty && previousStatus && ![...status.options].some((entry) => entry.value === previousStatus)) option(status, previousStatus, `${previousStatus} · 이전 기준 선택`);
      status.value = dirty && previousStatus ? previousStatus : state.process?.status || '제출 준비';
      const stageHelp = state.project.stage < 8 ? '제3자 검증(8)에서 검토와 지적 처리를 마친 뒤 완료 근거를 기록해 주세요.' : state.project.stage > 9 ? '후속 단계에서는 보관 이력을 조회할 수 있어요.' : '';
      notice.textContent = state.warning || stageHelp || (state.process ? `현재 상태: ${state.process.status} · 최종 보고서 v${state.completion.report.revision}의 완료 근거로 진행 중이에요.` : state.startBlock || '완료 근거가 준비됐어요. 아래에서 목적에 맞는 제출 절차를 시작할 수 있어요.');
      if (dirty && revision !== state.record.revision) notice.textContent += ' 다른 화면에서 기록이 바뀌었어요. 입력은 유지했으니 최신 기준을 확인해 주세요.';
      completionInfo.replaceChildren();
      if (state.completion) {
        const saved = state.completion;
        completionInfo.append(text('p', 'detail-help', `보관 완료: ${saved.completedOn} · 보고서 v${saved.report.revision} · ${saved.documentName} · 기록자 ${saved.actor}`), text('p', 'interpretation-text', saved.reason));
        const open = text('button', 'request-action-button', `완료 근거 보고서 v${saved.report.revision} 보기`); open.type = 'button'; open.addEventListener('click', () => onOpenReport(saved.report.revision)); completionInfo.append(open);
      } else completionInfo.append(text('p', 'detail-help', `완료 대상으로 확인할 보고서: ${state.latest ? `v${state.latest.revision} · ${state.latest.title}` : '없음'}`));
      completionForm.hidden = !!state.process;
      completionFields.disabled = busy || !state.canComplete; completionSave.disabled = busy || !state.canComplete;
      completionSave.textContent = state.completion ? '검증 완료 근거 새로 보관' : '검증 완료 기록 보관';
      processTitle.textContent = state.process ? `제출 진행 관리 · ${state.process.status}` : '인증·등록 또는 고객 제출 시작';
      processFields.disabled = busy || !(state.process ? state.canWrite : state.canStart); processSave.disabled = processFields.disabled;
      processSave.textContent = busy ? '저장 중…' : state.process ? '진행 정보·이력 저장' : '인증·등록 준비 시작 · 9단계로'; startLabel.hidden = !!state.process;
      rebase.disabled = busy;
      historyList.replaceChildren();
      for (const event of state.record.events.slice().reverse()) {
        const item = text('details', 'customer-review-event', ''); item.append(text('summary', '', `${date(event.at)} · ${event.type === 'completed' ? '검증 완료 기록' : event.type === 'started' ? '9단계 시작' : event.status} · ${event.actor}`));
        if (event.type === 'completed') {
          item.append(text('p', 'detail-help', `완료일 ${event.completedOn} · 보고서 v${event.report.revision} · ${event.verification.rounds.length}차까지 보관 · 결과 문서 ${event.documentName}`));
        } else {
          const d = event.details;
          item.append(text('p', 'detail-help', `${d.kind} · ${d.organization} · ${d.scheme}`), text('p', 'detail-help', `상태 ${event.status} · 제출일 ${d.submittedOn || '미정'} · 번호 ${d.registrationNumber || '미정'} · 발급·확인일 ${d.issuedOn || '미정'}`));
          if (d.note) item.append(text('p', 'interpretation-text', d.note));
        }
        item.append(text('p', 'interpretation-text', event.reason)); historyList.append(item);
      }
      if (!state.record.events.length) historyList.append(text('p', 'detail-help', '아직 보관한 완료·제출 이력이 없어요.'));
    }
    for (const form of [completionForm, processForm]) {
      form.addEventListener('input', () => { dirty = true; }); form.addEventListener('change', () => { dirty = true; });
    }
    async function run(action, draft, error) {
      if (busy) return; const expectedRevision = revision; const expectedBasis = basis;
      busy = true; refresh(); let result;
      try { result = await store.save(project.id, action, draft, expectedRevision, expectedBasis); }
      catch { result = { ok: false, error: '저장하지 못했어요. 입력과 보관 기록은 유지했어요.' }; }
      busy = false; error.textContent = result.error || '';
      if (result.ok) {
        dirty = false; completionCheck.checked = false; startCheck.checked = false;
        feedback.textContent = action === 'completed' ? '검증 완료 근거와 최종 보고서 사본을 보관했어요. 아직 8단계예요.' : action === 'started' ? '9단계로 이동하고 제출 준비 기록을 보관했어요.' : '진행 정보와 변경 사유를 이력에 추가했어요.';
        onChanged();
      }
      refresh(); const target = result.ok ? feedback : error; target.tabIndex = -1; target.focus();
    }
    completionForm.addEventListener('submit', (event) => { event.preventDefault(); run('completed', { completedOn: completedOn.value, documentName: documentName.value, actor: completionActor.value, reason: completionReason.value, confirmed: completionCheck.checked }, completionError); });
    processForm.addEventListener('submit', (event) => {
      event.preventDefault(); run(state.process ? 'updated' : 'started', { ...Object.fromEntries(Object.entries(controls).map(([key, input]) => [key, input.value])), status: status.value, actor: actor.value, reason: reason.value, confirmed: startCheck.checked }, processError);
    });
    rebase.addEventListener('click', () => {
      const latest = store.load(project.id); if (!latest.ok) { refresh(); return; }
      adopt(latest); dirty = true; completionCheck.checked = false; startCheck.checked = false; completionError.textContent = ''; processError.textContent = '';
      feedback.textContent = '입력은 유지하고 최신 보고서·검증·제출 기록으로 기준을 맞췄어요. 저장 전에 내용과 확인 체크를 다시 검토해 주세요.'; refresh();
    });
    refreshCurrent = refresh; refresh();
  }
  function dateField(parent, id, label) {
    const input = field(parent, id, label, 'input', 10); input.inputMode = 'numeric'; input.placeholder = '예: 20261018';
    input.addEventListener('input', () => { input.value = LCA.requests.formatDateInput(input.value); }); return input;
  }
  function checkbox(parent, label) {
    const wrapper = text('label', 'calculation-confirmation', ''); const input = document.createElement('input'); input.type = 'checkbox'; wrapper.append(input, document.createTextNode(label)); parent.append(wrapper); return input;
  }
  return { init, refresh: () => refreshCurrent() };
})();
