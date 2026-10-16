/* 현재 프로젝트의 전체 건수와 선택 상태의 목록을 별도로 계산한다. */
window.LCA = window.LCA || {};
LCA.requestFilter = (() => {
  const STATUSES = ['요청', '제출됨', ...LCA.review.STATUSES];
  function snapshot(items, projectId, selectedStatus = null) {
    const active = items.filter((item) => item.projectId === projectId && !item.deletedAt && STATUSES.includes(item.status));
    const counts = Object.fromEntries(STATUSES.map((status) => [status, 0]));
    for (const item of active) counts[item.status]++;
    return { total: active.length, counts, visible: selectedStatus === null ? active : active.filter((item) => item.status === selectedStatus) };
  }
  return { STATUSES, snapshot };
})();
