/* 승인 자료·계산·담당자 해석의 사본으로 보고서 초안을 보관한다. */
window.LCA = window.LCA || {};
LCA.report = (() => {
  const STORAGE_KEY = 'ecoable-lca-manager.report.v1';
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const projectFields = ['id', 'code', 'companyName', 'productName', 'purpose', 'type', 'customerContactName', 'researcherName'];
  function projectSnapshot(project) {
    return Object.fromEntries(projectFields.map((field) => [field, String(project[field] || '')]));
  }
  function validate(draft) {
    const errors = {};
    if (typeof draft?.title !== 'string' || !draft.title.trim() || draft.title.trim().length > 200) errors.title = '보고서 제목은 1~200자로 적어 주세요.';
    if (typeof draft?.note !== 'string' || draft.note.trim().length > 3000) errors.note = '작성 메모는 3,000자 이내로 적어 주세요.';
    if (draft?.confirmed !== true) errors.confirmed = '현재 자료·계산 결과·해석을 읽고 초안에 담을 내용을 확인해 주세요.';
    return errors;
  }
  function validSource(source, id) {
    return Boolean(source && source.project?.id === id
      && projectFields.every((field) => typeof source.project[field] === 'string')
      && ['id', 'code', 'companyName', 'productName'].every((field) => source.project[field].trim())
      && LCA.interpretation.validRecord(source.interpretation, id));
  }
  function sections(record) {
    const p = record.source.project;
    const interpretation = record.source.interpretation;
    const c = interpretation.calculation;
    const scope = c.source.project;
    return [
      { title: '프로젝트', paragraphs: [`프로젝트 번호: ${p.code}`, `회사: ${p.companyName} (가상)`, `제품: ${p.productName}`, `업무 목적: ${p.purpose || '미정'}`, `프로젝트 유형: ${p.type || '미정'}`, `고객 담당자: ${p.customerContactName || '미정'}`, `담당 연구원: ${p.researcherName || '미정'}`] },
      { title: '평가 범위', paragraphs: [`평가 기준량: ${scope.functionalUnit.qty} ${scope.functionalUnit.unit}`, `시스템 경계: ${scope.boundary}`, `평가 모듈: ${scope.modules || '별도 기록 없음'}`, `기준기간: ${scope.refStart} ~ ${scope.refEnd}`, `적용 기준: ${scope.standards.join(' / ')}`] },
      { title: `계산에 연결한 승인 원자료 (${c.source.requests.length}건)`, paragraphs: c.source.requests.map((item) => {
        const r = item.receipt;
        const category = LCA.constants.CATEGORIES.find((entry) => entry.key === item.categoryKey)?.name || item.categoryKey;
        return `${item.id} · ${category}\n요청 내용: ${item.detail}\n원자료: ${r.kind === 'quantity' ? `${r.value} ${r.unit}${r.density ? ` · 밀도 ${r.density} kg/m³` : ''}` : r.description}\n자료 기간: ${r.periodStart} ~ ${r.periodEnd}\n증빙 파일 이름: ${r.evidenceFileName}\n검토 메모: ${item.review.note || '없음'}`;
      }) },
      { title: '외부 계산 결과', paragraphs: [`계산 결과 버전: ${c.revision}`, `계산일: ${c.calculatedOn}`, `계산 도구: ${c.tool}`, `배경 DB·버전: ${c.database}`, `평가 방법·버전: ${c.method}`, `할당 방법·적용 근거: ${c.allocation}`, `결과 파일 이름: ${c.resultFileName}`, `계산 메모: ${c.note || '없음'}`, `아래 결과는 평가 기준량 ${scope.functionalUnit.qty} ${scope.functionalUnit.unit}당 값입니다. 원자료 활동량을 자동 환산한 결과가 아닙니다.`], indicators: c.indicators },
      { title: `담당자의 결과 해석 (버전 ${interpretation.revision})`, paragraphs: Object.entries(LCA.interpretation.LABELS).map(([field, label]) => `${label}\n${interpretation[field]}`) },
      { title: '작성 메모', paragraphs: [record.note || '별도 작성 메모가 없습니다.'] }
    ];
  }
  const markdownText = (value) => String(value).replace(/[\\`*_{}\[\]<>()#!|~]/g, '\\$&').replace(/\r\n?/g, '\n');
  function markdown(record) {
    const lines = [`# ${markdownText(record.title)}`, '', '> 가상 데이터 · 검토 전 보고서 초안', '', `초안 버전 ${record.revision} · 저장 시각 ${record.updatedAt}`, ''];
    for (const section of sections(record)) {
      lines.push(`## ${markdownText(section.title)}`, '');
      for (const paragraph of section.paragraphs) lines.push(markdownText(paragraph).replace(/\n/g, '  \n'), '');
      if (section.indicators) {
        lines.push('| 지표 | 결과값 | 단위 |', '| --- | --- | --- |');
        for (const item of section.indicators) lines.push(`| ${[item.indicator, item.value, item.unit].map((value) => markdownText(value).replace(/\n/g, ' ')).join(' | ')} |`);
        lines.push('');
      }
    }
    lines.push('증빙과 결과 파일은 이름만 기록되어 있으며 파일 내용은 이 초안에 첨부되지 않습니다.', '');
    return '\uFEFF' + lines.join('\n');
  }
  function createStore(projects, getInterpretation, getStorage = () => window.localStorage) {
    const failure = () => ({ ok: false, error: '보고서 초안 기록을 읽지 못했어요. 기존 기록을 보호하기 위해 저장을 중단했어요.' });
    function read() {
      try {
        const raw = getStorage().getItem(STORAGE_KEY);
        if (raw === null) return { ok: true, records: {} };
        const data = JSON.parse(raw);
        if (!data || data.version !== 1 || !data.records || typeof data.records !== 'object' || Array.isArray(data.records)) return failure();
        for (const [id, record] of Object.entries(data.records)) {
          if (!projects.some((p) => p.id === id) || !record || record.projectId !== id || Object.keys(validate(record)).length
            || !Number.isSafeInteger(record.revision) || record.revision < 1 || !validSource(record.source, id)
            || record.sourceKey !== JSON.stringify(record.source)
            || ['createdAt', 'updatedAt'].some((field) => typeof record[field] !== 'string' || !Number.isFinite(Date.parse(record[field])))
            || record.createdAt > record.updatedAt) return failure();
        }
        return { ok: true, records: data.records };
      } catch { return failure(); }
    }
    function load(id) {
      const data = read();
      if (!data.ok) return data;
      let state;
      try { state = getInterpretation(id); }
      catch { return { ok: false, error: '보고서에 담을 자료를 확인하지 못했어요.' }; }
      if (!state?.ok) return state || { ok: false, error: '해석 기록을 확인하지 못했어요.' };
      const ready = Boolean(state.ready && state.record && !state.stale);
      const source = state.record ? { project: projectSnapshot(state.project), interpretation: clone(state.record) } : null;
      const sourceKey = source ? JSON.stringify(source) : '';
      const record = data.records[id] || null;
      return { ok: true, project: state.project, ready, source, sourceKey, record: record ? clone(record) : null,
        stale: Boolean(record && (!ready || record.sourceKey !== sourceKey)) };
    }
    function save(id, draft, expectedRevision, expectedSourceKey) {
      const errors = validate(draft);
      if (Object.keys(errors).length) return { ok: false, errors };
      const data = read();
      if (!data.ok) return data;
      const state = load(id);
      if (!state.ok) return state;
      if (state.project.stage !== 7) return { ok: false, error: '보고서 작성 단계(7)에서 초안을 저장할 수 있어요.' };
      if (!state.ready) return { ok: false, error: '최신 승인 자료·계산 결과와 일치하는 결과 해석을 먼저 저장해 주세요.' };
      if ((state.record?.revision || 0) !== expectedRevision) return { ok: false, error: '다른 화면에서 보고서가 바뀌었어요. 작성 내용은 유지했으니 프로젝트를 다시 열어 최신 초안을 확인해 주세요.' };
      if (state.sourceKey !== expectedSourceKey) return { ok: false, error: '보고서의 근거가 바뀌었어요. 자료와 해석을 읽고 초안 기준을 다시 확인해 주세요.' };
      if (expectedRevision >= Number.MAX_SAFE_INTEGER) return { ok: false, error: '초안 버전 번호를 만들지 못했어요.' };
      const now = new Date().toISOString();
      const record = { title: draft.title.trim(), note: draft.note.trim(), confirmed: true, projectId: id,
        revision: expectedRevision + 1, source: clone(state.source), sourceKey: state.sourceKey,
        createdAt: state.record?.createdAt || now, updatedAt: now };
      try { getStorage().setItem(STORAGE_KEY, JSON.stringify({ version: 1, records: { ...data.records, [id]: record } })); }
      catch { return { ok: false, error: '보고서 초안을 저장하지 못했어요. 작성 내용과 기존 초안은 유지했어요.' }; }
      return { ok: true, record: clone(record) };
    }
    function download(id) {
      const state = load(id);
      if (!state.ok) return state;
      if (!state.record) return { ok: false, error: '보고서 초안을 먼저 저장해 주세요.' };
      if (state.stale) return { ok: false, error: '보고서 근거가 바뀌었어요. 최신 자료를 반영해 초안을 다시 저장한 뒤 내려받아 주세요.' };
      return { ok: true, content: markdown(state.record), filename: `가상_${state.project.code.replace(/[^A-Za-z0-9_-]/g, '_')}_보고서초안_v${state.record.revision}.md` };
    }
    return { load, save, download };
  }
  return { STORAGE_KEY, validate, sections, createStore };
})();
