/* 사전 화면: 검색으로 고른 용어만 카드로 펼친다. 입력창과 초점은 유지한다. */
window.LCA = window.LCA || {};
LCA.views = LCA.views || {};

LCA.views.glossary = (() => {
  function textElement(tag, className, value) {
    const element = document.createElement(tag);
    element.className = className;
    element.textContent = value;
    return element;
  }

  function render(query) {
    const entries = LCA.glossary.search(query);
    const fragment = document.createDocumentFragment();
    entries.forEach((entry) => {
      const item = textElement('li', 'glossary-card', '');
      item.dataset.termId = entry.id;
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
      fragment.append(item);
    });
    document.querySelector('#glossary-results').replaceChildren(fragment);
    document.querySelector('#glossary-result-count').textContent = entries.length;
    document.querySelector('#glossary-search-status').textContent = query.trim()
      ? `검색 결과 ${entries.length}개 · 전체 ${LCA.glossary.TERMS.length}개`
      : `전체 ${LCA.glossary.TERMS.length}개 용어`;
    document.querySelector('#glossary-empty').hidden = entries.length !== 0;
    document.querySelector('#glossary-results').hidden = entries.length === 0;
    document.querySelector('#clear-glossary-search').disabled = query.length === 0;
  }

  function init() {
    const searchInput = document.querySelector('#glossary-search');
    searchInput.addEventListener('input', () => render(searchInput.value));
    document.querySelector('#clear-glossary-search').addEventListener('click', () => {
      searchInput.value = '';
      render('');
      searchInput.focus();
    });
    document.querySelector('#glossary-checked-on').textContent = LCA.glossary.CHECKED_ON.replaceAll('-', '.');
    document.querySelector('#glossary-checked-on').dateTime = LCA.glossary.CHECKED_ON;
    render('');
  }

  return { init };
})();
