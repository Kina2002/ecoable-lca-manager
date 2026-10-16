window.LCA = window.LCA || {};
LCA.projectFilter = (() => {
  const normalize = (value) => String(value ?? '').normalize('NFKC').toLowerCase().replace(/[\s-]+/g, '');
  function researcherCode(id) {
    return /^researcher-(sample|user)-[1-9]\d*$/.test(id || '') ? `RSR-${id.split('-').at(-1).padStart(3, '0')}` : '';
  }
  function researcherOptions(projects) {
    const ids = new Map();
    for (const project of projects) if (project.researcherId && !ids.has(project.researcherId)) {
      ids.set(project.researcherId, { id: project.researcherId, label: `${project.researcherName || '이름 확인 필요'} · ${researcherCode(project.researcherId)}` });
    }
    return Array.from(ids.values());
  }
  function active(state) { return Boolean(state.query?.trim() || state.researcher || state.purpose); }
  function select(projects, stage, state = {}) {
    const terms = String(state.query || '').normalize('NFKC').trim().split(/\s+/).map(normalize).filter(Boolean);
    if (String(state.query || '').trim() && !terms.length) return [];
    return projects.filter((project) => {
      if (stage != null && project.stage !== stage) return false;
      if (state.purpose && project.purpose !== state.purpose) return false;
      if (state.researcher === 'unassigned') {
        if (project.researcherId || project.researcherName) return false;
      } else if (state.researcher === 'legacy') {
        if (project.researcherId || !project.researcherName) return false;
      } else if (state.researcher && project.researcherId !== state.researcher) return false;
      const fields = [project.companyName, project.productName, project.code, project.researcherName, researcherCode(project.researcherId)].map(normalize);
      return terms.every((term) => fields.some((field) => field.includes(term)));
    });
  }
  return { select, active, researcherOptions, researcherCode };
})();
