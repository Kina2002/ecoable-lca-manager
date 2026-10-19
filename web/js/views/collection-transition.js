window.LCA = window.LCA || {};
LCA.views = LCA.views || {};
LCA.views.collectionTransition = (() => {
  let refreshCurrent = () => {};
  function init(project, store, loadResult, onMoved) {
    refreshCurrent = () => {};
    const host = document.querySelector('#collection-transition');
    host.replaceChildren();
    if (![3, 4, 5].includes(project.stage)) return;
    const section = document.createElement('section');
    section.className = 'detail-card collection-transition';
    const heading = document.createElement('h2');
    const title = () => project.stage === 3 ? '자료 수집 완료 확인' : project.stage === 4 ? '자료 검토 완료 확인' : '자료 검토 완료';
    heading.textContent = title();
    const help = document.createElement('p');
    help.className = 'detail-help';
    help.textContent = project.stage === 3
      ? '요청한 자료가 모두 제출됐는지 확인하고 데이터 검토 단계로 이동해요. 자료의 내용 검토와 승인은 이어서 진행해요.'
      : project.stage === 4 ? '자료별 검토를 마치고 모두 승인하면 계산(모델링) 단계로 이동할 수 있어요.'
      : '계산(모델링) 단계예요. 다음 작업은 배경 데이터 연결과 모델링이에요.';
    const status = document.createElement('p');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.id = 'collection-transition-status';
    const missing = document.createElement('ul');
    missing.className = 'collection-missing';
    const missingDetails = document.createElement('details'); missingDetails.className = 'collection-missing-details';
    const missingTitle = document.createElement('summary'); missingDetails.append(missingTitle, missing);
    const feedback = document.createElement('p');
    feedback.setAttribute('role', 'alert');
    const actions = document.createElement('div');
    actions.className = 'scope-actions';
    const finish = document.createElement('button');
    finish.type = 'button';
    finish.className = 'primary-button';
    finish.textContent = project.stage === 4 ? '자료 검토 완료 · 계산 단계로' : '자료 수집 완료 · 검토 시작';
    finish.setAttribute('aria-describedby', status.id);
    finish.hidden = project.stage === 5;
    actions.append(finish);
    const titleRow = document.createElement('div'); titleRow.className = 'collection-transition-heading';
    const guide = document.createElement('details'); guide.className = 'collection-transition-guide';
    const guideTitle = document.createElement('summary'); guideTitle.textContent = '단계 안내'; guide.append(guideTitle, help);
    titleRow.append(heading, guide);
    section.append(titleRow, status, missingDetails, feedback, actions);
    host.append(section);
    const expected = LCA.scope.snapshot(project);
    function refresh(result) {
      missing.replaceChildren(); missingDetails.hidden = true;
      const reviewing = project.stage === 4;
      finish.hidden = project.stage === 5;
      finish.textContent = reviewing ? '자료 검토 완료 · 계산 단계로' : '자료 수집 완료 · 검토 시작';
      heading.textContent = title();
      if (!loadResult.ok) { finish.disabled = true; status.textContent = loadResult.error; return; }
      if (project.stage === 5) { status.textContent = '실제 환경영향 계산은 아직 이 시연 앱에서 실행하지 않아요.'; return; }
      const readiness = result
        ? (reviewing ? LCA.scope.reviewReadiness(project.id, result) : LCA.scope.collectionReadiness(project.id, result))
        : (reviewing ? store.reviewStatus(project.id) : store.collectionStatus(project.id));
      const dirty = !reviewing && LCA.views.collectionDeadline.isDirty();
      finish.disabled = !readiness.ok || !readiness.ready || dirty;
      if (reviewing) {
        status.textContent = !readiness.ok ? readiness.error
          : !readiness.total ? `승인 0/0건${readiness.notApplicable ? ` · 해당 없음 ${readiness.notApplicable}건` : ''}. 계산에 쓸 자료가 최소 한 건 필요해요.`
          : readiness.ready ? `승인 ${readiness.approved}/${readiness.total}건${readiness.notApplicable ? ` · 해당 없음 ${readiness.notApplicable}건` : ''}. 버튼을 누르면 계산(모델링) 단계로 이동해요.`
          : `승인 ${readiness.approved}/${readiness.total}건${readiness.notApplicable ? ` · 해당 없음 ${readiness.notApplicable}건` : ''}. 아래 자료의 검토와 승인을 마쳐 주세요.`;
      } else {
        status.textContent = !readiness.ok ? readiness.error
          : dirty ? '입력 중인 수집 마감일을 먼저 저장하거나 원래 값으로 되돌려 주세요.'
          : !readiness.total ? `제출 확인 0/0건${readiness.notApplicable ? ` · 해당 없음 ${readiness.notApplicable}건` : ''}. 실제로 받을 자료가 최소 한 건 필요해요.`
          : readiness.ready ? `제출 확인 ${readiness.submitted}/${readiness.total}건${readiness.notApplicable ? ` · 해당 없음 ${readiness.notApplicable}건` : ''}. 버튼을 누르면 데이터 검토 단계로 이동해요.`
          : `제출 확인 ${readiness.submitted}/${readiness.total}건${readiness.notApplicable ? ` · 해당 없음 ${readiness.notApplicable}건` : ''}. 아래 자료를 받거나 보완한 뒤 기록해 주세요.`;
      }
      for (const item of readiness.missing || []) {
        const line = document.createElement('li');
        const category = LCA.constants.CATEGORIES.find((value) => value.key === item.categoryKey);
        line.textContent = `${item.id} · ${category?.name || item.categoryKey} · ${item.status}${reviewing ? ' — 검토와 승인이 필요해요.' : item.status === '보완 요청' ? ' — 보완 자료를 다시 기록해 주세요.' : ' — 받은 자료 기록이 필요해요.'}`;
        missing.append(line);
      }
      missingDetails.hidden = !missing.childElementCount;
      missingTitle.textContent = `확인이 필요한 자료 ${missing.childElementCount}건 보기`;
    }
    refreshCurrent = refresh;
    refresh();
    finish.addEventListener('click', () => {
      feedback.textContent = '';
      if (project.stage === 3 && LCA.views.collectionDeadline.isDirty()) { refresh(); return; }
      const result = project.stage === 4 ? store.finishReview(project.id, expected) : store.finishCollection(project.id, expected);
      if (!result.ok) { refresh(); feedback.textContent = result.error || '단계를 이동하지 못했어요. 다시 열어 확인해 주세요.'; return; }
      onMoved();
    });
  }
  return { init, refresh: (result) => refreshCurrent(result) };
})();
