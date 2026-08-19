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

# Academic GD domain collections
academic_cohorts_col = db["academic_cohorts"]
academic_students_col = db["academic_students"]
academic_rubrics_col = db["academic_rubrics"]
academic_sessions_col = db["academic_sessions"]
academic_assessments_col = db["academic_assessments"]
