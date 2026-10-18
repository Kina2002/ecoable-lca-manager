window.LCA = window.LCA || {};
LCA.dashboard = (() => {
  const RANK = { overdue: 0, revision: 1, soon: 2, verification: 3, comment: 4, info: 5, review: 6 };
  function build({ projects, requests, tasks }, today = LCA.rules.today()) {
    const active = projects.filter((p) => p.stage < 10);
    const ids = new Set(active.map((p) => p.id));
    const own = requests.ok ? requests.items.filter((r) => ids.has(r.projectId) && !r.deletedAt) : [];
    const received = own.filter((r) => !!r.receipt && r.status !== '요청');
    const approved = received.filter((r) => r.status === '승인');
    const attention = [];
    for (const project of active) {
      const mine = tasks.items.filter((task) => task.projectId === project.id);
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
    return { ok: true, today, activeCount: active.length, requestsOk: requests.ok,
      collection: { total: own.length, received: received.length, percent: requests.ok ? percent(received.length, own.length) : null },
      approval: { total: received.length, approved: approved.length, percent: requests.ok ? percent(approved.length, received.length) : null },
      registeredProjects: new Set(own.map((r) => r.projectId)).size,
      attentionCount: attention.length, attention: attention.slice(0, 3), taskCount: tasks.items.length, tasks: tasks.items.slice(0, 3), warnings: tasks.warnings };
  }
  return { build };
})();
