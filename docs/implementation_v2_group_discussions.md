# Briefr v2 — Group Discussion Intelligence
## Extension Implementation Plan for AI Agent Execution

> **Context:** This document extends `implementation.md` (Briefr v1).
> v1 must be fully deployed and passing all verification checklists before this plan is executed.
> This is an additive plan — nothing in v1 is removed or broken.
> All phases build on top of the existing monorepo, database, and API.

---

## What Is Changing and Why

Briefr v1 handles **structured meetings** — a host uploads a transcript, an AI extracts tasks,
an admin assigns them. The session has a clear start, end, and owner.

**Group Discussions are different:**

| Dimension | Meeting (v1) | Group Discussion (v2) |
|---|---|---|
| Structure | Formal, chaired | Informal, multi-speaker |
| Transcript shape | Linear, one voice | Interleaved, multi-voice |
| Output type | Action items with owners | Insights, decisions, open questions, and action items |
| Participants | Host assigns tasks | Any participant can raise a point or own an action |
| Lifecycle | One session → done | Can span multiple sessions (ongoing discussion threads) |
| Use case | Project standup, client call | Seminar, tutorial group, brainstorm, research discussion |

The AI layer needs to be extended, not replaced. The same extraction pipeline is reused
but with a richer prompt and a different output schema.

---

## New Concepts Introduced in v2

### DiscussionSession
A group discussion event. Unlike a Meeting, it has no single host — it has
**facilitators** (one or more) and **participants**. It can link to a parent
**DiscussionThread** if it is part of an ongoing series (e.g. weekly tutorial group).

### DiscussionThread
An ongoing series of related discussion sessions. Equivalent to a "topic" or "course" that
generates multiple sessions over time. Allows the AI to reason across sessions
(e.g. "was this question resolved in a later session?").

### DiscussionInsight
The structured output of a group discussion extraction. Richer than a Task — contains:
- **Action items** (same as v1 tasks, but speaker-attributed)
- **Key decisions** (conclusions the group reached)
- **Open questions** (unresolved points raised but not answered)
- **Discussion summary** (2–3 sentence narrative of what was covered)

### Speaker Attribution
Group discussions have named speakers. The LLM prompt in v2 is speaker-aware —
it reads transcripts formatted as `[SpeakerName]: text` and attributes each
action item, decision, or question to the speaker who raised or owns it.

---

## New Environment Variables

Add these to `/server/.env` — do not remove any existing v1 variables:

```
# v2 additions — append to existing /server/.env
DISCUSSION_SUMMARY_MAX_TOKENS=500
SPEAKER_ATTRIBUTION_ENABLED=true
```

No new frontend env vars needed.

---

## v2 Database Changes

### New Collections

**`discussion_threads`**
```json
{
  "_id": "ObjectId",
  "title": "string",
  "subject": "string",
  "projectId": "string (ref: projects)",
  "facilitatorIds": ["string (ref: users)"],
  "participantIds": ["string (ref: users)"],
  "sessionCount": "number",
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

**`discussion_sessions`**
```json
{
  "_id": "ObjectId",
  "threadId": "string (ref: discussion_threads)",
  "sessionNumber": "number",
  "title": "string",
  "rawTranscript": "string",
  "speakerMap": {
    "SpeakerLabel": { "userId": "string", "name": "string", "email": "string" }
  },
  "extractedInsights": {
    "summary": "string",
    "actionItems": [
      {
        "title": "string",
        "description": "string",
        "attributedTo": "string (speakerLabel)",
        "priority": "high | medium | low",
        "deadlineHint": "string"
      }
    ],
    "decisions": [
      { "text": "string", "raisedBy": "string (speakerLabel)" }
    ],
    "openQuestions": [
      { "text": "string", "raisedBy": "string (speakerLabel)" }
    ]
  },
  "tasksGenerated": ["string (ref: tasks)"],
  "status": "draft | extracted | reviewed | closed",
  "facilitatedBy": ["string (ref: users)"],
  "scheduledAt": "datetime",
  "createdAt": "datetime"
}
```

### Modified Collections

**`tasks`** — add two optional fields (backward compatible, v1 tasks unaffected):
```json
{
  "sourceType": "meeting | discussion",
  "sourceSessionId": "string (ref: discussion_sessions, optional)"
}
```

**`users`** — no schema change needed.

### Migration Script

Create `server/migrations/v2_add_discussion_collections.py`:

```python
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

async def migrate():
    client = AsyncIOMotorClient(os.getenv("MONGO_URI"))
    db = client["briefr"]

    existing = await db.list_collection_names()

    if "discussion_threads" not in existing:
        await db.create_collection("discussion_threads")
        await db["discussion_threads"].create_index("projectId")
        print("Created: discussion_threads")

    if "discussion_sessions" not in existing:
        await db.create_collection("discussion_sessions")
        await db["discussion_sessions"].create_index("threadId")
        await db["discussion_sessions"].create_index("status")
        print("Created: discussion_sessions")

    # Patch existing tasks with sourceType = "meeting" for backward compat
    result = await db["tasks"].update_many(
        {"sourceType": {"$exists": False}},
        {"$set": {"sourceType": "meeting", "sourceSessionId": None}}
    )
    print(f"Patched {result.modified_count} existing tasks with sourceType: meeting")

    print("Migration v2 complete")
    client.close()

asyncio.run(migrate())
```

Run with: `cd server && python migrations/v2_add_discussion_collections.py`

---

## v2 Backend — New Routes

Add these router files. Do not modify any existing v1 router files.

### New file: `server/app/routes/discussions.py`

#### Discussion Thread Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/discussions/threads` | Admin / Facilitator | Create a new discussion thread |
| GET | `/api/discussions/threads` | Bearer | List threads the user is part of |
| GET | `/api/discussions/threads/:id` | Bearer | Get thread with all sessions listed |
| PATCH | `/api/discussions/threads/:id` | Admin / Facilitator | Update thread title, add participants |
| DELETE | `/api/discussions/threads/:id` | Admin only | Delete thread and all sessions |

#### Discussion Session Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/discussions/sessions` | Admin / Facilitator | Create a new session under a thread |
| GET | `/api/discussions/sessions/:id` | Bearer | Get session with extracted insights |
| POST | `/api/discussions/sessions/:id/extract` | Admin / Facilitator | Trigger LLM extraction |
| POST | `/api/discussions/sessions/:id/confirm` | Admin / Facilitator | Confirm insights, convert action items to tasks |
| PATCH | `/api/discussions/sessions/:id` | Admin / Facilitator | Edit insights before confirming |
| GET | `/api/discussions/sessions` | Bearer | List sessions (filter by threadId) |

### Route Implementation Notes

**`POST /api/discussions/sessions/:id/extract`**
- Reads `rawTranscript` and `speakerMap` from the session document
- Calls the new `extract_discussion_insights()` LLM service (see below)
- Writes result to `extractedInsights` field
- Updates `status` to `"extracted"`
- Returns the full insights object

**`POST /api/discussions/sessions/:id/confirm`**
- Reads confirmed `extractedInsights.actionItems` from request body
- For each action item: creates a Task document with `sourceType: "discussion"` and `sourceSessionId`
- Sends email notifications to assigned users (reuse v1 email service)
- Updates session `status` to `"reviewed"`
- Updates session `tasksGenerated` with new task IDs
- Returns list of created task IDs

**Facilitator role logic:**
A user is a facilitator of a session if their `userId` is in `facilitatedBy` array.
Add a helper dependency:

```python
# server/app/middleware/auth.py — add this function

async def require_facilitator_or_admin(
    session_id: str,
    current_user=Depends(get_current_user)
):
    from app.database import discussion_sessions_col
    from bson import ObjectId
    session = await discussion_sessions_col.find_one({"_id": ObjectId(session_id)})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    is_facilitator = str(current_user["_id"]) in session.get("facilitatedBy", [])
    is_admin = current_user["role"] == "admin"
    if not (is_facilitator or is_admin):
        raise HTTPException(status_code=403, detail="Facilitator or admin access required")
    return current_user
```

### Register in `main.py`

Add this line after existing router registrations:

```python
from app.routes import discussions
app.include_router(discussions.router, prefix="/api/discussions", tags=["discussions"])
```

---

## v2 LLM Service Extension

### New file: `server/app/services/llm_discussion.py`

```python
import json
import re
from openai import AsyncOpenAI
from app.config import settings

client = AsyncOpenAI(api_key=settings.LLM_API_KEY)

DISCUSSION_SYSTEM_PROMPT = """
You are an academic and professional group discussion analyzer.

You will receive a meeting transcript where each line is formatted as:
[SpeakerName]: their spoken text

Your job is to extract structured insights from this discussion.

Return ONLY a valid JSON object. No explanation, no markdown, no code fences.

The JSON object must have exactly these fields:
{
  "summary": "2-3 sentence narrative summary of what was discussed",
  "actionItems": [
    {
      "title": "short action title (max 10 words)",
      "description": "one sentence describing what needs to be done",
      "attributedTo": "SpeakerName who owns or was assigned this action (empty string if unclear)",
      "priority": "high | medium | low",
      "deadlineHint": "deadline mentioned in natural language (empty string if none)"
    }
  ],
  "decisions": [
    {
      "text": "one sentence describing the decision reached",
      "raisedBy": "SpeakerName who proposed or confirmed the decision"
    }
  ],
  "openQuestions": [
    {
      "text": "one sentence describing the unresolved question",
      "raisedBy": "SpeakerName who raised the question"
    }
  ]
}

Rules:
- If a speaker name appears in attributedTo, raisedBy — it must exactly match a name from the transcript
- If a section has no items, return an empty array []
- Do not invent speakers or actions not present in the transcript
- summary must be neutral and factual
"""

async def extract_discussion_insights(
    raw_transcript: str,
    speaker_map: dict
) -> dict:
    # Build speaker context hint for the LLM
    speaker_context = "Known speakers in this discussion:\n"
    for label, info in speaker_map.items():
        speaker_context += f"- {label} ({info.get('name', label)})\n"

    user_message = f"{speaker_context}\n\nTranscript:\n\n{raw_transcript}"

    for attempt in range(3):
        try:
            response = await client.chat.completions.create(
                model=settings.LLM_MODEL,
                messages=[
                    {"role": "system", "content": DISCUSSION_SYSTEM_PROMPT},
                    {"role": "user", "content": user_message}
                ],
                temperature=0.1,
                max_tokens=1500,
            )
            raw = response.choices[0].message.content.strip()
            raw = re.sub(r"```json|```", "", raw).strip()
            result = json.loads(raw)

            # Validate required keys
            for key in ["summary", "actionItems", "decisions", "openQuestions"]:
                if key not in result:
                    result[key] = [] if key != "summary" else ""

            return result

        except (json.JSONDecodeError, Exception) as e:
            if attempt == 2:
                raise ValueError(f"Discussion extraction failed after 3 attempts: {e}")

    return {"summary": "", "actionItems": [], "decisions": [], "openQuestions": []}
```

---

## v2 Pydantic Models

### New file: `server/app/models/discussion.py`

```python
from pydantic import BaseModel
from typing import Optional, List, Dict, Literal
from datetime import datetime

class SpeakerInfo(BaseModel):
    userId: str
    name: str
    email: str

class ActionItemInsight(BaseModel):
    title: str
    description: str
    attributedTo: str = ""
    priority: Literal["high", "medium", "low"] = "medium"
    deadlineHint: str = ""

class DecisionInsight(BaseModel):
    text: str
    raisedBy: str = ""

class OpenQuestionInsight(BaseModel):
    text: str
    raisedBy: str = ""

class ExtractedInsights(BaseModel):
    summary: str = ""
    actionItems: List[ActionItemInsight] = []
    decisions: List[DecisionInsight] = []
    openQuestions: List[OpenQuestionInsight] = []

class DiscussionThreadCreate(BaseModel):
    title: str
    subject: str
    projectId: str
    facilitatorIds: List[str] = []
    participantIds: List[str] = []

class DiscussionSessionCreate(BaseModel):
    threadId: str
    title: str
    rawTranscript: str
    speakerMap: Dict[str, SpeakerInfo] = {}
    scheduledAt: Optional[datetime] = None
    facilitatedBy: List[str] = []

class DiscussionSessionUpdate(BaseModel):
    extractedInsights: Optional[ExtractedInsights] = None
    status: Optional[Literal["draft", "extracted", "reviewed", "closed"]] = None

class ConfirmInsightsRequest(BaseModel):
    actionItems: List[ActionItemInsight]
    projectId: str
```

---

## v2 Frontend — New Screens

Build these screens in order. All existing v1 screens remain unchanged.

### New route additions in `App.tsx`

```typescript
// Add to existing routes — do not remove any v1 routes
import DiscussionThreadsPage   from './pages/discussions/DiscussionThreadsPage'
import DiscussionSessionPage   from './pages/discussions/DiscussionSessionPage'
import DiscussionIngestPage    from './pages/discussions/DiscussionIngestPage'
import DiscussionReviewPage    from './pages/discussions/DiscussionReviewPage'

// Add inside <Routes>
<Route path="/discussions"
  element={<PrivateRoute><DiscussionThreadsPage /></PrivateRoute>} />
<Route path="/discussions/:threadId/session/new"
  element={<FacilitatorRoute><DiscussionIngestPage /></FacilitatorRoute>} />
<Route path="/discussions/sessions/:sessionId"
  element={<PrivateRoute><DiscussionSessionPage /></PrivateRoute>} />
<Route path="/discussions/sessions/:sessionId/review"
  element={<FacilitatorRoute><DiscussionReviewPage /></FacilitatorRoute>} />
```

Add `FacilitatorRoute` guard to `App.tsx`:

```typescript
function FacilitatorRoute({ children }: { children: JSX.Element }) {
  const { user } = useAuth()
  // Allow both admins and members who may be facilitators
  // Actual facilitator check is enforced at the API level
  return user ? children : <Navigate to="/login" />
}
```

Add "Discussions" link to the Sidebar component (visible to all logged-in users).

---

### Screen 8: DiscussionThreadsPage (`/discussions`)

**What it shows:**
- List of all discussion threads the user is a participant or facilitator of
- Each thread card shows: title, subject, project name, session count, last activity date
- "New Thread" button (visible to admin only)

**New Thread modal (admin only):**
- Thread title input
- Subject / topic input
- Project dropdown (from `GET /api/projects`)
- Facilitator multi-select (from `GET /api/users`)
- Participant multi-select (from `GET /api/users`)
- Submit → `POST /api/discussions/threads`

**On clicking a thread:**
- Expand inline OR navigate to a thread detail view
- Show list of sessions with: session number, title, date, status badge
- "New Session" button (visible to facilitators and admin)

---

### Screen 9: DiscussionIngestPage (`/discussions/:threadId/session/new`)

**What it shows:**
A two-step form to create and upload a new discussion session.

**Step 1 — Session Details:**
- Session title input (e.g. "Week 3 Tutorial — Normalization")
- Date/time picker
- Facilitator(s) for this session (multi-select, pre-filled from thread)
- Submit → moves to Step 2

**Step 2 — Transcript & Speaker Mapping:**
- Textarea for raw transcript paste
- Transcript format hint shown:
  ```
  [Anushka]: We should finalize the schema first.
  [Emima]: Agreed, but we need to check with the guide first.
  [Omkaar]: I'll set up a meeting with him this week.
  ```
- Speaker Map builder — auto-detects speaker labels from the transcript as user types
- For each detected label: dropdown to map it to a registered user
- Example: `Anushka →` [select user from dropdown]
- Submit → `POST /api/discussions/sessions` → redirect to `/discussions/sessions/:id/review`

**Error states:**
- Transcript with no `[SpeakerName]:` format → warn user and suggest correct format
- Unmapped speakers → warn but allow submit (attributedTo will be the raw label)

---

### Screen 10: DiscussionReviewPage (`/discussions/sessions/:sessionId/review`) — Facilitator only

**This is the most complex v2 screen.**

**Layout — three-panel:**

```
┌─────────────────┬──────────────────────┬──────────────────────┐
│  Raw Transcript  │   Extracted Insights  │   Confirm & Assign   │
│  (read-only,     │   (editable)          │   (action items only) │
│   scrollable)    │                       │                       │
└─────────────────┴──────────────────────┴──────────────────────┘
```

**Left panel — Raw Transcript:**
- Displays the transcript with speaker labels highlighted in different colors
- Read-only, scrollable
- Each speaker gets a consistent color (same speaker = same color across all lines)

**Middle panel — Extracted Insights:**
- On page load, auto-trigger `POST /api/discussions/sessions/:id/extract`
- Show loading state: "AI is reading the discussion..."
- After extraction, show four sections:

  **Summary:**
  - Editable textarea (pre-filled from LLM)

  **Action Items:**
  - List of editable cards — each has: title, attributed speaker, priority, deadline hint
  - "Remove" button on each card
  - "Add manually" button to add a card the LLM missed

  **Key Decisions:**
  - List of editable text items with "raised by" label
  - "Remove" button on each

  **Open Questions:**
  - List of editable text items with "raised by" label
  - "Remove" button on each

**Right panel — Confirm Action Items:**
- Shows only the action items (not decisions/questions)
- For each action item, shows:
  - Task title (read-only from middle panel)
  - Assignee dropdown (from `GET /api/users`)
  - Deadline date picker
  - Priority selector
- "Confirm All & Create Tasks" button
- On submit → `POST /api/discussions/sessions/:id/confirm`
- On success → show toast "Tasks created and team notified" → link to Kanban

---

### Screen 11: DiscussionSessionPage (`/discussions/sessions/:sessionId`)

**What it shows (read view for all participants):**

- Session title, date, facilitator names
- AI-generated summary (read-only)
- Three collapsible sections:
  - ✅ Action Items — with assignee, status badge, deadline
  - 🔵 Key Decisions — bulleted list
  - ❓ Open Questions — bulleted list, with a "Mark Resolved" button (facilitator only)
- Link to Kanban filtered by this session's tasks
- "Back to Thread" breadcrumb

---

## v2 Sidebar Update

Add "Discussions" to the Sidebar component below "History":

```typescript
{ label: 'Discussions', path: '/discussions', icon: <MessageSquare size={16} /> }
```

Use `lucide-react`'s `MessageSquare` icon (already installed in v1).

---

## v2 Kanban Extension

The existing Kanban board already shows tasks. Add one small filter:

- Add a "Source" filter chip row: `All | Meetings | Discussions`
- Filter by `sourceType` field on tasks
- No other Kanban changes needed

This is a single frontend-only change — no new API endpoint required. Use the existing
`GET /api/tasks` response and filter client-side.

---

## v2 Seed Data Extension

Add to `server/seed.py` (or create `server/seed_v2.py`):

```python
# Run this AFTER v1 seed and migration
thread_id = ObjectId()
session_id = ObjectId()

await db["discussion_threads"].insert_one({
    "_id": thread_id,
    "title": "MCA Project Weekly Discussion",
    "subject": "Briefr development progress and blockers",
    "projectId": str(project_id),  # reuse from v1 seed
    "facilitatorIds": [str(admin_id)],
    "participantIds": [str(admin_id), str(member_id)],
    "sessionCount": 1,
    "createdAt": datetime.now(timezone.utc),
    "updatedAt": datetime.now(timezone.utc)
})

await db["discussion_sessions"].insert_one({
    "_id": session_id,
    "threadId": str(thread_id),
    "sessionNumber": 1,
    "title": "Session 1 — Kickoff and Role Assignment",
    "rawTranscript": "[Anushka]: I think we should start with the database schema before anything else.\n[Emima]: Agreed. Paavan, can you own the MongoDB setup?\n[Paavan]: Yes, I'll have the collections ready by Thursday.\n[Anushka]: Great. I'll start on the LLM prompt engineering in parallel.\n[Emima]: What about the frontend? Who picks that up?\n[Anushka]: Omkaar is handling React. He'll start with the auth screens.\n[Emima]: One open question — do we need a speaker attribution feature from day one or can that be v2?\n[Paavan]: Definitely v2. Let's keep v1 simple.",
    "speakerMap": {
        "Anushka": {"userId": str(admin_id), "name": "Admin User", "email": "admin@briefr.com"},
        "Emima": {"userId": str(member_id), "name": "Test Member", "email": "member@briefr.com"},
        "Paavan": {"userId": str(member_id), "name": "Test Member", "email": "member@briefr.com"}
    },
    "extractedInsights": {
        "summary": "The team agreed to begin with database schema setup before frontend work. Roles were assigned: Paavan owns MongoDB, Anushka leads LLM prompt engineering, Omkaar handles React frontend. Speaker attribution was deferred to v2.",
        "actionItems": [
            {"title": "Set up MongoDB collections", "description": "Create all 5 collections with correct schema", "attributedTo": "Paavan", "priority": "high", "deadlineHint": "Thursday"},
            {"title": "Start LLM prompt engineering", "description": "Draft and test the extraction system prompt", "attributedTo": "Anushka", "priority": "high", "deadlineHint": ""}
        ],
        "decisions": [
            {"text": "Database schema will be completed before any frontend development begins", "raisedBy": "Anushka"},
            {"text": "Speaker attribution feature is deferred to v2", "raisedBy": "Paavan"}
        ],
        "openQuestions": [
            {"text": "Should speaker attribution be implemented from day one or deferred?", "raisedBy": "Emima"}
        ]
    },
    "tasksGenerated": [],
    "status": "extracted",
    "facilitatedBy": [str(admin_id)],
    "scheduledAt": datetime.now(timezone.utc),
    "createdAt": datetime.now(timezone.utc)
})
print("v2 seed complete")
```

---

## v2 Verification Checklists

### Database ✓
- [ ] Migration script runs without errors
- [ ] `discussion_threads` collection exists with indexes on `projectId`
- [ ] `discussion_sessions` collection exists with indexes on `threadId` and `status`
- [ ] Existing tasks collection now has `sourceType: "meeting"` on all v1 tasks
- [ ] v2 seed inserts one thread and one session with extracted insights

### Backend ✓
- [ ] `GET /api/discussions/threads` returns threads for logged-in user
- [ ] `POST /api/discussions/threads` creates thread (admin only, returns 403 for members)
- [ ] `POST /api/discussions/sessions` creates session under a thread
- [ ] `POST /api/discussions/sessions/:id/extract` returns insights JSON with all 4 keys
- [ ] Extraction on the seed transcript returns at least 2 action items, 2 decisions, 1 open question
- [ ] `POST /api/discussions/sessions/:id/confirm` creates tasks and sends emails
- [ ] Confirmed tasks appear in `GET /api/tasks` with `sourceType: "discussion"`
- [ ] Member without facilitator role gets 403 on extract and confirm endpoints
- [ ] Migration does not break any v1 API endpoints

### Frontend ✓
- [ ] "Discussions" appears in sidebar for all logged-in users
- [ ] DiscussionThreadsPage lists threads correctly
- [ ] New Thread modal creates a thread and it appears in the list
- [ ] DiscussionIngestPage auto-detects speaker labels from pasted transcript
- [ ] Speaker map dropdowns correctly map labels to registered users
- [ ] DiscussionReviewPage loads and auto-triggers extraction
- [ ] Three-panel layout renders correctly (transcript | insights | confirm)
- [ ] Speaker labels are color-coded consistently in the transcript panel
- [ ] Action items, decisions, and open questions are all editable before confirming
- [ ] "Confirm All & Create Tasks" creates tasks visible on Kanban
- [ ] Kanban source filter (All | Meetings | Discussions) works correctly
- [ ] DiscussionSessionPage is readable by all thread participants
- [ ] "Mark Resolved" on open questions works for facilitators only

---

## What v2 Does NOT Change

The following v1 components are completely untouched:

- Auth system and JWT middleware (unchanged)
- Meeting flow — Ingest → Extract → Review → Assign (unchanged)
- Task schema core fields (two new optional fields added only)
- Kanban board core behaviour (one filter chip added)
- Calendar view (discussion tasks appear automatically via existing task query)
- Email notification service (reused as-is)
- All v1 API endpoints (no modifications)
- Deployment configuration (Railway + Vercel, no changes needed)

---

## Summary — What v2 Adds

| Addition | Type | Complexity |
|---|---|---|
| `discussion_threads` collection | DB | Low |
| `discussion_sessions` collection | DB | Medium |
| Migration script | DB | Low |
| `llm_discussion.py` — speaker-aware prompt | Backend | Medium |
| `discussions.py` router — 10 new endpoints | Backend | High |
| Facilitator role middleware | Backend | Low |
| `discussion.py` Pydantic models | Backend | Low |
| DiscussionThreadsPage | Frontend | Medium |
| DiscussionIngestPage with speaker map | Frontend | High |
| DiscussionReviewPage (3-panel) | Frontend | High |
| DiscussionSessionPage (read view) | Frontend | Low |
| Sidebar link addition | Frontend | Low |
| Kanban source filter chip | Frontend | Low |

**Estimated additional build time over v1:** 8–10 days at the same pace.
