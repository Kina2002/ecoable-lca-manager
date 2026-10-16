/* 날짜 경과와 업무 상태를 분리한다. D+는 기한 경과이며 고객의 제출 지연 판정이 아니다. */
window.LCA = window.LCA || {};
LCA.deadlines = (() => {
  function dayNumber(value) {
    if (!LCA.requests.validDate(value)) return null;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(0);
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCFullYear(year, month - 1, day);
    return date.getTime() / 86400000;
  }
  function refresh(summary, today = LCA.rules.today()) {
    if (summary.staticText) return summary;
    const due = dayNumber(summary.date), now = dayNumber(today);
    if (due === null || now === null) return { ...summary, text: '기한 확인 필요', tone: 'unknown', days: null };
    const days = due - now;
    const text = days > 0 ? `D-${days}` : days < 0 ? `D+${-days}` : 'D-0';
    const reviewing = ['제출됨', '검토 중'].includes(summary.status);
    const tone = reviewing ? 'review' : days < 0 ? 'elapsed' : days <= 3 ? 'soon' : 'upcoming';
    return { ...summary, text, tone, days };
  }
  function project(project, today = LCA.rules.today()) {
    return project.stage === 10 ? { staticText: true, text: '완료', tone: 'complete', date: project.targetDate, status: null }
      : refresh({ date: project.targetDate, status: null }, today);
  }
  function item(item, today = LCA.rules.today()) {
    if (item.deletedAt) return { staticText: true, text: '삭제됨', tone: 'muted', date: item.dueDate, status: '삭제됨' };
    if (item.status === '승인') return { staticText: true, text: '승인', tone: 'complete', date: item.dueDate, status: item.status };
    return refresh({ date: item.dueDate, status: item.status }, today);
  }
  function summary(projectId, items, today = LCA.rules.today()) {
    const own = items.filter((record) => record.projectId === projectId && !record.deletedAt);
    const pending = own.filter((record) => record.status !== '승인');
    const counts = { total: own.length, approved: own.length - pending.length, pending: pending.length };
    if (!own.length) return { ...counts, staticText: true, text: '요청 없음', tone: 'muted', status: null };
    if (!pending.length) return { ...counts, staticText: true, text: '자료 검토 완료', tone: 'complete', status: null };
    if (pending.some((record) => dayNumber(record.dueDate) === null)) return { ...counts, staticText: true, text: '기한 확인 필요', tone: 'unknown', status: null };
    // 같은 날짜는 기존 등록 순서를 유지한다. 조회할 때 원본을 정렬하지 않는다.
    const earliest = pending.slice().sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
    return { ...item(earliest, today), ...counts, sourceId: earliest.id, categoryKey: earliest.categoryKey };
  }
  return { dayNumber, refresh, project, item, summary };
})();
