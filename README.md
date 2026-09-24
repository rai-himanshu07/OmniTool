# OmniTool

Self-hosted, personal-first work command centre. Requires Node.js 20.9+.

```bash
npm install
npm run dev -- --hostname 127.0.0.1
```

Open http://127.0.0.1:3000 and create the first Admin account at `/setup`. For a production build, run `npm run build` then `npm start -- --hostname 127.0.0.1`. Data is stored in `omnitool.db` by default; `DATABASE_PATH` selects another SQLite file. OmniTool authenticates all app pages and APIs with server-verified sessions. If you expose it beyond localhost, use HTTPS and a trusted reverse proxy, set `BETTER_AUTH_URL` and the Settings app origin to the public URL, and protect backups and server secrets from other users on the host.

Admins can invite other accounts from Settings using a one-time link. Members can edit shared work; Viewers have read-only access. Admin-only settings, credentials, Vault, export, and integrations are not available to other roles. These roles are workspace-wide, not project privacy boundaries. The Screen Lock PIN is per account and only hides that account's browser UI; signing in is the actual access control.

## Workflows

- **Recurring project work:** In a project, select **Cadence**, or open **Cadence** from the sidebar. Choose daily, working days, weekly, biweekly, monthly, quarterly, or yearly timing. Monthly rules support the same day, fifth/last working day, and nth/last weekday. Each due occurrence creates a task under that project, not a clone of the whole project; catch-up is capped at 60 occurrences per processing pass. Pause and resume rules in Cadence.
- **Focus Plan:** On Today, choose up to three existing tasks or follow-ups and write the next concrete action for each. Reorder or remove them without changing the underlying work. Completing a slot also completes its task or resolves its follow-up. Day Review opens tomorrow's plan so unfinished commitments from earlier days can be carried over explicitly rather than silently copied. The plan and its decisions are included in JSON export.
- **People and teams:** Add people under **People & Teams**, group them into teams, and designate a team lead. In Project Overview, attach teams or individuals; team members also appear there by inheritance. Assign a person on a task, or link a follow-up to a directory person. External contacts may remain free text. Archiving preserves existing references. These are coordination records, not user accounts or permissions.
- **Notebooks:** Create a notebook, then pages within it. Pages support headings, lists, links, tables, and formatting. Save explicitly; edits made in another tab are rejected rather than silently overwritten. The revision selector can restore an earlier save. Export a page or entire notebook as DOCX; Print offers the browser's PDF output. Notebooks are separate from lightweight Notes.
- **Screen Lock:** Set a four-digit PIN in Settings. Use the header lock control or choose an inactivity interval. This hides the browser interface, but does not encrypt data or restrict API access. If the PIN is forgotten, an administrator with machine access can run `npm run lock:reset -- <account email>`. Set `DATABASE_PATH` first when using a non-default database; the command removes only that account's PIN.
- **AI suggestions:** Configure an optional OpenAI-compatible provider in Settings. In Inbox, request a suggestion for a selected capture, then inspect and edit it before choosing Convert & Save. In Week Review, choose Draft with AI to generate a preview from up to 12 titles and dates per list of completed work, due tasks, waiting follow-ups, next-week tasks and meetings. Titles may contain names; notes, contact fields and locations are excluded. Use draft fills the review form only after your confirmation when replacing text; Save draft or Finish week review remains manual. No data is sent or written by AI without an explicit action.
- **Calendar overlays:** Microsoft 365 and Google Calendar can be connected separately in Settings. Both imports are read-only and their events are marked by source in Calendar; local events remain editable. For Google, enable the Calendar API in Google Cloud, create a Web application OAuth client, and register the exact callback URI shown in Settings. Google requests read-only event scope for the primary calendar and refreshes a bounded 30-day-past/180-day-future cache. Live OAuth requires your own credentials.
- **Week Review:** Select Week in Review for completed work, due/overdue tasks, waiting follow-ups, and next week's work and meetings. Save a personal draft or finish the week; the notes and completion state are stored per account.
- **Developer tools:** Settings contains OmniTool's Developer & Data section. The separate bottom-left Next.js badge appears only in `next dev`; choosing Hide in that badge's menu suppresses it for up to 24 hours. Restart the dev server to show it again. The badge is not available in `next start` production mode.

Settings can download a JSON snapshot of workspace records, including notebooks and revisions. It is not an import or full recovery format. For full recovery, stop writes or let the SQLite online backup take a consistent snapshot:

```bash
npm run backup -- /secure/new-backup-directory
npm run backup:verify -- /secure/new-backup-directory
npm run backup:restore -- /secure/new-backup-directory /secure/new-install/omnitool.db
DATABASE_PATH=/secure/new-install/omnitool.db npm start -- --hostname 127.0.0.1
```

Restore only writes to a **new** database path and will not overwrite existing data or a server secret. Backups contain the SQLite database plus `.omnitool_secret` when present; store them privately and keep the Vault password separately. A restored copy preserves accounts, sessions, notes, encrypted settings and tokens. Set `DATABASE_PATH` (and `OMNITOOL_SECRET_PATH` if using a custom server-secret location) for non-default installations before backup. Never publish these files.

The [product blueprint](OmniTool_Product_Blueprint_v0.1.md) records the original product direction; the implementation remains personal-first with workspace-wide shared access.