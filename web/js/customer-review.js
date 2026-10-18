/* 보고서에 대한 고객 의견과 사람이 기록한 답변을 보관한다. */
window.LCA = window.LCA || {};
LCA.customerReview = (() => {
  const STORAGE_KEY = 'ecoable-lca-manager.comments.v1';
  const { STATUSES, RESOLUTIONS, clone, text: validText, current } = LCA.reviewWorkflow;
  function validItem(item, projects) {
    if (!item || !/^CMT-[0-9]{4,}$/.test(item.id) || !projects.some((p) => p.id === item.projectId)
      || !Number.isSafeInteger(item.reportRevision) || item.reportRevision < 1 || !validText(item.reportTitle, 200)
      || !validText(item.content, 3000) || !validText(item.reviewer, 100, false) || !Array.isArray(item.events) || !item.events.length) return false;
    return LCA.reviewWorkflow.validEvents(item.events, item.reportRevision);
  }
  function createStore(projects, getReports, getProject, getStorage = () => window.localStorage) {
    const failure = () => ({ ok: false, error: '고객 검토 기록을 읽지 못했어요. 기존 의견을 보호하기 위해 저장을 중단했어요.' });
    function read() {
      try {
        const raw = getStorage().getItem(STORAGE_KEY);
        if (raw === null) return { ok: true, nextNumber: 1, items: [] };
        const data = JSON.parse(raw);
        if (!data || data.version !== 1 || !Number.isSafeInteger(data.nextNumber) || data.nextNumber < 1 || !Array.isArray(data.items)) return failure();
        const seen = new Set();
        for (const item of data.items) {
          if (!validItem(item, projects) || seen.has(item.id) || Number(item.id.slice(4)) >= data.nextNumber) return failure();
          seen.add(item.id);
        }
        return { ok: true, nextNumber: data.nextNumber, items: data.items };
      } catch { return failure(); }
    }
    function list(id) {
      const data = read(); if (!data.ok) return data;
      const fallback = projects.find((p) => p.id === id);
      if (!fallback) return { ok: false, error: '프로젝트를 찾을 수 없어요.' };
      let scope; let reports;
      try { scope = getProject(id); reports = getReports(id); } catch { /* 읽기 실패 시 기록만 표시한다. */ }
      const project = scope?.ok ? scope.project : fallback;
      const warning = !scope?.ok ? scope?.error || '현재 프로젝트 단계를 확인하지 못했어요.'
        : !reports?.ok ? reports?.error || '보관한 보고서를 확인하지 못했어요.' : '';
      const items = data.items.filter((item) => item.projectId === id).map(current).reverse();
      const versions = reports?.ok ? reports.versions : [];
      const missing = reports?.ok && items.some((item) => !versions.some((v) => v.revision === item.reportRevision)
        || item.events.some((event) => event.type === 'replied' && event.appliedReportRevision !== null && !versions.some((v) => v.revision === event.appliedReportRevision)));
      const finalWarning = warning || (missing ? '의견에 연결한 보관 버전을 찾을 수 없어요. 기록을 보호하기 위해 저장을 중단했어요.' : '');
      return { ok: true, project, items, reports: versions, canWrite: !finalWarning && project.stage === 7, warning: finalWarning };
    }
    function write(data, items, nextNumber = data.nextNumber) {
      try { getStorage().setItem(STORAGE_KEY, JSON.stringify({ version: 1, nextNumber, items })); return { ok: true }; }
      catch { return { ok: false, error: '고객 검토 기록을 저장하지 못했어요. 입력 내용과 기존 기록은 유지했으니 저장 공간을 확인해 주세요.' }; }
    }
    function mutate(id, action, payload, expectedRevision, commentId) {
      const data = read(); if (!data.ok) return data;
      const state = list(id); if (!state.ok) return state;
      if (!state.canWrite) return { ok: false, error: state.warning || '보고서 단계(7)에서 고객 검토 의견을 기록할 수 있어요.' };
      if (!validText(payload.actor, 100)) return { ok: false, error: '기록하는 담당자 이름을 1~100자로 적어 주세요.' };
      let item; let index;
      if (action === 'create') {
        const report = state.reports.find((v) => v.revision === payload.reportRevision);
        if (!report) return { ok: false, error: '같은 프로젝트의 보관된 보고서 버전을 선택해 주세요.' };
        if (!validText(payload.content, 3000) || !validText(payload.reviewer, 100, false)) return { ok: false, error: '고객 의견은 1~3,000자, 고객 이름은 100자 이내로 적어 주세요.' };
        if (data.nextNumber >= Number.MAX_SAFE_INTEGER) return { ok: false, error: '새 의견 번호를 만들지 못했어요.' };
        item = { id: `CMT-${String(data.nextNumber).padStart(4, '0')}`, projectId: id, reportRevision: report.revision,
          reportTitle: report.title, content: payload.content.trim(), reviewer: payload.reviewer.trim(), events: [] };
      } else {
        index = data.items.findIndex((entry) => entry.projectId === id && entry.id === commentId);
        if (index < 0) return { ok: false, error: '고객 의견을 찾을 수 없어요.' };
        item = clone(data.items[index]);
        if (item.events.length !== expectedRevision) return { ok: false, error: '다른 화면에서 이 의견을 수정했어요. 입력 내용은 유지했으니 프로젝트를 다시 열어 최신 답변을 확인해 주세요.' };
      }
      const previous = item.events.length ? current(item) : null;
      const at = new Date(Math.max(Date.now(), previous ? Date.parse(previous.updatedAt) : 0)).toISOString();
      const event = { type: action === 'create' ? 'created' : action, actor: payload.actor.trim(), at };
      if (action === 'replied') {
        if (previous.status === '종결') return { ok: false, error: '종결된 의견은 재개한 뒤 답변해 주세요.' };
        if (!validText(payload.reply, 3000) || !Object.hasOwn(RESOLUTIONS, payload.resolution)) return { ok: false, error: '답변을 1~3,000자로 적고 처리 방법을 선택해 주세요.' };
        if (payload.resolution === 'report' && (!Number.isSafeInteger(payload.appliedReportRevision) || payload.appliedReportRevision <= item.reportRevision
          || !state.reports.some((v) => v.revision === payload.appliedReportRevision))) return { ok: false, error: `의견을 받은 v${item.reportRevision}보다 나중에 보관한 수정 보고서를 선택해 주세요.` };
        Object.assign(event, { reply: payload.reply.trim(), resolution: payload.resolution, appliedReportRevision: payload.resolution === 'report' ? payload.appliedReportRevision : null });
      } else if (action === 'closed') {
        if (previous.status !== '답변됨' || previous.resolution === 'pending') return { ok: false, error: '답변과 처리 방법을 먼저 저장해 주세요. 보고서를 수정했다면 반영한 버전도 선택해 주세요.' };
        if (payload.confirmed !== true) return { ok: false, error: '답변과 처리 내용을 확인한 뒤 종결 확인에 체크해 주세요.' };
      } else if (action === 'reopened') {
        if (previous.status !== '종결' || !validText(payload.reason, 1000)) return { ok: false, error: '종결된 의견을 다시 열려면 재개 사유를 1~1,000자로 적어 주세요.' };
        event.reason = payload.reason.trim();
      } else if (action !== 'create') return { ok: false, error: '처리 방법을 확인해 주세요.' };
      item.events.push(event);
      if (!validItem(item, projects)) return failure();
      const items = [...data.items];
      if (action === 'create') items.push(item); else items[index] = item;
      const saved = write(data, items, data.nextNumber + (action === 'create' ? 1 : 0));
      return saved.ok ? { ok: true, item: current(item) } : saved;
    }
    async function locked(...args) {
      try {
        if (typeof navigator !== 'undefined' && navigator.locks?.request) return await navigator.locks.request('ecoable-lca-manager.review-workflow-write', () => mutate(...args));
        return mutate(...args);
      } catch { return { ok: false, error: '고객 검토 기록 저장을 시작하지 못했어요. 입력 내용은 유지했으니 다시 시도해 주세요.' }; }
    }
    return { list, create: (id, draft) => locked(id, 'create', draft),
      respond: (id, commentId, draft, revision) => locked(id, 'replied', draft, revision, commentId),
      close: (id, commentId, draft, revision) => locked(id, 'closed', draft, revision, commentId),
      reopen: (id, commentId, draft, revision) => locked(id, 'reopened', draft, revision, commentId) };
  }
  return { STORAGE_KEY, STATUSES, RESOLUTIONS, createStore };
})();
