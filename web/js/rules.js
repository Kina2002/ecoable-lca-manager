/* 업무 규칙 (설계서 6장). 화면과 분리된 계산 함수만 둔다. 날짜는 'YYYY-MM-DD' 문자열. */
window.LCA = window.LCA || {};

LCA.rules = (() => {
  const C = LCA.constants;
  let fixedToday = null; // 테스트에서 오늘 날짜를 고정할 때 사용

  const pad = (n) => String(n).padStart(2, '0');
  const toStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  function today() {
    return fixedToday || toStr(new Date());
  }

  function setToday(value) {
    fixedToday = value;
  }

  function addDays(dateStr, n) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return toStr(new Date(y, m - 1, d + n));
  }

  // b - a (일). 둘 중 하나라도 없으면 null
  function daysBetween(a, b) {
    if (!a || !b) return null;
    const [ay, am, ad] = a.split('-').map(Number);
    const [by, bm, bd] = b.split('-').map(Number);
    return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
  }

  const isOpen = (item) => C.OPEN_STATUSES.includes(item.status);
  const counts = (item) => item.status !== '해당 없음';

  // 전체 명단을 단계별로 센다. 필터로 줄인 명단을 전달하지 않는 것이 중요하다.
  function stageCounts(projects) {
    const result = Object.fromEntries(C.STAGES.map((stage) => [stage.no, 0]));
    projects.forEach((project) => {
      if (Object.hasOwn(result, project.stage)) result[project.stage] += 1;
    });
    return result;
  }

  // 실제 프로젝트의 단계는 그대로 두고, 화면에 보여줄 명단만 골라 돌려준다.
  function projectsForStage(projects, stageNo = null) {
    return stageNo === null ? projects.slice() : projects.filter((project) => project.stage === stageNo);
  }

  // 아직 내야 하는 항목의 남은 날 (기한 - 오늘)
  function daysToDue(item, t = today()) {
    return isOpen(item) && item.dueDate ? daysBetween(t, item.dueDate) : null;
  }

  function isOverdue(item, t = today()) {
    const d = daysToDue(item, t);
    return d !== null && d < 0;
  }

  function dueNotice(item, t = today()) {
    const d = daysToDue(item, t);
    if (d === 0) return '오늘 마감';
    if (d === 1) return 'D-1';
    if (d === 3) return 'D-3';
    return null;
  }

  // 항목을 한 곳에만 센다: 기한 초과 → 보완 요청 → 임박(0~3일) → 검토 대기
  function kindOf(item, t = today()) {
    if (isOverdue(item, t)) return 'overdue';
    if (item.status === '보완 요청') return 'revision';
    const d = daysToDue(item, t);
    if (d !== null && d >= 0 && d <= 3) return 'dueSoon';
    if (item.status === '제출됨') return 'review';
    return null;
  }

  // 메일에서 이 항목을 넣을 묶음 (Salesforce 시연의 메일 분류 수식과 같은 규칙)
  function mailGroup(item, t = today()) {
    if (!isOpen(item)) return null;
    if (isOverdue(item, t)) return '기한 지난 자료';
    if (item.status === '보완 요청') return '보완이 필요한 자료';
    return '아직 기한 전인 자료';
  }

  // 데이터 기간이 12개월(360~370일)인지
  function isTwelveMonths(start, end) {
    const days = daysBetween(start, end);
    return days === null ? null : days + 1 >= 360 && days + 1 <= 370;
  }

  // 검증에 필요한 정보(값·단위·기간·출처·획득 방법·증빙)가 모두 있는지
  function isEvidenceComplete(item) {
    return Boolean(
      item.value !== '' && item.value !== null && item.value !== undefined && item.unit &&
      item.periodStart && item.periodEnd && item.activitySource && item.factorSource &&
      item.method && item.evidence && item.evidence.name
    );
  }

  function projectStats(project, items, comments = [], t = today()) {
    const own = items.filter((i) => i.projectId === project.id);
    const counted = own.filter(counts);
    const s = {
      total: counted.length,
      submitted: counted.filter((i) => C.SUBMITTED_STATUSES.includes(i.status)).length,
      approved: counted.filter((i) => i.status === '승인').length,
      overdue: 0, revision: 0, dueSoon: 0, review: 0,
      evidenceComplete: counted.filter((i) => C.SUBMITTED_STATUSES.includes(i.status) && isEvidenceComplete(i)).length,
      primaryBoth: counted.filter((i) => i.status === '승인' && i.activitySource === '1차' && i.factorSource === '1차').length
    };
    counted.forEach((i) => {
      const k = kindOf(i, t);
      if (k) s[k] += 1;
    });
    s.collectionRate = s.total ? Math.round((s.submitted / s.total) * 100) : null;
    s.approvalRate = s.total ? Math.round((s.approved / s.total) * 100) : null;
    const mine = comments.filter((c) => c.projectId === project.id);
    s.openComments = mine.filter((c) => c.status !== '종결').length;
    const verification = mine.filter((c) => c.kind === '제3자 검증');
    s.verificationRound = verification.reduce((max, c) => Math.max(max, c.round || 0), 0);
    s.openVerification = verification.filter((c) => c.status !== '종결').length;
    s.openCustomerReview = mine.filter((c) => c.kind === '고객 검토' && c.status !== '종결').length;
    return s;
  }

  // 비어 있는 기본 정보 (완료 단계는 제외)
  function missingInfo(project, items) {
    if (project.stage >= 10) return [];
    const missing = [];
    if (!project.contactId) missing.push('고객 담당자');
    if (!project.targetDate) missing.push('목표 완료일');
    if (!(project.functionalUnit && project.functionalUnit.qty && project.functionalUnit.unit)) missing.push('기능단위');
    if (!project.boundary) missing.push('시스템 경계');
    if (!project.refStart || !project.refEnd) missing.push('기준기간');
    if (project.stage >= 2 && !items.some((i) => i.projectId === project.id)) missing.push('데이터 요청 항목');
    return missing;
  }

  // 메일 종류 추천 (Salesforce 시연과 같은 규칙)
  function recommendMail(stats, missing) {
    if (stats.overdue > 0 || (stats.revision > 0 && stats.dueSoon > 0)) return 'reminder';
    if (stats.revision > 0) return 'revision';
    if (stats.dueSoon > 0) return 'dueSoon';
    return missing.length ? 'info' : null;
  }

  // 현재 단계에서 다음 단계로 가기 위한 조건
  function gateCheck(project, items, comments) {
    const stage = C.stageByNo(project.stage);
    const own = items.filter((i) => i.projectId === project.id && counts(i));
    const unmet = [];
    switch (stage && stage.gate) {
      case 'assigned':
        if (!project.contactId) unmet.push('고객 담당자를 지정하세요');
        if (!project.researcherId) unmet.push('담당 연구원을 지정하세요');
        break;
      case 'scope':
        if (!(project.functionalUnit && project.functionalUnit.qty && project.functionalUnit.unit)) unmet.push('기능단위를 입력하세요');
        if (!project.boundary) unmet.push('시스템 경계를 고르세요');
        if (!project.refStart || !project.refEnd) unmet.push('기준기간을 입력하세요');
        if (!project.standards || !project.standards.length) unmet.push('적용 기준을 고르세요');
        break;
      case 'allSubmitted': {
        if (!own.length) unmet.push('데이터 요청 항목을 만드세요');
        const notYet = own.filter((i) => !C.SUBMITTED_STATUSES.includes(i.status)).length;
        if (notYet) unmet.push(`아직 제출되지 않은 항목 ${notYet}개`);
        break;
      }
      case 'allApproved': {
        const notApproved = own.filter((i) => i.status !== '승인').length;
        if (notApproved) unmet.push(`아직 승인되지 않은 항목 ${notApproved}개`);
        break;
      }
      case 'customerReviewClosed': {
        const open = comments.filter((c) => c.projectId === project.id && c.kind === '고객 검토' && c.status !== '종결').length;
        if (open) unmet.push(`종결되지 않은 고객 검토 의견 ${open}개`);
        break;
      }
      case 'verificationClosed': {
        const open = comments.filter((c) => c.projectId === project.id && c.kind === '제3자 검증' && c.status !== '종결').length;
        if (open) unmet.push(`종결되지 않은 검증 지적 ${open}개`);
        break;
      }
      default:
        break;
    }
    return { ok: unmet.length === 0, unmet };
  }

  // 손이 많이 가는 정도 (클수록 위로)
  function urgency(stats, missing) {
    return stats.overdue * 10000 + stats.revision * 1000 + stats.dueSoon * 100 + stats.review * 10 + (missing.length ? 1 : 0);
  }

  // 오늘 할 일: 저장하지 않고 매번 규칙으로 계산 (같은 할 일이 두 번 생기지 않음)
  function todayTasks(state, t = today()) {
    const tasks = [];
    const active = state.projects.filter((p) => p.stage < 10);
    active.forEach((p) => {
      state.items.filter((i) => i.projectId === p.id && counts(i)).forEach((i) => {
        const k = kindOf(i, t);
        const d = daysToDue(i, t);
        if (k === 'overdue') tasks.push({ kind: 'overdue', score: 400 + Math.min(-d, 99), label: `기한 초과 ${-d}일`, projectId: p.id, itemId: i.id, text: i.category, mail: 'reminder' });
        if (k === 'revision') tasks.push({ kind: 'revision', score: 300, label: '보완 요청', projectId: p.id, itemId: i.id, text: i.category, mail: 'revision' });
        if (k === 'dueSoon') tasks.push({ kind: 'dueSoon', score: 200 + (3 - d), label: d === 0 ? '오늘 마감' : `D-${d}`, projectId: p.id, itemId: i.id, text: i.category, mail: 'dueSoon' });
        if (k === 'review') tasks.push({ kind: 'review', score: 150, label: '검토 대기', projectId: p.id, itemId: i.id, text: i.category });
      });
      const missing = missingInfo(p, state.items);
      if (missing.length) tasks.push({ kind: 'info', score: 100, label: '정보 확인', projectId: p.id, text: `${missing.join(', ')} 비어 있음`, mail: 'info' });
      const open = state.comments.filter((c) => c.projectId === p.id && c.status === '열림').length;
      if (open) tasks.push({ kind: 'comment', score: 120, label: '의견 답변', projectId: p.id, text: `열린 검토 의견 ${open}개` });
    });
    return tasks.sort((a, b) => b.score - a.score);
  }

  return {
    today, setToday, addDays, daysBetween, stageCounts, projectsForStage, daysToDue, isOverdue, dueNotice, kindOf, mailGroup,
    isTwelveMonths, isEvidenceComplete, projectStats, missingInfo, recommendMail, gateCheck, urgency, todayTasks, isOpen
  };
})();
