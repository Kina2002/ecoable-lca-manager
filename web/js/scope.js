/* 범위 합의와 프로젝트 단계는 별도로 저장한다. 자료 요청 저장소는 건드리지 않는다. */
window.LCA = window.LCA || {};
LCA.scope = (() => {
  const STORAGE_KEY = 'ecoable-lca-manager.scope.v1';
  const STATUSES = ['미정', '고객 요청안', '협의 중', '확정'];
  const STANDARDS = ['ISO 14040/44', 'ISO 14067', 'GHG Protocol Product', 'PEF', 'EN 15804+A2', '작성지침(PCR)', 'PACT', 'Catena-X'];
  const FIELDS = ['scopeStatus', 'functionalUnit', 'boundary', 'refStart', 'refEnd', 'periodReason', 'standards', 'stage', 'scopeMemo', 'customerContactName', 'researcherName', 'researcherId'];
  function snapshot(project) {
    return Object.fromEntries(FIELDS.map((key) => [key, ['scopeMemo', 'customerContactName', 'researcherName', 'researcherId'].includes(key) && project[key] === undefined ? '' : project[key]]));
  }
  const assigned = (record) => Boolean(record.customerContactName?.trim() && record.researcherName?.trim());
  function collectionReadiness(projectId, result) {
    if (!result?.ok || !Array.isArray(result.items)) return { ok: false, ready: false, error: result?.message || result?.error || '자료 요청 기록을 확인하지 못했어요. 기록을 확인한 뒤 다시 시도해 주세요.' };
    const items = result.items.filter((item) => item.projectId === projectId && !item.deletedAt);
    const missing = items.filter((item) => !LCA.constants.SUBMITTED_STATUSES.includes(item.status) || !item.receipt);
    return { ok: true, ready: items.length > 0 && missing.length === 0, total: items.length, submitted: items.length - missing.length, missing };
  }
  function reviewReadiness(projectId, result) {
    if (!result?.ok || !Array.isArray(result.items)) return { ok: false, ready: false, error: result?.message || result?.error || '자료 요청 기록을 확인하지 못했어요. 기록을 확인한 뒤 다시 시도해 주세요.' };
    const items = result.items.filter((item) => item.projectId === projectId && !item.deletedAt);
    const missing = items.filter((item) => item.status !== '승인' || !item.receipt || !item.review);
    return { ok: true, ready: items.length > 0 && missing.length === 0, total: items.length, approved: items.length - missing.length, missing };
  }
  function twelveMonths(start, end) {
    if (!LCA.requests.validDate(start) || !LCA.requests.validDate(end)) return false;
    const [y, m, d] = start.split('-').map(Number);
    const next = new Date(0);
    next.setUTCHours(0, 0, 0, 0);
    next.setUTCFullYear(y + 1, m - 1, d);
    next.setUTCDate(next.getUTCDate() - 1);
    return next.toISOString().slice(0, 10) === end;
  }
  function missing(project) {
    const result = [];
    if (!project.productName?.trim()) result.push('평가 대상 제품');
    if (!(Number.isFinite(Number(project.functionalUnit?.qty)) && Number(project.functionalUnit.qty) > 0 && project.functionalUnit.unit?.trim())) result.push('0보다 큰 평가 기준량과 단위');
    if (!['요람~문', '요람~무덤', '기타'].includes(project.boundary)) result.push('시스템 경계');
    const dates = LCA.requests.validDate(project.refStart) && LCA.requests.validDate(project.refEnd) && project.refStart <= project.refEnd;
    if (!dates) result.push('올바른 기준기간');
    if (dates && !twelveMonths(project.refStart, project.refEnd) && !project.periodReason?.trim()) result.push('기준기간이 12개월이 아닌 사유');
    if (!Array.isArray(project.standards) || !project.standards.length) result.push('적용 기준');
    return result;
  }
  function valid(record) {
    return record && STATUSES.includes(record.scopeStatus) && [1, 2, 3, 4, 5, 6, 7].includes(record.stage)
      && record.functionalUnit && typeof record.functionalUnit.qty === 'string' && record.functionalUnit.qty.length <= 30
      && (!record.functionalUnit.qty || (/^\d+(\.\d+)?$/.test(record.functionalUnit.qty) && Number(record.functionalUnit.qty) > 0 && Number.isFinite(Number(record.functionalUnit.qty))))
      && typeof record.functionalUnit.unit === 'string' && record.functionalUnit.unit.length <= 30
      && ['', '요람~문', '요람~무덤', '기타'].includes(record.boundary)
      && ['refStart', 'refEnd', 'periodReason'].every((key) => typeof record[key] === 'string')
      && (!record.refStart || LCA.requests.validDate(record.refStart)) && (!record.refEnd || LCA.requests.validDate(record.refEnd))
      && (!record.refStart || !record.refEnd || record.refStart <= record.refEnd)
      && record.periodReason.length <= 1000 && Array.isArray(record.standards)
      && (record.scopeMemo === undefined || (typeof record.scopeMemo === 'string' && record.scopeMemo.length <= 2000))
      && ['customerContactName', 'researcherName'].every((key) => record[key] === undefined || (typeof record[key] === 'string' && record[key].length <= 100))
      && (record.researcherId === undefined || record.researcherId === '' || (typeof record.researcherId === 'string' && /^researcher-(sample|user)-[1-9]\d*$/.test(record.researcherId)))
      && (!record.researcherId || (typeof record.researcherName === 'string' && Boolean(record.researcherName.trim())))
      && record.standards.every((value) => STANDARDS.includes(value))
      && (record.scopeStatus !== '확정' || !missing({ ...record, productName: '제품' }).length)
      && (record.stage < 3 || record.scopeStatus === '확정');
  }
  function createStore(projects, getStorage = () => window.localStorage, getResearchers = null, getRequests = null, getCalculation = null, getInterpretation = null, getVerificationStage = null) {
    const originals = new Map(projects.map((project) => [project.id, JSON.parse(JSON.stringify(snapshot(project)))]));
    function normalize(value, original) {
      const record = snapshot(value);
      if (value.customerContactName === undefined) record.customerContactName = original.customerContactName;
      if (value.researcherName === undefined) {
        record.researcherName = original.researcherName;
        record.researcherId = original.researcherId;
      } else if (value.researcherId === undefined) record.researcherId = '';
      return record;
    }
    function read() {
      try {
        const raw = getStorage().getItem(STORAGE_KEY);
        if (raw === null) return { ok: true, records: {} };
        const data = JSON.parse(raw);
        if (!data || data.version !== 1 || !data.records || typeof data.records !== 'object' || Array.isArray(data.records)) throw Error();
        if (Object.entries(data.records).some(([id, value]) => !originals.has(id) || !valid(value) || ![1, 2, 3, 4, 5, 6, 7].includes(originals.get(id).stage)
            || (originals.get(id).stage === 1 && value.stage > 1 && !assigned(value))
            || value.stage < originals.get(id).stage)) throw Error();
        // 기존 기록은 메모가 없다. 읽을 때만 빈 문자열로 보완하고 원본 저장본은 쓰지 않는다.
        return { ok: true, records: Object.fromEntries(Object.entries(data.records).map(([id, value]) => [id, normalize(value, originals.get(id))])) };
      } catch { return { ok: false, error: '범위 기록을 읽을 수 없어요. 기존 기록을 보호하기 위해 저장과 단계 이동을 중단했어요.' }; }
    }
    function load() {
      const data = read();
      if (!data.ok) return data;
      const effective = [];
      for (const project of projects) {
        const current = data.records[project.id] || JSON.parse(JSON.stringify(originals.get(project.id)));
        const verification = getVerificationStage ? getVerificationStage(project.id) : { ok: true, stage: null };
        if (!verification.ok) return verification;
        effective.push({ project, current: { ...current, stage: Math.max(current.stage, verification.stage || 0) } });
      }
      for (const { project, current } of effective) Object.assign(project, current);
      return data;
    }
    function currentStage(id) {
      const data = read();
      if (!data.ok) return data;
      const current = data.records[id] || originals.get(id);
      if (!current) return { ok: false, error: '프로젝트를 찾을 수 없어요.' };
      const verification = getVerificationStage ? getVerificationStage(id) : { ok: true, stage: null };
      return verification.ok ? { ok: true, stage: Math.max(current.stage, verification.stage || 0) } : verification;
    }
    function collectionStatus(id) {
      try { return collectionReadiness(id, getRequests?.(id)); }
      catch { return { ok: false, ready: false, error: '자료 요청 기록을 확인하지 못했어요. 다시 열어 확인해 주세요.' }; }
    }
    function reviewStatus(id) {
      try { return reviewReadiness(id, getRequests?.(id)); }
      catch { return { ok: false, ready: false, error: '자료 요청 기록을 확인하지 못했어요. 다시 열어 확인해 주세요.' }; }
    }
    function update(id, draft, expected, action = 'save') {
      const data = read();
      if (!data.ok) return data;
      const project = projects.find((item) => item.id === id);
      if (!project) return { ok: false, error: '프로젝트를 찾을 수 없어요.' };
      const current = data.records[id] || originals.get(id);
      if (JSON.stringify(current) !== JSON.stringify(expected)) return { ok: false, error: '다른 화면에서 프로젝트 단계나 범위가 바뀌었어요. 프로젝트 목록으로 돌아가 다시 열어 주세요.' };
      const transition = ['finishCollection', 'finishReview', 'startInterpretation', 'startReport'].includes(action);
      if (!transition && ![1, 2].includes(current.stage)) return { ok: false, error: '수집 이후의 범위 변경은 이번 기능에서 지원하지 않아요.' };
      let record;
      if (action === 'finishCollection') {
        if (current.stage !== 3) return { ok: false, error: '데이터 수집 단계에서만 검토를 시작할 수 있어요. 목록에서 현재 단계를 확인해 주세요.' };
        const readiness = collectionStatus(id);
        if (!readiness.ok) return readiness;
        if (!readiness.ready) return { ok: false, error: readiness.total ? `아직 제출 확인이 필요한 자료 ${readiness.missing.length}건이 있어요.` : '자료 요청이 없어요. 필요한 요청을 등록하고 받은 자료를 기록해 주세요.', readiness };
        record = { ...current, stage: 4, functionalUnit: { ...current.functionalUnit, qty: String(current.functionalUnit.qty ?? '') } };
      } else if (action === 'finishReview') {
        if (current.stage !== 4) return { ok: false, error: '데이터 검토 단계에서만 계산 단계로 이동할 수 있어요. 목록에서 현재 단계를 확인해 주세요.' };
        const readiness = reviewStatus(id);
        if (!readiness.ok) return readiness;
        if (!readiness.ready) return { ok: false, error: readiness.total ? `아직 승인되지 않은 자료 ${readiness.missing.length}건이 있어요.` : '검토할 자료 요청이 없어요. 자료를 등록하고 검토·승인한 뒤 이동해 주세요.', readiness };
        record = { ...current, stage: 5, functionalUnit: { ...current.functionalUnit, qty: String(current.functionalUnit.qty ?? '') } };
      } else if (action === 'startInterpretation') {
        if (current.stage !== 5) return { ok: false, error: '계산 단계에서만 결과 해석을 시작할 수 있어요.' };
        let calculation;
        try { calculation = getCalculation?.(id); }
        catch { return { ok: false, error: '외부 계산 결과를 확인하지 못했어요. 다시 열어 확인해 주세요.' }; }
        if (!calculation?.ok) return { ok: false, error: calculation?.error || '외부 계산 결과를 확인하지 못했어요.' };
        if (!calculation.record || !calculation.source.ready || calculation.stale) return { ok: false, error: '현재 자료를 모두 승인하고 최신 자료·범위와 일치하는 외부 계산 결과를 저장해 주세요.' };
        record = { ...current, stage: 6, functionalUnit: { ...current.functionalUnit, qty: String(current.functionalUnit.qty ?? '') } };
      } else if (action === 'startReport') {
        if (current.stage !== 6) return { ok: false, error: '결과 해석 단계(6)에서만 보고서 작성을 시작할 수 있어요.' };
        let interpretation;
        try { interpretation = getInterpretation?.(id); }
        catch { return { ok: false, error: '보고서에 연결할 해석을 확인하지 못했어요.' }; }
        if (!interpretation?.ok) return { ok: false, error: interpretation?.error || '해석 기록을 확인하지 못했어요.' };
        if (!interpretation.ready || !interpretation.record || interpretation.stale) return { ok: false, error: '모든 자료를 승인하고 최신 계산 결과에 맞는 해석을 저장한 뒤 시작해 주세요.' };
        record = { ...current, stage: 7, functionalUnit: { ...current.functionalUnit, qty: String(current.functionalUnit.qty ?? '') } };
      } else if (action === 'assign') {
        if (current.stage !== 1) return { ok: false, error: '담당자 수정은 계약·착수 단계에서 할 수 있어요.' };
        let researcherName = draft.researcherName;
        let researcherId = '';
        if (draft.researcherId !== undefined && draft.researcherId !== '') {
          const roster = getResearchers?.();
          if (!roster?.ok) return { ok: false, error: roster?.error || '연구원 목록을 다시 열어 확인해 주세요.' };
          const person = roster.items.find((item) => item.id === draft.researcherId);
          if (!person) return { ok: false, error: '선택한 연구원을 찾을 수 없어요. 목록을 다시 확인해 주세요.' };
          researcherName = person.name;
          researcherId = person.id;
        } else if (draft.researcherId === '') researcherName = '';
        else if (researcherName === current.researcherName) researcherId = current.researcherId;
        if (typeof draft.customerContactName !== 'string' || draft.customerContactName.trim().length > 100 || typeof researcherName !== 'string' || researcherName.trim().length > 100) return { ok: false, error: '담당자 이름은 각각 100자 이내로 적어 주세요.' };
        record = { ...current, customerContactName: draft.customerContactName.trim(), researcherName: researcherName.trim(), researcherId, functionalUnit: { ...current.functionalUnit, qty: String(current.functionalUnit.qty ?? '') } };
      } else if (action === 'startScope') {
        if (current.stage !== 1 || !assigned(current)) return { ok: false, error: '계약·착수 단계에서 고객 담당자와 담당 연구원을 모두 저장한 뒤 시작해 주세요.' };
        record = { ...current, stage: 2, functionalUnit: { ...current.functionalUnit, qty: String(current.functionalUnit.qty ?? '') } };
      } else if (action === 'startCollection') {
        if (current.stage !== 2 || current.scopeStatus !== '확정' || missing({ ...project, ...current }).length) return { ok: false, error: '범위 정의 단계에서 필수 정보를 갖추고 확정을 저장한 뒤 시작해 주세요.' };
        record = { ...current, stage: 3 };
      } else {
        record = snapshot({ ...project, ...draft, stage: current.stage, customerContactName: current.customerContactName, researcherName: current.researcherName, researcherId: current.researcherId });
      }
      if (!valid(record)) return { ok: false, error: '날짜·기준량·적용 기준을 확인해 주세요. 확정하려면 필수 정보를 모두 채워야 해요.' };
      try { getStorage().setItem(STORAGE_KEY, JSON.stringify({ version: 1, records: { ...data.records, [id]: record } })); }
      catch { return { ok: false, error: transition
        ? '단계 이동을 저장하지 못했어요. 현재 단계와 받은 자료 기록은 그대로예요.'
        : '범위를 저장하지 못했어요. 입력 내용은 유지되며 단계도 바뀌지 않았어요.' }; }
      Object.assign(project, record);
      return { ok: true };
    }
    return {
      load, currentStage, collectionStatus, reviewStatus, save: (id, draft, expected) => update(id, draft, expected),
      saveAssignees: (id, draft, expected) => update(id, draft, expected, 'assign'),
      startScope: (id, expected) => update(id, null, expected, 'startScope'),
      start: (id, expected) => update(id, null, expected, 'startCollection'),
      finishCollection: (id, expected) => update(id, null, expected, 'finishCollection'),
      finishReview: (id, expected) => update(id, null, expected, 'finishReview'),
      startInterpretation: (id, expected) => update(id, null, expected, 'startInterpretation'),
      startReport: (id, expected) => update(id, null, expected, 'startReport')
    };
  }
  return { STORAGE_KEY, STATUSES, STANDARDS, snapshot, assigned, missing, twelveMonths, collectionReadiness, reviewReadiness, createStore };
})();
