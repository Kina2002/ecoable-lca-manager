window.LCA = window.LCA || {};
LCA.views = LCA.views || {};
LCA.views.deadlines = (() => {
  const models = new WeakMap();
  function paint(node, summary) {
    node.textContent = summary.text;
    node.className = `deadline-badge deadline-badge--${summary.tone}`;
    const label = `${summary.text}${summary.status ? ` · ${summary.status}` : ''}${summary.date ? ` · 기준 기한 ${summary.date}` : ''}`;
    node.setAttribute('aria-label', label);
    node.title = `${label}${['제출됨', '검토 중'].includes(summary.status) ? ' · 기한 경과는 고객의 제출 지연을 뜻하지 않아요.' : ''}`;
  }
  function badge(summary) {
    const node = document.createElement('span');
    node.dataset.deadline = '';
    models.set(node, summary);
    paint(node, summary);
    return node;
  }
  function refresh() {
    const today = LCA.rules.today();
    document.querySelectorAll('[data-deadline]').forEach((node) => {
      const model = models.get(node);
      if (model) paint(node, LCA.deadlines.refresh(model, today));
    });
  }
  return { badge, refresh };
})();
