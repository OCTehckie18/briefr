# Briefr — Implementation Guide for AI Agent Execution

> **How to use this file:**
> Hand this file to an AI coding agent (e.g. Claude Code, Cursor, Copilot Workspace).
> Every phase is a self-contained instruction block. Execute phases in order.
> Do not skip a phase. Do not move to the next phase until the current phase's verification checklist passes.
> All commands assume a Unix/Linux/macOS environment.

---

## Project Overview

**Name:** Briefr — AI-Driven Meeting Intelligence and Task Automation System
**Stack:** React (Vite) + TypeScript + Tailwind CSS | Python FastAPI | MongoDB | LLM API | JWT | SMTP
**Repo structure:** monorepo with `/client` (frontend) and `/server` (backend)

---

## Environment Variables Required

Create `/server/.env` and `/client/.env` before starting. Never commit either file.

```
# /server/.env
MONGO_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/briefr
JWT_SECRET=<random_32_char_string>
JWT_REFRESH_SECRET=<random_32_char_string>
LLM_API_KEY=<openai_or_anthropic_api_key>
LLM_MODEL=gpt-4o               # or claude-sonnet-4-6
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=<gmail_address>
SMTP_PASSWORD=<gmail_app_password>
FRONTEND_URL=http://localhost:5173

# /client/.env
VITE_API_BASE_URL=http://localhost:8000
```

---

## Phase 1 — Scaffold & Bare Bones

**Goal:** One command starts the entire project locally. Nothing built yet, just structure.

### 1.1 Create monorepo

```bash
mkdir briefr && cd briefr
git init
echo "node_modules/\n.env\n__pycache__/\n*.pyc\n.venv/" > .gitignore
```

### 1.2 Frontend scaffold

```bash
npm create vite@latest client -- --template react-ts
cd client
npm install
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
npm install axios react-router-dom @tanstack/react-query
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
npm install react-calendar date-fns lucide-react
cd ..
```

Configure `client/tailwind.config.js`:
```js
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
}
```

Add to `client/src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### 1.3 Backend scaffold

```bash
python3 -m venv server/.venv
source server/.venv/bin/activate
pip install fastapi uvicorn[standard] pymongo motor python-jose[cryptography] \
            passlib[bcrypt] python-multipart httpx python-dotenv openai anthropic \
            aiosmtplib email-validator pydantic[email]
pip freeze > server/requirements.txt
```

### 1.4 Folder structure

Create the following structure exactly:

```
briefr/
├── client/
│   └── src/
│       ├── api/           # axios instance + per-module API calls
│       ├── components/    # shared UI components
│       ├── pages/         # one file per screen
│       ├── hooks/         # custom React hooks
│       ├── store/         # auth context / global state
│       ├── types/         # TypeScript interfaces
│       └── utils/         # helpers (date formatting, etc.)
├── server/
│   ├── app/
│   │   ├── main.py        # FastAPI app entry point
│   │   ├── config.py      # env var loading
│   │   ├── database.py    # MongoDB Motor connection
│   │   ├── models/        # Pydantic request/response models
│   │   ├── routes/        # one router file per module
│   │   ├── services/      # business logic (llm, email, auth)
│   │   └── middleware/    # JWT auth dependency
│   └── requirements.txt
├── .gitignore
└── README.md
```

### 1.5 Start scripts

`client/package.json` — confirm `"dev": "vite"` exists.

Create `server/start.sh`:
```bash
#!/bin/bash
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

### 1.6 Verification ✓

- [ ] `cd client && npm run dev` starts on `localhost:5173` with default Vite page
- [ ] `cd server && bash start.sh` starts uvicorn on `localhost:8000`
- [ ] `curl http://localhost:8000/` returns `{"status": "ok"}`
- [ ] Both `.env` files exist and are in `.gitignore`
- [ ] First commit pushed: `git add . && git commit -m "chore: initial scaffold"`

---

## Phase 2 — Database & Data Models

**Goal:** All five MongoDB collections exist with correct schema. Seed data loads without errors.

### 2.1 MongoDB connection (`server/app/database.py`)

```python
from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings

client = AsyncIOMotorClient(settings.MONGO_URI)
db = client["briefr"]

users_col       = db["users"]
meetings_col    = db["meetings"]
transcripts_col = db["transcripts"]
tasks_col       = db["tasks"]
projects_col    = db["projects"]
```

### 2.2 Pydantic models (`server/app/models/`)

Create one file per entity. Key schemas:

**`user.py`**
```python
from pydantic import BaseModel, EmailStr
from typing import Literal
from datetime import datetime

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: Literal["admin", "member"] = "member"

class UserOut(BaseModel):
    id: str
    name: str
    email: str
    role: str
```

**`task.py`**
```python
from pydantic import BaseModel
from typing import Optional, Literal
from datetime import datetime

class AssignedTo(BaseModel):
    userId: str
    name: str
    email: str

class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    transcriptId: str
    projectId: str
    assignedTo: Optional[AssignedTo] = None
    deadline: Optional[datetime] = None
    priority: Literal["high", "medium", "low"] = "medium"
    status: Literal["todo", "in_progress", "done"] = "todo"

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    assignedTo: Optional[AssignedTo] = None
    deadline: Optional[datetime] = None
    priority: Optional[Literal["high", "medium", "low"]] = None
    status: Optional[Literal["todo", "in_progress", "done"]] = None
```

**`transcript.py`**
```python
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class TranscriptCreate(BaseModel):
    meetingId: str
    rawText: str

class TranscriptOut(BaseModel):
    id: str
    meetingId: str
    rawText: str
    extractedTasks: list = []
    createdAt: datetime
```

**`meeting.py`**
```python
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class MeetingCreate(BaseModel):
    title: str
    projectId: str
    memberIds: List[str] = []
    scheduledAt: Optional[datetime] = None
```

**`project.py`**
```python
from pydantic import BaseModel

class ProjectCreate(BaseModel):
    name: str
    description: str = ""
```

### 2.3 Seed data script (`server/seed.py`)

```python
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from datetime import datetime, timezone
from bson import ObjectId
import os
from dotenv import load_dotenv

load_dotenv()
pwd_ctx = CryptContext(schemes=["bcrypt"])

async def seed():
    client = AsyncIOMotorClient(os.getenv("MONGO_URI"))
    db = client["briefr"]

    # Clear existing
    for col in ["users","meetings","transcripts","tasks","projects"]:
        await db[col].drop()

    # Admin user
    admin_id = ObjectId()
    member_id = ObjectId()
    project_id = ObjectId()
    meeting_id = ObjectId()
    transcript_id = ObjectId()
    task_id = ObjectId()

    await db["users"].insert_many([
        {"_id": admin_id, "name": "Admin User", "email": "admin@briefr.com",
         "password": pwd_ctx.hash("admin123"), "role": "admin",
         "createdAt": datetime.now(timezone.utc)},
        {"_id": member_id, "name": "Test Member", "email": "member@briefr.com",
         "password": pwd_ctx.hash("member123"), "role": "member",
         "createdAt": datetime.now(timezone.utc)},
    ])

    await db["projects"].insert_one({
        "_id": project_id, "name": "Briefr MVP",
        "description": "Internal project for Briefr development",
        "adminId": str(admin_id), "createdAt": datetime.now(timezone.utc)
    })

    await db["meetings"].insert_one({
        "_id": meeting_id, "title": "Kickoff Meeting",
        "projectId": str(project_id), "hostId": str(admin_id),
        "memberIds": [str(member_id)],
        "scheduledAt": datetime.now(timezone.utc),
        "createdAt": datetime.now(timezone.utc)
    })

    await db["transcripts"].insert_one({
        "_id": transcript_id, "meetingId": str(meeting_id),
        "rawText": "Anushka will set up the GitHub repository by Friday. Emima will write the SRS document by next Tuesday. Omkaar will design the database schema and share it with the team by Thursday.",
        "extractedTasks": [], "createdAt": datetime.now(timezone.utc)
    })

    await db["tasks"].insert_one({
        "_id": task_id, "title": "Set up GitHub repository",
        "description": "Initialize the project repo with folder structure and README",
        "transcriptId": str(transcript_id), "projectId": str(project_id),
        "assignedTo": {"userId": str(member_id), "name": "Test Member", "email": "member@briefr.com"},
        "deadline": datetime(2026, 7, 10, tzinfo=timezone.utc),
        "priority": "high", "status": "todo",
        "createdAt": datetime.now(timezone.utc)
    })

    print("Seed complete")
    print(f"Admin login: admin@briefr.com / admin123")
    print(f"Member login: member@briefr.com / member123")
    client.close()

asyncio.run(seed())
```

Run with: `cd server && python seed.py`

### 2.4 Verification ✓

- [ ] `python seed.py` completes without errors
- [ ] MongoDB Atlas shows 5 collections: users, meetings, transcripts, tasks, projects
- [ ] Each collection has at least 1 document
- [ ] Seed prints admin and member login credentials

---

## Phase 3 — Backend Routes

**Goal:** All API endpoints implemented and passing Postman/pytest tests. Auth working before any protected route is built.

### 3.1 FastAPI app entry (`server/app/main.py`)

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routes import auth, users, projects, meetings, transcripts, tasks

app = FastAPI(title="Briefr API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,        prefix="/api/auth",        tags=["auth"])
app.include_router(users.router,       prefix="/api/users",       tags=["users"])
app.include_router(projects.router,    prefix="/api/projects",    tags=["projects"])
app.include_router(meetings.router,    prefix="/api/meetings",    tags=["meetings"])
app.include_router(transcripts.router, prefix="/api/transcripts", tags=["transcripts"])
app.include_router(tasks.router,       prefix="/api/tasks",       tags=["tasks"])

@app.get("/")
async def root():
    return {"status": "ok"}
```

### 3.2 JWT Auth middleware (`server/app/middleware/auth.py`)

```python
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from app.config import settings
from app.database import users_col
from bson import ObjectId

bearer = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
        user_id = payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = await users_col.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

async def require_admin(current_user=Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user
```

### 3.3 Auth routes (`server/app/routes/auth.py`)

Implement these endpoints:

| Method | Path | Description | Auth |
|---|---|---|---|
| POST | `/api/auth/register` | Register new user | None |
| POST | `/api/auth/login` | Login, returns access + refresh token | None |
| POST | `/api/auth/refresh` | Refresh access token | Refresh token |
| GET  | `/api/auth/me` | Get current user profile | Bearer |

Token generation helper:
```python
from jose import jwt
from datetime import datetime, timedelta, timezone
from app.config import settings

def create_access_token(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=15)
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")

def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=7)
    }
    return jwt.encode(payload, settings.JWT_REFRESH_SECRET, algorithm="HS256")
```

### 3.4 All API endpoints

**Users**
| Method | Path | Auth |
|---|---|---|
| GET | `/api/users` | Admin only — list all users |
| GET | `/api/users/:id` | Bearer |

**Projects**
| Method | Path | Auth |
|---|---|---|
| POST | `/api/projects` | Admin only |
| GET  | `/api/projects` | Bearer — list projects user belongs to |
| GET  | `/api/projects/:id` | Bearer |

**Meetings**
| Method | Path | Auth |
|---|---|---|
| POST | `/api/meetings` | Admin only |
| GET  | `/api/meetings` | Bearer |
| GET  | `/api/meetings/:id` | Bearer |

**Transcripts**
| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/transcripts` | Admin only | Creates transcript linked to meetingId |
| POST | `/api/transcripts/:id/extract` | Admin only | **Triggers LLM extraction** |
| GET  | `/api/transcripts/:id` | Bearer | Returns rawText only (no download endpoint) |
| GET  | `/api/transcripts` | Bearer | List — members see metadata only, not rawText |

**Tasks**
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET  | `/api/tasks` | Bearer | Admin gets all; member gets own tasks only |
| GET  | `/api/tasks/:id` | Bearer | |
| POST | `/api/tasks` | Admin only | |
| PATCH | `/api/tasks/:id` | Admin only (except status update) | |
| PATCH | `/api/tasks/:id/status` | Bearer — any user can update own task status | |
| DELETE | `/api/tasks/:id` | Admin only | |

### 3.5 LLM Extraction Service (`server/app/services/llm.py`)

```python
import json
import re
from openai import AsyncOpenAI
from app.config import settings

client = AsyncOpenAI(api_key=settings.LLM_API_KEY)

SYSTEM_PROMPT = """
You are a meeting minutes analyzer. Given a raw meeting transcript, extract all action items.

Return ONLY a valid JSON array. No explanation, no markdown, no code fences.

Each item must have exactly these fields:
{
  "title": "short action item title (max 10 words)",
  "description": "one sentence describing the task",
  "assigneeHint": "name or role mentioned as responsible (empty string if unclear)",
  "deadlineHint": "deadline mentioned in natural language (empty string if none)",
  "priority": "high | medium | low"
}

If there are no action items, return an empty array: []
"""

async def extract_tasks_from_transcript(raw_text: str) -> list:
    for attempt in range(3):
        try:
            response = await client.chat.completions.create(
                model=settings.LLM_MODEL,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": f"Transcript:\n\n{raw_text}"}
                ],
                temperature=0.1,
                max_tokens=1000,
            )
            raw = response.choices[0].message.content.strip()
            # Strip markdown code fences if present
            raw = re.sub(r"```json|```", "", raw).strip()
            return json.loads(raw)
        except (json.JSONDecodeError, Exception) as e:
            if attempt == 2:
                raise ValueError(f"LLM extraction failed after 3 attempts: {e}")
    return []
```

### 3.6 Email Service (`server/app/services/email.py`)

```python
import aiosmtplib
from email.mime.text import MIMEText
from app.config import settings

async def send_task_assignment_email(
    to_email: str,
    to_name: str,
    task_title: str,
    deadline: str,
    kanban_url: str
):
    body = f"""
Hi {to_name},

You have been assigned a new task in Briefr:

Task: {task_title}
Deadline: {deadline}

View your tasks here: {kanban_url}

— Briefr
"""
    msg = MIMEText(body)
    msg["Subject"] = f"New task assigned: {task_title}"
    msg["From"] = settings.SMTP_USER
    msg["To"] = to_email

    await aiosmtplib.send(
        msg,
        hostname=settings.SMTP_HOST,
        port=settings.SMTP_PORT,
        username=settings.SMTP_USER,
        password=settings.SMTP_PASSWORD,
        start_tls=True,
    )
```

### 3.7 Verification ✓

Test every endpoint before moving to Phase 4. Use `curl` or Postman.

```bash
# Register
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@test.com","password":"test123","role":"member"}'

# Login
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@briefr.com","password":"admin123"}'

# Extract tasks (replace TOKEN and TRANSCRIPT_ID)
curl -X POST http://localhost:8000/api/transcripts/TRANSCRIPT_ID/extract \
  -H "Authorization: Bearer TOKEN"
```

- [ ] `POST /api/auth/register` returns user + tokens
- [ ] `POST /api/auth/login` returns access + refresh tokens
- [ ] `GET /api/auth/me` with valid token returns user profile
- [ ] `GET /api/auth/me` with invalid token returns 401
- [ ] Member hitting admin endpoint returns 403
- [ ] `POST /api/transcripts/:id/extract` returns JSON array of tasks
- [ ] LLM extraction returns parseable JSON on 3 different sample transcripts
- [ ] Task PATCH updates status in MongoDB
- [ ] Email sends on task assignment (check inbox)

---

## Phase 4 — Frontend

**Goal:** All 7 screens built, wired to real API, with error and loading states on every screen.

### 4.1 Axios instance (`client/src/api/axios.ts`)

```typescript
import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('access_token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api
```

### 4.2 Auth context (`client/src/store/AuthContext.tsx`)

```typescript
import { createContext, useContext, useState, ReactNode } from 'react'

interface User { id: string; name: string; email: string; role: 'admin' | 'member' }
interface AuthCtx { user: User | null; login: (u: User, token: string) => void; logout: () => void }

const AuthContext = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('user')
    return stored ? JSON.parse(stored) : null
  })

  const login = (u: User, token: string) => {
    setUser(u)
    localStorage.setItem('user', JSON.stringify(u))
    localStorage.setItem('access_token', token)
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('user')
    localStorage.removeItem('access_token')
  }

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)!
```

### 4.3 Router (`client/src/App.tsx`)

```typescript
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './store/AuthContext'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import TranscriptIngestPage from './pages/TranscriptIngestPage'
import TranscriptReviewPage from './pages/TranscriptReviewPage'
import KanbanPage from './pages/KanbanPage'
import CalendarPage from './pages/CalendarPage'
import HistoryPage from './pages/HistoryPage'

function PrivateRoute({ children }: { children: JSX.Element }) {
  const { user } = useAuth()
  return user ? children : <Navigate to="/login" />
}

function AdminRoute({ children }: { children: JSX.Element }) {
  const { user } = useAuth()
  return user?.role === 'admin' ? children : <Navigate to="/dashboard" />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
          <Route path="/ingest" element={<AdminRoute><TranscriptIngestPage /></AdminRoute>} />
          <Route path="/transcripts/:id/review" element={<AdminRoute><TranscriptReviewPage /></AdminRoute>} />
          <Route path="/kanban" element={<PrivateRoute><KanbanPage /></PrivateRoute>} />
          <Route path="/calendar" element={<PrivateRoute><CalendarPage /></PrivateRoute>} />
          <Route path="/history" element={<PrivateRoute><HistoryPage /></PrivateRoute>} />
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
```

### 4.4 Screens — build in this order

**Screen 1: LoginPage** (`/login`)
- Email + password form
- On submit: `POST /api/auth/login` → store token → redirect to `/dashboard`
- Show loading spinner on submit, error message on 401
- No registration UI (admin creates users via seed or direct DB)

**Screen 2: DashboardPage** (`/dashboard`)
- Left sidebar: nav links (Dashboard, Ingest, Kanban, Calendar, History)
- Main area: summary cards — total tasks, tasks due today, tasks done, tasks in progress
- Fetch counts from `GET /api/tasks`
- Admin sees all counts; member sees only their own

**Screen 3: TranscriptIngestPage** (`/ingest`) — Admin only
- Select project dropdown (fetch from `GET /api/projects`)
- Meeting title input
- Textarea for paste OR file upload (`.txt` files, read as text)
- Submit → `POST /api/meetings` then `POST /api/transcripts`
- On success → redirect to `/transcripts/:id/review`

**Screen 4: TranscriptReviewPage** (`/transcripts/:id/review`) — Admin only — MOST CRITICAL
- Two-panel layout:
  - Left panel (40%): raw transcript text, read-only, scrollable
  - Right panel (60%): extracted tasks list
- On page load: auto-trigger `POST /api/transcripts/:id/extract`
- Show loading state: "AI is extracting tasks..." with spinner
- Each extracted task renders as an editable card:
  - Title input (pre-filled from LLM)
  - Assignee dropdown (fetch users from `GET /api/users`)
  - Deadline date picker
  - Priority select (High / Medium / Low)
  - "Add Task" button → `POST /api/tasks`
- "Save All" button → posts all confirmed tasks in sequence
- After all saved → show success toast → link to Kanban

**Screen 5: KanbanPage** (`/kanban`)
- Three columns: To Do | In Progress | Done
- Fetch tasks: `GET /api/tasks` (admin gets all, member gets own)
- Task cards show: title, assignee avatar initials, priority badge, deadline
- Drag-and-drop between columns → `PATCH /api/tasks/:id/status`
- Admin sees "Assign" button on each card to re-assign
- Filter bar: by project, by assignee (admin only)

**Screen 6: CalendarPage** (`/calendar`)
- Monthly calendar view
- Each task with a deadline appears on its due date as a colored dot/chip
- Click a date → show task list for that date in a side panel
- Color by priority: red = high, amber = medium, green = low

**Screen 7: HistoryPage** (`/history`)
- List of all past meetings with title, date, project name
- Expand a meeting → show transcript metadata + list of tasks generated
- Members see meetings they were part of only

### 4.5 Shared components to build

| Component | Description |
|---|---|
| `Sidebar` | Left nav with role-conditional links |
| `TaskCard` | Reusable card for Kanban and review screen |
| `LoadingSpinner` | Centered spinner for async states |
| `ErrorBanner` | Red banner for API error messages |
| `PriorityBadge` | Color-coded High / Medium / Low chip |
| `Avatar` | Initials circle for user avatars |
| `ConfirmModal` | Generic "Are you sure?" modal |
| `Toast` | Success/error notification (top-right) |

### 4.6 Verification ✓

- [ ] Login works with seed credentials
- [ ] Admin sees Ingest link in sidebar; member does not
- [ ] Transcript ingest → extract → task cards appear on review screen
- [ ] All extracted task cards can be edited and saved
- [ ] Saved tasks appear on Kanban board
- [ ] Drag-and-drop on Kanban updates status (verify in MongoDB)
- [ ] Member logs in and sees only their own tasks on Kanban
- [ ] Calendar shows tasks on correct dates
- [ ] Assigned user receives email after task is saved on review screen
- [ ] 401 on expired token redirects to login
- [ ] 403 if member tries to access `/ingest` directly

---

## Phase 5 — Integration, Deployment & Ship

**Goal:** Full user journey works end-to-end on deployed URLs. One real person has tested it.

### 5.1 Full journey test (do this manually before deploying)

Walk this exact flow without skipping steps:

1. Log in as admin (`admin@briefr.com`)
2. Create a new project
3. Go to Ingest → paste this sample transcript:

```
Anushka will prepare the literature review document by next Monday.
Emima is responsible for setting up the MongoDB collections and seed data by Wednesday.
Omkaar will complete the Kanban board drag-and-drop implementation by Friday.
All three members will review the final presentation slides together on Saturday.
```

4. Submit → verify redirect to review screen
5. Confirm 4 extracted tasks appear
6. Assign each task to a user, set deadlines, set priorities
7. Click Save All
8. Log out → log in as member
9. Confirm assigned tasks appear on Kanban (and only those tasks)
10. Drag one task from To Do → In Progress
11. Log back in as admin → confirm status updated
12. Check member's email inbox → confirm assignment email arrived
13. Go to Calendar → confirm tasks appear on correct deadline dates
14. Go to History → confirm the meeting appears

### 5.2 Backend deployment (Railway)

```bash
# In /server — create Procfile
echo "web: uvicorn app.main:app --host 0.0.0.0 --port \$PORT" > Procfile

# Push to GitHub
git add . && git commit -m "feat: complete backend"
git push origin main
```

On Railway:
- New project → Deploy from GitHub → select `briefr` repo
- Root directory: `server`
- Add all environment variables from `/server/.env`
- Note the deployed URL: `https://briefr-api.up.railway.app`

### 5.3 Frontend deployment (Vercel)

```bash
# Update client/.env for production
echo "VITE_API_BASE_URL=https://briefr-api.up.railway.app" > client/.env.production
```

On Vercel:
- New project → Import from GitHub → select `briefr` repo
- Root directory: `client`
- Build command: `npm run build`
- Output directory: `dist`
- Add environment variable: `VITE_API_BASE_URL=https://briefr-api.up.railway.app`

### 5.4 Post-deploy checks

Update `FRONTEND_URL` in Railway env vars to the Vercel URL (fixes CORS).

- [ ] `https://briefr-api.up.railway.app/` returns `{"status":"ok"}`
- [ ] Frontend loads on Vercel URL
- [ ] Login works on deployed frontend against deployed backend
- [ ] Full journey test (5.1) passes on deployed URLs
- [ ] Email notifications work in production (verify Gmail SMTP app password is set)

### 5.5 Final verification ✓

- [ ] Full journey test passed (Section 5.1)
- [ ] Backend deployed on Railway with all env vars set
- [ ] Frontend deployed on Vercel
- [ ] CORS configured correctly (Railway allows Vercel URL)
- [ ] One real team member has tested the deployed app
- [ ] All 7 screens are navigable
- [ ] No console errors on any screen
- [ ] README updated with deployed URLs

---

## Constraints the Agent Must Respect

1. **Never expose the LLM API key** in any frontend code or committed file
2. **Never allow rawText download** — transcripts are view-only for members, not downloadable
3. **Member role cannot access** `/ingest`, `/transcripts/:id/review`, or `DELETE /api/tasks`
4. **LLM extraction must retry** up to 3 times before throwing an error
5. **Email must be sent as a background task** — do not block the API response waiting for SMTP
6. **Do not build registration UI** — user creation is admin-only via API or seed
7. **Do not move to the next phase** until the current phase's verification checklist is fully passed

---

## Quick Reference — All API Endpoints

| Method | Path | Auth | Module |
|---|---|---|---|
| POST | `/api/auth/register` | None | Auth |
| POST | `/api/auth/login` | None | Auth |
| POST | `/api/auth/refresh` | Refresh token | Auth |
| GET  | `/api/auth/me` | Bearer | Auth |
| GET  | `/api/users` | Admin | Users |
| GET  | `/api/users/:id` | Bearer | Users |
| POST | `/api/projects` | Admin | Projects |
| GET  | `/api/projects` | Bearer | Projects |
| GET  | `/api/projects/:id` | Bearer | Projects |
| POST | `/api/meetings` | Admin | Meetings |
| GET  | `/api/meetings` | Bearer | Meetings |
| GET  | `/api/meetings/:id` | Bearer | Meetings |
| POST | `/api/transcripts` | Admin | Transcripts |
| POST | `/api/transcripts/:id/extract` | Admin | Transcripts |
| GET  | `/api/transcripts/:id` | Bearer | Transcripts |
| GET  | `/api/transcripts` | Bearer | Transcripts |
| POST | `/api/tasks` | Admin | Tasks |
| GET  | `/api/tasks` | Bearer | Tasks |
| GET  | `/api/tasks/:id` | Bearer | Tasks |
| PATCH | `/api/tasks/:id` | Admin | Tasks |
| PATCH | `/api/tasks/:id/status` | Bearer | Tasks |
| DELETE | `/api/tasks/:id` | Admin | Tasks |
