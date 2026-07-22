from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings

# Async MongoDB client for FastAPI
client = AsyncIOMotorClient(settings.MONGO_URI)
db = client[settings.MONGO_DB_NAME]

# Collection handles — import these directly in routes/services
users_col = db["users"]
meetings_col = db["meetings"]
transcripts_col = db["transcripts"]
tasks_col = db["tasks"]
projects_col = db["projects"]