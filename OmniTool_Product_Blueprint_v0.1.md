# OmniTool — Product & Technical Blueprint v0.1

## 1. Executive Summary

OmniTool is a lightweight, self-hosted, browser-based work command centre for a personal-first workflow that can expand to team use.

Its purpose is not to replace Microsoft Project, Outlook, Obsidian, SharePoint, Teams, or a file-management system. Its purpose is to reduce the mental and administrative overhead of coordinating distributed work by bringing commitments, projects, tasks, follow-ups, recurring obligations, meetings, notes, QC, reminders, and deadlines into one operational view.

### Primary success metric

A user should be able to:

- Start the morning in OmniTool and understand what matters today in 5–10 minutes.
- Capture new commitments during the day in seconds.
- End the day in another 5–10 minutes by updating progress, rescheduling incomplete work, and preparing the next day.

The product should be **feature-rich but lightweight**. Lightweight means fast UI, low resource usage, few background services, simple deployment, simple storage, and low cognitive load—not a small feature set.

---

## 2. Product Thesis

The core problem is not task management alone. It is **commitment management**.

OmniTool should help answer:

> What have I committed to?
> What have other people committed to?
> What is due?
> What am I waiting for?
> What needs follow-up?
> What recurring work is coming?
> What changed since yesterday?
> What deserves my attention today?

The differentiator is the relationship between these objects and the resulting operational awareness.

Example:

```text
Client
  ↓
Project
  ↓
Deliverable
  ↓
Task
  ↓
Dependency
  ↓
Person
  ↓
Follow-up
  ↓
Deadline
  ↓
Calendar event
```

OmniTool should surface that chain as one actionable context rather than forcing the user to search across disconnected screens.

---

## 3. Design Principles

1. **Reduce management, do not create more of it.**
2. **Capture first; organise later.**
3. **Everything important should retain useful context.**
4. **Deadlines and follow-ups surface automatically.**
5. **Recurring work becomes cadence instead of repeated manual setup.**
6. **AI is optional and never required for core functionality.**
7. **External systems remain the source of truth where appropriate.**
8. **Sensitive information is protected through real encryption, not merely hidden UI.**
9. **Feature-rich does not mean infrastructure-heavy.**
10. **Every new capability must justify its cognitive and operational cost.**

---

## 4. Target User and Scope

### Initial user model

- Personal-first
- One primary user
- Small number of active projects at once
- Several people to coordinate
- Scope expected to expand into broader team usage

### Future team model

- Shared projects
- Shared project data
- Private personal items
- Basic roles and object-level visibility
- No enterprise permission matrix in the first release

### Deployment

- Self-hosted
- Browser UI
- Single lightweight application preferred
- Local/private infrastructure
- No mandatory third-party SaaS dependency

---

# 5. Functional Scope

## 5.1 Command Centre / Dashboard

The dashboard is the primary product surface.

It should automatically present:

- Today's tasks
- Overdue tasks
- Upcoming deadlines
- Today's meetings
- Upcoming meetings
- Follow-ups waiting on others
- Follow-ups owed by the user
- Recurring/cadence work due soon
- Recent important changes
- Inbox items requiring processing
- Project attention indicators

The dashboard should prioritise information rather than simply display a pile of widgets.

### Example

```text
TODAY

2 overdue       4 follow-ups       3 meetings
2 due today     1 waiting          1 cadence item

NEEDS ATTENTION

Client ABC — delivery Friday
Ravi — QC review waiting 3 days
Monthly report — due tomorrow
Client XYZ — approval pending

MY WORK
Today: 5
This week: 11
Overdue: 2

PROJECTS
ABC P&ID        Green
XYZ Automation  Attention
Internal        Green

QUICK CAPTURE
[ Type something... ]
```

The dashboard should be configurable between an operational and denser command-centre layout without making configuration mandatory.

---

# 6. Core Domain Model

The initial domain should remain small and relational.

```text
Workspace
 ├── Organisation / Client
 │    └── Project
 │         ├── Workstream
 │         ├── Deliverable
 │         ├── Task
 │         │    ├── Subtask
 │         │    ├── Reminder
 │         │    └── Dependency
 │         ├── QC Checklist
 │         └── Notes / Links
 │
 ├── Follow-up
 ├── Recurring Obligation
 ├── Meeting / Calendar Event
 ├── Note
 ├── Inbox Item
 └── Secure Note
```

Do not create dozens of specialised objects in the first version. Use relationships and metadata to derive higher-level views.

---

# 7. Organisations, Clients and Projects

## 7.1 Hierarchy

Support this hierarchy without requiring every level:

```text
Organisation
  ↓
Client
  ↓
Project
  ↓
Workstream
  ↓
Task
```

Examples:

```text
Client ABC
  └── P&ID Extraction
       ├── Extraction
       ├── QC
       └── Delivery
```

or:

```text
Internal Automation
  └── Task
```

The data model must support flexible depth while the UI should default to a simple project view.

## 7.2 Project fields

Recommended initial fields:

- Name
- Description / objective
- Organisation
- Client
- Owner
- Team members
- Start date
- Planned delivery date
- Actual delivery date
- Status
- Priority
- Workstreams
- Deliverables
- Risks/issues
- Notes
- QC template/checklist
- Custom fields

## 7.3 Project health

Project health should primarily be derived.

Signals can include:

- Overdue tasks
- Upcoming delivery dates
- Stalled tasks
- Pending dependencies
- Waiting follow-ups
- Missed recurring obligations

The system may suggest:

- Green — on track
- Amber — attention
- Red — at risk

The user can override the suggested state.

Project-health scoring should be a secondary feature rather than a mandatory daily-maintenance field.

---

# 8. Tasks

Tasks are one of the fundamental primitives.

## 8.1 Task properties

- Title
- Description
- Project
- Workstream
- Owner
- Status
- Priority
- Start date
- Due date
- Planned completion
- Actual completion
- Checklist
- Subtasks
- Dependencies
- Reminders
- Linked notes
- Linked meetings
- Linked follow-ups
- Related objects
- External links
- Activity history
- Custom fields

## 8.2 Status

Keep the default lifecycle small:

```text
Inbox / Untriaged
Open
In Progress
Blocked
Waiting
Done
Cancelled
```

Custom statuses can be introduced later.

## 8.3 Priority

User-selected priority is required because the chosen model is traditional priority:

- Critical
- High
- Medium
- Low

The system may additionally calculate attention/urgency, but calculated urgency should not replace explicit priority.

---

# 9. Follow-ups

Follow-up should be a first-class concept, not just another task.

## 9.1 Follow-up categories

- I need to do something
- Someone else needs to do something
- Waiting for response
- Waiting for approval
- I promised someone something
- Blocked by someone/something

## 9.2 Key properties

- Title
- Owner
- Waiting-on person/team
- Related project
- Related task
- Expected date
- Status
- Priority
- Created date
- Last activity date
- Reminder/escalation rule
- Context links

## 9.3 Waiting duration

The UI should expose elapsed waiting time naturally:

```text
Ravi — QC review
Waiting 3 days
Expected: Wednesday
```

Automatic reminders/escalations should be supported.

This is one of OmniTool's main differentiating workflows.

---

# 10. Recurring / Cadence Engine

Recurring work is a core requirement, not a convenience feature.

Support:

- Daily
- Weekly
- Monthly
- Quarterly
- Specific weekday
- Nth weekday
- Working-day based recurrence
- Relative-to-date rules

Examples:

- Every Monday
- Every second Tuesday
- 5th working day of the month
- Last working day of month
- Three working days before a recurring client meeting

## 10.1 Occurrence model

Do not generate months of future task copies by default.

Preferred model:

```text
Recurring Obligation
        ↓
   Next occurrence
        ↓
    Active item
        ↓
     Complete
        ↓
   Next occurrence
```

This keeps the database and dashboard clean.

## 10.2 Working-day calendar

Support configurable weekend definitions and, eventually, holiday calendars.

Holiday handling can remain optional in the first release.

---

# 11. QC Tracker

QC is a configurable checklist capability rather than an enterprise QA subsystem.

## 11.1 QC template

A user can manually create reusable templates such as:

```text
P&ID Delivery QC

[ ] Tags validated
[ ] Equipment checked
[ ] Connectivity checked
[ ] Missing values reviewed
[ ] Final review completed
[ ] Delivery package checked
```

## 11.2 Behaviour

- Template can be attached to a project, task, or deliverable.
- Checklist items can be marked complete/incomplete.
- Optional notes can be attached to an item.
- Optional reviewer field can be supported.
- QC items remain checklist items by default.
- No automatic task creation from QC items unless explicitly requested by the user.

This prevents QC from creating unnecessary task noise.

---

# 12. Notes

General notes should remain lightweight and flexible.

Notes can optionally link to:

- Project
- Client
- Task
- Meeting
- Follow-up
- Deliverable
- Person

The system should preserve context but should not become an Obsidian replacement.

Avoid making deep knowledge-graph organisation mandatory.

---

# 13. Secure Vault

The Secure Vault is a separate feature area, not merely a flag on ordinary notes.

```text
NORMAL WORKSPACE
Projects
Tasks
Notes
Meetings
...

SECURE VAULT
Private meeting feedback
Sensitive client observations
Personal notes
```

## 13.1 Required behaviour

- Vault requires its own password.
- Password is requested whenever the vault is opened.
- Vault locks immediately when the user leaves it or invokes lock.
- Normal application login must not automatically decrypt the vault.
- Vault contents should remain encrypted at rest.
- The server should not need the cleartext vault password.

## 13.2 Security direction

Use modern, vetted cryptographic primitives through a trusted library rather than implementing cryptography directly.

A practical architecture is:

```text
Vault Password
      ↓
Password-based Key Derivation
      ↓
Vault Encryption Key
      ↓
Encrypted Secure Notes
```

Each note/content record should use authenticated encryption.

Potential future enhancement: separate encryption keys per record or collection and key wrapping for safer rotation.

The secure-note UX should be informed by products such as Standard Notes and TriliumNext, which demonstrate client-side encryption and protected-note workflows respectively.

---

# 14. Inbox / Quick Capture

Inbox is essential.

The system must allow capture before classification.

Example:

> Client ABC needs revised report by Friday.

The user should be able to submit this immediately without filling a form.

Later it can be converted into:

- Task
- Follow-up
- Note
- Project item
- Reminder
- Archive

## 14.1 Quick capture

Preferred initial interaction:

- Browser shortcut / keyboard shortcut
- One-line entry
- No mandatory metadata

Suggested shortcut:

```text
Ctrl + Space
```

The shortcut must be configurable later.

---

# 15. Calendar Integration

OmniTool should not become another calendar platform.

Its calendar should primarily be an aggregation/view layer.

Initial target:

- Microsoft Outlook / Microsoft 365 calendar

Later:

- Google Calendar
- Other calendar providers if justified

## 15.1 Initial functionality

- Read external events
- Sync changes into a local lightweight cache
- Overlay calendars
- Clearly identify source calendar
- Show conflicts/overlaps visually
- Link OmniTool tasks/follow-ups to calendar context

The initial version does not need to create or reschedule external meetings.

Microsoft Graph provides calendar event access and incremental/delta synchronisation suitable for maintaining a local cache rather than repeatedly downloading complete calendars.

---

# 16. Files

OmniTool should deliberately avoid becoming a file-management system.

Preferred model:

- Link external files
- Store URLs/references
- Optionally attach small supporting files later if justified

The organisation's existing systems should remain the source of truth for documents.

This reduces storage complexity, security scope and infrastructure requirements.

---

# 17. Notifications and Reminders

Initial channels:

- In-app
- Browser notifications

The user should control which events trigger reminders.

Examples:

- Due date approaching
- Overdue
- Follow-up waiting too long
- Recurring item due
- Meeting approaching
- Commitment overdue
- Project delivery approaching

Email notifications should not be mandatory in the initial version.

---

# 18. Search

Search should be relationship-aware.

It should support queries such as:

> Everything related to Client ABC.

> What am I waiting for?

> Show overdue items connected to Project XYZ.

> What commitments did I make this week?

Initial implementation should prioritise:

- Full-text search
- Structured filters
- Relationship filters

Semantic/AI search can be added later without changing the domain model.

---

# 19. My Work

A cross-project aggregation view is useful even if it is not always the primary screen.

Example:

```text
MY WORK — THIS WEEK

12 tasks
4 follow-ups
2 pending approvals
3 meetings
1 recurring delivery
2 overdue
```

Filters:

- Today
- This week
- Overdue
- Waiting
- Critical/high priority
- By project
- By client

---

# 20. End-of-Day Workflow

The evening review should cover:

1. Completed work
2. Unfinished work
3. Rescheduling
4. New commitments
5. Pending follow-ups
6. Tomorrow's workload
7. Daily summary

The system should make this a guided lightweight review rather than a long data-entry workflow.

Potential future flow:

```text
DAY REVIEW

✓ 7 completed
→ 2 incomplete
→ 1 rescheduled
→ 3 new captures
→ 2 follow-ups waiting

Tomorrow:
5 tasks
2 meetings
1 deadline
```

---

# 21. Context Preservation

Context trails are useful but should remain unobtrusive.

Example:

```text
Task: Prepare Client ABC report

Created from: Meeting — 12 Sep
Reason: Client requested revised figures
Dependency: Ravi's QC
Related email: Client request
Related note: Meeting feedback
```

This should be visible when needed but should not clutter ordinary task lists.

---

# 22. AI Layer

AI must be an optional adapter.

The application must run fully without any configured model, key, or external API.

Architecture:

```text
                 OmniTool Core
                      │
             AI Abstraction Layer
                      │
       ┌──────────────┼───────────────┐
       ↓              ↓               ↓
   OpenAI API    Other Provider    Local Model
```

Provider configuration should be replaceable without changing core business logic.

## 22.1 AI capabilities

Eventually support:

- Free-text capture → structured task/follow-up
- Meeting note → suggested action items
- Daily summary
- Weekly summary
- Project summary
- Risk/attention suggestions
- Priority suggestions
- Relationship-aware natural-language search
- Commitment detection
- Follow-up drafting

## 22.2 AI safety/control

AI suggestions must be reviewable.

Pattern:

```text
Suggested task
Due: Friday
Project: Client ABC

[Accept] [Edit] [Reject]
```

No silent creation or destructive modification based solely on AI output.

## 22.3 AI providers

Support both:

- External APIs
- Locally hosted models

Provider credentials should be stored securely and should be scoped to the installation/user.

---

# 23. Email and Teams Integrations

Not part of the initial product scope.

Future direction may include:

- Email → task/follow-up/note
- Teams message → capture
- Commitment extraction
- Follow-up generation

Do not allow these integrations to delay the first useful release.

---

# 24. Modular Architecture

The product should have clean module boundaries even if shipped as one deployable application.

Suggested logical modules:

```text
Core
├── Authentication
├── Workspace
├── Organisations / Clients
├── Projects
├── Tasks
├── Follow-ups
├── Recurrence
├── QC
├── Notes
├── Secure Vault
├── Inbox
├── Dashboard
├── Search
├── Notifications
├── Calendar
├── Integrations
└── AI
```

These are **code modules**, not necessarily independently deployed microservices.

That distinction is important.

The system should be modular in software design while remaining operationally simple.

---

# 25. Recommended Deployment Architecture

Prefer a monolithic application with modular internals for v1.

Conceptually:

```text
Browser
  ↓
OmniTool Web Application
  ├── HTTP/API layer
  ├── Domain services
  ├── Background scheduler
  ├── Integration adapters
  └── UI
       ↓
     SQLite
```

Potential alternative for larger future deployments:

```text
Reverse Proxy
     ↓
OmniTool Application
     ↓
PostgreSQL
```

But PostgreSQL, Redis, a message broker, vector database, object storage, etc. should not be mandatory for the personal installation.

## 25.1 Why not microservices?

Microservices would increase:

- RAM use
- deployment complexity
- permission requirements
- upgrade burden
- failure modes
- debugging cost

They provide little value for the initial scale.

---

# 26. Database Strategy

Initial target: **SQLite**.

Reasons:

- Extremely low infrastructure overhead
- Single-file database
- Easy backup
- Easy local/self-hosted deployment
- No separate database service
- Mature transaction support
- Good fit for a personal-first product

The application should use a database abstraction layer so PostgreSQL can be introduced later without rewriting the domain model.

## 26.1 Core tables/entities

A likely initial schema:

```text
users
workspaces
organisations
clients
projects
workstreams
deliverables
tasks
task_relations
followups
recurring_obligations
recurrence_instances
qc_templates
qc_items
notes
note_links
meetings
calendar_sources
calendar_events
inbox_items
reminders
notifications
custom_fields
custom_field_values
activity_log
secure_vault_metadata
secure_notes
settings
```

The exact schema should be refined during technical implementation.

---

# 27. API Design

Use a clean internal API even if UI and backend ship together.

Recommended principles:

- Resource-oriented endpoints
- Consistent IDs
- Pagination for list endpoints
- Filtering and sorting server-side
- Stable error model
- Audit/activity events for important changes
- API versioning from the beginning

Future external integrations should use this API rather than reaching into database tables.

---

# 28. Authentication

Initial model:

- Local username/password or one-user login
- Secure password hashing
- Session-based authentication
- Optional external identity integration later

Future:

- OAuth/OIDC
- Microsoft identity
- Multi-user organisations

Authentication should remain independent from Secure Vault decryption.

---

# 29. Permission Model

Initial team-ready model:

- Admin
- Member
- Viewer
- Private/personal items

Keep permissions simple.

Future granular permissions can be introduced after real team usage demonstrates the need.

Key requirement:

> Shared project data does not imply visibility of personal or secure content.

---

# 30. Performance Requirements

Performance is a product feature.

Initial targets:

- Fast initial dashboard load
- Instant local navigation after first load
- Quick capture should feel immediate
- Search results should return quickly for normal personal datasets
- No unnecessary polling loops
- Calendar synchronisation should be incremental
- Background jobs should be limited and purposeful

The app should remain responsive on modest self-hosted hardware.

---

# 31. Frontend UX Principles

1. Dashboard first.
2. Capture in one step.
3. Do not require metadata before saving.
4. Hide advanced fields until needed.
5. Preserve context without visual clutter.
6. Use consistent keyboard navigation.
7. Avoid modal-heavy workflows where possible.
8. Make due/overdue/waiting states visually obvious.
9. Make bulk edits possible where practical.
10. Avoid excessive configuration screens.

---

# 32. Navigation Proposal

Primary navigation:

```text
Dashboard
My Work
Projects
Follow-ups
Calendar
Inbox
Notes
QC
Secure Vault
Search
Settings
```

Potential secondary areas:

- Recurring
- Reports
- Integrations
- AI

The Dashboard should remain the default landing page.

---

# 33. Project Detail Proposal

Example structure:

```text
PROJECT ABC

Overview | Work | Follow-ups | QC | Notes | Calendar | Activity

Status: Attention
Owner: Himanshu
Client: ABC
Delivery: 18 Sep

NEXT
• Ravi QC review
• Client approval
• Final delivery

TASKS
...

FOLLOW-UPS
...

QC
...
```

Use tabs/sections rather than putting every property on one long screen.

---

# 34. Dashboard Attention Logic

A first attention engine can use deterministic rules rather than AI.

Priority examples:

### Critical attention

- Critical task overdue
- Project delivery at risk
- Follow-up significantly overdue
- Blocking dependency overdue

### High attention

- Task due today
- Follow-up due today
- Recurring obligation due today/tomorrow
- Pending approval close to deadline

### Normal

- Future tasks
- Non-urgent reminders
- Recently changed items

This deterministic layer should work without AI.

---

# 35. Activity and Audit History

Record meaningful changes such as:

- Task created
- Task reassigned
- Due date changed
- Status changed
- Follow-up created/completed
- Project status overridden
- QC item changed
- Note linked/unlinked

Activity history should support understanding “what changed?” without becoming an enterprise audit platform.

Secure Vault activity should avoid logging sensitive note contents.

---

# 36. Build-vs-Reuse Assessment

## Reuse directly

### Calendar protocols/APIs
Use Microsoft Graph and later Google Calendar APIs rather than building calendar provider support from scratch.

### Authentication/security libraries
Use mature, well-tested libraries.

### Encryption
Use audited primitives and libraries rather than custom cryptography.

### UI components
Reuse established calendar, editor, date-picker, table and accessibility components where licensing permits.

### Full-text search
Use the database/search engine capability before introducing external search infrastructure.

## Study as architectural references

### Vikunja
Useful reference for lightweight tasks, recurrence, reminders, relations, APIs and self-hosting.

### Plane
Useful reference for richer project/work-item relationships, workflows, extensibility and integrations.

### Huly
Useful reference for unified work management concepts, but its operational scope is broader/heavier than OmniTool should be initially.

### OpenProject
Useful reference for advanced planning, work packages, Gantt/dependencies and formal project workflows; not recommended as the embedded foundation for v1.

### Standard Notes / TriliumNext
Useful references for secure/private note architecture and UX.

## Do not embed a complete third-party PM platform

Embedding an entire external PM system as OmniTool's mandatory backend would create:

- Extra operational complexity
- An external data model we do not control
- Unwanted UI assumptions
- Migration pain if our workflow diverges
- More resources than a personal installation needs

The preferred reuse model is **protocols, libraries, APIs, and proven design patterns**, not a large third-party application stack.

---

# 37. What OmniTool Must Not Become

At least initially, OmniTool is not:

- Microsoft Project replacement
- Obsidian replacement
- Full document management system
- Email client
- Chat client
- Full CRM
- Time-sheet/billing platform
- Enterprise resource planning system
- Portfolio management platform
- Video conferencing system
- File storage replacement

Features that move the product strongly in these directions should require an explicit scope review.

---

# 38. MVP — Phase 1

The first genuinely useful release should include:

### Foundation

- Local authentication
- Workspace
- Organisations/clients
- Projects
- Tasks
- Subtasks
- Status
- Priority
- Due dates
- Start/planned/actual dates
- Basic dependencies

### Operations

- Follow-ups
- Waiting states
- Reminders
- Recurring obligations
- Inbox
- Quick capture
- Dashboard
- My Work

### Work context

- Notes
- QC templates/checklists
- Activity history
- Relationship links
- Custom fields

### Calendar

- Outlook/Microsoft 365 read integration
- Calendar overlay
- Local event cache

### Security

- Secure Vault
- Separate password
- Encryption at rest

### UX

- Keyboard quick capture
- Browser notifications
- Full-text/relationship-aware search

This is feature-rich but still bounded.

---

# 39. Phase 2

After the MVP proves the workflow:

- Better project health scoring
- Advanced recurrence rules
- Google Calendar
- Better weekly review
- richer dashboards
- bulk operations
- advanced saved filters/views
- email capture
- Teams capture
- richer permissions
- import/export tools

---

# 40. Phase 3 — AI and Advanced Automation

Only after core workflows are stable:

- AI capture interpretation
- Meeting action suggestions
- Daily summaries
- Weekly summaries
- Risk detection
- Commitment detection
- Natural-language search
- Follow-up drafting
- Suggested project classification
- Automated context extraction

AI remains optional at installation level and provider level.

---

# 41. Example End-to-End Workflow

### During a meeting

User enters:

> Client wants revised connectivity analysis by Friday. Ravi will validate the extraction first.

Without AI:

1. Capture to Inbox.
2. Convert to project task.
3. Create dependency on Ravi's QC task.
4. Create delivery date.
5. Create/attach follow-up.

With AI:

1. AI extracts suggested project, task, owner and dates.
2. User accepts or edits.
3. OmniTool creates structured objects and relationships.

### Next morning

Dashboard shows:

```text
Client ABC
Delivery Friday

Dependency:
Ravi — extraction validation

Your next action:
Finalize connectivity analysis
```

### Wednesday

If Ravi has not completed validation:

```text
WAITING
Ravi — validation
Waiting 3 days
Expected Wednesday
```

### Thursday

If the delivery remains at risk:

```text
ATTENTION
Client ABC delivery tomorrow
Dependency incomplete
```

This is the operational loop OmniTool is designed to solve.

---

# 42. Non-Functional Requirements

## Performance

- Low latency interactions
- Minimal background processing
- Incremental synchronisation

## Reliability

- Transactions for important state changes
- Safe migrations
- Automatic recovery from interrupted sync jobs
- Export/backup capability

## Security

- Strong password hashing
- Secure sessions
- Encrypted secure notes
- No plaintext secure-note logging
- Secrets stored outside normal note data
- Clear separation between authentication and vault encryption

## Maintainability

- Modular internal architecture
- API boundaries
- Automated tests
- Database migrations
- Configuration via environment/config file
- Minimal dependencies

## Portability

- Platform-agnostic self-hosting (Linux and Windows support)
- Browser client
- Container deployment optional
- Local SQLite as default

---

# 43. Backup and Data Portability

A self-hosted personal tool must make ownership easy.

Required:

- One-command/exportable backup
- SQLite backup or application-level export
- JSON export of structured entities
- Human-readable export for notes where practical
- Secure Vault export only after explicit authentication

Avoid proprietary data lock-in.

---

# 44. Observability

Keep observability lightweight.

Initial:

- Application logs
- Integration sync logs
- Error log
- Basic health endpoint

Do not require an external observability stack.

---

# 45. Testing Strategy

Prioritise tests for the areas where mistakes can materially damage the user's work:

### High priority

- Recurrence calculations
- Time zones
- Due dates
- Working-day logic
- Follow-up escalation
- Task relationships
- Calendar synchronisation
- Secure Vault encryption/decryption
- Database migration
- Backup/restore

### UI tests

- Quick capture
- Dashboard rendering
- Task creation/edit
- Follow-up workflow
- Vault lock/unlock

---

# 46. Technology Selection Criteria

The final stack should be selected against these criteria:

1. Small runtime footprint
2. Excellent browser performance
3. Mature SQLite support
4. Good background scheduling support
5. Strong encryption libraries
6. Simple self-hosting
7. Straightforward API implementation
8. Long-term maintainability
9. Low dependency count
10. Easy packaging

Avoid selecting technology merely because it is trendy or because a larger enterprise product uses it.

---

# 47. Recommended Implementation Shape

A pragmatic implementation shape is:

```text
                    Browser
                       │
                       ▼
              ┌────────────────┐
              │ OmniTool App   │
              │                │
              │ UI             │
              │ API            │
              │ Domain Logic   │
              │ Scheduler      │
              │ Integrations   │
              │ AI Adapters    │
              └───────┬────────┘
                      │
                   SQLite
                      │
             ┌────────┴────────┐
             │                 │
        Local config       File refs
```

A single executable/service should be the ideal outcome where practical.

---

# 48. First Development Sequence

## Step 1 — Foundation

- Repository
- Project structure
- Configuration
- Authentication
- SQLite
- Database migrations
- Basic API
- Basic UI shell

## Step 2 — Core work model

- Clients
- Projects
- Tasks
- Subtasks
- Priorities
- Due dates
- Dependencies

## Step 3 — Operational layer

- Follow-ups
- Inbox
- Quick capture
- Reminders
- Recurrence
- Dashboard

## Step 4 — Context

- Notes
- Links/relationships
- QC templates
- Activity history
- Search

## Step 5 — Calendar

- Microsoft Graph authentication
- Event sync
- Local cache
- Combined calendar view

## Step 6 — Secure Vault

- Vault setup
- Key derivation
- Encrypted note storage
- Lock/unlock UX
- Recovery/export design

## Step 7 — Hardening

- Tests
- Backup/restore
- Packaging
- Documentation
- Performance tuning

## Step 8 — AI adapter

- Provider abstraction
- Configuration
- Suggested task extraction
- Summary
- Natural-language search

AI should not block any earlier phase.

---

# 49. Acceptance Criteria for “Useful MVP”

The MVP should be considered successful only if a user can perform the following without leaving OmniTool except where an external source must remain authoritative:

1. Create a client and project.
2. Create tasks and subtasks.
3. Set owners, priorities and dates.
4. Record dependencies.
5. Create follow-ups and see who owes whom.
6. Track how long something has been waiting.
7. Define recurring work.
8. Capture a thought in seconds.
9. Process Inbox items later.
10. Attach useful notes/context.
11. Create and use a QC template.
12. See all important work on a dashboard.
13. Overlay the external organisation/client calendar.
14. Receive relevant browser/in-app reminders.
15. Search across connected work.
16. Open the Secure Vault with a separate password.
17. Continue normal work with zero AI configuration.
18. Back up the complete workspace easily.

---

# 50. Product Success Metrics

The most important metrics should be behavioural, not vanity metrics.

### Core

- Morning review time ≤ 10 minutes
- Evening review time ≤ 10 minutes
- Quick capture completion ≤ 10 seconds
- Reduction in overdue forgotten follow-ups
- Reduction in manually searched delivery dates
- Percentage of active projects with visible next action

### Secondary

- Follow-up ageing
- Recurring work completion rate
- Number of stale tasks
- Percentage of dashboard items acted upon
- Calendar conflict visibility

The product should measure whether management work is shrinking.

---

# 51. Architectural Guardrails

Do not introduce:

- Redis unless a measured use case demands it
- PostgreSQL until SQLite becomes a real limitation
- A message broker for internal jobs
- A vector database solely for AI search
- Object storage for normal links/files
- Microservices without a demonstrated deployment need
- Mandatory external AI
- Mandatory external calendar
- Enterprise permission systems before team usage requires them

Every infrastructure addition should answer:

> What user-facing problem does this solve that cannot reasonably be solved inside the current architecture?

---

# 52. Decision Summary

### Build ourselves

- OmniTool dashboard
- Commitment/follow-up model
- Project relationship layer
- Inbox/capture workflow
- Operational attention engine
- Lightweight recurrence orchestration
- QC templates
- Unified context view
- Secure Vault integration/UX
- Unified search experience
- Overall user experience

### Reuse / integrate

- Calendar provider APIs
- OAuth/OIDC
- Encryption primitives
- Mature frontend libraries
- Date/calendar components
- Database/search primitives
- Optional external AI providers

### Learn from, but do not embed by default

- Vikunja
- Plane
- Huly
- OpenProject
- Standard Notes
- TriliumNext

---

# 53. Final Product Positioning

OmniTool should feel like:

> **“The place I start and finish my workday.”**

Not:

> “The place where I maintain my project-management system.”

The application succeeds when the user spends less time managing the management system itself.

The core promise is:

> **Open OmniTool. Know what matters. Act. Capture. Close the day.**

---

# 54. Research References

The following sources informed the architectural comparison and reuse decisions. Product capabilities should be re-verified against current documentation during implementation because these systems evolve.

1. Plane — product and developer documentation. https://plane.so/ ; https://developers.plane.so/
2. Plane — self-hosting / architecture material. https://plane.so/blog/self-hosted-project-management-jira-server-alternative
3. OpenProject — project planning and work-package documentation. https://www.openproject.org/docs/user-guide/work-packages/
4. OpenProject — collaboration/project management features. https://www.openproject.org/collaboration-software-features/
5. Vikunja — features. https://vikunja.io/features/
6. Vikunja — API v2 documentation. https://vikunja.io/docs/api-v2/
7. Huly — product and documentation. https://huly.io/ ; https://docs.huly.io/
8. TriliumNext — protected notes documentation. https://github.com/TriliumNext/Trilium/wiki/Protected-notes
9. Standard Notes — security/encryption documentation. https://standardnotes.com/help/security/encryption
10. Microsoft Graph — event delta synchronisation. https://learn.microsoft.com/en-us/graph/delta-query-events

---

# 55. Status

**Requirements interview:** Complete

**Product direction:** Established

**Architecture direction:** Established at high level

**Technology stack:** To be finalised during technical design

**MVP scope:** Defined

**Implementation:** Not yet started
