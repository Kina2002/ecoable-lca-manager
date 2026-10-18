window.LCA = window.LCA || {};
LCA.tasks = (() => {
  const KINDS = { overdue: '기한 초과', soon: '마감 임박', revision: '보완 요청', review: '자료 검토', comment: '고객 의견', verification: '검증 지적', info: '정보 확인' };
  const ORDER = { overdue: 0, revision: 1, soon: 2, review: 3, verification: 4, comment: 5, info: 6 };
  function build({ projects, requests, comments, verifications }, today = LCA.rules.today()) {
    const items = []; const warnings = [];
    if (!requests.ok) warnings.push(requests.message || '자료 요청을 읽지 못했어요. 자료 관련 할 일은 계산하지 않았어요.');
    if (!comments.ok) warnings.push(comments.error || '고객 의견을 읽지 못했어요. 고객 의견 할 일은 계산하지 않았어요.');
    function add(project, kind, key, title, description, tab, extra = {}) {
      items.push({ id: `${project.id}:${key}`, projectId: project.id, code: project.code, companyName: project.companyName,
        productName: project.productName, researcherName: project.researcherName || '', researcherId: project.researcherId || '',
        stage: project.stage, kind, title, description, tab, ...extra });
    }
    for (const project of projects.filter((p) => p.stage < 10)) {
      const own = requests.ok ? requests.items.filter((r) => r.projectId === project.id && !r.deletedAt) : [];
      if (project.stage < 9) for (const request of own) {
        if (request.status === '승인') continue;
        const category = LCA.constants.CATEGORIES.find((c) => c.key === request.categoryKey)?.name || request.categoryKey;
        const deadline = LCA.deadlines.item(request, today);
        const extra = { requestId: request.id, date: request.dueDate, days: deadline.days, status: request.status };
        const detail = `${request.id} · ${request.detail}`;
        if (request.status === '보완 요청') add(project, 'revision', `request:${request.id}`, `${category} 보완 자료 확인`, `${detail}${request.review?.note ? ` · 보완 사유: ${request.review.note}` : ''}`, 'requests', extra);
        else if (['제출됨', '검토 중'].includes(request.status)) add(project, 'review', `request:${request.id}`, `${category} ${request.status === '제출됨' ? '검토 시작' : '검토 이어가기'}`, `${detail} · 자료는 제출됐어요. 기한 경과를 고객의 제출 지연으로 판단하지 않아요.`, 'requests', extra);
        else if (request.status === '요청' && deadline.days !== null && deadline.days < 0) add(project, 'overdue', `request:${request.id}`, `${category} 미제출 자료 확인`, detail, 'requests', extra);
        else if (request.status === '요청' && deadline.days !== null && deadline.days <= 3) add(project, 'soon', `request:${request.id}`, `${category} 제출 일정 확인`, detail, 'requests', extra);
      }
      const missing = [];
      if (!project.customerContactName?.trim()) missing.push('고객 담당자');
      if (!project.researcherName?.trim()) missing.push('담당 연구원');
      if (!LCA.requests.validDate(project.targetDate)) missing.push('목표 완료일');
      if (project.stage >= 2 && project.stage < 9) {
        missing.push(...LCA.scope.missing(project));
        if (project.scopeStatus !== '확정') missing.push('평가 범위 합의·확정');
      }
      if (project.stage < 9 && missing.length) add(project, 'info', 'missing', '프로젝트 정보 확인', [...new Set(missing)].join(' · '), 'overview');
      if (requests.ok && project.stage >= 3 && project.stage < 9 && !own.length) add(project, 'info', 'requests-empty', '필요한 자료 요청 확인', '현재 등록한 자료 요청이 없어요. 필요한 자료 구분과 내용을 확인해 주세요.', 'requests');
      if (comments.ok) for (const comment of comments.items.filter((c) => c.projectId === project.id && c.status !== '종결')) {
        add(project, 'comment', `comment:${comment.id}`, comment.status === '답변됨' ? '고객 의견 종결 확인' : '고객 의견 답변 확인',
          `${comment.id} · 보고서 v${comment.reportRevision} · ${comment.content}`, 'comments', { commentId: comment.id, status: comment.status,
            readOnly: project.stage !== 7 });
      }
      const verification = verifications[project.id];
      if (!verification?.ok) { warnings.push(`${project.companyName}: ${verification?.error || '검증 기록을 읽지 못했어요.'}`); continue; }
      for (const saved of verification.record?.issues || []) {
        const issue = LCA.reviewWorkflow.current(saved); if (issue.status === '종결') continue;
        const deadline = LCA.deadlines.refresh({ date: issue.dueDate, status: null }, today);
        add(project, 'verification', `verification:${issue.id}`, `${issue.round}차 검증 지적 ${issue.status === '답변됨' ? '종결 확인' : '답변 확인'}`,
          `${issue.id} · 보고서 v${issue.reportRevision} · ${issue.content}`, 'verification', { issueId: issue.id, date: issue.dueDate,
            days: deadline.days, status: issue.status, readOnly: project.stage !== 8 });
      }
    }
    items.sort((a, b) => {
      const priority = (task) => task.kind === 'verification' && task.days < 0 ? 0 : ORDER[task.kind];
      return priority(a) - priority(b) || (a.days ?? Infinity) - (b.days ?? Infinity) || a.code.localeCompare(b.code) || a.id.localeCompare(b.id);
    });
    return { ok: true, items, warnings: [...new Set(warnings)], today };
  }
  return { KINDS, build };
})();
