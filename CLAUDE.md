# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

СпортДок ("SportDoc") — an event/tournament management platform for combat-sport competitions (karate-style disciplines: kata, kumite variants). Two independently run pieces:

- `sportdok-backend/` — FastAPI + SQLAlchemy + PostgreSQL API
- `sportdok-frontend/` — React 19 + Vite SPA, calls the backend over plain `axios` (no generated client)

There is no root-level package manager or build tool tying the two together — run each independently.

## Commands

### Backend (`sportdok-backend/`)

```
python -m venv .venv                 # if .venv doesn't already exist
.venv\Scripts\activate                # Windows
pip install -r requirements.txt
docker compose up -d                  # from repo root: starts postgres (5432) + redis (6379), see docker-compose.yml
uvicorn app.main:app --reload         # run the API on http://127.0.0.1:8000
```

`docker-compose.yml` lives at the repo root (not under `sportdok-backend/`), so run `docker compose up -d` from there.

There is no test suite, linter, or migration tooling wired up yet (Alembic is a dependency in `requirements.txt` but no `alembic/` directory or `alembic.ini` exists). Tables are created ad hoc via `Base.metadata.create_all(bind=engine)` in `app/main.py` on import — there are no migrations to run.

Database connection defaults to `postgresql://sportdok_user:sportdok_pass@localhost:5432/sportdok` (see `app/database.py`), overridable via a `DATABASE_URL` env var / `.env` file (loaded with `python-dotenv`).

### Frontend (`sportdok-frontend/`)

```
npm install
npm run dev        # Vite dev server, http://localhost:5173
npm run build
npm run lint        # eslint .
npm run preview
```

The frontend's `axios` base URL is hardcoded to `http://127.0.0.1:8000` in `src/App.jsx` (`const API = ...`). CORS on the backend is configured to allow only `http://localhost:5173`. If you change the frontend dev port or the backend host/port, update both sides.

## Architecture

### Backend: single-file route layout

All FastAPI routes, Pydantic request schemas, and startup logic currently live in **`app/main.py`** — there is no router-per-resource split (no `APIRouter` usage). New endpoints are typically added directly to this file, grouped by resource under comment banners (`# ─── CLUBS ───`, `# ─── TOURNAMENTS ───`, etc.).

SQLAlchemy models live under `app/models/`, one file per resource (`user.py`, `club.py`, `tournament.py`, `athlete.py`), each importing `Base` from `app/database.py`. `athlete.py` defines two related tables in one file: `Athlete` (the person) and `Registration` (the athlete's entry into a specific tournament/discipline/category) — this is the join between athletes and tournaments, not a foreign-key-backed SQLAlchemy relationship (lookups are done with explicit `.filter()` queries in route handlers, not `relationship()`).

All primary keys are `UUID` (`sqlalchemy.dialects.postgresql.UUID`), generated client-side via `uuid.uuid4()` defaults, and are serialized to `str()` in API responses.

**No auth middleware/dependency exists yet.** `app/auth.py` provides `hash_password`/`verify_password` (passlib/bcrypt) and `create_token` (python-jose, HS256, 60 min expiry), used only during login to mint a JWT — but no route currently validates or requires that token via a FastAPI dependency. Treat all existing endpoints as unauthenticated when reasoning about access control.

### User roles and the login flow

There is no single `role` enum enforced anywhere; `login` in `main.py` checks two separate tables in sequence:
1. `users` table (role `admin`, seeded on startup as `admin@sportdok.ru` / `admin123` if absent) — see `create_admin()` startup hook in `main.py`.
2. `clubs` table (role always `"club"` in the response) — clubs self-register via `POST /api/v1/clubs/register` with `status="pending"` and must be approved by an admin (`POST /api/v1/clubs/{id}/approve`) before they can log in; `status="rejected"` blocks login with a message.

The frontend (`App.jsx`) branches on `user.role === "admin" || user.role === "owner"` to show `AdminPanel` — the `"owner"` role has no corresponding backend concept yet.

### API conventions

- All routes are prefixed `/api/v1/...`.
- Responses are hand-built dicts (no `response_model=`), typically `{"success": bool, ...}` for mutations and bare lists/objects for reads — there's no shared envelope helper, so match the existing shape per-endpoint rather than introducing a new response convention.
- Errors are mostly returned as `{"success": False, "message": "..."}` with HTTP 200, not raised `HTTPException`s — follow this pattern for user-facing validation failures (e.g. duplicate email, not-found) rather than switching to exceptions, to stay consistent with how the frontend checks `r.data.success`.

### Frontend: single-file component tree

`src/App.jsx` contains the entire UI as several components in one file (`LoginPage`, `ClubRegisterPage`, `AdminPanel`, `TournamentDetail`, top-level `App`) with page switching done via local `useState` (no router, despite `react-router-dom` being a dependency), and all styling as inline JS style objects at the top of the file (no CSS modules/Tailwind). `@tanstack/react-query` and `zustand` are dependencies but not yet used — data fetching is done with raw `useEffect` + `axios` calls and local component state.

UI copy is in Russian; keep new user-facing strings consistent with that.

## Known inconsistency to be aware of

As of this writing, `sportdok-backend/app/models/club.py` does not contain a `Club` SQLAlchemy model — it contains a full duplicate of an API layer (FastAPI app, routes, Pydantic schemas) that looks like a newer draft of `app/main.py`, while the actual `app/main.py` on disk is an older version without club endpoints. `app/models/__init__.py` only exports `Club` from that file. This means `from app.models.club import Club` (referenced by the newer main.py draft) will currently fail. If you're asked to work on club-related backend code, check both files' actual contents first rather than assuming `club.py` holds a model — this looks like content was pasted into the wrong file and likely needs reconciling before the backend will boot with club support.
