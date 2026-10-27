import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../app/chatgpt-auth";

export const MAX_BYTES = 1_000_000;
const names = ["projects", "researchers", "scope", "requests", "modelling", "interpretation", "report", "comments", "verification", "certification", "review-route"];
const keys = names.map(name => `ecoable-lca-manager.${name}.v1`);
export const reply = (body: unknown, status = 200) => Response.json(body, {
  status, headers: { "Cache-Control": "private, no-store", "Vary": "Cookie", "X-Content-Type-Options": "nosniff" },
});
export async function session() {
  const user = await getChatGPTUser();
  return user ? { id: user.userId, name: user.displayName } : null;
}
function validPayload(value: any) {
  if (!value || value.format !== "lca-project-manager-backup" || value.version !== 1
    || Object.keys(value).sort().join() !== ["format", "version", "createdAt", "sampleDate", "records"].sort().join()
    || typeof value.createdAt !== "string" || !Number.isFinite(Date.parse(value.createdAt))
    || !/^\d{4}-\d{2}-\d{2}$/.test(value.sampleDate || "")) return false;
  const date = new Date(`${value.sampleDate}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value.sampleDate) return false;
  const records = value.records;
  if (!records || typeof records !== "object" || Array.isArray(records)
    || Object.keys(records).length !== keys.length || !keys.every(key => Object.hasOwn(records, key))) return false;
  return keys.every(key => {
    if (records[key] === null) return true;
    if (typeof records[key] !== "string") return false;
    try { const item = JSON.parse(records[key]); return item && typeof item === "object" && !Array.isArray(item); }
    catch { return false; }
  });
}
async function readLimited(request: Request) {
  if (Number(request.headers.get("Content-Length")) > MAX_BYTES) throw new Error("too-large");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("invalid");
  const parts: Uint8Array[] = []; let length = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      length += chunk.value.byteLength;
      if (length > MAX_BYTES) { await reader.cancel(); throw new Error("too-large"); }
      parts.push(chunk.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}
export async function readWorkspace(request: Request) {
  const user = await session();
  if (!user) return reply({ error: "로그인 후 내 서버 기록을 열 수 있어요." }, 401);
  if (request.headers.get("X-LCA-Account") !== user.id) return reply({ error: "로그인 계정이 바뀌었어요. 기록을 보관한 뒤 다시 로그인해 주세요." }, 403);
  if (!env.DB) return reply({ error: "서버 저장소를 연결하지 못했어요. 잠시 후 다시 시도해 주세요." }, 503);
  try {
    const row = await env.DB.prepare("SELECT payload, revision, updated_at FROM lca_workspaces WHERE user_id = ?").bind(user.id).first<any>();
    return reply({ revision: row?.revision || 0, updatedAt: row?.updated_at || null, data: row ? JSON.parse(row.payload) : null });
  } catch { return reply({ error: "서버 기록을 읽지 못했어요. 현재 기기의 기록은 보관해 주세요." }, 503); }
}
export async function writeWorkspace(request: Request) {
  const user = await session();
  if (!user) return reply({ error: "로그인이 필요해요." }, 401);
  if (request.headers.get("X-LCA-Account") !== user.id) return reply({ error: "로그인 계정이 바뀌었어요. 기록을 보관한 뒤 다시 로그인해 주세요." }, 403);
  if (request.headers.get("Origin") !== new URL(request.url).origin
    || request.headers.get("Content-Type")?.split(";")[0].trim() !== "application/json") return reply({ error: "이 사이트의 저장 화면에서 다시 시도해 주세요." }, 403);
  if (!env.DB) return reply({ error: "서버 저장소를 연결하지 못했어요." }, 503);
  let body: any;
  try { body = await readLimited(request); }
  catch (error) { return reply({ error: error instanceof Error && error.message === "too-large" ? "서버 저장은 기록 묶음 1MB까지 지원해요. 백업 파일로 기록을 보관해 주세요." : "저장 요청을 읽을 수 없어요." }, error instanceof Error && error.message === "too-large" ? 413 : 400); }
  if (!body || Object.keys(body).sort().join() !== ["revision", "writeId", "data"].sort().join()
    || !Number.isSafeInteger(body.revision) || body.revision < 0 || body.revision >= Number.MAX_SAFE_INTEGER
    || typeof body.writeId !== "string" || !/^[a-zA-Z0-9-]{16,80}$/.test(body.writeId) || !validPayload(body.data)) return reply({ error: "지원하지 않는 기록 형식이에요." }, 400);
  const payload = JSON.stringify(body.data); const updatedAt = new Date().toISOString();
  try {
    const statement = body.revision === 0
      ? env.DB.prepare("INSERT INTO lca_workspaces (user_id, payload, revision, updated_at, last_write_id) VALUES (?, ?, 1, ?, ?) ON CONFLICT(user_id) DO NOTHING RETURNING revision, updated_at").bind(user.id, payload, updatedAt, body.writeId)
      : env.DB.prepare("UPDATE lca_workspaces SET payload = ?, revision = revision + 1, updated_at = ?, last_write_id = ? WHERE user_id = ? AND revision = ? RETURNING revision, updated_at").bind(payload, updatedAt, body.writeId, user.id, body.revision);
    const saved = await statement.first<any>();
    if (saved) return reply({ revision: saved.revision, updatedAt: saved.updated_at });
    // 응답만 잃은 같은 요청을 재시도해도 버전을 다시 올리거나 덮어쓰지 않는다.
    const previous = await env.DB.prepare("SELECT revision, updated_at, last_write_id, payload FROM lca_workspaces WHERE user_id = ?").bind(user.id).first<any>();
    if (previous?.last_write_id === body.writeId && previous.payload === payload) return reply({ revision: previous.revision, updatedAt: previous.updated_at });
    return reply({ error: "다른 기기에서 먼저 저장한 기록이 있어요. 이 기기의 기록을 백업한 뒤 서버 최신 기록을 열어 주세요." }, 409);
  } catch { return reply({ error: "서버에 저장하지 못했어요. 이 기기의 기록을 보관한 뒤 다시 시도해 주세요." }, 503); }
}
