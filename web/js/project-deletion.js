/* 직접 등록한 프로젝트와 그 프로젝트의 기록만 한 묶음으로 삭제한다. */
window.LCA = window.LCA || {};
LCA.projectDeletion = (() => {
  function prepare(id, sampleDate) {
    const before = LCA.storage.capture();
    const records = Object.fromEntries(LCA.storage.DATA_KEYS.map((key) => [key, before[key]]));
    LCA.backup.inspect(records, sampleDate);
    const data = before[LCA.projects.STORAGE_KEY] === null ? null : JSON.parse(before[LCA.projects.STORAGE_KEY]);
    const project = data?.projects.find((p) => p.id === id);
    if (!project) throw Error('직접 생성한 프로젝트만 삭제할 수 있어요. 기본 가상 샘플은 삭제하지 않아요.');
    const current = LCA.projects.createStore(LCA.data.createSampleProjects(sampleDate), sampleDate, () => ({ getItem: (key) => before[key] ?? null })).list().items.find((p) => p.id === id);
    const values = { ...before };
    const counts = { requests: 0, reportVersions: 0, comments: 0, issues: 0, messages: 0, inquiries: 0 };
    data.projects = data.projects.filter((p) => p.id !== id);
    if (data.collectionDueDates) delete data.collectionDueDates[id];
    if (data.basicHistory) delete data.basicHistory[id];
    if (data.profileHistory) delete data.profileHistory[id];
    values[LCA.projects.STORAGE_KEY] = JSON.stringify(data);
    for (const [module, field, count] of [[LCA.requests, 'requests', 'requests'], [LCA.customerReview, 'items', 'comments']]) {
      if (values[module.STORAGE_KEY] === null) continue;
      const record = JSON.parse(values[module.STORAGE_KEY]);
      if (module === LCA.requests && record.inquiries) {
        counts.inquiries = record.inquiries.items.filter((item) => item.projectId === id).length;
        record.inquiries.items = record.inquiries.items.filter((item) => item.projectId !== id);
      }
      if (module === LCA.requests && record.messageLog) {
        counts.messages = record.messageLog.items.filter((item) => item.projectId === id).length;
        record.messageLog.items = record.messageLog.items.filter((item) => item.projectId !== id);
      }
      counts[count] = record[field].filter((item) => item.projectId === id).length;
      if (counts[count] || (module === LCA.requests && (counts.messages || counts.inquiries))) { record[field] = record[field].filter((item) => item.projectId !== id); values[module.STORAGE_KEY] = JSON.stringify(record); }
    }
    for (const module of [LCA.scope, LCA.modelling, LCA.interpretation, LCA.report, LCA.verification, LCA.reviewRoute, LCA.certification]) {
      if (values[module.STORAGE_KEY] === null) continue;
      const record = JSON.parse(values[module.STORAGE_KEY]);
      if (!Object.hasOwn(record.records, id)) continue;
      if (module === LCA.report) counts.reportVersions = Array.isArray(record.records[id]) ? record.records[id].length : 1;
      else if (module === LCA.verification) counts.issues = record.records[id].issues.length;
      delete record.records[id]; values[module.STORAGE_KEY] = JSON.stringify(record);
    }
    const after = Object.fromEntries(LCA.storage.DATA_KEYS.map((key) => [key, values[key]]));
    LCA.backup.inspect(after, sampleDate);
    const list = LCA.projects.createStore(LCA.data.createSampleProjects(sampleDate), sampleDate, () => ({ getItem: (key) => values[key] ?? null })).list();
    if (!list.ok) throw Error(list.error);
    return { project: { id, code: current.code, companyName: current.companyName, productName: current.productName }, counts, values, items: list.items, expected: JSON.stringify(before) };
  }
  async function remove(plan) {
    const result = await LCA.storage.replace(plan.values, plan.expected);
    return result.ok ? { ...result, project: plan.project, items: plan.items } : result;
  }
  return { prepare, remove };
})();
