/* 전체 백업은 원래 저장 문자열을 보존하고, 격리된 저장소에서 기존 검사를 재사용한다. */
window.LCA = window.LCA || {};
LCA.backup = (() => {
  const FORMAT = 'lca-project-manager-backup'; const VERSION = 1; const MAX_BYTES = 20 * 1024 * 1024;
  const clone = (value) => JSON.parse(JSON.stringify(value));
  function checked(result, label) { if (!result?.ok) throw Error(`${label}: ${result?.error || result?.message || '기록을 읽지 못했어요.'}`); return result; }
  function inspect(records, sampleDate) {
    if (!LCA.requests.validDate(sampleDate)) throw Error('가상 프로젝트의 기준 날짜가 올바르지 않아요.');
    const keys = LCA.storage.DATA_KEYS;
    if (!records || typeof records !== 'object' || Array.isArray(records) || Object.keys(records).length !== keys.length
      || keys.some((key) => !Object.hasOwn(records, key) || (records[key] !== null && typeof records[key] !== 'string'))) throw Error('백업의 전체 기록 구성이 올바르지 않아요.');
    const getStorage = () => ({ getItem: (key) => records[key] ?? null });
    const samples = LCA.data.createSampleProjects(sampleDate);
    if (samples.some((p) => !LCA.requests.validDate(p.targetDate) || (p.collectionDueDate && !LCA.requests.validDate(p.collectionDueDate)))) throw Error('가상 프로젝트 일정을 만들 수 없는 기준 날짜예요.');
    const projects = checked(LCA.projects.createStore(samples, sampleDate, getStorage).list(), '프로젝트').items;
    const researchers = checked(LCA.researchers.createStore(getStorage).list(), '담당 연구원').items;
    const requests = LCA.requests.createStore(projects.map((p) => p.id), getStorage);
    checked(requests.listAll(), '자료 요청');
    const scopes = LCA.scope.createStore(projects, getStorage);
    checked(scopes.load(), '평가 범위');
    const project = (id) => ({ ok: true, project: projects.find((p) => p.id === id) });
    const modelling = LCA.modelling.createStore(projects, getStorage, (id) => requests.list(id), project);
    const interpretation = LCA.interpretation.createStore(projects, (id) => modelling.load(id), getStorage);
    const reports = LCA.report.createStore(projects, (id) => interpretation.load(id), getStorage);
    const comments = LCA.customerReview.createStore(projects, (id) => reports.load(id), project, getStorage);
    const verification = LCA.verification.createStore(projects, project, (id) => reports.load(id), (id) => comments.list(id), getStorage);
    const route = LCA.reviewRoute.createStore(projects, project, (id) => reports.load(id), (id) => comments.list(id), (id) => verification.snapshot(id), getStorage);
    const certification = LCA.certification.createStore(projects, project, (id) => reports.load(id), (id) => verification.load(id), getStorage, (id) => route.load(id));
    checked(comments.snapshot(), '고객 의견');
    let reportCount = 0; let issueCount = 0;
    for (const p of projects) {
      checked(modelling.load(p.id), '계산 결과'); checked(interpretation.load(p.id), '결과 해석');
      const report = checked(reports.load(p.id), '보고서'); reportCount += report.versions.length;
      const customer = checked(comments.list(p.id), '고객 의견');
      if (customer.warning) throw Error(customer.warning);
      const ver = checked(verification.snapshot(p.id), '검증');
      if (ver.record) {
        issueCount += ver.record.issues.length;
        for (const round of ver.record.rounds) if (!report.versions.some((r) => r.revision === round.reportRevision && r.title === round.reportTitle)) throw Error('검증 차수에 연결한 보고서가 없거나 제목이 달라요.');
        for (const issue of ver.record.issues) for (const event of issue.events) {
          if (event.type === 'replied' && event.appliedReportRevision !== null && !report.versions.some((r) => r.revision === event.appliedReportRevision)) throw Error('검증 답변에 연결한 수정 보고서가 없어요.');
        }
      }
      checked(route.currentStage(p.id), '검토 방식'); checked(certification.currentStage(p.id), '인증·등록');
      for (const module of [LCA.reviewRoute, LCA.certification]) {
        const data = records[module.STORAGE_KEY] === null ? null : JSON.parse(records[module.STORAGE_KEY]);
        for (const event of data?.records[p.id]?.events || []) {
          if (event.report && !report.versions.some((r) => JSON.stringify(r) === JSON.stringify(event.report))) throw Error('검토·인증 근거에 연결한 보고서 보관본이 없거나 내용이 달라요.');
        }
      }
      for (const version of report.versions) for (const link of version.change?.commentLinks || []) {
        if (!customer.items.some((item) => item.id === link.id && item.reportRevision === link.reportRevision && item.content === link.content)) throw Error('보고서 변경 이력에 연결한 고객 의견이 없거나 내용이 달라요.');
      }
      if (p.researcherId && !researchers.some((r) => r.id === p.researcherId)) throw Error('프로젝트에 연결한 담당 연구원이 없어요.');
    }
    const requestData = records[LCA.requests.STORAGE_KEY] === null ? [] : JSON.parse(records[LCA.requests.STORAGE_KEY]).requests;
    return { projects: projects.map((p) => ({ code: p.code, companyName: p.companyName, productName: p.productName })),
      researchers: researchers.length, requests: requestData.length, deletedRequests: requestData.filter((r) => r.deletedAt).length,
      reportVersions: reportCount, comments: checked(comments.snapshot(), '고객 의견').items.length, issues: issueCount,
      messages: records[LCA.requests.STORAGE_KEY] === null ? 0 : JSON.parse(records[LCA.requests.STORAGE_KEY]).messageLog?.items.length || 0 };
  }
  function create(sampleDate) {
    const values = LCA.storage.capture();
    const records = Object.fromEntries(LCA.storage.DATA_KEYS.map((key) => [key, values[key]]));
    const summary = inspect(records, sampleDate);
    const file = { format: FORMAT, version: VERSION, createdAt: new Date().toISOString(), sampleDate, records };
    const content = JSON.stringify(file, null, 2);
    if (new Blob([content]).size > MAX_BYTES) throw Error('백업 파일이 20MB를 넘어요. 현재 버전에서 처리할 수 있는 크기를 초과했어요.');
    return { content, summary, expected: JSON.stringify(values), fileName: `LCA-백업-${LCA.rules.today()}-${file.createdAt.slice(11, 19).replaceAll(':', '')}.json` };
  }
  function parse(content) {
    if (typeof content !== 'string' || new Blob([content]).size > MAX_BYTES) throw Error('20MB 이하의 백업 파일을 선택해 주세요.');
    let data; try { data = JSON.parse(content.replace(/^\uFEFF/, '')); } catch { throw Error('JSON 백업 파일을 읽을 수 없어요. 앱에서 내려받은 파일인지 확인해 주세요.'); }
    if (data?.format !== FORMAT || data.version !== VERSION) throw Error('이 앱에서 지원하는 백업 파일이 아니에요. 파일 종류와 백업 버전을 확인해 주세요.');
    if (typeof data.createdAt !== 'string' || !Number.isFinite(Date.parse(data.createdAt))) throw Error('백업 날짜가 올바르지 않아요.');
    const summary = inspect(data.records, data.sampleDate);
    return { data: clone(data), summary };
  }
  async function save(snapshot, mode) {
    const blob = new Blob([snapshot.content], { type: 'application/json;charset=utf-8' });
    if (mode === 'location') {
      if (typeof window.showSaveFilePicker !== 'function') throw Error('이 브라우저에서는 위치 선택을 지원하지 않아요. 브라우저 기본 다운로드를 선택해 주세요.');
      const handle = await window.showSaveFilePicker({ id: 'lca-backup', suggestedName: snapshot.fileName, types: [{ description: 'LCA 백업 파일', accept: { 'application/json': ['.json'] } }] });
      const writable = await handle.createWritable();
      try { await writable.write(blob); await writable.close(); }
      catch (error) { try { await writable.abort(); } catch { /* 원래 저장 오류를 알린다. */ } throw error; }
      return { saved: true, fileName: handle.name };
    }
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = snapshot.fileName; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return { saved: false, fileName: snapshot.fileName };
  }
  async function restore(parsed, expected) {
    // 미리보기 객체도 다시 검사하고, 원문 문자열을 그대로 복원한다.
    inspect(parsed.data.records, parsed.data.sampleDate);
    const values = { ...parsed.data.records, [LCA.storage.SAMPLE_KEY]: parsed.data.sampleDate };
    return LCA.storage.replace(values, expected);
  }
  function resetPlan(sampleDate) {
    const records = Object.fromEntries(LCA.storage.DATA_KEYS.map((key) => [key, null]));
    return { summary: inspect(records, sampleDate), values: { ...records, [LCA.storage.SAMPLE_KEY]: sampleDate } };
  }
  async function reset(sampleDate, expected) {
    return LCA.storage.replace(resetPlan(sampleDate).values, expected);
  }
  return { MAX_BYTES, create, parse, save, restore, inspect, resetPlan, reset };
})();
