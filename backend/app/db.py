from pymongo import MongoClient
from pymongo.errors import ServerSelectionTimeoutError
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = os.getenv("MONGO_DB_NAME", "Breifr")

class MongoDatabase:
    """MongoDB connection manager for Breifr"""
    client: MongoClient = None
    db = None

    @classmethod
    def connect_db(cls):
        """Connect to Breifr database"""
        try:
            cls.client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
            cls.db = cls.client[DB_NAME]
            print(f"✓ Connected to Breifr database: {DB_NAME}")
        except ServerSelectionTimeoutError:
            print(f"❌ Failed to connect to Breifr. Check MONGO_URI in .env")
            raise
        except Exception as e:
            print(f"❌ Connection error: {e}")
            raise

    @classmethod
    def close_db(cls):
        """Close Breifr database connection"""
        if cls.client:
            cls.client.close()
            print("✓ Closed Breifr connection")

    @classmethod
    def get_db(cls):
        """Return Breifr database instance"""
        return cls.db

# Dependency injection for FastAPI
def get_database():
    """FastAPI dependency for database access"""
    return MongoDatabase.get_db()