window.LCA = window.LCA || {};
LCA.views = LCA.views || {};
LCA.views.certification = (() => {
  let refreshCurrent = () => {};
  const { text, field, option, date } = LCA.views.verificationIssue;
  function init(project, store, onChanged, onOpenReport, onOpenVerification) {
    const host = document.querySelector('#project-certification-panel');
    const intro = text('section', 'detail-card calculation-card', '');
    intro.append(text('h2', '', '검토·검증 완료와 후속 제출'), text('p', 'detail-help', '선택한 내부 검토 또는 외부 검토의 최종 보고서와 완료 근거를 보관하고, 프로젝트 목적에 맞는 인증·등록 또는 고객 제출을 기록해요. 내부 검토를 완료했다고 외부 검증이나 인증을 받은 것은 아니에요.'));
    const notice = text('p', 'calculation-notice', ''); notice.setAttribute('role', 'status');
    const toVerification = text('button', 'request-action-button', '검토 방식·확인 기록 보기'); toVerification.type = 'button'; toVerification.addEventListener('click', onOpenVerification);
    intro.append(notice, toVerification);
    const completionCard = text('section', 'detail-card calculation-card', ''); completionCard.append(text('h2', '', '검토·검증 완료 기록'));
    const completionInfo = text('div', '', '');
    const completionForm = document.createElement('form'); completionForm.noValidate = true;
    const completionFields = document.createElement('fieldset'); completionFields.className = 'calculation-fields'; completionFields.append(text('legend', '', '최종 보고서와 검토·검증 완료 근거'));
    const completedOn = dateField(completionFields, 'certification-completed-on', '검증 완료일 (필수 · 연월일 8자리)');
    const documentName = field(completionFields, 'certification-document-name', '검증 결과 문서 이름 (필수 · 파일 이름만 기록)', 'input', 200);
    const completionActor = field(completionFields, 'certification-completion-actor', '완료 기록 담당자 (필수)'); completionActor.value = project.researcherName || '';
    LCA.views.inputAssist.person(completionActor, project);
    const completionReason = field(completionFields, 'certification-completion-reason', '검증 완료 확인 근거 (필수)', 'textarea', 1000);
    const completionCheck = checkbox(completionFields, '최종 보고서와 모든 지적의 종결, 검증기관의 완료 근거를 확인했어요.');
    const completionSave = text('button', 'primary-button', '검증 완료 기록 보관'); completionSave.type = 'submit';
    const completionError = text('p', 'field-error', ''); completionError.setAttribute('role', 'alert');
    completionForm.append(completionFields, completionSave, completionError);
    completionCard.append(completionInfo, LCA.views.compact.form(completionForm, '검토·검증 완료 근거 입력'), text('p', 'detail-help', '완료 기록을 보관해도 8단계에 머물러요. 보고서나 검토 기록을 보완하면 완료 근거를 다시 기록해 주세요. 보관한 이전 사본은 이력에 남아요.'));
    const processCard = text('section', 'detail-card calculation-card', ''); const processTitle = text('h2', '', '인증·등록 또는 고객 제출 시작'); processCard.append(processTitle);
    const processForm = document.createElement('form'); processForm.noValidate = true;
    const processFields = document.createElement('fieldset'); processFields.className = 'calculation-fields'; processFields.append(text('legend', '', '제출 진행 정보'));
    const status = field(processFields, 'certification-status', '진행 상태', 'select');
    const kind = field(processFields, 'certification-kind', '진행 유형 (필수)', 'select');
    for (const value of ['인증', '등록', '고객 제출']) option(kind, value, value);
    const organization = field(processFields, 'certification-organization', '제출기관·고객 (필수)', 'input', 200);
    const scheme = field(processFields, 'certification-scheme', '제도·제출 요구명 (필수)', 'input', 200);
    const schemeSuggestions = document.createElement('datalist'); schemeSuggestions.id = 'certification-scheme-suggestions';
    for (const name of Object.keys(LCA.certification.EXPIRY_SCHEMES)) option(schemeSuggestions, name, name);
    processFields.append(schemeSuggestions); scheme.setAttribute('list', schemeSuggestions.id);
    scheme.parentElement.append(text('p', 'detail-help', '예상 만료일을 보려면 환경성적표지·저탄소제품·International EPD·EPD Norway·UL EPD 중 해당 제도의 정확한 이름을 골라 주세요. 다른 요구명도 자유롭게 적을 수 있어요.'));
    const submittedOn = dateField(processFields, 'certification-submitted-on', '제출일 (제출 완료부터 필수)');
    const registrationNumber = field(processFields, 'certification-number', '인증·등록 번호 / 고객 접수·확인 번호 (승인·등록 시 필수)', 'input', 200);
    const issuedOn = dateField(processFields, 'certification-issued-on', '발급·확인일 (승인·등록 시 필수)');
    const expiryInfo = text('p', 'detail-note', ''); expiryInfo.setAttribute('role', 'status');
    const note = field(processFields, 'certification-note', '제출·보완·결과 메모 (선택)', 'textarea', 2000);
    const actor = field(processFields, 'certification-actor', '기록 담당자 (필수)'); actor.value = project.researcherName || '';
    LCA.views.inputAssist.person(actor, project);
    const reason = field(processFields, 'certification-reason', '확인 근거·변경 사유 (필수)', 'textarea', 1000);
    const startLabel = text('div', '', ''); const startCheck = checkbox(startLabel, '완료 근거를 확인했고 9단계로 이동할게요. 이동 후 이전 단계의 자료·계산·해석·보고서·검증은 읽기 전용이에요.'); processFields.append(startLabel);
    const processSave = text('button', 'primary-button', '인증·등록 준비 시작 · 9단계로'); processSave.type = 'submit';
    const processError = text('p', 'field-error', ''); processError.setAttribute('role', 'alert');
    processForm.append(processFields, processSave, processError);
    processCard.append(LCA.views.compact.form(processForm, '제출 정보 입력·상태 변경'), expiryInfo, text('p', 'detail-help', '제출 준비 → 제출 완료 → 보완 요청 → 재제출 또는 승인·등록/반려로 기록해요. 승인·등록과 반려 후에는 상태를 유지하며 오기 정정만 사유와 함께 남길 수 있어요. 앱 기록이 기관의 공식 결정을 대신하지 않아요.'));
    const validityCard = text('section', 'detail-card calculation-card', '');
    validityCard.append(text('h2', '', '인증서의 공식 만료일 기록'), text('p', 'detail-help', '발급 문서에 적힌 만료일을 확인해 기록해요. 저장하면 예상일 대신 이 날짜로 갱신 확인 시점을 계산해요. 완료 프로젝트도 입력할 수 있어요.'));
    const validityInfo = text('p', 'detail-note', '');
    const validityForm = document.createElement('form'); validityForm.noValidate = true;
    const validityFields = document.createElement('fieldset'); validityFields.className = 'calculation-fields';
    const expiryOn = dateField(validityFields, 'certification-official-expiry', '문서에 적힌 만료일 (필수)');
    const validityDocument = field(validityFields, 'certification-validity-document', '확인한 문서 이름 (필수 · 파일 이름만 기록)', 'input', 200);
    const validityActor = field(validityFields, 'certification-validity-actor', '확인 담당자 (필수)'); validityActor.value = project.researcherName || ''; LCA.views.inputAssist.person(validityActor, project);
    const validityReason = field(validityFields, 'certification-validity-reason', '확인 근거·정정 사유 (필수)', 'textarea', 1000);
    const validityCheck = checkbox(validityFields, '발급 문서의 만료일과 등록 번호를 직접 확인했어요.');
    const validitySave = text('button', 'primary-button', '공식 만료일 기록'); validitySave.type = 'submit';
    const validityError = text('p', 'field-error', ''); validityError.setAttribute('role', 'alert');
    validityForm.append(validityFields, validitySave, validityError); validityCard.append(validityInfo, LCA.views.compact.form(validityForm, '문서 만료일 입력'));
    const rebase = text('button', 'request-action-button', '최신 기준 다시 확인'); rebase.type = 'button';
    const finishCard = text('section', 'detail-card calculation-card', ''); finishCard.append(text('h2', '', '프로젝트 완료 처리'));
    const finishInfo = text('div', 'verification-round-info', ''); const finishBlock = text('p', 'detail-help', '');
    const finishForm = document.createElement('form'); finishForm.noValidate = true;
    const finishFields = document.createElement('fieldset'); finishFields.className = 'calculation-fields'; finishFields.append(text('legend', '', '최종 기록 확인'));
    const finishedOn = dateField(finishFields, 'project-finished-on', '프로젝트 완료일 (필수)'); finishedOn.value = LCA.rules.today();
    const finishActor = field(finishFields, 'project-finish-actor', '완료 기록 담당자 (필수)'); finishActor.value = project.researcherName || ''; LCA.views.inputAssist.person(finishActor, project);
    const finishReason = field(finishFields, 'project-finish-reason', '완료 확인 근거 (필수 · 불러온 내용 수정 가능)', 'textarea', 1000);
    const finishCheck = checkbox(finishFields, '최종 보고서와 인증·등록 또는 고객의 최종 확인 기록을 확인했어요. 프로젝트를 완료·사후관리 단계로 옮길게요.');
    const finishSave = text('button', 'primary-button', '프로젝트 완료 · 10단계로'); finishSave.type = 'submit';
    const finishError = text('p', 'field-error', ''); finishError.setAttribute('role', 'alert');
    finishForm.append(finishFields, finishSave, finishError); finishCard.append(finishInfo, finishBlock, LCA.views.compact.form(finishForm, '프로젝트 최종 완료 확인'),
      text('p', 'detail-help', '완료하면 진행 중 집계에서 빠지고 기록은 계속 조회할 수 있어요. 필요한 갱신 확인과 연간 점검 할 일은 계속 보여요. 아래 갱신 이력과 점검 결과도 계속 기록할 수 있어요.'));
    const feedback = text('p', '', ''); feedback.setAttribute('role', 'status');
    const history = text('section', 'detail-card calculation-card', ''); history.append(text('h2', '', '완료·제출 변경 이력')); const historyList = text('div', '', ''); history.append(historyList);
    const inspectionHost = document.createElement('div');
    const renewalHost = document.createElement('div');
    const statusHost = document.createElement('div');
    host.replaceChildren(intro, statusHost, completionCard, processCard, validityCard, renewalHost, inspectionHost, finishCard, rebase, feedback, history);
    let state; let busy = false; let dirty = false; let revision = 0; let basis = null; let formRevision = -1; let validityFormRevision = -1; let finishReasonAuto = '';
    const controls = { kind, organization, scheme, submittedOn, registrationNumber, issuedOn, note };
    function updateExpiry() {
      issuedOn.parentElement.querySelector('label').textContent = kind.value === '고객 제출' ? '고객 확인일 (최종 확인 시 필수)' : '인증·등록 발급일 (승인·등록 시 필수)';
      const sameRecord = state?.process && Object.entries({ kind, scheme, issuedOn, registrationNumber }).every(([key, input]) => input.value === state.process.details[key]);
      const schedule = LCA.certification.renewalSchedule({ kind: kind.value, scheme: scheme.value, issuedOn: issuedOn.value }, status.value,
        sameRecord ? state.validity?.expiryOn || '' : '');
      const dateLabel = schedule?.official ? '문서에서 확인한 만료일' : '입력된 정보 기준 예상 만료일';
      expiryInfo.textContent = schedule ? `${dateLabel} ${schedule.date} · ${schedule.scheme} · 발급일 ${schedule.issuedOn}. ${schedule.active ? schedule.days < 0 ? `${schedule.official ? '기록한' : '예상'} 만료일이 ${-schedule.days}일 지났어요. 현재 등록 상태와 갱신 여부를 확인해 주세요.` : `${schedule.label} 시기예요. 만료일까지 ${schedule.days}일 남았어요.` : `${schedule.label} 안내 시작 예정일은 ${schedule.startDate}이에요.`} ${schedule.official ? '기관의 최신 등록 상태도 확인해 주세요.' : '실제 유효기간은 발급 문서와 기관의 등록 기록을 확인해 주세요.'}`
        : kind.value === '고객 제출' ? '고객 제출의 확인일은 인증 만료일이 아니므로 계산하지 않아요.'
          : status.value !== '승인·등록' ? '인증·등록이 승인되고 발급일을 기록하면 예상 만료일을 볼 수 있어요.'
            : '예상 만료일을 계산하려면 진행 유형과 제도 이름(추천 목록의 정확한 이름), 올바른 발급일을 확인해 주세요.';
      if (sameRecord && state.cancelled) expiryInfo.textContent = `취소 확인 상태예요.${schedule ? ` 보관한 ${dateLabel} ${schedule.date}.` : ''} 갱신·점검 할 일 안내는 중단하며, 유효 회복 확인이나 새 공식 인증서의 갱신 완료를 기록해 주세요.`;
    }
    function adopt(loaded) {
      revision = loaded.record.revision;
      basis = loaded.latest && loaded.verification ? { reportRevision: loaded.latest.revision, sourceKey: loaded.latest.sourceKey, verificationRevision: loaded.verification.revision,
        reviewMethod: loaded.reviewMethod, reviewRevision: loaded.reviewRoute?.revision || 0 } : null;
    }
    function refresh() {
      state = store.load(project.id);
      if (!state.ok) { notice.textContent = state.error; completionFields.disabled = true; completionSave.disabled = true; processFields.disabled = true; processSave.disabled = true; validityFields.disabled = true; validitySave.disabled = true; finishFields.disabled = true; finishSave.disabled = true; LCA.views.inputAssist.sync(host); return; }
      if (!dirty) adopt(state);
      if (!dirty && state.record.revision !== formRevision) {
        if (state.process) {
          for (const [key, input] of Object.entries(controls)) input.value = state.process.details[key];
          actor.value = state.process.actor; reason.value = ''; startCheck.checked = false;
        }
        formRevision = state.record.revision;
      }
      const previousStatus = status.value;
      status.replaceChildren();
      for (const value of state.process ? LCA.certification.TRANSITIONS[state.process.status] : ['제출 준비']) option(status, value, value);
      if (dirty && previousStatus && ![...status.options].some((entry) => entry.value === previousStatus)) option(status, previousStatus, `${previousStatus} · 이전 기준 선택`);
      status.value = dirty && previousStatus ? previousStatus : state.process?.status || '제출 준비';
      const internal = state.reviewMethod === 'internal';
      const reviewLabel = internal ? '내부 검토' : state.reviewMethod === 'external' ? '외부 검토' : '검토·검증';
      completedOn.parentElement.querySelector('label').textContent = `${reviewLabel} 완료일 (필수 · 연월일 8자리)`;
      documentName.parentElement.querySelector('label').textContent = `${internal ? '내부 검토 확인 기록·문서 이름' : state.reviewMethod === 'external' ? '외부 검증 결과 문서 이름' : '완료 확인 기록·문서 이름'} (필수 · 이름만 기록)`;
      completionReason.parentElement.querySelector('label').textContent = `${reviewLabel} 완료 확인 근거 (필수)`;
      completionCheck.parentElement.lastChild.textContent = internal ? '최종 보고서와 내부 검토 완료 기록을 확인했어요.' : '최종 보고서와 모든 지적의 종결, 검증기관의 완료 근거를 확인했어요.';
      const stageHelp = state.project.stage < 8 ? '검토·검증(8)에서 선택한 경로의 검토를 마친 뒤 완료 근거를 기록해 주세요.' : state.project.stage > 9 ? '후속 단계에서는 보관 이력을 조회할 수 있어요.' : '';
      notice.textContent = state.warning || stageHelp || (state.process ? `현재 상태: ${state.process.status} · 최종 보고서 v${state.completion.report.revision}의 완료 근거로 진행 중이에요.` : state.startBlock || '완료 근거가 준비됐어요. 아래에서 목적에 맞는 제출 절차를 시작할 수 있어요.');
      if (dirty && revision !== state.record.revision) notice.textContent += ' 다른 화면에서 기록이 바뀌었어요. 입력은 유지했으니 최신 기준을 확인해 주세요.';
      completionInfo.replaceChildren();
      if (state.completion) {
        const saved = state.completion;
        completionInfo.append(text('p', 'detail-help', `보관 완료: ${saved.reviewMethod === 'internal' ? '내부 검토' : '외부 검토'} · ${saved.completedOn} · 보고서 v${saved.report.revision} · ${saved.documentName} · 기록자 ${saved.actor}`), text('p', 'interpretation-text', saved.reason));
        const open = text('button', 'request-action-button', `완료 근거 보고서 v${saved.report.revision} 보기`); open.type = 'button'; open.addEventListener('click', () => onOpenReport(saved.report.revision)); completionInfo.append(open);
      } else completionInfo.append(text('p', 'detail-help', `완료 대상으로 확인할 보고서: ${state.latest ? `v${state.latest.revision} · ${state.latest.title}` : '없음'}`));
      completionForm.hidden = !!state.process;
      completionFields.disabled = busy || !state.canComplete; completionSave.disabled = busy || !state.canComplete;
      completionSave.textContent = state.completion ? '검토·검증 완료 근거 새로 보관' : '검토·검증 완료 기록 보관';
      processTitle.textContent = state.process ? `제출 진행 관리 · ${state.process.status}` : '인증·등록 또는 고객 제출 시작';
      processFields.disabled = busy || !(state.process ? state.canWrite : state.canStart); processSave.disabled = processFields.disabled;
      processSave.textContent = busy ? '저장 중…' : state.process ? '진행 정보·이력 저장' : '인증·등록 준비 시작 · 9단계로'; startLabel.hidden = !!state.process;
      validityCard.hidden = !state.process || state.project.stage < 9;
      validityFields.disabled = validitySave.disabled = busy || !state.canRecordValidity;
      validityInfo.textContent = state.validity ? `기록한 공식 만료일 ${state.validity.expiryOn} · 확인 문서 ${state.validity.documentName} · 확인자 ${state.validity.actor}`
        : state.canRecordValidity ? '공식 만료일을 아직 기록하지 않았어요. 발급 문서를 확인하면 입력해 주세요.' : '승인된 인증·등록만 공식 만료일을 기록할 수 있어요.';
      if (!dirty && state.record.revision !== validityFormRevision) {
        expiryOn.value = state.validity?.expiryOn || ''; validityDocument.value = state.validity?.documentName || '';
        validityReason.value = ''; validityCheck.checked = false; validityFormRevision = state.record.revision;
      }
      rebase.disabled = busy;
      finishCard.hidden = state.project.stage < 9;
      finishForm.hidden = !!state.finished || state.project.stage !== 9;
      finishFields.disabled = finishSave.disabled = busy || !state.canFinish;
      finishBlock.textContent = state.project.stage === 10 && !state.finished ? '기본 가상 샘플은 완료 단계로 제공되며 별도로 입력한 완료 기록은 없어요.' : state.finishBlock;
      finishInfo.replaceChildren();
      if (state.process && state.completion) {
        const d = state.finished?.details || state.process.details;
        finishInfo.append(text('p', 'detail-help', `${d.kind} · ${d.organization} · ${d.scheme}`), text('p', 'detail-help', `최종 보고서 v${state.finished?.reportRevision || state.completion.report.revision} · 확인 번호 ${d.registrationNumber || '미정'} · 발급·확인일 ${d.issuedOn || '미정'}`));
        const open = text('button', 'request-action-button', '최종 보고서 보기'); open.type = 'button'; open.addEventListener('click', () => onOpenReport(state.finished?.reportRevision || state.completion.report.revision)); finishInfo.append(open);
      }
      if (state.finished) {
        finishBlock.textContent = `프로젝트 완료일 ${state.finished.finishedOn} · 기록자 ${state.finished.actor}`;
        finishInfo.append(text('p', 'interpretation-text', state.finished.reason));
      }
      if (!dirty && state.canFinish && (!finishReason.value || finishReason.value === finishReasonAuto)) {
        const d = state.process.details;
        finishReasonAuto = `최종 보고서 v${state.completion.report.revision}와 ${d.organization}의 ${d.kind} 확인 기록(${d.registrationNumber}, ${d.issuedOn})을 확인하고 프로젝트를 완료해요.`;
        finishReason.value = finishReasonAuto;
      }
      historyList.replaceChildren();
      for (const event of state.record.events.slice().reverse()) {
        const item = text('details', 'customer-review-event', ''); item.append(text('summary', '', `${date(event.at)} · ${event.type === 'completed' ? '검토·검증 완료 기록' : event.type === 'started' ? '9단계 시작' : event.type === 'validity' ? '공식 만료일 확인' : event.type === 'renewed' ? '갱신 완료' : event.type === 'inspection-plan' ? 'EPD 점검 기준 기록' : event.type === 'inspection' ? `연간 ${event.status}` : event.type === 'finished' ? '프로젝트 완료 · 10단계' : event.status} · ${event.actor}`));
        if (event.type === 'status-check') {
          item.querySelector('summary').textContent = `${date(event.at)} · 상태 확인: ${event.status} · ${event.actor}`;
          item.append(text('p', 'detail-help', `확인일 ${event.checkedOn} · 확인 문서 ${event.documentName} · ${event.organization} · ${event.scheme} · 번호 ${event.registrationNumber} · 발급일 ${event.issuedOn} · 당시 공식 만료일 ${event.expiryOn || '미정'}`));
        } else if (event.type === 'completed') {
          item.append(text('p', 'detail-help', `완료일 ${event.completedOn} · 보고서 v${event.report.revision} · ${event.reviewMethod === 'internal' ? '내부 검토 완료' : `외부 검증 ${event.verification.rounds.length}차까지 보관`} · 결과 기록 ${event.documentName}`));
        } else if (event.type === 'validity') {
          item.append(text('p', 'detail-help', `공식 만료일 ${event.expiryOn} · 확인 문서 ${event.documentName} · 인증·등록 번호 ${event.registrationNumber}`));
        } else if (event.type === 'inspection-plan') {
          item.append(text('p', 'detail-help', `EPD 버전 ${event.version} · 버전일 ${event.versionOn} · 확인 문서 ${event.documentName}`));
        } else if (event.type === 'inspection') {
          item.append(text('p', 'detail-help', `점검 대상일 ${event.dueOn} · 점검일 ${event.checkedOn} · EPD 버전 ${event.version} · 확인 문서 ${event.documentName}`));
        } else if (event.type === 'renewal-progress') {
          item.append(text('p', 'detail-help', `처리일 ${event.actionOn} · 대상 번호 ${event.registrationNumber} · 처리 근거 ${event.documentName}`));
        } else if (event.type === 'renewed') {
          item.append(text('p', 'detail-help', `갱신 완료 ${event.actionOn} · 이전 번호 ${event.registrationNumber} · 새 번호 ${event.details.registrationNumber} · 새 발급일 ${event.details.issuedOn} · 공식 만료일 ${event.expiryOn} · 확인 문서 ${event.documentName}`));
        } else if (event.type === 'finished') {
          item.append(text('p', 'detail-help', `프로젝트 완료일 ${event.finishedOn} · 최종 보고서 v${event.reportRevision} · ${event.details.kind} · ${event.details.organization} · 확인 번호 ${event.details.registrationNumber} · 발급·확인일 ${event.details.issuedOn}`));
        } else {
          const d = event.details;
          item.append(text('p', 'detail-help', `${d.kind} · ${d.organization} · ${d.scheme}`), text('p', 'detail-help', `상태 ${event.status} · 제출일 ${d.submittedOn || '미정'} · 번호 ${d.registrationNumber || '미정'} · 발급·확인일 ${d.issuedOn || '미정'}`));
          if (d.note) item.append(text('p', 'interpretation-text', d.note));
        }
        item.append(text('p', 'interpretation-text', event.reason)); historyList.append(item);
      }
      if (!state.record.events.length) historyList.append(text('p', 'detail-help', '아직 보관한 완료·제출 이력이 없어요.'));
      updateExpiry();
      LCA.views.inputAssist.sync(host);
    }
    for (const form of [completionForm, processForm, validityForm, finishForm]) {
      form.addEventListener('input', () => { dirty = true; }); form.addEventListener('change', () => { dirty = true; });
    }
    processForm.addEventListener('input', updateExpiry);
    processForm.addEventListener('change', updateExpiry);
    async function run(action, draft, error) {
      if (busy) return; const expectedRevision = revision; const expectedBasis = basis;
      busy = true; refresh(); let result;
      try { result = await store.save(project.id, action, draft, expectedRevision, expectedBasis); }
      catch { result = { ok: false, error: '저장하지 못했어요. 입력과 보관 기록은 유지했어요.' }; }
      busy = false; error.textContent = result.error || '';
      if (result.ok) {
        dirty = false; completionCheck.checked = false; startCheck.checked = false; finishCheck.checked = false;
        feedback.textContent = action === 'completed' ? '선택한 검토 경로의 완료 근거와 최종 보고서 사본을 보관했어요. 아직 8단계예요.' : action === 'started' ? '9단계로 이동하고 제출 준비 기록을 보관했어요.' : action === 'validity' ? '문서의 만료일과 확인 근거를 이력에 보관했어요. 갱신 확인 시점에 반영돼요.' : '진행 정보와 변경 사유를 이력에 추가했어요.';
        onChanged();
        if (action === 'finished') feedback.textContent = '프로젝트를 완료·사후관리(10) 단계로 옮겼어요. 진행 중 집계에서 빠지고 필요한 갱신·점검 할 일은 계속 보여요.';
      }
      refresh(); const target = result.ok ? feedback : error; target.tabIndex = -1; target.focus();
    }
    completionForm.addEventListener('submit', (event) => { event.preventDefault(); run('completed', { completedOn: completedOn.value, documentName: documentName.value, actor: completionActor.value, reason: completionReason.value, confirmed: completionCheck.checked }, completionError); });
    processForm.addEventListener('submit', (event) => {
      event.preventDefault(); run(state.process ? 'updated' : 'started', { ...Object.fromEntries(Object.entries(controls).map(([key, input]) => [key, input.value])), status: status.value, actor: actor.value, reason: reason.value, confirmed: startCheck.checked }, processError);
    });
    validityForm.addEventListener('submit', (event) => { event.preventDefault(); run('validity', { expiryOn: expiryOn.value,
      documentName: validityDocument.value, actor: validityActor.value, reason: validityReason.value, confirmed: validityCheck.checked }, validityError); });
    rebase.addEventListener('click', () => {
      const latest = store.load(project.id); if (!latest.ok) { refresh(); return; }
      adopt(latest); dirty = true; completionCheck.checked = false; startCheck.checked = false; finishCheck.checked = false; completionError.textContent = ''; processError.textContent = ''; finishError.textContent = '';
      feedback.textContent = '입력은 유지하고 최신 보고서·검증·제출 기록으로 기준을 맞췄어요. 저장 전에 내용과 확인 체크를 다시 검토해 주세요.'; refresh();
    });
    finishForm.addEventListener('submit', (event) => { event.preventDefault(); run('finished', { finishedOn: finishedOn.value, actor: finishActor.value, reason: finishReason.value, confirmed: finishCheck.checked }, finishError); });
    LCA.views.certificationInspection.init(inspectionHost, project, store, onChanged);
    LCA.views.certificationRenewal.init(renewalHost, project, store, onChanged);
    LCA.views.certificationStatus.init(statusHost, project, store, onChanged);
    refreshCurrent = refresh; refresh();
  }
  function dateField(parent, id, label) {
    const input = field(parent, id, label, 'input', 10); input.inputMode = 'numeric'; input.placeholder = '예: 20261018';
    input.addEventListener('input', () => { input.value = LCA.requests.formatDateInput(input.value); });
    LCA.views.inputAssist.date(input); return input;
  }
  function checkbox(parent, label) {
    const wrapper = text('label', 'calculation-confirmation', ''); const input = document.createElement('input'); input.type = 'checkbox'; wrapper.append(input, document.createTextNode(label)); parent.append(wrapper); return input;
  }
  return { init, refresh: () => { refreshCurrent(); LCA.views.certificationInspection.refresh(); LCA.views.certificationRenewal.refresh(); LCA.views.certificationStatus.refresh(); } };
})();
