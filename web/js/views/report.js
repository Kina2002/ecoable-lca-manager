window.LCA = window.LCA || {};
LCA.views = LCA.views || {};
LCA.views.report = (() => {
  let refreshCurrent = () => {};
  let selectCurrent = () => {};
  function text(tag, className, value) {
    const node = document.createElement(tag); node.className = className; node.textContent = value; return node;
  }
  function init(project, store, scopeStore, onMoved, comments, onOpenComment, onSaved = () => {}) {
    const host = document.querySelector('#project-report-panel');
    const initial = store.load(project.id);
    let revision = initial.record?.revision || 0;
    let sourceKey = initial.record?.sourceKey || initial.sourceKey || '';
    let expectedScope = LCA.scope.snapshot(project);
    let dirty = false;
    let saving = false;
    const start = text('section', 'detail-card calculation-card', '');
    start.append(text('h2', '', '보고서 작성 시작'), text('p', 'detail-help', '최신 승인 자료·외부 계산 결과와 일치하는 해석을 저장한 뒤, 별도 버튼으로 보고서 단계에 들어가요.'));
    const readiness = text('p', '', ''); readiness.setAttribute('role', 'status');
    const move = text('button', 'primary-button', '보고서 작성 시작'); move.type = 'button';
    const moveError = text('p', 'field-error', ''); moveError.setAttribute('role', 'alert');
    start.append(readiness, move, moveError);
    const editor = text('section', 'detail-card calculation-card', '');
    editor.append(text('h2', '', '보고서 새 버전 만들기'), text('p', 'detail-help', '평가 범위·자료·계산·해석과 이번 변경 기록을 새 버전으로 보관해요. 이전 버전은 아래 이력에서 다시 읽고 내려받을 수 있어요.'));
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
    const changeFields = LCA.views.reportHistory.changeFields(project);
    fields.append(changeFields.element);
    const confirmed = document.createElement('input'); confirmed.type = 'checkbox';
    const confirmation = text('label', 'calculation-confirmation', '');
    confirmation.append(confirmed, document.createTextNode('현재 승인 자료·계산 결과·해석을 읽고 초안에 담을 내용을 확인했어요.'));
    fields.append(confirmation);
    const error = text('p', 'field-error', ''); error.setAttribute('role', 'alert');
    const save = text('button', 'primary-button', '보고서 새 버전 저장'); save.type = 'submit';
    const feedback = text('p', '', ''); feedback.setAttribute('role', 'status');
    form.append(fields, error, save, feedback); editor.append(basis, warning, adopt, form);
    const saved = text('section', 'detail-card calculation-card', '');
    saved.append(text('h2', '', '보관된 보고서 버전'));
    const savedStatus = text('p', '', ''); savedStatus.setAttribute('role', 'status');
    const exportOptions = document.createElement('details'); exportOptions.className = 'report-export';
    exportOptions.append(text('summary', '', '보고서 내려받기'));
    const exportHelp = text('p', 'detail-help', '형식을 선택한 다음 내려받기를 눌러 주세요. 저장된 초안의 내용을 문서로 만들어요.');
    exportHelp.id = 'report-export-help';
    const exportRow = text('div', 'report-export-row', '');
    const exportLabel = text('label', '', '파일 형식'); exportLabel.htmlFor = 'report-export-format';
    const format = document.createElement('select'); format.id = 'report-export-format'; format.setAttribute('aria-describedby', exportHelp.id);
    for (const item of LCA.reportExport.formats) { const option = document.createElement('option'); option.value = item.value; option.textContent = item.label; format.append(option); }
    const formatField = text('div', 'report-export-field', ''); formatField.append(exportLabel, format);
    const download = text('button', 'primary-button', '내려받기'); download.type = 'button';
    let exporting = false;
    exportRow.append(formatField, download);
    const downloadStatus = text('p', 'detail-help', ''); downloadStatus.setAttribute('role', 'status');
    exportOptions.append(exportHelp, exportRow, downloadStatus,
      text('p', 'detail-help', '문서는 이 브라우저에서 만들어요. 증빙 파일은 이름만 포함되며, 전체 입력 기록의 복원용 백업은 아니에요.'));
    const preview = text('div', 'report-preview', '');
    const getComments = () => comments.list(project.id);
    const history = LCA.views.reportHistory.create(() => { downloadStatus.textContent = ''; refresh(); }, onOpenComment, getComments);
    saved.append(savedStatus, history.element, exportOptions, preview);
    host.replaceChildren(start, editor, saved);
    function fill(record) {
      controls.title.value = record?.title || `${project.productName} LCA 보고서 초안`;
      controls.note.value = record?.note || ''; confirmed.checked = false;
      changeFields.reset(!record);
    }
    fill(initial.record);
    function showRecord(record) {
      preview.replaceChildren();
      if (!record) { preview.append(text('p', 'detail-help', '아직 저장한 초안이 없어요. 보고서 단계에서 제목과 확인 내용을 저장하면 본문을 볼 수 있어요.')); return; }
      const details = document.createElement('details'); details.open = true;
      details.append(text('summary', '', '보고서 초안 펼쳐보기'));
      const article = text('article', 'report-document', ''); article.setAttribute('aria-label', '저장된 보고서 초안 본문');
      article.append(text('p', 'demo-pill', '가상 데이터 · 검토 전 초안'), text('h3', '', record.title), text('p', 'detail-help', `보고서 버전 ${record.revision} · ${new Intl.DateTimeFormat('ko-KR', {dateStyle:'medium', timeStyle:'short', timeZone:'Asia/Seoul'}).format(new Date(record.updatedAt))}`));
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
      fields.disabled = saving || !state.ok || ![7, 8].includes(state.project.stage);
      save.disabled = fields.disabled || !state.ready;
      adopt.disabled = save.disabled;
      download.disabled = true;
      format.disabled = exporting || saving;
      if (!state.ok) {
        readiness.textContent = state.error; warning.textContent = state.error; savedStatus.textContent = state.error;
        return;
      }
      history.render(state, exporting || saving);
      const selected = history.current(state);
      const archived = Boolean(selected && selected.revision !== state.record?.revision);
      download.disabled = exporting || saving || !selected || (archived ? !history.archiveConfirmed() : state.stale);
      expectedScope = LCA.scope.snapshot(state.project); move.hidden = state.project.stage !== 6;
      if (!dirty && (state.record?.revision || 0) !== revision) {
        revision = state.record?.revision || 0; sourceKey = state.record?.sourceKey || state.sourceKey; fill(state.record);
      }
      if (!dirty && !state.record) sourceKey = state.sourceKey;
      changeFields.updateComments(getComments(), (state.record?.revision || 0) + 1, fields.disabled);
      readiness.textContent = state.project.stage < 6 ? '결과 해석 단계(6)에서 보고서 작성을 시작할 수 있어요.'
        : state.project.stage === 6 ? state.ready ? '준비됐어요. 버튼을 누르면 보고서 단계(7)로 이동해요.' : '모든 자료를 승인하고 최신 계산 결과에 맞는 해석을 먼저 저장해 주세요.'
        : state.project.stage === 7 ? '보고서 단계(7)예요. 초안 저장으로 다음 단계에 자동 이동하지 않아요.'
        : state.project.stage === 8 ? '제3자 검증 단계(8)예요. 보완한 내용을 새 보고서로 보관하고 검증 지적의 답변에 연결할 수 있어요.' : '후속 단계에서는 저장된 초안을 조회할 수 있어요.';
      basis.textContent = state.source ? `현재 작성 기준: ${state.project.code} · 계산 결과 버전 ${state.source.interpretation.calculation.revision} · 해석 버전 ${state.source.interpretation.revision}` : '보고서에 연결할 해석이 아직 없어요.';
      warning.textContent = state.currentError || (!state.ready ? '현재 자료·계산 결과와 일치하는 해석을 먼저 준비해 주세요. 저장된 초안과 작성 중인 제목·메모는 유지돼요.'
        : sourceKey !== state.sourceKey ? '입력 기준이 현재 자료·해석과 달라요. 내용을 확인한 뒤 초안 기준 다시 확인을 눌러 주세요.' : '');
      savedStatus.className = archived || state.stale ? 'calculation-notice' : 'detail-help';
      savedStatus.textContent = !selected ? '보관된 버전 없음' : archived ? `과거 보관본 v${selected.revision} · 최신 보고서는 v${state.record.revision}이에요. 당시 자료·계산·해석을 보여줘요.` : state.stale ? '자료 또는 해석 변경 · 최신 보고서의 새 버전 작성 필요' : '현재 자료·계산 결과·해석과 같은 기준의 최신 보고서예요.';
      showRecord(archived ? {...selected, historyNotice:'과거 버전 보관본입니다. 현재의 최신 보고서·자료와 다를 수 있습니다.'} : selected);
    }
    refreshCurrent = refresh;
    selectCurrent = (requestedRevision) => {
      const state = store.load(project.id);
      if (!state.ok || !history.selectVersion(requestedRevision, state)) { savedStatus.textContent = state.error || '연결한 보고서 버전을 찾을 수 없어요.'; return; }
      savedStatus.tabIndex = -1; savedStatus.focus(); savedStatus.scrollIntoView({ block: 'start' });
    };
    refresh();
    form.addEventListener('input', () => { dirty = true; error.textContent = ''; });
    form.addEventListener('change', () => { dirty = true; error.textContent = ''; });
    adopt.addEventListener('click', () => {
      const state = store.load(project.id);
      if (!state.ok || !state.ready || ![7, 8].includes(state.project.stage)) { refresh(); return; }
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
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (saving) return;
      const draft = {title: controls.title.value, note: controls.note.value, confirmed: confirmed.checked, change:changeFields.draft()};
      saving = true; save.textContent = '새 버전 저장 중…'; refresh();
      let result;
      try { result = await store.save(project.id, draft, revision, sourceKey); }
      catch { result = {ok:false, error:'새 버전을 저장하지 못했어요. 작성 내용과 이전 버전은 유지했어요.'}; }
      finally { saving = false; save.textContent = '보고서 새 버전 저장'; }
      error.textContent = result.error || Object.values(result.errors || {}).join(' ');
      if (result.ok) {
        revision = result.record.revision; sourceKey = result.record.sourceKey; dirty = false; confirmed.checked = false; changeFields.reset();
        feedback.textContent = `보고서 v${result.record.revision}을 새 버전으로 보관했어요. 이전 버전과 변경 기록은 아래 이력에서 볼 수 있어요.`;
        onSaved();
      }
      refresh();
      if (!result.ok) {
        const first = Object.keys(result.errors || {})[0];
        if (first) (controls[first] || changeFields.controls[first.replace(/^change_/, '')] || confirmed).focus(); else { error.tabIndex = -1; error.focus(); }
      }
    });
    download.addEventListener('click', async () => {
      if (exporting) return;
      const chosen = format.value;
      const selection = store.load(project.id);
      if (!selection.ok) { downloadStatus.textContent = selection.error; refresh(); return; }
      const selectedRevision = history.revision(selection);
      const allowArchive = history.archiveConfirmed();
      const result = store.download(project.id, selectedRevision, allowArchive);
      if (!result.ok) { downloadStatus.textContent = result.error; refresh(); return; }
      exporting = true; exportRow.setAttribute('aria-busy', 'true'); download.textContent = '파일 만드는 중…'; refresh();
      downloadStatus.textContent = '선택한 형식으로 문서를 만들고 있어요. 잠시 기다려 주세요.';
      try {
        const generated = chosen === 'md' ? { blob: new Blob([result.content], { type: 'text/markdown;charset=utf-8' }), extension: 'md' }
          : await LCA.reportExport.create(result.record, chosen);
        // 문서를 만드는 동안 다른 화면에서 자료·해석·보고서를 바꾼 경우에도 오래된 파일을 내보내지 않는다.
        const latest = store.download(project.id, selectedRevision, allowArchive);
        if (!latest.ok) throw new Error(latest.error);
        if (latest.record.revision !== result.record.revision || latest.record.sourceKey !== result.record.sourceKey) {
          throw new Error('파일을 만드는 동안 보고서가 바뀌었어요. 최신 초안을 확인한 뒤 다시 내려받아 주세요.');
        }
        const url = URL.createObjectURL(generated.blob);
        try {
          const link = document.createElement('a'); link.href = url; link.download = result.filename.replace(/\.md$/, `.${generated.extension}`);
          document.body.append(link); link.click(); link.remove();
        } finally { window.setTimeout(() => URL.revokeObjectURL(url), 30000); }
        downloadStatus.textContent = `${LCA.reportExport.formats.find((item) => item.value === chosen).label} 내려받기를 시작했어요.`;
      } catch (cause) {
        downloadStatus.textContent = `내려받지 못했어요. ${cause?.message || '문서 생성 중 문제가 생겼어요. 다시 시도해 주세요.'} 저장한 초안은 그대로 있어요.`;
        downloadStatus.tabIndex = -1; downloadStatus.focus();
      } finally {
        exporting = false; exportRow.removeAttribute('aria-busy'); download.textContent = '내려받기'; refresh();
      }
    });
  }
  return { init, refresh: () => refreshCurrent(), selectVersion: (revision) => selectCurrent(revision) };
})();
