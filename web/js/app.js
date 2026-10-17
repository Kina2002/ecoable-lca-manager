/* 시작 버튼 역할: 기준 날짜를 정하고, 명단을 받아서 화면에 전달한다. */
(() => {
  const referenceDate = LCA.rules.today();
  function updateReferenceDate(value) {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const dateLabel = document.querySelector('#reference-date');
    dateLabel.dateTime = value;
    dateLabel.textContent = `${new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric', month: 'long', day: 'numeric', weekday: 'short'
    }).format(date)} 기준`;
  }
  updateReferenceDate(referenceDate);

  const samples = LCA.data.createSampleProjects(referenceDate);
  const projectStore = LCA.projects.createStore(samples, referenceDate, undefined, (id) => scopeStore.currentStage(id));
  const projectLoadResult = projectStore.list();
  const projectNotice = document.querySelector('#project-storage-status');
  projectNotice.hidden = projectLoadResult.ok;
  projectNotice.textContent = projectLoadResult.ok ? '' : `${projectLoadResult.error} 현재는 기본 가상 샘플만 표시해요.`;
  const projects = projectLoadResult.ok ? projectLoadResult.items : samples;
  const researcherStore = LCA.researchers.createStore();
  let requestStore = LCA.requests.createStore(projects.map((project) => project.id));
  let scopeStore = LCA.scope.createStore(projects, undefined, () => researcherStore.list(), (id) => requestStore.list(id), (id) => modellingStore.load(id), (id) => interpretationStore.load(id));
  let scopeLoadResult = scopeStore.load();
  const modellingStore = LCA.modelling.createStore(projects, undefined, (id) => requestStore.list(id), (id) => {
    const loaded = scopeStore.load();
    if (!loaded.ok) return loaded;
    const project = projects.find((item) => item.id === id);
    return project ? { ok: true, project } : { ok: false, error: '프로젝트를 찾을 수 없어요.' };
  });
  const interpretationStore = LCA.interpretation.createStore(projects, (id) => modellingStore.load(id));
  const reportStore = LCA.report.createStore(projects, (id) => interpretationStore.load(id));
  function showScopeStorageStatus() {
    const notice = document.querySelector('#scope-storage-status');
    notice.hidden = scopeLoadResult.ok;
    notice.textContent = scopeLoadResult.ok ? '' : `${scopeLoadResult.error} 목록은 현재 화면의 마지막 값 또는 가상 샘플이며 저장된 최신 상태를 확인하지 못했어요.`;
  }
  showScopeStorageStatus();
  let openedProjectId = null;
  let selectedStage = null; // null은 '전체 보기'라는 뜻이다. 새로고침하면 전체로 돌아온다.
  const listView = document.querySelector('#project-list-view');
  const detailView = document.querySelector('#project-detail-view');
  const glossaryView = document.querySelector('#glossary-view');
  const researcherView = document.querySelector('#researcher-view');
  let listScrollY = 0;
  let detailOpener = null;
  let projectView = listView;
  let projectPageTitle = '프로젝트 목록 | 에코에이블 LCA 관리';
  let projectScrollY = 0;

  function setPage(label, title, section) {
    document.querySelector('#current-view-label').textContent = label;
    document.title = title;
    for (const name of ['project', 'glossary', 'researcher']) {
      const link = document.querySelector(`#${name}-navigation`);
      if (name === section) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
  }

  const collectionView = LCA.views.collection.init(projects, { listAll: () => requestStore.listAll() }, (projectId, requestId, opener) => {
    showDetail(projectId, opener);
    selectDetailTab('requests');
    const card = detailView.querySelector(`#request-items li[data-request-id="${requestId}"]`);
    if (card) {
      card.tabIndex = -1;
      card.focus({ preventScroll: true });
      card.scrollIntoView({ block: 'center' });
    }
  });

  const projectFilters = LCA.views.projectFilter.init(projects, renderProjectList);
  function refreshCollectionDates() {
    const result = projectStore.list();
    if (result.ok) {
      const dates = new Map(result.items.map((project) => [project.id, project.collectionDueDate]));
      projects.forEach((project) => { if (dates.has(project.id)) project.collectionDueDate = dates.get(project.id); });
    }
    projectNotice.hidden = result.ok;
    projectNotice.textContent = result.ok ? '' : result.error;
    return result;
  }
  function renderProjectList() {
    const collectionDates = refreshCollectionDates();
    projectFilters.refreshOptions();
    const visible = LCA.projectFilter.select(projects, selectedStage, projectFilters.state);
    LCA.views.projectList.render(visible, selectedStage, projects.length, LCA.projectFilter.active(projectFilters.state), { requests: requestStore.listAll(), collectionDates });
  }
  function showStage(stageNo) {
    selectedStage = stageNo;
    renderProjectList();
    LCA.views.stageFilter.select(selectedStage);
    collectionView.setStage(selectedStage);
  }

  // 위의 건수는 전체 명단에서 만들고, 아래 목록만 선택한 조건으로 거른다.
  LCA.views.stageFilter.render(projects);
  showStage(null);
  LCA.views.glossary.init();
  const researcherPage = LCA.views.researchers.init(researcherStore, () => {
    if (!projectLoadResult.ok) return projectLoadResult;
    scopeLoadResult = scopeStore.load();
    showScopeStorageStatus();
    return scopeLoadResult.ok ? { ok: true, items: projects } : scopeLoadResult;
  }, (id, opener) => {
    showStage(null);
    showDetail(id, opener);
    listScrollY = 0;
  });
  document.querySelector('#new-project').disabled = !projectLoadResult.ok;
  LCA.views.projectCreate.init(projectStore, (result) => {
    // 범위가 반영되기 전의 기본 명단으로 저장소를 연결한 뒤 저장된 범위를 읽는다.
    projects.splice(0, projects.length, ...result.items);
    scopeStore = LCA.scope.createStore(projects, undefined, () => researcherStore.list(), (id) => requestStore.list(id), (id) => modellingStore.load(id), (id) => interpretationStore.load(id));
    scopeLoadResult = scopeStore.load();
    showScopeStorageStatus();
    requestStore = LCA.requests.createStore(projects.map((project) => project.id));
    projectFilters.reset();
    LCA.views.stageFilter.render(projects);
    showStage(1);
    const message = document.querySelector('#project-create-status');
    message.textContent = `${result.item.companyName} · ${result.item.code} 프로젝트를 등록했어요. 계약·착수 단계와 범위 미정으로 시작해요.`;
    const addedButton = listView.querySelector(`[data-open-project="${result.item.id}"]`);
    if (addedButton) {
      addedButton.focus({ preventScroll: true });
      addedButton.scrollIntoView({ block: 'center' });
    }
  });

  document.querySelector('#stage-filters').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-stage]');
    if (!button) return;
    const stageNo = Number(button.dataset.stage);
    showStage(selectedStage === stageNo ? null : stageNo);
  });
  document.querySelector('#all-stages').addEventListener('click', () => showStage(null));

  function showDetail(projectId, opener) {
    refreshCollectionDates();
    scopeLoadResult = scopeStore.load();
    showScopeStorageStatus();
    openedProjectId = projectId;
    // 행의 위치가 아니라 고정 ID로 찾는다. 필터 후에도 다른 업무와 혼동하지 않는다.
    const project = projects.find((item) => item.id === projectId);
    if (!project) return;
    listScrollY = window.scrollY;
    detailOpener = opener;
    LCA.views.projectDetail.render(project);
    bindScope(project);
    bindCollectionDeadline(project);
    bindCollectionTransition(project);
    bindCalculation(project);
    LCA.views.requests.init(project, requestStore, refreshRequestViews);
    listView.hidden = true;
    glossaryView.hidden = true;
    researcherView.hidden = true;
    detailView.hidden = false;
    projectView = detailView;
    projectPageTitle = `${project.companyName} 상세 | 에코에이블 LCA 관리`;
    setPage('프로젝트 상세', projectPageTitle, 'project');
    document.querySelector('#project-detail-title').focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }

  function bindScope(project) {
    LCA.views.scope.init(project, scopeStore, scopeLoadResult, (moved) => {
      LCA.views.stageFilter.render(projects);
      showStage(selectedStage);
      if (moved) {
        LCA.views.projectDetail.render(project);
        bindScope(project);
        bindCollectionDeadline(project);
        bindCollectionTransition(project);
        bindCalculation(project);
        LCA.views.requests.init(project, requestStore, refreshRequestViews);
        const message = document.querySelector('#scope-editor [role="status"]');
        message.textContent = project.stage === 2 ? '범위 정의 단계로 이동했어요. 고객과 협의할 평가 범위를 아래에 기록해 주세요.' : '데이터 수집 단계로 이동했어요. 자료 요청 탭에서 필요한 자료를 등록할 수 있어요.';
        message.tabIndex = -1;
        message.focus();
      } else {
        LCA.views.projectDetail.refreshScope(project);
      }
    }, researcherStore);
  }

  function bindCollectionDeadline(project) {
    LCA.views.collectionDeadline.init(project, projectStore, projectStore.list(), renderProjectList, () => LCA.views.collectionTransition.refresh());
  }

  function bindCalculation(project) {
    LCA.views.modelling.init(project, modellingStore, () => {
      LCA.views.interpretation.refresh();
      LCA.views.report.refresh();
    });
    function refreshLaterStage() {
      LCA.views.projectDetail.refreshStage(project);
      bindCollectionTransition(project);
      LCA.views.stageFilter.render(projects);
      showStage(selectedStage);
      LCA.views.modelling.refresh();
      LCA.views.interpretation.refresh();
      LCA.views.report.refresh();
    }
    LCA.views.interpretation.init(project, interpretationStore, scopeStore, refreshLaterStage, () => LCA.views.report.refresh());
    LCA.views.report.init(project, reportStore, scopeStore, refreshLaterStage);
  }
  function refreshRequestViews(result) {
    LCA.views.collectionTransition.refresh(result);
    LCA.views.modelling.refresh();
    LCA.views.interpretation.refresh();
    LCA.views.report.refresh();
  }

  function bindCollectionTransition(project) {
    LCA.views.collectionTransition.init(project, scopeStore, scopeLoadResult, () => {
      LCA.views.projectDetail.refreshStage(project);
      bindCollectionDeadline(project);
      bindCollectionTransition(project);
      LCA.views.stageFilter.render(projects);
      showStage(selectedStage);
      LCA.views.modelling.refresh();
      const status = document.querySelector('#collection-transition-status');
      const movedMessage = project.stage === 5
        ? '계산(모델링) 단계로 이동했어요. 승인된 자료 기록은 그대로 보관돼요.'
        : '자료 수집을 마치고 데이터 검토 단계로 이동했어요.';
      status.textContent = `${movedMessage} ${status.textContent}`;
      status.tabIndex = -1;
      status.focus({ preventScroll: true });
      status.scrollIntoView({ block: 'center' });
    }, () => selectDetailTab('requests', true));
  }

  function showList() {
    if (detailView.hidden) return;
    detailView.hidden = true;
    listView.hidden = false;
    projectView = listView;
    projectPageTitle = '프로젝트 목록 | 에코에이블 LCA 관리';
    setPage('프로젝트', projectPageTitle, 'project');
    scopeLoadResult = scopeStore.load();
    showScopeStorageStatus();
    LCA.views.stageFilter.render(projects);
    showStage(selectedStage);
    // 저장 후 달라진 상태·단계 건수를 반영하고 선택한 단계와 스크롤을 이어 간다.
    if (detailOpener?.dataset.collectionRequest) collectionView.focusRequest(detailOpener.dataset.collectionRequest);
    else {
      const opener = listView.querySelector(`[data-open-project="${openedProjectId}"]`);
      if (opener) opener.focus({ preventScroll: true });
      else document.querySelector(selectedStage ? `#stage-filters [data-stage="${selectedStage}"]` : '#all-stages').focus({ preventScroll: true });
    }
    window.scrollTo(0, listScrollY);
  }

  document.querySelector('#project-rows').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-open-project]');
    if (button) showDetail(button.dataset.openProject, button);
  });
  function selectDetailTab(key, focus = false) {
    LCA.views.collectionTransition.refresh();
    LCA.views.modelling.refresh();
    LCA.views.interpretation.refresh();
    LCA.views.report.refresh();
    for (const tab of detailView.querySelectorAll('[data-detail-tab]')) {
      const selected = tab.dataset.detailTab === key;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      document.querySelector(`#${tab.getAttribute('aria-controls')}`).hidden = !selected;
      if (selected && focus) tab.focus();
    }
  }
  detailView.addEventListener('click', (event) => {
    const researcher = event.target.closest('[data-open-researcher]');
    if (researcher) { openResearchers(researcher.dataset.openResearcher); return; }
    if (event.target.closest('[data-edit-scope]')) {
      selectDetailTab('overview');
      LCA.views.scope.focusEditor();
      return;
    }
    const tab = event.target.closest('[data-detail-tab]');
    if (tab) selectDetailTab(tab.dataset.detailTab);
  });
  detailView.addEventListener('keydown', (event) => {
    const tab = event.target.closest('[data-detail-tab]');
    if (!tab || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const keys = Array.from(detailView.querySelectorAll('[data-detail-tab]')).map((item) => item.dataset.detailTab);
    const index = keys.indexOf(tab.dataset.detailTab);
    const key = event.key === 'Home' ? keys[0] : event.key === 'End' ? keys.at(-1)
      : keys[(index + (event.key === 'ArrowRight' ? 1 : -1) + keys.length) % keys.length];
    selectDetailTab(key, true);
  });
  document.querySelector('#back-to-projects').addEventListener('click', showList);
  document.querySelector('#project-navigation').addEventListener('click', (event) => {
    event.preventDefault();
    if (glossaryView.hidden && researcherView.hidden) {
      showList();
      return;
    }
    glossaryView.hidden = true;
    researcherView.hidden = true;
    projectView.hidden = false;
    setPage(projectView === detailView ? '프로젝트 상세' : '프로젝트', projectPageTitle, 'project');
    if (projectView === listView) {
      LCA.views.stageFilter.render(projects);
      showStage(selectedStage);
    }
    else LCA.views.scope.refreshResearchers();
    projectView.querySelector('h1').focus({ preventScroll: true });
    window.scrollTo(0, projectScrollY);
  });
  document.querySelector('#glossary-navigation').addEventListener('click', (event) => {
    event.preventDefault();
    if (glossaryView.hidden) {
      if (researcherView.hidden) projectScrollY = window.scrollY;
      listView.hidden = true;
      detailView.hidden = true;
      researcherView.hidden = true;
      glossaryView.hidden = false;
      setPage('용어사전', '용어사전 | 에코에이블 LCA 관리', 'glossary');
    }
    document.querySelector('#glossary-search').focus({ preventScroll: true });
    window.scrollTo(0, 0);
  });
  function openResearchers(id = null) {
    if (researcherView.hidden && glossaryView.hidden) projectScrollY = window.scrollY;
    listView.hidden = true;
    detailView.hidden = true;
    glossaryView.hidden = true;
    researcherView.hidden = false;
    setPage('담당 연구원', '담당 연구원 | 에코에이블 LCA 관리', 'researcher');
    if (id) researcherPage.focusResearcher(id);
    else {
      researcherPage.refresh();
      document.querySelector('#researcher-title').focus({ preventScroll: true });
      window.scrollTo(0, 0);
    }
  }
  document.querySelector('#researcher-navigation').addEventListener('click', (event) => {
    event.preventDefault();
    openResearchers();
  });
  // 날짜만 갱신한다. 입력 중인 폼이나 선택한 필터를 다시 만들지 않는다.
  function refreshDates() {
    updateReferenceDate(LCA.rules.today());
    LCA.views.deadlines.refresh();
  }
  window.setInterval(refreshDates, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshDates(); });
  window.addEventListener('pageshow', refreshDates);
})();
