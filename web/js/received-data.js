/* 받은 자료의 입력 규칙. 원래 값·단위를 기록하며 환경영향 계산은 하지 않는다. */
window.LCA = window.LCA || {};
LCA.receivedData = (() => {
  const UNITS = ['kg', 'g', 't', 'kWh', 'MJ', 'GJ', 'm³', 'L', 'tkm', 'km', '개', '장', 'kgCO₂e', '%'];
  const VOLUME_UNITS = ['m³', 'L'];
  const MAX_DESCRIPTION = 1000;
  const MAX_FILE_NAME = 200;
  const SOURCES = ['1차', '2차'];
  // 저장된 1차/2차 코드는 유지하되 계수에는 자료 출처의 성격을 표시한다.
  const factorSourceLabel = (value) => ({ '1차': '해당 공급자·공정 계수', '2차': '외부 데이터셋 계수' })[value] || '미기록';
  const METHODS = ['측정', '계산', '추정', '가정'];
  const SOURCE_FIELDS = ['activitySource', 'activitySourceDetail', 'factorSource', 'acquisitionMethod', 'datasetDatabase', 'datasetName', 'datasetVersion', 'datasetYear', 'datasetSource'];
  const hasSource = (source) => source && SOURCE_FIELDS.some((key) => typeof source[key] === 'string' && source[key].trim());
  function numeric(value, positive = false) {
    if (typeof value !== 'string' || value.length > 50) return false;
    const clean = value.trim();
    if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(clean)) return false;
    const number = Number(clean.replaceAll(',', ''));
    return Number.isFinite(number) && number <= Number.MAX_SAFE_INTEGER && (positive ? number > 0 : number >= 0);
  }
  function validate(draft) {
    const errors = {};
    if (!['quantity', 'document'].includes(draft.kind)) errors.kind = '자료 형태를 골라 주세요.';
    if (draft.kind === 'quantity') {
      if (!numeric(draft.value)) errors.value = '0 이상의 숫자를 적어 주세요. 예: 12000 또는 12,000.5';
      if (!UNITS.includes(draft.unit)) errors.unit = '값에 맞는 단위를 골라 주세요.';
      if (VOLUME_UNITS.includes(draft.unit) && !numeric(draft.density, true)) errors.density = '부피 자료의 밀도를 0보다 큰 숫자로 적어 주세요. 단위는 kg/m³예요.';
    }
    if (draft.kind === 'document' && (typeof draft.description !== 'string' || !draft.description.trim() || draft.description.trim().length > MAX_DESCRIPTION)) {
      errors.description = '받은 문서의 내용을 1~1,000자로 적어 주세요.';
    }
    if (!LCA.requests.validDate(draft.periodStart)) errors.periodStart = '자료 기간의 시작일을 올바르게 적어 주세요.';
    if (!LCA.requests.validDate(draft.periodEnd)) errors.periodEnd = '자료 기간의 종료일을 올바르게 적어 주세요.';
    if (!errors.periodStart && !errors.periodEnd && draft.periodStart > draft.periodEnd) errors.periodEnd = '종료일은 시작일과 같거나 그 이후여야 해요.';
    if (typeof draft.evidenceFileName !== 'string' || !draft.evidenceFileName.trim() || draft.evidenceFileName.trim().length > MAX_FILE_NAME || /[\\/\x00-\x1f]/.test(draft.evidenceFileName)) {
      errors.evidenceFileName = '증빙 파일 이름을 1~200자로 적어 주세요. 폴더 경로는 빼 주세요.';
    }
    const source = draft.provenance;
    if (source !== undefined) {
      if (!source || typeof source !== 'object' || Array.isArray(source)) errors.provenance = '자료 출처 기록을 확인해 주세요.';
      else {
        for (const key of SOURCE_FIELDS) if (typeof source[key] !== 'string' || source[key].trim().length > 200) errors[key] = '자료 출처는 각 칸에 200자까지 적을 수 있어요.';
        if (!errors.activitySource && source.activitySource && !SOURCES.includes(source.activitySource)) errors.activitySource = '활동량 출처를 다시 골라 주세요.';
        if (!errors.factorSource && source.factorSource && (draft.kind !== 'quantity' || !SOURCES.includes(source.factorSource))) errors.factorSource = '계수 출처를 다시 골라 주세요.';
        if (!errors.acquisitionMethod && source.acquisitionMethod && !METHODS.includes(source.acquisitionMethod)) errors.acquisitionMethod = '획득 방법을 다시 골라 주세요.';
        if (source.activitySource === '2차' && !source.activitySourceDetail?.trim()) errors.activitySourceDetail = '2차 활동량의 자료 이름이나 제공처를 적어 주세요.';
        if (!source.activitySource && source.activitySourceDetail?.trim()) errors.activitySource = '자료 이름을 적었다면 활동량 출처도 골라 주세요.';
        if (source.factorSource === '2차') {
          for (const [key, label] of [['datasetDatabase', 'DB 이름'], ['datasetName', '데이터셋 이름'], ['datasetVersion', '버전'], ['datasetSource', '제공처·출처']]) {
            if (!source[key]?.trim()) errors[key] = `외부 데이터셋 계수의 ${label}을 적어 주세요.`;
          }
          if (!/^\d{4}$/.test(source.datasetYear || '')) errors.datasetYear = '외부 데이터셋 계수의 기준연도를 네 자리 숫자로 적어 주세요.';
        }
      }
    }
    return errors;
  }
  function normalize(draft) {
    const quantity = draft.kind === 'quantity';
    const receipt = {
      kind: draft.kind,
      value: quantity ? draft.value.trim().replaceAll(',', '') : '',
      unit: quantity ? draft.unit : '',
      density: quantity && VOLUME_UNITS.includes(draft.unit) ? draft.density.trim().replaceAll(',', '') : '',
      description: quantity ? '' : draft.description.trim(),
      periodStart: draft.periodStart, periodEnd: draft.periodEnd,
      evidenceFileName: draft.evidenceFileName.trim()
    };
    const source = draft.provenance;
    if (hasSource(source)) {
      receipt.provenance = {
        activitySource: source.activitySource.trim(),
        activitySourceDetail: source.activitySourceDetail.trim(),
        factorSource: quantity ? source.factorSource.trim() : '',
        acquisitionMethod: source.acquisitionMethod.trim(),
        datasetDatabase: quantity && source.factorSource === '2차' ? source.datasetDatabase.trim() : '',
        datasetName: quantity && source.factorSource === '2차' ? source.datasetName.trim() : '',
        datasetVersion: quantity && source.factorSource === '2차' ? source.datasetVersion.trim() : '',
        datasetYear: quantity && source.factorSource === '2차' ? source.datasetYear.trim() : '',
        datasetSource: quantity && source.factorSource === '2차' ? source.datasetSource.trim() : ''
      };
    }
    return receipt;
  }
  function validRecord(receipt) {
    if (!receipt || Object.keys(validate(receipt)).length) return false;
    const normalized = normalize(receipt);
    return Object.entries(normalized).every(([key, value]) => key === 'provenance'
      ? SOURCE_FIELDS.every((field) => receipt.provenance[field] === value[field])
        && Object.keys(receipt.provenance).every((field) => SOURCE_FIELDS.includes(field))
      : receipt[key] === value)
      && ('provenance' in receipt) === ('provenance' in normalized)
      && ['recordedAt', 'updatedAt'].every((key) => typeof receipt[key] === 'string' && Number.isFinite(Date.parse(receipt[key])))
      && receipt.recordedAt <= receipt.updatedAt;
  }
  function displayNumber(value) {
    const [whole, fraction] = value.split('.');
    return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (fraction === undefined ? '' : `.${fraction}`);
  }
  return { UNITS, VOLUME_UNITS, SOURCES, METHODS, SOURCE_FIELDS, MAX_DESCRIPTION, MAX_FILE_NAME, validate, normalize, validRecord, displayNumber, factorSourceLabel };
})();
