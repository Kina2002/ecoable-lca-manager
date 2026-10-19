window.LCA = window.LCA || {}; LCA.views = LCA.views || {};
LCA.views.requestTemplates = (() => {
  function init(getStore) {
    const host = document.querySelector('#request-template-settings');
    const form = host.querySelector('form'); const category = host.querySelector('select'); const content = host.querySelector('textarea');
    const feedback = host.querySelector('[role="status"]'); const reset = host.querySelector('[data-template-reset]'); const reload = host.querySelector('[data-template-reload]');
    let state = null; let busy = false; const drafts = new Map();
    for (const c of LCA.constants.CATEGORIES) { const option = document.createElement('option'); option.value = c.key; option.textContent = c.name; category.append(option); }
    let previous = category.value;
    function load() {
      state = getStore().templates();
      if (!state.ok) { feedback.textContent = state.message; form.querySelector('fieldset').disabled = true; return; }
      form.querySelector('fieldset').disabled = false;
      content.value = state.values[category.value]; drafts.clear(); feedback.textContent = state.customized.includes(category.value) ? '직접 저장한 기본 문장이에요.' : '앱의 기본 문장이에요.';
    }
    category.addEventListener('change', () => { drafts.set(previous, content.value); previous = category.value; content.value = drafts.get(previous) ?? state?.values[previous] ?? ''; feedback.textContent = '구분별 수정 중인 문장은 이 화면에서 유지해요. 저장 버튼을 눌러야 반영돼요.'; });
    reload.addEventListener('click', load);
    async function save(value) {
      if (busy || !state?.ok) return; busy = true; form.querySelector('fieldset').disabled = true;
      const result = await getStore().saveTemplate(category.value, value, state.revision);
      busy = false; form.querySelector('fieldset').disabled = false;
      if (result.ok) { state = result; content.value = result.values[category.value]; drafts.delete(category.value); feedback.textContent = '저장했어요. 새 요청의 기본 문장에 사용하며 기존 요청이나 작성 중인 내용은 바꾸지 않아요.'; }
      else feedback.textContent = result.message;
    }
    form.addEventListener('submit', (event) => { event.preventDefault(); save(content.value); });
    reset.addEventListener('click', () => save(null));
    load(); return { load };
  }
  return { init };
})();
