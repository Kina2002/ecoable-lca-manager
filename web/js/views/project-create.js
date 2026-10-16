window.LCA = window.LCA || {};
LCA.views = LCA.views || {};
LCA.views.projectCreate = (() => {
  function init(store, onCreated) {
    const dialog = document.querySelector('#project-create-dialog');
    const form = document.querySelector('#project-create-form');
    const opener = document.querySelector('#new-project');
    const error = document.querySelector('#project-create-error');
    let createdResult = null;
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
    document.querySelector('#project-create-cancel').addEventListener('click', () => dialog.close());
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
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      clearErrors();
      const draft = Object.fromEntries(Object.entries(controls).map(([key, field]) => [key, field.value]));
      const result = store.add(draft);
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
