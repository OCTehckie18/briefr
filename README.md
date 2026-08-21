# Briefr

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/OCTehckie18/briefr)

Briefr is an AI-powered meeting intelligence and academic assessment platform. It turns meeting transcripts and recorded Google Meet sessions into structured tasks, reports, and follow-up workflows. Its academic track uses the same transcript foundation to evaluate student sessions against configurable rubrics.

## What Briefr does

Briefr has two product tracks behind one authenticated workspace:

### Industry track

- Create projects, users, meetings, transcripts, and tasks.
- Ingest a pasted or uploaded transcript and process it with an LLM.
- Extract actionable tasks with owners, priorities, due dates, and descriptions.
- Schedule Google Meet sessions for automatic capture by the Playwright meeting bot.
- Transcribe captured audio locally with faster-whisper.
- Review meeting history and reports.
- Manage work from dashboard, Kanban, calendar, and task detail views.
- Send task-assignment email notifications through SMTP.

### Academic track

- Create cohorts and students.
- Define rubrics with one or more assessment dimensions.
- Create academic sessions and associate students with them.
- Map transcript participants to students.
- Generate AI-assisted assessments from transcript context.
- Review and publish assessments.
- View academic dashboards, calendars, and reports.

## Architecture

```text
                           +----------------------+
                           | React + Vite frontend|
                           |       :5173          |
                           +----------+-----------+
                                      |
                                      | REST / JSON
                                      v
                           +----------+-----------+
                           | FastAPI backend      |
                           |       :8000          |
                           | auth, tasks,         |
                           | transcripts,         |
                           | academic workflows   |
                           +----+------------+----+
                                |            |
                       MongoDB  |            | scheduled meetings
                                v            v
                         +------+--+   +-----+------+
                         | MongoDB |   | Meeting bot |
                         |         |   | Playwright  |
                         +---------+   |    :3001    |
                                       +-----+--------+
                                             |
                                             | audio
                                             v
                                      +------+-------+
                                      | Whisper STT  |
                                      | faster-whisper|
                                      |    :9000     |
                                      +--------------+
```

The repository contains four deployable services:

| Service | Purpose | Local port |
| --- | --- | ---: |
| `backend` | FastAPI API, authentication, MongoDB access, LLM processing, scheduling, and email | `8000` |
| `frontend` | React 19 / TypeScript single-page application served by Vite in development and Nginx in production | `5173` |
| `bot` | Express control server and Playwright worker that joins Google Meet and streams audio for transcription | `3001` |
| `whisper` | Flask wrapper around faster-whisper for local audio-to-text conversion | `9000` |

## Technology stack

- **Frontend:** React 19, TypeScript, Vite, React Router, TanStack Query, Zustand, Tailwind CSS, Framer Motion, Recharts, Lucide.
- **Backend:** Python 3.11, FastAPI, Uvicorn, Pydantic Settings, Motor/PyMongo, JWT authentication, APScheduler, Groq, aiosmtplib.
- **Meeting capture:** Node.js 18+, Express, Playwright, Chromium, `wav-encoder`.
- **Speech-to-text:** faster-whisper with FFmpeg; CPU/int8 configuration is the Docker default.
- **Data:** MongoDB.
- **Deployment:** Docker and Docker Compose.

## Repository layout

```text
backend/
  app/
    routes/          FastAPI route modules for auth, users, projects, meetings,
                     transcripts, tasks, bot callbacks, and academic workflows
    services/        LLM, academic LLM, email, auth, database, and scheduler services
    models/          Pydantic/domain models
  db/                Database initialization and seed scripts
  tests/             Backend unit tests
frontend/
  src/
    pages/           Industry and academic screens
    components/      Shared layout and UI components
    api/              Axios client and typed API endpoint helpers
    store/            Authentication and UI state
bot/
  server.js          Bot control HTTP server
  bot.js             Playwright meeting worker and audio pipeline
  auth-setup.js      Optional Google authentication setup helper
whisper-service/
  server.py          Local transcription HTTP service
docs/
  API.md             API reference
  DATABASE_SCHEMA.md Database and collection documentation
  implementation.md  Implementation notes
docker-compose.yml   Local multi-service orchestration
```

## Requirements

For Docker Compose:

- Docker Desktop or Docker Engine with Compose
- A MongoDB connection string
- A Groq API key for AI extraction and academic assessment

For local development without Docker:

- Python 3.11+
- Node.js 18+
- MongoDB
- FFmpeg for local Whisper transcription
- Chromium dependencies for Playwright if running the meeting bot

## Configuration

Create the service environment files from the included examples:

```powershell
Copy-Item backend\.env.example backend\.env
Copy-Item bot\.env.example bot\.env
```

At minimum, configure these backend values in `backend/.env`:

```dotenv
MONGO_URI=mongodb://localhost:27017
MONGO_DB_NAME=briefr
LLM_API_KEY=your_groq_api_key
JWT_SECRET=replace-with-a-long-random-secret
JWT_REFRESH_SECRET=replace-with-another-long-random-secret
FRONTEND_URL=http://localhost:5173
BOT_SERVICE_URL=http://localhost:3001
WHISPER_URL=http://localhost:9000
```

Configure the bot in `bot/.env` when running it independently:

```dotenv
BACKEND_URL=http://localhost:8000
WHISPER_URL=http://localhost:9000
BOT_PORT=3001
BOT_NAME=Briefr Bot
BOT_MAX_DURATION_MINUTES=120
BOT_USE_GOOGLE_AUTH=false
```

SMTP settings are optional for core transcript processing but required for task-assignment email notifications. The complete variable list is available in [`backend/.env.example`](backend/.env.example) and [`bot/.env.example`](bot/.env.example).

## Run with Docker Compose (Recommended)

Running Briefr via Docker Compose is **highly recommended** because the platform relies on four distinct components running simultaneously (Backend API, Frontend UI, Playwright Bot, and Whisper Service). Managing these manually locally can be complex.

```bash
docker compose up -d --build
```

Open the application at [http://localhost:5173](http://localhost:5173). The backend API is available at [http://localhost:8000](http://localhost:8000), and the service health endpoints are:

- `GET /` on the backend
- `GET /health` on the bot
- `GET /health` on Whisper

The first Whisper startup downloads and loads the configured model. With the default `base` model on CPU, the initial health check can take several minutes.

To stop the stack:

```bash
docker compose down
```

### Recent Major Updates
- **Speaker-Glow Attribution**: The Playwright bot now uses Google Meet's DOM "glow" to detect active speakers, intelligently chunking audio exactly at speaker turn boundaries.
- **Infinite Bot Sessions**: The meeting bot now stays in the session indefinitely until the host ends the call or removes the bot. 
- **Persisted Bot Identity**: Bot authentication is securely persisted across Docker containers via a base64 environment variable so the bot retains its exact Google account identity.
- **Isolated Meeting Contexts**: Meeting reports now rigorously isolate and display only tasks generated from that specific meeting's transcript.

## Run services locally (Not Recommended)

### Backend

```bash
cd backend
python -m venv .venv

# Windows PowerShell
.\.venv\Scripts\Activate.ps1

# macOS/Linux
# source .venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend uses `VITE_API_BASE_URL` for the backend URL and defaults to `http://localhost:8000`.

Useful frontend commands:

```bash
npm run build
npm run lint
npm run preview
```

### Meeting bot

```bash
cd bot
npm install
npx playwright install chromium
npm start
```

The backend scheduler calls `POST /start-bot` on the bot service for scheduled meetings. The bot prevents duplicate workers for the same meeting and reports status changes back to the backend.

### Whisper service

The service is easiest to run with its Dockerfile because it installs FFmpeg automatically. For a local Python process, install `faster-whisper` and `flask`, ensure FFmpeg is available, then run:

```bash
cd whisper-service
python server.py
```

Supported configuration variables are `WHISPER_MODEL`, `WHISPER_DEVICE`, `WHISPER_COMPUTE_TYPE`, and `PORT`. The default service exposes `POST /transcribe` and `GET /health` on port `9000`.

## Typical workflows

### Industry transcript workflow

1. Sign in and select an industry project.
2. Paste or upload a transcript, or schedule a Google Meet session.
3. Let the backend process the transcript with the configured Groq model.
4. Review extracted tasks and adjust owners, deadlines, priorities, and status.
5. Track execution from the dashboard, Kanban board, calendar, and meeting history.

### Academic assessment workflow

1. Create a cohort and add students.
2. Configure a rubric with assessment dimensions.
3. Create an academic session and select its participants.
4. Ingest or use a transcript, then map transcript participants to students.
5. Generate an assessment with the academic LLM.
6. Review the result and publish the assessment.

## API surface

The FastAPI application groups endpoints under:

- `/api/auth` — login, current-user, and token refresh operations
- `/api/users` — user management
- `/api/projects` — project management
- `/api/meetings` — meeting creation, scheduling, history, and reports
- `/api/transcripts` — transcript ingestion, retrieval, and task extraction
- `/api/tasks` — task creation, updates, status changes, and deletion
- `/api/bot` — bot callbacks and transcript-ready processing
- `/api/academic` — cohorts, students, rubrics, sessions, transcript context, assessments, review, and publishing

See [`docs/API.md`](docs/API.md) for request and response details.

## Testing

Backend tests can be run from the repository root with:

```bash
python -m pytest backend/tests
```

The frontend build and lint checks are:

```bash
cd frontend
npm run build
npm run lint
```

## Documentation

- [`docs/API.md`](docs/API.md) — API endpoints and payloads
- [`docs/DATABASE_SCHEMA.md`](docs/DATABASE_SCHEMA.md) — MongoDB collections and models
- [`docs/implementation.md`](docs/implementation.md) — implementation notes
- [`backend/README.md`](backend/README.md) — backend-specific notes
- [`DESIGN.md`](DESIGN.md) — broader product and interface design

## Notes for contributors

- Keep secrets in local `.env` files; do not commit them.
- When changing an API contract, update the typed frontend endpoint helpers and [`docs/API.md`](docs/API.md).
- Changes involving scheduled meetings should be checked across the backend scheduler, bot service, and Whisper service.
- Academic assessment changes should be covered by backend tests and reflected in the academic pages and endpoint helpers.
