window.LCA = window.LCA || {};
LCA.views = LCA.views || {};
LCA.views.reportHistory = (() => {
  function text(tag, className, value) {
    const node = document.createElement(tag); node.className = className; node.textContent = value; return node;
  }
  const date = (value) => new Intl.DateTimeFormat('ko-KR', {dateStyle:'medium', timeStyle:'short', timeZone:'Asia/Seoul'}).format(new Date(value));
  function create(onChange) {
    let selectedValue = 'latest';
    let peerValue = '';
    const element = text('div', 'report-history', '');
    element.append(text('h3', '', '버전별 보관·변경 이력'), text('p', 'detail-help', '보관한 버전을 선택하면 당시 보고서와 변경 이유를 볼 수 있어요. 새 버전 작성칸은 최신 기록을 기준으로 유지돼요.'));
    const list = text('div', 'report-version-list', '');
    const choices = text('div', 'report-version-selectors', '');
    function selector(id, label) {
      const box = document.createElement('div'); const caption = text('label', '', label);
      const select = document.createElement('select'); select.id = id; caption.htmlFor = id; box.append(caption, select); choices.append(box); return select;
    }
    const selected = selector('report-version', '보관 버전');
    const peer = selector('report-compare-version', '비교 기준 버전');
    const metadata = text('div', 'report-change-summary', '');
    const comparison = document.createElement('details');
    const comparisonTitle = text('summary', '', '버전 내용 비교');
    const differences = text('div', 'report-differences', ''); comparison.append(comparisonTitle, differences);
    const archiveLabel = text('label', 'calculation-confirmation', '');
    const archive = document.createElement('input'); archive.type = 'checkbox';
    archiveLabel.append(archive, document.createTextNode('선택한 보고서가 최신 보고서가 아닌 과거 보관본임을 확인했어요.'));
    archiveLabel.hidden = true;
    element.append(list, choices, metadata, comparison, archiveLabel);
    selected.addEventListener('change', () => { selectedValue = selected.value; peerValue = ''; archive.checked = false; onChange(); });
    peer.addEventListener('change', () => { peerValue = peer.value; onChange(); });
    archive.addEventListener('change', onChange);
    function current(state) {
      if (selectedValue === 'latest') return state.record;
      return state.versions.find((record) => record.revision === Number(selectedValue)) || state.record;
    }
    function render(state, busy = false) {
      const versions = state.versions || [];
      if (selectedValue !== 'latest' && !versions.some((record) => String(record.revision) === selectedValue)) { selectedValue = 'latest'; archive.checked = false; }
      const record = current(state);
      list.replaceChildren();
      if (versions.length) {
        const ul = document.createElement('ul');
        for (const item of versions) ul.append(text('li', '', `v${item.revision}${item.revision === state.record.revision ? ' · 최신' : ''} · ${date(item.updatedAt)} · ${item.change?.author || '작성자 미기록'}\n${item.change?.summary || '이전 앱에서 가져온 저장본 · 변경 설명 미기록'}`));
        list.append(ul);
      } else list.append(text('p', 'detail-help', '아직 보관한 버전이 없어요.'));
      selected.replaceChildren(); peer.replaceChildren();
      for (const item of versions) {
        const option = document.createElement('option'); option.value = item.revision === state.record.revision ? 'latest' : String(item.revision);
        option.textContent = `v${item.revision}${item.revision === state.record.revision ? ' (최신)' : ''} · ${date(item.updatedAt)}`; selected.append(option);
        const compareOption = document.createElement('option'); compareOption.value = String(item.revision); compareOption.textContent = `v${item.revision} · ${date(item.updatedAt)}`; peer.append(compareOption);
      }
      selected.value = selectedValue; selected.disabled = busy || !versions.length;
      const defaultPeer = versions.find((item) => item.revision !== record?.revision);
      if (!versions.some((item) => String(item.revision) === peerValue)) peerValue = defaultPeer ? String(defaultPeer.revision) : '';
      peer.value = peerValue; peer.disabled = busy || versions.length < 2;
      peer.parentElement.hidden = versions.length < 2;
      const previous = versions.find((item) => String(item.revision) === peerValue);
      metadata.replaceChildren(); differences.replaceChildren();
      if (record?.change) {
        metadata.append(text('h4', '', `v${record.revision} 변경 기록`));
        for (const [field, rule] of Object.entries(LCA.reportHistory.FIELDS)) if (record.change[field]) metadata.append(text('h5', '', rule.label), text('p', 'interpretation-text', record.change[field]));
      } else if (record) metadata.append(text('p', 'detail-help', '이전 앱의 저장본이에요. 당시 변경 설명과 작성자는 기록되어 있지 않아요. 이력 도입 전에 덮어쓴 버전은 복구할 수 없어요.'));
      comparison.hidden = versions.length < 2;
      if (previous && record) {
        const changes = LCA.reportHistory.compare(previous, record);
        comparisonTitle.textContent = `v${previous.revision} → v${record.revision} 본문 내용 비교 · ${changes.length}개 항목 변경`;
        if (!changes.length) differences.append(text('p', 'detail-help', '본문에 표시되는 내용이 같아요. 변경 사유·작성자 등은 위 변경 기록에서 확인해 주세요.'));
        for (const change of changes) {
          const box = text('section', 'report-difference', ''); box.append(text('h4', '', change.label));
          const columns = text('div', 'report-difference-columns', '');
          for (const [label, value] of [[`비교 기준 v${previous.revision}`, change.before], [`선택한 버전 v${record.revision}`, change.after]]) {
            const column = document.createElement('div'); column.append(text('h5', '', label), text('p', 'interpretation-text', value || '(내용 없음)')); columns.append(column);
          }
          box.append(columns); differences.append(box);
        }
      }
      archiveLabel.hidden = !record || record.revision === state.record?.revision;
      archive.disabled = busy;
    }
    return { element, render, current, archiveConfirmed: () => archive.checked, revision: (state) => current(state)?.revision };
  }
  function changeFields(project) {
    const element = text('div', 'report-change-fields', '');
    element.append(text('h3', '', '이번 버전의 변경 기록'), text('p', 'detail-help', '처음 작성할 때도 작성 목적과 내용을 남겨 주세요. 새 버전을 저장하면 이전 버전은 그대로 보관돼요. 작성자 이름은 직접 확인해 적어 주세요.'));
    const controls = {};
    const examples = {
      summary: '예: 운송 거리 수정과 계산 결과 반영',
      reason: '예: 고객이 실제 운송 거리 자료를 다시 전달함',
      before: '예: 운송 거리 100km (첫 버전은 비워둘 수 있어요)',
      after: '예: 운송 거리 120km를 적용한 계산 결과와 해석을 반영함',
      author: '작성자 이름',
      reviewRef: '예: 1차 고객 검토 의견 3번'
    };
    for (const [field, rule] of Object.entries(LCA.reportHistory.FIELDS)) {
      const box = text('div', 'interpretation-field', '');
      const suffix = field === 'before' ? '첫 버전은 선택' : rule.optional ? '선택' : '필수';
      const label = text('label', '', `${rule.label} (${suffix})`);
      const input = document.createElement(['author', 'reviewRef'].includes(field) ? 'input' : 'textarea');
      if (input.tagName === 'INPUT') input.type = 'text'; else input.rows = 2;
      input.id = `report-change-${field}`; label.htmlFor = input.id; input.maxLength = rule.limit; input.placeholder = examples[field];
      box.append(label, input); element.append(box); controls[field] = input;
    }
    function reset(initial = false) {
      for (const input of Object.values(controls)) input.value = '';
      controls.author.value = project.researcherName || '';
      if (initial) controls.summary.value = '최초 초안 작성';
    }
    return { element, controls, reset, draft: () => Object.fromEntries(Object.entries(controls).map(([field, input]) => [field, input.value])) };
  }
  return { create, changeFields };
})();
