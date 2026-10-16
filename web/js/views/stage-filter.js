/* 전체 명단을 단계별로 세어 보여주고, 선택 중인 단계를 표시한다. */
window.LCA = window.LCA || {};
LCA.views = LCA.views || {};

LCA.views.stageFilter = (() => {
  function label(className, text) {
    const span = document.createElement('span');
    span.className = className;
    span.textContent = text;
    span.setAttribute('aria-hidden', 'true');
    return span;
  }

  function render(projects) {
    const counts = LCA.rules.stageCounts(projects);
    const fragment = document.createDocumentFragment();
    LCA.constants.STAGES.forEach((stage) => {
      const button = document.createElement('button');
      const count = counts[stage.no];
      button.type = 'button';
      button.className = `stage-filter${count === 0 ? ' stage-filter--empty' : ''}`;
      button.dataset.stage = stage.no;
      button.setAttribute('aria-label', `${stage.name} ${count}개`);
      button.setAttribute('aria-controls', 'project-list-section collection-section');
      button.setAttribute('aria-pressed', 'false');
      button.title = stage.name;
      button.append(
        label('stage-filter-count', count),
        label('stage-filter-name', stage.name),
        label('stage-filter-short', stage.short)
      );
      fragment.append(button);
    });
    document.querySelector('#stage-filters').replaceChildren(fragment);
    document.querySelector('#all-stages-count').textContent = projects.length;
  }

  // 버튼을 다시 만들지 않고 선택 표시만 바꿔 키보드 초점이 유지되게 한다.
  function select(stageNo) {
    document.querySelectorAll('#stage-filters button').forEach((button) => {
      button.setAttribute('aria-pressed', String(Number(button.dataset.stage) === stageNo));
    });
    document.querySelector('#all-stages').setAttribute('aria-pressed', String(stageNo === null));
  }

  return { render, select };
})();
