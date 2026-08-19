"""
Briefr Whisper Transcription Service
-------------------------------------
A minimal Flask HTTP server that wraps faster-whisper for local audio transcription.
Accepts WAV/MP3 audio as multipart/form-data and returns transcribed text as JSON.

Endpoints:
  POST /transcribe   — transcribe an uploaded audio file
  GET  /health       — liveness check
"""

import os
import tempfile
import logging
from flask import Flask, request, jsonify
# pyrefly: ignore [missing-import]
from faster_whisper import WhisperModel

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

app = Flask(__name__)

# ── Model configuration ──────────────────────────────────────────────────────
MODEL_SIZE = os.environ.get("WHISPER_MODEL", "base")
DEVICE = os.environ.get("WHISPER_DEVICE", "cpu")
COMPUTE_TYPE = os.environ.get("WHISPER_COMPUTE_TYPE", "int8")

log.info(f"Loading faster-whisper model '{MODEL_SIZE}' on {DEVICE} ({COMPUTE_TYPE})...")
model = WhisperModel(MODEL_SIZE, device=DEVICE, compute_type=COMPUTE_TYPE)
log.info("Model loaded and ready.")


@app.get("/health")
def health():
    return jsonify({"status": "ok", "model": MODEL_SIZE})


@app.post("/transcribe")
def transcribe():
    """
    Accept an audio file upload and return the transcribed text.

    Request:  multipart/form-data with field 'file' containing audio data.
    Response: { "text": "full transcript...", "segments": [...], "language": "en" }
    Each segment has start/end/text and a nullable speaker. The speaker is
    deliberately nullable: Whisper transcribes speech but does not identify
    people.
    """
    if "file" not in request.files:
        return jsonify({"error": "No 'file' field in request"}), 400

    audio_file = request.files["file"]
    if not audio_file.filename:
        return jsonify({"error": "Empty filename"}), 400

    # Write audio to a temp file so faster-whisper can decode it via ffmpeg
    suffix = os.path.splitext(audio_file.filename)[1] or ".webm"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp_path = tmp.name
        audio_file.save(tmp_path)

    file_size = os.path.getsize(tmp_path)
    # Guard: a real audio chunk is at minimum a few KB.
    # Anything smaller is just a container header with no audio frames.
    if file_size < 2000:
        os.unlink(tmp_path)
        log.warning(f"Rejected tiny file: {file_size} bytes ({audio_file.filename}) — no real audio content.")
        return jsonify({
            "error": f"Audio file too small ({file_size} bytes). Minimum is 2000 bytes.",
            "text": "",
        }), 422

    try:
        log.info(f"Transcribing: {audio_file.filename} ({os.path.getsize(tmp_path)} bytes)")
        segments, info = model.transcribe(
            tmp_path,
            beam_size=5,
            language=None,  # auto-detect language
            vad_filter=True,  # skip silent sections for speed
            vad_parameters={"min_silence_duration_ms": 500},
        )

        # Materialise the generator — faster-whisper is lazy
        segment_list = []
        full_text_parts = []
        for seg in segments:
            segment_list.append({
                "start": round(seg.start, 2),
                "end": round(seg.end, 2),
                "text": seg.text.strip(),
                "speaker": None,
            })
            full_text_parts.append(seg.text.strip())

        full_text = " ".join(full_text_parts)
        log.info(f"Transcription complete: {len(segment_list)} segments, language={info.language}")

        return jsonify({
            "text": full_text,
            "segments": segment_list,
            "language": info.language,
            "language_probability": round(info.language_probability, 3),
        })

    except Exception as e:
        log.error(f"Transcription error: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500

    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 9000))
    log.info(f"Starting Whisper service on port {port}")
    app.run(host="0.0.0.0", port=port)
