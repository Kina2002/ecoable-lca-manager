window.LCA = window.LCA || {};
LCA.views = LCA.views || {};
LCA.views.certificationRenewal = (() => {
  let refreshCurrent = () => {};
  const { text, field, option } = LCA.views.verificationIssue;
  function init(host, project, store, onChanged) {
    const card = text('section', 'detail-card calculation-card', '');
    card.append(text('h2', '', '인증·등록 갱신 기록'), text('p', 'detail-help', '갱신 준비와 요청한 내용을 남기고, 새 인증서가 공식 발급되면 새 번호·발급일·만료일을 기록해요. 갱신 완료 후에는 새 만료일을 기준으로 다음 갱신 안내를 계산해요.'));
    const summary = text('p', 'detail-note', ''); summary.setAttribute('role', 'status'); card.append(summary);
    const form = document.createElement('form'); form.noValidate = true;
    const fields = document.createElement('fieldset'); fields.className = 'calculation-fields';
    const status = field(fields, 'renewal-status', '갱신 처리 상태', 'select'); for (const value of ['갱신 준비', '갱신 요청', '갱신 완료']) option(status, value, value);
    const actionOn = dateField(fields, 'renewal-action-on', '이번 처리일 (필수)'); actionOn.value = LCA.rules.today();
    const documentName = field(fields, 'renewal-document', '확인 문서·처리 기록 이름 (필수)', 'input', 200);
    const actor = field(fields, 'renewal-actor', '기록 담당자 (필수)'); actor.value = project.researcherName || ''; LCA.views.inputAssist.person(actor, project);
    const reason = field(fields, 'renewal-reason', '처리 내용과 확인 근거 (필수)', 'textarea', 1000);
    const issuedFields = text('div', 'renewal-issued-fields', ''); fields.append(issuedFields);
    const submittedOn = dateField(issuedFields, 'renewal-submitted-on', '이번 갱신 신청·제출일 (완료 시 필수)');
    const issuedOn = dateField(issuedFields, 'renewal-issued-on', '새 인증·등록 발급일 (완료 시 필수)');
    const registrationNumber = field(issuedFields, 'renewal-registration-number', '새 인증·등록 번호 (동일 번호면 그대로 입력)', 'input', 200);
    const expiryOn = dateField(issuedFields, 'renewal-expiry-on', '새 문서의 공식 만료일 (완료 시 필수)');
    const label = text('label', 'calculation-confirmation', ''); const confirmed = document.createElement('input'); confirmed.type = 'checkbox';
    label.append(confirmed, document.createTextNode('기관의 갱신 완료와 새 인증·등록 문서의 번호·날짜를 직접 확인했어요.')); issuedFields.append(label);
    const save = text('button', 'primary-button', '갱신 처리 기록 저장'); save.type = 'submit';
    const rebase = text('button', 'request-action-button', '입력을 유지하고 최신 기준 확인'); rebase.type = 'button';
    const error = text('p', 'field-error', ''); error.setAttribute('role', 'alert');
    const feedback = text('p', 'request-feedback', ''); feedback.setAttribute('role', 'status');
    form.append(fields, save, rebase, error); card.append(LCA.views.compact.form(form, '갱신 준비·요청·완료 기록'), feedback); host.replaceChildren(card);
    let loaded; let revision = 0; let dirty = false; let busy = false;
    function displayFields() { issuedFields.hidden = status.value !== '갱신 완료'; }
    function refresh() {
      loaded = store.load(project.id);
      if (!loaded.ok) { summary.textContent = loaded.error; fields.disabled = save.disabled = rebase.disabled = true; return; }
      card.hidden = !loaded.process || !['인증', '등록'].includes(loaded.process.details.kind);
      fields.disabled = save.disabled = busy || !loaded.canRecordValidity; rebase.disabled = busy;
      const progress = loaded.renewalProgress;
      const current = loaded.process?.details;
      const renewal = loaded.record.events.filter((event) => event.type === 'renewed').at(-1);
      summary.textContent = current ? `현재 인증·등록 ${current.registrationNumber || '미정'} · 발급일 ${current.issuedOn || '미정'} · ${progress ? `${progress.status} · 처리일 ${progress.actionOn}` : renewal ? `최근 갱신 완료 ${renewal.actionOn}` : '아직 기록한 갱신 처리가 없어요.'}` : '';
      if (!dirty) {
        revision = loaded.record.revision; status.value = progress?.status || '갱신 준비'; actionOn.value = LCA.rules.today();
        documentName.value = ''; reason.value = ''; submittedOn.value = ''; issuedOn.value = ''; expiryOn.value = '';
        registrationNumber.value = current?.registrationNumber || ''; confirmed.checked = false;
      } else if (revision !== loaded.record.revision) error.textContent = '다른 인증 기록이 저장됐어요. 입력을 유지했으니 최신 기준을 확인해 주세요.';
      displayFields(); LCA.views.inputAssist.sync(card);
    }
    form.addEventListener('input', () => { dirty = true; }); form.addEventListener('change', () => { dirty = true; }); status.addEventListener('change', displayFields);
    form.addEventListener('submit', async (event) => {
      event.preventDefault(); if (busy) return;
      const expectedRevision = revision; const completed = status.value === '갱신 완료';
      const draft = { status: status.value, actionOn: actionOn.value, documentName: documentName.value, actor: actor.value, reason: reason.value,
        submittedOn: submittedOn.value, issuedOn: issuedOn.value, registrationNumber: registrationNumber.value, expiryOn: expiryOn.value, confirmed: confirmed.checked };
      busy = true; refresh(); const result = await store.save(project.id, completed ? 'renewed' : 'renewal-progress', draft, expectedRevision); busy = false;
      error.textContent = result.error || '';
      if (result.ok) { dirty = false; feedback.textContent = completed ? '새 인증서 정보를 갱신 이력에 보관했어요. 이전 기록은 남기고 새 만료일로 다음 안내를 계산해요.' : '갱신 처리 내용을 이력에 보관했어요. 갱신 완료 전까지 필요한 확인 할 일은 계속 보여요.'; onChanged(); }
      refresh(); const target = result.ok ? feedback : error; target.tabIndex = -1; target.focus();
    });
    rebase.addEventListener('click', () => {
      const latest = store.load(project.id); if (!latest.ok) { refresh(); return; }
      revision = latest.record.revision; dirty = true; confirmed.checked = false; error.textContent = '';
      feedback.textContent = '입력은 유지하고 최신 인증 기록으로 맞췄어요. 현재 인증서와 새 문서의 번호·날짜를 다시 확인해 주세요.'; refresh();
    });
    refreshCurrent = refresh; refresh();
  }
  function dateField(parent, id, label) {
    const input = field(parent, id, label, 'input', 10); input.inputMode = 'numeric'; input.placeholder = '예: 20261019';
    input.addEventListener('input', () => { input.value = LCA.requests.formatDateInput(input.value); }); LCA.views.inputAssist.date(input); return input;
  }
  return { init, refresh: () => refreshCurrent() };
})();
