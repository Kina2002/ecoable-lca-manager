window.LCA = window.LCA || {};
LCA.views = LCA.views || {};
LCA.views.projectResearcher = (() => {
  function text(tag, value) { const node = document.createElement(tag); node.textContent = value; return node; }
  function person(value) { return value.researcherName ? `${value.researcherName}${value.researcherId ? ` · RSR-${value.researcherId.split('-').at(-1).padStart(3, '0')}` : ' (기존 이름 기록)'}` : '미정'; }
  function init(store, researchers, onChanged) {
    const dialog = document.querySelector('#project-researcher-dialog');
    const form = document.querySelector('#project-researcher-form'); const fields = document.querySelector('#project-researcher-fields');
    const select = document.querySelector('#project-researcher-select'); const reason = document.querySelector('#project-researcher-reason');
    const error = document.querySelector('#project-researcher-error'); const save = document.querySelector('#project-researcher-save');
    const close = document.querySelector('#project-researcher-close'); const history = document.querySelector('#project-researcher-history');
    let state = null; let id = null; let opener = null; let busy = false; let saved = null;
    function sync() { fields.disabled = busy || !state || state.stage >= 10; save.hidden = !!state && state.stage >= 10; save.disabled = fields.disabled; close.disabled = busy; }
    function open(projectId, button) {
      id = projectId; opener = button; state = null; form.reset(); error.textContent = ''; history.replaceChildren(); select.replaceChildren();
      history.parentElement.open = false;
      const result = store.assignment(id); const roster = researchers.list();
      document.querySelector('#project-researcher-current').textContent = result.ok ? `현재 담당자: ${person(result.current)}` : '';
      document.querySelector('#project-researcher-title').textContent = result.stage >= 10 ? '담당 연구원 변경 이력' : '담당 연구원 변경';
      document.querySelector('#project-researcher-help').textContent = '진행 중인 프로젝트는 담당자를 바꿀 수 있어요. 변경 전후 담당자·저장 시각·사유를 보관하며 과거 보고서의 이름은 당시 기록을 유지해요. 완료한 프로젝트는 이력만 볼 수 있어요.';
      if (result.ok) {
        if (roster.ok || result.stage >= 10) state = result;
        const blank = text('option', '연구원을 선택해 주세요'); blank.value = ''; select.append(blank);
        for (const p of roster.items || []) { const option = text('option', `${p.name} · ${p.code}${p.company ? ` · ${p.company}` : ''}${p.department ? ` / ${p.department}` : ''}`); option.value = p.id; select.append(option); }
        select.value = result.current.researcherId;
        for (const event of [...result.history].reverse()) {
          const row = text('details', ''); row.className = 'customer-review-event';
          const at = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Seoul' }).format(new Date(event.at));
          row.append(text('summary', `${at} (한국 시간) · ${event.stage}단계`), text('p', `${person(event.before)} → ${person(event.after)}`), text('p', `사유: ${event.reason}`)); history.append(row);
        }
        if (!result.history.length) history.append(text('p', '아직 담당 연구원 변경 이력이 없어요. 이 기능 도입 전의 변경은 복구되지 않아요.'));
        if (!roster.ok && result.stage < 10) error.textContent = roster.error;
      } else error.textContent = result.error;
      sync(); dialog.showModal(); (fields.disabled ? close : select).focus();
    }
    close.addEventListener('click', () => { if (!busy) dialog.close(); });
    dialog.addEventListener('cancel', (event) => { if (busy) event.preventDefault(); });
    dialog.addEventListener('close', () => { state = null; if (opener?.isConnected) opener.focus({ preventScroll: true }); if (saved) { const changed = saved; saved = null; onChanged(changed); } });
    form.addEventListener('input', () => { error.textContent = ''; });
    form.addEventListener('submit', async (event) => {
      event.preventDefault(); if (busy || !state || state.stage >= 10) return;
      busy = true; sync(); error.textContent = '';
      let result;
      try { result = await store.changeResearcher(id, { researcherId: select.value, reason: reason.value }, state.expected); }
      catch { result = { ok: false, error: '저장하지 못했어요. 입력은 유지했으니 다시 시도해 주세요.' }; }
      busy = false; sync();
      if (result.ok) { saved = id; dialog.close(); }
      else { error.textContent = result.error; error.tabIndex = -1; error.focus(); }
    });
    return { open };
  }
  return { init };
})();
