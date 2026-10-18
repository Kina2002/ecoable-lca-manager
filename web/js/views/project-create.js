window.LCA = window.LCA || {};
LCA.views = LCA.views || {};
LCA.views.projectCreate = (() => {
  function init(store, onCreated) {
    const dialog = document.querySelector('#project-create-dialog');
    const form = document.querySelector('#project-create-form');
    const opener = document.querySelector('#new-project');
    const error = document.querySelector('#project-create-error');
    let createdResult = null;
    let busy = false;
    const controls = Object.fromEntries(['companyName', 'productName', 'purpose', 'targetDate'].map((key) => [key, form.elements.namedItem(key)]));
    for (const purpose of LCA.projects.PURPOSES) {
      const option = document.createElement('option');
      option.value = purpose; option.textContent = purpose;
      controls.purpose.append(option);
    }
    function clearErrors() {
      error.hidden = true;
      error.textContent = '';
      for (const field of Object.values(controls)) field.removeAttribute('aria-invalid');
    }
    LCA.views.dateInput.bind(controls.targetDate, document.querySelector('#project-target-calendar'), document.querySelector('#project-target-calendar-button'), clearErrors, error);
    opener.addEventListener('click', () => {
      form.reset();
      clearErrors();
      dialog.showModal();
      controls.companyName.focus();
    });
    document.querySelector('#project-create-cancel').addEventListener('click', () => { if (!busy) dialog.close(); });
    dialog.addEventListener('cancel', (event) => { if (busy) event.preventDefault(); });
    dialog.addEventListener('close', () => {
      opener.focus({ preventScroll: true });
      if (createdResult) {
        const result = createdResult;
        createdResult = null;
        onCreated(result);
      }
    });
    form.addEventListener('input', clearErrors);
    form.addEventListener('change', clearErrors);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (busy) return;
      clearErrors();
      const draft = Object.fromEntries(Object.entries(controls).map(([key, field]) => [key, field.value]));
      busy = true;
      for (const input of form.querySelectorAll('input, select, button')) input.disabled = true;
      let result;
      try { result = await store.add(draft); }
      catch { result = { ok: false, error: '프로젝트를 저장하지 못했어요. 입력을 유지했으니 다시 시도해 주세요.' }; }
      busy = false;
      for (const input of form.querySelectorAll('input, select, button')) input.disabled = false;
      if (!result.ok) {
        error.hidden = false;
        error.textContent = result.error || Object.values(result.errors).join(' ');
        const firstKey = Object.keys(result.errors || {})[0];
        for (const key of Object.keys(result.errors || {})) controls[key]?.setAttribute('aria-invalid', 'true');
        if (firstKey) controls[firstKey].focus();
        return;
      }
      createdResult = result;
      dialog.close();
    });
  }
  return { init };
})();
