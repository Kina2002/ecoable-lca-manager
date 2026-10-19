window.LCA = window.LCA || {};
LCA.views = LCA.views || {};
LCA.views.dashboard = (() => {
  function text(tag, className, value) { const node = document.createElement(tag); node.className = className; node.textContent = value; return node; }
  function init(getState, onTasks, onProject, onTask) {
    const host = document.querySelector('#home-dashboard'); let stateKey = ''; let attentionExpanded = false; let tasksExpanded = false;
    const controls = text('div', 'dashboard-controls', '');
    const label = text('label', '', '담당 연구원'); label.htmlFor = 'home-researcher';
    const people = document.createElement('select'); people.id = 'home-researcher'; people.setAttribute('aria-controls', 'home-dashboard-summary');
    const reset = text('button', 'request-action-button', '전체 연구원'); reset.type = 'button';
    controls.append(label, people, reset);
    const summary = text('div', '', ''); summary.id = 'home-dashboard-summary';
    const error = text('p', 'form-error', ''); error.setAttribute('role', 'alert'); error.hidden = true;
    const metrics = text('div', 'dashboard-metrics', '');
    const basis = text('p', 'dashboard-basis', '');
    const panels = text('div', 'dashboard-panels', '');
    const attention = text('section', 'dashboard-panel', ''); attention.setAttribute('aria-labelledby', 'dashboard-attention-title');
    const attentionTitle = text('h2', '', '확인이 필요한 프로젝트'); attentionTitle.id = 'dashboard-attention-title';
    const attentionCount = text('p', 'detail-help', ''); const attentionList = text('ul', 'dashboard-list', '');
    const attentionMore = text('button', 'request-action-button', '더 보기'); attentionMore.type = 'button';
    attentionList.id = 'home-attention-list'; attentionMore.setAttribute('aria-controls', attentionList.id);
    attentionMore.addEventListener('click', () => { attentionExpanded = !attentionExpanded; refresh(); });
    attention.append(attentionTitle, attentionCount, attentionList, attentionMore);
    const tasks = text('section', 'dashboard-panel', ''); tasks.setAttribute('aria-labelledby', 'dashboard-tasks-title');
    const taskHeading = text('div', 'dashboard-heading', ''); const taskTitle = text('h2', '', '먼저 처리할 일'); taskTitle.id = 'dashboard-tasks-title';
    const more = text('button', 'request-action-button', '할 일 전체 보기'); more.type = 'button'; more.addEventListener('click', onTasks); taskHeading.append(taskTitle, more);
    const taskCount = text('p', 'detail-help', ''); const taskList = text('ul', 'dashboard-list', '');
    const taskMore = text('button', 'request-action-button', '더 보기'); taskMore.type = 'button';
    taskList.id = 'home-task-list'; taskMore.setAttribute('aria-controls', taskList.id);
    taskMore.addEventListener('click', () => { tasksExpanded = !tasksExpanded; refresh(); });
    const taskFeedback = text('p', 'field-error', ''); taskFeedback.setAttribute('role', 'alert'); tasks.append(taskHeading, taskCount, taskFeedback, taskList, taskMore);
    panels.append(attention, tasks); summary.append(error, metrics, basis, panels); host.append(controls, summary);
    people.addEventListener('change', refresh); reset.addEventListener('click', () => { people.value = ''; refresh(); });
    function metric(label, value, help, progress = null) {
      const card = text('section', 'dashboard-metric', ''); card.append(text('h3', '', label), text('p', 'dashboard-number', value));
      if (progress !== null) { const bar = document.createElement('progress'); bar.max = 100; bar.value = progress; bar.setAttribute('aria-label', `${label} ${progress}%`); card.append(bar); }
      card.append(text('p', 'dashboard-metric-help', help)); return card;
    }
    function refresh() {
      let state; try { state = getState(people.value); } catch { state = { ok: false, error: '대시보드 기록을 읽지 못했어요. 저장된 데이터는 변경하지 않았어요.' }; }
      const key = JSON.stringify([people.value, attentionExpanded, tasksExpanded, state]); if (key === stateKey) return; stateKey = key;
      const focused = host.contains(document.activeElement) ? document.activeElement.dataset.dashboardProject : null;
      const focusedTask = host.contains(document.activeElement) ? document.activeElement.dataset.dashboardTask : null;
      metrics.replaceChildren(); attentionList.replaceChildren(); taskList.replaceChildren();
      panels.hidden = !state.ok; basis.hidden = !state.ok;
      error.hidden = state.ok && !state.warnings.length;
      error.textContent = state.ok ? state.warnings.join(' ') : state.error;
      if (!state.ok) return;
      const selected = people.value;
      const options = state.researcherOptions.slice();
      if (selected && !options.some(([id]) => id === selected)) options.push([selected, '이전 선택 연구원 · 현재 담당 없음']);
      people.replaceChildren(...options.map(([id, name]) => { const option = text('option', '', name); option.value = id; return option; }));
      people.value = selected; reset.disabled = !selected;
      const collection = state.collection; const approval = state.approval;
      metrics.append(metric('진행 프로젝트', `${state.activeCount}개`, '완료·사후관리 단계 제외'),
        metric('자료 수집률', state.requestsOk ? collection.percent === null ? '—' : `${collection.percent}%` : '확인 필요',
          state.requestsOk ? collection.total ? `등록 요청 ${collection.total}건 중 ${collection.received}건 받음 · 보완 자료 포함` : '등록된 자료 요청이 없어요.' : '자료 요청 기록을 읽지 못했어요.', collection.percent),
        metric('자료 승인률', state.requestsOk ? approval.percent === null ? '—' : `${approval.percent}%` : '확인 필요',
          state.requestsOk ? approval.total ? `받은 자료 ${approval.total}건 중 ${approval.approved}건 승인` : '받은 자료가 없어요.' : '자료 요청 기록을 읽지 못했어요.', approval.percent),
        metric('확인 필요 프로젝트', `${state.attentionCount}개`, state.warnings.length ? '확인 가능한 기록 기준 · 아래 안내 확인' : '기한·자료·의견·사후관리 확인 필요'),
        metric('완료 프로젝트', `${state.completedCount}개`, `선택한 연구원의 전체 ${state.projectCount}개 중 완료·사후관리`));
      basis.textContent = `${state.today} 기준 · ${state.researcherLabel}의 진행 프로젝트 지표예요. 갱신·연간 점검은 완료 프로젝트도 포함해요. 프로젝트·할 일 탭의 필터와 별개예요. 비율은 프로젝트 전체 진행률이 아니에요.${state.requestsOk ? ` 자료 요청이 등록된 프로젝트 ${state.registeredProjects}/${state.activeCount}개.` : ''}`;
      const attentionItems = attentionExpanded ? state.allAttention : state.attention;
      attentionMore.hidden = state.attentionCount <= 3; attentionMore.textContent = attentionExpanded ? '3개만 보기' : `나머지 ${state.attentionCount - 3}개 더 보기`; attentionMore.setAttribute('aria-expanded', String(attentionExpanded));
      attentionCount.textContent = `${state.warnings.length ? '확인 가능한 기록에서 ' : ''}${state.attentionCount}개 중 ${attentionItems.length}개 표시 · 목표일·수집 마감과 할 일 기록 기준`;
      for (const item of attentionItems) {
        const row = document.createElement('li'); const button = text('button', 'dashboard-project', `${item.companyName} (가상) · ${item.code}`);
        button.type = 'button'; button.dataset.dashboardProject = item.id; button.addEventListener('click', () => onProject(item.id, button));
        row.append(button, text('p', 'detail-help', `${item.productName} · 담당 ${item.researcherName || '미정'} · ${LCA.constants.stageByNo(item.stage)?.name || '단계 확인 필요'}`), text('p', 'dashboard-reasons', item.reasons.join(' · '))); attentionList.append(row);
      }
      if (!state.attention.length) attentionList.append(text('li', 'detail-help', state.warnings.length ? '확인 가능한 기록에는 확인이 필요한 프로젝트가 없어요. 읽지 못한 기록은 위 안내를 확인해 주세요.' : '현재 기준으로 확인이 필요한 프로젝트가 없어요.'));
      const taskItems = tasksExpanded ? state.allTasks : state.tasks;
      taskMore.hidden = state.taskCount <= 3; taskMore.textContent = tasksExpanded ? '3건만 보기' : `나머지 ${state.taskCount - 3}건 더 보기`; taskMore.setAttribute('aria-expanded', String(tasksExpanded));
      taskCount.textContent = `${state.warnings.length ? '확인 가능한 ' : ''}할 일 ${state.taskCount}건 중 ${taskItems.length}건 표시 · 할 일 탭과 같은 순서`;
      for (const item of taskItems) {
        const row = document.createElement('li'); const button = text('button', 'dashboard-project dashboard-task-title', item.title);
        button.type = 'button'; button.dataset.dashboardTask = item.id; button.setAttribute('aria-label', `${item.companyName} ${item.code} · ${item.title} 보기`);
        button.addEventListener('click', () => {
          taskFeedback.textContent = ''; const result = onTask(item.id, button);
          if (!result.ok) { refresh(); taskFeedback.textContent = result.error; taskFeedback.tabIndex = -1; taskFeedback.focus(); }
        });
        const due = LCA.tasks.deadline(item);
        row.append(text('span', `task-kind task-kind-${item.kind}`, LCA.tasks.KINDS[item.kind]), button,
          text('span', `home-task-deadline task-deadline-${due.tone}`, due.text),
          text('p', 'detail-help', `${item.companyName} (가상) · ${item.code} · ${due.label}${due.detail ? ` ${due.detail}` : ''}`)); taskList.append(row);
      }
      if (!state.tasks.length) taskList.append(text('li', 'detail-help', state.warnings.length ? '확인 가능한 기록에는 할 일이 없어요. 읽지 못한 기록은 위 안내를 확인해 주세요.' : '현재 규칙에 해당하는 할 일이 없어요.'));
      if (focused || focusedTask) {
        const target = [...host.querySelectorAll('[data-dashboard-project], [data-dashboard-task]')].find((node) => focusedTask ? node.dataset.dashboardTask === focusedTask : node.dataset.dashboardProject === focused) || more;
        target.focus({ preventScroll: true });
      }
    }
    return { refresh, focus(id, kind = 'project') {
      const target = [...host.querySelectorAll('[data-dashboard-project], [data-dashboard-task]')].find((node) => kind === 'task' ? node.dataset.dashboardTask === id : node.dataset.dashboardProject === id) || document.querySelector('#home-title');
      target.focus({ preventScroll: true });
    } };
  }
  return { init };
})();
