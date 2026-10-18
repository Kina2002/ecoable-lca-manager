/* 검토 방식의 결정과 최신 보고서에 대한 내부 확인을 보관한다. */
window.LCA = window.LCA || {};
LCA.reviewRoute = (() => {
  const STORAGE_KEY = 'ecoable-lca-manager.review-route.v1';
  const METHODS = { undecided: '미정', internal: '내부 검토', external: '외부 검토(제3자 검증)' };
  const CHECKS = { evidence: '평가 범위와 자료 근거 확인', results: '계산 결과와 해석 확인', report: '보고서 내용과 표기 확인' };
  const { text, date, clone } = LCA.reviewWorkflow;
  function validReport(report, id) {
    return !!report && report.projectId === id && Number.isSafeInteger(report.revision) && report.revision > 0
      && !Object.keys(LCA.report.validate(report)).length && LCA.report.validSource(report.source, id)
      && report.sourceKey === JSON.stringify(report.source) && date(report.createdAt) && date(report.updatedAt)
      && Date.parse(report.createdAt) <= Date.parse(report.updatedAt)
      && (report.legacy === true ? report.change === undefined : report.legacy === undefined && !Object.keys(LCA.reportHistory.validate(report.change, report.revision === 1, true)).length);
  }
  function current(record) {
    const decision = record.events.filter((event) => event.type === 'selected').at(-1) || null;
    const review = record.events.filter((event) => event.type === 'reviewed').at(-1) || null;
    return { decision, review, method: decision?.method || 'undecided' };
  }
  function validRecord(record, id) {
    if (!record || !Array.isArray(record.events) || record.revision !== record.events.length) return false;
    let method = 'undecided'; let lastDate = '';
    for (const event of record.events) {
      if (!event || !date(event.at) || !text(event.actor, 100) || (lastDate && Date.parse(event.at) < Date.parse(lastDate))) return false;
      lastDate = event.at;
      if (event.type === 'selected') {
        if (!Object.hasOwn(METHODS, event.method) || !text(event.reason, 1000, event.method !== 'undecided')) return false;
        method = event.method;
      } else if (event.type === 'reviewed') {
        if (method === 'undecided' || event.method !== method || !text(event.reviewer, 100) || !text(event.note, 3000)
          || !LCA.requests.validDate(event.reviewedOn) || !validReport(event.report, id) || event.confirmed !== true
          || Object.keys(CHECKS).some((key) => event.checks?.[key] !== true)) return false;
      } else return false;
    }
    return true;
  }
  function validEvidence(record, report, method, allowLegacy = false) {
    if (!validRecord(record, report.projectId)) return false;
    if (allowLegacy && method === 'external' && !record.events.length) return true;
    const state = current(record);
    return state.method === method && !!state.review && state.review.method === method && JSON.stringify(state.review.report) === JSON.stringify(report);
  }
  function createStore(projects, getProject, getReports, getComments, getVerification, getStorage = () => LCA.storage ? LCA.storage.get() : window.localStorage) {
    const failure = () => ({ ok: false, error: '검토 방식·내부 검토 기록을 읽지 못했어요. 기존 근거와 단계를 보호하기 위해 저장을 중단했어요.' });
    function read() {
      try {
        const raw = getStorage().getItem(STORAGE_KEY);
        if (raw === null) return { ok: true, records: {} };
        const data = JSON.parse(raw);
        if (!data || data.version !== 1 || !data.records || typeof data.records !== 'object' || Array.isArray(data.records)
          || Object.entries(data.records).some(([id, record]) => !projects.some((project) => project.id === id) || !record.events?.length || !validRecord(record, id))) return failure();
        return { ok: true, records: data.records };
      } catch { return failure(); }
    }
    function currentStage(id) {
      const data = read(); return data.ok ? { ok: true, stage: data.records[id]?.events.some((event) => event.type === 'reviewed') ? 8 : null } : data;
    }
    function load(id) {
      const data = read(); if (!data.ok) return data;
      const fallback = projects.find((project) => project.id === id); if (!fallback) return { ok: false, error: '프로젝트를 찾을 수 없어요.' };
      let scope; let reports; let comments; let verification;
      try { scope = getProject(id); reports = getReports(id); comments = getComments(id); verification = getVerification(id); } catch { /* 보관 기록은 유지한다. */ }
      const record = clone(data.records[id] || { revision: 0, events: [] }); const state = current(record);
      const externalStarted = !!verification?.record?.rounds.length;
      const legacyExternal = externalStarted && !record.events.length;
      const method = legacyExternal ? 'external' : state.method;
      const project = scope?.ok ? scope.project : fallback;
      const warning = !scope?.ok ? scope?.error || '현재 단계를 확인하지 못했어요.' : !reports?.ok ? reports?.error || '보고서를 확인하지 못했어요.'
        : !comments?.ok ? comments?.error || '고객 의견을 확인하지 못했어요.' : comments.warning || (!verification?.ok ? verification?.error || '기존 외부 검증 기록을 확인하지 못했어요.' : '')
        || (externalStarted && method !== 'external' ? '외부 검증 기록과 검토 방식이 달라요. 기존 기록을 보호하기 위해 저장을 중단했어요.' : '');
      const customerPending = comments?.ok ? comments.items.filter((item) => item.status !== '종결').length : 0;
      const reviewBlock = warning || (method === 'undecided' ? '검토 방식을 내부 검토 또는 외부 검토로 정해 저장해 주세요.' : '')
        || (customerPending ? `미종결 고객 의견 ${customerPending}건을 먼저 처리해 주세요.` : '')
        || (!reports?.record || !reports.ready || reports.stale || reports.currentError ? '현재 자료·계산·해석과 일치하는 최신 보고서를 먼저 보관해 주세요.' : '');
      const reviewReady = !reviewBlock && !!state.review && state.review.method === method && JSON.stringify(state.review.report) === JSON.stringify(reports.record);
      const completionBlock = reviewBlock || (!reviewReady && !legacyExternal ? '현재 보고서와 검토 방식에 맞는 내부 검토 완료 기록을 먼저 저장해 주세요.' : '');
      const stale = !!state.review && !reviewReady;
      const writable = [7, 8].includes(project.stage) && !warning;
      return { ok: true, project, record, ...state, method, legacyExternal, externalStarted, warning, reviewBlock, completionBlock, reviewReady, stale,
        latest: reports?.record || null, canSelect: writable, canReview: writable && !reviewBlock, customerPending };
    }
    function mutate(id, action, draft, expectedRevision, expectedReport) {
      const data = read(); if (!data.ok) return data;
      const state = load(id); if (!state.ok) return state;
      if (state.record.revision !== expectedRevision) return { ok: false, error: '다른 화면에서 검토 방식이나 내부 검토 기록이 바뀌었어요. 입력을 유지했으니 최신 기준을 다시 확인해 주세요.' };
      if (!text(draft.actor, 100)) return { ok: false, error: '기록 담당자를 1~100자로 적어 주세요.' };
      const record = clone(state.record);
      const at = new Date(Math.max(Date.now(), record.events.length ? Date.parse(record.events.at(-1).at) : 0)).toISOString();
      const event = { type: action, actor: draft.actor.trim(), at };
      if (action === 'selected') {
        if (!state.canSelect) return { ok: false, error: state.warning || '보고서(7)·검토·검증(8) 단계에서 검토 방식을 정할 수 있어요.' };
        if (!Object.hasOwn(METHODS, draft.method) || !text(draft.reason, 1000, draft.method !== 'undecided')) return { ok: false, error: '검토 방식을 선택하고 판단 근거를 1~1,000자로 적어 주세요. 미정이면 근거는 선택이에요.' };
        if (state.externalStarted && draft.method !== 'external') return { ok: false, error: '이미 외부 검증을 시작했어요. 기존 차수·지적을 보존하기 위해 내부 검토나 미정으로 바꿀 수 없어요.' };
        Object.assign(event, { method: draft.method, reason: draft.reason.trim() });
      } else if (action === 'reviewed') {
        if (!state.canReview) return { ok: false, error: state.reviewBlock || '보고서(7)·검토·검증(8) 단계에서 내부 검토를 기록할 수 있어요.' };
        if (!expectedReport || state.latest.revision !== expectedReport.revision || state.latest.sourceKey !== expectedReport.sourceKey || JSON.stringify(state.latest) !== expectedReport.key) return { ok: false, error: '검토할 보고서가 바뀌었어요. 입력을 유지했으니 최신 보고서와 기준을 다시 확인해 주세요.' };
        if (!text(draft.reviewer, 100) || !text(draft.note, 3000) || !LCA.requests.validDate(draft.reviewedOn) || draft.confirmed !== true
          || Object.keys(CHECKS).some((key) => draft.checks?.[key] !== true)) return { ok: false, error: '내부 검토자·검토일·검토 내용을 적고 세 확인 항목과 보고서 확인에 체크해 주세요.' };
        if (state.legacyExternal) record.events.push({ type: 'selected', method: 'external', actor: draft.actor.trim(), reason: '기존 외부 검증 기록에 따라 외부 검토로 연결함', at });
        Object.assign(event, { method: state.method, reviewer: draft.reviewer.trim(), reviewedOn: draft.reviewedOn, note: draft.note.trim(), checks: clone(draft.checks), confirmed: true, report: clone(state.latest) });
      } else return { ok: false, error: '검토 저장 동작을 확인해 주세요.' };
      record.events.push(event); record.revision = record.events.length;
      if (!validRecord(record, id)) return failure();
      try { getStorage().setItem(STORAGE_KEY, JSON.stringify({ version: 1, records: { ...data.records, [id]: record } })); }
      catch { return { ok: false, error: '검토 기록을 저장하지 못했어요. 기존 방식·단계·입력은 유지했으니 저장 공간을 확인해 주세요.' }; }
      if (action === 'reviewed') state.project.stage = 8;
      return { ok: true, record: clone(record) };
    }
    async function save(...args) {
      try {
        if (typeof navigator !== 'undefined' && navigator.locks?.request) return await navigator.locks.request('ecoable-lca-manager.review-workflow-write', () => mutate(...args));
        return mutate(...args);
      } catch { return { ok: false, error: '검토 기록 저장을 시작하지 못했어요. 입력과 기존 기록은 유지했어요.' }; }
    }
    return { load, currentStage, save };
  }
  return { STORAGE_KEY, METHODS, CHECKS, validRecord, validEvidence, current, createStore };
})();
