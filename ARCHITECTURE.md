# Architecture

OmniTool is one modular Next.js application backed by SQLite, not a distributed platform. See [README.md](README.md) for operation and [OmniTool_Product_Blueprint_v0.1.md](OmniTool_Product_Blueprint_v0.1.md) for product contracts.

## Layers

| Layer | Location | Responsibility |
| --- | --- | --- |
| Browser views | `components` | Interactive work, configuration, capture, notebooks, file views, reports |
| Routes | `app` | App Router pages and HTTP boundaries |
| Access | `proxy.ts`, `lib/services/workspaceAccess.ts` | Session/role/origin checks, private nested-route access, reauthentication |
| Domain | `lib/services` | Attention, recurrence, notification, planning, lifecycle, import/export, integrations |
| Storage | `lib/db` | SQLite WAL, canonical schema, additive migrations |
| Operations | `scripts` | Verified backup/restore and host-side recovery |

## Data and Lifecycles

Clients link projects, workstreams, deliverables, tasks, follow-ups, notes, meetings, QC, and recurrence. Completion, cancellation, archive, Trash, restore, and permanent deletion are distinct. Completing a project pauses its cadence but does not silently complete linked work. Project health is derived separately from lifecycle state.

Trash snapshots cascading rows and records detached references transactionally. Restoration refuses conflicting IDs or missing dependencies rather than partially restoring. Full recovery uses the existing backup CLI and fresh-destination staging.

Private notes/notebooks/trackers use account ownership and explicit visibility. Existing records retain shared visibility on upgrade. Saved views, following, notification receipts, reminder preferences, and personal reviews are account-owned.

## Working Views and Extraction

My Work is an active operational view. Work Reports independently queries all-time project/task history with status, relationship, date, ownership, and archive filters. JSON is paginated; CSV/XLSX exports apply the same filters with a 10000-record ceiling. Report exports do not include Vault or private-note data.

File Views stores bounded read-only worksheet snapshots and column mappings. Stable row identities retain conversion links across refresh. Source workbooks are authoritative; accepted OmniTool work items are independent commitments, never silently overwritten on refresh.

## Editors and Planning

Notebooks use TipTap JSON plus searchable text and revisions. Editors reject stale writes, preserve drafts, and export rich content through DOCX. Layout collapse preferences contain only device-local UI state.

Day Planner combines working windows, timezone, days off, budget, task estimates, and meeting overlap union. Unblock Radar traverses active blocking dependencies and offers read-only completion previews. Archived unfinished prerequisites remain blocking.

## Optional Adapters

Calendar adapters maintain read-only provider caches; local events remain editable. Accepted meeting outcomes retain source context even after cache eviction. AI drafts are optional, non-persistent until explicitly accepted, and not required for core work.

Recurrence and notification generation run opportunistically during application requests. Desktop delivery requires an open browser app; there is no mandatory queue or always-on worker.

## Encryption

Vault encryption is client-side and password-derived. Server credential encryption is a separate server-side mechanism using the installation's secret file. Authentication, screen lock, Vault unlock, and installation restore are not interchangeable security/recovery mechanisms.