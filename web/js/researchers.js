window.LCA = window.LCA || {};
LCA.researchers = (() => {
  const STORAGE_KEY = 'ecoable-lca-manager.researchers.v1';
  const SAMPLES = [
    { id: 'researcher-sample-1', code: 'RSR-001', name: '김하늘', company: '새움환경컨설팅', department: '제품환경팀' },
    { id: 'researcher-sample-2', code: 'RSR-002', name: '박서연', company: '새움환경컨설팅', department: '탄소평가팀' },
    { id: 'researcher-sample-3', code: 'RSR-003', name: '이도윤', company: '새움환경컨설팅', department: 'LCA분석팀' }
  ];
  const validText = (value, required = false) => typeof value === 'string' && value.trim().length <= 100 && (!required || !!value.trim());
  const validProfile = (value) => value && validText(value.name, true) && validText(value.company) && validText(value.department);
  function createStore(getStorage = () => LCA.storage ? LCA.storage.get() : window.localStorage) {
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
            || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 100
            || (item.company !== undefined && !validText(item.company)) || (item.department !== undefined && !validText(item.department))) return failure();
          seen.add(item.number);
        }
        const ids = new Set([...SAMPLES, ...data.researchers].map((p) => p.id));
        if (data.profiles !== undefined && (!data.profiles || typeof data.profiles !== 'object' || Array.isArray(data.profiles)
          || Object.entries(data.profiles).some(([id, profile]) => !ids.has(id) || !validProfile(profile) || !Number.isSafeInteger(profile.revision) || profile.revision < 1))) return failure();
        return { ok: true, data };
      } catch { return failure(); }
    }
    function items(data) { return [...SAMPLES, ...data.researchers].map((item) => ({ ...item, company: item.company || '', department: item.department || '', revision: 0, ...(data.profiles?.[item.id] || {}), isFictional: true })); }
    function list() {
      const result = read();
      return result.ok ? { ok: true, items: items(result.data) } : result;
    }
    function add(name, company = '', department = '') {
      if (typeof name !== 'string' || !name.trim() || name.trim().length > 100) return { ok: false, error: '연구원 이름을 1~100자로 입력해 주세요.' };
      if (!validText(company) || !validText(department)) return { ok: false, error: '회사와 부서명은 각각 100자 이내로 입력해 주세요.' };
      const result = read();
      if (!result.ok) return result;
      const number = result.data.nextNumber;
      if (number >= Number.MAX_SAFE_INTEGER) return { ok: false, error: '연구원 번호를 만들 수 없어요.' };
      const item = { id: `researcher-user-${number}`, code: `RSR-${String(number).padStart(3, '0')}`, number, name: name.trim(), company: company.trim(), department: department.trim() };
      const data = { ...result.data, nextNumber: number + 1, researchers: [...result.data.researchers, item] };
      try { getStorage().setItem(STORAGE_KEY, JSON.stringify(data)); }
      catch { return { ok: false, error: '연구원을 저장하지 못했어요. 입력을 유지했으니 브라우저 설정과 저장 공간을 확인해 주세요.' }; }
      return { ok: true, item, items: items(data) };
    }
    function update(id, draft, expected) {
      if (!validProfile(draft)) return { ok: false, error: '이름은 1~100자, 회사·부서는 각각 100자 이내로 입력해 주세요.' };
      const loaded = read(); if (!loaded.ok) return loaded;
      const current = items(loaded.data).find((p) => p.id === id);
      if (!current) return { ok: false, error: '연구원 정보를 찾을 수 없어요.' };
      if (!expected || ['name', 'company', 'department', 'revision'].some((key) => current[key] !== expected[key])) return { ok: false, error: '다른 화면에서 연구원 정보가 바뀌었어요. 입력을 보관한 뒤 창을 다시 열어 주세요.' };
      const profile = { name: draft.name.trim(), company: draft.company.trim(), department: draft.department.trim(), revision: current.revision + 1 };
      if (!Number.isSafeInteger(profile.revision)) return { ok: false, error: '수정 번호를 만들 수 없어요.' };
      if (['name', 'company', 'department'].every((key) => profile[key] === current[key])) return { ok: false, error: '바뀐 내용이 없어요.' };
      const data = { ...loaded.data, profiles: { ...(loaded.data.profiles || {}), [id]: profile } };
      try { getStorage().setItem(STORAGE_KEY, JSON.stringify(data)); }
      catch { return { ok: false, error: '연구원 정보를 저장하지 못했어요. 입력과 기존 정보는 유지했어요.' }; }
      return { ok: true, item: { ...current, ...profile } };
    }
    return { list, add, update };
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
