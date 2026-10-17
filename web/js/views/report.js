window.LCA = window.LCA || {};
LCA.views = LCA.views || {};
LCA.views.report = (() => {
  let refreshCurrent = () => {};
  function text(tag, className, value) {
    const node = document.createElement(tag); node.className = className; node.textContent = value; return node;
  }
  function init(project, store, scopeStore, onMoved) {
    const host = document.querySelector('#project-report-panel');
    const initial = store.load(project.id);
    let revision = initial.record?.revision || 0;
    let sourceKey = initial.record?.sourceKey || initial.sourceKey || '';
    let expectedScope = LCA.scope.snapshot(project);
    let dirty = false;
    const start = text('section', 'detail-card calculation-card', '');
    start.append(text('h2', '', '보고서 작성 시작'), text('p', 'detail-help', '최신 승인 자료·외부 계산 결과와 일치하는 해석을 저장한 뒤, 별도 버튼으로 보고서 단계에 들어가요.'));
    const readiness = text('p', '', ''); readiness.setAttribute('role', 'status');
    const move = text('button', 'primary-button', '보고서 작성 시작'); move.type = 'button';
    const moveError = text('p', 'field-error', ''); moveError.setAttribute('role', 'alert');
    start.append(readiness, move, moveError);
    const editor = text('section', 'detail-card calculation-card', '');
    editor.append(text('h2', '', '보고서 초안 만들기'), text('p', 'detail-help', '평가 범위, 승인 원자료, 외부 계산 결과, 담당자 해석을 모아 초안으로 보관해요. 저장한 초안은 아래에서 읽고 글 파일(.md)로 내려받을 수 있어요.'));
    const basis = text('p', 'detail-note', '');
    const warning = text('p', 'calculation-notice', ''); warning.setAttribute('role', 'status');
    const adopt = text('button', 'request-action-button', '초안 기준 다시 확인'); adopt.type = 'button';
    const form = document.createElement('form'); form.noValidate = true;
    const fields = document.createElement('fieldset'); fields.className = 'calculation-fields';
    fields.append(text('legend', '', '보고서 제목과 작성 메모'));
    const controls = {};
    for (const [key, label, multiline, limit] of [['title', '보고서 제목 (필수)', false, 200], ['note', '작성 메모 (선택)', true, 3000]]) {
      const box = text('div', 'interpretation-field', '');
      const caption = text('label', '', label);
      const input = document.createElement(multiline ? 'textarea' : 'input');
      if (!multiline) input.type = 'text'; else input.rows = 3;
      input.id = `report-${key}`; input.maxLength = limit; caption.htmlFor = input.id;
      box.append(caption, input); fields.append(box); controls[key] = input;
    }
    const confirmed = document.createElement('input'); confirmed.type = 'checkbox';
    const confirmation = text('label', 'calculation-confirmation', '');
    confirmation.append(confirmed, document.createTextNode('현재 승인 자료·계산 결과·해석을 읽고 초안에 담을 내용을 확인했어요.'));
    fields.append(confirmation);
    const error = text('p', 'field-error', ''); error.setAttribute('role', 'alert');
    const save = text('button', 'primary-button', '보고서 초안 저장'); save.type = 'submit';
    const feedback = text('p', '', ''); feedback.setAttribute('role', 'status');
    form.append(fields, error, save, feedback); editor.append(basis, warning, adopt, form);
    const saved = text('section', 'detail-card calculation-card', '');
    saved.append(text('h2', '', '저장된 보고서 초안'));
    const savedStatus = text('p', '', ''); savedStatus.setAttribute('role', 'status');
    const download = text('button', 'request-action-button', '보고서 초안 내려받기 (.md)'); download.type = 'button';
    const downloadStatus = text('p', 'detail-help', ''); downloadStatus.setAttribute('role', 'status');
    const preview = text('div', 'report-preview', '');
    saved.append(savedStatus, download, downloadStatus, preview);
    host.replaceChildren(start, editor, saved);
    function fill(record) {
      controls.title.value = record?.title || `${project.productName} LCA 보고서 초안`;
      controls.note.value = record?.note || ''; confirmed.checked = false;
    }
    fill(initial.record);
    function showRecord(record) {
      preview.replaceChildren();
      if (!record) { preview.append(text('p', 'detail-help', '아직 저장한 초안이 없어요. 보고서 단계에서 제목과 확인 내용을 저장하면 본문을 볼 수 있어요.')); return; }
      const details = document.createElement('details'); details.open = true;
      details.append(text('summary', '', '보고서 초안 펼쳐보기'));
      const article = text('article', 'report-document', ''); article.setAttribute('aria-label', '저장된 보고서 초안 본문');
      article.append(text('p', 'demo-pill', '가상 데이터 · 검토 전 초안'), text('h3', '', record.title), text('p', 'detail-help', `초안 버전 ${record.revision} · ${new Intl.DateTimeFormat('ko-KR', {dateStyle:'medium', timeStyle:'short'}).format(new Date(record.updatedAt))}`));
      for (const section of LCA.report.sections(record)) {
        article.append(text('h4', '', section.title));
        for (const paragraph of section.paragraphs) article.append(text('p', 'interpretation-text', paragraph));
        if (section.indicators) {
          const table = document.createElement('table'); table.className = 'calculation-results';
          table.append(text('caption', '', '저장 당시 외부 계산 결과'));
          const head = document.createElement('thead'); const headers = document.createElement('tr');
          for (const label of ['지표', '결과값', '단위']) { const th = text('th', '', label); th.scope = 'col'; headers.append(th); }
          head.append(headers); const body = document.createElement('tbody');
          for (const item of section.indicators) { const row = document.createElement('tr'); for (const value of [item.indicator, item.value, item.unit]) row.append(text('td', '', value)); body.append(row); }
          table.append(head, body); article.append(table);
        }
      }
      article.append(text('p', 'detail-help', '증빙과 결과 파일은 이름만 기록되어 있으며 파일 내용은 이 초안에 첨부되지 않아요.'));
      details.append(article); preview.append(details);
    }
    function refresh() {
      const state = store.load(project.id);
      move.disabled = !state.ok || state.project.stage !== 6 || !state.ready;
      fields.disabled = !state.ok || state.project.stage !== 7;
      save.disabled = fields.disabled || !state.ready;
      adopt.disabled = save.disabled;
      download.disabled = !state.ok || !state.record || state.stale;
      if (!state.ok) {
        readiness.textContent = state.error; warning.textContent = state.error; savedStatus.textContent = state.error;
        return;
      }
      expectedScope = LCA.scope.snapshot(state.project); move.hidden = state.project.stage !== 6;
      if (!dirty && (state.record?.revision || 0) !== revision) {
        revision = state.record?.revision || 0; sourceKey = state.record?.sourceKey || state.sourceKey; fill(state.record);
      }
      if (!dirty && !state.record) sourceKey = state.sourceKey;
      readiness.textContent = state.project.stage < 6 ? '결과 해석 단계(6)에서 보고서 작성을 시작할 수 있어요.'
        : state.project.stage === 6 ? state.ready ? '준비됐어요. 버튼을 누르면 보고서 단계(7)로 이동해요.' : '모든 자료를 승인하고 최신 계산 결과에 맞는 해석을 먼저 저장해 주세요.'
        : state.project.stage === 7 ? '보고서 단계(7)예요. 초안 저장으로 다음 단계에 자동 이동하지 않아요.' : '후속 단계에서는 저장된 초안을 조회할 수 있어요.';
      basis.textContent = state.source ? `현재 작성 기준: ${state.project.code} · 계산 결과 버전 ${state.source.interpretation.calculation.revision} · 해석 버전 ${state.source.interpretation.revision}` : '보고서에 연결할 해석이 아직 없어요.';
      warning.textContent = !state.ready ? '현재 자료·계산 결과와 일치하는 해석을 먼저 준비해 주세요. 저장된 초안과 작성 중인 제목·메모는 유지돼요.'
        : sourceKey !== state.sourceKey ? '입력 기준이 현재 자료·해석과 달라요. 내용을 확인한 뒤 초안 기준 다시 확인을 눌러 주세요.' : '';
      savedStatus.className = state.stale ? 'calculation-notice' : 'detail-help';
      savedStatus.textContent = !state.record ? '저장된 초안 없음' : state.stale ? '자료 또는 해석 변경 · 보고서 초안 재확인 필요' : '현재 자료·계산 결과·해석과 같은 기준의 초안이에요.';
      showRecord(state.record);
    }
    refreshCurrent = refresh; refresh();
    form.addEventListener('input', () => { dirty = true; error.textContent = ''; });
    form.addEventListener('change', () => { dirty = true; error.textContent = ''; });
    adopt.addEventListener('click', () => {
      const state = store.load(project.id);
      if (!state.ok || !state.ready || state.project.stage !== 7) { refresh(); return; }
      sourceKey = state.sourceKey; confirmed.checked = false; dirty = true;
      feedback.textContent = '초안 기준을 최신 자료·해석으로 바꿨어요. 제목과 메모를 다시 읽고 확인한 뒤 저장해 주세요.'; refresh();
    });
    move.addEventListener('click', () => {
      const moved = scopeStore.startReport(project.id, expectedScope);
      moveError.textContent = moved.error || '';
      if (!moved.ok) { refresh(); return; }
      onMoved(); refresh(); readiness.textContent = '보고서 단계(7)로 이동했어요. 아래에서 초안을 저장할 수 있어요.';
      readiness.tabIndex = -1; readiness.focus();
    });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const result = store.save(project.id, {title: controls.title.value, note: controls.note.value, confirmed: confirmed.checked}, revision, sourceKey);
      error.textContent = result.error || Object.values(result.errors || {}).join(' ');
      if (!result.ok) {
        const first = Object.keys(result.errors || {})[0];
        if (first) (controls[first] || confirmed).focus(); else { error.tabIndex = -1; error.focus(); }
        return;
      }
      revision = result.record.revision; sourceKey = result.record.sourceKey; dirty = false; confirmed.checked = false;
      feedback.textContent = '보고서 초안을 저장했어요. 아래 본문을 읽거나 글 파일로 내려받을 수 있어요.'; refresh();
    });
    download.addEventListener('click', () => {
      const result = store.download(project.id);
      if (!result.ok) { downloadStatus.textContent = result.error; refresh(); return; }
      const url = URL.createObjectURL(new Blob([result.content], {type:'text/markdown;charset=utf-8'}));
      const link = document.createElement('a'); link.href = url; link.download = result.filename;
      document.body.append(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      downloadStatus.textContent = '저장된 보고서 초안을 글 파일(.md)로 내려받았어요. 브라우저 전체 백업 파일은 아니에요.';
    });
  }
  return { init, refresh: () => refreshCurrent() };
})();
