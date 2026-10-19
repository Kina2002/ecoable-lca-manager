window.LCA = window.LCA || {};
LCA.views = LCA.views || {};
LCA.views.certificationStatus = (() => {
  let refreshCurrent = () => {};
  const { text, field, option } = LCA.views.verificationIssue;
  function init(host, project, store, onChanged) {
    const card = text('section', 'detail-card calculation-card', '');
    const heading = text('h2', '', '현재 인증 상태');
    const summary = text('p', 'detail-note', ''); summary.setAttribute('role', 'status');
    const evidence = text('p', 'detail-help', '');
    card.append(heading, summary, evidence, text('p', 'detail-help', '유효·만료는 기록한 공식 만료일 기준이에요. 만료 임박은 기존 갱신 안내 시작일(6개월 전, UL EPD는 60일 전)부터예요. 취소는 확인 문서로 직접 기록하며, 기관에 자동 조회하지 않아요.'));
    const form = document.createElement('form'); form.noValidate = true;
    const fields = document.createElement('fieldset'); fields.className = 'calculation-fields';
    const target = text('p', 'detail-help', ''); fields.append(target);
    const status = field(fields, 'cert-status-check-status', '문서·기관에서 확인한 상태', 'select');
    for (const value of LCA.certification.CHECK_STATUSES) option(status, value, value === '유효' ? '유효 (취소 후 회복 확인 포함)' : value);
    status.value = '확인 필요';
    const checkedOn = field(fields, 'cert-status-check-date', '상태를 확인한 날 (필수)', 'input', 10);
    checkedOn.inputMode = 'numeric'; checkedOn.placeholder = '예: 20261019'; checkedOn.value = LCA.rules.today();
    checkedOn.addEventListener('input', () => { checkedOn.value = LCA.requests.formatDateInput(checkedOn.value); }); LCA.views.inputAssist.date(checkedOn);
    const documentName = field(fields, 'cert-status-check-document', '확인 문서·기관 기록 이름 (필수 · 이름만 저장)', 'input', 200);
    const actor = field(fields, 'cert-status-check-actor', '확인 기록 담당자 (필수)'); actor.value = project.researcherName || ''; LCA.views.inputAssist.person(actor, project);
    const reason = field(fields, 'cert-status-check-reason', '무엇을 확인했고 왜 이 상태인지 (필수)', 'textarea', 1000);
    const checkLabel = text('label', 'calculation-confirmation', '');
    const confirmed = document.createElement('input'); confirmed.type = 'checkbox';
    const checkText = document.createTextNode(''); checkLabel.append(confirmed, checkText); fields.append(checkLabel);
    const save = text('button', 'primary-button', '상태 확인 이력 저장'); save.type = 'submit';
    const rebase = text('button', 'request-action-button', '입력을 유지하고 최신 인증 기준 확인'); rebase.type = 'button';
    const error = text('p', 'field-error', ''); error.setAttribute('role', 'alert');
    const feedback = text('p', 'request-feedback', ''); feedback.setAttribute('role', 'status');
    form.append(fields, save, rebase, error); card.append(LCA.views.compact.form(form, '상태 확인·취소·회복 기록'), feedback);
    host.replaceChildren(card);
    let loaded; let revision = 0; let dirty = false; let busy = false;
    function checkMessage() {
      checkText.textContent = status.value === '취소' ? '대상 인증서와 기관의 취소 문서·기록을 직접 확인했어요. 날짜 경과만으로 취소를 기록하지 않아요.'
        : status.value === '유효' ? '대상 인증서의 현재 유효 상태를 직접 확인했어요. 취소 이력이 있다면 기관의 유효 회복 확인도 포함해요.'
          : '대상 인증서에서 추가 확인이 필요한 내용과 근거를 직접 확인했어요.';
    }
    function refresh() {
      loaded = store.load(project.id);
      if (!loaded.ok) { summary.textContent = loaded.error; fields.disabled = save.disabled = rebase.disabled = true; return; }
      const d = loaded.process?.details; const latest = loaded.statusChecks.at(-1);
      heading.textContent = `현재 인증 상태 · ${loaded.currentStatus.label}`;
      summary.textContent = loaded.currentStatus.detail;
      evidence.textContent = latest ? `최근 상태 확인 ${latest.checkedOn} · ${latest.status} · ${latest.documentName} · ${latest.actor}`
        : loaded.validity ? `공식 만료일 근거: ${loaded.validity.documentName} · ${loaded.validity.actor}. 별도 상태 확인 이력은 없어요.` : '아직 보관한 상태 확인 이력이 없어요.';
      target.textContent = d ? `저장 대상: ${d.organization} · ${d.scheme} · 번호 ${d.registrationNumber || '미정'} · 발급일 ${d.issuedOn || '미정'}` : '승인된 인증·등록부터 상태 확인을 기록할 수 있어요.';
      form.parentElement.hidden = !d || d.kind === '고객 제출';
      fields.disabled = save.disabled = busy || !loaded.canRecordValidity; rebase.disabled = busy;
      if (!dirty) { revision = loaded.record.revision; status.value = '확인 필요'; checkedOn.value = LCA.rules.today(); documentName.value = ''; reason.value = ''; confirmed.checked = false; }
      else if (revision !== loaded.record.revision) error.textContent = '다른 화면에서 인증 기록이 바뀌었어요. 입력을 유지했으니 현재 대상과 최신 기준을 확인해 주세요.';
      checkMessage(); LCA.views.inputAssist.sync(card);
    }
    form.addEventListener('input', () => { dirty = true; }); form.addEventListener('change', () => { dirty = true; });
    status.addEventListener('change', () => { confirmed.checked = false; checkMessage(); });
    form.addEventListener('submit', async (event) => {
      event.preventDefault(); if (busy) return;
      const expectedRevision = revision;
      const draft = { status: status.value, checkedOn: checkedOn.value, documentName: documentName.value, actor: actor.value, reason: reason.value, confirmed: confirmed.checked };
      busy = true; refresh(); let result;
      try { result = await store.save(project.id, 'status-check', draft, expectedRevision); }
      catch { result = { ok: false, error: '저장하지 못했어요. 입력과 기존 이력은 유지했어요.' }; }
      busy = false; error.textContent = result.error || '';
      if (result.ok) { dirty = false; feedback.textContent = '상태 확인 내용과 문서 이름·확인일·담당자·사유를 변경 이력에 보관했어요.'; onChanged(); }
      refresh(); const focus = result.ok ? feedback : error; focus.tabIndex = -1; focus.focus();
    });
    rebase.addEventListener('click', () => {
      const latest = store.load(project.id); if (!latest.ok) { refresh(); return; }
      revision = latest.record.revision; dirty = true; confirmed.checked = false; error.textContent = '';
      feedback.textContent = '입력을 유지했어요. 저장 대상 번호·발급일과 문서가 일치하는지 다시 확인하고 체크해 주세요.'; refresh();
    });
    refreshCurrent = refresh; refresh();
  }
  return { init, refresh: () => refreshCurrent() };
})();
