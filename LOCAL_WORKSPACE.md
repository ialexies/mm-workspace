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

- `.cursor/rules/*.mdc` – **Project rules** for Cursor (scoped by path + always-on stack/umbrella notes)  
- `.cursorrules` – Short pointer to `.cursor/rules/` (for tools that only read the root file)  
- `.cursorignore` – Cursor ignore patterns  
- `MM_V3.code-workspace` – Workspace definition  

This file [`LOCAL_WORKSPACE.md`](./LOCAL_WORKSPACE.md), [`README.md`](./README.md), and [`ARCHITECTURE.md`](./ARCHITECTURE.md) live at the umbrella root.

## Repo-specific ignore rules

Teams often add umbrella-only paths to each child repo via `frontend/.git/info/exclude` and `backend/.git/info/exclude` so Cursor artifacts do not clutter `git status` there.

## Local frontend + staging K8s backend (port-forward)

**Full tour deposit reference:** [`backend/docs/TOUR_DEPOSIT.md`](./backend/docs/TOUR_DEPOSIT.md) · **Umbrella index:** [`docs/TOUR_DEPOSIT.md`](./docs/TOUR_DEPOSIT.md)

Use this when running the **Next.js app locally** but you want the **real staging API** (Rezdy, Stripe test mode, Postgres, etc.) — especially for features like **tour deposit checkout** (`payment_plan: deposit`).

### Why not `https://staging-backend.madmonkeyhostels.com`?

The public staging hostname can route to a **different** checkout stack than the K8s `backend` service. Symptoms:

- UI shows deposit ($100) but Stripe charges the **full** tour price.
- `POST /cart/checkout` with `payment_plan: "deposit"` returns full `amount_minor`, not `10000`.
- Invalid `payment_plan` values are accepted instead of returning 400.

Port-forward hits the **same** backend pods as the staging cluster (e.g. image `backend:v5`), where deposit checkout works.

### Steps

1. **Start port-forward** (keep this terminal open):

   ```powershell
   kubectl port-forward -n staging svc/backend 18080:80
   ```

2. **Point the frontend** at the tunnel in `frontend/.env.local`:

   ```env
   NEXT_PUBLIC_V3_API_BASE=http://127.0.0.1:18080/
   ```

3. **Restart** the Next dev server (`npm run dev`) so env vars reload.

4. **Verify** the tunnel:

   ```text
   GET http://127.0.0.1:18080/health  →  {"status":"ok",...}
   ```

### Troubleshooting

| Issue | What to do |
| ----- | ---------- |
| `bind: Only one usage of each socket address` on 18080 | A port-forward is already running — use it, or pick another local port: `kubectl port-forward -n staging svc/backend 18081:80` and set `NEXT_PUBLIC_V3_API_BASE=http://127.0.0.1:18081/` |
| `lost connection to pod` | Staging pod restarted — rerun the port-forward command |
| Deposit UI OK but Stripe still full price | Confirm `.env.local` uses `127.0.0.1:18080` (not `staging-backend.madmonkeyhostels.com`) and dev server was restarted |

### Rezdy deposit sanity check

After a successful deposit test, Rezdy should show **Total** = full tour, **Balance** &gt; 0, and paid amount ≈ $100 USD (converted to the product currency, e.g. IDR).
