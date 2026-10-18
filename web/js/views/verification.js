window.LCA = window.LCA || {};
LCA.views = LCA.views || {};
LCA.views.verification = (() => {
  let refreshCurrent = () => {};
  const { text, field, option, date } = LCA.views.verificationIssue;
  function init(project, store, onChanged, onOpenReport, onOpenCustomers) {
    const host = document.querySelector('#project-verification-panel');
    const introduction = text('section', 'detail-card calculation-card', '');
    introduction.append(text('h2', '', '제3자 검증'), text('p', 'detail-help', '외부 검증자가 어느 보고서를 검토했고 무엇을 보완하라고 했는지 차수별로 기록해요. 답변·수정 보고서와 검증자의 확인 근거를 남기며, 기록만으로 인증이나 공식 검증 통과를 뜻하지 않아요.'));
    const readiness = text('p', 'calculation-notice', ''); readiness.setAttribute('role', 'status');
    const basis = text('p', 'detail-note', '');
    const toCustomers = text('button', 'request-action-button', '고객 의견 확인'); toCustomers.type = 'button'; toCustomers.addEventListener('click', onOpenCustomers);
    const toReport = text('button', 'request-action-button', '최신 보고서 보기'); toReport.type = 'button';
    introduction.append(readiness, basis, toCustomers, toReport);
    const roundEditor = text('section', 'detail-card calculation-card', ''); const roundTitle = text('h2', '', '검증 시작'); roundEditor.append(roundTitle);
    const roundForm = document.createElement('form'); roundForm.noValidate = true;
    const roundFields = document.createElement('fieldset'); roundFields.className = 'calculation-fields'; roundFields.append(text('legend', '', '이번 차수의 검증 정보'));
    const organization = field(roundFields, 'verification-organization', '검증기관 (필수)', 'input', 200);
    const verifier = field(roundFields, 'verification-verifier', '검증 담당자 (필수)');
    const actor = field(roundFields, 'verification-actor', '검증 시작 기록 담당자 (필수)'); actor.value = project.researcherName || '';
    const note = field(roundFields, 'verification-round-note', '차수 메모 (선택)', 'textarea', 1000);
    const confirmedLabel = text('label', 'calculation-confirmation', ''); const confirmed = document.createElement('input'); confirmed.type = 'checkbox';
    confirmedLabel.append(confirmed, document.createTextNode('최신 보고서와 고객 의견 처리 상태를 확인했고, 이전 차수가 있다면 검토와 지적 처리를 마쳐 이번 차수를 시작할게요.'));
    roundFields.append(confirmedLabel);
    const roundSave = text('button', 'primary-button', '제3자 검증 시작'); roundSave.type = 'submit';
    const rebase = text('button', 'request-action-button', '검증 기준 다시 확인'); rebase.type = 'button';
    const roundError = text('p', 'field-error', ''); roundError.setAttribute('role', 'alert');
    const feedback = text('p', '', ''); feedback.setAttribute('role', 'status');
    roundForm.append(roundFields, roundSave, rebase, roundError, feedback); roundEditor.append(roundForm);
    const archive = text('section', 'detail-card calculation-card', ''); archive.append(text('h2', '', '차수별 검증 기록'));
    const selectors = text('div', 'report-version-selectors', '');
    const selectedRound = field(selectors, 'verification-round-filter', '검증 차수', 'select');
    const statusFilter = field(selectors, 'verification-status-filter', '지적 처리 상태', 'select'); option(statusFilter, '', '전체 상태');
    for (const status of LCA.verification.STATUSES) option(statusFilter, status, status);
    const counts = text('p', 'customer-review-counts', ''); counts.setAttribute('role', 'status');
    const roundInfo = text('div', 'verification-round-info', ''); const list = text('div', '', '');
    archive.append(selectors, roundInfo, counts, list);
    const issueEditor = text('section', 'detail-card calculation-card', ''); const issueTitle = text('h2', '', '지적 등록'); issueEditor.append(issueTitle);
    const issueForm = document.createElement('form'); issueForm.noValidate = true;
    const issueFields = document.createElement('fieldset'); issueFields.className = 'calculation-fields'; issueFields.append(text('legend', '', '현재 차수에서 받은 지적'));
    const content = field(issueFields, 'verification-issue-content', '검증 지적 내용 (필수)', 'textarea', 3000);
    const due = field(issueFields, 'verification-issue-due', '보완 기한 (필수 · 연월일 8자리)', 'input', 10); due.inputMode = 'numeric'; due.placeholder = '예: 20261120';
    due.addEventListener('input', () => { due.value = LCA.requests.formatDateInput(due.value); });
    const recorder = field(issueFields, 'verification-issue-recorder', '지적 기록 담당자 (필수)'); recorder.value = project.researcherName || '';
    const issueSave = text('button', 'primary-button', '검증 지적 등록'); issueSave.type = 'submit';
    const issueReload = text('button', 'request-action-button', '지적 등록 기준 다시 확인'); issueReload.type = 'button';
    const issueError = text('p', 'field-error', ''); issueError.setAttribute('role', 'alert');
    issueForm.append(issueFields, issueSave, issueReload, issueError); issueEditor.append(issueForm);
    host.replaceChildren(introduction, roundEditor, issueEditor, archive);
    let state; let busy = false; let roundDirty = false; let issueDirty = false; let roundRevision = 0; let issueRevision = 0;
    let expectedReport = null; let roundChoice = 'latest'; const cards = new Map();
    function adoptRound(loaded) {
      roundRevision = loaded.record.revision; expectedReport = loaded.latest ? { revision: loaded.latest.revision, sourceKey: loaded.sourceKey } : null;
      confirmed.checked = false;
    }
    async function run(action, draft, revision, report) {
      if (busy) return null;
      busy = true; refresh();
      let result;
      try { result = await store.save(project.id, action, draft, revision, report); }
      catch { result = { ok: false, error: '검증 기록을 저장하지 못했어요. 입력과 보관 기록은 유지했어요.' }; }
      finally { busy = false; }
      if (result.ok) onChanged();
      refresh(); return result;
    }
    function refresh() {
      state = store.load(project.id);
      if (!state.ok) {
        readiness.hidden = false; readiness.textContent = state.error;
        for (const input of host.querySelectorAll('input, textarea, select, button')) input.disabled = true;
        return;
      }
      state.busy = busy;
      if (!roundDirty) adoptRound(state);
      if (!issueDirty) issueRevision = state.record.revision;
      const first = !state.round;
      roundTitle.textContent = first ? '제3자 검증 시작' : `${state.round.number + 1}차 검증 시작`;
      roundSave.textContent = busy ? '검증 기록 저장 중…' : first && state.project.stage === 7 ? '제3자 검증 시작 · 8단계로' : first ? '1차 검증 정보 저장' : `${state.round.number + 1}차 검증 시작`;
      roundFields.disabled = busy || ![7, 8].includes(state.project.stage) || !!state.warning;
      roundSave.disabled = roundFields.disabled || !state.canStart;
      rebase.disabled = busy;
      const stale = roundRevision !== state.record.revision || expectedReport?.revision !== state.latest?.revision || expectedReport?.sourceKey !== state.sourceKey;
      const stageHelp = state.project.stage < 7 ? '보고서 단계(7)에서 고객 의견 처리를 마치고 최신 보고서를 보관한 뒤 시작해 주세요.'
        : state.project.stage > 8 ? '후속 단계에서는 검증 기록을 조회할 수 있어요.' : '';
      readiness.textContent = state.warning || stageHelp || state.startBlock || (stale ? '입력 중 검증 기록이나 보고서가 바뀌었어요. 검증 기준을 다시 확인해 주세요.'
        : first ? '준비됐어요. 검증기관·담당자를 기록하고 시작할 수 있어요.' : `현재 ${state.round.number}차의 등록 지적이 모두 종결됐어요. 검토 완료를 확인한 뒤 다음 차수를 시작할 수 있어요.`);
      readiness.hidden = false;
      basis.textContent = `검증 시작 기준: ${state.latest ? `최신 보고서 v${state.latest.revision} · ${state.latest.title}` : '보관된 보고서 없음'} · 미종결 고객 의견 ${state.unresolvedCustomers.length}건${state.round ? ` · 현재 ${state.round.number}차 미종결 지적 ${state.unresolved.length}건` : ''}`;
      toCustomers.disabled = busy; toReport.disabled = busy || !state.latest;
      selectedRound.replaceChildren();
      for (const round of state.record.rounds.slice().reverse()) option(selectedRound, round.number === state.round.number ? 'latest' : String(round.number), `${round.number}차 · 보고서 v${round.reportRevision}`);
      if (roundChoice !== 'latest' && !state.record.rounds.some((round) => String(round.number) === roundChoice)) roundChoice = 'latest';
      selectedRound.value = roundChoice; selectedRound.disabled = busy || first; statusFilter.disabled = busy || first;
      const selected = roundChoice === 'latest' ? state.round : state.record.rounds.find((r) => String(r.number) === roundChoice);
      roundInfo.replaceChildren();
      if (selected) {
        roundInfo.append(text('h3', '', `${selected.number}차 · 보고서 v${selected.reportRevision}`), text('p', 'detail-help', `${selected.organization} · 검증자 ${selected.verifier} · 기록자 ${selected.actor} · ${date(selected.createdAt)}`));
        if (selected.note) roundInfo.append(text('p', 'interpretation-text', selected.note));
        const open = text('button', 'request-action-button', `${selected.number}차에 검토한 보고서 v${selected.reportRevision} 보기`); open.type = 'button'; open.disabled = busy;
        open.addEventListener('click', () => onOpenReport(selected.reportRevision)); roundInfo.append(open);
        if (selected !== state.round) roundInfo.append(text('p', 'detail-help', '이전 차수는 읽기 전용이에요. 추가 지적은 현재 차수에 기록해 주세요.'));
      } else roundInfo.append(text('p', 'detail-help', '아직 저장한 검증 차수가 없어요. 위에서 첫 차수를 시작해 주세요.'));
      const own = state.issues.filter((item) => item.round === selected?.number);
      const visible = own.filter((item) => !statusFilter.value || item.status === statusFilter.value);
      counts.textContent = `${selected ? `${selected.number}차` : '전체'} ${own.length}건 · ${LCA.verification.STATUSES.map((status) => `${status} ${own.filter((item) => item.status === status).length}건`).join(' · ')} · ${visible.length}건 표시`;
      for (const item of state.issues) {
        if (!cards.has(item.id)) cards.set(item.id, LCA.views.verificationIssue.create(project, item, () => state, run, onOpenReport));
        cards.get(item.id).update(item, state);
      }
      list.replaceChildren(...visible.slice().reverse().map((item) => cards.get(item.id).element));
      if (!visible.length) list.append(text('p', 'detail-help', own.length ? '선택한 상태의 지적이 없어요. 다른 상태도 확인해 주세요.' : '아직 이 차수에 등록한 지적이 없어요.'));
      issueEditor.hidden = !!state.round && selected?.number !== state.round.number;
      issueTitle.textContent = state.round ? `${state.round.number}차 검증 지적 등록 · 검토 보고서 v${state.round.reportRevision}` : '검증 지적 등록';
      issueFields.disabled = busy || !state.canWrite; issueSave.disabled = issueFields.disabled; issueReload.disabled = busy || !state.round;
    }
    roundForm.addEventListener('input', () => { roundDirty = true; roundError.textContent = ''; });
    roundForm.addEventListener('change', () => { roundDirty = true; });
    issueForm.addEventListener('input', () => { issueDirty = true; issueError.textContent = ''; });
    rebase.addEventListener('click', () => {
      const latest = store.load(project.id); if (!latest.ok) { refresh(); return; }
      adoptRound(latest); roundDirty = true; feedback.textContent = '입력은 유지하고 최신 보고서·검증 기록으로 기준을 바꿨어요. 확인 체크 후 시작해 주세요.'; refresh();
    });
    issueReload.addEventListener('click', () => {
      const latest = store.load(project.id); if (!latest.ok) { refresh(); return; }
      issueRevision = latest.record.revision; issueDirty = true; issueError.textContent = ''; feedback.textContent = '지적 입력은 유지하고 현재 차수의 최신 기록을 확인했어요.'; refresh();
    });
    roundForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const draft = { organization: organization.value, verifier: verifier.value, actor: actor.value, note: note.value, confirmed: confirmed.checked };
      const result = await run('round', draft, roundRevision, expectedReport); if (!result) return;
      roundError.textContent = result.error || '';
      if (result.ok) {
        roundDirty = false; confirmed.checked = false; note.value = ''; roundChoice = 'latest'; statusFilter.value = '';
        feedback.textContent = `${result.record.rounds.length}차 검증을 시작했어요. 이번 차수에 받은 지적을 아래에 기록해 주세요.`; refresh(); feedback.tabIndex = -1; feedback.focus();
      } else { roundError.tabIndex = -1; roundError.focus(); }
    });
    issueForm.addEventListener('submit', async (event) => {
      event.preventDefault(); const draft = { content: content.value, dueDate: due.value, actor: recorder.value };
      const result = await run('issue', draft, issueRevision); if (!result) return;
      issueError.textContent = result.error || '';
      if (result.ok) {
        issueDirty = false; content.value = ''; due.value = ''; roundChoice = 'latest'; statusFilter.value = ''; refresh();
        const card = cards.get(result.record.issues.at(-1).id); card.element.focus({ preventScroll: true }); card.element.scrollIntoView({ block: 'start' });
      } else { issueError.tabIndex = -1; issueError.focus(); }
    });
    selectedRound.addEventListener('change', () => { roundChoice = selectedRound.value; refresh(); }); statusFilter.addEventListener('change', refresh);
    toReport.addEventListener('click', () => { if (state.latest) onOpenReport(state.latest.revision); });
    refreshCurrent = refresh; refresh();
  }
  return { init, refresh: () => refreshCurrent() };
})();
