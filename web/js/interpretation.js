/* 외부 분석을 사람이 읽고 기록한다. 자동 분석이나 계산을 수행하지 않는다. */
window.LCA = window.LCA || {};
LCA.interpretation = (() => {
  const STORAGE_KEY = 'ecoable-lca-manager.interpretation.v1';
  const LABELS = { summary: '주요 결과', causes: '영향이 큰 원인', improvements: '개선 검토안', limitations: '가정·한계' };
  const LIMIT = 3000;
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const key = (record) => record ? JSON.stringify(record) : '';
  function validate(draft) {
    const errors = {};
    for (const [field, label] of Object.entries(LABELS)) {
      if (typeof draft?.[field] !== 'string' || !draft[field].trim() || draft[field].trim().length > LIMIT) errors[field] = `${label}는 1~${LIMIT.toLocaleString('ko-KR')}자로 적어 주세요. 확인하지 못한 내용은 미확인이라고 적고 이유를 남겨 주세요.`;
    }
    if (draft?.confirmed !== true) errors.confirmed = '계산 결과와 근거를 읽고 해석 내용을 확인해 주세요.';
    return errors;
  }
  function validCalculation(record, id) {
    if (!record || record.projectId !== id || Object.keys(LCA.modelling.validate(record)).length
      || !Number.isSafeInteger(record.revision) || record.revision < 1
      || ['createdAt', 'updatedAt'].some((field) => typeof record[field] !== 'string' || !Number.isFinite(Date.parse(record[field])))
      || record.createdAt > record.updatedAt || record.source?.project?.id !== id
      || !Array.isArray(record.source.requests) || new Set(record.source.requests.map((r) => r.id)).size !== record.source.requests.length
      || record.source.requests.some((r) => r.projectId !== id || Object.keys(LCA.requests.validate(r)).length)) return false;
    const p = record.source.project;
    if (['id', 'code', 'companyName', 'productName'].some((field) => typeof p[field] !== 'string' || !p[field].trim())
      || !p.functionalUnit || typeof p.functionalUnit.qty !== 'string' || !/^\d+(\.\d+)?$/.test(p.functionalUnit.qty)
      || !Number.isFinite(Number(p.functionalUnit.qty)) || Number(p.functionalUnit.qty) <= 0
      || typeof p.functionalUnit.unit !== 'string' || !p.functionalUnit.unit.trim() || !['요람~문', '요람~무덤', '기타'].includes(p.boundary)
      || !LCA.requests.validDate(p.refStart) || !LCA.requests.validDate(p.refEnd) || p.refStart > p.refEnd
      || !Array.isArray(p.standards) || !p.standards.length || p.standards.some((value) => typeof value !== 'string')) return false;
    const state = LCA.modelling.sourceState(record.source.project, { ok: true, items: record.source.requests });
    return state.ok && state.ready && state.signature === record.source.signature;
  }
  function createStore(projects, getCalculation, getStorage = () => window.localStorage) {
    function read() {
      try {
        const raw = getStorage().getItem(STORAGE_KEY);
        if (raw === null) return { ok: true, records: {} };
        const data = JSON.parse(raw);
        if (!data || data.version !== 1 || !data.records || typeof data.records !== 'object' || Array.isArray(data.records)) throw Error();
        for (const [id, record] of Object.entries(data.records)) {
          if (!projects.some((p) => p.id === id) || !validRecord(record, id)) throw Error();
        }
        return { ok: true, records: data.records };
      } catch { return { ok: false, error: '결과 해석 기록을 읽지 못했어요. 기존 기록을 보호하기 위해 저장을 중단했어요.' }; }
    }
    function load(id) {
      const data = read();
      if (!data.ok) return { ok: false, error: '결과 해석 기록을 읽지 못했어요. 기존 기록을 보호하기 위해 저장을 중단했어요.' };
      let calculation;
      try { calculation = getCalculation(id); }
      catch { return { ok: false, error: '계산 결과와 근거를 확인하지 못했어요.' }; }
      if (!calculation?.ok) return calculation || { ok: false, error: '계산 결과를 확인하지 못했어요.' };
      const record = data.records[id] || null;
      const ready = Boolean(calculation.record && calculation.source.ready && !calculation.stale);
      return { ok: true, project: calculation.project, calculation: calculation.record, calculationKey: key(calculation.record),
        ready, record: record ? clone(record) : null,
        stale: Boolean(record && (!ready || key(record.calculation) !== key(calculation.record))) };
    }
    function save(id, draft, expectedRevision, expectedCalculationKey) {
      const errors = validate(draft);
      if (Object.keys(errors).length) return { ok: false, errors };
      const data = read();
      if (!data.ok) return { ok: false, error: '기존 결과 해석 기록을 읽지 못해 저장을 중단했어요.' };
      const state = load(id);
      if (!state.ok) return state;
      if (![6, 7, 8].includes(state.project.stage)) return { ok: false, error: '결과 해석(6)·보고서(7)·검토·검증(8) 단계에서 기록할 수 있어요.' };
      if (!state.ready) return { ok: false, error: '현재 승인 자료·평가 범위와 일치하는 외부 계산 결과를 먼저 저장해 주세요.' };
      if ((state.record?.revision || 0) !== expectedRevision) return { ok: false, error: '다른 화면에서 해석 기록이 바뀌었어요. 입력은 유지했으니 프로젝트를 다시 열어 최신 기록을 확인해 주세요.' };
      if (state.calculationKey !== expectedCalculationKey) return { ok: false, error: '외부 계산 결과가 바뀌었어요. 최신 결과를 읽고 해석 기준을 다시 확인해 주세요.' };
      if (expectedRevision >= Number.MAX_SAFE_INTEGER) return { ok: false, error: '해석 버전 번호를 만들지 못했어요.' };
      const now = new Date().toISOString();
      const record = { ...Object.fromEntries(Object.keys(LABELS).map((field) => [field, draft[field].trim()])),
        confirmed: true, projectId: id, revision: expectedRevision + 1, calculation: clone(state.calculation), createdAt: state.record?.createdAt || now, updatedAt: now };
      try { getStorage().setItem(STORAGE_KEY, JSON.stringify({ version: 1, records: { ...data.records, [id]: record } })); }
      catch { return { ok: false, error: '해석을 저장하지 못했어요. 입력과 기존 기록은 유지했으니 다시 시도해 주세요.' }; }
      return { ok: true, record: clone(record) };
    }
    return { load, save };
  }
  function validRecord(record, id) {
    return Boolean(record && record.projectId === id && !Object.keys(validate(record)).length
      && Number.isSafeInteger(record.revision) && record.revision >= 1 && validCalculation(record.calculation, id)
      && ['createdAt', 'updatedAt'].every((field) => typeof record[field] === 'string' && Number.isFinite(Date.parse(record[field])))
      && record.createdAt <= record.updatedAt);
  }
  return { STORAGE_KEY, LABELS, LIMIT, key, validate, validRecord, createStore };
})();
