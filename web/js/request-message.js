/* 저장된 정보로 요청문을 만든다. 저장·발송·자료 상태 변경은 하지 않는다. */
window.LCA = window.LCA || {};
LCA.requestMessage = (() => {
  const TYPES = { initial: '처음 요청', reminder: '미제출 재요청', revision: '보완 요청' };
  const clean = (value) => typeof value === 'string' ? value.trim() : '';
  const line = (value) => clean(value).replace(/[\r\n]+/g, ' ');
  const category = (item) => LCA.constants.CATEGORIES.find((c) => c.key === item.categoryKey)?.name;
  function candidates(state, type) {
    if (!Object.hasOwn(TYPES, type)) return { ok: false, error: '요청문 종류를 선택해 주세요.' };
    if (!state?.ok || !state.project || !Array.isArray(state.items)) return { ok: false, error: state?.error || '최신 프로젝트·자료 기록을 읽지 못했어요.' };
    if (state.items.some((item) => !item || typeof item.id !== 'string' || typeof item.projectId !== 'string')) return { ok: false, error: '자료 기록의 형식을 확인하지 못했어요.' };
    if (!Number.isInteger(state.project.stage) || state.project.stage < 1 || state.project.stage >= 9 || state.canGenerate === false) return { ok: false, error: state.reason || '요청문은 인증·등록 준비 전(1~8단계)에 만들 수 있어요.' };
    const items = state.items.filter((item) => item.projectId === state.project.id && !item.deletedAt
      && (type === 'revision' ? item.status === '보완 요청' : item.status === '요청' && !item.receipt));
    if (new Set(items.map((item) => item.id)).size !== items.length) return { ok: false, error: '자료 번호가 중복되어 요청문을 만들 수 없어요.' };
    return { ok: true, items: items.slice().sort((a, b) => a.id.localeCompare(b.id)) };
  }
  function build(state, type, ids) {
    const available = candidates(state, type); if (!available.ok) return available;
    if (!Array.isArray(ids) || !ids.length || new Set(ids).size !== ids.length) return { ok: false, error: '요청문에 넣을 자료를 한 건 이상 선택해 주세요.' };
    const chosen = new Set(ids); const items = available.items.filter((item) => chosen.has(item.id));
    if (items.length !== ids.length) return { ok: false, error: '선택한 자료가 제출·삭제되었거나 상태가 바뀌었어요. 최신 자료를 확인해 주세요.' };
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
    const prefix = { initial: 'LCA 자료 요청', reminder: '자료 제출 확인 요청', revision: '자료 보완 요청' }[type];
    const title = `[${prefix}] ${company} ${product} 평가`;
    const body = [`안녕하세요, ${contact} 담당자님.`, `${senderCompany} ${senderDepartment} ${researcher}입니다.`, '',
      type === 'initial' ? `${product} LCA 평가를 위해 아래 자료를 요청드립니다.` : type === 'reminder'
        ? '앞서 요청드린 자료 중 아직 제출 확인이 되지 않은 항목을 안내드립니다.' : '보내주신 자료를 검토한 결과, 아래 사항의 보완을 부탁드립니다.',
      '', `대상 회사: ${company}`, `평가 대상 제품: ${product}`, `자료 기준기간: ${period}`, '', type === 'revision' ? '보완 대상 자료' : '요청 자료'];
    for (const [index, item] of rows.entries()) {
      body.push(`${index + 1}. ${item.name} (${item.id})`, `   요청 내용: ${item.detail}`);
      if (type === 'revision') body.push(`   보완 내용: ${item.revision}`, `   기존 제출 기한: ${item.due} (보완 기한은 별도 협의)`);
      else if (!commonDue) body.push(`   제출 기한: ${item.due}`);
      body.push('');
    }
    if (type !== 'revision' && commonDue) body.push(`제출 기한: ${rows[0].due}`, '');
    body.push(type === 'initial' ? '자료 준비가 어렵거나 기한 조정이 필요하면 말씀 부탁드립니다.' : type === 'reminder'
      ? '제출 여부와 준비 일정을 확인 부탁드립니다. 이미 보내주셨다면 전달 경로를 알려주시면 확인하겠습니다.' : '확인 후 보완 자료를 전달 부탁드립니다. 보완 자료 제출 일정은 별도 협의 부탁드립니다.',
      '', '감사합니다.', `담당 연구원 ${researcher}`);
    const fingerprint = JSON.stringify({ type, project: [p.id, p.stage, p.companyName, p.productName, p.customerContactName, p.researcherId, p.researcherName, p.refStart, p.refEnd].map((v) => v ?? null),
      sender: [sender?.id, sender?.name, sender?.company, sender?.department].map((v) => v ?? null),
      items: items.map((item) => [item.id, item.categoryKey, item.status, item.detail, item.dueDate, type === 'revision' ? item.review?.note ?? null : null]) });
    return { ok: true, title, body: body.join('\n'), fingerprint, ids: items.map((item) => item.id), warnings: [...missing].map((label) => `${label} 입력이 필요해요.`) };
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
  return { TYPES, candidates, build, check, copy };
})();
