from pymongo import MongoClient
from pymongo.errors import ServerSelectionTimeoutError
import os
from dotenv import load_dotenv
from datetime import datetime, timedelta

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = os.getenv("MONGO_DB_NAME", "Breifr")

def init_database():
    """Initialize MongoDB collections and indices"""
    try:
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
        db = client[DB_NAME]
        
        print(f"✓ Connected to MongoDB: {DB_NAME}")
        
        # Drop existing collections (fresh start for dev)
        # Uncomment only for first-time setup or dev reset
        # for collection in db.list_collection_names():
        #     db[collection].drop()
        
        # ==================== USERS ====================
        if "users" not in db.list_collection_names():
            db.create_collection("users")
            db["users"].create_index("email", unique=True)
            print("✓ Created 'users' collection")
        
        # ==================== PROJECTS ====================
        if "projects" not in db.list_collection_names():
            db.create_collection("projects")
            print("✓ Created 'projects' collection")
        
        # ==================== MEETINGS ====================
        if "meetings" not in db.list_collection_names():
            db.create_collection("meetings")
            db["meetings"].create_index("projectId")
            db["meetings"].create_index("hostId")
            print("✓ Created 'meetings' collection")
        
        # ==================== TRANSCRIPTS ====================
        if "transcripts" not in db.list_collection_names():
            db.create_collection("transcripts")
            db["transcripts"].create_index("meetingId", unique=True)
            print("✓ Created 'transcripts' collection")
        
        # ==================== TASKS ====================
        if "tasks" not in db.list_collection_names():
            db.create_collection("tasks")
            db["tasks"].create_index("projectId")
            db["tasks"].create_index("assignedTo.userId")
            db["tasks"].create_index("status")
            print("✓ Created 'tasks' collection")
        
        print("\n✅ Database initialization complete!")
        
    except ServerSelectionTimeoutError:
        print("❌ Failed to connect to MongoDB. Check your MONGO_URI in .env")
        raise
    except Exception as e:
        print(f"❌ Error: {e}")
        raise
    finally:
        client.close()

if __name__ == "__main__":
    init_database()