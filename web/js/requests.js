/* 자료 요청 명단과 저장 규칙. 저장에 성공한 다음에만 새 기록을 돌려준다. */
window.LCA = window.LCA || {};

LCA.requests = (() => {
  const STORAGE_KEY = 'ecoable-lca-manager.requests.v1';
  const VERSION = 1;
  const MAX_DETAIL = 1000;
  const categoryByKey = (key) => LCA.constants.CATEGORIES.find((category) => category.key === key);

  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1];
  }

  function validate(draft) {
    const errors = {};
    if (!categoryByKey(draft.categoryKey)) errors.categoryKey = '자료 구분을 골라 주세요.';
    if (typeof draft.detail !== 'string' || !draft.detail.trim()) errors.detail = '받고 싶은 자료의 내용을 적어 주세요.';
    else if (draft.detail.trim().length > MAX_DETAIL) errors.detail = `요청 내용은 ${MAX_DETAIL}자까지 적을 수 있어요.`;
    if (!validDate(draft.dueDate)) errors.dueDate = '제출 기한을 올바른 날짜로 골라 주세요.';
    return errors;
  }

  function createStore(projectIds, getStorage = () => window.localStorage) {
    const knownProjects = new Set(projectIds);
    const failure = (message) => ({ ok: false, message });

    function read() {
      try {
        const raw = getStorage().getItem(STORAGE_KEY);
        if (raw === null) return { ok: true, data: { version: VERSION, nextNumber: 1, requests: [] } };
        const data = JSON.parse(raw);
        if (!data || data.version !== VERSION || !Array.isArray(data.requests)
          || !Number.isSafeInteger(data.nextNumber) || data.nextNumber < 1) throw new Error('invalid schema');
        const ids = new Set();
        const projectCategories = new Set();
        for (const item of data.requests) {
          if (!item || typeof item.id !== 'string' || !/^DRQ-\d{4,}$/.test(item.id)) throw new Error('invalid id');
          const number = Number(item.id.slice(4));
          const pair = `${item.projectId}:${item.categoryKey}`;
          const guide = item.guideline;
          if (!Number.isSafeInteger(number) || number < 1 || number >= data.nextNumber || ids.has(item.id)
            || !knownProjects.has(item.projectId) || projectCategories.has(pair)
            || Object.keys(validate(item)).length || item.status !== '요청'
            || typeof item.createdAt !== 'string' || !Number.isFinite(Date.parse(item.createdAt))
            || !guide || typeof guide.source !== 'string' || typeof guide.section !== 'string'
            || guide.url !== LCA.constants.REQUEST_GUIDELINE.url || !validDate(guide.checkedOn)
            || !Number.isInteger(guide.page) || guide.page < 1 || typeof guide.note !== 'string') throw new Error('invalid record');
          ids.add(item.id);
          projectCategories.add(pair);
        }
        return { ok: true, data };
      } catch {
        return failure('저장한 자료 요청을 읽지 못했습니다. 기존 기록을 보호하기 위해 등록을 멈췄습니다. 브라우저의 저장 설정과 기록을 확인해 주세요.');
      }
    }

    function list(projectId) {
      const result = read();
      if (!result.ok) return result;
      return { ok: true, items: result.data.requests.filter((item) => item.projectId === projectId) };
    }

    function add(projectId, draft) {
      const errors = validate(draft);
      if (Object.keys(errors).length) return { ok: false, errors };
      if (!knownProjects.has(projectId)) return failure('프로젝트를 확인할 수 없습니다. 목록에서 다시 열어 주세요.');
      // 매번 최신 저장본을 읽어 다른 프로젝트의 기록과 번호를 이어 쓴다.
      const current = read();
      if (!current.ok) return current;
      if (current.data.requests.some((item) => item.projectId === projectId && item.categoryKey === draft.categoryKey)) {
        return { ok: false, errors: { categoryKey: '이 프로젝트에 이미 등록한 자료 구분이에요. 다른 구분을 골라 주세요.' } };
      }
      const number = current.data.nextNumber;
      if (!Number.isSafeInteger(number + 1)) return failure('요청 번호를 만들 수 없습니다. 저장 기록을 확인해 주세요.');
      const item = {
        id: `DRQ-${String(number).padStart(4, '0')}`,
        projectId, categoryKey: draft.categoryKey, detail: draft.detail.trim(), dueDate: draft.dueDate,
        status: '요청', createdAt: new Date().toISOString(),
        guideline: LCA.constants.requestGuideline(draft.categoryKey)
      };
      const data = { ...current.data, nextNumber: number + 1, requests: [...current.data.requests, item] };
      try {
        getStorage().setItem(STORAGE_KEY, JSON.stringify(data));
        return { ok: true, item };
      } catch {
        return failure('브라우저에 저장하지 못했습니다. 입력 내용은 남겨 두었어요. 저장 공간이나 저장 허용 설정을 확인한 뒤 다시 등록해 주세요.');
      }
    }

    return { list, add };
  }

  return { STORAGE_KEY, MAX_DETAIL, validDate, validate, createStore };
})();
