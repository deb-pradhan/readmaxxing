# =============================================================================
# ReadMaxxing worker — Python 3.12 slim, CPU base.
#
# Per v1 plan: "GPU optional now, ready to flip on." This image targets CPU.
# When local-TTS models flip on and we need GPU, swap the base image to
# `nvidia/cuda:12.x-runtime-cudnn9-ubuntu22.04` and reinstall the heavy
# deps with GPU wheels.
# =============================================================================

FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONPATH=/app

# System deps:
# - libgomp                      → OpenMP runtime (numpy / onnx audio stack)
# - ffmpeg / libsndfile         → audio I/O
# - libxml / libxslt             → lxml, ebooklib
# - curl                         → healthcheck
# OCR uses a vision LLM via OpenRouter — no Tesseract/PaddleOCR system deps.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    ffmpeg \
    libsndfile1 \
    libxml2 \
    libxslt1.1 \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps first so we can cache the layer.
COPY pyproject.toml ./
RUN pip install --upgrade pip && pip install .

COPY app ./app

# A non-root user is friendlier to Railway's default runtime.
RUN useradd -m -u 1001 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD curl --fail --silent http://localhost:8000/health || exit 1

# Default command: uvicorn for the FastAPI HTTP server. The Celery worker
# runs as a separate process on Railway (defined in railway.toml).
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]