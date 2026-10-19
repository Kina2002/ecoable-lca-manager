/* 검증 완료의 근거를 고정하고 인증·등록 또는 고객 제출 이력을 보관한다. */
window.LCA = window.LCA || {};
LCA.certification = (() => {
  const STORAGE_KEY = 'ecoable-lca-manager.certification.v1';
  const STATUSES = ['제출 준비', '제출 완료', '보완 요청', '승인·등록', '반려'];
  const TRANSITIONS = { '제출 준비': ['제출 준비', '제출 완료'], '제출 완료': ['제출 완료', '보완 요청', '승인·등록', '반려'],
    '보완 요청': ['보완 요청', '제출 완료', '반려'], '승인·등록': ['승인·등록'], '반려': ['반려'] };
  const { text, date, clone } = LCA.reviewWorkflow;
  const FIELDS = ['kind', 'organization', 'scheme', 'submittedOn', 'registrationNumber', 'issuedOn', 'note'];
  const CHECK_STATUSES = ['유효', '취소', '확인 필요'];
  const EXPIRY_SCHEMES = Object.freeze({ '환경성적표지': { kind: '인증', years: 3, minusOne: true }, '저탄소제품': { kind: '인증', years: 3, minusOne: true },
    'International EPD': { kind: '등록', years: 5, minusOne: false }, 'EPD Norway': { kind: '등록', years: 5, minusOne: false }, 'UL EPD': { kind: '등록', years: 5, minusOne: false } });
  function expectedExpiry(details, status) {
    if (!details || status !== '승인·등록' || !['인증', '등록'].includes(details.kind)) return null;
    const scheme = EXPIRY_SCHEMES[details.scheme?.trim()];
    if (!scheme || scheme.kind !== details.kind || !LCA.requests.validDate(details.issuedOn)) return null;
    const [year, month, day] = details.issuedOn.split('-').map(Number);
    if (year + scheme.years > 9999) return null;
    const anniversary = new Date(0);
    anniversary.setUTCFullYear(year + scheme.years, month - 1, day);
    if (scheme.minusOne) anniversary.setUTCDate(anniversary.getUTCDate() - 1);
    return { date: anniversary.toISOString().slice(0, 10), scheme: details.scheme.trim(), issuedOn: details.issuedOn };
  }
  function renewalSchedule(details, status, today = LCA.rules.today(), officialExpiryOn = '') {
    const estimate = expectedExpiry(details, status);
    const confirmed = status === '승인·등록' && ['인증', '등록'].includes(details?.kind) && details?.scheme?.trim()
      && LCA.requests.validDate(details.issuedOn) && LCA.requests.validDate(officialExpiryOn) && officialExpiryOn >= details.issuedOn;
    const expiry = confirmed ? { date: officialExpiryOn, scheme: details.scheme.trim(), issuedOn: details.issuedOn, official: true } : estimate;
    if (!expiry || !LCA.requests.validDate(today)) return null;
    const start = new Date(0);
    const [year, month, day] = expiry.date.split('-').map(Number);
    start.setUTCFullYear(year, month - 1, day);
    if (expiry.scheme === 'UL EPD') start.setUTCDate(start.getUTCDate() - 60);
    else {
      start.setUTCFullYear(year, month - 7, 1);
      const lastDay = new Date(0); lastDay.setUTCFullYear(start.getUTCFullYear(), start.getUTCMonth() + 1, 0);
      start.setUTCDate(Math.min(day, lastDay.getUTCDate()));
    }
    const days = LCA.rules.daysBetween(today, expiry.date);
    return { ...expiry, startDate: start.toISOString().slice(0, 10), days, active: today >= start.toISOString().slice(0, 10),
      label: expiry.scheme === 'UL EPD' ? '갱신 요청 확인' : '갱신 준비' };
  }
  const matchesIssue = (event, details) => !!details && ['kind', 'scheme', 'issuedOn', 'registrationNumber'].every((key) => event[key] === details[key]);
  function inspectionCycles(details, status, plan, inspections = [], officialExpiryOn = '') {
    if (details?.kind !== '등록' || details.scheme?.trim() !== 'International EPD' || status !== '승인·등록'
      || !plan || !LCA.requests.validDate(plan.versionOn) || !text(plan.version, 80)) return [];
    const expiry = renewalSchedule(details, status, LCA.rules.today(), officialExpiryOn); if (!expiry) return [];
    const [year, month, day] = plan.versionOn.split('-').map(Number); const cycles = [];
    for (let nextYear = year + 1; nextYear <= 9999; nextYear++) {
      const due = new Date(0); due.setUTCFullYear(nextYear, month, 0);
      due.setUTCDate(Math.min(day, due.getUTCDate()));
      const dueOn = due.toISOString().slice(0, 10); if (dueOn >= expiry.date) break;
      const latest = inspections.filter((event) => event.dueOn === dueOn && event.versionOn === plan.versionOn && event.version === plan.version).at(-1) || null;
      const start = new Date(due); start.setUTCDate(start.getUTCDate() - 30);
      cycles.push({ date: dueOn, startDate: start.toISOString().slice(0, 10), latest, completed: latest?.status === '점검 완료' });
    }
    return cycles;
  }
  function inspectionSchedule(details, status, plan, inspections = [], today = LCA.rules.today(), officialExpiryOn = '') {
    if (!LCA.requests.validDate(today)) return null;
    const cycle = inspectionCycles(details, status, plan, inspections, officialExpiryOn).find((item) => !item.completed);
    return cycle ? { ...cycle, days: LCA.rules.daysBetween(today, cycle.date), active: today >= cycle.startDate } : null;
  }
  function aftercare(record, process) {
    const events = record.events.filter((event) => matchesIssue(event, process?.details));
    const renewed = record.events.filter((event) => event.type === 'renewed' && matchesIssue(event.details, process?.details)).at(-1);
    const validity = events.filter((event) => event.type === 'validity').at(-1) || renewed || null;
    const inspectionPlan = events.filter((event) => event.type === 'inspection-plan').at(-1) || null;
    const inspections = events.filter((event) => event.type === 'inspection' && event.version === inspectionPlan?.version && event.versionOn === inspectionPlan?.versionOn);
    const renewalProgress = events.filter((event) => event.type === 'renewal-progress').at(-1) || null;
    const statusChecks = events.filter((event) => event.type === 'status-check');
    const cancelled = statusChecks.filter((event) => event.status !== '확인 필요').at(-1)?.status === '취소';
    return { validity, inspectionPlan, inspections, renewalProgress, statusChecks, cancelled };
  }
  // 제출 진행과 구분한 문서 기준 상태다. 기관의 실시간 상태를 추측하지 않는다.
  function currentStatus(process, care = {}, today = LCA.rules.today()) {
    if (!process) return { label: '준비', detail: '아직 인증·등록 또는 고객 제출을 시작하지 않았어요.' };
    if (process.details.kind === '고객 제출') return { label: '대상 아님', detail: `고객 제출 · ${process.status}. 인증 유효 상태를 적용하지 않아요.` };
    if (process.status === '제출 준비') return { label: '준비', detail: '기관에 제출하기 전이에요.' };
    if (['제출 완료', '보완 요청'].includes(process.status)) return { label: '심사 중', detail: `기록한 제출 진행: ${process.status}` };
    if (process.status !== '승인·등록') return { label: '확인 필요', detail: `제출 결과는 ${process.status}이에요. 인증 취소와 구분해요.` };
    const latest = care.statusChecks?.at(-1);
    if (care.cancelled) return { label: '취소', detail: '취소 확인 기록이 있어요. 유효 회복 확인이나 새 인증서 갱신을 기록하기 전까지 취소를 유지해요.' };
    if (latest?.status === '확인 필요') return { label: '확인 필요', detail: '담당자가 추가 확인이 필요하다고 기록했어요. 확인 후 새 이력을 남겨 주세요.' };
    const schedule = renewalSchedule(process.details, process.status, today, care.validity?.expiryOn);
    if (!schedule?.official) return { label: '확인 필요', detail: `공식 만료일을 아직 기록하지 않았어요.${schedule ? ` 예상 만료일 ${schedule.date}은 유효 판정에 사용하지 않아요.` : ''}` };
    if (today < process.details.issuedOn) return { label: '확인 필요', detail: '기록한 발급일이 아직 오지 않았어요. 문서의 날짜를 확인해 주세요.' };
    return { label: schedule.days < 0 ? '만료' : schedule.active ? '만료 임박' : '유효',
      detail: `기록한 문서 기준 · 공식 만료일 ${schedule.date} · ${schedule.days < 0 ? `${-schedule.days}일 경과` : schedule.days === 0 ? '오늘까지' : `${schedule.days}일 남음`}. 기관의 실시간 상태와 다를 수 있어요.` };
  }
  function validDetails(value, status) {
    if (!value || !['인증', '등록', '고객 제출'].includes(value.kind) || !text(value.organization, 200) || !text(value.scheme, 200)
      || !text(value.registrationNumber, 200, false) || !text(value.note, 2000, false)
      || !(value.submittedOn === '' || LCA.requests.validDate(value.submittedOn)) || !(value.issuedOn === '' || LCA.requests.validDate(value.issuedOn))) return false;
    if (status !== '제출 준비' && !value.submittedOn) return false;
    if (status === '승인·등록' && (!text(value.registrationNumber, 200) || !value.issuedOn)) return false;
    return !(value.submittedOn && value.issuedOn && value.issuedOn < value.submittedOn);
  }
  function validRecord(record, id) {
    if (!record || !Array.isArray(record.events) || !record.events.length || record.revision !== record.events.length) return false;
    let started = false; let status = ''; let lastDate = ''; let completion = null; let process = null; let finished = false;
    let validity = null; let inspectionPlan = null;
    for (const [index, event] of record.events.entries()) {
      if (!event || !date(event.at) || !text(event.actor, 100) || (lastDate && Date.parse(event.at) < Date.parse(lastDate))) return false;
      lastDate = event.at;
      const careBefore = () => aftercare({ events: record.events.slice(0, index) }, process);
      if (event.type === 'status-check') {
        const previousCare = careBefore();
        const previous = previousCare.statusChecks.at(-1);
        if (!process || status !== '승인·등록' || !['인증', '등록'].includes(process.details.kind)
          || !matchesIssue(event, process.details) || event.organization !== process.details.organization
          || !CHECK_STATUSES.includes(event.status) || !LCA.requests.validDate(event.checkedOn)
          || event.checkedOn < process.details.issuedOn || (previous && event.checkedOn < previous.checkedOn)
          || event.checkedOn > new Date(Date.parse(event.at) + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
          || !text(event.documentName, 200) || !text(event.reason, 1000) || event.confirmed !== true
          || event.expiryOn !== (previousCare.validity?.expiryOn || '')
          || (event.status === '유효' && (!event.expiryOn || event.checkedOn > event.expiryOn))) return false;
        continue;
      }
      if (['renewal-progress', 'renewed'].includes(event.type)) {
        if (!process || status !== '승인·등록' || !['인증', '등록'].includes(process.details.kind) || !matchesIssue(event, process.details)
          || !LCA.requests.validDate(event.actionOn) || event.actionOn < process.details.issuedOn || !text(event.documentName, 200)
          || !text(event.reason, 1000)) return false;
        if (event.type === 'renewal-progress') {
          if (careBefore().cancelled || !['갱신 준비', '갱신 요청'].includes(event.status)) return false;
        } else {
          if (event.status !== '승인·등록' || !validDetails(event.details, event.status) || event.confirmed !== true
            || event.details.kind !== process.details.kind || event.details.scheme !== process.details.scheme
            || event.details.issuedOn <= process.details.issuedOn || event.details.issuedOn > event.actionOn
            || event.details.submittedOn < process.details.issuedOn || !LCA.requests.validDate(event.expiryOn) || event.expiryOn <= event.details.issuedOn) return false;
          process = event; validity = { ...event, ...Object.fromEntries(['kind', 'scheme', 'issuedOn', 'registrationNumber'].map((key) => [key, event.details[key]])) };
        }
        continue;
      }
      if (event.type === 'validity') {
        if (!process || status !== '승인·등록' || !['인증', '등록'].includes(process.details.kind)
          || !LCA.requests.validDate(event.expiryOn) || event.expiryOn < process.details.issuedOn
          || event.kind !== process.details.kind || event.issuedOn !== process.details.issuedOn || event.scheme !== process.details.scheme
          || event.registrationNumber !== process.details.registrationNumber
          || !text(event.documentName, 200) || !text(event.reason, 1000)) return false;
        validity = event;
        continue;
      }
      if (event.type === 'inspection-plan') {
        if (careBefore().cancelled) return false;
        const official = validity && matchesIssue(validity, process?.details) ? validity.expiryOn : '';
        const expiry = renewalSchedule(process?.details, status, LCA.rules.today(), official);
        if (!process || status !== '승인·등록' || process.details.kind !== '등록' || process.details.scheme.trim() !== 'International EPD'
          || !matchesIssue(event, process.details) || !LCA.requests.validDate(event.versionOn) || !text(event.version, 80)
          || !expiry || event.versionOn >= expiry.date
          || !text(event.documentName, 200) || !text(event.reason, 1000)) return false;
        inspectionPlan = event;
        continue;
      }
      if (event.type === 'inspection') {
        if (careBefore().cancelled) return false;
        const official = validity && matchesIssue(validity, process?.details) ? validity.expiryOn : '';
        const cycles = inspectionCycles(process?.details, status, inspectionPlan, [], official);
        const cycle = cycles.find((item) => item.date === event.dueOn);
        if (!process || !matchesIssue(event, process.details) || !inspectionPlan || !matchesIssue(inspectionPlan, process.details)
          || event.version !== inspectionPlan.version || event.versionOn !== inspectionPlan.versionOn || !cycle
          || !['점검 중', '점검 완료'].includes(event.status) || !LCA.requests.validDate(event.checkedOn) || event.checkedOn < cycle.startDate
          || !text(event.documentName, 200) || !text(event.reason, 1000) || (event.status === '점검 완료' && event.confirmed !== true)) return false;
        continue;
      }
      if (finished) return false;
      if (event.type === 'completed') {
        const report = event.report;
        if (started || !LCA.requests.validDate(event.completedOn) || !text(event.documentName, 200) || !text(event.reason, 1000)
          || !report || report.projectId !== id || !Number.isSafeInteger(report.revision) || report.revision < 1
          || Object.keys(LCA.report.validate(report)).length || !LCA.report.validSource(report.source, id)
          || report.sourceKey !== JSON.stringify(report.source) || !date(report.createdAt) || !date(report.updatedAt) || Date.parse(report.createdAt) > Date.parse(report.updatedAt)
          || (report.legacy === true ? report.change !== undefined : report.legacy !== undefined || Object.keys(LCA.reportHistory.validate(report.change, report.revision === 1, true)).length > 0)) return false;
        const method = event.reviewMethod === undefined ? 'external' : event.reviewMethod;
        if (!['internal', 'external'].includes(method)) return false;
        if (method === 'internal') {
          if (event.verification !== null || !LCA.reviewRoute.validEvidence(event.reviewRoute, report, method)) return false;
        } else {
          if (!LCA.verification.validRecord(event.verification, id)
            || event.verification.issues.some((item) => LCA.reviewWorkflow.current(item).status !== '종결')
            || event.verification.rounds.at(-1).reportRevision > report.revision) return false;
          if (event.reviewMethod !== undefined && !LCA.reviewRoute.validEvidence(event.reviewRoute, report, method, true)) return false;
        }
        completion = event;
      } else if (event.type === 'started') {
        if (started || !completion || event.status !== '제출 준비' || !validDetails(event.details, event.status) || !text(event.reason, 1000)) return false;
        started = true; status = event.status; process = event;
      } else if (event.type === 'updated') {
        if (!started || !TRANSITIONS[status]?.includes(event.status) || !validDetails(event.details, event.status) || !text(event.reason, 1000)) return false;
        status = event.status; process = event;
      } else if (event.type === 'finished') {
        if (careBefore().cancelled || !started || status !== '승인·등록' || !process || !LCA.requests.validDate(event.finishedOn)
          || event.finishedOn < process.details.issuedOn || event.finishedOn < completion.completedOn
          || event.confirmed !== true || !text(event.reason, 1000) || event.reportRevision !== completion.report.revision
          || JSON.stringify(event.details) !== JSON.stringify(process.details)) return false;
        finished = true;
      } else return false;
    }
    return !!completion;
  }
  function createStore(projects, getProject, getReports, getVerification, getStorage = () => LCA.storage ? LCA.storage.get() : window.localStorage, getReviewRoute = null) {
    const failure = () => ({ ok: false, error: '인증·등록 기록을 읽지 못했어요. 보관 근거와 단계를 보호하기 위해 저장을 중단했어요.' });
    function read() {
      try {
        const raw = getStorage().getItem(STORAGE_KEY);
        if (raw === null) return { ok: true, records: {} };
        const data = JSON.parse(raw);
        if (!data || data.version !== 1 || !data.records || typeof data.records !== 'object' || Array.isArray(data.records)
          || Object.entries(data.records).some(([id, record]) => !projects.some((project) => project.id === id) || !validRecord(record, id))) return failure();
        return { ok: true, records: data.records };
      } catch { return failure(); }
    }
    // 범위 저장소에서 호출하므로 다른 저장소를 재조회하지 않는다.
    function currentStage(id) {
      const data = read();
      return data.ok ? { ok: true, stage: data.records[id]?.events.some((event) => event.type === 'finished') ? 10 : data.records[id]?.events.some((event) => event.type === 'started') ? 9 : null } : data;
    }
    function renewalSnapshot() {
      const data = read(); if (!data.ok) return data;
      return { ok: true, items: Object.entries(data.records).map(([projectId, record]) => {
        const process = record.events.filter((event) => ['started', 'updated', 'renewed'].includes(event.type)).at(-1);
        const care = aftercare(record, process);
        return process ? { projectId, status: process.status, details: clone(process.details), officialExpiryOn: care.validity?.expiryOn || '',
          inspectionPlan: clone(care.inspectionPlan), inspections: clone(care.inspections), renewalProgress: clone(care.renewalProgress),
          statusChecks: clone(care.statusChecks), cancelled: care.cancelled } : null;
      }).filter(Boolean) };
    }
    function load(id) {
      const data = read(); if (!data.ok) return data;
      const fallback = projects.find((project) => project.id === id); if (!fallback) return { ok: false, error: '프로젝트를 찾을 수 없어요.' };
      let scope; let reports; let verification; let route;
      try { scope = getProject(id); reports = getReports(id); verification = getVerification(id); route = getReviewRoute?.(id); } catch { /* 보관 사본은 계속 조회한다. */ }
      const record = clone(data.records[id] || { revision: 0, events: [] });
      const completion = record.events.filter((event) => event.type === 'completed').at(-1) || null;
      const process = record.events.filter((event) => ['started', 'updated', 'renewed'].includes(event.type)).at(-1) || null;
      const finished = record.events.find((event) => event.type === 'finished') || null;
      const care = aftercare(record, process);
      const project = scope?.ok ? scope.project : fallback;
      const method = getReviewRoute ? route?.method || 'undecided' : 'external';
      const warning = !scope?.ok ? scope?.error || '현재 프로젝트를 확인하지 못했어요.' : !reports?.ok ? reports?.error || '보고서를 확인하지 못했어요.'
        : !verification?.ok ? verification?.error || '검증 기록을 확인하지 못했어요.'
        : getReviewRoute && !route?.ok ? route?.error || '검토 방식을 확인하지 못했어요.' : route?.warning || verification.warning || '';
      const branchBlock = method === 'undecided' ? '검토 방식을 미정에서 내부 검토 또는 외부 검토로 정해 주세요.'
        : method === 'internal' ? route?.completionBlock || '' : verification?.startBlock || (!verification?.round ? '제3자 검증 차수를 먼저 기록해 주세요.' : '')
          || (verification?.issues.some((item) => item.status !== '종결') ? '미종결 검증 지적을 모두 처리해 주세요.' : '');
      const completeBlock = warning || branchBlock
        || (!reports?.record || !reports.ready || reports.stale || reports.currentError ? '현재 자료·계산·해석과 일치하는 최신 보고서를 저장해 주세요.' : '')
        || (verification?.round && reports?.record && verification.round.reportRevision > reports.record.revision ? '검증 보고서 연결을 확인해 주세요.' : '');
      const stale = !!completion && (!!completeBlock || (completion.reviewMethod || 'external') !== method || JSON.stringify(completion.report) !== JSON.stringify(reports?.record)
        || (method === 'external' && JSON.stringify(completion.verification) !== JSON.stringify(verification?.record))
        || (completion.reviewMethod !== undefined ? JSON.stringify(completion.reviewRoute) !== JSON.stringify(route?.record) : !!route?.record.events.length));
      const startBlock = completeBlock || (!completion ? '선택한 검토 경로의 완료 근거를 먼저 보관해 주세요.' : stale ? '완료 기록 이후 보고서·검토 방식·확인 기록이 바뀌었어요. 완료 근거를 다시 기록해 주세요.' : '');
      const finishBlock = startBlock || (care.cancelled ? '취소 확인된 인증은 유효 회복이나 새 인증서를 확인한 뒤 프로젝트를 완료해 주세요.' : '')
        || (!process || process.status !== '승인·등록' ? '진행 상태를 승인·등록으로 저장해 주세요. 고객 제출도 고객의 접수·최종 확인 번호와 확인일이 필요해요.' : '');
      return { ok: true, project, record, completion, process, finished, ...care, currentStatus: currentStatus(process, care), warning, completeBlock, startBlock, finishBlock, stale,
        latest: reports?.record || null, verification: verification?.record || null, reviewMethod: method, reviewRoute: route?.record || null,
        canComplete: project.stage === 8 && !process && !completeBlock,
        canStart: project.stage === 8 && !process && !startBlock, canWrite: project.stage === 9 && !!process && !finished && !warning,
        canFinish: project.stage === 9 && !finished && !finishBlock,
        canRecordValidity: project.stage >= 9 && process?.status === '승인·등록' && ['인증', '등록'].includes(process.details.kind) && !warning };
    }
    function mutate(id, action, draft, expectedRevision, expectedBasis) {
      const data = read(); if (!data.ok) return data;
      const state = load(id); if (!state.ok) return state;
      if (state.record.revision !== expectedRevision) return { ok: false, error: '다른 화면에서 인증·등록 기록이 바뀌었어요. 입력은 유지했으니 기준을 다시 확인해 주세요.' };
      if (!text(draft.actor, 100)) return { ok: false, error: '기록 담당자를 1~100자로 적어 주세요.' };
      if (!text(draft.reason, 1000)) return { ok: false, error: '확인 근거·변경 사유를 1~1,000자로 적어 주세요.' };
      const record = clone(state.record);
      const at = new Date(Math.max(Date.now(), ...record.events.map((event) => Date.parse(event.at)))).toISOString();
      const event = { type: action, actor: draft.actor.trim(), reason: draft.reason.trim(), at };
      if (action === 'status-check') {
        if (!state.canRecordValidity) return { ok: false, error: state.warning || '승인된 인증·등록의 상태만 확인 기록을 남길 수 있어요.' };
        if (!CHECK_STATUSES.includes(draft.status) || !LCA.requests.validDate(draft.checkedOn)
          || draft.checkedOn < state.process.details.issuedOn || draft.checkedOn > LCA.rules.today()
          || (state.statusChecks.length && draft.checkedOn < state.statusChecks.at(-1).checkedOn)
          || !text(draft.documentName, 200) || draft.confirmed !== true) return { ok: false, error: '상태·확인 문서와 직접 확인 체크를 확인해 주세요. 확인일은 발급일 및 직전 확인일 이후부터 오늘까지예요.' };
        if (draft.status === '유효' && (!state.validity || draft.checkedOn > state.validity.expiryOn)) return { ok: false, error: '유효 확인은 공식 만료일을 먼저 기록하고 그 만료일 이내의 확인일로 남겨 주세요.' };
        Object.assign(event, Object.fromEntries(['kind', 'organization', 'scheme', 'issuedOn', 'registrationNumber'].map((key) => [key, state.process.details[key]])),
          { status: draft.status, checkedOn: draft.checkedOn, documentName: draft.documentName.trim(), expiryOn: state.validity?.expiryOn || '', confirmed: true });
      } else if (['renewal-progress', 'renewed'].includes(action)) {
        if (!state.canRecordValidity) return { ok: false, error: state.warning || '승인된 인증·등록의 갱신만 기록할 수 있어요.' };
        if (state.cancelled && action === 'renewal-progress') return { ok: false, error: '취소된 인증은 유효 회복을 확인하거나 새 인증서의 갱신 완료를 기록해 주세요.' };
        if (!LCA.requests.validDate(draft.actionOn) || draft.actionOn < state.process.details.issuedOn || draft.actionOn > LCA.rules.today()
          || !text(draft.documentName, 200)) return { ok: false, error: '처리일은 기존 발급일 이후부터 오늘까지로 적고 확인 문서·기록 이름을 적어 주세요.' };
        Object.assign(event, Object.fromEntries(['kind', 'scheme', 'issuedOn', 'registrationNumber'].map((key) => [key, state.process.details[key]])),
          { actionOn: draft.actionOn, documentName: draft.documentName.trim() });
        if (action === 'renewal-progress') {
          if (!['갱신 준비', '갱신 요청'].includes(draft.status)) return { ok: false, error: '갱신 준비 또는 갱신 요청 상태를 선택해 주세요.' };
          event.status = draft.status;
        } else {
          const details = { ...clone(state.process.details), submittedOn: draft.submittedOn, issuedOn: draft.issuedOn,
            registrationNumber: typeof draft.registrationNumber === 'string' ? draft.registrationNumber.trim() : draft.registrationNumber, note: '' };
          if (!validDetails(details, '승인·등록') || details.issuedOn <= state.process.details.issuedOn || details.issuedOn > draft.actionOn
            || details.submittedOn < state.process.details.issuedOn || !LCA.requests.validDate(draft.expiryOn) || draft.expiryOn <= details.issuedOn
            || draft.confirmed !== true) return { ok: false, error: '새 인증서의 제출일·발급일·번호·만료일을 확인해 주세요. 새 발급일은 기존보다 늦고 처리일 이하여야 하며, 만료일은 새 발급일보다 늦어야 해요. 공식 발급 확인에도 체크해 주세요.' };
          Object.assign(event, { status: '승인·등록', details, expiryOn: draft.expiryOn, confirmed: true });
        }
      } else if (['inspection-plan', 'inspection'].includes(action)) {
        if (state.cancelled) return { ok: false, error: '취소된 인증은 유효 회복을 먼저 확인해 주세요. 이전 점검 이력은 유지돼요.' };
        if (!state.canRecordValidity || state.process.details.kind !== '등록' || state.process.details.scheme.trim() !== 'International EPD') return { ok: false, error: state.warning || '승인된 International EPD 등록의 연간 점검만 기록할 수 있어요.' };
        Object.assign(event, Object.fromEntries(['kind', 'scheme', 'issuedOn', 'registrationNumber'].map((key) => [key, state.process.details[key]])));
        if (action === 'inspection-plan') {
          if (!LCA.requests.validDate(draft.versionOn) || draft.versionOn > LCA.rules.today() || !text(draft.version, 80)
            || !text(draft.documentName, 200)) return { ok: false, error: 'EPD의 최신 버전·버전일·확인 문서 이름을 적어 주세요. 버전일은 오늘까지의 날짜여야 해요.' };
          Object.assign(event, { version: draft.version.trim(), versionOn: draft.versionOn, documentName: draft.documentName.trim() });
          const expiry = renewalSchedule(state.process.details, state.process.status, LCA.rules.today(), state.validity?.expiryOn);
          if (!expiry || draft.versionOn >= expiry.date) return { ok: false, error: '버전일은 만료일 이전이어야 해요. 발급 문서의 버전일과 만료일을 확인해 주세요.' };
        } else {
          const cycle = inspectionCycles(state.process.details, state.process.status, state.inspectionPlan, state.inspections, state.validity?.expiryOn).find((item) => item.date === draft.dueOn);
          if (!cycle || draft.version !== state.inspectionPlan.version || draft.versionOn !== state.inspectionPlan.versionOn
            || !['점검 중', '점검 완료'].includes(draft.status) || !LCA.requests.validDate(draft.checkedOn)
            || draft.checkedOn < cycle.startDate || draft.checkedOn > LCA.rules.today() || !text(draft.documentName, 200)
            || (draft.status === '점검 완료' && draft.confirmed !== true)) return { ok: false, error: '점검 대상일·점검일·확인 문서를 확인해 주세요. 예정일 30일 전부터 오늘까지의 점검을 기록하며 완료할 때는 결과 확인에 체크해 주세요.' };
          Object.assign(event, { dueOn: draft.dueOn, checkedOn: draft.checkedOn, documentName: draft.documentName.trim(), status: draft.status,
            confirmed: draft.confirmed === true, version: state.inspectionPlan.version, versionOn: state.inspectionPlan.versionOn });
        }
      } else if (action === 'validity') {
        if (!state.canRecordValidity) return { ok: false, error: state.warning || '승인된 인증·등록의 공식 만료일만 기록할 수 있어요.' };
        if (!LCA.requests.validDate(draft.expiryOn) || draft.expiryOn < state.process.details.issuedOn || !text(draft.documentName, 200)
          || draft.confirmed !== true) return { ok: false, error: '인증서의 만료일·확인 문서 이름을 적고 발급일 이후 날짜인지 확인해 주세요.' };
        Object.assign(event, { expiryOn: draft.expiryOn, documentName: draft.documentName.trim(), kind: state.process.details.kind, issuedOn: state.process.details.issuedOn,
          scheme: state.process.details.scheme, registrationNumber: state.process.details.registrationNumber });
      } else if (action === 'completed') {
        if (!state.canComplete) return { ok: false, error: state.completeBlock || '검토·검증(8) 단계에서 완료 근거를 보관할 수 있어요.' };
        if (!expectedBasis || expectedBasis.reportRevision !== state.latest.revision || expectedBasis.sourceKey !== state.latest.sourceKey
          || expectedBasis.verificationRevision !== state.verification.revision
          || (getReviewRoute && (expectedBasis.reviewMethod !== state.reviewMethod || expectedBasis.reviewRevision !== state.reviewRoute.revision))) return { ok: false, error: '보고서·검토 방식·검증 기준이 바뀌었어요. 입력을 유지했으니 기준을 다시 확인해 주세요.' };
        if (!LCA.requests.validDate(draft.completedOn) || !text(draft.documentName, 200) || draft.confirmed !== true) return { ok: false, error: '검토 완료일·확인 기록이나 문서 이름을 적고 최종 보고서와 선택한 경로의 완료 근거를 확인해 주세요.' };
        Object.assign(event, { completedOn: draft.completedOn, documentName: draft.documentName.trim(), report: clone(state.latest), verification: state.reviewMethod === 'internal' ? null : clone(state.verification) });
        if (getReviewRoute) Object.assign(event, { reviewMethod: state.reviewMethod, reviewRoute: clone(state.reviewRoute) });
      } else if (action === 'finished') {
        if (!state.canFinish) return { ok: false, error: state.finishBlock || '인증·등록(9) 단계에서 최종 확인 후 완료할 수 있어요.' };
        if (!LCA.requests.validDate(draft.finishedOn) || draft.finishedOn > LCA.rules.today()
          || draft.finishedOn < state.process.details.issuedOn || draft.finishedOn < state.completion.completedOn || draft.confirmed !== true) return { ok: false, error: '완료일은 검토 완료일·발급 또는 고객 확인일 이후이며 오늘까지의 날짜여야 해요. 최종 기록 확인에도 체크해 주세요.' };
        Object.assign(event, { finishedOn: draft.finishedOn, confirmed: true, reportRevision: state.completion.report.revision, details: clone(state.process.details) });
      } else {
        if (action === 'started') {
          if (!state.canStart || draft.confirmed !== true) return { ok: false, error: state.startBlock || '8단계에서 완료 근거를 확인하고 단계 이동에 체크해 주세요.' };
          event.status = '제출 준비';
        } else if (action === 'updated') {
          if (!state.canWrite || !TRANSITIONS[state.process.status]?.includes(draft.status)) return { ok: false, error: state.warning || '현재 상태에서 가능한 다음 상태를 선택해 주세요.' };
          event.status = draft.status;
        } else return { ok: false, error: '저장 동작을 확인해 주세요.' };
        event.details = Object.fromEntries(FIELDS.map((key) => [key, typeof draft[key] === 'string' ? draft[key].trim() : draft[key]]));
        if (!validDetails(event.details, event.status)) return { ok: false, error: '유형·제출기관·제도/요구명은 필수예요. 제출 후에는 제출일, 승인·등록에는 번호(고객 제출은 접수·확인 번호)와 발급·확인일이 필요해요. 날짜 순서와 글자 수를 확인해 주세요.' };
      }
      record.events.push(event); record.revision++;
      if (!validRecord(record, id)) return failure();
      try { getStorage().setItem(STORAGE_KEY, JSON.stringify({ version: 1, records: { ...data.records, [id]: record } })); }
      catch { return { ok: false, error: '브라우저에 저장하지 못했어요. 기존 근거·단계와 입력은 유지했으니 저장 공간을 확인해 주세요.' }; }
      if (action === 'started') state.project.stage = 9;
      if (action === 'finished') state.project.stage = 10;
      return { ok: true, record: clone(record) };
    }
    async function save(...args) {
      try {
        if (typeof navigator !== 'undefined' && navigator.locks?.request) return await navigator.locks.request('ecoable-lca-manager.review-workflow-write', () => mutate(...args));
        return mutate(...args);
      } catch { return { ok: false, error: '인증·등록 저장을 시작하지 못했어요. 입력과 기존 기록은 유지했어요.' }; }
    }
    return { load, currentStage, renewalSnapshot, save };
  }
  return { STORAGE_KEY, STATUSES, CHECK_STATUSES, TRANSITIONS, EXPIRY_SCHEMES, expectedExpiry, renewalSchedule, inspectionCycles, inspectionSchedule, currentStatus, validRecord, createStore };
})();
