# Briefr

## Overview
Briefr is an AI-driven meeting intelligence and task automation application. The platform enables administrators to ingest meeting transcripts, leverage Large Language Models (LLMs) to extract actionable items, and manage the subsequent workflow. Users can review extracted action items, assign tasks to team members, and track progress across various views including a comprehensive dashboard, Kanban board, calendar view, and historical meeting records.

## Architecture

The project consists of three primary domains:

1. **Backend API**: A Python-based service utilizing FastAPI, MongoDB (asynchronous operations via Motor), integration with Groq LLMs for task extraction, and SMTP for email notifications.
2. **Frontend Application**: A responsive single-page application built with React 19, TypeScript, Vite, and styled via Tailwind CSS.
3. **Audio Capture Bot**: A Node.js headless browser bot built with Playwright designed to automatically join Google Meet sessions, extract raw audio streams, and send data to a Speech-to-Text (STT) provider for real-time transcription.

## Repository Structure

- `backend/`: Contains the FastAPI application, database connections, LLM integration, and core application logic.
- `frontend/`: Contains the React/Vite web application, routing, user interfaces, and state management.
- `docs/`: Contains detailed technical documentation, database schemas, and forward-looking implementation plans.

## Prerequisites

- Python 3.10+
- Node.js (version 18 or newer recommended)
- MongoDB instance (running locally or accessible via URI)

## Setup and Installation

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Configure environment variables:
   Copy `.env.example` to `.env` and fill in the required credentials.

4. Initialize the database and seed initial data:
   ```bash
   python db/init_db.py
   python db/seed.py
   ```

5. Run the development server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   Ensure `VITE_API_BASE_URL` is set appropriately in your environment (defaults to `http://localhost:8000`).

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Build for production:
   ```bash
   npm run build
   ```

## Primary User Flow

1. **Authentication**: Administrators and team members securely log in to the system.
2. **Ingestion**: Administrators navigate to the ingestion interface, select an active project, input meeting details, and upload or paste the raw text transcript.
3. **Task Extraction & Review**: The system utilizes LLMs to analyze the transcript and suggest task assignments. Administrators review these suggestions, finalizing assignees, deadlines, and priorities.
4. **Task Management**: Once confirmed, formal tasks are generated in the system. They populate across the dashboard, Kanban board, and calendar.
5. **Execution**: Assigned team members can view their specific tasks and update the task status (e.g., from "todo" to "in progress" to "done").

## Industry Meetings Workflow

The industry track supports two ways to create meeting intelligence:

1. **Recorded transcript**: An administrator selects a project, enters a meeting title, and uploads or pastes a `.txt` transcript. Briefr persists the meeting and transcript, then opens the review flow for AI task extraction.
2. **Scheduled meeting**: An administrator selects a project, adds a Google Meet URL, chooses a date and time, and optionally selects team members. The bot status is persisted and progresses through scheduled, joining, recording, complete, or failed states.

After processing, the resulting tasks are available across the dashboard, Kanban board, calendar, meeting history, and meeting detail view. Task status changes are persisted through the API, and failed reads or updates expose retry and rollback behavior instead of silently losing state.

The meeting history is API-backed and filtered by the active product track. Each meeting can be opened to review its transcript and linked action items. The meeting detail route is `/meetings/:id`.

## Industry Delivery Branches

Industry work is delivered sequentially from `industry-updates`. Each sequence branch is merged back before the next branch is created:

1. `industry-updates-01-transcript-ingestion`
2. `industry-updates-02-scheduled-meetings`
3. `industry-updates-03-meeting-archive`
4. `industry-updates-04-meeting-detail-report`
5. `industry-updates-05-task-lifecycle`
6. `industry-updates-06-error-retry-states`

The current integration branch is `industry-updates`.

## Documentation

For comprehensive technical specifications, database schemas, and future version implementation details, please refer to the files located within the `docs/` directory.
