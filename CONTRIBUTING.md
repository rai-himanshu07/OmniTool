# Contributing

OmniTool is personal-first, self-hosted, and deliberately lightweight. Preserve the operational workflow and existing design before introducing new abstractions or infrastructure.

## Local Setup

Use Node.js 20.9 or newer and install the locked dependency tree:

```bash
npm ci
npm run dev -- --hostname 127.0.0.1
```

The first account becomes Admin. Later accounts require invitations. Use synthetic records and an isolated `DATABASE_PATH`/`OMNITOOL_SECRET_PATH` for acceptance checks; never reset a real workspace to obtain a clean fixture.

## Conventions

- App Router pages and API handlers live in `app`; views in `components`; business logic in `lib/services`.
- Reuse plain CSS variables, IBM Plex fonts, Lucide icons, existing form classes, and the repository's service patterns.
- Keep schema interfaces, canonical SQL, and additive migrations consistent. Do not require a database wipe.
- Validate boundaries and enforce roles/privacy server-side; hidden controls are not access control.
- Prefer explicit actions, preserved drafts, atomic updates, and recoverable lifecycle operations.
- Keep AI and external integrations optional. Do not add a mandatory worker, database server, or cloud service without an approved need.
- Match TipTap content persistence and DOCX export when changing editor capabilities.
- Preserve GPL and dependency notices; contributions are submitted under GPL-3.0-only.

## Verification

```bash
npm run lint
npm run build
npm audit --omit=dev
```

Run focused synthetic behavior checks for affected APIs, roles, privacy, export, and lifecycle transitions. Check desktop/mobile layouts and keyboard controls. The repository currently does not ship a persistent automated test suite; document the checks performed in the change description.

On filesystems with shared build-cache constraints, build to a separate `OMNITOOL_DIST_DIR` while a server is running. Do not remove or rebuild a live cache. Avoid overlapping build commands.

## Change Submission

Describe the user workflow, behavior changes, verification, and limitations. Keep commits focused. Do not commit database files, server secrets, environment credentials, recovery archives, imported private data, or scratch acceptance fixtures. Stage explicit paths and review the staged diff before committing.

For vulnerabilities, follow [SECURITY.md](SECURITY.md) instead of publishing sensitive details in a public issue.