window.LCA = window.LCA || {};
LCA.views = LCA.views || {};
LCA.views.resubmission = (() => {
  let refreshCurrent = () => {};
  const { text, field } = LCA.views.verificationIssue;
  function init(host, project, store, onChanged, onOpenReport, onOpenTab) {
    const card = text('section', 'detail-card calculation-card', '');
    const title = text('h2', '', '제출 후 보완·재제출');
    const summary = text('p', 'detail-note', ''); summary.setAttribute('role', 'status');
    const guide = text('p', 'detail-help', '이전 제출본은 보관하고 새 보고서 버전을 만들어요. 보고서 버전·제출 횟수·검증 차수는 각각 따로 세어요.');
    const actions = text('div', 'request-actions', '');
    for (const [tab, label] of [['requests', '보완 자료 확인'], ['report', '수정 보고서 작성·비교'], ['verification', '수정본 검토·검증']]) {
      const button = text('button', 'request-action-button', label); button.type = 'button';
      button.addEventListener('click', () => tab === 'report' ? onOpenReport(loaded.latest?.revision) : onOpenTab(tab)); actions.append(button);
    }
    const start = makeForm('보완 요청 기록·작업 시작');
    const startedOn = dateField(start.fields, 'amendment-start-date', '보완 시작일 (필수)');
    const requestedBy = field(start.fields, 'amendment-requested-by', '보완을 요청한 기관·고객 담당자 (필수)', 'input', 200);
    const startDocument = field(start.fields, 'amendment-document', '보완 요청 문서·기록 이름 (필수 · 이름만 저장)', 'input', 200);
    const startReason = field(start.fields, 'amendment-reason', '어떤 내용을 왜 보완하는지 (필수)', 'textarea', 1000);
    const startActor = personField(start.fields, 'amendment-actor', project);
    const startCheck = checkbox(start.fields, '이전 제출본을 보관하고 보고서(7) 작업을 다시 열게요. 자료·계산 결과·해석 수정은 새 보고서에 반영하며 기존 완료 기록도 남아요.');
    start.save.textContent = '보완 시작 · 수정 보고서 작업 열기';
    const submit = makeForm('수정 보고서 재제출 기록');
    const target = text('p', 'detail-note', ''); submit.fields.append(target);
    const submittedOn = dateField(submit.fields, 'resubmission-date', '실제로 재제출한 날 (필수)');
    const organization = field(submit.fields, 'resubmission-recipient', '받는 기관·고객 (필수)', 'input', 200);
    const submitDocument = field(submit.fields, 'resubmission-document', '제출 문서·접수 기록 이름 (필수 · 이름만 저장)', 'input', 200);
    const submitReason = field(submit.fields, 'resubmission-reason', '보완한 내용과 재제출 근거 (필수)', 'textarea', 1000);
    const submitActor = personField(submit.fields, 'resubmission-actor', project);
    const submitCheck = checkbox(submit.fields, '새 보고서와 재검토 완료 근거를 확인했고, 위 기관·고객에 실제로 제출했어요. 저장 후 9단계로 이동하고 이전 작업은 읽기 전용이 돼요.');
    submit.save.textContent = '재제출 기록 저장 · 9단계로';
    const feedback = text('p', 'request-feedback', ''); feedback.setAttribute('role', 'status');
    const history = text('details', 'form-disclosure', ''); const historyTitle = text('summary', '', '제출별 보고서 보관 목록'); const list = text('div', '', ''); history.append(historyTitle, list);
    card.append(title, summary, guide, actions, start.wrapper, submit.wrapper, feedback, history); host.replaceChildren(card);
    let loaded; let busy = false;
    function refresh() {
      loaded = store.load(project.id);
      if (!loaded.ok) { summary.textContent = loaded.error; for (const form of [start, submit]) form.fields.disabled = form.save.disabled = form.rebase.disabled = true; return; }
      card.hidden = project.stage < 9 && !loaded.amendment && !loaded.submissions.length;
      actions.hidden = !loaded.amendmentActive;
      start.wrapper.hidden = loaded.amendmentActive;
      submit.wrapper.hidden = !loaded.amendmentActive;
      summary.textContent = loaded.amendmentActive ? `${loaded.amendment.number}차 제출을 위한 보완 중 · 이전 제출 보고서 v${loaded.amendment.report.revision} · ${loaded.amendment.startedOn} 시작 · ${loaded.amendment.requestedBy}. ${loaded.canResubmit ? '새 보고서의 검토 완료 근거가 준비됐어요.' : loaded.startBlock}`
        : loaded.submissions.length ? `현재까지 ${loaded.submissions.length}회 제출했어요. 다음 보완·재제출은 ${loaded.submissions.length + 1}차로 기록해요.`
          : '아직 실제 제출 기록이 없어요. 제출 진행을 먼저 기록하면 이곳에서 보완을 시작할 수 있어요.';
      if (loaded.amendmentActive) summary.textContent += ` 이전 제출 진행 ${loaded.amendment.previousStatus} · ${loaded.amendment.details.registrationNumber ? `확인 번호 ${loaded.amendment.details.registrationNumber} · ` : ''}${loaded.amendment.fromStage === 10 ? '이전 완료 기록도 보관 중이에요.' : '이전 제출 이력도 보관 중이에요.'}`;
      title.textContent = loaded.amendmentActive ? `제출 후 보완·재제출 · ${loaded.amendment.number}차 준비` : '제출 후 보완·재제출';
      target.textContent = `재제출 대상: ${loaded.completion ? `보고서 v${loaded.completion.report.revision} · ${loaded.completion.report.title}` : '재검토 완료 근거 보관 필요'}`;
      start.fields.disabled = start.save.disabled = busy || !loaded.canAmend;
      submit.fields.disabled = submit.save.disabled = busy || !loaded.canResubmit;
      for (const form of [start, submit]) {
        form.rebase.disabled = busy;
        if (!form.dirty) adopt(form);
        else if (form.revision !== loaded.record.revision) form.error.textContent = '다른 화면에서 제출·검토 기록이 바뀌었어요. 입력을 유지했으니 최신 기준을 확인해 주세요.';
      }
      if (!start.dirty) { startedOn.value = LCA.rules.today(); requestedBy.value = loaded.process?.details.organization || ''; startDocument.value = ''; startReason.value = ''; startCheck.checked = false; }
      if (!submit.dirty) { submittedOn.value = LCA.rules.today(); organization.value = loaded.amendment?.details.organization || ''; submitDocument.value = ''; submitReason.value = ''; submitCheck.checked = false; }
      historyTitle.textContent = `제출별 보고서 보관 목록 · ${loaded.submissions.length}회`;
      const opened = new Set([...list.querySelectorAll('details[open]')].map((item) => item.dataset.submissionNumber));
      list.replaceChildren();
      for (const item of loaded.submissions.slice().reverse()) {
        const row = text('details', 'customer-review-event', ''); row.dataset.submissionNumber = String(item.number); row.open = opened.has(String(item.number)); row.append(text('summary', '', `${item.number}차 제출 · ${item.submittedOn} · 보고서 v${item.report.revision} · ${item.organization}`));
        row.append(text('p', 'detail-help', `${item.report.title} · 기록자 ${item.actor} · 제출 문서 ${item.documentName || '이전 진행 기록 참조'}`), text('p', 'interpretation-text', item.reason));
        const open = text('button', 'request-action-button', `당시 보고서 v${item.report.revision} 보기·비교`); open.type = 'button'; open.addEventListener('click', () => onOpenReport(item.report.revision)); row.append(open); list.append(row);
      }
      if (!loaded.submissions.length) list.append(text('p', 'detail-help', '아직 보관한 제출 기록이 없어요.'));
      LCA.views.inputAssist.sync(card);
    }
    function adopt(form) {
      form.revision = loaded.record.revision;
      const report = form === start ? loaded.latest : loaded.completion?.report;
      form.basis = report ? { reportRevision: report.revision, reportKey: JSON.stringify(report) } : null;
    }
    function bind(form, check, action, getDraft) {
      form.node.addEventListener('input', () => { form.dirty = true; }); form.node.addEventListener('change', () => { form.dirty = true; });
      form.node.addEventListener('submit', async (event) => {
        event.preventDefault(); if (busy) return;
        const draft = getDraft(); const revision = form.revision; const basis = form.basis;
        busy = true; refresh(); let result;
        try { result = await store.save(project.id, action, draft, revision, basis); }
        catch { result = { ok: false, error: '저장하지 못했어요. 입력과 기존 제출본은 유지했어요.' }; }
        busy = false; form.error.textContent = result.error || '';
        if (result.ok) {
          form.dirty = false; check.checked = false;
          feedback.textContent = action === 'amendment-started' ? '이전 제출본을 보관하고 보완 작업을 열었어요. 수정 보고서 작성 → 검토·검증 → 이 탭에서 완료 근거 보관 → 재제출 순서로 진행해 주세요.' : '재제출 보고서와 제출일·기관·문서·근거를 보관했어요. 이전 제출 이력은 그대로 남고 수정 작업은 읽기 전용이에요.';
          onChanged();
        }
        refresh(); const focus = result.ok ? feedback : form.error; focus.tabIndex = -1; focus.focus();
      });
      form.rebase.addEventListener('click', () => {
        loaded = store.load(project.id); if (!loaded.ok) { refresh(); return; }
        adopt(form); form.dirty = true; check.checked = false; form.error.textContent = '';
        feedback.textContent = '입력을 유지하고 최신 기준을 불러왔어요. 대상 보고서와 제출 내용을 다시 확인한 뒤 체크해 주세요.'; refresh();
      });
    }
    bind(start, startCheck, 'amendment-started', () => ({ startedOn: startedOn.value, requestedBy: requestedBy.value, documentName: startDocument.value, reason: startReason.value, actor: startActor.value, confirmed: startCheck.checked }));
    bind(submit, submitCheck, 'resubmitted', () => ({ submittedOn: submittedOn.value, organization: organization.value, documentName: submitDocument.value, reason: submitReason.value, actor: submitActor.value, confirmed: submitCheck.checked }));
    refreshCurrent = refresh; refresh();
  }
  function makeForm(label) {
    const node = document.createElement('form'); node.noValidate = true;
    const fields = document.createElement('fieldset'); fields.className = 'calculation-fields';
    const save = text('button', 'primary-button', ''); save.type = 'submit';
    const rebase = text('button', 'request-action-button', '입력을 유지하고 최신 기준 확인'); rebase.type = 'button';
    const error = text('p', 'field-error', ''); error.setAttribute('role', 'alert');
    node.append(fields, save, rebase, error);
    return { node, fields, save, rebase, error, wrapper: LCA.views.compact.form(node, label), revision: 0, basis: null, dirty: false };
  }
  function dateField(parent, id, label) {
    const input = field(parent, id, label, 'input', 10); input.inputMode = 'numeric'; input.placeholder = '예: 20261019';
    input.addEventListener('input', () => { input.value = LCA.requests.formatDateInput(input.value); }); LCA.views.inputAssist.date(input); return input;
  }
  function personField(parent, id, project) {
    const input = field(parent, id, '기록 담당자 (필수)'); input.value = project.researcherName || ''; LCA.views.inputAssist.person(input, project); return input;
  }
  function checkbox(parent, value) {
    const label = text('label', 'calculation-confirmation', ''); const input = document.createElement('input'); input.type = 'checkbox'; label.append(input, document.createTextNode(value)); parent.append(label); return input;
  }
  return { init, refresh: () => refreshCurrent() };
})();
