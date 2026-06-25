"""ReadMaxxing worker configuration.

Centralized settings — all env vars go through here. Type-safe via Pydantic.
"""

from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- Runtime ---
    env: str = Field(default="development")
    log_level: str = Field(default="INFO")
    port: int = Field(default=8000)

    # --- Infra ---
    database_url: str = Field(default="")
    redis_url: str = Field(default="redis://localhost:6379/0")

    # --- LLM providers ---
    # Primary: OpenRouter (single key → any model). One API key gives us access
    # to OpenAI, Anthropic, Google, Meta, Mistral, etc. with automatic fallback.
    openrouter_api_key: str = Field(default="")
    # Optional direct-access overrides if you want to bypass OpenRouter.
    openai_api_key: str = Field(default="")
    anthropic_api_key: str = Field(default="")
    openrouter_default_model: str = Field(default="openai/gpt-4o-mini")
    openrouter_referer: str = Field(default="https://readmaxxing.app")
    openrouter_app_title: str = Field(default="ReadMaxxing")

    # --- Cloud TTS ---
    elevenlabs_api_key: str = Field(default="")

    # --- BFF handshake ---
    worker_api_token: str = Field(default="local-dev-token")

    # --- Local TTS (Phase 2) ---
    piper_model_path: str = Field(default="")
    sherpa_onnx_lib_path: str = Field(default="")
    xtts_model_dir: str = Field(default="")

    # --- Storage ---
    podcast_volume_path: str = Field(default="/data/podcasts")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Memoized settings accessor — read once per process."""
    return Settings()