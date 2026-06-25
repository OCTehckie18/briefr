from pymongo import MongoClient
from dotenv import load_dotenv
from datetime import datetime, timedelta
import os
from bson import ObjectId

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = os.getenv("MONGO_DB_NAME", "Breifr")

def seed_database():
    """Populate Breifr database with dummy data for local dev"""
    try:
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
        db = client[DB_NAME]
        
        print("🌱 Seeding Breifr database...\n")
        
        # Clear existing data
        db["users"].delete_many({})
        db["projects"].delete_many({})
        db["meetings"].delete_many({})
        db["transcripts"].delete_many({})
        db["tasks"].delete_many({})
        
        # ==================== USERS ====================
        users_data = [
            {
                "email": "rishi@breifr.com",
                "name": "Rishi",
                "role": "Admin",
                "passwordHash": "hashed_pwd_1",
                "createdAt": datetime.now()
            },
            {
                "email": "omkaar@breifr.com",
                "name": "Omkaar",
                "role": "Member",
                "passwordHash": "hashed_pwd_2",
                "createdAt": datetime.now()
            },
            {
                "email": "paavan@breifr.com",
                "name": "Paavan",
                "role": "Member",
                "passwordHash": "hashed_pwd_3",
                "createdAt": datetime.now()
            }
        ]
        users = db["users"].insert_many(users_data)
        user_ids = users.inserted_ids
        print(f"✓ Created {len(user_ids)} users")
        
        # ==================== PROJECTS ====================
        projects_data = [
            {
                "name": "Breifr FYP",
                "description": "AI-driven meeting intelligence and task automation system",
                "members": [
                    {"userId": user_ids[0], "name": "Rishi", "role": "Admin"},
                    {"userId": user_ids[1], "name": "Omkaar", "role": "Member"},
                    {"userId": user_ids[2], "name": "Paavan", "role": "Member"}
                ],
                "createdBy": user_ids[0],
                "createdAt": datetime.now()
            }
        ]
        projects = db["projects"].insert_many(projects_data)
        project_id = projects.inserted_ids[0]
        print(f"✓ Created {len(projects.inserted_ids)} project(s)")
        
        # ==================== MEETINGS ====================
        meetings_data = [
            {
                "projectId": project_id,
                "title": "Project Kickoff & Scope",
                "description": "Discussed project goals, tech stack, timeline",
                "hostId": user_ids[0],
                "members": [user_ids[0], user_ids[1], user_ids[2]],
                "meetingDate": datetime.now() - timedelta(days=2),
                "createdAt": datetime.now() - timedelta(days=2)
            },
            {
                "projectId": project_id,
                "title": "Database Schema Review",
                "description": "Finalized MongoDB collections and relationships",
                "hostId": user_ids[0],
                "members": [user_ids[0], user_ids[1], user_ids[2]],
                "meetingDate": datetime.now() - timedelta(days=1),
                "createdAt": datetime.now() - timedelta(days=1)
            }
        ]
        meetings = db["meetings"].insert_many(meetings_data)
        meeting_ids = meetings.inserted_ids
        print(f"✓ Created {len(meeting_ids)} meetings")
        
        # ==================== TRANSCRIPTS ====================
        transcript_data = [
            {
                "meetingId": meeting_ids[0],
                "rawText": """
Rishi: Good morning team. Let's discuss the project scope and timeline.

Omkaar: I'll handle the backend architecture and API design. Should take about 2 days.

Paavan: I'll start frontend with React and Tailwind. Need the API contracts by tomorrow.

Rishi: Perfect. Let's also finalize the MongoDB schema today. Admin review screen is critical.

Omkaar: Agreed. I'll document the schema and share by EOD.

Rishi: Great. Let's reconvene tomorrow to review. Meeting adjourned.
                """.strip(),
                "extractedTasks": [
                    {
                        "title": "Design backend API architecture",
                        "description": "FastAPI routes for auth, transcripts, tasks, extraction",
                        "owner": "Omkaar",
                        "dueDate": datetime.now() + timedelta(days=2),
                        "priority": "High"
                    },
                    {
                        "title": "Build frontend with React",
                        "description": "Login, transcript upload, Kanban board, calendar",
                        "owner": "Paavan",
                        "dueDate": datetime.now() + timedelta(days=7),
                        "priority": "High"
                    },
                    {
                        "title": "Finalize MongoDB schema",
                        "description": "Collections, indices, relationships documented",
                        "owner": "Rishi",
                        "dueDate": datetime.now() + timedelta(hours=8),
                        "priority": "High"
                    }
                ],
                "extractedAt": datetime.now(),
                "createdAt": datetime.now() - timedelta(days=2)
            },
            {
                "meetingId": meeting_ids[1],
                "rawText": """
Rishi: Let's review the MongoDB schema I documented.

Omkaar: Looks good. I see the indices on projectId and assignedTo.userId. Should we also index dueDate?

Rishi: Good catch. Yes, let's add that for calendar queries.

Paavan: The embedded tasks in Transcript make sense. Keeps everything flexible.

Rishi: Perfect. I'll update the schema. Let's finalize by EOD and commit to repo.
                """.strip(),
                "extractedTasks": [
                    {
                        "title": "Add dueDate index to tasks collection",
                        "description": "Optimize calendar view queries",
                        "owner": "Rishi",
                        "dueDate": datetime.now() + timedelta(hours=4),
                        "priority": "Medium"
                    },
                    {
                        "title": "Commit schema to GitHub",
                        "description": "Push updated schema.md to main branch",
                        "owner": "Rishi",
                        "dueDate": datetime.now() + timedelta(hours=6),
                        "priority": "High"
                    }
                ],
                "extractedAt": datetime.now(),
                "createdAt": datetime.now() - timedelta(days=1)
            }
        ]
        transcripts = db["transcripts"].insert_many(transcript_data)
        transcript_ids = transcripts.inserted_ids
        print(f"✓ Created {len(transcript_ids)} transcripts")
        
        # ==================== TASKS ====================
        tasks_data = [
            # From meeting 1
            {
                "transcriptId": transcript_ids[0],
                "projectId": project_id,
                "title": "Design backend API architecture",
                "description": "FastAPI routes for auth, transcripts, tasks, extraction",
                "status": "In Progress",
                "assignedTo": {"userId": user_ids[1], "name": "Omkaar"},
                "dueDate": datetime.now() + timedelta(days=2),
                "priority": "High",
                "createdAt": datetime.now(),
                "updatedAt": datetime.now()
            },
            {
                "transcriptId": transcript_ids[0],
                "projectId": project_id,
                "title": "Build frontend with React",
                "description": "Login, transcript upload, Kanban board, calendar",
                "status": "To Do",
                "assignedTo": {"userId": user_ids[2], "name": "Paavan"},
                "dueDate": datetime.now() + timedelta(days=7),
                "priority": "High",
                "createdAt": datetime.now(),
                "updatedAt": datetime.now()
            },
            {
                "transcriptId": transcript_ids[0],
                "projectId": project_id,
                "title": "Finalize MongoDB schema",
                "description": "Collections, indices, relationships documented",
                "status": "In Progress",
                "assignedTo": {"userId": user_ids[0], "name": "Rishi"},
                "dueDate": datetime.now() + timedelta(hours=8),
                "priority": "High",
                "createdAt": datetime.now(),
                "updatedAt": datetime.now()
            },
            # From meeting 2
            {
                "transcriptId": transcript_ids[1],
                "projectId": project_id,
                "title": "Add dueDate index to tasks collection",
                "description": "Optimize calendar view queries",
                "status": "To Do",
                "assignedTo": {"userId": user_ids[0], "name": "Rishi"},
                "dueDate": datetime.now() + timedelta(hours=4),
                "priority": "Medium",
                "createdAt": datetime.now(),
                "updatedAt": datetime.now()
            },
            {
                "transcriptId": transcript_ids[1],
                "projectId": project_id,
                "title": "Commit schema to GitHub",
                "description": "Push updated schema.md to main branch",
                "status": "To Do",
                "assignedTo": {"userId": user_ids[0], "name": "Rishi"},
                "dueDate": datetime.now() + timedelta(hours=6),
                "priority": "High",
                "createdAt": datetime.now(),
                "updatedAt": datetime.now()
            }
        ]
        tasks = db["tasks"].insert_many(tasks_data)
        print(f"✓ Created {len(tasks.inserted_ids)} tasks")
        
        print("\n✅ Breifr database seeding complete!\n")
        print(f"📊 Summary:")
        print(f"  - Users: {len(user_ids)}")
        print(f"  - Projects: {len(projects.inserted_ids)}")
        print(f"  - Meetings: {len(meeting_ids)}")
        print(f"  - Transcripts: {len(transcript_ids)}")
        print(f"  - Tasks: {len(tasks.inserted_ids)}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        raise
    finally:
        client.close()

if __name__ == "__main__":
    seed_database()