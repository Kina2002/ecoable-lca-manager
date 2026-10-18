/* 여러 저장 키의 복원 중단 복구와 다른 창의 오래된 쓰기를 막는다. */
window.LCA = window.LCA || {};
LCA.storage = (() => {
  const PREFIX = 'ecoable-lca-manager.';
  const DATA_KEYS = ['projects', 'researchers', 'scope', 'requests', 'modelling', 'interpretation', 'report', 'comments', 'verification', 'certification', 'review-route'].map((name) => `${PREFIX}${name}.v1`);
  const SAMPLE_KEY = `${PREFIX}sample-date.v1`;
  const JOURNAL_KEY = `${PREFIX}restore-journal.v1`;
  const EPOCH_KEY = `${PREFIX}restore-epoch.v1`;
  const KEYS = [...DATA_KEYS, SAMPLE_KEY];
  const LOCK = `${PREFIX}review-workflow-write`;
  let epoch = null; let ready = false;
  const raw = () => window.localStorage;
  const token = () => `${Date.now()}-${crypto.randomUUID()}`;
  function locked(action) { return navigator.locks?.request ? navigator.locks.request(LOCK, action) : Promise.resolve().then(action); }
  function readAll() {
    const storage = raw();
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key.startsWith(PREFIX) && ![...KEYS, JOURNAL_KEY, EPOCH_KEY].includes(key)) throw Error('현재 앱이 모르는 저장 기록이 있어요. 더 최신 버전의 앱에서 백업해 주세요.');
    }
    return Object.fromEntries(KEYS.map((key) => [key, storage.getItem(key)]));
  }
  function validValues(values) {
    return values && typeof values === 'object' && !Array.isArray(values) && Object.keys(values).length === KEYS.length
      && KEYS.every((key) => Object.hasOwn(values, key) && (values[key] === null || typeof values[key] === 'string'));
  }
  function writeAll(values) {
    // 먼저 기존 값을 비워 저널을 유지한 채 되돌릴 공간을 확보한다.
    for (const key of KEYS) raw().removeItem(key);
    for (const key of KEYS) if (values[key] !== null) raw().setItem(key, values[key]);
    const stored = readAll();
    if (KEYS.some((key) => stored[key] !== values[key])) throw Error('저장 결과가 일치하지 않아요.');
  }
  async function bootstrap() {
    return locked(() => {
      const journalRaw = raw().getItem(JOURNAL_KEY);
      if (journalRaw !== null) {
        const journal = JSON.parse(journalRaw);
        if (journal?.version !== 1 || !validValues(journal.before)) throw Error('중단된 복원 기록을 읽지 못했어요.');
        writeAll(journal.before);
        raw().setItem(EPOCH_KEY, token());
        raw().removeItem(JOURNAL_KEY);
      }
      epoch = raw().getItem(EPOCH_KEY); ready = true;
      return { recovered: journalRaw !== null };
    });
  }
  function assertCurrent() {
    if (!ready || raw().getItem(JOURNAL_KEY) !== null || raw().getItem(EPOCH_KEY) !== epoch) throw Error('백업 복원으로 기록이 바뀌었어요. 작성 내용을 따로 보관한 뒤 새로고침해 주세요.');
  }
  const guarded = {
    getItem(key) { assertCurrent(); return raw().getItem(key); },
    setItem(key, value) { assertCurrent(); raw().setItem(key, value); },
    removeItem(key) { assertCurrent(); raw().removeItem(key); }
  };
  function capture() {
    assertCurrent(); const values = readAll(); assertCurrent();
    if (JSON.stringify(values) !== JSON.stringify(readAll())) throw Error('다른 창에서 기록을 저장하고 있어요. 저장이 끝난 뒤 다시 백업해 주세요.');
    return values;
  }
  async function replace(values, expected) {
    return locked(() => {
      assertCurrent();
      if (!validValues(values) || JSON.stringify(readAll()) !== expected) return { ok: false, error: '현재 기록이 바뀌었어요. 현재 기록을 다시 백업한 뒤 복원해 주세요.' };
      const before = readAll(); let journalSaved = false;
      try {
        raw().setItem(JOURNAL_KEY, JSON.stringify({ version: 1, before })); journalSaved = true;
        raw().setItem(EPOCH_KEY, token());
        writeAll(values);
        raw().removeItem(JOURNAL_KEY);
        ready = false;
        return { ok: true };
      } catch {
        if (!journalSaved) return { ok: false, error: '복원을 위한 임시 공간을 확보하지 못했어요. 현재 기록은 바꾸지 않았어요. 브라우저 저장 공간을 확인해 주세요.' };
        try {
          writeAll(before); raw().removeItem(JOURNAL_KEY); epoch = raw().getItem(EPOCH_KEY);
          return { ok: false, error: '복원하지 못해 기존 기록으로 되돌렸어요. 브라우저 저장 공간을 확인해 주세요.' };
        } catch {
          ready = false;
          return { ok: false, fatal: true, error: '복원을 끝내지 못했어요. 복구 기록을 보관했으니 다른 창을 닫고 새로고침해 주세요. 문제가 계속되면 내려받은 기존 백업 파일을 보관해 주세요.' };
        }
      }
    });
  }
  function changed() {
    try { return !ready || raw().getItem(EPOCH_KEY) !== epoch; } catch { return true; }
  }
  return { DATA_KEYS, SAMPLE_KEY, JOURNAL_KEY, EPOCH_KEY, bootstrap, get: () => guarded, capture, replace, changed };
})();
