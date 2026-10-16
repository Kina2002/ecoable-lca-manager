/* 요청 기한과 자료 기간에 같은 네 자리 연도·숫자 입력·달력을 사용한다. */
window.LCA = window.LCA || {};
LCA.views = LCA.views || {};
LCA.views.dateInput = (() => {
  function bind(field, calendar, button, clearError, error) {
    field.addEventListener('keydown', (event) => {
      if (field.selectionStart !== field.selectionEnd) return;
      const cursor = field.selectionStart;
      if (event.key === 'Backspace' && field.value[cursor - 1] === '-') {
        event.preventDefault();
        field.setSelectionRange(cursor - 1, cursor - 1);
      } else if (event.key === 'Delete' && field.value[cursor] === '-') {
        event.preventDefault();
        field.setSelectionRange(cursor + 1, cursor + 1);
      }
    });
    field.addEventListener('input', () => {
      const digitsBeforeCursor = field.value.slice(0, field.selectionStart).replace(/\D/g, '').length;
      field.value = LCA.requests.formatDateInput(field.value);
      let cursor = 0;
      let digits = 0;
      while (cursor < field.value.length && digits < digitsBeforeCursor) {
        if (/\d/.test(field.value[cursor])) digits++;
        cursor++;
      }
      field.setSelectionRange(cursor, cursor);
      clearError();
    });
    button.hidden = typeof calendar.showPicker !== 'function';
    button.addEventListener('click', () => {
      calendar.value = LCA.requests.validDate(field.value) ? field.value : '';
      try { calendar.showPicker(); }
      catch {
        error.textContent = '달력을 열 수 없어요. 날짜를 숫자 8자리로 입력해 주세요.';
        error.hidden = false;
        field.focus();
      }
    });
    calendar.addEventListener('change', () => {
      field.value = LCA.requests.formatDateInput(calendar.value);
      clearError();
      field.focus();
    });
  }
  return { bind };
})();
