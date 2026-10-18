window.LCA = window.LCA || {};
LCA.views = LCA.views || {};
LCA.views.requestMessage = (() => {
  let refreshCurrent = () => {};
  const text = (tag, cls, value) => { const node = document.createElement(tag); node.className = cls; node.textContent = value; return node; };
  function init(host, getState) {
    const section = text('details', 'request-message', ''); section.id = 'request-message';
    section.append(text('summary', '', '요청문 만들기'));
    const help = text('p', 'detail-help', '저장된 자료에서 항목을 골라 제목과 본문을 만들어요. 복사 전에 수정할 수 있고 자료 상태는 바뀌지 않아요.');
    const kindLabel = text('label', '', '요청문 종류'); kindLabel.htmlFor = 'request-message-kind';
    const kind = document.createElement('select'); kind.id = kindLabel.htmlFor;
    for (const [key, label] of Object.entries(LCA.requestMessage.TYPES)) { const option = text('option', '', label); option.value = key; kind.append(option); }
    const typeHelp = text('p', 'detail-help', ''); const choose = text('fieldset', 'request-message-choices', ''); choose.append(text('legend', '', '넣을 자료 선택'));
    const choices = text('div', 'request-message-options', ''); const selection = text('p', 'detail-help', '');
    function button(label) { const node = text('button', 'request-action-button', label); node.type = 'button'; return node; }
    const all = button('전체 선택'); const none = button('선택 해제'); const latest = button('최신 자료 다시 확인');
    const choiceActions = text('div', 'request-message-actions', ''); choiceActions.append(all, none, latest); choose.append(choiceActions, selection, choices);
    const overwriteLabel = text('label', 'request-message-check', ''); const overwrite = document.createElement('input'); overwrite.type = 'checkbox';
    overwriteLabel.append(overwrite, document.createTextNode('직접 수정한 글을 새 요청문으로 교체할게요.')); overwriteLabel.hidden = true;
    const generate = button('선택한 자료로 요청문 만들기'); generate.classList.add('primary-button');
    const feedback = text('p', 'request-feedback', ''); feedback.id = 'request-message-feedback'; feedback.setAttribute('role', 'status'); feedback.setAttribute('aria-live', 'polite');
    const editor = text('div', 'request-message-preview', ''); editor.hidden = true;
    const titleLabel = text('label', '', '메일 제목 (수정 가능)'); titleLabel.htmlFor = 'request-message-title';
    const title = document.createElement('input'); title.id = titleLabel.htmlFor; title.type = 'text'; title.maxLength = 500;
    const bodyLabel = text('label', '', '메일 본문 (수정 가능)'); bodyLabel.htmlFor = 'request-message-body';
    const body = document.createElement('textarea'); body.id = bodyLabel.htmlFor; body.rows = 15; body.maxLength = 40000;
    const warnings = text('p', 'request-message-warnings', ''); warnings.setAttribute('role', 'status');
    const copyTitle = button('제목 복사'); const copyBody = button('본문 복사'); const copyBoth = button('제목·본문 복사');
    const copyActions = text('div', 'request-message-actions', ''); copyActions.append(copyTitle, copyBody, copyBoth);
    const manual = text('div', 'request-message-manual', ''); manual.hidden = true;
    const manualLabel = text('label', '', '수동으로 복사할 내용'); manualLabel.htmlFor = 'request-message-manual-text';
    const manualText = document.createElement('textarea'); manualText.id = manualLabel.htmlFor; manualText.readOnly = true; manualText.rows = 5; manual.append(manualLabel, manualText);
    editor.append(titleLabel, title, bodyLabel, body, warnings, copyActions, manual);
    section.append(help, kindLabel, kind, typeHelp, choose, overwriteLabel, generate, feedback, editor); host.querySelector('.request-intro').after(section);
    let state = null; let available = []; let selected = new Set(); let generated = null; let touched = false; let copying = false; let initialized = false;
    function read() { try { return getState(); } catch { return { ok: false, error: '최신 기록을 읽지 못했어요. 다시 확인해 주세요.' }; } }
    function ids() { return [...selected].sort(); }
    function sameSelection() { return generated && generated.type === kind.value && JSON.stringify(ids()) === JSON.stringify(generated.ids.slice().sort()); }
    function sync() {
      const valid = state?.ok && available.length && state.canGenerate !== false;
      generate.disabled = copying || !valid || !selected.size || (touched && !overwrite.checked);
      kind.disabled = copying; choose.disabled = copying || !state?.ok || state.canGenerate === false;
      selection.textContent = `선택 ${selected.size}건 / 대상 ${available.length}건`;
      for (const node of [copyTitle, copyBody, copyBoth]) node.disabled = copying || !sameSelection() || !state?.ok || state.canGenerate === false;
      title.disabled = body.disabled = copying;
      overwriteLabel.hidden = !touched;
    }
    function render(reset) {
      const focused = choices.contains(document.activeElement) ? document.activeElement.dataset.messageRequest : null;
      state = read(); const list = LCA.requestMessage.candidates(state, kind.value); available = list.ok ? list.items : [];
      selected = reset ? new Set(available.map((item) => item.id)) : new Set([...selected].filter((id) => available.some((item) => item.id === id)));
      choices.replaceChildren();
      for (const item of available) {
        const label = text('label', 'request-message-check', ''); const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = selected.has(item.id); checkbox.dataset.messageRequest = item.id;
        const name = LCA.constants.CATEGORIES.find((c) => c.key === item.categoryKey)?.name || '구분 확인 필요';
        label.append(checkbox, text('span', '', `${item.id} · ${name} · ${item.status} · 기존 제출 기한 ${item.dueDate}`));
        checkbox.addEventListener('change', () => { if (checkbox.checked) selected.add(item.id); else selected.delete(item.id); manual.hidden = true; sync(); }); choices.append(label);
      }
      if (!list.ok) feedback.textContent = list.error;
      else if (!available.length) choices.append(text('p', 'detail-help', kind.value === 'revision' ? '보완 요청 상태의 자료가 없어요.' : '아직 제출되지 않은 요청 자료가 없어요.'));
      typeHelp.textContent = kind.value === 'revision' ? '보완 요청 상태만 골라 저장된 보완 사유를 넣어요. 보완 기한은 새로 확정하지 않고 별도 협의로 안내해요.'
        : '요청 상태이며 아직 받은 자료가 없는 항목만 보여줘요. 제출됨·검토 중·보완 요청·승인·삭제 자료는 제외해요.';
      sync();
      if (focused) [...choices.querySelectorAll('input')].find((node) => node.dataset.messageRequest === focused)?.focus({ preventScroll: true });
    }
    function refresh() { if (section.isConnected) { render(!initialized); initialized = true; } }
    kind.addEventListener('change', () => { overwrite.checked = false; manual.hidden = true; render(true); feedback.textContent = '종류를 바꿨어요. 기존 글은 유지했으니 자료를 고른 뒤 새로 만들어 주세요.'; });
    all.addEventListener('click', () => { selected = new Set(available.map((item) => item.id)); for (const node of choices.querySelectorAll('input')) node.checked = true; sync(); });
    none.addEventListener('click', () => { selected.clear(); for (const node of choices.querySelectorAll('input')) node.checked = false; sync(); });
    latest.addEventListener('click', () => { refresh(); if (state?.ok && state.canGenerate !== false) feedback.textContent = '최신 자료를 확인했어요. 작성 중인 제목과 본문은 유지했어요.'; });
    overwrite.addEventListener('change', sync);
    for (const node of [title, body]) node.addEventListener('input', () => { touched = true; overwrite.checked = false; manual.hidden = true; feedback.textContent = '직접 수정한 내용은 복사할 수 있어요. 새로 만들려면 위 교체 확인에 체크해 주세요.'; sync(); });
    generate.addEventListener('click', () => {
      if (copying || (touched && !overwrite.checked)) return;
      const current = read(); const result = LCA.requestMessage.build(current, kind.value, ids());
      if (!result.ok) { feedback.textContent = result.error; refresh(); return; }
      state = current; generated = { ...result, type: kind.value }; title.value = result.title; body.value = result.body;
      touched = false; overwrite.checked = false; manual.hidden = true; editor.hidden = false;
      warnings.textContent = result.warnings.join(' '); feedback.textContent = '제목과 본문을 만들었어요. 받는 사람·기간·자료·기한을 확인하고 필요한 부분을 수정한 뒤 복사해 주세요.'; sync(); title.focus();
    });
    async function copy(part) {
      if (copying || !generated || !sameSelection()) return;
      const current = LCA.requestMessage.check(read(), generated.type, generated.ids, generated.fingerprint);
      if (!current.ok) { feedback.textContent = current.error; return; }
      const content = part === 'title' ? title.value : part === 'body' ? body.value : `제목: ${title.value}\n\n${body.value}`;
      if (!content.trim() || (part === 'both' && (!title.value.trim() || !body.value.trim()))) { feedback.textContent = '복사할 제목과 본문을 입력해 주세요.'; return; }
      copying = true; sync(); const result = await LCA.requestMessage.copy(content); copying = false; sync();
      if (!section.isConnected) return;
      const after = LCA.requestMessage.check(read(), generated.type, generated.ids, generated.fingerprint);
      if (result.ok) { manual.hidden = true; feedback.textContent = after.ok ? '클립보드에 복사했어요. 메일이나 메신저에 붙여 넣을 수 있어요.' : '복사는 됐지만 그사이 기록이 바뀌었어요. 붙여 넣기 전에 최신 자료로 다시 확인해 주세요.'; }
      else if (!after.ok) feedback.textContent = after.error;
      else { manual.hidden = false; manualText.value = content; feedback.textContent = `${result.error} 아래 선택된 글을 Ctrl+C 또는 기기의 복사 메뉴로 복사해 주세요.`; manualText.focus(); manualText.select(); }
    }
    copyTitle.addEventListener('click', () => copy('title')); copyBody.addEventListener('click', () => copy('body')); copyBoth.addEventListener('click', () => copy('both'));
    refreshCurrent = refresh;
    return { refresh };
  }
  window.addEventListener('storage', () => refreshCurrent());
  return { init };
})();
