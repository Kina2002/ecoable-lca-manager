/* 시작 버튼 역할: 기준 날짜를 정하고, 명단을 받아서 화면에 전달한다. */
(async () => {
  function showStorageReload(message) {
    for (const dialog of document.querySelectorAll('dialog[open]')) dialog.close();
    const notice = document.querySelector('#storage-reload-notice');
    document.querySelector('#storage-reload-message').textContent = message;
    notice.hidden = false; document.querySelector('.app-shell').inert = true;
    document.querySelector('#storage-reload-title').focus();
  }
  document.querySelector('#storage-reload').addEventListener('click', () => window.location.reload());
  document.querySelector('#storage-reload-notice').addEventListener('keydown', (event) => {
    if (event.key === 'Tab') { event.preventDefault(); document.querySelector('#storage-reload').focus(); }
  });
  let sampleDate; let recovery;
  try {
    recovery = await LCA.storage.bootstrap();
    sampleDate = LCA.storage.get().getItem(LCA.storage.SAMPLE_KEY) || LCA.rules.today();
    if (!LCA.requests.validDate(sampleDate)) throw Error();
  } catch {
    showStorageReload('저장 기록을 안전하게 열지 못했어요. 중단된 복원 기록이나 브라우저 저장 설정을 확인한 뒤 새로고침해 주세요. 기존 백업 파일은 보관해 주세요.'); return;
  }
  window.addEventListener('storage', (event) => {
    if ((event.key === LCA.storage.EPOCH_KEY || event.key === null) && LCA.storage.changed()) {
      showStorageReload('다른 창에서 프로젝트 삭제 또는 백업 복원으로 기록이 바뀌었어요. 오래된 화면에서 저장하지 않도록 멈췄어요. 새로고침하면 최신 기록을 볼 수 있어요.');
    }
  });
  window.addEventListener('pageshow', () => { if (LCA.storage.changed()) showStorageReload('프로젝트 삭제 또는 백업 복원으로 기록이 바뀌었어요. 새로고침해서 최신 기록을 열어 주세요.'); });
  if (recovery.recovered) {
    const notice = document.querySelector('#backup-recovery-status'); notice.hidden = false;
    notice.textContent = '지난번 프로젝트 삭제 또는 백업 복원이 중단되어 변경 전 기록으로 되돌렸어요. 기록을 확인하고 다시 진행해 주세요.';
  }
  LCA.views.backup.init(sampleDate, showStorageReload);
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

  const samples = LCA.data.createSampleProjects(sampleDate);
  const projectStore = LCA.projects.createStore(samples, referenceDate, undefined, (id) => scopeStore.currentStage(id));
  const projectLoadResult = projectStore.list();
  const projectNotice = document.querySelector('#project-storage-status');
  projectNotice.hidden = projectLoadResult.ok;
  projectNotice.textContent = projectLoadResult.ok ? '' : `${projectLoadResult.error} 현재는 기본 가상 샘플만 표시해요.`;
  const projects = projectLoadResult.ok ? projectLoadResult.items : samples;
  const researcherStore = LCA.researchers.createStore();
  let requestStore = LCA.requests.createStore(projects.map((project) => project.id), undefined, (id) => scopeStore.currentStage(id));
  let verificationStore = null;
  let certificationStore = null;
  let reviewRouteStore = null;
  const verificationStage = (id) => {
    const verification = verificationStore ? verificationStore.currentStage(id) : { ok: true, stage: null };
    if (!verification.ok) return verification;
    const certification = certificationStore ? certificationStore.currentStage(id) : { ok: true, stage: null };
    if (!certification.ok) return certification;
    const route = reviewRouteStore ? reviewRouteStore.currentStage(id) : { ok: true, stage: null };
    return route.ok ? { ok: true, stage: Math.max(verification.stage || 0, certification.stage || 0, route.stage || 0) || null } : route;
  };
  let scopeStore = LCA.scope.createStore(projects, undefined, () => researcherStore.list(), (id) => requestStore.list(id), (id) => modellingStore.load(id), (id) => interpretationStore.load(id), verificationStage);
  let scopeLoadResult = scopeStore.load();
  const modellingStore = LCA.modelling.createStore(projects, undefined, (id) => requestStore.list(id), (id) => {
    const loaded = scopeStore.load();
    if (!loaded.ok) return loaded;
    const project = projects.find((item) => item.id === id);
    return project ? { ok: true, project } : { ok: false, error: '프로젝트를 찾을 수 없어요.' };
  });
  const interpretationStore = LCA.interpretation.createStore(projects, (id) => modellingStore.load(id));
  const reportStore = LCA.report.createStore(projects, (id) => interpretationStore.load(id), undefined, (id) => customerReviewStore.list(id));
  const customerReviewStore = LCA.customerReview.createStore(projects, (id) => reportStore.load(id), (id) => {
    const loaded = scopeStore.load();
    if (!loaded.ok) return loaded;
    const project = projects.find((item) => item.id === id);
    return project ? { ok: true, project } : { ok: false, error: '프로젝트를 찾을 수 없어요.' };
  });
  verificationStore = LCA.verification.createStore(projects, (id) => {
    const loaded = scopeStore.load();
    if (!loaded.ok) return loaded;
    const project = projects.find((item) => item.id === id);
    return project ? { ok: true, project } : { ok: false, error: '프로젝트를 찾을 수 없어요.' };
  }, (id) => reportStore.load(id), (id) => customerReviewStore.list(id), undefined, (id) => reviewRouteStore.load(id));
  reviewRouteStore = LCA.reviewRoute.createStore(projects, (id) => {
    const loaded = scopeStore.load(); if (!loaded.ok) return loaded;
    const project = projects.find((item) => item.id === id);
    return project ? { ok: true, project } : { ok: false, error: '프로젝트를 찾을 수 없어요.' };
  }, (id) => reportStore.load(id), (id) => customerReviewStore.list(id), (id) => verificationStore.snapshot(id));
  certificationStore = LCA.certification.createStore(projects, (id) => {
    const loaded = scopeStore.load(); if (!loaded.ok) return loaded;
    const project = projects.find((item) => item.id === id);
    return project ? { ok: true, project } : { ok: false, error: '프로젝트를 찾을 수 없어요.' };
  }, (id) => reportStore.load(id), (id) => verificationStore.load(id), undefined, (id) => reviewRouteStore.load(id));
  scopeLoadResult = scopeStore.load();
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
  const tasksView = document.querySelector('#tasks-view');
  const homeView = document.querySelector('#home-view');
  const settingsView = document.querySelector('#settings-view');
  let dashboardPage = null;
  let taskReturn = null;
  let homeReturn = null;
  let listScrollY = 0;
  let detailOpener = null;
  let projectView = listView;
  let projectPageTitle = '프로젝트 목록 | LCA 프로젝트 관리';
  let projectScrollY = 0;

  function setPage(label, title, section) {
    document.querySelector('#current-view-label').textContent = label;
    document.title = title;
    for (const name of ['home', 'project', 'glossary', 'researcher', 'tasks', 'settings']) {
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
      const latest = new Map(result.items.map((project) => [project.id, project]));
      projects.forEach((project) => {
        const saved = latest.get(project.id);
        if (saved) Object.assign(project, LCA.projects.basicSnapshot(saved), { collectionDueDate: saved.collectionDueDate, basicRevision: saved.basicRevision });
      });
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
  function getRequestMessageState(id) {
    const loaded = refreshCollectionDates(); if (!loaded.ok) return loaded;
    if (loaded.items.length !== projects.length || loaded.items.some((p) => !projects.some((known) => known.id === p.id))) return { ok: false, error: '프로젝트 명단이 바뀌었어요. 작성 중인 내용을 보관하고 새로고침해 주세요.' };
    scopeLoadResult = scopeStore.load(); if (!scopeLoadResult.ok) return scopeLoadResult;
    const project = projects.find((p) => p.id === id); if (!project) return { ok: false, error: '프로젝트를 찾을 수 없어요.' };
    const requests = requestStore.list(id);
    const roster = researcherStore.list(); if (!roster.ok) return roster;
    const sender = roster.items.find((person) => person.id === project.researcherId) || null;
    return requests.ok ? { ok: true, project, sender, items: requests.items, canGenerate: requests.canWrite, reason: requests.readOnlyReason } : { ok: false, error: requests.message };
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
  function getWorkflowState() {
    const loadedProjects = refreshCollectionDates();
    if (!loadedProjects.ok) return { ok: false, error: loadedProjects.error };
    if (loadedProjects.items.length !== projects.length || loadedProjects.items.some((p) => !projects.some((known) => known.id === p.id))) {
      return { ok: false, error: '다른 화면에서 프로젝트 명단이 바뀌었어요. 작성 중인 내용을 저장한 뒤 페이지를 새로고침해 주세요.' };
    }
    scopeLoadResult = scopeStore.load(); showScopeStorageStatus();
    if (!scopeLoadResult.ok) return { ok: false, error: scopeLoadResult.error };
    const requests = requestStore.listAll();
    const tasks = LCA.tasks.build({ projects, requests, comments: customerReviewStore.snapshot(),
      verifications: Object.fromEntries(projects.filter((p) => p.stage < 10).map((p) => [p.id, verificationStore.snapshot(p.id)])) });
    return { ok: true, projects, requests, tasks };
  }
  function getTaskState() {
    const state = getWorkflowState(); return state.ok ? state.tasks : state;
  }
  function openTask(id, opener, origin = 'tasks') {
    const current = getTaskState(); const task = current.ok && current.items.find((item) => item.id === id);
    if (!task) return { ok: false, error: current.error || '이 할 일은 처리됐거나 기록이 바뀌었어요. 최신 목록을 확인해 주세요.' };
    const back = { id, scrollY: window.scrollY }; const savedListScroll = listScrollY;
    if (projectView === detailView && openedProjectId === task.projectId) {
      tasksView.hidden = true; homeView.hidden = true; detailView.hidden = false; setPage('프로젝트 상세', projectPageTitle, 'project');
      LCA.views.projectDetail.refreshScope(projects.find((item) => item.id === task.projectId));
      LCA.views.projectDetail.refreshStage(projects.find((item) => item.id === task.projectId));
    } else { showDetail(task.projectId, opener); listScrollY = savedListScroll; }
    if (origin === 'home') {
      taskReturn = null; homeReturn = { ...back, kind: 'task' }; document.querySelector('#back-to-projects').textContent = '← 홈으로';
    } else {
      homeReturn = null; taskReturn = back; document.querySelector('#back-to-projects').textContent = '← 할 일로';
    }
    selectDetailTab(task.tab, true);
    if (task.requestId) LCA.views.requests.focus(task.requestId);
    else if (task.commentId) LCA.views.customerReview.focus(task.commentId);
    else if (task.issueId) LCA.views.verification.focus(task.issueId);
    else { document.querySelector('#project-detail-title').focus({ preventScroll: true }); window.scrollTo(0, 0); }
    return { ok: true };
  }
  const tasksPage = LCA.views.tasks.init(getTaskState, openTask);
  dashboardPage = LCA.views.dashboard.init(() => {
    const state = getWorkflowState(); return state.ok ? LCA.dashboard.build(state) : state;
  }, () => openTasks(), (id, opener) => {
    const back = { id, scrollY: window.scrollY }; const savedListScroll = listScrollY;
    if (projectView === detailView && openedProjectId === id) {
      homeView.hidden = true; detailView.hidden = false; setPage('프로젝트 상세', projectPageTitle, 'project');
      const project = projects.find((item) => item.id === id); LCA.views.projectDetail.refreshScope(project); LCA.views.projectDetail.refreshStage(project);
    } else { showDetail(id, opener); listScrollY = savedListScroll; }
    taskReturn = null; homeReturn = back; document.querySelector('#back-to-projects').textContent = '← 홈으로';
    selectDetailTab('overview', true); window.scrollTo(0, 0);
  }, (id, opener) => openTask(id, opener, 'home'));
  dashboardPage.refresh();
  setPage('홈', '홈 | LCA 프로젝트 관리', 'home');
  document.querySelector('#new-project').disabled = !projectLoadResult.ok;
  LCA.views.projectCreate.init(projectStore, (result) => {
    // 범위가 반영되기 전의 기본 명단으로 저장소를 연결한 뒤 저장된 범위를 읽는다.
    projects.splice(0, projects.length, ...result.items);
    scopeStore = LCA.scope.createStore(projects, undefined, () => researcherStore.list(), (id) => requestStore.list(id), (id) => modellingStore.load(id), (id) => interpretationStore.load(id), verificationStage);
    scopeLoadResult = scopeStore.load();
    showScopeStorageStatus();
    requestStore = LCA.requests.createStore(projects.map((project) => project.id), undefined, (id) => scopeStore.currentStage(id));
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

  const deletionPage = LCA.views.projectDeletion.init(sampleDate, (result) => {
    // 새 명단으로 모든 저장소의 참조를 연결한 뒤 현재 창의 쓰기를 다시 연다.
    projects.splice(0, projects.length, ...result.items);
    scopeStore = LCA.scope.createStore(projects, undefined, () => researcherStore.list(), (id) => requestStore.list(id), (id) => modellingStore.load(id), (id) => interpretationStore.load(id), verificationStage);
    requestStore = LCA.requests.createStore(projects.map((p) => p.id), undefined, (id) => scopeStore.currentStage(id));
    LCA.storage.resumeReplacement(result.epoch);
    taskReturn = null; homeReturn = null; detailOpener = null; openedProjectId = null;
    document.querySelector('#back-to-projects').textContent = '← 목록으로';
    if (!detailView.hidden) showList();
    else {
      scopeLoadResult = scopeStore.load(); showScopeStorageStatus();
      LCA.views.stageFilter.render(projects); showStage(selectedStage);
    }
    dashboardPage.refresh(); tasksPage.refresh(); researcherPage.refresh();
    const message = document.querySelector('#project-create-status');
    message.textContent = `${result.project.companyName} · ${result.project.code} 프로젝트와 관련 기록을 삭제했어요.`;
    message.tabIndex = -1; message.focus({ preventScroll: true });
  }, showStorageReload);
  detailView.addEventListener('click', (event) => {
    const button = event.target.closest('[data-delete-project]');
    if (button) deletionPage.open(button.dataset.deleteProject, button);
  });

  const basicPage = LCA.views.projectBasic.init(projectStore, (id, result) => {
    const project = projects.find((p) => p.id === id); if (!project) return;
    Object.assign(project, result.basic, { basicRevision: result.revision });
    scopeLoadResult = scopeStore.load(); showScopeStorageStatus(); renderProjectList();
    if (openedProjectId === id) {
      LCA.views.projectDetail.refreshBasics(project);
      const intro = detailView.querySelector('.request-intro'); if (intro) intro.textContent = `${project.companyName}의 ${project.productName} 평가에 필요한 자료를 적어 두는 목록이에요.`;
      LCA.views.report.refreshBasics();
      projectPageTitle = `${project.companyName} 상세 | LCA 프로젝트 관리`;
      if (!detailView.hidden) setPage('프로젝트 상세', projectPageTitle, 'project');
    }
    dashboardPage.refresh(); tasksPage.refresh(); researcherPage.refresh();
    const message = document.querySelector('#project-basic-status'); message.textContent = '기본정보를 저장하고 변경 전후 내용과 시각을 이력에 남겼어요.'; message.tabIndex = -1; message.focus({ preventScroll: true });
  });
  detailView.addEventListener('click', (event) => {
    const button = event.target.closest('[data-edit-project-basic]');
    if (button) basicPage.open(button.dataset.editProjectBasic, button);
  });

  document.querySelector('#stage-filters').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-stage]');
    if (!button) return;
    const stageNo = Number(button.dataset.stage);
    showStage(selectedStage === stageNo ? null : stageNo);
  });
  document.querySelector('#all-stages').addEventListener('click', () => showStage(null));

  function showDetail(projectId, opener) {
    document.querySelector('#project-basic-status').textContent = '';
    taskReturn = null;
    homeReturn = null;
    document.querySelector('#back-to-projects').textContent = '← 목록으로';
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
    LCA.views.requests.init(project, requestStore, refreshRequestViews, () => getRequestMessageState(project.id));
    listView.hidden = true;
    glossaryView.hidden = true;
    researcherView.hidden = true;
    tasksView.hidden = true;
    homeView.hidden = true;
    settingsView.hidden = true;
    detailView.hidden = false;
    projectView = detailView;
    projectPageTitle = `${project.companyName} 상세 | LCA 프로젝트 관리`;
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
        LCA.views.requests.init(project, requestStore, refreshRequestViews, () => getRequestMessageState(project.id));
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
      LCA.views.verification.refresh(); LCA.views.certification.refresh();
    });
    function refreshLaterStage() {
      LCA.views.deadlines.refresh();
      LCA.views.projectDetail.refreshStage(project);
      LCA.views.requests.refresh();
      bindCollectionTransition(project);
      LCA.views.stageFilter.render(projects);
      showStage(selectedStage);
      LCA.views.modelling.refresh();
      LCA.views.interpretation.refresh();
      LCA.views.report.refresh();
      LCA.views.customerReview.refresh();
      LCA.views.verification.refresh(); LCA.views.certification.refresh();
    }
    LCA.views.interpretation.init(project, interpretationStore, scopeStore, refreshLaterStage, () => { LCA.views.report.refresh(); LCA.views.verification.refresh(); LCA.views.certification.refresh(); });
    LCA.views.report.init(project, reportStore, scopeStore, refreshLaterStage, customerReviewStore, (id) => {
      selectDetailTab('comments', true); LCA.views.customerReview.focus(id);
    }, () => { LCA.views.customerReview.refresh(); LCA.views.verification.refresh(); LCA.views.certification.refresh(); });
    LCA.views.customerReview.init(project, customerReviewStore, () => { LCA.views.report.refresh(); LCA.views.verification.refresh(); LCA.views.certification.refresh(); }, (revision) => {
      selectDetailTab('report', true); LCA.views.report.selectVersion(revision);
    });
    LCA.views.verification.init(project, verificationStore, refreshLaterStage, (revision) => {
      selectDetailTab('report', true); LCA.views.report.selectVersion(revision);
    }, () => selectDetailTab('comments', true));
    LCA.views.reviewRoute.init(project, reviewRouteStore, refreshLaterStage, (revision) => {
      selectDetailTab('report', true); LCA.views.report.selectVersion(revision);
    });
    LCA.views.certification.init(project, certificationStore, refreshLaterStage, (revision) => {
      selectDetailTab('report', true); LCA.views.report.selectVersion(revision);
    }, () => selectDetailTab('verification', true));
  }
  function refreshRequestViews(result) {
    LCA.views.collectionTransition.refresh(result);
    LCA.views.modelling.refresh();
    LCA.views.interpretation.refresh();
    LCA.views.report.refresh();
    LCA.views.customerReview.refresh();
    LCA.views.verification.refresh(); LCA.views.certification.refresh();
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
    });
  }

  function showList() {
    if (detailView.hidden) return;
    if (homeReturn) { const back = homeReturn; homeReturn = null; document.querySelector('#back-to-projects').textContent = '← 목록으로'; openHome(back); return; }
    if (taskReturn) { const back = taskReturn; taskReturn = null; document.querySelector('#back-to-projects').textContent = '← 목록으로'; openTasks(back); return; }
    detailView.hidden = true;
    listView.hidden = false;
    projectView = listView;
    projectPageTitle = '프로젝트 목록 | LCA 프로젝트 관리';
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
    const remove = event.target.closest('button[data-delete-project]');
    if (remove) { deletionPage.open(remove.dataset.deleteProject, remove); return; }
    const button = event.target.closest('button[data-open-project]');
    if (button) showDetail(button.dataset.openProject, button);
  });
  function selectDetailTab(key, focus = false) {
    LCA.views.collectionTransition.refresh();
    LCA.views.modelling.refresh();
    LCA.views.interpretation.refresh();
    LCA.views.report.refresh();
    LCA.views.customerReview.refresh();
    LCA.views.verification.refresh(); LCA.views.certification.refresh();
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
    if (glossaryView.hidden && researcherView.hidden && tasksView.hidden && homeView.hidden && settingsView.hidden) {
      taskReturn = null;
      homeReturn = null;
      showList();
      return;
    }
    glossaryView.hidden = true;
    researcherView.hidden = true;
    tasksView.hidden = true;
    homeView.hidden = true;
    settingsView.hidden = true;
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
      if (researcherView.hidden && tasksView.hidden && homeView.hidden && settingsView.hidden) projectScrollY = window.scrollY;
      listView.hidden = true;
      detailView.hidden = true;
      researcherView.hidden = true;
      tasksView.hidden = true;
      homeView.hidden = true;
      settingsView.hidden = true;
      glossaryView.hidden = false;
      setPage('용어사전', '용어사전 | LCA 프로젝트 관리', 'glossary');
    }
    document.querySelector('#glossary-search').focus({ preventScroll: true });
    window.scrollTo(0, 0);
  });
  function openResearchers(id = null) {
    if (researcherView.hidden && glossaryView.hidden && tasksView.hidden && homeView.hidden && settingsView.hidden) projectScrollY = window.scrollY;
    listView.hidden = true;
    detailView.hidden = true;
    glossaryView.hidden = true;
    tasksView.hidden = true;
    homeView.hidden = true;
    settingsView.hidden = true;
    researcherView.hidden = false;
    setPage('담당 연구원', '담당 연구원 | LCA 프로젝트 관리', 'researcher');
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
  function openTasks(back = null) {
    if (tasksView.hidden && glossaryView.hidden && researcherView.hidden && homeView.hidden && settingsView.hidden) projectScrollY = window.scrollY;
    listView.hidden = true; detailView.hidden = true; glossaryView.hidden = true; researcherView.hidden = true; homeView.hidden = true; settingsView.hidden = true; tasksView.hidden = false;
    setPage('할 일', '할 일 | LCA 프로젝트 관리', 'tasks'); tasksPage.refresh();
    if (back) { tasksPage.focus(back.id); window.scrollTo(0, back.scrollY); }
    else { document.querySelector('#tasks-title').focus({ preventScroll: true }); window.scrollTo(0, 0); }
  }
  document.querySelector('#tasks-navigation').addEventListener('click', (event) => { event.preventDefault(); openTasks(); });
  function openHome(back = null) {
    if (homeView.hidden && tasksView.hidden && glossaryView.hidden && researcherView.hidden && settingsView.hidden) projectScrollY = window.scrollY;
    listView.hidden = true; detailView.hidden = true; glossaryView.hidden = true; researcherView.hidden = true; tasksView.hidden = true; settingsView.hidden = true; homeView.hidden = false;
    setPage('홈', '홈 | LCA 프로젝트 관리', 'home'); dashboardPage.refresh();
    if (back) { dashboardPage.focus(back.id, back.kind); window.scrollTo(0, back.scrollY); }
    else { document.querySelector('#home-title').focus({ preventScroll: true }); window.scrollTo(0, 0); }
  }
  document.querySelector('#home-navigation').addEventListener('click', (event) => { event.preventDefault(); openHome(); });
  document.querySelector('#brand-home').addEventListener('click', (event) => { event.preventDefault(); openHome(); });
  document.querySelector('#settings-navigation').addEventListener('click', (event) => {
    event.preventDefault();
    if (homeView.hidden && tasksView.hidden && glossaryView.hidden && researcherView.hidden && settingsView.hidden) projectScrollY = window.scrollY;
    listView.hidden = true; detailView.hidden = true; glossaryView.hidden = true; researcherView.hidden = true; tasksView.hidden = true; homeView.hidden = true; settingsView.hidden = false;
    setPage('설정', '설정 | LCA 프로젝트 관리', 'settings'); document.querySelector('#settings-title').focus({ preventScroll: true }); window.scrollTo(0, 0);
  });
  window.addEventListener('storage', () => {
    if (!tasksView.hidden) tasksPage.refresh();
    else if (!homeView.hidden) dashboardPage.refresh();
  });
  // 날짜만 갱신한다. 입력 중인 폼이나 선택한 필터를 다시 만들지 않는다.
  function refreshDates() {
    updateReferenceDate(LCA.rules.today());
    LCA.views.deadlines.refresh();
    if (!tasksView.hidden) tasksPage.refresh();
    else if (!homeView.hidden) dashboardPage.refresh();
  }
  window.setInterval(refreshDates, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshDates(); });
  window.addEventListener('pageshow', refreshDates);
})();
