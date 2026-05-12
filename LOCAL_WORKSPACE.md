# Local workspace setup

This directory is **not** the full application tree in Git: it is a **wrapper** plus local-only files. Production code ships from the repos under `frontend/` and `backend/`, plus the WordPress submodule `mmk-wp/`.

## Multi-root Cursor / VS Code workspace

[`MM_V3.code-workspace`](./MM_V3.code-workspace) opens four folders as one workspace:

| Folder (path) | Role |
| --------------- | ---- |
| **Root** `.` | Umbrella repo: docs, Cursor config, submodule pointer for `mmk-wp/` |
| **Frontend** `./frontend` | Next.js application (standalone Git repo when cloned normally) |
| **Backend** `./backend` | Bun + Hono API (standalone Git repo when cloned normally) |
| **MMK-WP** `./mmk-wp` | WordPress site codebase ([Git submodule](https://git-scm.com/book/en/v2/Git-Tools-Submodules)) |

The umbrella `.gitignore` excludes `frontend/` and `backend/` so their files are **not** double-tracked here; clone those repos beside or under this workspace as your team prefers.

### Optional sibling folders

You may see other directories on disk (for example tooling or experiments). If they do not appear in `MM_V3.code-workspace`, they are not part of the default multi-root layout.

## Umbrella-local files (not part of Frontend/Backend repos)

- `.cursorrules` – Cursor AI context for this combined workspace  
- `.cursorignore` – Cursor ignore patterns  
- `MM_V3.code-workspace` – Workspace definition  

This file [`LOCAL_WORKSPACE.md`](./LOCAL_WORKSPACE.md), [`README.md`](./README.md), and [`ARCHITECTURE.md`](./ARCHITECTURE.md) live at the umbrella root.

## Repo-specific ignore rules

Teams often add umbrella-only paths to each child repo via `frontend/.git/info/exclude` and `backend/.git/info/exclude` so Cursor artifacts do not clutter `git status` there.
