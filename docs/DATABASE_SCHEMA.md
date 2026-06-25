# Breifr — MongoDB Schema

## Overview
Breifr is an AI-driven meeting intelligence and task automation system. This document defines the MongoDB collections, document structure, and relationships.

---

## Collections

### 1. users
Admin and member accounts for the Breifr system.

```json
{
  "_id": ObjectId,
  "email": "rishi@example.com",
  "name": "Rishi",
  "role": "Admin",  // "Admin" or "Member"
  "passwordHash": "hashed_password_here",
  "createdAt": ISODate("2025-01-15T10:00:00Z")
}
```

**Indices:**
- `email` (unique)

**Notes:**
- Role determines access: Admin can manage transcripts/tasks, Members only see assigned tasks
- Password stored as hashed value (bcrypt or similar in backend)

---

### 2. projects
Team projects that contain meetings and tasks.

```json
{
  "_id": ObjectId,
  "name": "Breifr FYP",
  "description": "AI-driven meeting intelligence system",
  "members": [
    { "userId": ObjectId, "name": "Rishi", "role": "Admin" },
    { "userId": ObjectId, "name": "Omkaar", "role": "Member" },
    { "userId": ObjectId, "name": "Paavan", "role": "Member" }
  ],
  "createdBy": ObjectId,  // User ID (Admin who created project)
  "createdAt": ISODate("2025-01-15T10:00:00Z")
}
```

**Indices:**
- None (small documents, rarely queried directly)

**Notes:**
- Members array stores role information per project (different roles per project possible)
- `createdBy` links to the User who created the project

---

### 3. meetings
Meeting records linked to projects. Each meeting can have one transcript.

```json
{
  "_id": ObjectId,
  "projectId": ObjectId,  // Link to project
  "title": "Project Kickoff & Scope",
  "description": "Discussed project goals, tech stack, timeline",
  "hostId": ObjectId,  // User ID of who ran the meeting (Admin)
  "members": [ObjectId, ObjectId, ...],  // User IDs attending
  "meetingDate": ISODate("2025-01-15T14:00:00Z"),
  "createdAt": ISODate("2025-01-15T14:30:00Z")
}
```

**Indices:**
- `projectId` (find all meetings in a project)
- `hostId` (find all meetings hosted by a user)

**Notes:**
- Only project admins can create meetings
- `meetingDate` is when the meeting occurred, `createdAt` is when record was created

---

### 4. transcripts
Raw transcript text and AI-extracted action items linked to meetings.

```json
{
  "_id": ObjectId,
  "meetingId": ObjectId,  // Unique: one transcript per meeting
  "rawText": "Rishi: We need to finalize the paper...\nOmkaar: I'll handle the code...",
  "extractedTasks": [
    {
      "title": "Finalize deepfake detection paper",
      "description": "Complete abstract and methodology sections",
      "owner": "Rishi",
      "dueDate": ISODate("2025-02-01T00:00:00Z"),
      "priority": "High"
    },
    {
      "title": "Build extraction pipeline",
      "description": "Implement LLM-based action item extraction",
      "owner": "Omkaar",
      "dueDate": ISODate("2025-02-05T00:00:00Z"),
      "priority": "High"
    }
  ],
  "extractedAt": ISODate("2025-01-15T15:00:00Z"),
  "createdAt": ISODate("2025-01-15T14:30:00Z")
}
```

**Indices:**
- `meetingId` (unique: one transcript per meeting)

**Notes:**
- Transcript is **non-editable** after creation (audit trail)
- `extractedTasks` is an array of raw LLM-extracted data
- Admin reviews `extractedTasks` and creates formal **tasks** collection entries
- Flexible schema: task fields can vary depending on LLM output structure

---

### 5. tasks
Individual action items extracted from transcripts, assigned to users for tracking.

```json
{
  "_id": ObjectId,
  "transcriptId": ObjectId,  // Link to source transcript
  "projectId": ObjectId,  // Link to project (for Kanban board)
  "title": "Finalize deepfake detection paper",
  "description": "Complete abstract and methodology sections",
  "status": "To Do",  // "To Do", "In Progress", "Done"
  "assignedTo": {
    "userId": ObjectId,
    "name": "Rishi"
  },
  "dueDate": ISODate("2025-02-01T00:00:00Z"),
  "priority": "High",  // "High", "Medium", "Low"
  "createdAt": ISODate("2025-01-15T15:00:00Z"),
  "updatedAt": ISODate("2025-01-15T15:00:00Z")
}
```

**Indices:**
- `projectId` (find tasks in a project for Kanban board)
- `assignedTo.userId` (find tasks assigned to a user)
- `status` (filter by To Do / In Progress / Done)

**Notes:**
- Only **Admin can assign** tasks to users
- Regular users can **update status** (To Do → In Progress → Done)
- `updatedAt` tracks when task status last changed
- Embeds `assignedTo` to avoid joins (MongoDB best practice)

---

## Relationships