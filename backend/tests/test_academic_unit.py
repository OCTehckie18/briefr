import asyncio
import unittest
from unittest.mock import patch

from pydantic import ValidationError
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from jose import jwt

from app.models.academic import (
    AcademicSessionCreate,
    ParticipantMappingUpdate,
    RubricCreate,
)
from app.models.assessment import AssessmentDimensionScore
from app.routes.academic import _speaker_names
from app.services.academic_llm import generate_academic_assessments
from app.config import settings
from app.dependencies import get_current_user


class AcademicModelTests(unittest.TestCase):
    def test_session_defaults_to_draft_inputs_without_schedule(self):
        session = AcademicSessionCreate(
            title="AI in classrooms",
            topic="Should AI be used in classrooms?",
            cohortId="cohort-1",
            rubricId="rubric-1",
        )
        self.assertEqual(session.durationMinutes, 45)
        self.assertEqual(session.participantIds, [])
        self.assertIsNone(session.scheduledAt)

    def test_rubric_requires_at_least_one_dimension(self):
        with self.assertRaises(ValidationError):
            RubricCreate(name="Empty rubric", dimensions=[])

    def test_mapping_defaults_to_draft(self):
        mapping = ParticipantMappingUpdate()
        self.assertEqual(mapping.mappings, {})
        self.assertFalse(mapping.finalize)

    def test_score_rejects_negative_values(self):
        with self.assertRaises(ValidationError):
            AssessmentDimensionScore(
                key="clarity",
                label="Communication clarity",
                score=-1,
                maxScore=5,
                rationale="Invalid",
            )


class AcademicTranscriptTests(unittest.TestCase):
    def test_speaker_detection_supports_timestamps(self):
        raw = "[00:01] Alice: Opening statement\nBob: I agree\n[00:22] Alice: More detail"
        self.assertEqual(_speaker_names(raw), ["Alice", "Bob"])

    def test_speaker_detection_ignores_unlabelled_lines(self):
        raw = "Opening statement without a speaker\nThis is a sentence.\nAlice: Valid line"
        self.assertEqual(_speaker_names(raw), ["Alice"])


class AcademicLLMTests(unittest.TestCase):
    def test_assessment_requires_configured_llm_key(self):
        with patch("app.services.academic_llm.settings.LLM_API_KEY", ""):
            with self.assertRaisesRegex(ValueError, "LLM_API_KEY"):
                asyncio.run(generate_academic_assessments("Alice: Hello", [], {}))


class AuthenticationTests(unittest.IsolatedAsyncioTestCase):
    async def test_malformed_user_id_in_signed_token_returns_401(self):
        token = jwt.encode(
            {"sub": "not-an-objectid", "role": "user"},
            settings.JWT_SECRET,
            algorithm=settings.JWT_ALGORITHM,
        )

        with self.assertRaises(HTTPException) as context:
            await get_current_user(
                HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
            )

        self.assertEqual(context.exception.status_code, 401)
        self.assertEqual(context.exception.detail, "Invalid token payload")


if __name__ == "__main__":
    unittest.main()
