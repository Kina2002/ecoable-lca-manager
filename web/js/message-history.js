/* 외부에서 실제 보낸 요청문의 사본을 보관한다. 발송 기능은 없다. */
window.LCA = window.LCA || {};
LCA.messageHistory = (() => {
  const TYPES = ['initial', 'reminder', 'upcoming', 'revision', 'info'];
  const CHANNELS = ['메일', '메신저', '기타'];
  const FIELDS = ['projectId', 'companyName', 'productName', 'type', 'channel', 'recipient', 'actor', 'title', 'body', 'targets', 'sentAt', 'basisChanged', 'token'];
  const text = (value, max) => typeof value === 'string' && !!value.trim() && value.length <= max;
  function sentTime(day, time) {
    if (!LCA.requests.validDate(day) || typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
    return new Date(`${day}T${time}:00+09:00`).toISOString();
  }
  function validContent(value) {
    return value && text(value.projectId, 100) && text(value.companyName, 100) && text(value.productName, 100)
      && TYPES.includes(value.type) && CHANNELS.includes(value.channel) && text(value.recipient, 500) && text(value.actor, 100)
      && text(value.title, 500) && !/[\r\n]/.test(value.title) && text(value.body, 40000)
      && !/\[입력 필요:/.test(value.title + value.body)
      && Array.isArray(value.targets) && value.targets.length > 0 && value.targets.length <= 30
      && new Set(value.targets).size === value.targets.length && value.targets.every((id) => typeof id === 'string' && /^[a-zA-Z0-9:_-]{1,100}$/.test(id))
      && typeof value.sentAt === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value.sentAt)
      && Number.isFinite(Date.parse(value.sentAt)) && typeof value.basisChanged === 'boolean'
      && LCA.requests.validDate(value.sentAt.slice(0, 10)) && new Date(value.sentAt).toISOString() === value.sentAt
      && typeof value.token === 'string' && /^[a-zA-Z0-9-]{8,100}$/.test(value.token);
  }
  function validLog(log, projectIds) {
    if (log === undefined) return true;
    if (!log || !Number.isSafeInteger(log.nextNumber) || log.nextNumber < 1 || !Array.isArray(log.items)) return false;
    const ids = new Set(); const tokens = new Set();
    return log.items.every((item) => {
      if (!validContent(item) || !projectIds.has(item.projectId) || !/^MSG-\d{4,}$/.test(item.id) || ids.has(item.id) || tokens.has(item.token)
        || !Number.isSafeInteger(Number(item.id.slice(4))) || Number(item.id.slice(4)) < 1 || Number(item.id.slice(4)) >= log.nextNumber
        || typeof item.recordedAt !== 'string' || !Number.isFinite(Date.parse(item.recordedAt)) || Date.parse(item.sentAt) > Date.parse(item.recordedAt)) return false;
      ids.add(item.id); tokens.add(item.token); return true;
    });
  }
  return { TYPES, CHANNELS, FIELDS, sentTime, validContent, validLog };
})();
