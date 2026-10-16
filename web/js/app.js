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
  LCA.views.projectList.render(projects);
})();
