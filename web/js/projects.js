/* 프로젝트 기본 정보와 별도 자료 수집 마감일을 보관한다. */
window.LCA = window.LCA || {};
LCA.projects = (() => {
  const STORAGE_KEY = 'ecoable-lca-manager.projects.v1';
  const PURPOSES = ['고객사 요구 대응', '규제 대응', '제품 환경성 진단'];
  const BASIC_FIELDS = ['companyName', 'productName', 'purpose', 'targetDate'];
  function basicSnapshot(project) { return Object.fromEntries(BASIC_FIELDS.map((key) => [key, project[key]])); }
  function validBasic(value) {
    return value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === BASIC_FIELDS.length
      && BASIC_FIELDS.every((key) => Object.hasOwn(value, key) && typeof value[key] === 'string' && value[key] === value[key].trim()) && !Object.keys(validate(value)).length;
  }
  function validHistory(histories, bases) {
    if (histories === undefined) return true;
    if (!histories || typeof histories !== 'object' || Array.isArray(histories)) return false;
    for (const [id, history] of Object.entries(histories)) {
      const base = bases.get(id); if (!base || !Array.isArray(history) || !history.length) return false;
      let previous = null;
      for (const event of history) {
        if (!event || !validBasic(event.before) || !validBasic(event.after) || !Number.isInteger(event.stage) || event.stage < base.stage || event.stage > 9
          || typeof event.at !== 'string' || !Number.isFinite(Date.parse(event.at)) || typeof event.reason !== 'string' || event.reason.length > 1000
          || (previous && (event.stage < previous.stage || Date.parse(event.at) < Date.parse(previous.at) || JSON.stringify(event.before) !== JSON.stringify(previous.after)))
          || (!previous && BASIC_FIELDS.some((key) => (base.origin === 'user' || key !== 'targetDate') && event.before[key] !== base[key]))
          || BASIC_FIELDS.every((key) => event.before[key] === event.after[key])
          || (event.stage !== 1 && BASIC_FIELDS.some((key) => key !== 'targetDate' && event.before[key] !== event.after[key]))) return false;
        previous = event;
      }
    }
    return true;
  }
  function validate(draft) {
    const errors = {};
    for (const [key, label] of [['companyName', '회사명'], ['productName', '제품명']]) {
      if (typeof draft[key] !== 'string' || !draft[key].trim()) errors[key] = `${label}을 적어 주세요.`;
      else if (draft[key].trim().length > 100) errors[key] = `${label}은 100자까지 적을 수 있어요.`;
    }
    if (!PURPOSES.includes(draft.purpose)) errors.purpose = '업무 목적을 골라 주세요.';
    if (!LCA.requests.validDate(draft.targetDate)) errors.targetDate = '목표일을 올바른 날짜로 입력해 주세요.';
    return errors;
  }
  function asProject(record) {
    return {
      ...record, origin: 'user', isFictional: true, industry: '', type: '', drivers: [], uses: [],
      stage: 1, scopeStatus: '미정', functionalUnit: { qty: '', unit: '' }, boundary: '', modules: '',
      refStart: '', refEnd: '', periodReason: '', scopeMemo: '', standards: []
    };
  }
  function createStore(samples, referenceDate, getStorage = () => LCA.storage ? LCA.storage.get() : window.localStorage, getStage = null) {
    const minimumNumber = Math.max(0, ...samples.map((project) => Number(project.code.split('-').at(-1)) || 0)) + 1;
    const failure = () => ({ ok: false, error: '프로젝트 기록을 읽을 수 없어요. 기존 기록을 보호하기 위해 등록과 일정 저장을 중단했어요. 저장된 최신 목록은 확인하지 못했어요.' });
    function read() {
      try {
        const raw = getStorage().getItem(STORAGE_KEY);
        if (raw === null) return { ok: true, data: { version: 1, nextNumber: minimumNumber, projects: [] } };
        const data = JSON.parse(raw);
        if (!data || data.version !== 1 || !Number.isSafeInteger(data.nextNumber) || data.nextNumber < minimumNumber || !Array.isArray(data.projects)) return failure();
        const ids = new Set(samples.map((project) => project.id));
        const codes = new Set(samples.map((project) => project.code));
        const numbers = new Set();
        for (const item of data.projects) {
          if (!item || Object.keys(validate(item)).length || !Number.isSafeInteger(item.number) || item.number < minimumNumber || item.number >= data.nextNumber
            || item.id !== `project-user-${item.number}` || !/^LCA-\d{4}-\d{3,}$/.test(item.code)
            || Number(item.code.split('-').at(-1)) !== item.number || ids.has(item.id) || codes.has(item.code) || numbers.has(item.number)
            || typeof item.createdAt !== 'string' || !Number.isFinite(Date.parse(item.createdAt))) return failure();
          ids.add(item.id); codes.add(item.code); numbers.add(item.number);
        }
        if (data.collectionDueDates !== undefined && (!data.collectionDueDates || typeof data.collectionDueDates !== 'object' || Array.isArray(data.collectionDueDates)
          || Object.entries(data.collectionDueDates).some(([id, date]) => !ids.has(id) || typeof date !== 'string' || (date !== '' && !LCA.requests.validDate(date))))) return failure();
        if (!validHistory(data.basicHistory, new Map([...samples, ...data.projects.map(asProject)].map((p) => [p.id, p])))) return failure();
        return { ok: true, data };
      } catch { return failure(); }
    }
    function combined(data) {
      return [...JSON.parse(JSON.stringify(samples)), ...data.projects.map(asProject)].map((project) => ({
        ...project, ...(data.basicHistory?.[project.id]?.at(-1)?.after || {}), basicRevision: data.basicHistory?.[project.id]?.length || 0,
        collectionDueDate: Object.hasOwn(data.collectionDueDates || {}, project.id)
          ? data.collectionDueDates[project.id] : project.collectionDueDate || ''
      }));
    }
    function list() {
      const result = read();
      return result.ok ? { ok: true, items: combined(result.data) } : result;
    }
    function add(draft) {
      const errors = validate(draft);
      if (Object.keys(errors).length) return { ok: false, errors };
      const result = read();
      if (!result.ok) return result;
      if (!LCA.requests.validDate(referenceDate) || result.data.nextNumber >= Number.MAX_SAFE_INTEGER) return { ok: false, error: '프로젝트 번호를 만들 수 없어요. 기준 날짜를 확인해 주세요.' };
      const number = result.data.nextNumber;
      const item = {
        id: `project-user-${number}`, code: `LCA-${referenceDate.slice(0, 4)}-${String(number).padStart(3, '0')}`,
        number, companyName: draft.companyName.trim(), productName: draft.productName.trim(),
        purpose: draft.purpose, targetDate: draft.targetDate, createdAt: new Date().toISOString()
      };
      const data = { ...result.data, nextNumber: number + 1, projects: [...result.data.projects, item] };
      try { getStorage().setItem(STORAGE_KEY, JSON.stringify(data)); }
      catch { return { ok: false, error: '프로젝트를 저장하지 못했어요. 입력 내용은 유지했으니 저장 공간과 브라우저 설정을 확인해 주세요.' }; }
      return { ok: true, item: asProject(item), items: combined(data) };
    }
    function saveCollectionDeadline(id, date, expected) {
      if (typeof date !== 'string' || (date !== '' && !LCA.requests.validDate(date))) return { ok: false, error: '자료 수집 마감일을 올바른 날짜로 입력하거나 비워 주세요.' };
      const result = read();
      if (!result.ok) return result;
      const project = combined(result.data).find((item) => item.id === id);
      if (!project) return { ok: false, error: '프로젝트를 찾을 수 없어요.' };
      const stage = getStage ? getStage(id) : { ok: true, stage: project.stage };
      if (!stage.ok) return stage;
      if (stage.stage >= 4) return { ok: false, error: '자료 수집이 끝난 단계의 일정은 읽기 전용이에요.' };
      if (project.collectionDueDate !== expected) return { ok: false, error: '다른 화면에서 마감일이 바뀌었어요. 목록으로 돌아가 다시 열어 주세요.' };
      const data = { ...result.data, collectionDueDates: { ...result.data.collectionDueDates, [id]: date } };
      try { getStorage().setItem(STORAGE_KEY, JSON.stringify(data)); }
      catch { return { ok: false, error: '마감일을 저장하지 못했어요. 입력 내용을 유지했으니 다시 시도해 주세요.' }; }
      return { ok: true, date };
    }
    function basic(id) {
      const loaded = read(); if (!loaded.ok) return loaded;
      const project = combined(loaded.data).find((p) => p.id === id);
      if (!project) return { ok: false, error: '프로젝트를 찾을 수 없어요. 삭제 여부를 확인해 주세요.' };
      const stage = getStage ? getStage(id) : { ok: true, stage: project.stage };
      if (!stage.ok) return stage;
      return { ok: true, project, stage: stage.stage, revision: project.basicRevision, history: JSON.parse(JSON.stringify(loaded.data.basicHistory?.[id] || [])) };
    }
    function updateBasic(id, draft, expected) {
      const errors = validate(draft);
      if (typeof draft.reason !== 'string' || draft.reason.trim().length > 1000) errors.reason = '변경 사유는 1,000자 이내로 적어 주세요.';
      if (Object.keys(errors).length) return { ok: false, errors };
      const loaded = read(); if (!loaded.ok) return loaded;
      const current = combined(loaded.data).find((p) => p.id === id);
      if (!current) return { ok: false, error: '프로젝트를 찾을 수 없어요. 삭제 여부를 확인해 주세요.' };
      const stage = getStage ? getStage(id) : { ok: true, stage: current.stage };
      if (!stage.ok) return stage;
      if (!Number.isInteger(stage.stage) || stage.stage < 1 || stage.stage >= 10) return { ok: false, error: '완료한 프로젝트의 기본정보는 읽기 전용이에요.' };
      const before = basicSnapshot(current); const after = Object.fromEntries(BASIC_FIELDS.map((key) => [key, draft[key].trim()]));
      if (!expected || current.basicRevision !== expected.revision || stage.stage !== expected.stage || JSON.stringify(before) !== JSON.stringify(expected.basic)) return { ok: false, error: '다른 화면에서 정보나 단계가 바뀌었어요. 입력을 따로 보관하고 창을 다시 열어 최신 기록을 확인해 주세요.' };
      if (stage.stage !== 1 && BASIC_FIELDS.some((key) => key !== 'targetDate' && before[key] !== after[key])) return { ok: false, error: '회사명·제품명·업무 목적은 계약·착수 단계에서만 바꿀 수 있어요.' };
      if (BASIC_FIELDS.every((key) => before[key] === after[key])) return { ok: false, error: '바뀐 내용이 없어요.' };
      const history = loaded.data.basicHistory?.[id] || [];
      const at = new Date(Math.max(Date.now(), history.length ? Date.parse(history.at(-1).at) : 0)).toISOString();
      const event = { before, after, stage: stage.stage, at, reason: draft.reason.trim() };
      const data = { ...loaded.data, basicHistory: { ...(loaded.data.basicHistory || {}), [id]: [...history, event] } };
      if (!validHistory(data.basicHistory, new Map([...samples, ...data.projects.map(asProject)].map((p) => [p.id, p])))) return { ok: false, error: '현재 단계와 변경 이력이 맞지 않아 저장하지 않았어요. 최신 기록을 확인해 주세요.' };
      try { getStorage().setItem(STORAGE_KEY, JSON.stringify(data)); }
      catch { return { ok: false, error: '변경 내용을 저장하지 못했어요. 기존 정보와 입력은 유지했으니 저장 공간을 확인해 주세요.' }; }
      return { ok: true, basic: after, revision: current.basicRevision + 1 };
    }
    async function locked(action) {
      try {
        if (typeof navigator !== 'undefined' && navigator.locks?.request) return await navigator.locks.request('ecoable-lca-manager.review-workflow-write', action);
        return action();
      } catch { return { ok: false, error: '프로젝트 기록 저장을 시작하지 못했어요. 입력을 유지했으니 다시 시도해 주세요.' }; }
    }
    return { list, basic, add: (...args) => locked(() => add(...args)), saveCollectionDeadline: (...args) => locked(() => saveCollectionDeadline(...args)), updateBasic: (...args) => locked(() => updateBasic(...args)) };
  }
  return { STORAGE_KEY, PURPOSES, BASIC_FIELDS, basicSnapshot, validate, createStore };
})();
