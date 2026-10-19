window.LCA = window.LCA || {};
LCA.dashboard = (() => {
  const RANK = { overdue: 0, revision: 1, soon: 2, verification: 3, comment: 4, info: 5, review: 6 };
  function build({ projects, requests, tasks, researchers }, today = LCA.rules.today(), researcher = '') {
    const options = new Map(LCA.projectFilter.researcherOptions(projects).map((person) => [person.id, person.label]));
    if (researchers?.ok) for (const person of researchers.items) options.set(person.id, `${person.name} · ${LCA.projectFilter.researcherCode(person.id)}`);
    const researcherOptions = [['', '담당 연구원 전체'], ...options, ['unassigned', '담당 연구원 미정'], ['legacy', '기존 이름 기록']];
    const active = LCA.projectFilter.select(projects, null, { researcher }).filter((p) => p.stage < 10);
    const ids = new Set(active.map((p) => p.id));
    const taskItems = tasks.items.filter((item) => ids.has(item.projectId));
    const own = requests.ok ? requests.items.filter((r) => ids.has(r.projectId) && !r.deletedAt) : [];
    const applicable = own.filter((r) => r.status !== '해당 없음');
    const received = applicable.filter((r) => !!r.receipt && r.status !== '요청');
    const approved = received.filter((r) => r.status === '승인');
    const attention = [];
    for (const project of active) {
      const mine = taskItems.filter((task) => task.projectId === project.id);
      const reasons = []; let rank = Infinity; let days = Infinity;
      const target = LCA.deadlines.project(project, today);
      if (target.days !== null && target.days <= 3) {
        reasons.push(`프로젝트 목표 ${target.text}`); rank = target.days < 0 ? 0 : 2; days = target.days;
      }
      if (project.stage === 3 && project.collectionDueDate) {
        const deadline = LCA.deadlines.collection(project, today);
        if (deadline.days !== null && deadline.days <= 3) {
          reasons.push(`자료 수집 마감 ${deadline.text}`); rank = Math.min(rank, deadline.days < 0 ? 0 : 2); days = Math.min(days, deadline.days);
        }
      }
      for (const [kind, label] of Object.entries(LCA.tasks.KINDS)) {
        const matching = mine.filter((task) => task.kind === kind);
        if (matching.length) {
          reasons.push(`${label} ${matching.length}건`);
          rank = Math.min(rank, kind === 'verification' && matching.some((t) => t.days !== null && t.days < 0) ? 0 : RANK[kind]);
          for (const item of matching) if (typeof item.days === 'number') days = Math.min(days, item.days);
        }
      }
      if (reasons.length) attention.push({ id: project.id, code: project.code, companyName: project.companyName, productName: project.productName,
        researcherName: project.researcherName || '', stage: project.stage, reasons, rank, days: Number.isFinite(days) ? days : null });
    }
    attention.sort((a, b) => a.rank - b.rank || (a.days ?? Infinity) - (b.days ?? Infinity) || a.code.localeCompare(b.code));
    const percent = (count, total) => total ? Math.round(count / total * 100) : null;
    return { ok: true, today, researcherOptions, researcherLabel: researcher ? researcherOptions.find(([id]) => id === researcher)?.[1] || '이전 선택 연구원' : '담당 연구원 전체', activeCount: active.length, requestsOk: requests.ok,
      collection: { total: applicable.length, received: received.length, percent: requests.ok ? percent(received.length, applicable.length) : null },
      approval: { total: received.length, approved: approved.length, percent: requests.ok ? percent(approved.length, received.length) : null },
      registeredProjects: new Set(own.map((r) => r.projectId)).size,
      attentionCount: attention.length, attention: attention.slice(0, 3), taskCount: taskItems.length, tasks: taskItems.slice(0, 3),
      warnings: [...tasks.warnings, ...(researchers && !researchers.ok ? ['연구원 명단을 읽지 못해 프로젝트에 연결된 연구원만 선택할 수 있어요.'] : [])] };
  }
  return { build };
})();
