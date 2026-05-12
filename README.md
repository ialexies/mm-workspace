# Mad Monkey V3 – local workspace

This folder is an **umbrella workspace** used in Cursor / VS Code. Application code primarily lives in the **Frontend** and **Backend** repos (cloned into `frontend/` and `backend/`). The umbrella repo tracks shared tooling, Cursor rules, architectural notes, and some cross-cutting documentation.

## Start here

| Document | Purpose |
| -------- | ------- |
| [LOCAL_WORKSPACE.md](./LOCAL_WORKSPACE.md) | How this multi-root workspace is laid out and which files are umbrella-only |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | End-to-end stack overview (Next.js app, Bun/Hono API, integrations) |
| [docs/MOBILE_PLATFORM_DOCUMENTATION.md](./docs/MOBILE_PLATFORM_DOCUMENTATION.md) | Index of mobile-specific docs (Android, iOS, chat) |
| [TODO.md](./TODO.md) | Ad-hoc task list for this umbrella repo |

For day-to-day app development, prefer each package’s own `README.md` under `frontend/` and `backend/`.
