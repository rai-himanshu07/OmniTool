import type Database from 'better-sqlite3';
import ExcelJS from 'exceljs';
import { AccessError } from './workspaceAccess';
import { getCalculatedProjectHealth } from './attentionEngine';

export type ReportRow = { kind: 'task' | 'project'; id: string; title: string; description: string | null; project_id: string | null; project_name: string | null; client_id: string | null; client_name: string | null; owner: string; person_id: string | null; status: string; priority: string; due_date: string | null; completed_at: string | null; created_at: string; archived: number; health?: string };

export function queryWorkReport(db: Database.Database, workspaceId: string, user: { name: string; person_id: string | null }, params: URLSearchParams, exporting = false) {
  const kind = params.get('kind') || 'all'; const status = params.get('status') || ''; const scope = params.get('scope') || 'workspace';
  const basis = params.get('date_basis') || 'due'; const from = params.get('from') || ''; const through = params.get('through') || '';
  if (!['all', 'task', 'project'].includes(kind) || !['workspace', 'mine'].includes(scope) || !['due', 'created', 'completed'].includes(basis) || !['', 'active', 'completed', 'waiting', 'cancelled', 'on_hold'].includes(status)) throw new AccessError('Invalid report filters');
  for (const date of [from, through]) if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date)) throw new AccessError('Invalid report date');
  if (from && through && from > through) throw new AccessError('The end date must follow the start date');
  const sql = `SELECT 'task' AS kind, t.id, t.title, t.description, t.project_id, p.name AS project_name, p.client_id, c.name AS client_name,
    t.owner, t.assignee_person_id AS person_id, t.status, t.priority, t.due_date, t.actual_completion AS completed_at, t.created_at, t.archived
    FROM tasks t LEFT JOIN projects p ON p.id = t.project_id LEFT JOIN clients c ON c.id = p.client_id WHERE t.workspace_id = ?
    UNION ALL SELECT 'project', p.id, p.name, p.description, p.id, p.name, p.client_id, c.name, p.owner, p.owner_person_id,
    CASE WHEN p.status IN ('completed', 'on_hold') THEN p.status ELSE 'active' END, p.priority, p.planned_delivery_date,
    p.actual_delivery_date, p.created_at, p.archived FROM projects p LEFT JOIN clients c ON c.id = p.client_id WHERE p.workspace_id = ?`;
  const filters: string[] = []; const values: any[] = [workspaceId, workspaceId];
  if (kind !== 'all') { filters.push('kind = ?'); values.push(kind); }
  if (scope === 'mine') { filters.push('((person_id IS NOT NULL AND person_id = ?) OR (person_id IS NULL AND lower(owner) = lower(?)))'); values.push(user.person_id, user.name); }
  for (const [name, column] of [['project_id', 'project_id'], ['client_id', 'client_id'], ['person_id', 'person_id'], ['priority', 'priority']]) {
    const value = params.get(name); if (value) { filters.push(`${column} = ?`); values.push(value); }
  }
  if (params.get('archived') !== 'true') filters.push('archived = 0');
  if (status === 'active') filters.push("status IN ('active', 'inbox', 'open', 'in_progress', 'waiting', 'blocked')");
  else if (status === 'completed') filters.push("status IN ('done', 'completed')");
  else if (status === 'waiting') filters.push("status IN ('waiting', 'blocked')");
  else if (status) { filters.push('status = ?'); values.push(status); }
  const query = (params.get('q') || '').trim().slice(0, 300);
  if (query) { filters.push("(instr(lower(title), lower(?)) > 0 OR instr(lower(COALESCE(description, '')), lower(?)) > 0)"); values.push(query, query); }
  const dateColumn = basis === 'created' ? 'created_at' : basis === 'completed' ? 'completed_at' : 'due_date';
  if (from) { filters.push(`substr(${dateColumn}, 1, 10) >= ?`); values.push(from); }
  if (through) { filters.push(`substr(${dateColumn}, 1, 10) <= ?`); values.push(through); }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const base = `FROM (${sql}) report ${where}`;
  const summary = db.prepare(`SELECT COUNT(*) AS total, SUM(CASE WHEN kind = 'task' THEN 1 ELSE 0 END) AS tasks,
    SUM(CASE WHEN kind = 'project' THEN 1 ELSE 0 END) AS projects,
    SUM(CASE WHEN status IN ('done', 'completed') THEN 1 ELSE 0 END) AS completed ${base}`).get(...values) as { total: number; tasks: number; projects: number; completed: number };
  if (exporting && summary.total > 10000) throw new AccessError('Export is limited to 10000 records. Narrow the filters first.');
  const limit = exporting ? 10000 : 50; const offset = exporting ? 0 : Math.max(0, Math.floor(Number(params.get('offset')) || 0));
  const rows = db.prepare(`SELECT * ${base} ORDER BY created_at DESC, kind, id LIMIT ? OFFSET ?`).all(...values, limit, offset) as ReportRow[];
  for (const row of rows) if (row.kind === 'project') row.health = getCalculatedProjectHealth(row.id);
  return { rows, summary: { total: summary.total, tasks: summary.tasks || 0, projects: summary.projects || 0, completed: summary.completed || 0 }, offset, limit, has_more: offset + rows.length < summary.total };
}

export function safeSpreadsheetText(value: unknown) {
  const text = value === null || value === undefined ? '' : String(value);
  return /^[\s\u0000-\u001f]*[=+\-@]/.test(text) ? `'${text}` : text;
}

export async function exportWorkReport(rows: ReportRow[], format: 'csv' | 'xlsx') {
  if (JSON.stringify(rows).length > 20 * 1024 * 1024) throw new AccessError('Report exceeds the export size limit. Narrow the filters.');
  if (format === 'xlsx' && rows.some((row) => Object.values(row).some((value) => typeof value === 'string' && value.length > 32767))) throw new AccessError('A value exceeds the Excel cell limit. Export CSV or narrow the report.');
  const workbook = new ExcelJS.Workbook(); const sheet = workbook.addWorksheet('Work Report');
  sheet.columns = [
    { header: 'Type', key: 'kind', width: 12 }, { header: 'Title', key: 'title', width: 40 }, { header: 'Project', key: 'project_name', width: 28 },
    { header: 'Client', key: 'client_name', width: 24 }, { header: 'Owner', key: 'owner', width: 24 }, { header: 'Status', key: 'status', width: 18 },
    { header: 'Health', key: 'health', width: 12 }, { header: 'Priority', key: 'priority', width: 14 }, { header: 'Due / Delivery', key: 'due_date', width: 20 },
    { header: 'Completed', key: 'completed_at', width: 26 }, { header: 'Created (UTC)', key: 'created_at', width: 26 }, { header: 'Archived', key: 'archived', width: 12 },
    { header: 'Description', key: 'description', width: 60 }, { header: 'Record ID', key: 'id', width: 38 },
  ];
  for (const row of rows) sheet.addRow(Object.fromEntries(Object.entries({ ...row, archived: row.archived ? 'Yes' : 'No' }).map(([key, value]) => [key, safeSpreadsheetText(value)])));
  sheet.views = [{ state: 'frozen', ySplit: 1 }]; sheet.autoFilter = { from: 'A1', to: 'N1' };
  sheet.getRow(1).font = { bold: true }; sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7EEE9' } };
  return Buffer.from(format === 'csv' ? await workbook.csv.writeBuffer() : await workbook.xlsx.writeBuffer());
}