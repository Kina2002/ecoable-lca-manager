window.LCA = window.LCA || {};
LCA.views = LCA.views || {};
LCA.views.customerReview = (() => {
  let refreshCurrent = () => {}; let focusCurrent = () => {};
  function text(tag, className, value) {
    const node = document.createElement(tag); node.className = className; node.textContent = value; return node;
  }
  const date = (value) => new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Seoul' }).format(new Date(value));
  function option(select, value, label) {
    const node = document.createElement('option'); node.value = value; node.textContent = label; select.append(node);
  }
  function field(parent, id, label, type = 'input', limit = 100) {
    const box = text('div', 'interpretation-field', ''); const caption = text('label', '', label); caption.htmlFor = id;
    const input = document.createElement(type); input.id = id;
    if (type === 'input') input.type = 'text';
    if (type !== 'select') input.maxLength = limit;
    if (type === 'textarea') input.rows = 3;
    box.append(caption, input); parent.append(box); return input;
  }
  function init(project, store, onChanged, onOpenReport) {
    const host = document.querySelector('#project-comments-panel');
    const summary = text('section', 'detail-card calculation-card', '');
    summary.append(text('h2', '', '고객 검토 의견'), text('p', 'detail-help', '어느 보고서를 보고 받은 의견인지 기록하고, 답변과 수정한 버전을 연결해요. 답변은 담당자가 이곳에 기록하며 고객에게 자동 전송되지 않아요.'));
    const counts = text('p', 'customer-review-counts', ''); counts.setAttribute('role', 'status');
    const warning = text('p', 'calculation-notice', ''); warning.setAttribute('role', 'status'); summary.append(counts, warning);
    const register = text('section', 'detail-card calculation-card', ''); register.append(text('h2', '', '고객 의견 등록'));
    const form = document.createElement('form'); form.noValidate = true;
    const fields = document.createElement('fieldset'); fields.className = 'calculation-fields'; fields.append(text('legend', '', '의견을 받은 보고서와 내용'));
    const target = field(fields, 'comment-report', '의견 대상 보고서 (필수)', 'select');
    const content = field(fields, 'comment-content', '고객 의견 (필수)', 'textarea', 3000);
    const reviewer = field(fields, 'comment-reviewer', '의견을 준 고객 이름 (선택)');
    const recorder = field(fields, 'comment-recorder', '기록하는 담당자 (필수)'); recorder.value = project.researcherName || '';
    LCA.views.inputAssist.person(recorder, project);
    const save = text('button', 'primary-button', '고객 의견 등록'); save.type = 'submit';
    const feedback = text('p', '', ''); feedback.setAttribute('role', 'status');
    const error = text('p', 'field-error', ''); error.setAttribute('role', 'alert'); form.append(fields, save, error, feedback); register.append(LCA.views.compact.form(form, '고객 의견 입력'));
    const history = text('section', 'detail-card calculation-card', ''); history.append(text('h2', '', '의견·답변과 처리 이력'));
    const filters = text('div', 'report-version-selectors', '');
    const statusFilter = field(filters, 'comment-status-filter', '처리 상태', 'select'); option(statusFilter, '', '전체 상태');
    for (const status of LCA.customerReview.STATUSES) option(statusFilter, status, status);
    const reportFilter = field(filters, 'comment-report-filter', '의견 대상 보고서로 보기', 'select');
    const filterInfo = text('p', 'detail-help', '');
    const list = text('div', 'customer-review-list', ''); history.append(filters, filterInfo, list);
    host.replaceChildren(summary, register, history);
    let registering = false; let busyId = ''; let lastState; const cards = new Map();
    function reportOptions(select, reports, min = 0, placeholder = '선택해 주세요', defaultLatest = false) {
      const previous = select.value; select.replaceChildren(); option(select, '', placeholder);
      for (const report of reports.filter((item) => item.revision > min)) option(select, String(report.revision), `v${report.revision} · ${report.title}`);
      if (previous && Array.from(select.options).some((item) => item.value === previous)) select.value = previous;
      else if (previous) { option(select, previous, `v${previous} · 보관본 확인 필요`); select.value = previous; }
      else if (defaultLatest && reports.length) select.value = String(reports[0].revision);
    }
    function makeCard(item) {
      const element = text('article', 'customer-review-card', ''); element.tabIndex = -1; element.dataset.commentId = item.id;
      const heading = text('h3', '', ''); const meta = text('p', 'detail-help', '');
      element.append(heading, meta, text('h4', '', '처음 받은 고객 의견'), text('p', 'interpretation-text', item.content));
      const open = text('button', 'request-action-button', `의견 대상 보고서 v${item.reportRevision} 보기`); open.type = 'button'; open.addEventListener('click', () => onOpenReport(item.reportRevision));
      element.append(open);
      const response = document.createElement('form'); response.noValidate = true;
      const responseFields = document.createElement('fieldset'); responseFields.className = 'calculation-fields'; responseFields.append(text('legend', '', `${item.id} 담당자 답변`));
      const reply = field(responseFields, `${item.id}-reply`, '담당자 답변 (필수)', 'textarea', 3000);
      const actor = field(responseFields, `${item.id}-actor`, '답변·처리 담당자 (필수)');
      actor.value = project.researcherName || ''; LCA.views.inputAssist.person(actor, project);
      const resolution = field(responseFields, `${item.id}-resolution`, '처리 방법', 'select');
      for (const [key, label] of Object.entries(LCA.customerReview.RESOLUTIONS)) option(resolution, key, label);
      const applied = field(responseFields, `${item.id}-applied`, '수정 내용을 반영한 보고서', 'select');
      const appliedHelp = text('p', 'detail-help', `보고서를 수정했다면 v${item.reportRevision}보다 나중 버전을 먼저 저장하고 선택해 주세요. 답변만 먼저 저장할 때는 처리 방법 미정으로 둘 수 있어요.`);
      const openApplied = text('button', 'request-action-button', '반영한 보고서 보기'); openApplied.type = 'button';
      openApplied.addEventListener('click', () => { if (card.current.appliedReportRevision !== null) onOpenReport(card.current.appliedReportRevision); });
      const saveReply = text('button', 'primary-button', '답변 저장'); saveReply.type = 'submit';
      const status = text('p', 'detail-help', ''); status.setAttribute('role', 'status');
      const adopt = text('button', 'request-action-button', '최신 답변 불러오기 · 입력 초기화'); adopt.type = 'button'; adopt.hidden = true;
      response.append(responseFields, appliedHelp, openApplied, saveReply, status, adopt);
      const actions = text('div', 'customer-review-actions', '');
      const closeLabel = text('label', 'calculation-confirmation', ''); const confirmed = document.createElement('input'); confirmed.type = 'checkbox';
      closeLabel.append(confirmed, document.createTextNode('저장된 답변과 처리 내용을 확인했고 이 의견을 종결할게요.'));
      const close = text('button', 'request-action-button', '의견 종결'); close.type = 'button'; actions.append(closeLabel, close);
      const reopenBox = text('div', '', '');
      const reason = field(reopenBox, `${item.id}-reason`, '의견 재개 사유 (필수)', 'textarea', 1000);
      const reopenActor = field(reopenBox, `${item.id}-reopen-actor`, '다시 여는 담당자 (필수)'); reopenActor.value = project.researcherName || '';
      LCA.views.inputAssist.person(reopenActor, project);
      const reopen = text('button', 'request-action-button', '의견 다시 열기'); reopen.type = 'button'; reopenBox.append(reopen);
      const message = text('p', 'field-error', ''); message.setAttribute('role', 'alert');
      const timeline = document.createElement('details'); timeline.append(text('summary', '', '처리 이력 펼쳐보기'));
      const events = text('ol', 'customer-review-events', ''); timeline.append(events);
      element.append(response, actions, reopenBox, message, timeline);
      const card = { element, current: item, expectedRevision: item.revision, dirty: false };
      function fill(record) {
        reply.value = record.reply; actor.value = record.responder || project.researcherName || '';
        resolution.value = record.resolution; applied.value = record.appliedReportRevision === null ? '' : String(record.appliedReportRevision);
        card.expectedRevision = record.revision; card.dirty = false; confirmed.checked = false; reason.value = '';
      }
      async function perform(action) {
        if (busyId || registering) return;
        const draft = { actor: action === 'reopen' ? reopenActor.value : actor.value, reply: reply.value, resolution: resolution.value, appliedReportRevision: Number(applied.value), confirmed: confirmed.checked, reason: reason.value };
        if (action === 'close' && card.dirty) { message.textContent = '작성 중인 답변을 먼저 저장한 뒤 종결해 주세요.'; return; }
        busyId = item.id; message.textContent = ''; refresh();
        let result;
        try { result = await store[action](project.id, item.id, draft, card.expectedRevision); }
        catch { result = { ok: false, error: '의견 처리를 저장하지 못했어요. 입력 내용은 유지했어요.' }; }
        finally { busyId = ''; }
        if (result.ok) {
          fill(result.item); status.textContent = `${result.item.status} 상태로 저장했어요.`; onChanged();
        } else message.textContent = result.error;
        refresh();
        if (!result.ok) { message.tabIndex = -1; message.focus(); }
      }
      response.addEventListener('submit', (event) => { event.preventDefault(); perform('respond'); });
      close.addEventListener('click', () => perform('close')); reopen.addEventListener('click', () => perform('reopen'));
      responseFields.addEventListener('input', () => { card.dirty = true; confirmed.checked = false; message.textContent = ''; });
      responseFields.addEventListener('change', () => { card.dirty = true; confirmed.checked = false; message.textContent = ''; update(card.current, lastState); });
      reopenBox.addEventListener('input', () => { card.dirty = true; message.textContent = ''; });
      adopt.addEventListener('click', () => { fill(card.current); status.textContent = '최신 답변을 불러왔어요.'; update(card.current, lastState); });
      function update(record, state) {
        card.current = record;
        reportOptions(applied, state.reports, record.reportRevision, '반영한 버전 선택');
        if (!card.dirty && card.expectedRevision !== record.revision) fill(record);
        heading.textContent = `${record.id} · ${record.status} · 보고서 v${record.reportRevision} 의견`;
        meta.textContent = `${record.reviewer || '고객 이름 미기록'} · 기록자 ${record.events[0].actor} · ${date(record.createdAt)} · 최근 처리 ${date(record.updatedAt)}`;
        const busy = Boolean(busyId) || registering; const writable = state.canWrite && !busy;
        responseFields.disabled = !writable || record.status === '종결'; saveReply.disabled = responseFields.disabled;
        applied.parentElement.hidden = resolution.value !== 'report'; applied.disabled = resolution.value !== 'report';
        openApplied.hidden = record.appliedReportRevision === null; openApplied.disabled = busy;
        openApplied.textContent = `반영한 보고서 v${record.appliedReportRevision} 보기`;
        actions.hidden = record.status === '종결'; reopenBox.hidden = record.status !== '종결';
        close.disabled = !writable || record.status !== '답변됨' || record.resolution === 'pending' || card.dirty || !confirmed.checked;
        confirmed.disabled = !writable || record.status !== '답변됨' || card.dirty;
        reopen.disabled = !writable; reason.disabled = !writable; reopenActor.disabled = !writable;
        adopt.hidden = card.expectedRevision === record.revision; adopt.disabled = busy;
        if (!adopt.hidden) status.textContent = '다른 화면에서 처리 기록이 바뀌었어요. 현재 입력은 유지했고 저장 시 충돌을 확인해요.';
        LCA.views.inputAssist.sync(element);
        events.replaceChildren();
        const names = { created: '의견 등록', replied: '답변 저장', closed: '종결', reopened: '다시 열기' };
        for (const event of record.events) {
          const row = text('li', '', ''); row.append(text('strong', '', `${names[event.type]} · ${event.actor} · ${date(event.at)}`));
          if (event.reply) row.append(text('p', 'interpretation-text', event.reply), text('p', 'detail-help', `${LCA.customerReview.RESOLUTIONS[event.resolution]}${event.appliedReportRevision === null ? '' : ` · 보고서 v${event.appliedReportRevision}`}`));
          if (event.reason) row.append(text('p', 'interpretation-text', `재개 사유: ${event.reason}`));
          events.append(row);
        }
      }
      confirmed.addEventListener('change', () => update(card.current, lastState));
      card.update = update; reportOptions(applied, lastState.reports, item.reportRevision); fill(item); return card;
    }
    function refresh() {
      const state = store.list(project.id); lastState = state;
      fields.disabled = registering || !!busyId || !state.ok || !state.canWrite || !state.reports.length;
      LCA.views.inputAssist.sync(host);
      save.disabled = fields.disabled;
      if (!state.ok) { warning.textContent = state.error; counts.textContent = ''; for (const card of cards.values()) card.element.querySelectorAll('button, input, textarea, select').forEach((node) => { node.disabled = true; }); return; }
      const countsByStatus = LCA.customerReview.STATUSES.map((status) => `${status} ${state.items.filter((item) => item.status === status).length}건`);
      counts.textContent = `전체 ${state.items.length}건 · ${countsByStatus.join(' · ')}`;
      warning.textContent = state.warning || (state.project.stage < 7 ? '보고서 단계(7)에서 보관한 보고서에 의견을 등록할 수 있어요.'
        : state.project.stage > 7 ? '후속 단계에서는 보관한 의견을 조회할 수 있어요.' : !state.reports.length ? '보고서 탭에서 첫 버전을 저장한 뒤 의견을 등록해 주세요.' : '');
      warning.hidden = !warning.textContent;
      reportOptions(target, state.reports, 0, '의견을 받은 버전 선택', true);
      reportOptions(reportFilter, state.reports, 0, '전체 보고서 버전');
      const visible = state.items.filter((item) => (!statusFilter.value || item.status === statusFilter.value) && (!reportFilter.value || String(item.reportRevision) === reportFilter.value));
      for (const item of state.items) {
        if (!cards.has(item.id)) cards.set(item.id, makeCard(item));
        cards.get(item.id).update(item, state);
      }
      list.replaceChildren(...visible.map((item) => cards.get(item.id).element));
      filterInfo.textContent = `${visible.length} / ${state.items.length}건 표시${visible.length < state.items.length ? ' · 다른 의견은 선택한 조건으로 숨겨져 있어요.' : ''}`;
      if (!visible.length) list.append(text('p', 'detail-help', state.items.length ? '선택한 조건의 의견이 없어요.' : '아직 등록한 고객 의견이 없어요.'));
    }
    form.addEventListener('submit', async (event) => {
      event.preventDefault(); if (registering || busyId) return;
      const draft = { reportRevision: Number(target.value), content: content.value, reviewer: reviewer.value, actor: recorder.value };
      registering = true; error.textContent = ''; refresh();
      let result;
      try { result = await store.create(project.id, draft); }
      catch { result = { ok: false, error: '고객 의견을 저장하지 못했어요. 입력 내용은 유지했어요.' }; }
      finally { registering = false; }
      if (result.ok) {
        content.value = ''; reviewer.value = ''; feedback.textContent = `${result.item.id} 의견을 등록했어요.`;
        statusFilter.value = ''; reportFilter.value = ''; onChanged();
      } else error.textContent = result.error;
      refresh();
      if (result.ok) focusCurrent(result.item.id); else { error.tabIndex = -1; error.focus(); }
    });
    statusFilter.addEventListener('change', refresh); reportFilter.addEventListener('change', refresh);
    refreshCurrent = refresh;
    focusCurrent = (id) => {
      statusFilter.value = ''; reportFilter.value = ''; refresh();
      const card = cards.get(id);
      if (card) { card.element.focus({ preventScroll: true }); card.element.scrollIntoView({ block: 'start' }); }
      else { feedback.textContent = '연결한 고객 의견을 찾을 수 없어요.'; feedback.tabIndex = -1; feedback.focus(); }
    };
    refresh();
  }
  return { init, refresh: () => refreshCurrent(), focus: (id) => focusCurrent(id) };
})();
