/* 사전 화면: 검색으로 고른 용어만 카드로 펼친다. 입력창과 초점은 유지한다. */
window.LCA = window.LCA || {};
LCA.views = LCA.views || {};

LCA.views.glossary = (() => {
  const PAGE_SIZE = 6;
  let page = 1;
  let targetTermId = '';
  const pagers = [];
  function textElement(tag, className, value) {
    const element = document.createElement(tag);
    element.className = className;
    element.textContent = value;
    return element;
  }

  function render(query, nextPage = 1, moveFocus = false) {
    const entries = LCA.glossary.search(query);
    const pages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
    page = Math.max(1, Math.min(pages, nextPage));
    const start = (page - 1) * PAGE_SIZE;
    const fragment = document.createDocumentFragment();
    entries.slice(start, start + PAGE_SIZE).forEach((entry) => {
      const item = textElement('li', 'glossary-card', '');
      item.dataset.termId = entry.id;
      if (entry.id === targetTermId) item.classList.add('glossary-card-target');
      item.append(textElement('span', 'glossary-category', entry.category), textElement('h3', '', entry.term));
      if (entry.english) item.append(textElement('p', 'glossary-english', entry.english));
      item.append(textElement('p', 'glossary-meaning', entry.meaning));
      const example = textElement('div', 'glossary-example', '');
      example.append(textElement('span', '', '이해를 돕는 가상 예시'), textElement('p', '', entry.example));
      item.append(example);
      const source = LCA.glossary.SOURCES[entry.source];
      const reference = textElement('p', 'glossary-source', '참고: ');
      if (source.url) {
        const link = textElement('a', '', source.label);
        link.href = source.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.setAttribute('aria-label', `${source.label} (새 탭)`);
        reference.append(link);
      } else {
        reference.append(document.createTextNode(`${source.label} · ${source.note}`));
      }
      item.append(reference);
      if (entry.checkedOn) item.append(textElement('p', 'glossary-source', `이 설명 확인일: ${entry.checkedOn.replaceAll('-', '.')}`));
      fragment.append(item);
    });
    document.querySelector('#glossary-results').replaceChildren(fragment);
    document.querySelector('#glossary-result-count').textContent = entries.length;
    const status = query.trim()
      ? `검색 결과 ${entries.length}개 · 전체 ${LCA.glossary.TERMS.length}개`
      : `전체 ${LCA.glossary.TERMS.length}개 용어`;
    document.querySelector('#glossary-search-status').textContent = `${status}${entries.length ? ` · ${start + 1}–${Math.min(start + PAGE_SIZE, entries.length)}번째 표시` : ''}`;
    document.querySelector('#glossary-empty').hidden = entries.length !== 0;
    document.querySelector('#glossary-results').hidden = entries.length === 0;
    document.querySelector('#clear-glossary-search').disabled = query.length === 0;
    for (const pager of pagers) {
      pager.nav.hidden = !entries.length;
      pager.previous.disabled = page === 1; pager.next.disabled = page === pages;
      if (pager.select.options.length !== pages) {
        pager.select.replaceChildren(...Array.from({ length: pages }, (_, index) => {
          const option = textElement('option', '', `${index + 1}페이지`); option.value = index + 1; return option;
        }));
      }
      pager.select.value = String(page); pager.count.textContent = `/ ${pages}페이지 · 한 페이지에 ${PAGE_SIZE}개`;
    }
    if (moveFocus) {
      const heading = document.querySelector('.glossary-results-heading'); heading.tabIndex = -1;
      heading.focus({ preventScroll: true }); heading.scrollIntoView({ block: 'start' });
    }
  }

  function init() {
    const searchInput = document.querySelector('#glossary-search');
    for (const position of ['top', 'bottom']) {
      const nav = textElement('nav', 'glossary-pagination', ''); nav.setAttribute('aria-label', `용어사전 페이지 ${position === 'top' ? '상단' : '하단'}`);
      const previous = textElement('button', 'request-action-button', '← 이전'); previous.type = 'button';
      const next = textElement('button', 'request-action-button', '다음 →'); next.type = 'button';
      const select = document.createElement('select'); select.setAttribute('aria-label', '용어사전 페이지 선택'); select.setAttribute('aria-controls', 'glossary-results');
      const count = textElement('span', 'detail-help', '');
      previous.addEventListener('click', () => render(searchInput.value, page - 1, true));
      next.addEventListener('click', () => render(searchInput.value, page + 1, true));
      select.addEventListener('change', () => render(searchInput.value, Number(select.value), true));
      nav.append(previous, select, count, next); pagers.push({ nav, previous, next, select, count });
      const results = document.querySelector('#glossary-results');
      if (position === 'top') results.before(nav); else results.after(nav);
    }
    searchInput.addEventListener('input', () => { targetTermId = ''; render(searchInput.value); });
    document.querySelector('#clear-glossary-search').addEventListener('click', () => {
      searchInput.value = '';
      targetTermId = '';
      render('');
      searchInput.focus();
    });
    document.querySelector('#glossary-checked-on').textContent = LCA.glossary.CHECKED_ON.replaceAll('-', '.');
    document.querySelector('#glossary-checked-on').dateTime = LCA.glossary.CHECKED_ON;
    render('');
  }

  function standardLink(standard) {
    const id = LCA.glossary.STANDARD_TERMS[standard];
    if (!id) return document.createTextNode(standard);
    const link = textElement('a', 'standard-glossary-link', standard);
    link.href = '#glossary-view'; link.dataset.glossaryTerm = id;
    link.setAttribute('aria-label', `${standard} · 용어사전 설명 보기`); return link;
  }
  function openTerm(id) {
    const entry = LCA.glossary.TERMS.find((term) => term.id === id); if (!entry) return false;
    const search = document.querySelector('#glossary-search'); search.value = entry.term; targetTermId = id;
    const index = LCA.glossary.search(entry.term).findIndex((term) => term.id === id);
    render(entry.term, Math.floor(Math.max(0, index) / PAGE_SIZE) + 1);
    const card = document.querySelector(`#glossary-results [data-term-id="${id}"]`);
    if (card) { card.tabIndex = -1; card.focus({ preventScroll: true }); card.scrollIntoView({ block: 'center' }); }
    return true;
  }
  function capture() { return { query: document.querySelector('#glossary-search').value, page, targetTermId }; }
  function restore(state) {
    document.querySelector('#glossary-search').value = state.query;
    targetTermId = state.targetTermId; render(state.query, state.page);
  }
  return { init, standardLink, openTerm, capture, restore };
})();
