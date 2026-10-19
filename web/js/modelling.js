/* 승인 자료 정리와 외부 계산 결과 보관. 환경영향을 직접 계산하지 않는다. */
window.LCA = window.LCA || {};
LCA.modelling = (() => {
  const STORAGE_KEY = 'ecoable-lca-manager.modelling.v1';
  const LIMITS = { tool: 100, database: 200, method: 200, allocation: 500, resultFileName: 200, note: 1000 };
  const LABELS = { tool: '계산 도구', database: '배경 DB·버전', method: '평가 방법·버전', allocation: '할당 방법·적용 근거', resultFileName: '결과 파일 이름', note: '계산 메모' };
  const clone = (value) => JSON.parse(JSON.stringify(value));
  function projectSnapshot(project) {
    return {
      id: project.id, code: project.code, companyName: project.companyName, productName: project.productName,
      functionalUnit: { qty: String(project.functionalUnit?.qty ?? ''), unit: project.functionalUnit?.unit || '' },
      boundary: project.boundary || '', modules: project.modules || '',
      refStart: project.refStart || '', refEnd: project.refEnd || '', standards: (project.standards || []).slice()
    };
  }
  function sourceState(project, result) {
    if (!result?.ok || !Array.isArray(result.items)) return { ok: false, error: result?.message || result?.error || '자료 요청 기록을 확인하지 못했어요.' };
    const own = result.items.filter((item) => item.projectId === project.id && !item.deletedAt);
    if (own.some((item) => typeof item.id !== 'string')) return { ok: false, error: '자료 요청 번호를 확인하지 못했어요.' };
    const requests = own.map((item) => ({
      id: item.id, projectId: item.projectId, categoryKey: item.categoryKey, detail: item.detail, dueDate: item.dueDate,
      status: item.status, receipt: item.receipt || null, review: item.review || null,
      ...(item.notApplicable ? { notApplicable: item.notApplicable } : {})
    })).sort((a, b) => a.id.localeCompare(b.id));
    const approved = requests.filter((item) => item.status === '승인');
    if (approved.some((item) => !LCA.receivedData.validRecord(item.receipt) || !LCA.review.validRecord(item.review, item.status, item.receipt))) {
      return { ok: false, error: '승인된 자료의 원본·검토 기록을 확인하지 못했어요.' };
    }
    const basis = { project: projectSnapshot(project), requests: clone(requests) };
    const applicable = requests.filter((item) => item.status !== '해당 없음');
    return { ok: true, total: applicable.length, approved: clone(approved), excluded: applicable.length - approved.length,
      notApplicable: own.length - applicable.length,
      ready: applicable.length > 0 && approved.length === applicable.length, basis, signature: JSON.stringify(basis) };
  }
  function csvCell(value) {
    let text = String(value ?? '');
    if (/^[\s\uFEFF]*[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  }
  function exportCsv(project, result, exportedAt = new Date().toISOString()) {
    const state = sourceState(project, result);
    if (!state.ok) return state;
    if (!state.approved.length) return { ok: false, error: '내보낼 승인 자료가 없어요. 자료를 검토·승인한 뒤 내려받아 주세요.' };
    const header = ['시연 데이터', '프로젝트 번호', '가상 회사', '제품', '평가 기준량', '기준량 단위', '시스템 경계', '평가 모듈', '프로젝트 기준기간 시작', '프로젝트 기준기간 종료', '적용 기준', '요청 번호', '자료 구분', '요청 내용', '제출 기한', '자료 형태', '제출 값', '단위', '밀도(kg/m³)', '문서 설명', '자료 기간 시작', '자료 기간 종료', '증빙 파일 이름', '검토 메모', '검토 결과 저장 시각', '내보낸 시각', '전체 요청 수', '내보낸 승인 수', '활동량 출처', '활동량 자료 이름·제공처', '획득 방법', '계수 출처', '계수 DB 이름', '계수 데이터셋 이름', '계수 데이터셋 버전', '계수 기준연도', '계수 제공처·출처'];
    const rows = state.approved.map((item) => {
      const r = item.receipt;
      return ['가상', project.code, project.companyName, project.productName, project.functionalUnit?.qty, project.functionalUnit?.unit,
        project.boundary, project.modules, project.refStart, project.refEnd, (project.standards || []).join(' / '), item.id,
        LCA.constants.CATEGORIES.find((category) => category.key === item.categoryKey)?.name || item.categoryKey,
        item.detail, item.dueDate, r.kind === 'quantity' ? '수치' : '문서·설명', r.value, r.unit, r.density, r.description,
        r.periodStart, r.periodEnd, r.evidenceFileName, item.review.note, item.review.updatedAt, exportedAt, state.total, state.approved.length,
        r.provenance?.activitySource, r.provenance?.activitySourceDetail, r.provenance?.acquisitionMethod, r.provenance?.factorSource,
        r.provenance?.datasetDatabase, r.provenance?.datasetName, r.provenance?.datasetVersion, r.provenance?.datasetYear, r.provenance?.datasetSource];
    });
    return { ok: true, csv: '\uFEFF' + [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n',
      filename: `가상_승인자료_${project.code.replace(/[^A-Za-z0-9_-]/g, '_')}.csv`, count: rows.length, excluded: state.excluded };
  }
  function numeric(value) {
    return typeof value === 'string' && value.trim().length > 0 && value.length <= 50
      && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value.trim()) && Number.isFinite(Number(value));
  }
  function validate(draft) {
    const errors = {};
    for (const [key, limit] of Object.entries(LIMITS)) {
      if (typeof draft[key] !== 'string' || (key !== 'note' && !draft[key].trim()) || draft[key].trim().length > limit) errors[key] = `${LABELS[key]}은 ${key === 'note' ? '0' : '1'}~${limit}자로 적어 주세요.`;
    }
    if (!errors.resultFileName && /[\\/\x00-\x1f]/.test(draft.resultFileName)) errors.resultFileName = '결과 파일 이름에는 폴더 경로를 넣지 마세요.';
    if (!LCA.requests.validDate(draft.calculatedOn)) errors.calculatedOn = '외부 계산일을 올바른 날짜로 적어 주세요.';
    if (draft.scopeConfirmed !== true) errors.scopeConfirmed = '프로젝트의 기준량·범위와 같은 기준으로 계산했는지 확인해 주세요.';
    if (!Array.isArray(draft.indicators) || draft.indicators.length < 1 || draft.indicators.length > 20) errors.indicators = '결과 지표는 1~20개 등록할 수 있어요.';
    else {
      const names = new Set();
      for (const [index, item] of draft.indicators.entries()) {
        if (!item || typeof item.indicator !== 'string' || !item.indicator.trim() || item.indicator.trim().length > 100
          || !numeric(item.value) || typeof item.unit !== 'string' || !item.unit.trim() || item.unit.trim().length > 60) {
          errors.indicators = `${index + 1}번째 지표의 이름·숫자 결과값·단위를 확인해 주세요.`; break;
        }
        const name = item.indicator.trim().normalize('NFKC').toLocaleLowerCase();
        if (names.has(name)) { errors.indicators = `${index + 1}번째 지표 이름이 중복돼요. 구분되는 이름으로 적어 주세요.`; break; }
        names.add(name);
      }
    }
    return errors;
  }
  function normalize(draft) {
    return { ...Object.fromEntries(Object.keys(LIMITS).map((key) => [key, draft[key].trim()])),
      calculatedOn: draft.calculatedOn, scopeConfirmed: true,
      indicators: draft.indicators.map((item) => ({ indicator: item.indicator.trim(), value: item.value.trim(), unit: item.unit.trim() })) };
  }
  function createStore(projects, getStorage = () => LCA.storage ? LCA.storage.get() : window.localStorage, getRequests = null, getProject = null) {
    const failure = () => ({ ok: false, error: '외부 계산 결과를 읽지 못했어요. 기존 기록을 보호하기 위해 저장을 중단했어요.' });
    function read() {
      try {
        const raw = getStorage().getItem(STORAGE_KEY);
        if (raw === null) return { ok: true, records: {} };
        const data = JSON.parse(raw);
        if (!data || data.version !== 1 || !data.records || typeof data.records !== 'object' || Array.isArray(data.records)) return failure();
        for (const [id, record] of Object.entries(data.records)) {
          if (!projects.some((p) => p.id === id) || !record || record.projectId !== id || Object.keys(validate(record)).length
            || !Number.isSafeInteger(record.revision) || record.revision < 1 || record.source?.project?.id !== id
            || !Array.isArray(record.source.requests) || !record.source.requests.length
            || record.source.requests.some((item) => item.projectId !== id || !['승인', '해당 없음'].includes(item.status)
              || (item.status === '해당 없음' && (!item.notApplicable || typeof item.notApplicable.reason !== 'string'
                || !item.notApplicable.reason.trim() || typeof item.notApplicable.recordedAt !== 'string'
                || !Number.isFinite(Date.parse(item.notApplicable.recordedAt)))))
            || ['createdAt', 'updatedAt'].some((key) => typeof record[key] !== 'string' || !Number.isFinite(Date.parse(record[key])))
            || record.createdAt > record.updatedAt) return failure();
          const p = record.source.project;
          if (['id', 'code', 'companyName', 'productName'].some((key) => typeof p[key] !== 'string' || !p[key].trim())
            || !p.functionalUnit || !/^\d+(\.\d+)?$/.test(p.functionalUnit.qty) || !Number.isFinite(Number(p.functionalUnit.qty)) || Number(p.functionalUnit.qty) <= 0
            || typeof p.functionalUnit.unit !== 'string' || !p.functionalUnit.unit.trim() || !['요람~문', '요람~무덤', '기타'].includes(p.boundary)
            || !LCA.requests.validDate(p.refStart) || !LCA.requests.validDate(p.refEnd) || p.refStart > p.refEnd
            || !Array.isArray(p.standards) || !p.standards.length || p.standards.some((value) => typeof value !== 'string')
            || new Set(record.source.requests.map((item) => item.id)).size !== record.source.requests.length
            || record.source.requests.some((item) => !/^DRQ-\d{4,}$/.test(item.id) || Object.keys(LCA.requests.validate(item)).length)) return failure();
          const state = sourceState(record.source.project, { ok: true, items: record.source.requests });
          if (!state.ok || !state.ready || record.source.signature !== state.signature) return failure();
        }
        return { ok: true, records: data.records };
      } catch { return failure(); }
    }
    function current(id) {
      try {
        const selected = getProject ? getProject(id) : { ok: true, project: projects.find((p) => p.id === id) };
        if (!selected.ok || !selected.project || selected.project.id !== id) return { ok: false, error: selected.error || '프로젝트를 찾을 수 없어요.' };
        const source = sourceState(selected.project, getRequests?.(id));
        return source.ok ? { ok: true, project: selected.project, source } : source;
      } catch { return { ok: false, error: '계산의 근거 자료를 읽지 못했어요. 저장 기록을 확인해 주세요.' }; }
    }
    function load(id) {
      const data = read();
      if (!data.ok) return data;
      const state = current(id);
      if (!state.ok) return state;
      const record = data.records[id] || null;
      return { ...state, record: record ? clone(record) : null, stale: Boolean(record && record.source.signature !== state.source.signature) };
    }
    function save(id, draft, expectedRevision, expectedSignature) {
      const errors = validate(draft);
      if (Object.keys(errors).length) return { ok: false, errors };
      const data = read();
      if (!data.ok) return data;
      const state = current(id);
      if (!state.ok) return state;
      if (state.project.stage < 5) return { ok: false, error: '계산 단계에 들어간 뒤 외부 계산 결과를 등록해 주세요.' };
      if (state.project.stage >= 9) return { ok: false, error: '인증·등록 준비 이후에는 완료 근거를 보호하기 위해 계산 결과를 읽기 전용으로 보관해요.' };
      if (!state.source.ready) return { ok: false, error: '현재 프로젝트의 자료를 최소 한 건 등록하고 모두 승인한 뒤 결과를 저장해 주세요.' };
      const previous = data.records[id];
      if ((previous?.revision || 0) !== expectedRevision) return { ok: false, error: '다른 화면에서 계산 결과가 바뀌었어요. 입력은 유지했으니 저장된 결과를 다시 열어 확인해 주세요.' };
      if (state.source.signature !== expectedSignature) return { ok: false, error: '승인 자료나 평가 범위가 바뀌었어요. 외부 계산 결과를 다시 확인한 뒤 입력 기준을 갱신해 주세요.' };
      if (expectedRevision >= Number.MAX_SAFE_INTEGER) return { ok: false, error: '결과 버전 번호를 만들지 못했어요.' };
      const now = new Date().toISOString();
      const record = { ...normalize(draft), projectId: id, revision: expectedRevision + 1,
        source: { ...clone(state.source.basis), signature: state.source.signature }, createdAt: previous?.createdAt || now, updatedAt: now };
      try { getStorage().setItem(STORAGE_KEY, JSON.stringify({ version: 1, records: { ...data.records, [id]: record } })); }
      catch { return { ok: false, error: '외부 계산 결과를 저장하지 못했어요. 입력과 기존 결과를 유지했으니 다시 시도해 주세요.' }; }
      return { ok: true, record: clone(record) };
    }
    function csv(id) {
      const state = current(id);
      if (!state.ok) return state;
      return exportCsv(state.project, { ok: true, items: state.source.basis.requests });
    }
    return { load, save, csv };
  }
  return { STORAGE_KEY, LIMITS, LABELS, projectSnapshot, sourceState, exportCsv, numeric, validate, createStore };
})();
