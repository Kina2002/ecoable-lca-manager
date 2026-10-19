window.LCA = window.LCA || {};
LCA.views = LCA.views || {};
LCA.views.opinions = (() => {
  let refreshCurrent = () => {}; let focusCurrent = () => {}; let selectCurrent = () => {};
  const text = (tag, cls, value) => { const n = document.createElement(tag); n.className = cls; n.textContent = value; return n; };
  function option(select, value, name) { const n = text('option', '', name); n.value = value; select.append(n); }
  function field(host, id, label, kind = 'input', max = 100) {
    const box = text('div', 'interpretation-field', ''); const caption = text('label', '', label); caption.htmlFor = id;
    const input = document.createElement(kind); input.id = id;
    if (kind !== 'select') input.maxLength = max;
    if (kind === 'input') input.type = 'text'; if (kind === 'textarea') input.rows = 2;
    box.append(caption, input); host.append(box); return input;
  }
  function button(label) { const n = text('button', 'request-action-button', label); n.type = 'button'; return n; }
  const date = (v) => new Intl.DateTimeFormat('ko-KR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Seoul' }).format(new Date(v));
  function init(project, store, getState, onOpen) {
    const host = document.querySelector('#project-opinions-panel'); const cards = new Map(); let busy = false; let state;
    const intro = text('section', 'detail-card', ''); intro.append(text('h2', '', '질문·의견 모아 보기'), text('p', 'detail-help', '자료 질의·고객 의견·검증 지적을 함께 확인해요. 자료 답변을 기록해도 자료가 제출되거나 승인되지는 않아요. 실제 수정 자료는 자료 요청에서 별도로 기록해 주세요.'));
    const error = text('p', 'form-error', ''); error.setAttribute('role', 'alert'); const notice = text('p', 'detail-help', ''); intro.append(error, notice);
    const form = document.createElement('form'); form.noValidate = true;
    const target = field(form, 'inquiry-request', '질문할 자료', 'select');
    const content = field(form, 'inquiry-content', '고객에게 확인할 질문', 'textarea', 3000);
    const actor = field(form, 'inquiry-actor', '기록 담당자'); actor.value = project.researcherName || ''; LCA.views.inputAssist.person(actor, project);
    const save = button('자료 질의 등록'); save.type = 'submit';
    const feedback = text('p', 'request-feedback', ''); feedback.setAttribute('role', 'status'); form.append(save, feedback);
    const register = text('section', 'detail-card', ''); register.append(LCA.views.compact.form(form, '자료 질의 등록하기'));
    const history = text('section', 'detail-card', ''); const controls = text('div', 'opinion-controls', '');
    const type = field(controls, 'opinion-kind', '종류', 'select'); for (const [v, n] of [['', '전체 종류'], ['inquiry', '자료 질의'], ['comment', '고객 의견'], ['verification', '검증 지적']]) option(type, v, n);
    const status = field(controls, 'opinion-status', '상태', 'select'); for (const v of ['', '열림', '답변됨', '종결']) option(status, v, v || '전체 상태');
    const latest = button('최신 기록 확인'); const count = text('p', 'detail-help', ''); count.setAttribute('role', 'status');
    const list = text('div', 'opinion-list', ''); history.append(controls, latest, count, list); host.replaceChildren(intro, register, history);
    function read() { try { return getState(); } catch { return { ok: false, error: '질문·의견 기록을 읽지 못했어요. 기존 입력은 유지했어요.' }; } }
    function makeCard(item) {
      const box = text('details', 'opinion-card', ''); box.dataset.inquiryId = item.id;
      const heading = text('summary', '', ''); const meta = text('p', 'detail-help', '');
      box.append(heading, meta, text('p', 'interpretation-text', item.content), text('p', 'detail-help', `질문 당시 요청: ${item.target.detail}`));
      const open = button('자료 요청에서 확인'); open.addEventListener('click', () => onOpen('requests', item.requestId)); box.append(open);
      const edit = document.createElement('form'); edit.noValidate = true;
      const recorder = field(edit, `${item.id}-actor`, '답변·처리 기록자'); recorder.value = project.researcherName || ''; LCA.views.inputAssist.person(recorder, project);
      const reply = field(edit, `${item.id}-reply`, '고객에게 받은 답변·확인 내용', 'textarea', 3000);
      const outcome = field(edit, `${item.id}-outcome`, '처리 방법', 'select'); for (const [v, n] of Object.entries(LCA.inquiries.OUTCOMES)) option(outcome, v, n);
      const note = field(edit, `${item.id}-note`, '종결 근거 또는 재개 사유', 'textarea', 1000);
      const confirmedLabel = text('label', 'calculation-confirmation', ''); const confirmed = document.createElement('input'); confirmed.type = 'checkbox'; confirmedLabel.append(confirmed, document.createTextNode('저장된 답변과 해결 내용을 확인했어요.'));
      const actions = text('div', 'opinion-actions', ''); const answer = button('답변 저장'); const close = button('질의 종결'); const reopen = button('다시 열기'); const reload = button('최신 기록 불러오기');
      const message = text('p', 'form-error', ''); message.setAttribute('role', 'alert');
      actions.append(answer, close, reopen, reload); edit.append(confirmedLabel, actions, message); box.append(edit);
      const events = text('ol', 'opinion-events', ''); box.append(events);
      const card = { box, heading, meta, edit, recorder, reply, outcome, note, confirmed, answer, close, reopen, reload, message, events, expected: item.revision, current: item, busy: false };
      function adopt() { card.expected = card.current.revision; reply.value = card.current.reply; outcome.value = card.current.outcome; note.value = ''; confirmed.checked = false; message.textContent = ''; updateCard(card, card.current); }
      reload.addEventListener('click', adopt);
      async function act(action) {
        if (card.busy) return; card.busy = true; updateCard(card, card.current);
        let result; try { result = await store.recordInquiry(project.id, action, { actor: recorder.value, reply: reply.value, outcome: outcome.value, note: note.value, reason: note.value, confirmed: confirmed.checked }, item.id, card.expected); }
        catch { result = { ok: false, message: '질의를 저장하지 못했어요. 입력은 유지했어요.' }; }
        card.busy = false; if (!host.isConnected) return;
        if (result.ok) {
          card.expected = result.item.revision; card.current = { ...result.item, requestActive: true }; confirmed.checked = false; message.textContent = '';
          if (action === 'reopened') { reply.value = ''; outcome.value = 'pending'; note.value = ''; }
        }
        else message.textContent = result.message || result.error;
        refresh(); updateCard(card, card.current);
      }
      answer.addEventListener('click', () => act('answered')); close.addEventListener('click', () => act('closed')); reopen.addEventListener('click', () => act('reopened'));
      edit.addEventListener('submit', (e) => { e.preventDefault(); act('answered'); });
      reply.value = item.reply; outcome.value = item.outcome; return card;
    }
    function updateCard(card, item) {
      card.current = item;
      const category = LCA.constants.CATEGORIES.find((c) => c.key === item.target.categoryKey)?.name || item.target.categoryKey;
      card.heading.textContent = `자료 질의 · ${item.id} · ${item.requestId} ${category} · ${item.status}`;
      card.meta.textContent = `${date(item.updatedAt)}${item.requestActive ? '' : ' · 삭제/해당 없음 자료 · 이력 조회'}${item.status === '종결' ? ' · 종결됨' : ''}`;
      const stale = card.expected !== item.revision; const disabled = !state?.inquiries.canWrite || !item.requestActive || card.busy || stale;
      for (const input of card.edit.querySelectorAll('input, textarea, select, button')) input.disabled = disabled;
      card.reload.disabled = card.busy || !stale; card.reload.hidden = !stale;
      if (stale) card.message.textContent = '다른 화면에서 기록이 바뀌었어요. 작성 중인 글은 유지했으니 보관한 뒤 최신 기록을 불러와 주세요.';
      card.answer.hidden = card.close.hidden = item.status === '종결'; card.reopen.hidden = item.status !== '종결';
      card.close.disabled = disabled || item.status !== '답변됨' || item.outcome === 'pending';
      card.events.replaceChildren(...item.events.map((event) => text('li', '', `${date(event.at)} · ${event.actor} · ${{ created: '질문 등록', answered: '답변', closed: '종결', reopened: '재개' }[event.type]}${event.reply ? `: ${event.reply} (${LCA.inquiries.OUTCOMES[event.outcome]})` : event.note ? `: ${event.note}` : event.reason ? `: ${event.reason}` : ''}`)));
    }
    function refresh() {
      state = read(); error.textContent = state.ok ? [state.inquiries.warning, ...state.warnings].filter(Boolean).join(' ') : state.error || state.message;
      save.disabled = busy || !state.ok || !state.inquiries.canWrite || !state.requests.some((r) => !r.deletedAt && r.status !== '해당 없음');
      if (!state.ok) return;
      notice.textContent = !state.inquiries.canWrite ? '현재 단계에서는 자료 질의를 조회할 수 있어요. 고객 의견·검증 지적의 처리 조건은 원래 화면을 따라요.'
        : !state.requests.some((r) => !r.deletedAt && r.status !== '해당 없음') ? '질문을 연결할 자료 요청이 없어요. 자료 요청 탭에서 먼저 등록해 주세요.' : '';
      const previous = target.value; target.replaceChildren(); option(target, '', '자료를 선택해 주세요');
      for (const r of state.requests.filter((r) => !r.deletedAt && r.status !== '해당 없음')) option(target, r.id, `${r.id} · ${LCA.constants.CATEGORIES.find((c) => c.key === r.categoryKey)?.name || r.categoryKey}`);
      if (previous && ![...target.options].some((o) => o.value === previous)) option(target, previous, `${previous} · 현재 선택 불가`);
      target.value = previous;
      const all = [...state.inquiries.items.map((item) => ({ kind: 'inquiry', item })), ...state.comments.map((item) => ({ kind: 'comment', item })), ...state.issues.map((item) => ({ kind: 'verification', item }))];
      all.sort((a, b) => b.item.updatedAt.localeCompare(a.item.updatedAt));
      const visible = all.filter((row) => (!type.value || row.kind === type.value) && (!status.value || row.item.status === status.value));
      const focus = list.contains(document.activeElement) ? document.activeElement : null; const nodes = [];
      for (const row of visible) {
        if (row.kind === 'inquiry') { let card = cards.get(row.item.id); if (!card) { card = makeCard(row.item); cards.set(row.item.id, card); } updateCard(card, row.item); nodes.push(card.box); }
        else {
          const card = text('article', 'opinion-card', ''); const item = row.item;
          card.append(text('strong', '', `${row.kind === 'comment' ? '고객 의견' : `${item.round}차 검증 지적`} · ${item.id} · ${item.status}`), text('p', 'detail-help', `보고서 v${item.reportRevision} · ${date(item.updatedAt)}`), text('p', 'interpretation-text', item.content));
          if (item.reply) card.append(text('p', 'interpretation-text', `저장된 답변: ${item.reply}`));
          const open = button('원래 기록에서 답변·처리'); open.addEventListener('click', () => onOpen(row.kind === 'comment' ? 'comments' : 'verification', item.id)); card.append(open); nodes.push(card);
        }
      }
      if (!nodes.length) nodes.push(text('p', 'detail-help', '선택한 조건의 질문·의견이 없어요.'));
      list.replaceChildren(...nodes); if (focus?.isConnected) focus.focus({ preventScroll: true });
      count.textContent = `전체 ${all.length}건 중 ${visible.length}건 · 자료 질의 ${state.inquiries.items.length} · 고객 의견 ${state.comments.length} · 검증 지적 ${state.issues.length}`;
    }
    form.addEventListener('submit', async (event) => {
      event.preventDefault(); if (busy) return; busy = true; save.disabled = true;
      let result; try { result = await store.recordInquiry(project.id, 'create', { requestId: target.value, content: content.value, actor: actor.value }); }
      catch { result = { ok: false, message: '질의를 저장하지 못했어요. 입력은 유지했어요.' }; }
      busy = false; if (!host.isConnected) return;
      feedback.textContent = result.ok ? `${result.item.id} 질문을 등록했어요. 답변은 고객에게 받은 내용을 기록해 주세요.` : result.message || result.error;
      if (result.ok) content.value = ''; refresh(); if (result.ok) focusCurrent(result.item.id);
    });
    latest.addEventListener('click', refresh); type.addEventListener('change', refresh); status.addEventListener('change', refresh);
    refreshCurrent = refresh;
    focusCurrent = (id) => { type.value = ''; status.value = ''; refresh(); const card = cards.get(id); if (card) { card.box.open = true; card.heading.tabIndex = -1; card.heading.focus(); card.box.scrollIntoView({ block: 'center' }); } };
    selectCurrent = (id) => {
      refresh(); const valid = [...target.options].some((o) => o.value === id && !o.textContent.includes('선택 불가'));
      if (!content.value.trim() || target.value === id) { if (valid) target.value = id; }
      else feedback.textContent = '작성 중인 다른 질문을 유지했어요. 먼저 등록하거나 내용을 보관한 뒤 질문할 자료를 바꿔 주세요.';
      form.closest('details').open = true; content.focus(); form.scrollIntoView({ block: 'start' });
    };
    refresh();
  }
  window.addEventListener('storage', () => refreshCurrent());
  return { init, refresh: () => refreshCurrent(), focus: (id) => focusCurrent(id), selectRequest: (id) => selectCurrent(id) };
})();
