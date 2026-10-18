window.LCA = window.LCA || {};
LCA.views = LCA.views || {};
LCA.views.inputAssist = (() => {
  const controllers = new WeakMap();
  function node(tag, className, text) {
    const element = document.createElement(tag); element.className = className;
    if (text) element.textContent = text;
    return element;
  }
  function changed(input) {
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function person(input, project, { compact = true, label = '기록 담당자' } = {}) {
    const box = input.parentElement;
    const wrapper = node(compact ? 'details' : 'div', 'input-assist-person');
    wrapper.dataset.inputAssist = '';
    let summary;
    if (compact) { summary = node('summary', '', ''); wrapper.append(summary); }
    box.replaceWith(wrapper); wrapper.append(box);
    const help = node('p', 'detail-help', ''); help.id = `${input.id}-assist-help`;
    input.setAttribute('aria-describedby', [input.getAttribute('aria-describedby'), help.id].filter(Boolean).join(' '));
    const choices = node('select', 'input-assist-people', '');
    choices.setAttribute('aria-label', `${label} · 등록 연구원에서 선택`);
    const placeholder = node('option', '', '등록 연구원에서 선택'); placeholder.value = ''; choices.append(placeholder);
    const people = LCA.researchers.createStore().list();
    if (people.ok) for (const person of people.items) {
      const option = node('option', '', `${person.name} · ${person.code}`); option.value = person.id; choices.append(option);
    }
    choices.hidden = !people.ok;
    choices.addEventListener('change', () => {
      const person = people.ok && people.items.find((item) => item.id === choices.value);
      if (person && !input.matches(':disabled')) { input.value = person.name; changed(input); }
      choices.value = '';
    });
    box.append(choices, help);
    function sync() {
      const value = input.value.trim();
      if (summary) summary.textContent = `${label}: ${value || '이름을 입력해 주세요'} · 변경`;
      help.textContent = compact
        ? value && value === project.researcherName ? '프로젝트 담당자 기준 · 실제 기록한 사람이 다르면 변경해 주세요.'
          : '입력했거나 기존 기록에서 불러온 이름이에요. 실제 기록한 사람인지 확인해 주세요.'
        : '실제 검토한 사람을 선택하거나 직접 입력해 주세요. 기록 담당자와 다를 수 있어요.';
      if (!people.ok) help.textContent += ' 연구원 목록을 읽지 못했어요. 이름은 직접 입력할 수 있어요.';
      choices.disabled = input.matches(':disabled');
    }
    controllers.set(wrapper, sync);
    input.addEventListener('input', sync); input.addEventListener('change', sync);
    input.addEventListener('focus', () => { if (compact) wrapper.open = true; });
    if (compact) wrapper.open = !input.value.trim();
    sync(); return { sync };
  }
  function date(input) {
    const box = input.parentElement; const row = node('div', 'input-assist-date', '');
    row.dataset.inputAssist = '';
    const today = node('button', 'request-action-button', '오늘'); today.type = 'button';
    const label = box.querySelector('label')?.textContent || '날짜';
    today.setAttribute('aria-label', `${label} · 오늘로 입력`);
    const calendar = document.createElement('input'); calendar.type = 'date';
    calendar.min = '0001-01-01'; calendar.max = '9999-12-31';
    calendar.setAttribute('aria-label', `${label} · 달력에서 선택`);
    row.append(today, calendar); box.append(row);
    const help = node('p', 'detail-help', '실제 업무 날짜를 선택해 주세요. 저장 시각은 별도로 자동 기록돼요.');
    help.id = `${input.id}-date-help`; box.append(help);
    input.setAttribute('aria-describedby', [input.getAttribute('aria-describedby'), help.id].filter(Boolean).join(' '));
    function set(value) { if (!input.matches(':disabled')) { input.value = value; changed(input); } }
    today.addEventListener('click', () => {
      const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
      const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
      set(`${values.year}-${values.month}-${values.day}`);
    });
    calendar.addEventListener('change', () => set(calendar.value));
    function sync() {
      const currentLabel = box.querySelector('label')?.textContent || '날짜';
      today.setAttribute('aria-label', `${currentLabel} · 오늘로 입력`);
      calendar.setAttribute('aria-label', `${currentLabel} · 달력에서 선택`);
      calendar.value = /^\d{4}-\d{2}-\d{2}$/.test(input.value) ? input.value : '';
      today.disabled = calendar.disabled = input.matches(':disabled');
    }
    controllers.set(row, sync); input.addEventListener('input', sync); input.addEventListener('change', sync); sync();
    return { sync };
  }
  function sync(root) { for (const element of root.querySelectorAll('[data-input-assist]')) controllers.get(element)?.(); }
  document.addEventListener('submit', (event) => {
    for (const wrapper of event.target.querySelectorAll('details.input-assist-person')) {
      const input = wrapper.querySelector('input');
      if (input && !input.value.trim() && !input.matches(':disabled')) { wrapper.open = true; input.focus(); break; }
    }
  }, true);
  return { person, date, sync };
})();
