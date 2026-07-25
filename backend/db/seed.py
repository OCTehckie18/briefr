"""
Briefr seed script — populates the database with test data.
Uses bcrypt-hashed passwords and field names aligned with Pydantic models.

Run:  cd backend && python db/seed.py
"""
from pymongo import MongoClient
from passlib.context import CryptContext
from datetime import datetime, timedelta, timezone
from bson import ObjectId
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = os.getenv("MONGO_DB_NAME", "briefr")
pwd_ctx = CryptContext(schemes=["bcrypt"])


def seed_database():
    """Populate Briefr database with dummy data for local dev."""
    try:
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
        db = client[DB_NAME]

        print("[SEED] Seeding Briefr database...\n")

        # Clear existing data
        for col_name in ["users", "projects", "meetings", "transcripts", "tasks"]:
            db[col_name].delete_many({})

        # ==================== USERS ====================
        admin_id = ObjectId()
        member1_id = ObjectId()
        member2_id = ObjectId()

        users_data = [
            {
                "_id": admin_id,
                "name": "Admin User",
                "email": "admin@briefr.com",
                "password": pwd_ctx.hash("admin123"),
                "role": "admin",
                "createdAt": datetime.now(timezone.utc),
            },
            {
                "_id": member1_id,
                "name": "Omkaar",
                "email": "omkaar@briefr.com",
                "password": pwd_ctx.hash("member123"),
                "role": "member",
                "createdAt": datetime.now(timezone.utc),
            },
            {
                "_id": member2_id,
                "name": "Paavan",
                "email": "paavan@briefr.com",
                "password": pwd_ctx.hash("member123"),
                "role": "member",
                "createdAt": datetime.now(timezone.utc),
            },
        ]
        db["users"].insert_many(users_data)
        print(f"[OK] Created {len(users_data)} users")

        # ==================== PROJECTS ====================
        project_id = ObjectId()

        db["projects"].insert_one(
            {
                "_id": project_id,
                "name": "Briefr MVP",
                "description": "AI-driven meeting intelligence and task automation system",
                "adminId": str(admin_id),
                "createdAt": datetime.now(timezone.utc),
            }
        )
        print("[OK] Created 1 project")

        # ==================== MEETINGS ====================
        meeting1_id = ObjectId()
        meeting2_id = ObjectId()

        meetings_data = [
            {
                "_id": meeting1_id,
                "title": "Project Kickoff & Scope",
                "projectId": str(project_id),
                "hostId": str(admin_id),
                "memberIds": [str(member1_id), str(member2_id)],
                "scheduledAt": datetime.now(timezone.utc) - timedelta(days=2),
                "createdAt": datetime.now(timezone.utc) - timedelta(days=2),
            },
            {
                "_id": meeting2_id,
                "title": "Database Schema Review",
                "projectId": str(project_id),
                "hostId": str(admin_id),
                "memberIds": [str(member1_id), str(member2_id)],
                "scheduledAt": datetime.now(timezone.utc) - timedelta(days=1),
                "createdAt": datetime.now(timezone.utc) - timedelta(days=1),
            },
        ]
        db["meetings"].insert_many(meetings_data)
        print(f"[OK] Created {len(meetings_data)} meetings")

        # ==================== TRANSCRIPTS ====================
        transcript1_id = ObjectId()
        transcript2_id = ObjectId()

        transcripts_data = [
            {
                "_id": transcript1_id,
                "meetingId": str(meeting1_id),
                "rawText": (
                    "Admin: Good morning team. Let's discuss the project scope and timeline.\n\n"
                    "Omkaar: I'll handle the backend architecture and API design. Should take about 2 days.\n\n"
                    "Paavan: I'll start frontend with React and Tailwind. Need the API contracts by tomorrow.\n\n"
                    "Admin: Perfect. Let's also finalize the MongoDB schema today. Admin review screen is critical.\n\n"
                    "Omkaar: Agreed. I'll document the schema and share by EOD.\n\n"
                    "Admin: Great. Let's reconvene tomorrow to review. Meeting adjourned."
                ),
                "extractedTasks": [],
                "createdAt": datetime.now(timezone.utc) - timedelta(days=2),
            },
            {
                "_id": transcript2_id,
                "meetingId": str(meeting2_id),
                "rawText": (
                    "Admin: Let's review the MongoDB schema I documented.\n\n"
                    "Omkaar: Looks good. I see the indices on projectId and assignedTo.userId. "
                    "Should we also index dueDate?\n\n"
                    "Admin: Good catch. Yes, let's add that for calendar queries.\n\n"
                    "Paavan: The embedded tasks in Transcript make sense. Keeps everything flexible.\n\n"
                    "Admin: Perfect. I'll update the schema. Let's finalize by EOD and commit to repo."
                ),
                "extractedTasks": [],
                "createdAt": datetime.now(timezone.utc) - timedelta(days=1),
            },
        ]
        db["transcripts"].insert_many(transcripts_data)
        print(f"[OK] Created {len(transcripts_data)} transcripts")

        # ==================== TASKS ====================
        tasks_data = [
            {
                "title": "Design backend API architecture",
                "description": "FastAPI routes for auth, transcripts, tasks, extraction",
                "transcriptId": str(transcript1_id),
                "projectId": str(project_id),
                "assignedTo": {
                    "userId": str(member1_id),
                    "name": "Omkaar",
                    "email": "omkaar@briefr.com",
                },
                "deadline": datetime.now(timezone.utc) + timedelta(days=2),
                "priority": "high",
                "status": "in_progress",
                "createdAt": datetime.now(timezone.utc),
            },
            {
                "title": "Build frontend with React",
                "description": "Login, transcript upload, Kanban board, calendar",
                "transcriptId": str(transcript1_id),
                "projectId": str(project_id),
                "assignedTo": {
                    "userId": str(member2_id),
                    "name": "Paavan",
                    "email": "paavan@briefr.com",
                },
                "deadline": datetime.now(timezone.utc) + timedelta(days=7),
                "priority": "high",
                "status": "todo",
                "createdAt": datetime.now(timezone.utc),
            },
            {
                "title": "Finalize MongoDB schema",
                "description": "Collections, indices, relationships documented",
                "transcriptId": str(transcript1_id),
                "projectId": str(project_id),
                "assignedTo": {
                    "userId": str(admin_id),
                    "name": "Admin User",
                    "email": "admin@briefr.com",
                },
                "deadline": datetime.now(timezone.utc) + timedelta(hours=8),
                "priority": "high",
                "status": "done",
                "createdAt": datetime.now(timezone.utc),
            },
            {
                "title": "Add dueDate index to tasks collection",
                "description": "Optimize calendar view queries",
                "transcriptId": str(transcript2_id),
                "projectId": str(project_id),
                "assignedTo": {
                    "userId": str(admin_id),
                    "name": "Admin User",
                    "email": "admin@briefr.com",
                },
                "deadline": datetime.now(timezone.utc) + timedelta(hours=4),
                "priority": "medium",
                "status": "todo",
                "createdAt": datetime.now(timezone.utc),
            },
            {
                "title": "Commit schema to GitHub",
                "description": "Push updated schema.md to main branch",
                "transcriptId": str(transcript2_id),
                "projectId": str(project_id),
                "assignedTo": {
                    "userId": str(member1_id),
                    "name": "Omkaar",
                    "email": "omkaar@briefr.com",
                },
                "deadline": datetime.now(timezone.utc) + timedelta(hours=6),
                "priority": "high",
                "status": "todo",
                "createdAt": datetime.now(timezone.utc),
            },
        ]
        db["tasks"].insert_many(tasks_data)
        print(f"[OK] Created {len(tasks_data)} tasks")

        print("\n[DONE] Briefr database seeding complete!\n")
        print("Summary:")
        print(f"  - Users: {len(users_data)}")
        print(f"  - Projects: 1")
        print(f"  - Meetings: {len(meetings_data)}")
        print(f"  - Transcripts: {len(transcripts_data)}")
        print(f"  - Tasks: {len(tasks_data)}")
        print()
        print("Login credentials:")
        print("  Admin:  admin@briefr.com / admin123")
        print("  Member: omkaar@briefr.com / member123")
        print("  Member: paavan@briefr.com / member123")

    except Exception as e:
        print(f"[ERROR] {e}")
        raise
    finally:
        client.close()


if __name__ == "__main__":
    seed_database()