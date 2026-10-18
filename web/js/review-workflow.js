/* 고객 검토와 제3자 지적에서 공통으로 사용하는 답변 이력 규칙. */
window.LCA = window.LCA || {};
LCA.reviewWorkflow = (() => {
  const STATUSES = ['열림', '답변됨', '종결'];
  const RESOLUTIONS = { pending: '처리 방법 미정', report: '보고서 수정', explanation: '설명으로 해결' };
  const text = (value, limit, required = true) => typeof value === 'string' && (!required || !!value.trim()) && value.length <= limit;
  const date = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value));
  const clone = (value) => JSON.parse(JSON.stringify(value));
  function current(item) {
    const result = { ...clone(item), status: '열림', reply: '', responder: '', resolution: 'pending', appliedReportRevision: null, closedAt: '' };
    for (const event of item.events) {
      if (event.type === 'replied') Object.assign(result, { status: '답변됨', reply: event.reply, responder: event.actor, resolution: event.resolution, appliedReportRevision: event.appliedReportRevision });
      if (event.type === 'closed') Object.assign(result, { status: '종결', closedAt: event.at });
      if (event.type === 'reopened') Object.assign(result, { status: '열림', closedAt: '', resolution: 'pending', appliedReportRevision: null });
    }
    return { ...result, revision: item.events.length, createdAt: item.events[0].at, updatedAt: item.events.at(-1).at };
  }
  function validEvents(events, reportRevision) {
    if (!Array.isArray(events) || !events.length) return false;
    let status = '열림'; let resolution = 'pending'; let lastDate = '';
    for (const [index, event] of events.entries()) {
      if (!event || !text(event.actor, 100) || !date(event.at) || (lastDate && Date.parse(event.at) < Date.parse(lastDate))) return false;
      lastDate = event.at;
      if (index === 0) { if (event.type !== 'created') return false; continue; }
      if (event.type === 'replied') {
        if (status === '종결' || !text(event.reply, 3000) || !Object.hasOwn(RESOLUTIONS, event.resolution)) return false;
        if (event.resolution === 'report') {
          if (!Number.isSafeInteger(event.appliedReportRevision) || event.appliedReportRevision <= reportRevision) return false;
        } else if (event.appliedReportRevision !== null) return false;
        status = '답변됨'; resolution = event.resolution;
      } else if (event.type === 'closed') {
        if (status !== '답변됨' || resolution === 'pending') return false;
        status = '종결';
      } else if (event.type === 'reopened') {
        if (status !== '종결' || !text(event.reason, 1000)) return false;
        status = '열림'; resolution = 'pending';
      } else return false;
    }
    return true;
  }
  return { STATUSES, RESOLUTIONS, text, date, clone, current, validEvents };
})();
