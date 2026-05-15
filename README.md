# Mad Monkey V3 – local workspace

This folder is an **umbrella workspace** used in Cursor / VS Code. Application code primarily lives in the **Frontend** and **Backend** repos (cloned into `frontend/` and `backend/`). The umbrella repo tracks shared tooling, Cursor rules, architectural notes, and some cross-cutting documentation.

## Start here

| Document | Purpose |
| -------- | ------- |
| [LOCAL_WORKSPACE.md](./LOCAL_WORKSPACE.md) | How this multi-root workspace is laid out and which files are umbrella-only |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | End-to-end stack overview (Next.js app, Bun/Hono API, integrations) |
| [docs/MOBILE_PLATFORM_DOCUMENTATION.md](./docs/MOBILE_PLATFORM_DOCUMENTATION.md) | Index of mobile-specific docs (Android, iOS, chat, Klaviyo/geofence) |
| [frontend/docs/KLAVIYO_WHATSAPP_MARKETING_OPT_IN.md](./frontend/docs/KLAVIYO_WHATSAPP_MARKETING_OPT_IN.md) | Native geofence disclosure + automatic Klaviyo WhatsApp marketing subscribe (`POST /marketing/whatsapp-consent`) |
| [TODO.md](./TODO.md) | Ad-hoc task list for this umbrella repo |
| [`.cursor/rules/`](./.cursor/rules/) | Cursor Agent rules (shared stack truth + per-folder Next / Hono / WordPress scopes) |

For day-to-day app development, prefer each package’s own `README.md` under `frontend/` and `backend/`.
