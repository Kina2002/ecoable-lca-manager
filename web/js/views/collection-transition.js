window.LCA = window.LCA || {};
LCA.views = LCA.views || {};
LCA.views.collectionTransition = (() => {
  let refreshCurrent = () => {};
  function init(project, store, loadResult, onMoved, onRequests) {
    refreshCurrent = () => {};
    const host = document.querySelector('#collection-transition');
    host.replaceChildren();
    if (![3, 4].includes(project.stage)) return;
    const section = document.createElement('section');
    section.className = 'detail-card collection-transition';
    const heading = document.createElement('h2');
    heading.textContent = project.stage === 3 ? '자료 수집 완료 확인' : '자료 수집 완료';
    const help = document.createElement('p');
    help.className = 'detail-help';
    help.textContent = project.stage === 3
      ? '요청한 자료가 모두 제출됐는지 확인하고 데이터 검토 단계로 이동해요. 자료의 내용 검토와 승인은 이어서 진행해요.'
      : '데이터 검토 단계예요. 자료별로 내용을 검토하고 승인하거나 보완을 요청해 주세요.';
    const status = document.createElement('p');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.id = 'collection-transition-status';
    const missing = document.createElement('ul');
    missing.className = 'collection-missing';
    const feedback = document.createElement('p');
    feedback.setAttribute('role', 'alert');
    const actions = document.createElement('div');
    actions.className = 'scope-actions';
    const finish = document.createElement('button');
    finish.type = 'button';
    finish.className = 'primary-button';
    finish.textContent = '자료 수집 완료 · 검토 시작';
    finish.setAttribute('aria-describedby', status.id);
    finish.hidden = project.stage !== 3;
    const requests = document.createElement('button');
    requests.type = 'button';
    requests.className = 'request-action-button';
    requests.textContent = '자료 요청에서 확인';
    requests.addEventListener('click', onRequests);
    actions.append(finish, requests);
    section.append(heading, help, status, missing, feedback, actions);
    host.append(section);
    const expected = LCA.scope.snapshot(project);
    function refresh(result) {
      missing.replaceChildren();
      finish.hidden = project.stage !== 3;
      heading.textContent = project.stage === 3 ? '자료 수집 완료 확인' : '자료 수집 완료';
      if (!loadResult.ok) { finish.disabled = true; status.textContent = loadResult.error; return; }
      if (project.stage === 4) { status.textContent = '수집 완료는 개별 자료의 승인이나 프로젝트 전체 완료를 뜻하지 않아요.'; return; }
      const readiness = result ? LCA.scope.collectionReadiness(project.id, result) : store.collectionStatus(project.id);
      const dirty = LCA.views.collectionDeadline.isDirty();
      finish.disabled = !readiness.ok || !readiness.ready || dirty;
      status.textContent = !readiness.ok ? readiness.error
        : dirty ? '입력 중인 수집 마감일을 먼저 저장하거나 원래 값으로 되돌려 주세요.'
        : !readiness.total ? '아직 자료 요청이 없어요. 필요한 요청을 등록하고 받은 자료를 기록해 주세요.'
        : readiness.ready ? `제출 확인 ${readiness.submitted}/${readiness.total}건. 모든 자료가 제출됐어요. 버튼을 누르면 데이터 검토 단계로 이동해요.`
        : `제출 확인 ${readiness.submitted}/${readiness.total}건. 아래 자료를 받거나 보완한 뒤 기록해 주세요.`;
      for (const item of readiness.missing || []) {
        const line = document.createElement('li');
        const category = LCA.constants.CATEGORIES.find((value) => value.key === item.categoryKey);
        line.textContent = `${item.id} · ${category?.name || item.categoryKey} · ${item.status}${item.status === '보완 요청' ? ' — 보완 자료를 다시 기록해 주세요.' : ' — 받은 자료 기록이 필요해요.'}`;
        missing.append(line);
      }
    }
    refreshCurrent = refresh;
    refresh();
    finish.addEventListener('click', () => {
      feedback.textContent = '';
      if (LCA.views.collectionDeadline.isDirty()) { refresh(); return; }
      const result = store.finishCollection(project.id, expected);
      if (!result.ok) { refresh(); feedback.textContent = result.error || '단계를 이동하지 못했어요. 다시 열어 확인해 주세요.'; return; }
      onMoved();
    });
  }
  return { init, refresh: (result) => refreshCurrent(result) };
})();
