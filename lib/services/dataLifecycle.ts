import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { AccessError } from './workspaceAccess';

export const lifecycleTables: Record<string, string> = { task: 'tasks', note: 'notes', project: 'projects', followup: 'followups', meeting: 'calendar_events', notebook: 'notebooks', inbox: 'inbox_items', tracker: 'file_trackers' };
type Snapshot = { table: string; rows: Record<string, any>[] };
type Detached = { table: string; column: string; primary: Record<string, unknown>; value: unknown };

export function moveToTrash(db: Database.Database, type: string, id: string, workspaceId: string, userId: string) {
  const table = lifecycleTables[type];
  if (!table) throw new AccessError('Unsupported record type');
  return db.transaction(() => {
    const root = db.prepare(`SELECT * FROM ${table} WHERE id = ? AND workspace_id = ?`).get(id, workspaceId) as Record<string, any> | undefined;
    if (!root || root.visibility === 'private' && root.owner_user_id !== userId) throw new AccessError('Record not found', 404);
    if (type === 'meeting' && (root.source_id || root.calendar_source_id)) throw new AccessError('External events are managed by their calendar provider');
    const snapshots: Snapshot[] = [];
    const detached: Detached[] = [];
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[];
    const seen = new Set<string>();
    const collect = (parent: string, rows: Record<string, any>[]) => {
      const fresh = rows.filter((row) => { const key = `${parent}:${JSON.stringify(row)}`; if (seen.has(key)) return false; seen.add(key); return true; });
      if (!fresh.length) return;
      if (seen.size > 10000) throw new AccessError('Too many linked records. Archive this item instead.');
      snapshots.push({ table: parent, rows: fresh });
      for (const { name } of tables) {
        const foreignKeys = db.prepare(`PRAGMA foreign_key_list("${name}")`).all() as { table: string; from: string; to: string; on_delete: string }[];
        for (const foreign of foreignKeys.filter((key) => key.table === parent)) {
          for (const row of fresh) {
            const related = db.prepare(`SELECT * FROM "${name}" WHERE "${foreign.from}" = ?`).all(row[foreign.to || 'id']) as Record<string, any>[];
            if (foreign.on_delete === 'CASCADE') collect(name, related);
            else if (foreign.on_delete === 'SET NULL') {
              const keys = db.prepare(`PRAGMA table_info("${name}")`).all() as { name: string; pk: number }[];
              for (const child of related) detached.push({ table: name, column: foreign.from, value: child[foreign.from],
                primary: Object.fromEntries(keys.filter((key) => key.pk).map((key) => [key.name, child[key.name]])) });
            }
          }
        }
      }
    };
    collect(table, [root]);
    const trashId = randomUUID();
    const now = new Date();
    const setting = db.prepare("SELECT value FROM settings WHERE key = 'trash_retention_days'").get() as { value: string } | undefined;
    const days = Math.min(365, Math.max(1, Number(setting?.value) || 30));
    db.prepare('INSERT INTO trash_items VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(trashId, workspaceId, userId, type, id,
      root.title || root.name || root.content?.slice(0, 80) || type, JSON.stringify({ snapshots, detached }), now.toISOString(), new Date(now.getTime() + days * 86400000).toISOString());
    db.prepare(`DELETE FROM ${table} WHERE id = ? AND workspace_id = ?`).run(id, workspaceId);
    return { success: true, trash_id: trashId };
  })();
}

export function restoreTrash(db: Database.Database, trashId: string, workspaceId: string, userId: string) {
  return db.transaction(() => {
    const item = db.prepare('SELECT * FROM trash_items WHERE id = ? AND workspace_id = ? AND user_id = ?').get(trashId, workspaceId, userId) as { payload_json: string } | undefined;
    if (!item) throw new AccessError('Trash item not found', 404);
    const { snapshots, detached } = JSON.parse(item.payload_json) as { snapshots: Snapshot[]; detached: Detached[] };
    db.pragma('defer_foreign_keys = ON');
    for (const snapshot of snapshots) for (const row of snapshot.rows) {
      const columns = Object.keys(row);
      db.prepare(`INSERT INTO "${snapshot.table}" (${columns.map((column) => `"${column}"`).join(',')}) VALUES (${columns.map(() => '?').join(',')})`).run(...Object.values(row));
    }
    for (const link of detached) {
      const columns = Object.keys(link.primary);
      if (columns.length) db.prepare(`UPDATE "${link.table}" SET "${link.column}" = ? WHERE ${columns.map((column) => `"${column}" = ?`).join(' AND ')} AND "${link.column}" IS NULL`).run(link.value, ...Object.values(link.primary));
    }
    db.prepare('DELETE FROM trash_items WHERE id = ?').run(trashId);
    return { success: true };
  })();
}