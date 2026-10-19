/* 저장된 정보로 요청문을 만든다. 저장·발송·자료 상태 변경은 하지 않는다. */
window.LCA = window.LCA || {};
LCA.requestMessage = (() => {
  const TYPES = { initial: '처음 요청', reminder: '미제출 재요청', upcoming: '마감 임박 안내', revision: '보완 요청', info: '정보 확인' };
  const clean = (value) => typeof value === 'string' ? value.trim() : '';
  const line = (value) => clean(value).replace(/[\r\n]+/g, ' ');
  const category = (item) => LCA.constants.CATEGORIES.find((c) => c.key === item.categoryKey)?.name;
  function infoTargets(project) {
    const items = []; const add = (id, name, detail) => items.push({ id, projectId: project.id, name, detail });
    if (!project.customerContactName?.trim()) add('customerContactName', '고객 자료 담당자', '자료 준비와 일정 협의를 담당하실 분의 성함·부서·연락처를 알려 주세요.');
    if (!LCA.requests.validDate(project.targetDate)) add('targetDate', '희망 완료 일정', '결과가 필요한 희망 날짜와 그 일정의 배경을 알려 주세요.');
    if (!project.productName?.trim()) add('productName', '평가 대상 제품', '평가할 제품의 정확한 이름·모델과 대상 사업장을 알려 주세요.');
    if (!project.uses?.length) add('uses', '결과 활용처', '결과를 제출할 거래처·인증 제도 또는 내부 활용 목적과 받은 요구 문서가 있다면 공유해 주세요.');
    if (!(Number.isFinite(Number(project.functionalUnit?.qty)) && Number(project.functionalUnit.qty) > 0 && project.functionalUnit.unit?.trim())) add('functionalUnit', '평가 기준량·단위', '거래처나 적용 제도가 요구하는 제품 기준량·단위가 있다면 알려 주세요. 함께 적절한 기준을 협의하겠습니다.');
    if (!project.boundary?.trim()) add('boundary', '평가할 범위', '제조까지 또는 사용·폐기까지 등 거래처나 인증 제도에서 요청한 범위가 있다면 공유해 주세요. 적용 기준을 확인해 함께 협의하겠습니다.');
    else if (project.scopeStatus !== '확정' && project.stage <= 2) add('scopeAgreement', '협의 중인 평가 범위', `현재 기록한 범위안은 ‘${line(project.boundary)}’입니다. 요청하신 목적에 맞는지 의견과 추가 요구를 확인 부탁드립니다.`);
    if (!LCA.requests.validDate(project.refStart) || !LCA.requests.validDate(project.refEnd) || project.refStart > project.refEnd) add('period', '자료 기준기간', '생산량·투입량 등 자료를 제공할 수 있는 기간과 최근 자료의 확보 여부를 알려 주세요.');
    if (!project.standards?.length) add('standards', '요구받은 평가 기준', '거래처나 인증기관에서 지정한 평가 기준·작성지침·양식이 있다면 공유해 주세요. 적용 기준은 확인 후 협의하겠습니다.');
    return items;
  }
  function candidates(state, type) {
    if (!Object.hasOwn(TYPES, type)) return { ok: false, error: '요청문 종류를 선택해 주세요.' };
    if (!state?.ok || !state.project || !Array.isArray(state.items)) return { ok: false, error: state?.error || '최신 프로젝트·자료 기록을 읽지 못했어요.' };
    if (state.items.some((item) => !item || typeof item.id !== 'string' || typeof item.projectId !== 'string')) return { ok: false, error: '자료 기록의 형식을 확인하지 못했어요.' };
    if (!Number.isInteger(state.project.stage) || state.project.stage < 1 || state.project.stage >= 9 || state.canGenerate === false) return { ok: false, error: state.reason || '요청문은 인증·등록 준비 전(1~8단계)에 만들 수 있어요.' };
    if (type === 'info') return { ok: true, items: infoTargets(state.project) };
    const today = type === 'upcoming' ? LCA.rules.today() : null;
    const items = state.items.filter((item) => {
      if (item.projectId !== state.project.id || item.deletedAt) return false;
      if (type === 'revision') return item.status === '보완 요청';
      if (item.status !== '요청' || item.receipt) return false;
      if (type !== 'upcoming') return true;
      const days = LCA.deadlines.refresh({ date: item.dueDate, status: item.status }, today).days;
      return days !== null && days >= 0 && days <= 3;
    });
    if (new Set(items.map((item) => item.id)).size !== items.length) return { ok: false, error: '자료 번호가 중복되어 요청문을 만들 수 없어요.' };
    return { ok: true, items: items.slice().sort((a, b) => a.id.localeCompare(b.id)) };
  }
  function build(state, type, ids) {
    const available = candidates(state, type); if (!available.ok) return available;
    if (!Array.isArray(ids) || !ids.length || new Set(ids).size !== ids.length) return { ok: false, error: `요청문에 넣을 ${type === 'info' ? '정보' : '자료'}를 한 건 이상 선택해 주세요.` };
    const chosen = new Set(ids); const items = available.items.filter((item) => chosen.has(item.id));
    if (items.length !== ids.length) return { ok: false, error: type === 'info' ? '선택한 정보가 채워졌거나 협의 상태가 바뀌었어요. 최신 정보를 확인해 주세요.' : '선택한 자료의 제출 여부·상태·기한이 바뀌었거나 삭제되었어요. 최신 자료를 확인해 주세요.' };
    if (type === 'info') return buildInfo(state, items);
    const missing = new Set();
    function value(raw, label, singleLine = true) {
      const result = singleLine ? line(raw) : clean(raw);
      if (result) return result;
      missing.add(label); return `[입력 필요: ${label}]`;
    }
    function date(raw, label) { if (LCA.requests.validDate(raw)) return raw.replaceAll('-', '.'); missing.add(label); return `[입력 필요: ${label}]`; }
    const p = state.project;
    const sender = state.sender?.id === p.researcherId ? state.sender : null;
    const company = value(p.companyName, '회사명'); const product = value(p.productName, '제품명');
    const contact = value(p.customerContactName, '고객 담당자'); const researcher = value(sender?.name || p.researcherName, '담당 연구원');
    const senderCompany = value(sender?.company, '연구원 회사'); const senderDepartment = value(sender?.department, '연구원 부서');
    const period = LCA.requests.validDate(p.refStart) && LCA.requests.validDate(p.refEnd) && p.refStart <= p.refEnd
      ? `${p.refStart.replaceAll('-', '.')}~${p.refEnd.replaceAll('-', '.')}` : value('', '자료 기준기간');
    const rows = items.map((item) => ({ id: item.id, name: value(category(item), '자료 구분'), detail: value(item.detail, `${item.id} 요청 내용`, false),
      due: date(item.dueDate, `${item.id} 제출 기한`), revision: type === 'revision' ? value(item.review?.note, `${item.id} 보완 사유`, false) : '' }));
    const commonDue = new Set(rows.map((item) => item.due)).size === 1;
    const prefix = { initial: 'LCA 자료 요청', reminder: '자료 제출 확인 요청', upcoming: '자료 제출 기한 안내', revision: '자료 보완 요청' }[type];
    const title = `[${prefix}] ${company} ${product} 평가`;
    const body = [`안녕하세요, ${contact} 담당자님.`, `${senderCompany} ${senderDepartment} ${researcher}입니다.`, '',
      type === 'initial' ? `${product} LCA 평가를 위해 아래 자료를 요청드립니다.` : type === 'reminder'
        ? '앞서 요청드린 자료 중 아직 제출 확인이 되지 않은 항목을 안내드립니다.' : type === 'upcoming'
          ? '제출 기한이 가까워진 아래 자료의 준비 일정을 확인 부탁드립니다.' : '보내주신 자료를 검토한 결과, 아래 사항의 보완을 부탁드립니다.',
      '', `대상 회사: ${company}`, `평가 대상 제품: ${product}`, `자료 기준기간: ${period}`, '', type === 'revision' ? '보완 대상 자료' : '요청 자료'];
    for (const [index, item] of rows.entries()) {
      body.push(`${index + 1}. ${item.name} (${item.id})`, `   요청 내용: ${item.detail}`);
      if (type === 'revision') body.push(`   보완 내용: ${item.revision}`, `   기존 제출 기한: ${item.due} (보완 기한은 별도 협의)`);
      else if (!commonDue) body.push(`   제출 기한: ${item.due}`);
      body.push('');
    }
    if (type !== 'revision' && commonDue) body.push(`제출 기한: ${rows[0].due}`, '');
    body.push(type === 'initial' ? '자료 준비가 어렵거나 기한 조정이 필요하면 말씀 부탁드립니다.' : type === 'reminder'
      ? '제출 여부와 준비 일정을 확인 부탁드립니다. 이미 보내주셨다면 전달 경로를 알려주시면 확인하겠습니다.' : type === 'upcoming'
        ? '안내드린 기한까지 전달 부탁드립니다. 준비가 어렵거나 기한 조정이 필요하면 말씀해 주세요. 이미 보내주셨다면 전달 경로를 알려주시면 확인하겠습니다.' : '확인 후 보완 자료를 전달 부탁드립니다. 보완 자료 제출 일정은 별도 협의 부탁드립니다.',
      '', '감사합니다.', `담당 연구원 ${researcher}`);
    const fingerprint = JSON.stringify({ type, project: [p.id, p.stage, p.companyName, p.productName, p.customerContactName, p.researcherId, p.researcherName, p.refStart, p.refEnd].map((v) => v ?? null),
      sender: [sender?.id, sender?.name, sender?.company, sender?.department].map((v) => v ?? null),
      items: items.map((item) => [item.id, item.categoryKey, item.status, item.detail, item.dueDate, type === 'revision' ? item.review?.note ?? null : null]) });
    return { ok: true, title, body: body.join('\n'), fingerprint, ids: items.map((item) => item.id), warnings: [...missing].map((label) => `${label} 입력이 필요해요.`) };
  }
  function buildInfo(state, items) {
    const p = state.project; const sender = state.sender?.id === p.researcherId ? state.sender : null; const warnings = [];
    function senderValue(value, label) { if (clean(value)) return line(value); warnings.push(`${label} 입력이 필요해요.`); return `[입력 필요: ${label}]`; }
    const company = line(p.companyName) || '고객사'; const product = line(p.productName) || '평가 대상 제품 확인 중';
    const name = senderValue(sender?.name || p.researcherName, '담당 연구원');
    const companyName = senderValue(sender?.company, '연구원 회사'); const department = senderValue(sender?.department, '연구원 부서');
    const title = `[프로젝트 정보 확인] ${company} 평가 준비`;
    const body = [`안녕하세요, ${line(p.customerContactName) || `${company} 담당자`}님.`, `${companyName} ${department} ${name}입니다.`, '',
      `${product}의 평가 준비를 위해 아래 정보를 확인 부탁드립니다.`, '범위와 적용 기준은 보내주신 요구 내용을 검토한 뒤 함께 협의하겠습니다.', '',
      ...items.flatMap((item, index) => [`${index + 1}. ${item.name}`, `   ${item.detail}`, '']),
      '아직 정해지지 않았거나 확인이 어려운 항목은 현재 상황을 알려 주시면 협의하겠습니다.', '', '감사합니다.', `담당 연구원 ${name}`].join('\n');
    const fingerprint = JSON.stringify({ type: 'info', project: Object.fromEntries(['id', 'stage', 'companyName', 'productName', 'customerContactName', 'researcherId', 'researcherName', 'targetDate', 'uses', 'functionalUnit', 'boundary', 'scopeStatus', 'refStart', 'refEnd', 'standards'].map((key) => [key, p[key] ?? null])),
      sender: [sender?.id, sender?.name, sender?.company, sender?.department].map((value) => value ?? null), items });
    return { ok: true, title, body, fingerprint, ids: items.map((item) => item.id), warnings };
  }
  function check(state, type, ids, fingerprint) {
    const current = build(state, type, ids);
    return !current.ok ? current : current.fingerprint !== fingerprint ? { ok: false, error: '요청문을 만든 뒤 프로젝트·자료·연구원 정보가 바뀌었어요. 수정한 글은 유지했으니 최신 기록을 확인하고 다시 만들어 주세요.' } : { ok: true };
  }
  async function copy(content, clipboard) {
    try {
      const target = clipboard === undefined ? (typeof navigator === 'undefined' ? null : navigator.clipboard) : clipboard;
      if (!target?.writeText) return { ok: false, error: '이 브라우저에서는 자동 복사를 사용할 수 없어요.' };
      await target.writeText(content); return { ok: true };
    }
    catch { return { ok: false, error: '브라우저가 자동 복사를 허용하지 않았어요.' }; }
  }
  function typeForTask(task) {
    if (!task || task.readOnly || !Number.isInteger(task.stage) || task.stage < 1 || task.stage >= 9) return null;
    if (task.kind === 'info' && task.infoKeys?.length) return 'info';
    if (!task.requestId) return null;
    return { overdue: 'reminder', soon: 'upcoming', revision: 'revision' }[task.kind] || null;
  }
  return { TYPES, infoTargets, candidates, build, check, copy, typeForTask };
})();
