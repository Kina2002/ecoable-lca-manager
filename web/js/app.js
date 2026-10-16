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
  let selectedStage = null; // null은 '전체 보기'라는 뜻이다. 새로고침하면 전체로 돌아온다.
  const listView = document.querySelector('#project-list-view');
  const detailView = document.querySelector('#project-detail-view');
  let listScrollY = 0;
  let detailOpener = null;

  function showStage(stageNo) {
    selectedStage = stageNo;
    const visibleProjects = LCA.rules.projectsForStage(projects, selectedStage);
    LCA.views.projectList.render(visibleProjects, selectedStage, projects.length);
    LCA.views.stageFilter.select(selectedStage);
  }

  // 위의 건수는 전체 명단에서 만들고, 아래 목록만 선택한 조건으로 거른다.
  LCA.views.stageFilter.render(projects);
  showStage(null);

  document.querySelector('#stage-filters').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-stage]');
    if (!button) return;
    const stageNo = Number(button.dataset.stage);
    showStage(selectedStage === stageNo ? null : stageNo);
  });
  document.querySelector('#all-stages').addEventListener('click', () => showStage(null));

  function showDetail(projectId, opener) {
    // 행의 위치가 아니라 고정 ID로 찾는다. 필터 후에도 다른 업무와 혼동하지 않는다.
    const project = projects.find((item) => item.id === projectId);
    if (!project) return;
    listScrollY = window.scrollY;
    detailOpener = opener;
    LCA.views.projectDetail.render(project);
    listView.hidden = true;
    detailView.hidden = false;
    document.querySelector('#current-view-label').textContent = '프로젝트 상세';
    document.title = `${project.companyName} 상세 | 에코에이블 LCA 관리`;
    document.querySelector('#project-detail-title').focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }

  function showList() {
    if (detailView.hidden) return;
    detailView.hidden = true;
    listView.hidden = false;
    document.querySelector('#current-view-label').textContent = '프로젝트';
    document.title = '프로젝트 목록 | 에코에이블 LCA 관리';
    // 목록을 다시 만들지 않고 펼쳐, 선택한 단계·키보드 초점·스크롤 위치를 이어 간다.
    if (detailOpener && detailOpener.isConnected) detailOpener.focus({ preventScroll: true });
    window.scrollTo(0, listScrollY);
  }

  document.querySelector('#project-rows').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-open-project]');
    if (button) showDetail(button.dataset.openProject, button);
  });
  document.querySelector('#back-to-projects').addEventListener('click', showList);
  document.querySelector('#project-navigation').addEventListener('click', (event) => {
    event.preventDefault();
    showList();
  });
})();
