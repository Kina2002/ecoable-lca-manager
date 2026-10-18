/* 검증 차수·지적과 7→8 진입을 하나의 저장 기록으로 보관한다. */
window.LCA = window.LCA || {};
LCA.verification = (() => {
  const STORAGE_KEY = 'ecoable-lca-manager.verification.v1';
  const { text, date, clone, current, validEvents, STATUSES, RESOLUTIONS } = LCA.reviewWorkflow;
  const positive = (n) => Number.isSafeInteger(n) && n > 0;
  function validRecord(record, id) {
    if (!record || !positive(record.revision) || !Array.isArray(record.rounds) || !record.rounds.length || !Array.isArray(record.issues)) return false;
    let previousDate = ''; let previousVersion = 0;
    for (const [index, round] of record.rounds.entries()) {
      if (!round || round.number !== index + 1 || !positive(round.reportRevision) || round.reportRevision < previousVersion
        || !text(round.reportTitle, 200) || !text(round.organization, 200) || !text(round.verifier, 100) || !text(round.actor, 100)
        || !text(round.note, 1000, false) || round.confirmed !== true || !date(round.createdAt)
        || (previousDate && Date.parse(round.createdAt) < Date.parse(previousDate))) return false;
      previousDate = round.createdAt; previousVersion = round.reportRevision;
    }
    const seen = new Set(); const numbers = new Map();
    for (const item of record.issues) {
      const round = record.rounds[item?.round - 1];
      const number = (numbers.get(item?.round) || 0) + 1;
      if (!item || !round || !positive(item.round) || !positive(item.number) || item.projectId !== id || item.number !== number || item.id !== `VER-${String(item.round).padStart(3, '0')}-${String(number).padStart(3, '0')}`
        || seen.has(item.id) || item.reportRevision !== round.reportRevision || item.reportTitle !== round.reportTitle
        || !text(item.content, 3000) || !LCA.requests.validDate(item.dueDate) || !validEvents(item.events, item.reportRevision)
        || Date.parse(item.events[0].at) < Date.parse(round.createdAt)
        || item.events.some((event) => event.type === 'closed' && !text(event.reason, 1000))) return false;
      const nextRound = record.rounds[item.round];
      if (nextRound && (current(item).status !== '종결' || Date.parse(item.events.at(-1).at) > Date.parse(nextRound.createdAt))) return false;
      seen.add(item.id); numbers.set(item.round, number);
    }
    return record.revision === record.rounds.length + record.issues.reduce((total, item) => total + item.events.length, 0);
  }
  function createStore(projects, getProject, getReports, getComments, getStorage = () => window.localStorage) {
    const failure = () => ({ ok: false, error: '제3자 검증 기록을 읽지 못했어요. 기존 차수와 단계를 보호하기 위해 저장과 단계 이동을 중단했어요.' });
    function read() {
      try {
        const raw = getStorage().getItem(STORAGE_KEY);
        if (raw === null) return { ok: true, records: {} };
        const data = JSON.parse(raw);
        if (!data || data.version !== 1 || !data.records || typeof data.records !== 'object' || Array.isArray(data.records)
          || Object.entries(data.records).some(([id, record]) => !projects.some((p) => p.id === id) || !validRecord(record, id))) return failure();
        return { ok: true, records: data.records };
      } catch { return failure(); }
    }
    // 저장된 검증 기록만 읽는다. scope→검증→scope 순환 조회를 만들지 않는다.
    function currentStage(id) {
      const data = read(); return data.ok ? { ok: true, stage: data.records[id] ? 8 : null } : data;
    }
    function load(id) {
      const data = read(); if (!data.ok) return data;
      const fallback = projects.find((p) => p.id === id); if (!fallback) return { ok: false, error: '프로젝트를 찾을 수 없어요.' };
      let scope; let reports; let comments;
      try { scope = getProject(id); reports = getReports(id); comments = getComments(id); } catch { /* 조회 가능한 보관 기록은 유지한다. */ }
      const project = scope?.ok ? scope.project : fallback;
      const record = data.records[id] ? clone(data.records[id]) : { revision: 0, rounds: [], issues: [] };
      const versions = reports?.ok ? reports.versions : [];
      const missing = reports?.ok && (record.rounds.some((round) => !versions.some((v) => v.revision === round.reportRevision))
        || record.issues.some((item) => item.events.some((event) => event.type === 'replied' && event.appliedReportRevision !== null && !versions.some((v) => v.revision === event.appliedReportRevision))));
      const warning = !scope?.ok ? scope?.error || '프로젝트 단계를 확인하지 못했어요.' : !reports?.ok ? reports?.error || '보관 보고서를 확인하지 못했어요.'
        : missing ? '검증에 연결한 보고서 버전을 찾을 수 없어요. 기존 기록을 보호하기 위해 저장을 중단했어요.' : '';
      const unresolvedCustomers = comments?.ok ? comments.items.filter((item) => item.status !== '종결') : [];
      const issues = record.issues.map(current); const round = record.rounds.at(-1) || null;
      const unresolved = issues.filter((item) => item.round === round?.number && item.status !== '종결');
      const startBlock = warning || (!comments?.ok ? comments?.error || '고객 검토 기록을 확인하지 못했어요.' : comments.warning || '')
        || (unresolvedCustomers.length ? `미종결 고객 의견 ${unresolvedCustomers.length}건을 먼저 처리해 주세요.` : '')
        || (!reports?.record || !reports.ready || reports.stale || reports.currentError ? '현재 자료·계산·해석과 일치하는 최신 보고서를 먼저 저장해 주세요.' : '')
        || (unresolved.length ? `현재 ${round.number}차의 미종결 지적 ${unresolved.length}건을 먼저 처리해 주세요.` : '');
      return { ok: true, project, record, issues, round, reports: versions, latest: reports?.record || null, sourceKey: reports?.sourceKey || '',
        warning, startBlock, canStart: !startBlock && [7, 8].includes(project.stage), canWrite: !warning && project.stage === 8 && !!round,
        unresolvedCustomers, unresolved };
    }
    function mutate(id, action, draft, expectedRevision, expectedReport) {
      const data = read(); if (!data.ok) return data;
      const state = load(id); if (!state.ok) return state;
      if (state.record.revision !== expectedRevision) return { ok: false, error: '다른 화면에서 검증 기록이 바뀌었어요. 입력은 유지했으니 최신 기록을 다시 불러와 확인해 주세요.' };
      if (!text(draft.actor, 100)) return { ok: false, error: '기록 담당자를 1~100자로 적어 주세요.' };
      const record = clone(state.record);
      const lastRoundDate = record.rounds.reduce((last, round) => Math.max(last, Date.parse(round.createdAt)), 0);
      const lastIssueDate = record.issues.reduce((last, item) => Math.max(last, Date.parse(item.events.at(-1).at)), 0);
      const at = new Date(Math.max(Date.now(), lastRoundDate, lastIssueDate)).toISOString();
      if (action === 'round') {
        if (!state.canStart) return { ok: false, error: state.startBlock || '보고서(7)·제3자 검증(8) 단계에서 검증을 시작할 수 있어요.' };
        if (!expectedReport || state.latest.revision !== expectedReport.revision || state.sourceKey !== expectedReport.sourceKey) return { ok: false, error: '검증할 최신 보고서가 바뀌었어요. 입력은 유지했으니 검증 기준을 다시 확인해 주세요.' };
        if (!text(draft.organization, 200) || !text(draft.verifier, 100) || !text(draft.note, 1000, false)) return { ok: false, error: '검증기관(200자)·검증자(100자)는 필수이고 메모는 1,000자 이내로 적어 주세요.' };
        if (draft.confirmed !== true) return { ok: false, error: '고객 의견 처리와 검증할 보고서, 이전 차수의 검토 완료를 확인해 주세요.' };
        record.rounds.push({ number: record.rounds.length + 1, reportRevision: state.latest.revision, reportTitle: state.latest.title,
          organization: draft.organization.trim(), verifier: draft.verifier.trim(), actor: draft.actor.trim(), note: draft.note.trim(), confirmed: true, createdAt: at });
      } else {
        if (!state.canWrite) return { ok: false, error: state.warning || '검증 단계(8)에서 차수를 시작한 뒤 지적을 기록할 수 있어요.' };
        if (action === 'issue') {
          if (!text(draft.content, 3000) || !LCA.requests.validDate(draft.dueDate)) return { ok: false, error: '지적 내용은 1~3,000자, 보완 기한은 올바른 날짜로 적어 주세요.' };
          const number = record.issues.filter((item) => item.round === state.round.number).length + 1;
          record.issues.push({ id: `VER-${String(state.round.number).padStart(3, '0')}-${String(number).padStart(3, '0')}`, number, round: state.round.number,
            projectId: id, reportRevision: state.round.reportRevision, reportTitle: state.round.reportTitle, content: draft.content.trim(), dueDate: draft.dueDate,
            events: [{ type: 'created', actor: draft.actor.trim(), at }] });
        } else {
          const item = record.issues.find((entry) => entry.id === draft.issueId);
          if (!item || item.round !== state.round.number) return { ok: false, error: '현재 차수의 지적만 처리할 수 있어요. 이전 차수는 그대로 보관돼요.' };
          if (draft.expectedIssueRevision !== item.events.length) return { ok: false, error: '이 지적의 처리 기록이 바뀌었어요. 입력을 유지했으니 최신 답변을 불러와 확인해 주세요.' };
          const previous = current(item); const event = { type: action, actor: draft.actor.trim(), at };
          if (action === 'replied') {
            if (previous.status === '종결' || !text(draft.reply, 3000) || !Object.hasOwn(RESOLUTIONS, draft.resolution)) return { ok: false, error: '열린 지적에 답변(1~3,000자)과 처리 방법을 적어 주세요.' };
            if (draft.resolution === 'report' && (!positive(draft.appliedReportRevision) || draft.appliedReportRevision <= item.reportRevision
              || !state.reports.some((v) => v.revision === draft.appliedReportRevision))) return { ok: false, error: `검토한 v${item.reportRevision}보다 나중에 보관한 수정 보고서를 선택해 주세요.` };
            Object.assign(event, { reply: draft.reply.trim(), resolution: draft.resolution, appliedReportRevision: draft.resolution === 'report' ? draft.appliedReportRevision : null });
          } else if (action === 'closed') {
            if (previous.status !== '답변됨' || previous.resolution === 'pending' || draft.confirmed !== true || !text(draft.reason, 1000)) return { ok: false, error: '답변과 처리 방법을 먼저 저장하고 검증자 확인·종결 근거(1~1,000자)와 확인 체크를 남겨 주세요.' };
            event.reason = draft.reason.trim();
          } else if (action === 'reopened') {
            if (previous.status !== '종결' || !text(draft.reason, 1000)) return { ok: false, error: '종결된 지적을 다시 열려면 사유를 1~1,000자로 적어 주세요.' };
            event.reason = draft.reason.trim();
          } else return { ok: false, error: '검증 처리 방법을 확인해 주세요.' };
          item.events.push(event);
        }
      }
      if (record.revision >= Number.MAX_SAFE_INTEGER) return { ok: false, error: '새 검증 기록 번호를 만들지 못했어요.' };
      record.revision++;
      if (!validRecord(record, id)) return failure();
      try { getStorage().setItem(STORAGE_KEY, JSON.stringify({ version: 1, records: { ...data.records, [id]: record } })); }
      catch { return { ok: false, error: '검증 기록을 저장하지 못했어요. 기존 기록과 단계, 작성 중인 입력은 유지했으니 저장 공간을 확인해 주세요.' }; }
      state.project.stage = 8;
      return { ok: true, record: clone(record) };
    }
    async function save(...args) {
      try {
        if (typeof navigator !== 'undefined' && navigator.locks?.request) return await navigator.locks.request('ecoable-lca-manager.review-workflow-write', () => mutate(...args));
        return mutate(...args);
      } catch { return { ok: false, error: '검증 기록 저장을 시작하지 못했어요. 입력과 기존 기록은 유지했으니 다시 시도해 주세요.' }; }
    }
    return { load, currentStage, save };
  }
  return { STORAGE_KEY, STATUSES, RESOLUTIONS, validRecord, createStore };
})();
