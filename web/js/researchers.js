window.LCA = window.LCA || {};
LCA.researchers = (() => {
  const STORAGE_KEY = 'ecoable-lca-manager.researchers.v1';
  const SAMPLES = [
    { id: 'researcher-sample-1', code: 'RSR-001', name: '김하늘' },
    { id: 'researcher-sample-2', code: 'RSR-002', name: '박서연' },
    { id: 'researcher-sample-3', code: 'RSR-003', name: '이도윤' }
  ];
  function createStore(getStorage = () => window.localStorage) {
    const failure = () => ({ ok: false, error: '연구원 기록을 읽을 수 없어요. 기존 기록을 보호하기 위해 등록과 선택을 중단했어요.' });
    function read() {
      try {
        const raw = getStorage().getItem(STORAGE_KEY);
        if (raw === null) return { ok: true, data: { version: 1, nextNumber: 4, researchers: [] } };
        const data = JSON.parse(raw);
        if (!data || data.version !== 1 || !Number.isSafeInteger(data.nextNumber) || data.nextNumber < 4 || !Array.isArray(data.researchers)) return failure();
        const seen = new Set();
        for (const item of data.researchers) {
          if (!item || !Number.isSafeInteger(item.number) || item.number < 4 || item.number >= data.nextNumber || seen.has(item.number)
            || item.id !== `researcher-user-${item.number}` || item.code !== `RSR-${String(item.number).padStart(3, '0')}`
            || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 100) return failure();
          seen.add(item.number);
        }
        return { ok: true, data };
      } catch { return failure(); }
    }
    function items(data) { return [...SAMPLES, ...data.researchers].map((item) => ({ ...item, isFictional: true })); }
    function list() {
      const result = read();
      return result.ok ? { ok: true, items: items(result.data) } : result;
    }
    function add(name) {
      if (typeof name !== 'string' || !name.trim() || name.trim().length > 100) return { ok: false, error: '연구원 이름을 1~100자로 입력해 주세요.' };
      const result = read();
      if (!result.ok) return result;
      const number = result.data.nextNumber;
      if (number >= Number.MAX_SAFE_INTEGER) return { ok: false, error: '연구원 번호를 만들 수 없어요.' };
      const item = { id: `researcher-user-${number}`, code: `RSR-${String(number).padStart(3, '0')}`, number, name: name.trim() };
      const data = { ...result.data, nextNumber: number + 1, researchers: [...result.data.researchers, item] };
      try { getStorage().setItem(STORAGE_KEY, JSON.stringify(data)); }
      catch { return { ok: false, error: '연구원을 저장하지 못했어요. 입력을 유지했으니 브라우저 설정과 저장 공간을 확인해 주세요.' }; }
      return { ok: true, item, items: items(data) };
    }
    return { list, add };
  }
  function overview(researchers, projects) {
    const ids = new Set(researchers.map((item) => item.id));
    return {
      rows: researchers.map((person) => ({ ...person, projects: projects.filter((project) => project.researcherId === person.id) })),
      unlinked: projects.filter((project) => !ids.has(project.researcherId) && (project.researcherName || project.researcherId)),
      unassigned: projects.filter((project) => !project.researcherName && !project.researcherId)
    };
  }
  return { STORAGE_KEY, SAMPLES, createStore, overview };
})();
