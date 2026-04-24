"""LLM provider abstraction. Swap models by changing LLM_PROVIDER env var."""

from __future__ import annotations

import json
import logging
from abc import ABC, abstractmethod
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


class LLMProvider(ABC):
    """Base class for LLM providers. Subclass and implement generate_structured."""

    @abstractmethod
    def generate_structured(
        self,
        system_prompt: str,
        user_prompt: str,
        response_schema: Optional[Dict[str, Any]] = None,
    ) -> dict:
        """Send a prompt and return parsed JSON from the model."""
        ...


class GeminiProvider(LLMProvider):
    """Google Gemini via the google-genai SDK."""

    def __init__(self, api_key: str, model: str = "gemini-2.5-flash", timeout_s: int = 10):
        from google import genai

        self._client = genai.Client(api_key=api_key)
        self._model = model
        self._timeout_s = timeout_s
        logger.info("GeminiProvider initialised (model=%s, timeout=%ds)", model, timeout_s)

    # 1 retry → 2 attempts max → worst-case ~22s before engine fallback kicks in
    _MAX_RETRIES = 1
    _BACKOFF_BASE = 2.0  # seconds; single retry waits 2s

    def generate_structured(
        self,
        system_prompt: str,
        user_prompt: str,
        response_schema: Optional[Dict[str, Any]] = None,
    ) -> dict:
        import time
        import concurrent.futures
        from google.genai import types

        config = types.GenerateContentConfig(
            system_instruction=system_prompt,
            response_mime_type="application/json",
            temperature=0.2,
        )
        if response_schema:
            config.response_schema = response_schema

        def _call():
            return self._client.models.generate_content(
                model=self._model,
                contents=user_prompt,
                config=config,
            )

        last_exc: Exception | None = None
        for attempt in range(1 + self._MAX_RETRIES):
            try:
                with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                    future = pool.submit(_call)
                    try:
                        response = future.result(timeout=self._timeout_s)
                    except concurrent.futures.TimeoutError:
                        future.cancel()
                        raise TimeoutError(f"Gemini API did not respond within {self._timeout_s}s")

                text = response.text.strip()
                try:
                    return json.loads(text)
                except json.JSONDecodeError:
                    raise ValueError(f"LLM returned invalid JSON: {text[:200]}")

            except (TimeoutError, ConnectionError, OSError) as exc:
                last_exc = exc
                if attempt < self._MAX_RETRIES:
                    wait = self._BACKOFF_BASE * (2 ** attempt)
                    logger.warning(
                        "Gemini attempt %d/%d failed (%s); retrying in %.1fs",
                        attempt + 1, 1 + self._MAX_RETRIES, exc, wait,
                    )
                    time.sleep(wait)
                    continue
                break
            except Exception as exc:
                # Non-retryable (ValueError, auth error, etc.)
                raise

        raise last_exc  # type: ignore[misc]


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------

_PROVIDERS: Dict[str, type] = {
    "gemini": GeminiProvider,
}

_instance: Optional[LLMProvider] = None


def get_provider() -> LLMProvider:
    """Return the singleton LLM provider. Must call init_provider() first."""
    if _instance is None:
        raise RuntimeError("LLM provider not initialised — call init_provider() at startup")
    return _instance


# Deprecated or unavailable model IDs; map to current default
_DEPRECATED_GEMINI_MODELS = {"gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-flash"}


def init_provider(provider_name: str, api_key: str, model: Optional[str] = None) -> LLMProvider:
    """Instantiate and cache the LLM provider."""
    global _instance
    cls = _PROVIDERS.get(provider_name.lower())
    if cls is None:
        raise ValueError(f"Unknown LLM provider '{provider_name}'. Available: {list(_PROVIDERS)}")
    kwargs: Dict[str, Any] = {"api_key": api_key}
    if model and model.strip():
        # Use current flash model if env still has deprecated name
        kwargs["model"] = "gemini-2.5-flash" if model.strip() in _DEPRECATED_GEMINI_MODELS else model.strip()
    _instance = cls(**kwargs)
    return _instance
