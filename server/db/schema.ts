import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// 이 앱의 여러 기록을 한 버전으로 보관해 프로젝트·자료·보고서의 연결을 유지한다.
export const workspaces = sqliteTable("lca_workspaces", {
  userId: text("user_id").primaryKey(),
  payload: text("payload").notNull(),
  revision: integer("revision").notNull(),
  updatedAt: text("updated_at").notNull(),
  lastWriteId: text("last_write_id").notNull(),
});
