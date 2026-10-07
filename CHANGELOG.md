# Changelog

## Unreleased - 2026-10-07

### Added

- Searchable, non-technical in-app guide with a workspace-header information link.
- Device-local drag/keyboard column-width controls and reset for Work Reports and File Views.
- Consolidated, all-time Work Reports for projects and tasks, structured filters, date ranges, and CSV/XLSX extraction.
- Project completion and reopening, actual-delivery recording, and explicit cadence pause without silently completing child commitments.
- Persistent global navigation collapse and independent notebook/file hierarchy collapse controls.
- Enhanced notebook typography, colour/highlight, alignment, checklists, code, merged/resizable tables, reading mode, and word/character counts.
- Grouped Settings and Preferences tabs with consistent form layouts.
- Account-owned saved views, following, bulk work actions, private notes/notebooks, and role-enforced visibility.
- Recoverable Trash/Undo/archive workflows, account/PIN/Vault recovery, and verified full backup/restore controls.
- Read-only XLSX/CSV tracker views with stable row mappings, explicit conversion, duplicate-safe refresh, and bounded parsing.
- Calendar history/range views, overlap/stale indicators, and accepted source-linked meeting outcomes.
- Per-account reminders, alert categories, quiet hours, read/snooze state, and working-time preferences.
- Day Planner capacity and non-persistent Unblock Radar completion previews.
- GPL-3.0-only licensing and contributor, security, architecture, and dependency documentation.

### Fixed

- Work Report Type column inheriting the narrow selection-checkbox width.
- Legal footer floating directly under short page content instead of staying at the page bottom.
- Search response contracts and record-specific navigation, including notebook-page search.
- Rejected/stale saves appearing successful and explicit editor exits losing drafts.
- Ended events appearing in Upcoming; archived work generating active attention.
- Filtered My Work overdue counts remaining workspace-wide.
- Archived unfinished prerequisites incorrectly treated as completed during planning.
- CSV leading-zero identities and unsafe ZIP expansion metadata.
- Wide tracker-table horizontal scrolling and cramped mobile navigation.
- Rich-text DOCX export losing checklists, code, styling, or merged-cell structure.

## Initial Prototype

- Next.js/React interface, SQLite domain, invite-only workspace access, and deterministic work/attention workflows.
- Projects, tasks, dependencies, follow-ups, recurrence, QC, notes, notebooks, calendar adapters, Vault, and optional AI drafts.