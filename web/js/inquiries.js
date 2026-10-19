/* 자료 질의는 요청 상태와 독립된, 덧붙이는 질문/답변 이력이다. */
window.LCA = window.LCA || {};
LCA.inquiries = (() => {
  const OUTCOMES = { pending: '확인 중', explanation: '설명으로 해결', data: '수정 자료에 반영' };
  const text = (v, n) => typeof v === 'string' && !!v.trim() && v === v.trim() && v.length <= n;
  const date = (v) => typeof v === 'string' && Number.isFinite(Date.parse(v));
  const clone = (v) => JSON.parse(JSON.stringify(v));
  function current(item) {
    const out = { ...clone(item), status: '열림', reply: '', outcome: 'pending', receiptUpdatedAt: null, closedAt: '' };
    for (const e of item.events) {
      if (e.type === 'answered') Object.assign(out, { status: '답변됨', reply: e.reply, outcome: e.outcome, receiptUpdatedAt: e.receiptUpdatedAt });
      if (e.type === 'closed') Object.assign(out, { status: '종결', closedAt: e.at });
      if (e.type === 'reopened') Object.assign(out, { status: '열림', reply: '', outcome: 'pending', receiptUpdatedAt: null, closedAt: '' });
    }
    return { ...out, revision: item.events.length, createdAt: item.events[0].at, updatedAt: item.events.at(-1).at };
  }
  function validLog(log, requests, projects) {
    if (!log || !Number.isSafeInteger(log.nextNumber) || log.nextNumber < 1 || !Array.isArray(log.items)) return false;
    const seen = new Set();
    for (const item of log.items) {
      if (!item || !/^INQ-[0-9]{4,}$/.test(item.id) || !Number.isSafeInteger(Number(item.id.slice(4))) || Number(item.id.slice(4)) < 1
        || Number(item.id.slice(4)) >= log.nextNumber || seen.has(item.id) || !projects.has(item.projectId)
        || !requests.some((r) => r.id === item.requestId && r.projectId === item.projectId && r.categoryKey === item.target?.categoryKey)
        || !text(item.content, 3000) || !item.target || !text(item.target.detail, 1000) || !text(item.target.categoryKey, 100)
        || !(item.target.receiptUpdatedAt === null || date(item.target.receiptUpdatedAt)) || !Array.isArray(item.events) || !item.events.length) return false;
      let status = '열림'; let outcome = 'pending'; let last = 0;
      for (const [index, e] of item.events.entries()) {
        if (!e || !text(e.actor, 100) || !date(e.at) || Date.parse(e.at) < last) return false;
        last = Date.parse(e.at);
        if (!index) { if (e.type !== 'created') return false; continue; }
        if (e.type === 'answered') {
          if (status === '종결' || !text(e.reply, 3000) || !Object.hasOwn(OUTCOMES, e.outcome)
            || (e.outcome === 'data' ? !date(e.receiptUpdatedAt) || e.receiptUpdatedAt === item.target.receiptUpdatedAt : e.receiptUpdatedAt !== null)) return false;
          status = '답변됨'; outcome = e.outcome;
        } else if (e.type === 'closed') {
          if (status !== '답변됨' || outcome === 'pending' || !text(e.note, 1000)) return false;
          status = '종결';
        } else if (e.type === 'reopened') {
          if (status !== '종결' || !text(e.reason, 1000)) return false;
          status = '열림'; outcome = 'pending';
        } else return false;
      }
      seen.add(item.id);
    }
    return true;
  }
  function apply(log, requests, projects, projectId, action, draft, id, revision) {
    const fail = (error) => ({ ok: false, error });
    if (!draft || !text(draft.actor?.trim(), 100)) return fail('기록 담당자를 1~100자로 입력해 주세요.');
    const data = clone(log); let item = data.items.find((v) => v.id === id && v.projectId === projectId);
    let request;
    if (action === 'create') {
      request = requests.find((r) => r.id === draft.requestId && r.projectId === projectId && !r.deletedAt && r.status !== '해당 없음');
      if (!request || !text(draft.content?.trim(), 3000) || !Number.isSafeInteger(data.nextNumber + 1)) return fail('현재 프로젝트의 자료와 1~3,000자의 질문을 확인해 주세요.');
      item = { id: `INQ-${String(data.nextNumber++).padStart(4, '0')}`, projectId, requestId: request.id, content: draft.content.trim(),
        target: { categoryKey: request.categoryKey, detail: request.detail, receiptUpdatedAt: request.receipt?.updatedAt || null }, events: [] };
      data.items.push(item);
    } else {
      if (!item || item.events.length !== revision) return fail('질의 기록이 바뀌었어요. 작성 중인 내용을 보관하고 최신 기록을 불러와 주세요.');
      request = requests.find((r) => r.id === item.requestId && r.projectId === projectId && !r.deletedAt && r.status !== '해당 없음');
      if (!request) return fail('삭제되었거나 해당 없음인 자료의 질의는 이력만 볼 수 있어요.');
    }
    const previous = item.events.length ? current(item) : null;
    const e = { type: action === 'create' ? 'created' : action, actor: draft.actor.trim(), at: new Date(Math.max(Date.now(), previous ? Date.parse(previous.updatedAt) : 0)).toISOString() };
    if (action === 'answered') {
      if (previous.status === '종결' || !text(draft.reply?.trim(), 3000) || !Object.hasOwn(OUTCOMES, draft.outcome)) return fail('답변과 처리 방법을 확인해 주세요. 종결된 질의는 먼저 재개해 주세요.');
      const updated = request.receipt?.updatedAt;
      if (draft.outcome === 'data' && (!updated || updated === item.target.receiptUpdatedAt)) return fail('질문을 등록한 뒤 수정 자료를 먼저 기록해 주세요. 단순 설명이면 설명으로 해결을 선택해 주세요.');
      Object.assign(e, { reply: draft.reply.trim(), outcome: draft.outcome, receiptUpdatedAt: draft.outcome === 'data' ? updated : null });
    } else if (action === 'closed') {
      if (previous.status !== '답변됨' || previous.outcome === 'pending' || draft.confirmed !== true || !text(draft.note?.trim(), 1000)) return fail('해결한 답변·처리 방법과 종결 근거를 적고 확인에 체크해 주세요.');
      if (previous.outcome === 'data' && request.receipt?.updatedAt !== previous.receiptUpdatedAt) return fail('답변 이후 받은 자료가 다시 바뀌었어요. 최신 자료를 확인하고 답변을 다시 기록해 주세요.');
      e.note = draft.note.trim();
    } else if (action === 'reopened') {
      if (previous.status !== '종결' || !text(draft.reason?.trim(), 1000)) return fail('종결한 질의에 재개 사유를 적어 주세요.');
      e.reason = draft.reason.trim();
    } else if (action !== 'create') return fail('질의 처리 방법을 확인해 주세요.');
    item.events.push(e);
    return validLog(data, requests, projects) ? { ok: true, log: data, item: current(item) } : fail('질의 기록의 형식을 확인하지 못해 저장하지 않았어요.');
  }
  return { OUTCOMES, current, validLog, apply };
})();
