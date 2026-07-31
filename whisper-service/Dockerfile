FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for faster-whisper (needs ffmpeg for audio decoding)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir faster-whisper flask

COPY server.py .

# WHISPER_MODEL options: tiny (~75MB), base (~145MB), small (~465MB), medium (~1.5GB)
ENV WHISPER_MODEL=base
ENV WHISPER_DEVICE=cpu
ENV WHISPER_COMPUTE_TYPE=int8

EXPOSE 9000

CMD ["python", "server.py"]
