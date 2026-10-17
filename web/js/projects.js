/* 프로젝트 기본 정보와 별도 자료 수집 마감일을 보관한다. */
window.LCA = window.LCA || {};
LCA.projects = (() => {
  const STORAGE_KEY = 'ecoable-lca-manager.projects.v1';
  const PURPOSES = ['고객사 요구 대응', '규제 대응', '제품 환경성 진단'];
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
  function createStore(samples, referenceDate, getStorage = () => window.localStorage, getStage = null) {
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
        return { ok: true, data };
      } catch { return failure(); }
    }
    function combined(data) {
      return [...JSON.parse(JSON.stringify(samples)), ...data.projects.map(asProject)].map((project) => ({
        ...project, collectionDueDate: Object.hasOwn(data.collectionDueDates || {}, project.id)
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
    return { list, add, saveCollectionDeadline };
  }
  return { STORAGE_KEY, PURPOSES, validate, createStore };
})();
