/* 받은 자료의 입력 규칙. 원래 값·단위를 기록하며 환경영향 계산은 하지 않는다. */
window.LCA = window.LCA || {};
LCA.receivedData = (() => {
  const UNITS = ['kg', 'g', 't', 'kWh', 'MJ', 'GJ', 'm³', 'L', 'tkm', 'km', '개', '장', 'kgCO₂e', '%'];
  const VOLUME_UNITS = ['m³', 'L'];
  const MAX_DESCRIPTION = 1000;
  const MAX_FILE_NAME = 200;
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
    return errors;
  }
  function normalize(draft) {
    const quantity = draft.kind === 'quantity';
    return {
      kind: draft.kind,
      value: quantity ? draft.value.trim().replaceAll(',', '') : '',
      unit: quantity ? draft.unit : '',
      density: quantity && VOLUME_UNITS.includes(draft.unit) ? draft.density.trim().replaceAll(',', '') : '',
      description: quantity ? '' : draft.description.trim(),
      periodStart: draft.periodStart, periodEnd: draft.periodEnd,
      evidenceFileName: draft.evidenceFileName.trim()
    };
  }
  function validRecord(receipt) {
    if (!receipt || Object.keys(validate(receipt)).length) return false;
    const normalized = normalize(receipt);
    return Object.entries(normalized).every(([key, value]) => receipt[key] === value)
      && ['recordedAt', 'updatedAt'].every((key) => typeof receipt[key] === 'string' && Number.isFinite(Date.parse(receipt[key])))
      && receipt.recordedAt <= receipt.updatedAt;
  }
  function displayNumber(value) {
    const [whole, fraction] = value.split('.');
    return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (fraction === undefined ? '' : `.${fraction}`);
  }
  return { UNITS, VOLUME_UNITS, MAX_DESCRIPTION, MAX_FILE_NAME, validate, normalize, validRecord, displayNumber };
})();
