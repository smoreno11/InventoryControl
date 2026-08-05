# myapp — Python backend + TypeScript frontend

FastAPI + SQLite behind a Vite/TypeScript frontend. No Docker.

## Prereqs

- Python 3.11+ (3.10 usually works)
- Node.js 18+ (20+ preferred), which includes npm

## Quick start

```bash
cd myapp
make setup    # creates backend/.venv, installs Python + npm deps
make dev      # runs backend and frontend together
```

- Backend: http://127.0.0.1:8000/api/health
- Frontend: http://127.0.0.1:5173
- API docs: http://127.0.0.1:8000/docs

If `make setup` picks the wrong interpreter, point it at the right one:

```bash
PYTHON=python3 node scripts/setup.mjs
```

### Running the two halves separately

```bash
cd myapp/backend && .venv/bin/python -m uvicorn app.main:app --reload
```

```bash
cd myapp/frontend && npm run dev
```

## Layout

```
backend/
  app/
    main.py          app factory, CORS, lifespan, router mounting
    config.py        paths and environment settings
    validation.py    shared request-validation helper
    db/              connection, schema/migrations, one module per table
    schemas/         Pydantic request models, by domain
    routers/         HTTP routes, one module per domain
    scripts/         maintenance CLIs
  data/              sample CSV exports
  uploads/           files received via POST /api/upload

frontend/src/
  main.ts            bootstrap and tab navigation
  shell.ts           header, nav, page containers
  api/               typed client, one module per domain
  lib/               html escaping, formatting, DOM helpers
  pages/             one directory per screen
  features/          cross-page widgets
  styles/            imported in order by styles/index.css
  types.ts           API response shapes
```

Every path in the backend resolves relative to its own file, so the app behaves
the same regardless of the working directory it is started from.

## Importing a CSV

```bash
cd myapp/backend && .venv/bin/python -m app.scripts.import_csv data/Sheet1.csv
```

Appends by default. `--replace` wipes the table first and asks for confirmation;
it also discards the table's column defaults, so prefer appending.

## Notes

- Vite proxies `/api` to the backend in dev — frontend code should always use
  relative paths, never a hardcoded `http://127.0.0.1:8000`.
- `POST /api/upload` stores a file in `backend/uploads/`. It does **not** load it
  into the database; run the import script for that.
- For production, `npm run build` and serve `frontend/dist` from your host.
- The stylesheet is split across `styles/` and reassembled by `styles/index.css`.
  CSS is order-sensitive — do not reorder those imports.
