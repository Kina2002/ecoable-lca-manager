/* 검증 완료의 근거를 고정하고 인증·등록 또는 고객 제출 이력을 보관한다. */
window.LCA = window.LCA || {};
LCA.certification = (() => {
  const STORAGE_KEY = 'ecoable-lca-manager.certification.v1';
  const STATUSES = ['제출 준비', '제출 완료', '보완 요청', '승인·등록', '반려'];
  const TRANSITIONS = { '제출 준비': ['제출 준비', '제출 완료'], '제출 완료': ['제출 완료', '보완 요청', '승인·등록', '반려'],
    '보완 요청': ['보완 요청', '제출 완료', '반려'], '승인·등록': ['승인·등록'], '반려': ['반려'] };
  const { text, date, clone } = LCA.reviewWorkflow;
  const FIELDS = ['kind', 'organization', 'scheme', 'submittedOn', 'registrationNumber', 'issuedOn', 'note'];
  function validDetails(value, status) {
    if (!value || !['인증', '등록', '고객 제출'].includes(value.kind) || !text(value.organization, 200) || !text(value.scheme, 200)
      || !text(value.registrationNumber, 200, false) || !text(value.note, 2000, false)
      || !(value.submittedOn === '' || LCA.requests.validDate(value.submittedOn)) || !(value.issuedOn === '' || LCA.requests.validDate(value.issuedOn))) return false;
    if (status !== '제출 준비' && !value.submittedOn) return false;
    if (status === '승인·등록' && (!text(value.registrationNumber, 200) || !value.issuedOn)) return false;
    return !(value.submittedOn && value.issuedOn && value.issuedOn < value.submittedOn);
  }
  function validRecord(record, id) {
    if (!record || !Array.isArray(record.events) || !record.events.length || record.revision !== record.events.length) return false;
    let started = false; let status = ''; let lastDate = ''; let completion = null;
    for (const event of record.events) {
      if (!event || !date(event.at) || !text(event.actor, 100) || (lastDate && Date.parse(event.at) < Date.parse(lastDate))) return false;
      lastDate = event.at;
      if (event.type === 'completed') {
        const report = event.report;
        if (started || !LCA.requests.validDate(event.completedOn) || !text(event.documentName, 200) || !text(event.reason, 1000)
          || !report || report.projectId !== id || !Number.isSafeInteger(report.revision) || report.revision < 1
          || Object.keys(LCA.report.validate(report)).length || !LCA.report.validSource(report.source, id)
          || report.sourceKey !== JSON.stringify(report.source) || !date(report.createdAt) || !date(report.updatedAt) || Date.parse(report.createdAt) > Date.parse(report.updatedAt)
          || (report.legacy === true ? report.change !== undefined : report.legacy !== undefined || Object.keys(LCA.reportHistory.validate(report.change, report.revision === 1, true)).length > 0)) return false;
        const method = event.reviewMethod === undefined ? 'external' : event.reviewMethod;
        if (!['internal', 'external'].includes(method)) return false;
        if (method === 'internal') {
          if (event.verification !== null || !LCA.reviewRoute.validEvidence(event.reviewRoute, report, method)) return false;
        } else {
          if (!LCA.verification.validRecord(event.verification, id)
            || event.verification.issues.some((item) => LCA.reviewWorkflow.current(item).status !== '종결')
            || event.verification.rounds.at(-1).reportRevision > report.revision) return false;
          if (event.reviewMethod !== undefined && !LCA.reviewRoute.validEvidence(event.reviewRoute, report, method, true)) return false;
        }
        completion = event;
      } else if (event.type === 'started') {
        if (started || !completion || event.status !== '제출 준비' || !validDetails(event.details, event.status) || !text(event.reason, 1000)) return false;
        started = true; status = event.status;
      } else if (event.type === 'updated') {
        if (!started || !TRANSITIONS[status]?.includes(event.status) || !validDetails(event.details, event.status) || !text(event.reason, 1000)) return false;
        status = event.status;
      } else return false;
    }
    return !!completion;
  }
  function createStore(projects, getProject, getReports, getVerification, getStorage = () => LCA.storage ? LCA.storage.get() : window.localStorage, getReviewRoute = null) {
    const failure = () => ({ ok: false, error: '인증·등록 기록을 읽지 못했어요. 보관 근거와 단계를 보호하기 위해 저장을 중단했어요.' });
    function read() {
      try {
        const raw = getStorage().getItem(STORAGE_KEY);
        if (raw === null) return { ok: true, records: {} };
        const data = JSON.parse(raw);
        if (!data || data.version !== 1 || !data.records || typeof data.records !== 'object' || Array.isArray(data.records)
          || Object.entries(data.records).some(([id, record]) => !projects.some((project) => project.id === id) || !validRecord(record, id))) return failure();
        return { ok: true, records: data.records };
      } catch { return failure(); }
    }
    // 범위 저장소에서 호출하므로 다른 저장소를 재조회하지 않는다.
    function currentStage(id) {
      const data = read();
      return data.ok ? { ok: true, stage: data.records[id]?.events.some((event) => event.type === 'started') ? 9 : null } : data;
    }
    function load(id) {
      const data = read(); if (!data.ok) return data;
      const fallback = projects.find((project) => project.id === id); if (!fallback) return { ok: false, error: '프로젝트를 찾을 수 없어요.' };
      let scope; let reports; let verification; let route;
      try { scope = getProject(id); reports = getReports(id); verification = getVerification(id); route = getReviewRoute?.(id); } catch { /* 보관 사본은 계속 조회한다. */ }
      const record = clone(data.records[id] || { revision: 0, events: [] });
      const completion = record.events.filter((event) => event.type === 'completed').at(-1) || null;
      const process = record.events.filter((event) => event.type !== 'completed').at(-1) || null;
      const project = scope?.ok ? scope.project : fallback;
      const method = getReviewRoute ? route?.method || 'undecided' : 'external';
      const warning = !scope?.ok ? scope?.error || '현재 프로젝트를 확인하지 못했어요.' : !reports?.ok ? reports?.error || '보고서를 확인하지 못했어요.'
        : !verification?.ok ? verification?.error || '검증 기록을 확인하지 못했어요.'
        : getReviewRoute && !route?.ok ? route?.error || '검토 방식을 확인하지 못했어요.' : route?.warning || verification.warning || '';
      const branchBlock = method === 'undecided' ? '검토 방식을 미정에서 내부 검토 또는 외부 검토로 정해 주세요.'
        : method === 'internal' ? route?.completionBlock || '' : verification?.startBlock || (!verification?.round ? '제3자 검증 차수를 먼저 기록해 주세요.' : '')
          || (verification?.issues.some((item) => item.status !== '종결') ? '미종결 검증 지적을 모두 처리해 주세요.' : '');
      const completeBlock = warning || branchBlock
        || (!reports?.record || !reports.ready || reports.stale || reports.currentError ? '현재 자료·계산·해석과 일치하는 최신 보고서를 저장해 주세요.' : '')
        || (verification?.round && reports?.record && verification.round.reportRevision > reports.record.revision ? '검증 보고서 연결을 확인해 주세요.' : '');
      const stale = !!completion && (!!completeBlock || (completion.reviewMethod || 'external') !== method || JSON.stringify(completion.report) !== JSON.stringify(reports?.record)
        || (method === 'external' && JSON.stringify(completion.verification) !== JSON.stringify(verification?.record))
        || (completion.reviewMethod !== undefined ? JSON.stringify(completion.reviewRoute) !== JSON.stringify(route?.record) : !!route?.record.events.length));
      const startBlock = completeBlock || (!completion ? '선택한 검토 경로의 완료 근거를 먼저 보관해 주세요.' : stale ? '완료 기록 이후 보고서·검토 방식·확인 기록이 바뀌었어요. 완료 근거를 다시 기록해 주세요.' : '');
      return { ok: true, project, record, completion, process, warning, completeBlock, startBlock, stale,
        latest: reports?.record || null, verification: verification?.record || null, reviewMethod: method, reviewRoute: route?.record || null,
        canComplete: project.stage === 8 && !process && !completeBlock,
        canStart: project.stage === 8 && !process && !startBlock, canWrite: project.stage === 9 && !!process && !warning };
    }
    function mutate(id, action, draft, expectedRevision, expectedBasis) {
      const data = read(); if (!data.ok) return data;
      const state = load(id); if (!state.ok) return state;
      if (state.record.revision !== expectedRevision) return { ok: false, error: '다른 화면에서 인증·등록 기록이 바뀌었어요. 입력은 유지했으니 기준을 다시 확인해 주세요.' };
      if (!text(draft.actor, 100)) return { ok: false, error: '기록 담당자를 1~100자로 적어 주세요.' };
      if (!text(draft.reason, 1000)) return { ok: false, error: '확인 근거·변경 사유를 1~1,000자로 적어 주세요.' };
      const record = clone(state.record);
      const at = new Date(Math.max(Date.now(), ...record.events.map((event) => Date.parse(event.at)))).toISOString();
      const event = { type: action, actor: draft.actor.trim(), reason: draft.reason.trim(), at };
      if (action === 'completed') {
        if (!state.canComplete) return { ok: false, error: state.completeBlock || '검토·검증(8) 단계에서 완료 근거를 보관할 수 있어요.' };
        if (!expectedBasis || expectedBasis.reportRevision !== state.latest.revision || expectedBasis.sourceKey !== state.latest.sourceKey
          || expectedBasis.verificationRevision !== state.verification.revision
          || (getReviewRoute && (expectedBasis.reviewMethod !== state.reviewMethod || expectedBasis.reviewRevision !== state.reviewRoute.revision))) return { ok: false, error: '보고서·검토 방식·검증 기준이 바뀌었어요. 입력을 유지했으니 기준을 다시 확인해 주세요.' };
        if (!LCA.requests.validDate(draft.completedOn) || !text(draft.documentName, 200) || draft.confirmed !== true) return { ok: false, error: '검토 완료일·확인 기록이나 문서 이름을 적고 최종 보고서와 선택한 경로의 완료 근거를 확인해 주세요.' };
        Object.assign(event, { completedOn: draft.completedOn, documentName: draft.documentName.trim(), report: clone(state.latest), verification: state.reviewMethod === 'internal' ? null : clone(state.verification) });
        if (getReviewRoute) Object.assign(event, { reviewMethod: state.reviewMethod, reviewRoute: clone(state.reviewRoute) });
      } else {
        if (action === 'started') {
          if (!state.canStart || draft.confirmed !== true) return { ok: false, error: state.startBlock || '8단계에서 완료 근거를 확인하고 단계 이동에 체크해 주세요.' };
          event.status = '제출 준비';
        } else if (action === 'updated') {
          if (!state.canWrite || !TRANSITIONS[state.process.status]?.includes(draft.status)) return { ok: false, error: state.warning || '현재 상태에서 가능한 다음 상태를 선택해 주세요.' };
          event.status = draft.status;
        } else return { ok: false, error: '저장 동작을 확인해 주세요.' };
        event.details = Object.fromEntries(FIELDS.map((key) => [key, typeof draft[key] === 'string' ? draft[key].trim() : draft[key]]));
        if (!validDetails(event.details, event.status)) return { ok: false, error: '유형·제출기관·제도/요구명은 필수예요. 제출 후에는 제출일, 승인·등록에는 번호(고객 제출은 접수·확인 번호)와 발급·확인일이 필요해요. 날짜 순서와 글자 수를 확인해 주세요.' };
      }
      record.events.push(event); record.revision++;
      if (!validRecord(record, id)) return failure();
      try { getStorage().setItem(STORAGE_KEY, JSON.stringify({ version: 1, records: { ...data.records, [id]: record } })); }
      catch { return { ok: false, error: '브라우저에 저장하지 못했어요. 기존 근거·단계와 입력은 유지했으니 저장 공간을 확인해 주세요.' }; }
      if (action === 'started') state.project.stage = 9;
      return { ok: true, record: clone(record) };
    }
    async function save(...args) {
      try {
        if (typeof navigator !== 'undefined' && navigator.locks?.request) return await navigator.locks.request('ecoable-lca-manager.review-workflow-write', () => mutate(...args));
        return mutate(...args);
      } catch { return { ok: false, error: '인증·등록 저장을 시작하지 못했어요. 입력과 기존 기록은 유지했어요.' }; }
    }
    return { load, currentStage, save };
  }
  return { STORAGE_KEY, STATUSES, TRANSITIONS, validRecord, createStore };
})();
