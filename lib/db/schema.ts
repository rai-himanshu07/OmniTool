export interface Workspace {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Person {
  id: string;
  workspace_id: string;
  name: string;
  email?: string;
  title?: string;
  active: number;
  created_at: string;
}

export interface Team {
  id: string;
  workspace_id: string;
  name: string;
  description?: string;
  active: number;
  created_at: string;
}

export interface Client {
  id: string;
  workspace_id: string;
  name: string;
  code?: string;
  contact_person?: string;
  email?: string;
  created_at: string;
}

export interface Project {
  id: string;
  workspace_id: string;
  client_id?: string;
  name: string;
  code?: string;
  description?: string;
  owner: string;
  owner_person_id?: string;
  status: 'green' | 'amber' | 'red' | 'completed' | 'on_hold';
  status_override?: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  start_date?: string;
  planned_delivery_date?: string;
  actual_delivery_date?: string;
  created_at: string;
  updated_at: string;
  // Join fields
  client_name?: string;
  tasks_count?: number;
  overdue_tasks_count?: number;
  open_followups_count?: number;
}

export interface Task {
  id: string;
  workspace_id: string;
  project_id?: string;
  workstream_id?: string;
  title: string;
  description?: string;
  owner: string;
  assignee_person_id?: string;
  status: 'inbox' | 'open' | 'in_progress' | 'blocked' | 'waiting' | 'done' | 'cancelled';
  priority: 'critical' | 'high' | 'medium' | 'low';
  start_date?: string;
  due_date?: string;
  planned_completion?: string;
  actual_completion?: string;
  created_at: string;
  updated_at: string;
  // Join fields
  project_name?: string;
  subtasks?: Subtask[];
  dependencies?: TaskDependency[];
}

export interface Subtask {
  id: string;
  task_id: string;
  title: string;
  status: 'open' | 'done';
  position: number;
  created_at: string;
}

export interface TaskDependency {
  id: string;
  task_id: string;
  depends_on_task_id: string;
  depends_on_title?: string;
  depends_on_status?: string;
  dependency_type: 'blocking' | 'related';
  created_at: string;
}

export interface Followup {
  id: string;
  workspace_id: string;
  project_id?: string;
  task_id?: string;
  title: string;
  owner: string;
  waiting_on_person: string;
  waiting_on_person_id?: string;
  category: 'i_do' | 'someone_does' | 'waiting_response' | 'waiting_approval' | 'i_promised' | 'blocked';
  expected_date?: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'waiting' | 'resolved' | 'escalated' | 'cancelled';
  created_at: string;
  last_activity_at: string;
  resolved_at?: string;
  notes?: string;
  tags_json?: string;
  // Derived fields
  project_name?: string;
  task_title?: string;
  waiting_days?: number;
}

export interface RecurringObligation {
  id: string;
  workspace_id: string;
  project_id?: string;
  title: string;
  description?: string;
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly' | 'working_days';
  recurrence_rule: string; // e.g. "every Monday", "5th_working_day", "last_working_day"
  next_due_date: string;
  active: number; // 1 or 0
  created_at: string;
  project_name?: string;
}

export interface RecurrenceInstance {
  id: string;
  obligation_id: string;
  due_date: string;
  status: 'pending' | 'completed' | 'skipped';
  completed_at?: string;
  task_id?: string;
}

export interface FocusItem {
  id: string;
  workspace_id: string;
  focus_date: string;
  entity_type: 'task' | 'followup';
  entity_id: string;
  position: number;
  next_action: string;
  state: 'active' | 'completed' | 'carried' | 'removed';
  created_at: string;
  updated_at: string;
  title?: string;
  project_name?: string;
  entity_status?: string;
}

export interface QcTemplate {
  id: string;
  workspace_id: string;
  project_id?: string;
  title: string;
  description?: string;
  created_at: string;
  items?: QcItem[];
}

export interface QcItem {
  id: string;
  template_id?: string;
  project_id?: string;
  task_id?: string;
  title: string;
  is_checked: number; // 1 or 0
  notes?: string;
  reviewer?: string;
  created_at: string;
}

export interface QcChecklist {
  id: string;
  workspace_id: string;
  template_id?: string;
  project_id?: string;
  task_id?: string;
  deliverable_id?: string;
  title: string;
  created_at: string;
  items?: QcItem[];
}

export interface Note {
  id: string;
  workspace_id: string;
  project_id?: string;
  task_id?: string;
  client_id?: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  project_name?: string;
}

export interface Notebook {
  id: string;
  workspace_id: string;
  name: string;
  description?: string;
  archived: number;
  created_at: string;
  updated_at: string;
  page_count?: number;
}

export interface NotebookPage {
  id: string;
  notebook_id: string;
  title: string;
  section?: string;
  archived: number;
  content_json: string;
  plain_text: string;
  created_at: string;
  updated_at: string;
}

export interface SecureVaultMeta {
  id: string;
  workspace_id: string;
  is_initialized: number;
  key_salt: string;
  test_ciphertext: string;
  test_iv: string;
  updated_at: string;
}

export interface SecureNote {
  id: string;
  workspace_id: string;
  title_encrypted: string;
  title_iv: string;
  content_encrypted: string;
  content_iv: string;
  created_at: string;
  updated_at: string;
}

export interface InboxItem {
  id: string;
  workspace_id: string;
  content: string;
  source: string;
  status: 'raw' | 'triaged' | 'archived';
  converted_to_type?: 'task' | 'followup' | 'note' | 'reminder';
  converted_to_id?: string;
  created_at: string;
}

export interface CalendarEvent {
  id: string;
  workspace_id: string;
  source_id?: string;
  calendar_source_id?: string;
  title: string;
  start_time: string;
  end_time: string;
  location?: string;
  is_all_day: number;
  external_link?: string;
  related_project_id?: string;
  created_at: string;
}

export interface CalendarSource {
  id: string;
  workspace_id: string;
  provider: string;
  display_name?: string;
  tenant_id: string;
  client_id: string;
  client_secret_enc: string;
  client_secret_iv: string;
  access_token_enc?: string;
  access_token_iv?: string;
  refresh_token_enc?: string;
  refresh_token_iv?: string;
  token_expires_at?: string;
  delta_link?: string;
  account_email?: string;
  last_synced_at?: string;
  last_sync_error?: string;
  created_at: string;
  updated_at: string;
}

export interface ActivityLog {
  id: string;
  workspace_id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  details: string;
  created_at: string;
}

export interface Reminder {
  id: string;
  workspace_id: string;
  entity_type: string;
  entity_id: string;
  remind_at: string;
  message?: string;
  is_fired: number;
  created_at: string;
}

export interface Notification {
  id: string;
  workspace_id: string;
  type: string;
  title: string;
  message: string;
  entity_type?: string;
  entity_id?: string;
  is_read: number;
  created_at: string;
}

export interface Deliverable {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed';
  due_date?: string;
  completed_at?: string;
  created_at: string;
}

export interface NoteLink {
  id: string;
  note_id: string;
  linked_entity_type: string;
  linked_entity_id: string;
  created_at: string;
}

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS account_roles (
  user_id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'member', 'viewer')),
  person_id TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS account_invitations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'member', 'viewer')),
  person_id TEXT,
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS screen_lock_settings (
  user_id TEXT PRIMARY KEY,
  salt TEXT NOT NULL,
  hash TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS people (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  title TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS team_memberships (
  team_id TEXT NOT NULL,
  person_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  PRIMARY KEY (team_id, person_id),
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS project_teams (
  project_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  PRIMARY KEY (project_id, team_id),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS project_people (
  project_id TEXT NOT NULL,
  person_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  PRIMARY KEY (project_id, person_id),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  code TEXT,
  contact_person TEXT,
  email TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  client_id TEXT,
  name TEXT NOT NULL,
  code TEXT,
  description TEXT,
  owner TEXT NOT NULL DEFAULT 'User',
  owner_person_id TEXT REFERENCES people(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'green',
  status_override TEXT,
  priority TEXT NOT NULL DEFAULT 'medium',
  start_date TEXT,
  planned_delivery_date TEXT,
  actual_delivery_date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS workstreams (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  project_id TEXT,
  workstream_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  owner TEXT NOT NULL DEFAULT 'User',
  assignee_person_id TEXT REFERENCES people(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'medium',
  start_date TEXT,
  due_date TEXT,
  planned_completion TEXT,
  actual_completion TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
  FOREIGN KEY (workstream_id) REFERENCES workstreams(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS subtasks (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS task_dependencies (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  depends_on_task_id TEXT NOT NULL,
  dependency_type TEXT NOT NULL DEFAULT 'blocking',
  created_at TEXT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (depends_on_task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS followups (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  project_id TEXT,
  task_id TEXT,
  title TEXT NOT NULL,
  owner TEXT NOT NULL DEFAULT 'User',
  waiting_on_person TEXT NOT NULL,
  waiting_on_person_id TEXT REFERENCES people(id) ON DELETE SET NULL,
  category TEXT NOT NULL DEFAULT 'waiting_response',
  expected_date TEXT,
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'waiting',
  created_at TEXT NOT NULL,
  last_activity_at TEXT NOT NULL,
  resolved_at TEXT,
  notes TEXT,
  tags_json TEXT NOT NULL DEFAULT '[]',
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS recurring_obligations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  project_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  frequency TEXT NOT NULL DEFAULT 'weekly',
  recurrence_rule TEXT NOT NULL,
  next_due_date TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS recurrence_instances (
  id TEXT PRIMARY KEY,
  obligation_id TEXT NOT NULL,
  due_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  completed_at TEXT,
  FOREIGN KEY (obligation_id) REFERENCES recurring_obligations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS daily_focus (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  focus_date TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('task', 'followup')),
  entity_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  next_action TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'completed', 'carried', 'removed')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  UNIQUE (workspace_id, focus_date, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS daily_focus_date_idx ON daily_focus(workspace_id, focus_date, state, position);

CREATE TABLE IF NOT EXISTS weekly_reviews (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  week_start TEXT NOT NULL,
  wins TEXT NOT NULL DEFAULT '',
  risks TEXT NOT NULL DEFAULT '',
  next_week TEXT NOT NULL DEFAULT '',
  completed_at TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (workspace_id, user_id, week_start)
);

CREATE TABLE IF NOT EXISTS qc_templates (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  project_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS qc_items (
  id TEXT PRIMARY KEY,
  template_id TEXT,
  project_id TEXT,
  task_id TEXT,
  title TEXT NOT NULL,
  is_checked INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  reviewer TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (template_id) REFERENCES qc_templates(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS qc_checklists (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  template_id TEXT,
  project_id TEXT,
  task_id TEXT,
  deliverable_id TEXT,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (template_id) REFERENCES qc_templates(id) ON DELETE SET NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (deliverable_id) REFERENCES deliverables(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS qc_checklist_items (
  id TEXT PRIMARY KEY,
  checklist_id TEXT NOT NULL,
  title TEXT NOT NULL,
  is_checked INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  reviewer TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (checklist_id) REFERENCES qc_checklists(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  project_id TEXT,
  task_id TEXT,
  client_id TEXT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notebooks (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notebook_pages (
  id TEXT PRIMARY KEY,
  notebook_id TEXT NOT NULL,
  title TEXT NOT NULL,
  section TEXT,
  archived INTEGER NOT NULL DEFAULT 0,
  content_json TEXT NOT NULL,
  plain_text TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (notebook_id) REFERENCES notebooks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notebook_revisions (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content_json TEXT NOT NULL,
  saved_at TEXT NOT NULL,
  FOREIGN KEY (page_id) REFERENCES notebook_pages(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS notebook_pages_notebook_idx ON notebook_pages(notebook_id, updated_at);
CREATE INDEX IF NOT EXISTS notebook_revisions_page_idx ON notebook_revisions(page_id, saved_at);

CREATE TABLE IF NOT EXISTS secure_vault_meta (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL UNIQUE,
  is_initialized INTEGER NOT NULL DEFAULT 0,
  key_salt TEXT NOT NULL,
  test_ciphertext TEXT NOT NULL,
  test_iv TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS secure_notes (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  title_encrypted TEXT NOT NULL,
  title_iv TEXT NOT NULL,
  content_encrypted TEXT NOT NULL,
  content_iv TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS inbox_items (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  content TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'quick_capture',
  status TEXT NOT NULL DEFAULT 'raw',
  converted_to_type TEXT,
  converted_to_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS calendar_events (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  source_id TEXT,
  title TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  location TEXT,
  is_all_day INTEGER NOT NULL DEFAULT 0,
  external_link TEXT,
  related_project_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS activity_log (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  details TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- FTS5 virtual table for full-text search
CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
  entity_type, entity_id UNINDEXED, title, content, project_name,
  tokenize='porter unicode61'
);

-- Reminders
CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  entity_type TEXT NOT NULL, -- 'task', 'followup', 'project', 'recurring'
  entity_id TEXT NOT NULL,
  remind_at TEXT NOT NULL,
  message TEXT,
  is_fired INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  type TEXT NOT NULL, -- 'overdue', 'due_soon', 'followup_aging', 'recurring_due', 'reminder'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

-- Deliverables
CREATE TABLE IF NOT EXISTS deliverables (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  due_date TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Note Links (polymorphic linking)
CREATE TABLE IF NOT EXISTS note_links (
  id TEXT PRIMARY KEY,
  note_id TEXT NOT NULL,
  linked_entity_type TEXT NOT NULL, -- 'project', 'task', 'followup', 'meeting', 'deliverable', 'client'
  linked_entity_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
);

-- Microsoft Graph (or future provider) calendar connection. Tokens/secrets are
-- encrypted at rest by lib/services/serverCrypto.ts; never stored in plaintext.
CREATE TABLE IF NOT EXISTS calendar_sources (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'microsoft',
  display_name TEXT,
  tenant_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  client_secret_enc TEXT NOT NULL,
  client_secret_iv TEXT NOT NULL,
  access_token_enc TEXT,
  access_token_iv TEXT,
  refresh_token_enc TEXT,
  refresh_token_iv TEXT,
  token_expires_at TEXT,
  delta_link TEXT,
  account_email TEXT,
  last_synced_at TEXT,
  last_sync_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_followups_status ON followups(status);
CREATE INDEX IF NOT EXISTS idx_followups_expected_date ON followups(expected_date);
CREATE INDEX IF NOT EXISTS idx_followups_project_id ON followups(project_id);
CREATE INDEX IF NOT EXISTS idx_inbox_items_status ON inbox_items(status);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_reminders_remind_at ON reminders(remind_at);
CREATE INDEX IF NOT EXISTS idx_activity_log_entity ON activity_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start ON calendar_events(start_time);
CREATE INDEX IF NOT EXISTS idx_recurring_next_due ON recurring_obligations(next_due_date);
`;
