/* 저장된 보고서 사본을 브라우저 안에서 실제 PDF·DOCX 파일로 만든다. */
window.LCA = window.LCA || {};
LCA.reportExport = (() => {
  const scripts = new Map();
  const fontCache = new Map();
  const fontName = 'Noto Sans KR';
  const disclaimer = '가상 데이터 · 검토 전 보고서 초안';
  const attachmentNote = '증빙과 결과 파일은 이름만 기록되어 있으며 파일 내용은 이 초안에 첨부되지 않습니다.';
  const formats = Object.freeze([
    { value: 'pdf', label: 'PDF 문서 (.pdf)' },
    { value: 'docx', label: 'Word 문서 (.docx)' },
    { value: 'md', label: '글 파일 (.md)' }
  ]);
  function loadScript(path, name) {
    if (window[name]) return Promise.resolve(window[name]);
    if (!scripts.has(path)) {
      scripts.set(path, new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = new URL(path, document.baseURI).href;
        script.onload = () => window[name] ? resolve(window[name]) : reject(new Error('문서 도구를 준비하지 못했어요.'));
        script.onerror = () => { script.remove(); reject(new Error('문서 도구를 불러오지 못했어요. 미리보기 서버 연결을 확인해 주세요.')); };
        document.head.append(script);
      }).catch((error) => { scripts.delete(path); throw error; }));
    }
    return scripts.get(path);
  }
  function font(weight) {
    if (!fontCache.has(weight)) {
      fontCache.set(weight, fetch(new URL(`./vendor/notosanskr-2.004/NotoSansKR-${weight}.otf`, document.baseURI))
        .then((response) => { if (!response.ok) throw new Error('한글 글꼴을 불러오지 못했어요. 미리보기 서버 연결을 확인해 주세요.'); return response.arrayBuffer(); })
        .then((buffer) => new Uint8Array(buffer))
        .catch((error) => { fontCache.delete(weight); throw error; }));
    }
    return fontCache.get(weight);
  }
  function base64(bytes) {
    const parts = [];
    for (let start = 0; start < bytes.length; start += 16384) parts.push(String.fromCharCode(...bytes.subarray(start, start + 16384)));
    return btoa(parts.join(''));
  }
  function savedAt(record) {
    return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Seoul' }).format(new Date(record.updatedAt));
  }
  function pdfDefinition(record) {
    const content = [
      { text: disclaimer, fontSize: 9, color: '#475569', margin: [0, 0, 0, 10] },
      { text: record.title, style: 'title' },
      { text: `초안 버전 ${record.revision} · 저장 시각 ${savedAt(record)} (한국 시간)`, style: 'meta' }
    ];
    for (const section of LCA.report.sections(record)) {
      content.push({ text: section.title, style: 'heading' });
      for (const paragraph of section.paragraphs) content.push({ text: paragraph, margin: [0, 0, 0, 7] });
      if (section.indicators) content.push({
        margin: [0, 5, 0, 10],
        table: { headerRows: 1, widths: ['*', 140, 110], body: [
          ['지표', '결과값', '단위'].map((text) => ({ text, bold: true, fillColor: '#eef3ef' })),
          ...section.indicators.map((item) => [item.indicator, item.value, item.unit].map((text) => ({ text, fontSize: 9 })))
        ] },
        layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5, hLineColor: () => '#cbd5cf', vLineColor: () => '#cbd5cf',
          paddingLeft: () => 8, paddingRight: () => 8, paddingTop: () => 7, paddingBottom: () => 7 }
      });
    }
    content.push({ text: attachmentNote, style: 'meta', margin: [0, 18, 0, 0] });
    return {
      pageSize: 'A4', pageMargins: [50, 48, 50, 52],
      info: { title: record.title, subject: disclaimer, creator: 'EcoAble LCA Manager' },
      defaultStyle: { font: fontName, fontSize: 10, lineHeight: 1.35, color: '#000000' },
      styles: { title: { fontSize: 21, bold: true, margin: [0, 0, 0, 12] },
        heading: { fontSize: 13, bold: true, margin: [0, 18, 0, 10] }, meta: { fontSize: 9, color: '#475569', margin: [0, 0, 0, 12] } },
      content,
      footer: (page, pages) => ({ text: `가상 데이터 · 검토 전 초안     ${page} / ${pages}`, font: fontName, fontSize: 8, color: '#64748b', alignment: 'center', margin: [50, 15, 50, 0] }),
      pageBreakBefore: (node, following) => node.style === 'heading' && following.length === 0
    };
  }
  async function pdf(record) {
    const [engine, regular, bold] = await Promise.all([
      loadScript('./vendor/pdfmake-0.2.20/pdfmake.min.js', 'pdfMake'), font('Regular'), font('Bold')
    ]);
    const fonts = { [fontName]: { normal: 'NotoSansKR-Regular.otf', bold: 'NotoSansKR-Bold.otf', italics: 'NotoSansKR-Regular.otf', bolditalics: 'NotoSansKR-Bold.otf' } };
    const vfs = { 'NotoSansKR-Regular.otf': base64(regular), 'NotoSansKR-Bold.otf': base64(bold) };
    // 이미 로컬 메모리에 준비한 글꼴을 사용한다. 동기 스트림 생성과 오류 이벤트를 함께 처리한다.
    return new Promise((resolve, reject) => {
      try {
        const stream = engine.createPdf(pdfDefinition(record), undefined, fonts, vfs).getStream({});
        const chunks = [];
        stream.on('data', (chunk) => chunks.push(new Uint8Array(chunk)));
        stream.on('error', reject);
        stream.on('end', () => resolve(new Blob(chunks, { type: 'application/pdf' })));
        stream.end();
      } catch (error) { reject(error); }
    });
  }
  async function word(record) {
    const [d, regular] = await Promise.all([loadScript('./vendor/docx-9.5.1/index.umd.js', 'docx'), font('Regular')]);
    const body = [];
    const paragraph = (text, options = {}) => new d.Paragraph({
      children: String(text).split(/\r\n?|\n/).map((line, index) => new d.TextRun({ text: line, break: index ? 1 : 0 })),
      spacing: { after: 120, line: 320 }, ...options
    });
    body.push(paragraph(disclaimer, { style: 'ReportMeta' }), paragraph(record.title, { heading: d.HeadingLevel.TITLE }),
      paragraph(`초안 버전 ${record.revision} · 저장 시각 ${savedAt(record)} (한국 시간)`, { style: 'ReportMeta' }));
    for (const section of LCA.report.sections(record)) {
      body.push(paragraph(section.title, { heading: d.HeadingLevel.HEADING_1 }));
      for (const value of section.paragraphs) body.push(paragraph(value));
      if (section.indicators) {
        const rows = [['지표', '결과값', '단위'], ...section.indicators.map((item) => [item.indicator, item.value, item.unit])];
        body.push(new d.Table({ width: { size: 100, type: d.WidthType.PERCENTAGE }, layout: d.TableLayoutType.FIXED,
          columnWidths: [4320, 2800, 2500],
          rows: rows.map((values, index) => new d.TableRow({ tableHeader: index === 0,
            children: values.map((value, column) => new d.TableCell({
              width: { size: [4320, 2800, 2500][column], type: d.WidthType.DXA },
              margins: { top: 100, bottom: 100, left: 120, right: 120 },
              shading: index === 0 ? { fill: 'EEF3EF' } : undefined,
              children: [new d.Paragraph({ spacing: { after: 0, line: 280 }, children: [new d.TextRun({ text: value, bold: index === 0, size: 19 })] })]
            }))
          }))
        }), paragraph(''));
      }
    }
    body.push(paragraph(attachmentNote, { style: 'ReportMeta' }));
    const doc = new d.Document({
      title: record.title, subject: disclaimer, creator: 'EcoAble LCA Manager', description: '저장된 보고서 초안의 사본',
      fonts: [{ name: fontName, data: regular }],
      styles: { default: { document: { run: { font: { name: fontName, eastAsia: fontName }, size: 21, color: '000000', language: { value: 'ko-KR', eastAsia: 'ko-KR' } }, paragraph: { spacing: { after: 120, line: 320 } } },
          title: { run: { size: 42, bold: true, color: '000000' }, paragraph: { spacing: { before: 100, after: 200 }, keepNext: true } },
          heading1: { run: { size: 27, bold: true, color: '000000' }, paragraph: { spacing: { before: 300, after: 140 }, keepNext: true } } },
        paragraphStyles: [{ id: 'ReportMeta', name: 'Report metadata', basedOn: 'Normal', run: { size: 18, color: '475569' }, paragraph: { spacing: { after: 180 } } }] },
      sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 960, right: 1134, bottom: 1000, left: 1134 } } },
        footers: { default: new d.Footer({ children: [new d.Paragraph({ alignment: d.AlignmentType.CENTER, children: [new d.TextRun({ text: '가상 데이터 · 검토 전 초안    ', size: 16 }), new d.TextRun({ children: [d.PageNumber.CURRENT, ' / ', d.PageNumber.TOTAL_PAGES], size: 16 })] })] }) },
        children: body }]
    });
    return d.Packer.toBlob(doc);
  }
  async function create(record, format) {
    if (!formats.some((item) => item.value === format) || format === 'md') throw new Error('내려받을 문서 형식을 확인해 주세요.');
    const blob = await (format === 'pdf' ? pdf(record) : word(record));
    if (!blob.size) throw new Error('문서 파일을 만들지 못했어요. 다시 시도해 주세요.');
    return { blob, extension: format };
  }
  return { formats, create };
})();
