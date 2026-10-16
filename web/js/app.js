/* 시작 버튼 역할: 기준 날짜를 정하고, 명단을 받아서 화면에 전달한다. */
(() => {
  const referenceDate = LCA.rules.today();
  const [year, month, day] = referenceDate.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const dateLabel = document.querySelector('#reference-date');
  dateLabel.dateTime = referenceDate;
  dateLabel.textContent = `${new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'short'
  }).format(date)} 기준`;

  const projects = LCA.data.createSampleProjects(referenceDate);
  const scopeStore = LCA.scope.createStore(projects);
  let scopeLoadResult = scopeStore.load();
  function showScopeStorageStatus() {
    const notice = document.querySelector('#scope-storage-status');
    notice.hidden = scopeLoadResult.ok;
    notice.textContent = scopeLoadResult.ok ? '' : `${scopeLoadResult.error} 목록은 현재 화면의 마지막 값 또는 가상 샘플이며 저장된 최신 상태를 확인하지 못했어요.`;
  }
  showScopeStorageStatus();
  let openedProjectId = null;
  const requestStore = LCA.requests.createStore(projects.map((project) => project.id));
  let selectedStage = null; // null은 '전체 보기'라는 뜻이다. 새로고침하면 전체로 돌아온다.
  const listView = document.querySelector('#project-list-view');
  const detailView = document.querySelector('#project-detail-view');
  const glossaryView = document.querySelector('#glossary-view');
  let listScrollY = 0;
  let detailOpener = null;
  let projectView = listView;
  let projectPageTitle = '프로젝트 목록 | 에코에이블 LCA 관리';
  let projectScrollY = 0;

  function setPage(label, title, section) {
    document.querySelector('#current-view-label').textContent = label;
    document.title = title;
    for (const name of ['project', 'glossary']) {
      const link = document.querySelector(`#${name}-navigation`);
      if (name === section) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
  }

  const collectionView = LCA.views.collection.init(projects, requestStore, (projectId, requestId, opener) => {
    showDetail(projectId, opener);
    selectDetailTab('requests');
    const card = detailView.querySelector(`#request-items li[data-request-id="${requestId}"]`);
    if (card) {
      card.tabIndex = -1;
      card.focus({ preventScroll: true });
      card.scrollIntoView({ block: 'center' });
    }
  });

  function showStage(stageNo) {
    selectedStage = stageNo;
    const visibleProjects = LCA.rules.projectsForStage(projects, selectedStage);
    LCA.views.projectList.render(visibleProjects, selectedStage, projects.length);
    LCA.views.stageFilter.select(selectedStage);
    collectionView.setStage(selectedStage);
  }

  // 위의 건수는 전체 명단에서 만들고, 아래 목록만 선택한 조건으로 거른다.
  LCA.views.stageFilter.render(projects);
  showStage(null);
  LCA.views.glossary.init();

  document.querySelector('#stage-filters').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-stage]');
    if (!button) return;
    const stageNo = Number(button.dataset.stage);
    showStage(selectedStage === stageNo ? null : stageNo);
  });
  document.querySelector('#all-stages').addEventListener('click', () => showStage(null));

  function showDetail(projectId, opener) {
    scopeLoadResult = scopeStore.load();
    showScopeStorageStatus();
    openedProjectId = projectId;
    // 행의 위치가 아니라 고정 ID로 찾는다. 필터 후에도 다른 업무와 혼동하지 않는다.
    const project = projects.find((item) => item.id === projectId);
    if (!project) return;
    listScrollY = window.scrollY;
    detailOpener = opener;
    LCA.views.projectDetail.render(project);
    LCA.views.requests.init(project, requestStore);
    bindScope(project);
    listView.hidden = true;
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
        LCA.views.requests.init(project, requestStore);
        bindScope(project);
        const message = document.querySelector('#scope-editor [role="status"]');
        message.textContent = '데이터 수집 단계로 이동했어요. 자료 요청 탭에서 필요한 자료를 등록할 수 있어요.';
        message.tabIndex = -1;
        message.focus();
      } else {
        LCA.views.projectDetail.refreshScope(project);
      }
    });
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
      const opener = listView.querySelector(detailOpener?.dataset.openScope ? `[data-open-scope="${openedProjectId}"]` : `[data-open-project="${openedProjectId}"]`);
      if (opener) opener.focus({ preventScroll: true });
      else document.querySelector(selectedStage ? `#stage-filters [data-stage="${selectedStage}"]` : '#all-stages').focus({ preventScroll: true });
    }
    window.scrollTo(0, listScrollY);
  }

  document.querySelector('#project-rows').addEventListener('click', (event) => {
    const scope = event.target.closest('button[data-open-scope]');
    if (scope) {
      showDetail(scope.dataset.openScope, scope);
      LCA.views.scope.focusEditor();
      return;
    }
    const button = event.target.closest('button[data-open-project]');
    if (button) showDetail(button.dataset.openProject, button);
  });
  function selectDetailTab(key, focus = false) {
    for (const tab of detailView.querySelectorAll('[data-detail-tab]')) {
      const selected = tab.dataset.detailTab === key;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      document.querySelector(`#${tab.getAttribute('aria-controls')}`).hidden = !selected;
      if (selected && focus) tab.focus();
    }
  }
  detailView.addEventListener('click', (event) => {
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
    const key = event.key === 'Home' ? 'overview' : event.key === 'End' ? 'requests'
      : tab.dataset.detailTab === 'overview' ? 'requests' : 'overview';
    selectDetailTab(key, true);
  });
  document.querySelector('#back-to-projects').addEventListener('click', showList);
  document.querySelector('#project-navigation').addEventListener('click', (event) => {
    event.preventDefault();
    if (glossaryView.hidden) {
      showList();
      return;
    }
    // 사전을 열기 전의 목록 또는 상세를 그대로 펼친다.
    glossaryView.hidden = true;
    projectView.hidden = false;
    setPage(projectView === detailView ? '프로젝트 상세' : '프로젝트', projectPageTitle, 'project');
    if (projectView === listView) collectionView.refresh();
    projectView.querySelector('h1').focus({ preventScroll: true });
    window.scrollTo(0, projectScrollY);
  });
  document.querySelector('#glossary-navigation').addEventListener('click', (event) => {
    event.preventDefault();
    if (glossaryView.hidden) {
      projectScrollY = window.scrollY;
      listView.hidden = true;
      detailView.hidden = true;
      glossaryView.hidden = false;
      setPage('용어사전', '용어사전 | 에코에이블 LCA 관리', 'glossary');
    }
    document.querySelector('#glossary-search').focus({ preventScroll: true });
    window.scrollTo(0, 0);
  });
})();
