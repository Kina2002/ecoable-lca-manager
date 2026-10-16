/* 새 업무의 기본 정보만 보관한다. 범위와 자료 기록은 기존 저장소가 맡는다. */
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
  function createStore(samples, referenceDate, getStorage = () => window.localStorage) {
    const minimumNumber = Math.max(0, ...samples.map((project) => Number(project.code.split('-').at(-1)) || 0)) + 1;
    const failure = () => ({ ok: false, error: '프로젝트 기록을 읽을 수 없어요. 기존 기록을 보호하기 위해 등록을 중단했어요. 저장된 최신 목록은 확인하지 못했어요.' });
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
        return { ok: true, data };
      } catch { return failure(); }
    }
    function combined(data) {
      return [...JSON.parse(JSON.stringify(samples)), ...data.projects.map(asProject)];
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
    return { list, add };
  }
  return { STORAGE_KEY, PURPOSES, validate, createStore };
})();
