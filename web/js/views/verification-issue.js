window.LCA = window.LCA || {};
LCA.views = LCA.views || {};
LCA.views.verificationIssue = (() => {
  function text(tag, className, value) {
    const node = document.createElement(tag); node.className = className; node.textContent = value; return node;
  }
  function field(parent, id, label, type = 'input', limit = 100) {
    const box = text('div', 'interpretation-field', ''); const caption = text('label', '', label); caption.htmlFor = id;
    const input = document.createElement(type); input.id = id;
    if (type === 'input') input.type = 'text';
    if (type !== 'select') input.maxLength = limit;
    if (type === 'textarea') input.rows = 3;
    box.append(caption, input); parent.append(box); return input;
  }
  function option(select, value, label) {
    const node = document.createElement('option'); node.value = value; node.textContent = label; select.append(node);
  }
  const date = (value) => new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Seoul' }).format(new Date(value));
  function create(project, issue, getState, run, onOpenReport) {
    const element = text('article', 'customer-review-card verification-issue', ''); element.tabIndex = -1;
    const heading = text('h3', '', ''); const meta = text('p', 'detail-help', ''); const deadline = text('p', 'detail-note', '');
    element.append(heading, meta, deadline, text('h4', '', '검증자가 남긴 지적'), text('p', 'interpretation-text', issue.content));
    const open = text('button', 'request-action-button', `검토한 보고서 v${issue.reportRevision} 보기`); open.type = 'button'; open.addEventListener('click', () => onOpenReport(issue.reportRevision)); element.append(open);
    const form = document.createElement('form'); form.noValidate = true;
    const fields = document.createElement('fieldset'); fields.className = 'calculation-fields'; fields.append(text('legend', '', `${issue.id} 답변`));
    const reply = field(fields, `${issue.id}-reply`, '보완 내용·담당자 답변 (필수)', 'textarea', 3000);
    const actor = field(fields, `${issue.id}-actor`, '답변 담당자 (필수)');
    actor.value = project.researcherName || ''; LCA.views.inputAssist.person(actor, project);
    const resolution = field(fields, `${issue.id}-resolution`, '지적 처리 방법', 'select');
    for (const [key, label] of Object.entries(LCA.verification.RESOLUTIONS)) option(resolution, key, label);
    const applied = field(fields, `${issue.id}-applied`, '수정한 보고서 버전', 'select');
    const save = text('button', 'primary-button', '지적 답변 저장'); save.type = 'submit';
    form.append(fields, text('p', 'detail-help', '답변만 먼저 남길 때는 처리 방법 미정으로 저장해요. 보고서를 고쳤다면 보고서 탭에서 새 버전을 보관한 뒤 선택해 주세요.'), save);
    const openApplied = text('button', 'request-action-button', '수정 보고서 보기'); openApplied.type = 'button';
    const processing = text('div', 'verification-processing', '');
    const processor = field(processing, `${issue.id}-processor`, '종결·재개 기록 담당자 (필수)'); processor.value = project.researcherName || '';
    LCA.views.inputAssist.person(processor, project);
    const closeFields = text('div', '', ''); const reason = field(closeFields, `${issue.id}-close-reason`, '검증자 확인·종결 근거 (필수)', 'textarea', 1000);
    const confirmedLabel = text('label', 'calculation-confirmation', ''); const confirmed = document.createElement('input'); confirmed.type = 'checkbox';
    confirmedLabel.append(confirmed, document.createTextNode('저장한 답변·처리 내용을 검증자가 확인한 근거를 남겼고 이 지적을 종결할게요.'));
    const close = text('button', 'request-action-button', '지적 종결'); close.type = 'button'; closeFields.append(confirmedLabel, close);
    const reopenFields = text('div', '', ''); const reopenReason = field(reopenFields, `${issue.id}-reopen-reason`, '지적 재개 사유 (필수)', 'textarea', 1000);
    const reopen = text('button', 'request-action-button', '지적 다시 열기'); reopen.type = 'button'; reopenFields.append(reopen);
    processing.append(closeFields, reopenFields);
    const message = text('p', 'field-error', ''); message.setAttribute('role', 'alert');
    const notice = text('p', 'detail-help', ''); notice.setAttribute('role', 'status');
    const adopt = text('button', 'request-action-button', '최신 답변 불러오기 · 입력 초기화'); adopt.type = 'button';
    const timeline = document.createElement('details'); timeline.append(text('summary', '', '지적 처리 이력 펼쳐보기'));
    const events = text('ol', 'customer-review-events', ''); timeline.append(events);
    element.append(form, openApplied, processing, message, notice, adopt, timeline);
    let current = issue; let expected = issue.revision; let dirty = false; let responseDirty = false;
    function fill(item) {
      reply.value = item.reply; actor.value = item.responder || project.researcherName || ''; resolution.value = item.resolution;
      applied.value = item.appliedReportRevision === null ? '' : String(item.appliedReportRevision);
      reason.value = ''; reopenReason.value = ''; confirmed.checked = false; expected = item.revision; dirty = false; responseDirty = false;
    }
    async function perform(action) {
      if (action === 'closed' && responseDirty) { message.textContent = '작성 중인 답변을 먼저 저장한 뒤 종결해 주세요.'; return; }
      const draft = { issueId: issue.id, expectedIssueRevision: expected, actor: action === 'replied' ? actor.value : processor.value,
        reply: reply.value, resolution: resolution.value, appliedReportRevision: Number(applied.value), confirmed: confirmed.checked,
        reason: action === 'closed' ? reason.value : reopenReason.value };
      message.textContent = '';
      const result = await run(action, draft, getState().record.revision);
      if (!result) return;
      if (result.ok) {
        const saved = result.record.issues.find((item) => item.id === issue.id); fill(LCA.reviewWorkflow.current(saved)); notice.textContent = '지적 처리 기록을 저장했어요.';
      } else { message.textContent = result.error; message.tabIndex = -1; message.focus(); }
      update(current, getState());
    }
    form.addEventListener('submit', (event) => { event.preventDefault(); perform('replied'); });
    close.addEventListener('click', () => perform('closed')); reopen.addEventListener('click', () => perform('reopened'));
    fields.addEventListener('input', () => { dirty = true; responseDirty = true; confirmed.checked = false; });
    fields.addEventListener('change', () => { dirty = true; responseDirty = true; confirmed.checked = false; update(current, getState()); });
    processing.addEventListener('input', () => { dirty = true; });
    confirmed.addEventListener('change', () => update(current, getState()));
    adopt.addEventListener('click', () => { fill(current); update(current, getState()); notice.textContent = '최신 답변을 불러왔어요.'; });
    openApplied.addEventListener('click', () => { if (current.appliedReportRevision !== null) onOpenReport(current.appliedReportRevision); });
    function update(item, state) {
      current = item;
      const previous = applied.value; applied.replaceChildren(); option(applied, '', '수정 보고서 선택');
      for (const report of state.reports.filter((v) => v.revision > item.reportRevision)) option(applied, String(report.revision), `v${report.revision} · ${report.title}`);
      if (previous && !Array.from(applied.options).some((item) => item.value === previous)) option(applied, previous, `v${previous} · 보관본 확인 필요`);
      applied.value = previous;
      if (!dirty && expected !== item.revision) fill(item);
      heading.textContent = `${item.id} · ${item.round}차 · ${item.status}`;
      meta.textContent = `등록 ${item.events[0].actor} · ${date(item.createdAt)} · 최근 처리 ${date(item.updatedAt)}`;
      const due = item.status === '종결' ? '종결' : LCA.deadlines.refresh({ date: item.dueDate, status: null }).text;
      deadline.textContent = `보완 기한 ${item.dueDate} · ${due}`;
      const writable = state.canWrite && item.round === state.round?.number && !state.busy;
      fields.disabled = !writable || item.status === '종결'; save.disabled = fields.disabled;
      applied.parentElement.hidden = resolution.value !== 'report'; applied.disabled = resolution.value !== 'report';
      processing.hidden = item.round !== state.round?.number;
      processor.disabled = !writable; reason.disabled = !writable; reopenReason.disabled = !writable;
      closeFields.hidden = item.status === '종결'; reopenFields.hidden = item.status !== '종결';
      confirmed.disabled = !writable || responseDirty || item.status !== '답변됨';
      close.disabled = !writable || responseDirty || item.status !== '답변됨' || item.resolution === 'pending' || !confirmed.checked;
      reopen.disabled = !writable;
      open.disabled = state.busy; openApplied.hidden = item.appliedReportRevision === null; openApplied.disabled = state.busy;
      openApplied.textContent = `수정한 보고서 v${item.appliedReportRevision} 보기`;
      adopt.hidden = expected === item.revision; adopt.disabled = state.busy;
      if (!adopt.hidden) notice.textContent = '이 지적의 최신 처리 기록이 달라요. 입력을 유지했으니 최신 답변을 확인해 주세요.';
      LCA.views.inputAssist.sync(element);
      events.replaceChildren();
      const names = { created: '지적 등록', replied: '답변 저장', closed: '지적 종결', reopened: '지적 재개' };
      for (const event of item.events) {
        const row = text('li', '', ''); row.append(text('strong', '', `${names[event.type]} · ${event.actor} · ${date(event.at)}`));
        if (event.reply) row.append(text('p', 'interpretation-text', event.reply), text('p', 'detail-help', `${LCA.verification.RESOLUTIONS[event.resolution]}${event.appliedReportRevision === null ? '' : ` · 수정 보고서 v${event.appliedReportRevision}`}`));
        if (event.reason) row.append(text('p', 'interpretation-text', `${event.type === 'closed' ? '검증자 확인·종결 근거' : '재개 사유'}: ${event.reason}`));
        events.append(row);
      }
    }
    update(issue, getState()); fill(issue); update(issue, getState());
    return { element, update };
  }
  return { text, field, option, date, create };
})();
