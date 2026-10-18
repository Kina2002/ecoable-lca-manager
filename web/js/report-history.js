/* 보고서 버전의 변경 설명과 두 저장본의 내용 차이를 정리한다. */
window.LCA = window.LCA || {};
LCA.reportHistory = (() => {
  const FIELDS = {
    summary: { label: '변경 내용', limit: 1000 },
    reason: { label: '변경 사유', limit: 1000 },
    before: { label: '변경 전', limit: 2000 },
    after: { label: '변경 후', limit: 2000 },
    author: { label: '작성자', limit: 100 },
    reviewRef: { label: '관련 의견 메모', limit: 200, optional: true }
  };
  function validate(change, initial = false, stored = false) {
    const errors = {};
    for (const [field, rule] of Object.entries(FIELDS)) {
      const optional = rule.optional || (initial && field === 'before');
      if (typeof change?.[field] !== 'string' || (!optional && !change[field].trim()) || change[field].trim().length > rule.limit) {
        errors[field] = `${rule.label} 항목은 ${optional ? '0' : '1'}~${rule.limit.toLocaleString('ko-KR')}자로 적어 주세요.`;
      }
    }
    if (change?.commentIds !== undefined) {
      const ids = change.commentIds;
      if (!Array.isArray(ids) || ids.length > 50 || new Set(ids).size !== ids.length || ids.some((id) => typeof id !== 'string' || !/^CMT-[0-9]{4,}$/.test(id))) errors.commentIds = '관련 고객 의견은 중복 없이 50건까지 선택해 주세요.';
      if (stored && (!Array.isArray(change.commentLinks) || change.commentLinks.length !== ids?.length
        || change.commentLinks.some((link, i) => !link || link.id !== ids[i] || !Number.isSafeInteger(link.reportRevision) || link.reportRevision < 1
          || typeof link.content !== 'string' || !link.content.trim() || link.content.length > 3000))) errors.commentIds = '저장된 고객 의견 연결을 확인하지 못했어요.';
    } else if (change?.commentLinks !== undefined) errors.commentIds = '저장된 고객 의견 연결을 확인하지 못했어요.';
    return errors;
  }
  function normalize(change) {
    return Object.fromEntries(Object.keys(FIELDS).map((field) => [field, change[field].trim()]));
  }
  function compare(before, after) {
    if (!before || !after) return [];
    const sectionText = (record, title) => {
      const section = LCA.report.sections(record).find((item) => item.title.startsWith(title));
      if (!section) return '';
      return [...section.paragraphs, ...(section.indicators || []).map((row) => `${row.indicator}: ${row.value} ${row.unit}`)].join('\n\n');
    };
    const groups = [
      ['보고서 제목', (record) => record.title],
      ['작성 메모', (record) => record.note],
      ['프로젝트 정보', (record) => sectionText(record, '프로젝트')],
      ['평가 범위', (record) => sectionText(record, '평가 범위')],
      ['승인 원자료·검토 기록', (record) => sectionText(record, '계산에 연결한 승인 원자료')],
      ['계산 결과·산정 근거', (record) => sectionText(record, '외부 계산 결과')],
      ['담당자 해석', (record) => sectionText(record, '담당자의 결과 해석')],
      ['연결한 고객 의견', (record) => (record.change?.commentLinks || []).map((link) => `${link.id} · v${link.reportRevision} 의견: ${link.content}`).join('\n\n')]
    ];
    return groups.flatMap(([label, read]) => {
      const left = read(before); const right = read(after);
      return left === right ? [] : [{ label, before: left, after: right }];
    });
  }
  function createStore(projects, getInterpretation, getStorage, helpers) {
    const STORAGE_KEY = 'ecoable-lca-manager.report.v1';
    const clone = (value) => JSON.parse(JSON.stringify(value));
    const failure = () => ({ ok: false, error: '보고서 버전 기록을 읽지 못했어요. 기존 보관본을 보호하기 위해 저장을 중단했어요.' });
    function validBase(record, id) {
      return Boolean(record && record.projectId === id && !Object.keys(helpers.validate(record)).length
        && Number.isSafeInteger(record.revision) && record.revision >= 1 && helpers.validSource(record.source, id)
        && record.sourceKey === JSON.stringify(record.source)
        && ['createdAt', 'updatedAt'].every((field) => typeof record[field] === 'string' && Number.isFinite(Date.parse(record[field])))
        && record.createdAt <= record.updatedAt);
    }
    function read() {
      try {
        const raw = getStorage().getItem(STORAGE_KEY);
        if (raw === null) return { ok: true, records: {} };
        const data = JSON.parse(raw);
        if (!data || ![1, 2].includes(data.version) || !data.records || typeof data.records !== 'object' || Array.isArray(data.records)) return failure();
        const records = {};
        for (const [id, value] of Object.entries(data.records)) {
          if (!projects.some((project) => project.id === id)) return failure();
          if (data.version === 1) {
            if (!validBase(value, id) || value.change !== undefined || value.legacy !== undefined) return failure();
            records[id] = [{ ...value, legacy: true }];
            continue;
          }
          if (!Array.isArray(value) || !value.length) return failure();
          for (const [index, record] of value.entries()) {
            if (!validBase(record, id)) return failure();
            if (record.legacy === true) {
              if (index !== 0 || record.change !== undefined) return failure();
            } else {
              if (record.legacy !== undefined || Object.keys(validate(record.change, index === 0, true)).length || (index === 0 && record.revision !== 1)
                || record.change.commentLinks?.some((link) => link.reportRevision >= record.revision)) return failure();
            }
            if (index > 0 && record.revision !== value[index - 1].revision + 1) return failure();
          }
          records[id] = value;
        }
        return { ok: true, records };
      } catch { return failure(); }
    }
    function load(id) {
      const data = read();
      if (!data.ok) return data;
      const history = data.records[id] || [];
      const record = history.at(-1) || null;
      let state;
      try { state = getInterpretation(id); }
      catch { state = { ok: false, error: '현재 보고서의 근거 자료를 확인하지 못했어요.' }; }
      const project = state?.ok ? state.project : projects.find((item) => item.id === id);
      if (!project) return { ok: false, error: '프로젝트를 찾을 수 없어요.' };
      const ready = Boolean(state?.ok && state.ready && state.record && !state.stale);
      const source = state?.ok && state.record ? { project: helpers.projectSnapshot(project), interpretation: clone(state.record) } : null;
      const sourceKey = source ? JSON.stringify(source) : '';
      return { ok: true, project, ready, source, sourceKey, record: record ? clone(record) : null,
        versions: clone(history).reverse(), currentError: state?.ok ? '' : state?.error || '현재 계산·해석 기록을 확인하지 못했어요.',
        stale: Boolean(record && (!ready || record.sourceKey !== sourceKey)) };
    }
    function saveNow(id, draft, expectedRevision, expectedSourceKey) {
      const data = read();
      if (!data.ok) return data;
      const history = data.records[id] || [];
      const errors = { ...helpers.validate(draft), ...Object.fromEntries(Object.entries(validate(draft.change, !history.length)).map(([field, message]) => [`change_${field}`, message])) };
      if (Object.keys(errors).length) return { ok: false, errors };
      const state = load(id);
      if (!state.ok) return state;
      if (state.currentError) return { ok: false, error: state.currentError };
      if (![7, 8].includes(state.project.stage)) return { ok: false, error: '보고서(7)·검토·검증(8) 단계에서 새 버전을 저장할 수 있어요.' };
      if (!state.ready) return { ok: false, error: '최신 승인 자료·계산 결과에 맞는 해석을 먼저 저장해 주세요.' };
      if ((state.record?.revision || 0) !== expectedRevision) return { ok: false, error: '다른 화면에서 새 보고서 버전을 저장했어요. 작성 내용은 유지했으니 프로젝트를 다시 열어 최신 버전을 확인해 주세요.' };
      if (state.sourceKey !== expectedSourceKey) return { ok: false, error: '보고서의 근거가 바뀌었어요. 자료와 해석을 읽고 초안 기준을 다시 확인해 주세요.' };
      if (expectedRevision >= Number.MAX_SAFE_INTEGER) return { ok: false, error: '새 버전 번호를 만들지 못했어요.' };
      const commentIds = draft.change.commentIds || [];
      const commentLinks = [];
      if (commentIds.length) {
        const comments = helpers.getComments?.(id);
        if (!comments?.ok) return { ok: false, error: comments?.error || '관련 고객 의견을 확인하지 못했어요. 의견을 확인한 뒤 다시 저장해 주세요.' };
        for (const commentId of commentIds) {
          const comment = comments.items.find((item) => item.id === commentId && item.projectId === id && item.reportRevision <= expectedRevision);
          if (!comment) return { ok: false, errors: { change_commentIds: '선택한 고객 의견의 프로젝트와 보고서 버전을 다시 확인해 주세요.' } };
          commentLinks.push({ id: comment.id, reportRevision: comment.reportRevision, content: comment.content });
        }
      }
      const now = new Date().toISOString();
      const record = { title: draft.title.trim(), note: draft.note.trim(), confirmed: true, projectId: id,
        revision: expectedRevision + 1, source: clone(state.source), sourceKey: state.sourceKey,
        change: { ...normalize(draft.change), commentIds: [...commentIds], commentLinks }, createdAt: now, updatedAt: now };
      try { getStorage().setItem(STORAGE_KEY, JSON.stringify({version:2, records:{...data.records, [id]:[...history, record]}})); }
      catch { return { ok: false, error: '새 보고서 버전을 저장하지 못했어요. 작성 내용과 기존 버전은 모두 유지했어요. 저장 공간을 확인해 주세요.' }; }
      return { ok: true, record: clone(record) };
    }
    async function save(id, draft, expectedRevision, expectedSourceKey) {
      try {
        const locks = typeof navigator !== 'undefined' ? navigator.locks : null;
        if (locks?.request) return await locks.request('ecoable-lca-manager.review-workflow-write', () => saveNow(id, draft, expectedRevision, expectedSourceKey));
        return saveNow(id, draft, expectedRevision, expectedSourceKey);
      } catch { return { ok: false, error: '보고서 버전 저장을 시작하지 못했어요. 작성 내용과 기존 버전은 유지했으니 다시 시도해 주세요.' }; }
    }
    function download(id, requestedRevision, allowArchive = false) {
      const data = read();
      if (!data.ok) return data;
      const history = data.records[id] || [];
      const latest = history.at(-1);
      if (!latest) return { ok: false, error: '보고서 버전을 먼저 저장해 주세요.' };
      const revision = requestedRevision === undefined ? latest.revision : requestedRevision;
      const selected = history.find((record) => record.revision === revision);
      if (!selected) return { ok: false, error: '선택한 보고서 버전을 찾을 수 없어요. 보관 목록을 다시 확인해 주세요.' };
      const archived = selected.revision !== latest.revision;
      if (archived && !allowArchive) return { ok: false, error: '과거 보관본을 선택했어요. 최신 보고서가 아님을 확인한 뒤 내려받아 주세요.' };
      if (!archived) {
        const state = load(id);
        if (!state.ok) return state;
        if (state.currentError) return { ok: false, error: state.currentError };
        if (state.stale) return { ok: false, error: '최신 보고서의 근거가 바뀌었어요. 새 버전을 저장한 뒤 내려받아 주세요.' };
      }
      const record = clone(selected);
      if (archived) record.historyNotice = '과거 버전 보관본입니다. 현재의 최신 보고서·자료와 다를 수 있습니다.';
      return { ok: true, record, content: helpers.markdown(record),
        filename: `가상_${record.source.project.code.replace(/[^A-Za-z0-9_-]/g, '_')}_보고서초안_v${record.revision}${archived ? '_과거보관본' : ''}.md` };
    }
    return { load, save, download };
  }
  return { FIELDS, validate, normalize, compare, createStore };
})();
