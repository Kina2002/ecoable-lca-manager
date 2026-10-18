window.LCA = window.LCA || {};
LCA.views = LCA.views || {};
LCA.views.reviewRoute = (() => {
  let refreshCurrent = () => {};
  const { text, field, option, date } = LCA.views.verificationIssue;
  function init(project, store, onChanged, onOpenReport) {
    const host = document.querySelector('#project-review-route');
    const decisionCard = text('section', 'detail-card calculation-card', '');
    decisionCard.append(text('h2', '', '검토 방식 선택'), text('p', 'detail-help', '미정이면 방식을 정한 뒤 검토를 진행해요. 내부 검토는 우리 팀의 확인으로 보고서를 확정하고, 외부 검토는 내부 확인 뒤 독립적인 외부 검증자에게 검토받아요. 적용 기준과 고객 요구를 확인해 직접 선택해 주세요.'));
    const status = text('p', 'detail-note', ''); status.setAttribute('role', 'status');
    const form = document.createElement('form'); form.noValidate = true;
    const fields = document.createElement('fieldset'); fields.className = 'calculation-fields'; fields.append(text('legend', '', '프로젝트의 검토 경로'));
    const method = field(fields, 'review-route-method', '검토 방식', 'select');
    for (const [key, label] of Object.entries(LCA.reviewRoute.METHODS)) option(method, key, label);
    const actor = field(fields, 'review-route-actor', '방식 기록 담당자 (필수)'); actor.value = project.researcherName || '';
    LCA.views.inputAssist.person(actor, project);
    const reason = field(fields, 'review-route-reason', '선택 근거·변경 사유 (미정이면 선택)', 'textarea', 1000);
    reason.placeholder = '예: 고객과 내부 개선용 보고서로 협의하여 내부 검토로 확정 / 제출 제도에서 제3자 검증을 요구함';
    const save = text('button', 'primary-button', '검토 방식 저장'); save.type = 'submit';
    const error = text('p', 'field-error', ''); error.setAttribute('role', 'alert'); form.append(fields, save, error); decisionCard.append(status, form);
    const reviewCard = text('section', 'detail-card calculation-card', ''); const title = text('h2', '', '내부 검토');
    const readiness = text('p', 'calculation-notice', ''); readiness.setAttribute('role', 'status');
    const reportInfo = text('p', 'detail-note', '');
    const open = text('button', 'request-action-button', '검토할 최신 보고서 보기'); open.type = 'button';
    const reviewForm = document.createElement('form'); reviewForm.noValidate = true;
    const reviewFields = document.createElement('fieldset'); reviewFields.className = 'calculation-fields'; reviewFields.append(text('legend', '', '담당자의 내부 확인 기록'));
    const reviewer = field(reviewFields, 'internal-review-reviewer', '내부 검토자 (필수)');
    LCA.views.inputAssist.person(reviewer, project, { compact: false, label: '내부 검토자' });
    const reviewedOn = field(reviewFields, 'internal-review-date', '내부 검토일 (필수 · 연월일 8자리)', 'input', 10); reviewedOn.inputMode = 'numeric'; reviewedOn.placeholder = '예: 20261120';
    reviewedOn.addEventListener('input', () => { reviewedOn.value = LCA.requests.formatDateInput(reviewedOn.value); });
    LCA.views.inputAssist.date(reviewedOn);
    const note = field(reviewFields, 'internal-review-note', '검토 내용·확인 결과 (필수)', 'textarea', 3000);
    const recorder = field(reviewFields, 'internal-review-recorder', '내부 검토 기록 담당자 (필수)'); recorder.value = project.researcherName || '';
    LCA.views.inputAssist.person(recorder, project);
    const checks = {};
    for (const [key, label] of Object.entries(LCA.reviewRoute.CHECKS)) checks[key] = checkbox(reviewFields, label);
    const confirmed = checkbox(reviewFields, '선택한 검토 방식과 최신 보고서를 확인했고, 검토자의 역할·독립성은 적용 기준과 고객 요구에 맞게 확인했어요.');
    const reviewSave = text('button', 'primary-button', '내부 검토 완료 기록'); reviewSave.type = 'submit';
    const reviewError = text('p', 'field-error', ''); reviewError.setAttribute('role', 'alert'); reviewForm.append(reviewFields, reviewSave, reviewError);
    reviewCard.append(title, readiness, reportInfo, open, reviewForm);
    const rebase = text('button', 'request-action-button', '검토 기준 다시 확인'); rebase.type = 'button';
    const feedback = text('p', 'detail-help', ''); feedback.setAttribute('role', 'status');
    const history = document.createElement('details'); history.className = 'detail-card review-route-history'; history.append(text('summary', '', '검토 방식·내부 검토 이력'));
    const historyList = text('div', '', ''); history.append(historyList); host.replaceChildren(decisionCard, reviewCard, rebase, feedback, history);
    let state; let busy = false; let choiceDirty = false; let reviewDirty = false; let choiceRevision = 0; let reviewRevision = 0; let expectedReport = null;
    function adopt(loaded) {
      reviewRevision = loaded.record.revision;
      expectedReport = loaded.latest ? { revision: loaded.latest.revision, sourceKey: loaded.latest.sourceKey, key: JSON.stringify(loaded.latest) } : null;
    }
    function refresh() {
      state = store.load(project.id);
      if (!state.ok) { status.textContent = state.error; for (const node of host.querySelectorAll('input, select, textarea, button')) node.disabled = true; LCA.views.inputAssist.sync(host); return; }
      if (!choiceDirty) {
        choiceRevision = state.record.revision; method.value = state.method; reason.value = state.decision?.reason || '';
        actor.value = state.decision?.actor || project.researcherName || '';
      }
      if (!reviewDirty) adopt(state);
      for (const item of method.options) item.disabled = state.externalStarted && item.value !== 'external';
      fields.disabled = busy || !state.canSelect; save.disabled = fields.disabled; rebase.disabled = busy;
      const help = state.legacyExternal ? ' · 기존 외부 검증 기록에서 연결했어요. 내부 확인 기록을 새로 작성하거나 방식을 저장할 수 있어요.'
        : state.method === 'undecided' ? ' · 검토 방식을 저장하기 전에는 검토 완료·외부 검증·후속 제출을 시작하지 않아요.'
        : state.externalStarted ? ' · 외부 검증을 시작한 뒤에는 기존 차수·지적을 보존하기 위해 방식을 바꾸지 않아요.' : '';
      status.textContent = state.warning || `저장된 검토 방식: ${LCA.reviewRoute.METHODS[state.method]}${help}`;
      if (state.project.stage < 7) status.textContent += ' 보고서 단계(7)에서 방식을 저장할 수 있어요.';
      if (state.project.stage >= 9) status.textContent += ' 후속 제출을 시작한 뒤에는 검토 근거를 읽기만 할 수 있어요.';
      if (choiceDirty && method.value !== state.method) status.textContent += ' 화면에서 바꾼 선택은 방식 저장 후 적용돼요.';
      reviewCard.hidden = state.method === 'undecided';
      title.textContent = state.method === 'internal' ? '내부 검토·보고서 확정' : '외부 검토 전 내부 확인';
      const staleBasis = expectedReport?.key !== (state.latest ? JSON.stringify(state.latest) : null) || reviewRevision !== state.record.revision;
      readiness.textContent = state.reviewBlock || (state.reviewReady ? `최신 보고서 v${state.latest.revision}의 내부 검토를 완료했어요.${state.method === 'internal' ? ' 보고서를 확정해 후속 제출 준비로 이어갈 수 있어요.' : ' 아래 외부 검증을 진행할 수 있어요.'}`
        : state.stale ? '보고서 또는 검토 방식이 바뀌었어요. 이전 검토 기록은 보관하고 최신 기준을 다시 검토해 주세요.' : '최신 보고서를 읽고 내부 검토 내용을 기록해 주세요.');
      if (reviewDirty && staleBasis) readiness.textContent += ' 작성 기준이 달라졌어요. 검토 기준 다시 확인을 눌러 주세요.';
      reportInfo.textContent = state.latest ? `내부 검토 대상: 보고서 v${state.latest.revision} · ${state.latest.title}` : '보관된 보고서가 없어요.';
      reviewFields.disabled = busy || !state.canReview; reviewSave.disabled = reviewFields.disabled; open.disabled = busy || !state.latest;
      reviewSave.textContent = busy ? '저장 중…' : state.method === 'external' ? '내부 확인 완료 · 외부 검토 준비' : state.project.stage === 7 ? '내부 검토 완료 · 8단계로' : '내부 검토 완료 · 보고서 확정';
      historyList.replaceChildren();
      for (const event of state.record.events.slice().reverse()) {
        const row = text('section', 'review-route-event', '');
        row.append(text('h3', '', `${event.type === 'selected' ? '방식 선택' : '내부 검토 완료'} · ${LCA.reviewRoute.METHODS[event.method]}`), text('p', 'detail-help', `${date(event.at)} · 기록자 ${event.actor}`));
        if (event.type === 'selected') row.append(text('p', 'interpretation-text', event.reason || '미정 · 근거 미기록'));
        else {
          row.append(text('p', 'detail-help', `검토자 ${event.reviewer} · 검토일 ${event.reviewedOn} · 보고서 v${event.report.revision}`), text('p', 'interpretation-text', event.note));
          const button = text('button', 'request-action-button', `검토한 보고서 v${event.report.revision} 보기`); button.type = 'button'; button.disabled = busy;
          button.addEventListener('click', () => onOpenReport(event.report.revision)); row.append(button);
        }
        historyList.append(row);
      }
      if (!state.record.events.length) historyList.append(text('p', 'detail-help', state.legacyExternal ? '이 기능 도입 전의 외부 검증 기록은 그대로 유지돼요. 내부 검토를 했다는 기록을 임의로 생성하지 않았어요.' : '아직 저장한 검토 방식·내부 검토 기록이 없어요.'));
      LCA.views.inputAssist.sync(host);
    }
    async function run(action, draft, revision, report, targetError) {
      if (busy) return;
      busy = true; refresh(); let result;
      try { result = await store.save(project.id, action, draft, revision, report); }
      catch { result = { ok: false, error: '검토 기록을 저장하지 못했어요. 입력과 보관 기록은 유지했어요.' }; }
      busy = false; targetError.textContent = result.error || '';
      if (result.ok) {
        if (action === 'selected') choiceDirty = false;
        else { reviewDirty = false; confirmed.checked = false; for (const check of Object.values(checks)) check.checked = false; }
        feedback.textContent = action === 'selected' ? '검토 방식을 저장했어요. 선택한 경로에 맞는 기록 화면을 보여줘요.' : '최신 보고서와 내부 검토 내용을 보관했어요.';
        onChanged();
      }
      refresh(); const target = result.ok ? feedback : targetError; target.tabIndex = -1; target.focus();
    }
    form.addEventListener('input', () => { choiceDirty = true; error.textContent = ''; });
    form.addEventListener('change', () => { choiceDirty = true; refresh(); });
    reviewForm.addEventListener('input', () => { reviewDirty = true; reviewError.textContent = ''; }); reviewForm.addEventListener('change', () => { reviewDirty = true; });
    form.addEventListener('submit', (event) => { event.preventDefault(); run('selected', { method: method.value, actor: actor.value, reason: reason.value }, choiceRevision, null, error); });
    reviewForm.addEventListener('submit', (event) => { event.preventDefault(); run('reviewed', { reviewer: reviewer.value, reviewedOn: reviewedOn.value, note: note.value, actor: recorder.value,
      checks: Object.fromEntries(Object.entries(checks).map(([key, input]) => [key, input.checked])), confirmed: confirmed.checked }, reviewRevision, expectedReport, reviewError); });
    rebase.addEventListener('click', () => {
      const latest = store.load(project.id); if (!latest.ok) { refresh(); return; }
      choiceRevision = latest.record.revision; adopt(latest); choiceDirty = true; reviewDirty = true; confirmed.checked = false; for (const check of Object.values(checks)) check.checked = false;
      error.textContent = ''; reviewError.textContent = ''; feedback.textContent = '입력은 유지하고 최신 보고서·방식 기준을 확인했어요. 확인 항목을 다시 읽고 체크해 주세요.'; refresh();
    });
    open.addEventListener('click', () => { if (state.latest) onOpenReport(state.latest.revision); });
    refreshCurrent = refresh; refresh();
  }
  function checkbox(parent, label) {
    const box = text('label', 'calculation-confirmation', ''); const input = document.createElement('input'); input.type = 'checkbox'; box.append(input, document.createTextNode(label)); parent.append(box); return input;
  }
  return { init, refresh: () => refreshCurrent() };
})();
