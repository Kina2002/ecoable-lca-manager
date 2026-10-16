/* 담당자가 요청에 맞는 자료인지 확인한다. 파일 내용 자동 판정과 구분한다. */
window.LCA = window.LCA || {};
LCA.review = (() => {
  const CHECKS = [
    { key: 'period', label: '요청한 기간의 자료인가요?' },
    { key: 'scope', label: '요청한 제품·사업장에 해당하는 자료인가요?' },
    { key: 'complete', label: '요청한 항목과 증빙이 빠짐없이 있나요?' }
  ];
  const STATUSES = ['검토 중', '보완 요청', '승인'];
  const MAX_NOTE = 1000;
  const emptyChecks = () => Object.fromEntries(CHECKS.map(({ key }) => [key, false]));
  function validate(draft, action) {
    const errors = {};
    if (!['draft', 'approve', 'revision'].includes(action)) errors.action = '검토 처리 방법을 확인해 주세요.';
    if (!draft?.checks || CHECKS.some(({ key }) => typeof draft.checks[key] !== 'boolean')) errors.checks = '세 가지 확인 항목의 체크 상태를 확인해 주세요.';
    else if (action === 'approve' && CHECKS.some(({ key }) => !draft.checks[key])) errors.checks = '세 가지 항목을 모두 확인한 뒤 승인해 주세요.';
    if (typeof draft?.note !== 'string' || draft.note.trim().length > MAX_NOTE) errors.note = '검토 메모·보완 사유는 1,000자까지 적을 수 있어요.';
    else if (action === 'revision' && !draft.note.trim()) errors.note = '어떤 자료를 보완해야 하는지 이유를 적어 주세요.';
    return errors;
  }
  function validRecord(review, status, receipt) {
    if (!STATUSES.includes(status) || !review || !receipt || review.receiptUpdatedAt !== receipt.updatedAt) return false;
    const action = status === '승인' ? 'approve' : status === '보완 요청' ? 'revision' : 'draft';
    if (Object.keys(validate(review, action)).length || review.note !== review.note.trim()) return false;
    if (!['startedAt', 'updatedAt'].every((key) => typeof review[key] === 'string' && Number.isFinite(Date.parse(review[key])))) return false;
    return review.startedAt <= review.updatedAt;
  }
  return { CHECKS, STATUSES, MAX_NOTE, emptyChecks, validate, validRecord };
})();
