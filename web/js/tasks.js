window.LCA = window.LCA || {};
LCA.tasks = (() => {
  const KINDS = { overdue: '기한 초과', soon: '마감 임박', revision: '보완 요청', resubmission: '보고서 보완', certification: '인증 상태 확인', renewal: '갱신 확인', inspection: '연간 점검', review: '자료 검토', inquiry: '자료 질의', comment: '고객 의견', verification: '검증 지적', info: '정보 확인' };
  const ORDER = { overdue: 0, revision: 1, resubmission: 1, certification: 2, renewal: 2, inspection: 3, soon: 4, review: 5, verification: 6, comment: 7, inquiry: 7, info: 8 };
  function build({ projects, requests, inquiries, comments, verifications, certifications }, today = LCA.rules.today()) {
    const items = []; const warnings = [];
    if (!requests.ok) warnings.push(requests.message || '자료 요청을 읽지 못했어요. 자료 관련 할 일은 계산하지 않았어요.');
    if (!comments.ok) warnings.push(comments.error || '고객 의견을 읽지 못했어요. 고객 의견 할 일은 계산하지 않았어요.');
    if (inquiries && !inquiries.ok) warnings.push(inquiries.message || '자료 질의를 읽지 못했어요.');
    if (certifications && !certifications.ok) warnings.push(certifications.error || '인증 기록을 읽지 못했어요. 갱신 확인 할 일은 계산하지 않았어요.');
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
      if (project.stage < 9) missing.push(...(LCA.projects?.missingInformation(project) || []));
      if (project.stage >= 2 && project.stage < 9) {
        missing.push(...LCA.scope.missing(project));
        if (project.scopeStatus !== '확정') missing.push('평가 범위 합의·확정');
      }
      if (project.stage < 9 && missing.length) add(project, 'info', 'missing', '프로젝트 정보 확인', [...new Set(missing)].join(' · '), 'overview',
        { infoKeys: LCA.requestMessage?.infoTargets(project).map((item) => item.id) || [] });
      if (requests.ok && project.stage >= 3 && project.stage < 9 && !own.length) add(project, 'info', 'requests-empty', '필요한 자료 요청 확인', '현재 등록한 자료 요청이 없어요. 필요한 자료 구분과 내용을 확인해 주세요.', 'requests');
      if (comments.ok) for (const comment of comments.items.filter((c) => c.projectId === project.id && c.status !== '종결')) {
        add(project, 'comment', `comment:${comment.id}`, comment.status === '답변됨' ? '고객 의견 종결 확인' : '고객 의견 답변 확인',
          `${comment.id} · 보고서 v${comment.reportRevision} · ${comment.content}`, 'comments', { commentId: comment.id, status: comment.status,
            readOnly: project.stage !== 7 });
      }
      if (project.stage < 9 && inquiries?.ok) for (const item of inquiries.items.filter((q) => q.projectId === project.id && q.status !== '종결' && q.requestActive)) {
        add(project, 'inquiry', `inquiry:${item.id}`, item.status === '답변됨' ? '자료 질의 종결 확인' : '자료 질의 답변 확인',
          `${item.id} · ${item.requestId} · ${item.content}`, 'opinions', { inquiryId: item.id, status: item.status });
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
    if (certifications?.ok) for (const saved of certifications.items) {
      const project = projects.find((p) => p.id === saved.projectId);
      if (project && saved.amendment) {
        add(project, 'resubmission', 'resubmission', `${saved.amendment.number}차 제출 보완 이어가기`,
          `이전 제출 보고서 v${saved.amendment.reportRevision} · 수정 보고서 작성, 재검토와 완료 근거를 확인한 뒤 재제출을 기록해 주세요.`, 'certification');
        if (saved.status !== '승인·등록') continue;
      }
      if (!project || project.stage < 9 && !saved.amendment) continue;
      const certificationStatus = LCA.certification.currentStatus({ status: saved.status, details: saved.details },
        { validity: saved.officialExpiryOn ? { expiryOn: saved.officialExpiryOn } : null, statusChecks: saved.statusChecks || [], cancelled: saved.cancelled }, today);
      if (saved.status === '승인·등록' && saved.details.kind !== '고객 제출' && certificationStatus.label === '확인 필요') {
        add(project, 'certification', 'certification-status', '인증·등록의 현재 상태 확인', certificationStatus.detail, 'certification', { status: certificationStatus.label });
      }
      if (saved.cancelled) continue;
      if (saved.status === '승인·등록' && saved.details.kind === '등록' && saved.details.scheme.trim() === 'International EPD') {
        if (!saved.inspectionPlan) add(project, 'inspection', 'inspection-plan', 'International EPD 점검 기준일 확인',
          'EPD 문서의 최신 버전과 버전일을 기록하면 연간 점검 예정일과 30일 전 안내를 계산해요.', 'certification');
        else {
          const check = LCA.certification.inspectionSchedule(saved.details, saved.status, saved.inspectionPlan, saved.inspections || [], today, saved.officialExpiryOn);
          if (check?.active) add(project, 'inspection', `inspection:${check.date}`, `International EPD 연간 점검 ${check.latest?.status === '점검 중' ? '이어가기' : '확인'}`,
            `EPD 버전 ${saved.inspectionPlan.version} · 기준 버전일 ${saved.inspectionPlan.versionOn} · 점검 예정일 ${check.date}. 제품·생산 조건·자료 변경 여부와 확인 결과를 기록해 주세요.`,
            'certification', { date: check.date, days: check.days, status: check.latest?.status || '점검 전' });
        }
      }
      const schedule = LCA.certification.renewalSchedule(saved.details, saved.status, today, saved.officialExpiryOn);
      if (!schedule?.active) continue;
      add(project, 'renewal', 'renewal', schedule.days < 0 ? `${schedule.official ? '기록한' : '예상'} 만료일 경과 · 갱신 확인` : `${schedule.scheme} ${saved.renewalProgress?.status || schedule.label}`,
        `${schedule.scheme} · ${schedule.official ? '문서에서 확인한' : '예상'} 만료일 ${schedule.date} · ${saved.renewalProgress ? `${saved.renewalProgress.status} (${saved.renewalProgress.actionOn}) · ` : ''}${schedule.days < 0 ? '갱신 여부와 기관의 현재 등록 상태를 확인해 주세요.' : `${schedule.label}를 시작할 시기예요.`} ${schedule.official ? '기록한 문서와 기관의 최신 등록 상태를 확인해 주세요.' : '발급 문서·기관 등록 기록의 실제 날짜를 먼저 확인해 주세요.'}`,
        'certification', { date: schedule.date, days: schedule.days, official: !!schedule.official, status: saved.renewalProgress?.status || saved.status });
    }
    items.sort((a, b) => {
      const priority = (task) => ['verification', 'renewal', 'inspection'].includes(task.kind) && task.days < 0 ? 0 : ORDER[task.kind];
      return priority(a) - priority(b) || (a.days ?? Infinity) - (b.days ?? Infinity) || a.code.localeCompare(b.code) || a.id.localeCompare(b.id);
    });
    return { ok: true, items, warnings: [...new Set(warnings)], today };
  }
  function deadline(item) {
    const known = item.date && typeof item.days === 'number' && Number.isFinite(item.days);
    return {
      text: !known ? '기한 미정' : item.days < 0 ? `D+${-item.days}` : item.days === 0 ? 'D-DAY' : `D-${item.days}`,
      detail: known ? `${item.date}${item.days === 0 ? ' · 오늘' : ''}` : '',
      label: item.kind === 'review' ? '제출 기한 · 제출 완료' : item.kind === 'renewal' ? item.official ? '기록한 만료일' : '예상 만료일' : item.kind === 'inspection' ? '점검 예정일' : item.requestId ? '제출 기한' : item.issueId ? '지적 처리 기한' : '처리 기한',
      tone: item.kind === 'review' ? 'review' : !known ? 'unknown' : item.days < 0 ? 'elapsed' : item.days <= 3 ? 'soon' : 'upcoming'
    };
  }
  return { KINDS, build, deadline };
})();
