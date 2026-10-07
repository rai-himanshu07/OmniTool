# Security

## Reporting

Do not publish passwords, tokens, workspace databases, private notes, workbook contents, or recovery archives in public issues. Use the repository's private vulnerability-reporting channel if enabled; otherwise contact the repository owner through an established private channel. Include affected version, synthetic reproduction, expected behavior, and impact. No response-time commitment is implied.

## Deployment Boundaries

- Keep a personal installation on loopback/private infrastructure. Use HTTPS and a trusted reverse proxy before exposing it remotely.
- Configure `BETTER_AUTH_URL` and calendar callback origins correctly. Reverse-proxy Host/protocol headers must represent the public origin.
- Admin/Member/Viewer are workspace roles. Shared projects/tasks are not protected by object-level project ACLs.
- Private notes/notebooks/trackers are owner-scoped in APIs and exports. A host operator with filesystem access can still read unencrypted ordinary workspace data or full backups.
- Screen Lock is a UI convenience, not encryption or an API security boundary.
- Secure Vault encrypts client-side with a separate password. Forgotten-password reset deletes active ciphertext rather than recovering it. Backup copies have independent retention.
- Server credentials are encrypted using the installation's separate server-secret file. Protect the database and matching secret together.

## Recovery and Exports

Full backups contain private records, authentication state, and credentials. Store them securely offline/private. Restore only to fresh destinations after checksum and SQLite verification. JSON and report exports are explicit data extraction, not complete installation recovery.

CSV/XLSX exports guard spreadsheet-formula-like text. File import is bounded and read-only; macros, formula execution, external workbook fetching, and two-way sync are not supported. Do not treat an authenticated upload as inherently trustworthy.

## Maintenance

Back up before upgrades; migrations must remain non-destructive. Run the production dependency audit and review advisories before deployment. Do not run an older application version against an upgraded database with newer privacy rules. Avoid using the same browser hostname for synthetic acceptance and real installations because cookies are shared across ports.