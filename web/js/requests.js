/* 자료 요청 명단과 저장 규칙. 저장에 성공한 다음에만 새 기록을 돌려준다. */
window.LCA = window.LCA || {};

LCA.requests = (() => {
  const STORAGE_KEY = 'ecoable-lca-manager.requests.v1';
  const VERSION = 1;
  const MAX_DETAIL = 1000;
  const categoryByKey = (key) => LCA.constants.CATEGORIES.find((category) => category.key === key);

  // 숫자만 이어 쓰면 앞의 네 자리는 연도, 다음 두 자리씩은 월·일이다.
  function formatDateInput(value) {
    const parts = String(value).split(/[-./]/);
    if (parts.length > 1) {
      const year = parts[0].replace(/\D/g, '').slice(0, 4);
      const month = parts[1].replace(/\D/g, '');
      const day = (parts.length > 2 ? parts[2].replace(/\D/g, '') : month.slice(2)).slice(0, 2);
      return `${year}-${month.slice(0, 2)}${parts.length > 2 || day ? `-${day}` : ''}`;
    }
    const digits = String(value).replace(/\D/g, '').slice(0, 8);
    return [digits.slice(0, 4), digits.slice(4, 6), digits.slice(6, 8)].filter(Boolean).join('-');
  }

  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1];
  }

  function validate(draft) {
    const errors = {};
    if (!categoryByKey(draft.categoryKey)) errors.categoryKey = '자료 구분을 골라 주세요.';
    if (typeof draft.detail !== 'string' || !draft.detail.trim()) errors.detail = '받고 싶은 자료의 내용을 적어 주세요.';
    else if (draft.detail.trim().length > MAX_DETAIL) errors.detail = `요청 내용은 ${MAX_DETAIL}자까지 적을 수 있어요.`;
    if (!validDate(draft.dueDate)) errors.dueDate = '제출 기한을 올바른 날짜로 골라 주세요.';
    return errors;
  }

  function createStore(projectIds, getStorage = () => window.localStorage, getStage = null) {
    const knownProjects = new Set(projectIds);
    const failure = (message) => ({ ok: false, message });

    function read() {
      try {
        const raw = getStorage().getItem(STORAGE_KEY);
        if (raw === null) return { ok: true, data: { version: VERSION, nextNumber: 1, requests: [] } };
        const data = JSON.parse(raw);
        if (!data || data.version !== VERSION || !Array.isArray(data.requests)
          || !Number.isSafeInteger(data.nextNumber) || data.nextNumber < 1) throw new Error('invalid schema');
        const ids = new Set();
        const projectCategories = new Set();
        for (const item of data.requests) {
          if (!item || typeof item.id !== 'string' || !/^DRQ-\d{4,}$/.test(item.id)) throw new Error('invalid id');
          const number = Number(item.id.slice(4));
          const pair = `${item.projectId}:${item.categoryKey}`;
          const guide = item.guideline;
          if (!Number.isSafeInteger(number) || number < 1 || number >= data.nextNumber || ids.has(item.id)
            || !knownProjects.has(item.projectId) || (!item.deletedAt && projectCategories.has(pair))
            || Object.keys(validate(item)).length
            || !['요청', '제출됨', ...LCA.review.STATUSES].includes(item.status)
            || (item.status !== '요청' ? !LCA.receivedData.validRecord(item.receipt) : 'receipt' in item)
            || (LCA.review.STATUSES.includes(item.status) ? !LCA.review.validRecord(item.review, item.status, item.receipt) : 'review' in item)
            || typeof item.createdAt !== 'string' || !Number.isFinite(Date.parse(item.createdAt))
            || ('deletedAt' in item && (typeof item.deletedAt !== 'string' || !Number.isFinite(Date.parse(item.deletedAt))))
            || !guide || typeof guide.source !== 'string' || typeof guide.section !== 'string'
            || guide.url !== LCA.constants.REQUEST_GUIDELINE.url || !validDate(guide.checkedOn)
            || !Number.isInteger(guide.page) || guide.page < 1 || typeof guide.note !== 'string') throw new Error('invalid record');
          ids.add(item.id);
          if (!item.deletedAt) projectCategories.add(pair);
        }
        return { ok: true, data };
      } catch {
        return failure('저장한 자료 요청을 읽지 못했습니다. 기존 기록을 보호하기 위해 변경을 멈췄습니다. 브라우저의 저장 설정과 기록을 확인해 주세요.');
      }
    }

    function list(projectId) {
      const result = read();
      if (!result.ok) return result;
      const requests = result.data.requests.filter((item) => item.projectId === projectId);
      let stage; try { stage = getStage ? getStage(projectId) : { ok: true, stage: 0 }; } catch { stage = { ok: false }; }
      return { ok: true, canWrite: stage.ok && stage.stage < 9,
        readOnlyReason: !stage.ok ? stage.error || '현재 프로젝트 단계를 확인하지 못해 자료를 읽기 전용으로 보관해요.' : stage.stage >= 9 ? '인증·등록 준비 이후에는 완료 근거를 보호하기 위해 자료를 읽기 전용으로 보관해요. 제출 내용과 검토 결과는 아래에서 확인할 수 있어요.' : '',
        items: requests.filter((item) => !item.deletedAt), deletedItems: requests.filter((item) => item.deletedAt) };
    }

    function listAll() {
      const result = read();
      if (!result.ok) return result;
      return { ok: true, items: result.data.requests.filter((item) => !item.deletedAt) };
    }

    function add(projectId, draft) {
      const errors = validate(draft);
      if (Object.keys(errors).length) return { ok: false, errors };
      if (!knownProjects.has(projectId)) return failure('프로젝트를 확인할 수 없습니다. 목록에서 다시 열어 주세요.');
      // 매번 최신 저장본을 읽어 다른 프로젝트의 기록과 번호를 이어 쓴다.
      const current = read();
      if (!current.ok) return current;
      if (current.data.requests.some((item) => !item.deletedAt && item.projectId === projectId && item.categoryKey === draft.categoryKey)) {
        return { ok: false, errors: { categoryKey: '이 프로젝트에 이미 등록한 자료 구분이에요. 다른 구분을 골라 주세요.' } };
      }
      const number = current.data.nextNumber;
      if (!Number.isSafeInteger(number + 1)) return failure('요청 번호를 만들 수 없습니다. 저장 기록을 확인해 주세요.');
      const item = {
        id: `DRQ-${String(number).padStart(4, '0')}`,
        projectId, categoryKey: draft.categoryKey, detail: draft.detail.trim(), dueDate: draft.dueDate,
        status: '요청', createdAt: new Date().toISOString(),
        guideline: LCA.constants.requestGuideline(draft.categoryKey)
      };
      const data = { ...current.data, nextNumber: number + 1, requests: [...current.data.requests, item] };
      try {
        getStorage().setItem(STORAGE_KEY, JSON.stringify(data));
        return { ok: true, item };
      } catch {
        return failure('브라우저에 저장하지 못했습니다. 입력 내용은 남겨 두었어요. 저장 공간이나 저장 허용 설정을 확인한 뒤 다시 등록해 주세요.');
      }
    }

    function changeDeleted(projectId, id, deleting) {
      if (!knownProjects.has(projectId)) return failure('프로젝트를 확인할 수 없습니다. 목록에서 다시 열어 주세요.');
      const current = read();
      if (!current.ok) return current;
      const item = current.data.requests.find((value) => value.projectId === projectId && value.id === id);
      if (!item || Boolean(item.deletedAt) === deleting) return failure('변경할 자료 요청을 찾지 못했습니다. 프로젝트를 다시 열어 확인해 주세요.');
      if (!deleting && current.data.requests.some((value) => !value.deletedAt && value.projectId === projectId && value.categoryKey === item.categoryKey)) {
        return failure('같은 자료 구분이 이미 등록되어 있어 복원할 수 없어요. 현재 요청을 먼저 확인해 주세요.');
      }
      const changed = { ...item };
      if (deleting) changed.deletedAt = new Date().toISOString();
      else delete changed.deletedAt;
      const data = { ...current.data, requests: current.data.requests.map((value) => value.id === id ? changed : value) };
      try {
        getStorage().setItem(STORAGE_KEY, JSON.stringify(data));
        return { ok: true, item: changed };
      } catch {
        return failure('변경 내용을 브라우저에 저장하지 못했습니다. 기존 요청은 그대로 두었어요. 저장 설정을 확인한 뒤 다시 시도해 주세요.');
      }
    }

    function recordReceipt(projectId, id, draft) {
      const errors = LCA.receivedData.validate(draft);
      if (Object.keys(errors).length) return { ok: false, errors };
      const current = read();
      if (!current.ok) return current;
      const item = current.data.requests.find((value) => value.projectId === projectId && value.id === id && !value.deletedAt);
      if (!knownProjects.has(projectId) || !item) return failure('받은 자료를 연결할 요청을 찾지 못했습니다. 프로젝트를 다시 열어 확인해 주세요.');
      const now = new Date().toISOString();
      const receipt = { ...LCA.receivedData.normalize(draft), recordedAt: item.receipt?.recordedAt || now, updatedAt: now };
      const changed = { ...item, status: '제출됨', receipt };
      // 보완 자료를 다시 기록하면 이전 체크와 결과를 지워 새 자료를 검토한다.
      delete changed.review;
      const data = { ...current.data, requests: current.data.requests.map((value) => value.id === id ? changed : value) };
      try {
        getStorage().setItem(STORAGE_KEY, JSON.stringify(data));
        return { ok: true, item: changed };
      } catch {
        return failure('받은 자료를 저장하지 못했습니다. 입력은 남겨 두었어요. 저장 설정을 확인한 뒤 다시 시도해 주세요.');
      }
    }

    function reviewItem(projectId, id) {
      const current = read();
      if (!current.ok) return current;
      const item = current.data.requests.find((value) => value.projectId === projectId && value.id === id && !value.deletedAt);
      if (!knownProjects.has(projectId) || !item?.receipt) return failure('검토할 받은 자료를 찾지 못했습니다. 프로젝트와 요청을 다시 확인해 주세요.');
      return { ok: true, data: current.data, item };
    }

    function writeReview(current, changed) {
      const data = { ...current.data, requests: current.data.requests.map((item) => item.id === changed.id ? changed : item) };
      try {
        getStorage().setItem(STORAGE_KEY, JSON.stringify(data));
        return { ok: true, item: changed };
      } catch {
        return failure('검토 내용을 저장하지 못했습니다. 기존 상태와 기록은 그대로예요. 저장 설정을 확인한 뒤 다시 시도해 주세요.');
      }
    }

    function startReview(projectId, id) {
      const current = reviewItem(projectId, id);
      if (!current.ok) return current;
      if (current.item.status === '검토 중') return { ok: true, item: current.item };
      if (current.item.status !== '제출됨') return failure('이미 검토 결과가 저장된 자료예요. 받은 자료를 다시 기록하면 새로 검토할 수 있어요.');
      const now = new Date().toISOString();
      return writeReview(current, { ...current.item, status: '검토 중', review: {
        checks: LCA.review.emptyChecks(), note: '', startedAt: now, updatedAt: now, receiptUpdatedAt: current.item.receipt.updatedAt
      } });
    }

    function saveReview(projectId, id, draft, action, expectedReview) {
      const errors = LCA.review.validate(draft, action);
      if (Object.keys(errors).length) return { ok: false, errors };
      const current = reviewItem(projectId, id);
      if (!current.ok) return current;
      if (current.item.status !== '검토 중' || !expectedReview || JSON.stringify(current.item.review) !== JSON.stringify(expectedReview)) {
        return failure('자료나 검토 기록이 바뀌었어요. 창을 닫고 다시 열어 최신 자료를 확인해 주세요.');
      }
      const review = { ...current.item.review, checks: Object.fromEntries(LCA.review.CHECKS.map(({ key }) => [key, draft.checks[key]])), note: draft.note.trim(), updatedAt: new Date().toISOString() };
      const status = action === 'approve' ? '승인' : action === 'revision' ? '보완 요청' : '검토 중';
      return writeReview(current, { ...current.item, status, review });
    }

    function writable(action) {
      return (projectId, ...args) => {
        if (getStage) {
          let result; try { result = getStage(projectId); } catch { return failure('프로젝트 단계를 확인하지 못해 저장을 중단했어요.'); }
          if (!result.ok) return failure(result.error || '프로젝트 단계를 확인하지 못했어요.');
          if (result.stage >= 9) return failure('인증·등록 준비를 시작한 뒤에는 완료 근거를 보호하기 위해 자료를 읽기 전용으로 보관해요.');
        }
        return action(projectId, ...args);
      };
    }
    return { list, listAll, add: writable(add), recordReceipt: writable(recordReceipt), startReview: writable(startReview), saveReview: writable(saveReview), remove: writable((projectId, id) => changeDeleted(projectId, id, true)), restore: writable((projectId, id) => changeDeleted(projectId, id, false)) };
  }

  return { STORAGE_KEY, MAX_DETAIL, validDate, formatDateInput, validate, createStore };
})();
