# myapp (Python backend + TypeScript frontend, no Docker)

This repo is a portable starter you can open in VS Code.

## Prereqs

- Python 3.11+ (3.10+ usually works)
- Node.js 18+ (or 20+)
- npm (included with Node)

## Quick start

### 1) Setup (installs deps)

```bash
node scripts/setup.mjs
```

### 2) Run dev (starts backend + frontend)

```bash
node scripts/dev.mjs
```

2.5) If it gives an error you might be using the wrong Python. Python instead of Python3
try PYTHON=python3 node scripts/setup.mjs <--------------------

- Backend: http://127.0.0.1:8000/api/health
- Frontend: http://127.0.0.1:5173

## Notes

- The frontend uses Vite and proxies `/api` to the backend in dev.
- For production, build the frontend with `npm run build` and serve `frontend/dist` via your hosting choice.
