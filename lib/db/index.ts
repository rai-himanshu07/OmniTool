import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { SCHEMA_SQL } from './schema';

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'omnitool.db');

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (dbInstance) return dbInstance;

  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  dbInstance = new Database(DB_PATH);
  dbInstance.pragma('journal_mode = WAL');
  dbInstance.pragma('foreign_keys = ON');

  // Initialize schema
  dbInstance.exec(SCHEMA_SQL);

  // Additive migrations for columns introduced after the initial release —
  // safe to run on every startup, never destroys existing data.
  runMigrations(dbInstance);

  // Seed default workspace and sample data if database is empty
  seedInitialData(dbInstance);

  return dbInstance;
}

function ensureColumn(db: Database.Database, table: string, column: string, definition: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function runMigrations(db: Database.Database) {
  ensureColumn(db, 'recurrence_instances', 'task_id', 'TEXT');
  ensureColumn(db, 'secure_vault_meta', 'kdf_iterations', 'INTEGER NOT NULL DEFAULT 100000');
  ensureColumn(db, 'calendar_events', 'calendar_source_id', 'TEXT');
  ensureColumn(db, 'followups', 'resolved_at', 'TEXT');
  db.prepare(`UPDATE followups SET resolved_at = last_activity_at WHERE status IN ('resolved', 'cancelled') AND resolved_at IS NULL`).run();
  ensureColumn(db, 'followups', 'tags_json', "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn(db, 'projects', 'owner_person_id', 'TEXT REFERENCES people(id) ON DELETE SET NULL');
  ensureColumn(db, 'tasks', 'assignee_person_id', 'TEXT REFERENCES people(id) ON DELETE SET NULL');
  ensureColumn(db, 'followups', 'waiting_on_person_id', 'TEXT REFERENCES people(id) ON DELETE SET NULL');
  db.transaction(() => {
    const migrated = db.prepare(`SELECT value FROM settings WHERE key = 'qc_checklist_migration_v1'`).get();
    if (migrated) return;
    db.prepare(`INSERT OR IGNORE INTO qc_checklists (id, workspace_id, template_id, project_id, title, created_at)
      SELECT 'legacy:' || id, workspace_id, id, project_id, title, created_at
      FROM qc_templates WHERE project_id IS NOT NULL`).run();
    db.prepare(`INSERT OR IGNORE INTO qc_checklist_items (id, checklist_id, title, is_checked, notes, reviewer, created_at)
      SELECT 'legacy:' || i.id, 'legacy:' || i.template_id, i.title, i.is_checked, i.notes, i.reviewer, i.created_at
      FROM qc_items i JOIN qc_templates t ON t.id = i.template_id WHERE t.project_id IS NOT NULL`).run();
    db.prepare(`INSERT INTO settings (key, value, updated_at) VALUES ('qc_checklist_migration_v1', 'done', ?)`)
      .run(new Date().toISOString());
  })();
}

export function getSetting(key: string): string | null {
  const db = getDb();
  const row = db.prepare(`SELECT value FROM settings WHERE key = ?`).get(key) as { value: string } | undefined;
  return row ? row.value : null;
}

export function setSetting(key: string, value: string): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).run(key, value, now);
}

export function getDefaultWorkspaceId(): string {
  const db = getDb();
  const row = db.prepare(`SELECT id FROM workspaces LIMIT 1`).get() as { id: string } | undefined;
  if (row) return row.id;

  const newId = uuidv4();
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO workspaces (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)`).run(
    newId,
    'Personal Workspace',
    now,
    now
  );
  return newId;
}

function seedInitialData(db: Database.Database) {
  const count = db.prepare(`SELECT COUNT(*) as c FROM workspaces`).get() as { c: number };
  if (count.c > 0) return;

  const now = new Date();
  const nowIso = now.toISOString();
  const wsId = uuidv4();

  db.prepare(`INSERT INTO workspaces (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)`).run(
    wsId,
    'Personal Workspace',
    nowIso,
    nowIso
  );

  // 1. Client ABC
  const clientId = uuidv4();
  db.prepare(
    `INSERT INTO clients (id, workspace_id, name, code, contact_person, email, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(clientId, wsId, 'Client ABC', 'ABC', 'Sarah Jenkins', 'sarah@clientabc.com', nowIso);

  // 2. Client XYZ
  const clientXyzId = uuidv4();
  db.prepare(
    `INSERT INTO clients (id, workspace_id, name, code, contact_person, email, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(clientXyzId, wsId, 'Client XYZ', 'XYZ', 'David Vance', 'david@xyzcorp.io', nowIso);

  // 3. Project 1: P&ID Extraction
  const proj1Id = uuidv4();
  const deliveryDate1 = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // +3 days
  db.prepare(
    `INSERT INTO projects (id, workspace_id, client_id, name, code, description, owner, status, priority, planned_delivery_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    proj1Id,
    wsId,
    clientId,
    'P&ID Extraction',
    'PID-01',
    'Extract and validate process instrumentation diagrams for plant upgrade',
    'Himanshu',
    'amber',
    'high',
    deliveryDate1,
    nowIso,
    nowIso
  );

  // 4. Project 2: Internal Automation
  const proj2Id = uuidv4();
  const deliveryDate2 = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  db.prepare(
    `INSERT INTO projects (id, workspace_id, client_id, name, code, description, owner, status, priority, planned_delivery_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    proj2Id,
    wsId,
    clientXyzId,
    'XYZ Automation Pipeline',
    'AUT-02',
    'Automate monthly data ingestion and quality audit reports',
    'Himanshu',
    'green',
    'medium',
    deliveryDate2,
    nowIso,
    nowIso
  );

  // 5. Tasks for Project 1
  const task1Id = uuidv4();
  const yesterday = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  db.prepare(
    `INSERT INTO tasks (id, workspace_id, project_id, title, description, owner, status, priority, due_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    task1Id,
    wsId,
    proj1Id,
    'Finalize connectivity analysis report',
    'Review connectivity graph against engineer notes before client delivery',
    'Himanshu',
    'in_progress',
    'critical',
    yesterday, // Overdue task for attention engine demo!
    nowIso,
    nowIso
  );

  const task2Id = uuidv4();
  db.prepare(
    `INSERT INTO tasks (id, workspace_id, project_id, title, description, owner, status, priority, due_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    task2Id,
    wsId,
    proj1Id,
    'Validate extraction tags',
    'Ensure all instrument tag numbers match standard ISO legend',
    'Ravi',
    'waiting',
    'high',
    deliveryDate1,
    nowIso,
    nowIso
  );

  // Task Dependency
  db.prepare(
    `INSERT INTO task_dependencies (id, task_id, depends_on_task_id, dependency_type, created_at) VALUES (?, ?, ?, ?, ?)`
  ).run(uuidv4(), task1Id, task2Id, 'blocking', nowIso);

  // Subtasks
  db.prepare(
    `INSERT INTO subtasks (id, task_id, title, status, position, created_at) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(uuidv4(), task1Id, 'Cross-check line designations', 'done', 0, nowIso);
  db.prepare(
    `INSERT INTO subtasks (id, task_id, title, status, position, created_at) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(uuidv4(), task1Id, 'Format executive summary section', 'open', 1, nowIso);

  // 6. Follow-ups (Aged follow-up waiting 3 days on Ravi)
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare(
    `INSERT INTO followups (id, workspace_id, project_id, task_id, title, owner, waiting_on_person, category, expected_date, priority, status, created_at, last_activity_at, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    uuidv4(),
    wsId,
    proj1Id,
    task2Id,
    'QC Review & Extraction Validation',
    'Himanshu',
    'Ravi',
    'waiting_response',
    deliveryDate1,
    'high',
    'waiting',
    threeDaysAgo,
    threeDaysAgo,
    'Ravi is reviewing the extracted tags file. Expected back by Wednesday.'
  );

  db.prepare(
    `INSERT INTO followups (id, workspace_id, project_id, title, owner, waiting_on_person, category, expected_date, priority, status, created_at, last_activity_at, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    uuidv4(),
    wsId,
    proj2Id,
    'Client Approval for API Key Access',
    'Himanshu',
    'David Vance (XYZ)',
    'waiting_approval',
    new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    'medium',
    'waiting',
    nowIso,
    nowIso,
    'Submitted requested scope document for read-only Graph API access.'
  );

  // 7. Recurring Obligations
  const nextMonday = new Date(now.getTime() + (8 - now.getDay()) * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  db.prepare(
    `INSERT INTO recurring_obligations (id, workspace_id, project_id, title, description, frequency, recurrence_rule, next_due_date, active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    uuidv4(),
    wsId,
    proj1Id,
    'Weekly Client Status Update Report',
    'Compile task completion metrics and send status email to Client ABC',
    'weekly',
    'Every Monday',
    nextMonday,
    1,
    nowIso
  );

  // 8. QC Template & Items
  const qcTempId = uuidv4();
  db.prepare(
    `INSERT INTO qc_templates (id, workspace_id, project_id, title, description, created_at) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(qcTempId, wsId, proj1Id, 'P&ID Delivery QC Standard', 'Quality control checklist before final release', nowIso);

  db.prepare(
    `INSERT INTO qc_items (id, template_id, project_id, title, is_checked, reviewer, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(uuidv4(), qcTempId, proj1Id, 'Tags validated against index', 1, 'Ravi', nowIso);
  db.prepare(
    `INSERT INTO qc_items (id, template_id, project_id, title, is_checked, reviewer, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(uuidv4(), qcTempId, proj1Id, 'Equipment connectivity verified', 0, 'Himanshu', nowIso);
  db.prepare(
    `INSERT INTO qc_items (id, template_id, project_id, title, is_checked, reviewer, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(uuidv4(), qcTempId, proj1Id, 'Missing values flagged and noted', 0, 'Himanshu', nowIso);

  // 9. Notes
  db.prepare(
    `INSERT INTO notes (id, workspace_id, project_id, client_id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    uuidv4(),
    wsId,
    proj1Id,
    clientId,
    'Client ABC Requirements Brief',
    'Client highlighted that connectivity analysis must include emergency shutdown valve triggers (ESDVs). Deliverable format: PDF + CSV data dump.',
    nowIso,
    nowIso
  );

  // 10. Inbox Item
  db.prepare(
    `INSERT INTO inbox_items (id, workspace_id, content, source, status, created_at) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    uuidv4(),
    wsId,
    'Client ABC requested revised report formatting with company logo included by Friday.',
    'quick_capture',
    'raw',
    nowIso
  );

  // 11. Calendar Event
  const meetingStart = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);
  meetingStart.setHours(10, 0, 0, 0);
  const meetingEnd = new Date(meetingStart.getTime() + 45 * 60 * 1000);

  db.prepare(
    `INSERT INTO calendar_events (id, workspace_id, title, start_time, end_time, location, is_all_day, related_project_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    uuidv4(),
    wsId,
    'Client ABC Weekly Alignment Call',
    meetingStart.toISOString(),
    meetingEnd.toISOString(),
    'Teams Meeting',
    0,
    proj1Id,
    nowIso
  );

  // 12. Activity Log
  db.prepare(
    `INSERT INTO activity_log (id, workspace_id, entity_type, entity_id, action, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(wsId, wsId, 'system', wsId, 'workspace_seeded', 'OmniTool workspace initialized with default sample data.', nowIso);
}
