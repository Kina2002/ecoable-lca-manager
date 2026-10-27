/* 계정별 서버 기록. 화면의 기존 저장 규칙은 유지하고, 완성된 기록 묶음을 버전으로 저장한다. */
window.LCA = window.LCA || {};
LCA.cloud = (() => {
  const allKeys = [...LCA.storage.DATA_KEYS, LCA.storage.SAMPLE_KEY];
  const allowedKeys = [...allKeys, LCA.storage.JOURNAL_KEY, LCA.storage.EPOCH_KEY];
  let user = null; let adapter = null; let values = {}; let revision = 0; let updatedAt = null;
  let cacheKey = ''; let cacheText = null; let synced = ''; let timer = null;
  let active = false; let blocked = false; let sending = false; let pending = false; let started = false;
  let maxBytes = 1000000; let retryWrite = null; let backedUp = false; let recoveryText = null;
  const $ = (id) => document.getElementById(id);
  const fingerprint = (source) => JSON.stringify(Object.fromEntries(allKeys.map(key => [key, source[key] ?? null])));
  function status(message, error = false) {
    $('cloud-status').textContent = message;
    $('cloud-bar').classList.toggle('cloud-error', error);
    $('cloud-retry').hidden = !active || (!pending && !blocked);
    $('cloud-export').hidden = !active;
    $('cloud-reload').hidden = !blocked || !active;
    $('cloud-confirm-label').hidden = !blocked || !active;
  }
  function freeze(message) {
    blocked = true; document.querySelector('.app-shell').inert = true;
    status(message, true);
  }
  function cache(next = values, nextPending = pending) {
    if (window.localStorage.getItem(cacheKey) !== cacheText) {
      freeze('다른 창에서 같은 계정의 기록이 바뀌었어요. 이 창의 기록과 저장 전 입력을 보관한 뒤 다시 열어 주세요.');
      throw Error('다른 창의 기록을 덮어쓰지 않도록 저장을 멈췄어요.');
    }
    const text = JSON.stringify({ version: 1, userId: user.id, revision, updatedAt, values: next, pending: nextPending });
    window.localStorage.setItem(cacheKey, text);
    cacheText = text; values = next; pending = nextPending;
  }
  function schedule() {
    if (!started || blocked) return;
    clearTimeout(timer); timer = setTimeout(flush, 600);
  }
  function mutate(key, value) {
    if (blocked) throw Error('서버 기록을 다시 확인한 뒤 저장해 주세요.');
    if (!allowedKeys.includes(key)) throw Error('지원하지 않는 저장 항목이에요.');
    const next = { ...values };
    if (value === null) delete next[key]; else next[key] = String(value);
    cache(next, true); backedUp = false; $('cloud-reload').disabled = true; $('cloud-confirm').checked = false;
    status('이 기기에 보관했어요. 서버 저장 대기 중이에요.'); schedule();
  }
  function payload(source = values) {
    // 중단된 전체 교체는 기존 복구 저널의 변경 전 기록을 백업한다.
    let selected = source;
    if (source[LCA.storage.JOURNAL_KEY]) {
      const journal = JSON.parse(source[LCA.storage.JOURNAL_KEY]);
      if (journal.version !== 1 || !journal.before) throw Error('복구 기록을 확인해야 해요.');
      selected = journal.before;
    }
    const sampleDate = selected[LCA.storage.SAMPLE_KEY] || LCA.rules.today();
    const records = Object.fromEntries(LCA.storage.DATA_KEYS.map(key => [key, selected[key] ?? null]));
    LCA.backup.inspect(records, sampleDate);
    return { format: 'lca-project-manager-backup', version: 1, createdAt: new Date().toISOString(), sampleDate, records };
  }
  async function api(path, options = {}) {
    const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(15000), ...options,
      headers: { ...(user ? { 'X-LCA-Account': user.id } : {}), ...options.headers } });
    let body; try { body = await response.json(); } catch { throw Error('서버 응답을 읽지 못했어요. 잠시 후 다시 시도해 주세요.'); }
    if (!response.ok) { const error = Error(body.error || '서버와 연결하지 못했어요.'); error.status = response.status; throw error; }
    return body;
  }
  async function flush() {
    clearTimeout(timer);
    if (!active || blocked || sending || !started) return;
    if (values[LCA.storage.JOURNAL_KEY]) { schedule(); return; }
    const snapshot = fingerprint(values);
    if (snapshot === synced && !retryWrite) {
      try { cache(values, false); } catch (error) { freeze(error.message); }
      return;
    }
    sending = true; let saved = false; status('서버에 저장하고 있어요.');
    try {
      // 응답을 받지 못하면 같은 요청 번호로 먼저 재시도한다.
      const request = retryWrite || { revision, writeId: crypto.randomUUID(), data: payload(), fingerprint: snapshot };
      const body = JSON.stringify({ revision: request.revision, writeId: request.writeId, data: request.data });
      if (new Blob([body]).size > maxBytes) throw Error('서버 저장은 기록 묶음 1MB까지 지원해요. 백업 파일로 기록을 보관해 주세요.');
      retryWrite = request;
      const result = await api('/api/workspace', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body });
      if (!Number.isSafeInteger(result.revision) || result.revision <= revision || !Number.isFinite(Date.parse(result.updatedAt))) throw Error('서버 저장 결과를 확인하지 못했어요.');
      revision = result.revision; updatedAt = result.updatedAt; synced = request.fingerprint; retryWrite = null;
      cache(values, fingerprint(values) !== synced);
      saved = true;
      status(pending ? '추가 변경을 서버에 저장할 준비 중이에요.' : `서버 저장 완료 · ${new Intl.DateTimeFormat('ko-KR', { timeStyle: 'short', timeZone: 'Asia/Seoul' }).format(new Date(updatedAt))} (한국 시간)`);
    } catch (error) {
      if ([401, 403, 409].includes(error.status)) freeze(`${error.message} 저장 전 입력도 따로 보관해 주세요.`);
      else status(`${error.message || '서버에 연결하지 못했어요.'} 아직 서버 저장이 끝나지 않았어요. 이 창에서 재시도하거나 기록을 내려받아 주세요.`, true);
    } finally { sending = false; if (saved && pending && !blocked) schedule(); }
  }
  async function connect() {
    $('cloud-signin').href = '/signin-with-chatgpt?return_to=%2F';
    $('cloud-local').href = '/?storage=local';
    $('cloud-server').href = '/';
    $('cloud-signout').href = '/signout-with-chatgpt?return_to=%2F%3Fstorage%3Dlocal';
    $('cloud-retry').addEventListener('click', () => { if (blocked) status('기록을 내려받고 저장 전 입력을 보관한 뒤 서버 최신 기록을 다시 열어 주세요.', true); else flush(); });
    $('cloud-export').addEventListener('click', async () => {
      try {
        const file = recoveryText === null
          ? { content: JSON.stringify(payload(), null, 2), fileName: `LCA-서버저장전-백업-${LCA.rules.today()}.json` }
          : { content: recoveryText, fileName: `LCA-임시복구기록-${LCA.rules.today()}.json` };
        await LCA.backup.save(file, 'download'); backedUp = true;
        $('cloud-reload').disabled = !$('cloud-confirm').checked;
        status('이 기기 기록의 다운로드를 요청했어요. 파일 저장 완료와 저장 전 입력 보관 여부를 확인해 주세요.', blocked);
      } catch (error) { status(error.message || '기록을 내려받지 못했어요.', true); }
    });
    $('cloud-confirm').addEventListener('change', () => { $('cloud-reload').disabled = !backedUp || !$('cloud-confirm').checked; });
    $('cloud-reload').addEventListener('click', () => {
      if (!backedUp || !$('cloud-confirm').checked || sending) return;
      if (window.localStorage.getItem(cacheKey) !== cacheText) { status('다른 창에서 기록을 저장했어요. 다른 창의 저장을 마치고 닫은 뒤 새로고침해 주세요.', true); return; }
      window.localStorage.removeItem(cacheKey); pending = false; window.location.reload();
    });
    if (new URLSearchParams(location.search).get('storage') === 'local') {
      $('cloud-server').hidden = false;
      status('브라우저 체험 · 이 기기에만 기록을 저장해요. 서버 기록과는 별개예요.'); return { ready: true };
    }
    let result;
    try { result = await api('/api/session'); }
    catch (error) {
      // Python 등 기존 정적 미리보기에는 서버 API가 없다.
      if (['localhost', '127.0.0.1'].includes(location.hostname)) { status('브라우저 체험 · 현재 미리보기는 이 기기에만 저장해요.'); return { ready: true }; }
      $('cloud-local').hidden = false; $('cloud-server').hidden = false;
      freeze('서버 연결을 확인하지 못했어요. 다시 열거나 브라우저 체험을 선택해 주세요. 기존 기록은 그대로 보관돼요.'); return { ready: false };
    }
    if (!result.user) {
      $('cloud-signin').hidden = false;
      status('브라우저 체험 · 로그인하면 내 기록을 서버에 저장하고 다른 기기에서도 이어 쓸 수 있어요.'); return { ready: true };
    }
    user = result.user;
    if (typeof user.id !== 'string' || !user.id || typeof user.name !== 'string') { freeze('로그인 정보를 확인하지 못했어요. 다시 로그인해 주세요.'); return { ready: false }; }
    maxBytes = Math.min(maxBytes, result.maxBytes || maxBytes);
    $('cloud-account').textContent = user.name; $('cloud-account').hidden = false;
    $('cloud-signout').hidden = false; $('cloud-local').hidden = false;
    cacheKey = `lca-cloud-cache.v1.${encodeURIComponent(user.id)}`;
    active = true;
    try {
      cacheText = window.localStorage.getItem(cacheKey);
      let previous = null;
      if (cacheText) {
        recoveryText = cacheText;
        previous = JSON.parse(cacheText);
        if (previous.version !== 1 || previous.userId !== user.id || !Number.isSafeInteger(previous.revision) || previous.revision < 0
          || typeof previous.pending !== 'boolean' || !previous.values || typeof previous.values !== 'object'
          || Array.isArray(previous.values) || Object.entries(previous.values).some(([key, value]) => !allowedKeys.includes(key) || typeof value !== 'string' && value !== null)) throw Error('이 기기의 임시 기록을 확인하지 못했어요. 임시 복구 기록을 내려받아 보관해 주세요.');
        values = previous.values; recoveryText = null;
      }
      const remote = await api('/api/workspace');
      if (!Number.isSafeInteger(remote.revision) || remote.revision < 0 || (!!remote.data !== (remote.revision > 0))) throw Error('서버 기록 형식을 확인하지 못했어요.');
      const parsed = remote.data ? LCA.backup.parse(JSON.stringify(remote.data)).data : payload(Object.fromEntries(allKeys.map(key => [key, null])));
      revision = remote.revision; updatedAt = remote.updatedAt;
      const remoteValues = { ...parsed.records, [LCA.storage.SAMPLE_KEY]: parsed.sampleDate };
      values = remoteValues; synced = revision ? fingerprint(values) : '';
      if (previous?.pending && fingerprint(previous.values) !== synced) {
        values = previous.values; pending = true;
        if (previous.revision !== revision) { freeze('다른 기기의 최신 기록과 이 기기에 남은 미저장 기록이 달라요. 기록을 내려받고 저장 전 입력을 보관한 뒤 서버 최신 기록을 열어 주세요.'); return { ready: false }; }
      }
      // 새 계정의 기본 프로젝트 기준일도 서버에 보관한다.
      if (revision === 0) pending = true;
      cache(values, pending);
      adapter = {
        get length() { return Object.keys(values).length; },
        key(index) { return Object.keys(values)[index] ?? null; },
        getItem(key) { return values[key] ?? null; },
        setItem: (key, value) => mutate(key, value), removeItem: (key) => mutate(key, null),
      };
      window.addEventListener('storage', (event) => {
        if (event.key === cacheKey || event.key === null) freeze('다른 창에서 같은 계정의 기록이 바뀌었어요. 이 창의 기록과 저장 전 입력을 보관한 뒤 다시 열어 주세요.');
      });
      window.addEventListener('beforeunload', (event) => { if (pending || sending) { event.preventDefault(); event.returnValue = ''; } });
      window.addEventListener('online', () => { if (pending) flush(); });
      status(pending ? '내 기록을 서버에 저장할 준비 중이에요. 기존 브라우저 체험 기록은 별도로 남아 있어요.' : '내 서버 기록을 열었어요.');
      return { ready: true };
    } catch (error) { freeze(error.message || '내 서버 기록을 열지 못했어요. 기존 기록을 보관한 뒤 다시 열어 주세요.'); return { ready: false }; }
  }
  function start() { started = true; if (pending) schedule(); }
  return { connect, start, raw: () => adapter || window.localStorage };
})();
