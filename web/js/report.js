/* 승인 자료·계산·담당자 해석의 사본으로 보고서 초안을 보관한다. */
window.LCA = window.LCA || {};
LCA.report = (() => {
  const STORAGE_KEY = 'ecoable-lca-manager.report.v1';
  const projectFields = ['id', 'code', 'companyName', 'productName', 'purpose', 'type', 'customerContactName', 'researcherName'];
  function projectSnapshot(project) {
    return Object.fromEntries(projectFields.map((field) => [field, String(project[field] || '')]));
  }
  function validate(draft) {
    const errors = {};
    if (typeof draft?.title !== 'string' || !draft.title.trim() || draft.title.trim().length > 200) errors.title = '보고서 제목은 1~200자로 적어 주세요.';
    if (typeof draft?.note !== 'string' || draft.note.trim().length > 3000) errors.note = '작성 메모는 3,000자 이내로 적어 주세요.';
    if (draft?.confirmed !== true) errors.confirmed = '현재 자료·계산 결과·해석을 읽고 초안에 담을 내용을 확인해 주세요.';
    return errors;
  }
  function validSource(source, id) {
    return Boolean(source && source.project?.id === id
      && projectFields.every((field) => typeof source.project[field] === 'string')
      && ['id', 'code', 'companyName', 'productName'].every((field) => source.project[field].trim())
      && LCA.interpretation.validRecord(source.interpretation, id));
  }
  function sections(record) {
    const p = record.source.project;
    const interpretation = record.source.interpretation;
    const c = interpretation.calculation;
    const scope = c.source.project;
    const output = [
      { title: '프로젝트', paragraphs: [`프로젝트 번호: ${p.code}`, `회사: ${p.companyName} (가상)`, `제품: ${p.productName}`, `업무 목적: ${p.purpose || '미정'}`, `프로젝트 유형: ${p.type || '미정'}`, `고객 담당자: ${p.customerContactName || '미정'}`, `담당 연구원: ${p.researcherName || '미정'}`] },
      { title: '평가 범위', paragraphs: [`평가 기준량: ${scope.functionalUnit.qty} ${scope.functionalUnit.unit}`, `시스템 경계: ${scope.boundary}`, `평가 모듈: ${scope.modules || '별도 기록 없음'}`, `기준기간: ${scope.refStart} ~ ${scope.refEnd}`, `적용 기준: ${scope.standards.join(' / ')}`] },
      { title: `계산에 연결한 승인 원자료 (${c.source.requests.filter((item) => item.status === '승인').length}건)`, paragraphs: c.source.requests.filter((item) => item.status === '승인').map((item) => {
        const r = item.receipt;
        const category = LCA.constants.CATEGORIES.find((entry) => entry.key === item.categoryKey)?.name || item.categoryKey;
        const source = r.provenance;
        const sourceText = source ? `\n활동량 출처: ${source.activitySource || '미기록'}${source.activitySourceDetail ? ` · ${source.activitySourceDetail}` : ''}\n획득 방법: ${source.acquisitionMethod || '미기록'}${r.kind === 'quantity' ? `\n계수 출처: ${source.factorSource || '미기록'}` : ''}` : '';
        const dataset = source?.factorSource === '2차' ? `\n계수 데이터셋: ${source.datasetDatabase} · ${source.datasetName} · ${source.datasetVersion} · ${source.datasetYear} · ${source.datasetSource}` : '';
        return `${item.id} · ${category}\n요청 내용: ${item.detail}\n원자료: ${r.kind === 'quantity' ? `${r.value} ${r.unit}${r.density ? ` · 밀도 ${r.density} kg/m³` : ''}` : r.description}\n자료 기간: ${r.periodStart} ~ ${r.periodEnd}\n증빙 파일 이름: ${r.evidenceFileName}${sourceText}${dataset}\n검토 메모: ${item.review.note || '없음'}`;
      }) },
      { title: '외부 계산 결과', paragraphs: [`계산 결과 버전: ${c.revision}`, `계산일: ${c.calculatedOn}`, `계산 도구: ${c.tool}`, `배경 DB·버전: ${c.database}`, `평가 방법·버전: ${c.method}`, `할당 방법·적용 근거: ${c.allocation}`, `결과 파일 이름: ${c.resultFileName}`, `계산 메모: ${c.note || '없음'}`, `아래 결과는 평가 기준량 ${scope.functionalUnit.qty} ${scope.functionalUnit.unit}당 값입니다. 원자료 활동량을 자동 환산한 결과가 아닙니다.`], indicators: c.indicators },
      { title: `담당자의 결과 해석 (버전 ${interpretation.revision})`, paragraphs: Object.entries(LCA.interpretation.LABELS).map(([field, label]) => `${label}\n${interpretation[field]}`) },
      { title: '작성 메모', paragraphs: [record.note || '별도 작성 메모가 없습니다.'] }
    ];
    const notApplicable = c.source.requests.filter((item) => item.status === '해당 없음');
    if (notApplicable.length) output.splice(3, 0, { title: `해당 없음 자료 (${notApplicable.length}건)`, paragraphs: notApplicable.map((item) => {
      const category = LCA.constants.CATEGORIES.find((entry) => entry.key === item.categoryKey)?.name || item.categoryKey;
      return `${item.id} · ${category}\n사유: ${item.notApplicable.reason}`;
    }) });
    if (record.historyNotice) output.unshift({ title: '보관본 안내', paragraphs: [record.historyNotice] });
    if (record.change) output.push({ title: '이 버전의 변경 기록', paragraphs: [
      ...Object.entries(LCA.reportHistory.FIELDS).filter(([field]) => record.change[field]).map(([field, rule]) => `${rule.label}: ${record.change[field]}`),
      ...(record.change.commentLinks || []).map((link) => `관련 고객 의견 ${link.id} (의견 대상 보고서 v${link.reportRevision}): ${link.content}`)
    ] });
    else if (record.legacy) output.push({ title: '이 버전의 변경 기록', paragraphs: ['이력 기능 도입 전 저장본입니다. 당시 변경 설명과 작성자는 기록되어 있지 않습니다.'] });
    return output;
  }
  const markdownText = (value) => String(value).replace(/[\\`*_{}\[\]<>()#!|~]/g, '\\$&').replace(/\r\n?/g, '\n');
  function markdown(record) {
    const lines = [`# ${markdownText(record.title)}`, '', '> 가상 데이터 · 검토 전 보고서 초안', '', `초안 버전 ${record.revision} · 저장 시각 ${record.updatedAt}`, ''];
    for (const section of sections(record)) {
      lines.push(`## ${markdownText(section.title)}`, '');
      for (const paragraph of section.paragraphs) lines.push(markdownText(paragraph).replace(/\n/g, '  \n'), '');
      if (section.indicators) {
        lines.push('| 지표 | 결과값 | 단위 |', '| --- | --- | --- |');
        for (const item of section.indicators) lines.push(`| ${[item.indicator, item.value, item.unit].map((value) => markdownText(value).replace(/\n/g, ' ')).join(' | ')} |`);
        lines.push('');
      }
    }
    lines.push('증빙과 결과 파일은 이름만 기록되어 있으며 파일 내용은 이 초안에 첨부되지 않습니다.', '');
    return '\uFEFF' + lines.join('\n');
  }
  function createStore(projects, getInterpretation, getStorage = () => LCA.storage ? LCA.storage.get() : window.localStorage, getComments) {
    return LCA.reportHistory.createStore(projects, getInterpretation, getStorage, { validate, validSource, projectSnapshot, markdown, getComments });
  }
  return { STORAGE_KEY, validate, validSource, sections, createStore };
})();
