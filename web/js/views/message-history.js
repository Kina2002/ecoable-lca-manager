window.LCA = window.LCA || {};
LCA.views = LCA.views || {};
LCA.views.messageHistory = (() => {
  const text = (tag, cls, value) => { const node = document.createElement(tag); node.className = cls; node.textContent = value; return node; };
  function init(editor, section, projectId, store, getMessage) {
    const form = document.createElement('form'); form.noValidate = true;
    form.append(text('p', 'detail-help', '메일·메신저에서 실제로 보낸 뒤 기록해 주세요. 이 버튼은 발송 사실만 저장해요.'));
    const fields = text('fieldset', 'calculation-fields', '');
    function input(key, label, tag = 'input') {
      const box = text('div', 'interpretation-field', ''); const caption = text('label', '', label); caption.htmlFor = `message-sent-${key}`;
      const node = document.createElement(tag); node.id = caption.htmlFor; if (tag === 'input') node.type = 'text'; box.append(caption, node); fields.append(box); return node;
    }
    const recipient = input('recipient', '실제 받는 사람 (이름·이메일 등 · 필수)'); recipient.maxLength = 500;
    const channel = input('channel', '보낸 방법', 'select'); for (const value of LCA.messageHistory.CHANNELS) { const option = text('option', '', value); option.value = value; channel.append(option); }
    const day = input('date', '보낸 날짜 (한국 시간 · 필수)'); day.maxLength = 10; day.inputMode = 'numeric'; day.placeholder = '예: 20261019';
    day.addEventListener('input', () => { day.value = LCA.requests.formatDateInput(day.value); }); LCA.views.inputAssist.date(day);
    const time = input('time', '보낸 시각 (한국 시간 · 필수)'); time.type = 'time';
    const actor = input('actor', '기록 담당자 (필수)'); actor.maxLength = 100;
    const confirmation = text('label', 'request-message-check', ''); const confirmed = document.createElement('input'); confirmed.type = 'checkbox';
    confirmation.append(confirmed, document.createTextNode('화면의 제목·본문을 실제로 보냈고, 받는 사람과 시각을 확인했어요.')); fields.append(confirmation);
    const save = text('button', 'request-action-button', '보냈어요 · 발송 기록 저장'); save.type = 'submit';
    const feedback = text('p', 'request-feedback', ''); feedback.setAttribute('role', 'status'); form.append(fields, save, feedback); editor.append(LCA.views.compact.form(form, '실제로 보낸 요청문 기록'));
    const history = text('details', 'request-message-history', ''); const heading = text('summary', '', '보낸 요청문 기록'); const list = text('div', '', ''); history.append(heading, list); section.append(history);
    let state = null; let busy = false;
    function sync() {
      const draft = getMessage(); const duplicate = state?.ok && draft && state.items.some((item) => item.token === draft.token);
      fields.disabled = busy || !draft || duplicate; save.disabled = fields.disabled || !state?.ok || !confirmed.checked || draft?.busy;
      if (duplicate) feedback.textContent = '이 요청문은 이미 기록했어요. 추가 발송은 요청문을 새로 만든 뒤 별도로 기록해 주세요.';
      LCA.views.inputAssist.sync(form);
    }
    function refresh() {
      state = store.messages(projectId); list.replaceChildren();
      if (!state.ok) { heading.textContent = '보낸 요청문 기록 · 확인 필요'; list.append(text('p', 'field-error', state.message || state.error)); sync(); return; }
      heading.textContent = `보낸 요청문 기록 ${state.items.length}건`;
      const date = (value) => new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Seoul' }).format(new Date(value));
      for (const item of state.items.slice().sort((a, b) => b.sentAt.localeCompare(a.sentAt) || b.id.localeCompare(a.id))) {
        const row = text('details', 'customer-review-event', ''); row.append(text('summary', '', `${date(item.sentAt)} · ${LCA.requestMessage.TYPES[item.type] || item.type} · ${item.recipient}`));
        row.append(text('p', 'detail-help', `${item.id} · ${item.channel} · 기록자 ${item.actor} · 기록 시각 ${date(item.recordedAt)} (한국 시간)`),
          text('p', 'detail-help', `보낸 당시 ${item.companyName} · ${item.productName} · 대상 ${item.targets.join(', ')}`), text('strong', '', item.title), text('pre', 'message-history-body', item.body));
        if (item.basisChanged) row.append(text('p', 'detail-help', '발송 기록 시점의 최신 업무 정보와 보낸 당시 초안의 기준이 달랐어요. 실제 보냈다고 확인한 문구를 보관했어요.'));
        list.append(row);
      }
      if (!state.items.length) list.append(text('p', 'detail-help', '아직 보냈다고 기록한 요청문이 없어요.'));
      sync();
    }
    function newMessage(current) {
      recipient.value = current.project.customerContactName || ''; actor.value = current.sender?.name || current.project.researcherName || '';
      day.value = LCA.rules.today(); time.value = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Seoul' }).format(new Date());
      confirmed.checked = false; feedback.textContent = ''; refresh();
    }
    confirmed.addEventListener('change', sync);
    form.addEventListener('submit', async (event) => {
      event.preventDefault(); const draft = getMessage(); if (busy || !draft || !state?.ok) return;
      const sentAt = LCA.messageHistory.sentTime(day.value, time.value);
      if (!sentAt) { feedback.textContent = '보낸 날짜와 시각을 확인해 주세요.'; return; }
      const revision = state.revision; busy = true; sync();
      const result = await store.recordMessage(projectId, { ...draft, sentAt, recipient: recipient.value.trim(), channel: channel.value,
        actor: actor.value.trim(), confirmed: confirmed.checked }, revision);
      busy = false; feedback.textContent = result.ok ? '발송 당시 제목·본문과 받는 사람·시각을 보관했어요. 자료 상태는 그대로예요.' : result.message || result.error;
      if (result.ok) { confirmed.checked = false; history.open = true; }
      refresh(); feedback.tabIndex = -1; feedback.focus();
    });
    return { refresh, newMessage, sync };
  }
  return { init };
})();
