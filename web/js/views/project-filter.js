window.LCA = window.LCA || {};
LCA.views = LCA.views || {};
LCA.views.projectFilter = (() => {
  function init(projects, onChanged) {
    const query = document.querySelector('#project-search');
    const researcher = document.querySelector('#project-researcher-filter');
    const purpose = document.querySelector('#project-purpose-filter');
    const clear = document.querySelector('#project-filter-clear');
    const state = { query: '', researcher: '', purpose: '' };
    const option = (value, label) => {
      const node = document.createElement('option'); node.value = value; node.textContent = label; return node;
    };
    purpose.append(...LCA.projects.PURPOSES.map((value) => option(value, value)));
    function refreshOptions() {
      const selected = researcher.value;
      const previousLabel = researcher.selectedOptions[0]?.textContent;
      const values = [['', '담당 연구원 전체'], ['unassigned', '담당 연구원 미정'], ['legacy', '기존 이름 기록']];
      values.push(...LCA.projectFilter.researcherOptions(projects).map((person) => [person.id, person.label]));
      if (selected && !values.some(([value]) => value === selected)) values.push([selected, previousLabel || '이전 선택 연구원']);
      researcher.replaceChildren(...values.map(([value, label]) => option(value, label)));
      researcher.value = selected;
    }
    function changed() {
      state.query = query.value;
      state.researcher = researcher.value;
      state.purpose = purpose.value;
      clear.disabled = !LCA.projectFilter.active(state);
      onChanged();
    }
    query.addEventListener('input', changed);
    researcher.addEventListener('change', changed);
    purpose.addEventListener('change', changed);
    function reset() {
      query.value = ''; researcher.value = ''; purpose.value = '';
      changed();
    }
    clear.addEventListener('click', () => { reset(); query.focus(); });
    refreshOptions();
    clear.disabled = true;
    return { state, reset, refreshOptions };
  }
  return { init };
})();
