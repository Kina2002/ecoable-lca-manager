window.LCA = window.LCA || {};
LCA.views = LCA.views || {};
LCA.views.compact = (() => {
  // 폼과 이벤트 연결은 그대로 두고 표시 영역만 접는다.
  function form(form, label) {
    const details = document.createElement('details'); details.className = 'form-disclosure';
    const summary = document.createElement('summary'); summary.textContent = label;
    details.append(summary, form); return details;
  }
  return { form };
})();
