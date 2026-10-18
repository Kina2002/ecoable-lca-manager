window.LCA = window.LCA || {};
LCA.views = LCA.views || {};
LCA.views.backup = (() => {
  function init(sampleDate, onRestored) {
    const view = document.querySelector('#settings-view');
    const mode = view.querySelector('#backup-location'); const exportButton = view.querySelector('#backup-export');
    const input = view.querySelector('#backup-file'); const preview = view.querySelector('#backup-preview');
    const previewBody = view.querySelector('#backup-preview-body'); const confirmation = view.querySelector('#backup-confirm');
    const restoreButton = view.querySelector('#backup-restore'); const feedback = view.querySelector('#backup-feedback');
    const safety = view.querySelector('#backup-safety');
    let selected = null; let savedExpected = null; let busy = false; let readNumber = 0;
    if (typeof window.showSaveFilePicker !== 'function' || !window.isSecureContext) {
      mode.querySelector('[value="location"]').disabled = true; mode.value = 'download';
      view.querySelector('#backup-location-help').textContent = '이 브라우저에서는 앱의 위치 선택을 지원하지 않아요. 브라우저 다운로드 설정에서 ‘저장할 위치 확인’을 켜면 위치를 고를 수 있어요.';
    }
    function message(value, error = false) { feedback.textContent = value; feedback.className = error ? 'form-error' : 'request-feedback'; }
    function update() {
      exportButton.disabled = busy; input.disabled = busy; mode.disabled = busy; confirmation.disabled = busy;
      restoreButton.disabled = busy || !selected || !savedExpected || !confirmation.checked;
    }
    function paragraph(value) { const p = document.createElement('p'); p.textContent = value; return p; }
    exportButton.addEventListener('click', async () => {
      if (busy) return; busy = true; update(); message('백업 파일을 준비하고 있어요.');
      try {
        const snapshot = LCA.backup.create(sampleDate);
        const result = await LCA.backup.save(snapshot, mode.value);
        savedExpected = snapshot.expected; confirmation.checked = false;
        safety.textContent = `현재 기록 백업: ${result.fileName}. ${result.saved ? '파일 저장을 완료했어요.' : '다운로드를 요청했어요. 브라우저에서 파일 저장이 끝났는지 확인해 주세요.'}`;
        message(result.saved ? '선택한 위치에 백업 파일을 저장했어요.' : '백업 다운로드를 요청했어요. 다운로드 목록에서 완료 여부와 저장 위치를 확인해 주세요.');
      } catch (error) {
        const detail = error.name === 'AbortError' ? '저장을 취소했어요.' : ['SecurityError', 'NotAllowedError'].includes(error.name)
          ? '브라우저가 위치 선택 또는 파일 저장을 허용하지 않았어요. 브라우저 기본 다운로드로 바꿔 다시 시도해 주세요.'
          : error.message || '백업 파일을 저장하지 못했어요. 저장 방식을 바꾸거나 다시 시도해 주세요.';
        message(detail, error.name !== 'AbortError');
      }
      finally { busy = false; update(); }
    });
    input.addEventListener('change', async () => {
      const serial = ++readNumber; const file = input.files[0]; selected = null; confirmation.checked = false; preview.hidden = true; previewBody.replaceChildren(); update();
      if (!file) { message('파일 선택을 취소했어요.'); return; }
      if (file.size > LCA.backup.MAX_BYTES) { message('20MB 이하의 백업 파일을 선택해 주세요.', true); return; }
      busy = true; update(); message('백업 파일을 읽고 기록을 확인하고 있어요.');
      try {
        const result = LCA.backup.parse(await file.text());
        if (serial !== readNumber) return;
        selected = result; const info = result.summary;
        const date = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Seoul' }).format(new Date(result.data.createdAt));
        previewBody.append(paragraph(`파일: ${file.name}`), paragraph(`백업 날짜: ${date} (한국 시간)`),
          paragraph(`프로젝트 ${info.projects.length}개 · 연구원 ${info.researchers}명 · 자료 요청 ${info.requests}건 (삭제 이력 ${info.deletedRequests}건 포함)`),
          paragraph(`보고서 ${info.reportVersions}개 버전 · 고객 의견 ${info.comments}건 · 검증 지적 ${info.issues}건`));
        const list = document.createElement('ul');
        for (const project of info.projects) { const li = document.createElement('li'); li.textContent = `${project.code} · ${project.companyName} (가상) · ${project.productName}`; list.append(li); }
        previewBody.append(list); preview.hidden = false;
        message('백업 파일을 읽었어요. 아직 현재 기록은 바꾸지 않았어요. 아래 내용을 확인한 뒤 복원해 주세요.');
      } catch (error) { if (serial === readNumber) message(error.message || '백업 파일을 읽지 못했어요.', true); }
      finally { if (serial === readNumber) { busy = false; update(); } }
    });
    confirmation.addEventListener('change', update);
    restoreButton.addEventListener('click', async () => {
      if (busy || !selected || !savedExpected || !confirmation.checked) return;
      busy = true; update(); message('백업 파일의 기록으로 교체하고 있어요. 이 창을 닫지 말아 주세요.');
      try {
        const result = await LCA.backup.restore(selected, savedExpected);
        if (result.ok) { onRestored('백업 복원을 마쳤어요. 새로고침하면 복원한 기록을 볼 수 있어요. 저장하지 않은 입력은 따로 보관한 뒤 새로고침해 주세요.'); return; }
        if (result.fatal) { onRestored(result.error); return; }
        savedExpected = null; confirmation.checked = false; safety.textContent = '현재 기록을 다시 백업한 뒤 복원해 주세요.'; message(result.error, true);
      } catch (error) { message(error.message || '복원을 시작하지 못했어요. 현재 기록을 다시 백업해 주세요.', true); }
      finally { busy = false; update(); }
    });
    window.addEventListener('storage', (event) => {
      if (LCA.storage.DATA_KEYS.includes(event.key) || event.key === null) {
        savedExpected = null; confirmation.checked = false; safety.textContent = '다른 창에서 기록이 바뀌었어요. 현재 기록을 다시 백업해 주세요.'; update();
      }
    });
    update();
  }
  return { init };
})();
