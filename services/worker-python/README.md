# ReadMaxxing Python Worker

FastAPI + Celery + Redis worker service. Responsible for:

- **Document parsing** (PDF / DOCX / MD / EPUB / URL) → SegmentTree
- **OCR** (PaddleOCR / Tesseract) — for scanned PDFs and images
- **LLM orchestration via [OpenRouter](https://openrouter.ai/)** — summaries, quizzes, recaps, podcast scripts
- **Local TTS** (sherpa-onnx / Piper / Kokoro / XTTS) — for voice cloning + offline

## Endpoints

| Method | Path               | Purpose                                 | Phase |
| ------ | ------------------ | --------------------------------------- | ----- |
| GET    | `/health`          | Liveness check                          | 1     |
| GET    | `/ready`           | Readiness check (Redis + Celery ping)   | 1     |
| POST   | `/v1/parse`        | Sync document parsing                   | 2     |
| POST   | `/v1/ocr`          | OCR for scans                           | 5     |
| POST   | `/v1/ai/summary`   | Sync AI summary (uses OpenRouter)       | 3     |
| POST   | `/v1/tts/stream`   | Stream TTS synthesis                    | 2     |

## LLM provider (OpenRouter)

This worker calls **OpenRouter** for every LLM call — summaries, quizzes,
recaps, ask-the-doc, fillers, podcast scripts. OpenRouter gives us a single
API key (`OPENROUTER_API_KEY`) that routes to any model id we want:

- `openai/gpt-4o-mini`
- `anthropic/claude-3-5-sonnet`
- `google/gemini-2.5-pro`
- `meta-llama/llama-3.1-70b-instruct`
- `mistralai/mistral-large-latest`
- …and hundreds more

Override the per-task model via the `model` Celery argument, or set
`OPENROUTER_DEFAULT_MODEL` in `.env` to change the global default.

We deliberately do **not** install the `openai` or `anthropic` SDKs. If you
need direct access to a provider that OpenRouter doesn't carry, add the SDK
back to `pyproject.toml` and `requirements.txt` — but the default path
should stay on OpenRouter so cost + fallback work uniformly.

## Running locally

```bash
# Requires Python 3.12+ and a running Redis.
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"

# Run the FastAPI HTTP server.
uvicorn app.main:app --reload --port 8000

# Run the Celery worker in another terminal — it consumes the
# parse/ocr/ai/podcast/tts queues and persists results into Postgres
# (or returns them directly in Phase 1).
celery -A app.celery_app:celery_app worker \
  -Q parse,ocr,ai,podcast,tts --loglevel=INFO
```

Add to your `.env` (at the repo root):

```bash
OPENROUTER_API_KEY=sk-or-v1-...
REDIS_URL=redis://localhost:6379/0
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/readmaxxing
PODCAST_VOLUME_PATH=/tmp/podcasts   # local; on Railway this is a volume mount
```

## Task catalog

| Celery task                                   | Queue     | Phase |
| --------------------------------------------- | --------- | ----- |
| `app.tasks.parse.parse_document`              | `parse`   | 1     |
| `app.tasks.ocr.ocr_image`                     | `ocr`     | 1     |
| `app.tasks.ai.generate_summary`               | `ai`      | 1     |
| `app.tasks.ai.generate_quiz`                  | `ai`      | 1     |
| `app.tasks.ai.generate_recap`                 | `ai`      | 1     |
| `app.tasks.ai.ask_document`                   | `ai`      | 1     |
| `app.tasks.ai.detect_fillers`                 | `ai`      | 1     |
| `app.tasks.podcast.generate_podcast`          | `podcast` | 1     |
| `app.tasks.tts.synthesize`                    | `tts`     | 5 stub |

## Docker

```bash
docker build -t readmaxxing-worker .
docker run --rm -p 8000:8000 --env-file ../.env readmaxxing-worker
```

## Deploy to Railway

`railway.toml` at the repo root wires both services (web + worker). The
worker service uses this Dockerfile and adds a Celery worker process via
`startCommand` (see `.railway-worker.json` for the multi-process shape).
The persistent volume is mounted at `/data/podcasts` for podcast audio.

## Layout

```
services/worker-python/
├── app/
│   ├── __init__.py
│   ├── main.py                FastAPI HTTP server
│   ├── celery_app.py          Celery app (wires all task queues)
│   ├── config.py              Pydantic settings
│   └── tasks/
│       ├── __init__.py
│       ├── openrouter.py      Shared OpenRouter HTTP client + prompt helpers
│       ├── parse.py           Document → SegmentTree
│       ├── ocr.py             Image / PDF → text
│       ├── ai.py              Summary / quiz / recap / ask / fillers
│       ├── podcast.py         Multi-speaker podcast script → volume
│       └── tts.py             Local TTS (sherpa-onnx) stub
├── pyproject.toml
├── requirements.txt           (Nixpacks auto-detection)
├── Dockerfile
├── .dockerignore
└── railway.toml               (in-service Railway override)
```