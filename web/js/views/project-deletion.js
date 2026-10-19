window.LCA = window.LCA || {};
LCA.views = LCA.views || {};
LCA.views.projectDeletion = (() => {
  function init(sampleDate, onDeleted, onBlocked) {
    const dialog = document.querySelector('#project-delete-dialog'); const details = document.querySelector('#project-delete-details');
    const error = document.querySelector('#project-delete-error'); const confirm = document.querySelector('#project-delete-confirm');
    const cancel = document.querySelector('#project-delete-cancel'); let plan = null; let opener = null; let busy = false;
    function close() { if (busy) return; dialog.close(); }
    cancel.addEventListener('click', close);
    dialog.addEventListener('cancel', (event) => { if (busy) event.preventDefault(); });
    dialog.addEventListener('close', () => { plan = null; if (opener?.isConnected) opener.focus({ preventScroll: true }); });
    confirm.addEventListener('click', async () => {
      if (!plan || busy) return;
      busy = true; confirm.disabled = cancel.disabled = true; confirm.textContent = '삭제 중…'; error.textContent = '';
      let applied = false;
      try {
        const result = await LCA.projectDeletion.remove(plan);
        if (result.ok) { applied = true; dialog.close(); onDeleted(result); }
        else if (result.fatal) { dialog.close(); onBlocked(result.error); }
        else { error.textContent = `${result.error} 취소한 뒤 삭제 버튼을 다시 눌러 최신 기록을 확인해 주세요.`; confirm.disabled = true; }
      } catch { error.textContent = '삭제 결과 화면을 다시 열지 못했어요. 새로고침하여 기록을 확인해 주세요.'; if (applied || LCA.storage.changed()) { dialog.close(); onBlocked(error.textContent); } }
      finally { busy = false; cancel.disabled = false; confirm.textContent = '삭제'; }
    });
    function open(id, button) {
      opener = button; error.textContent = ''; details.replaceChildren(); confirm.disabled = true;
      try {
        plan = LCA.projectDeletion.prepare(id, sampleDate); const p = plan.project; const c = plan.counts;
        for (const value of [`${p.companyName} (가상) · ${p.code}`, `제품: ${p.productName}`,
          `함께 삭제: 자료 요청 ${c.requests}건(삭제 이력 포함), 보고서 ${c.reportVersions}개 버전, 고객 의견 ${c.comments}건, 검증 지적 ${c.issues}건, 발송 기록 ${c.messages}건, 자료 질의 ${c.inquiries}건, 담당 연구원 변경 ${c.researcherChanges}건`,
          '이 프로젝트의 범위·받은 자료·계산·해석·내부 검토·인증·완료 기록도 함께 삭제돼요. 다른 프로젝트와 담당 연구원 명단은 유지해요.',
          '삭제 후에는 되돌릴 수 없어요. 보관할 기록이 있다면 취소하고 설정에서 먼저 백업해 주세요. 다른 창의 이 앱은 닫아 주세요.']) {
          const paragraph = document.createElement('p'); paragraph.textContent = value; details.append(paragraph);
        }
        confirm.disabled = false;
      } catch (reason) { plan = null; error.textContent = reason.message || '삭제할 기록을 확인하지 못했어요.'; }
      dialog.showModal(); cancel.focus();
    }
    return { open };
  }
  return { init };
})();
