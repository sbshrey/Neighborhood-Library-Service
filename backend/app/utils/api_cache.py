from __future__ import annotations

import asyncio
import json
from time import monotonic
from typing import Any
from urllib.parse import urlencode

from fastapi import Request

from ..config import settings
from .request_context import get_actor_role, get_actor_user_id

try:
    import redis.asyncio as redis_async  # type: ignore[import-not-found]
except Exception:  # pragma: no cover - optional dependency
    redis_async = None


class InMemoryTTLCache:
    def __init__(self) -> None:
        self._store: dict[str, tuple[float, str]] = {}
        self._lock = asyncio.Lock()

    async def get_json(self, key: str) -> Any | None:
        now = monotonic()
        async with self._lock:
            entry = self._store.get(key)
            if not entry:
                return None
            expires_at, payload = entry
            if expires_at <= now:
                self._store.pop(key, None)
                return None
        return json.loads(payload)

    async def set_json(self, key: str, value: Any, ttl_seconds: int) -> None:
        payload = json.dumps(value, separators=(",", ":"), ensure_ascii=False, default=str)
        async with self._lock:
            self._store[key] = (monotonic() + max(ttl_seconds, 1), payload)

    async def clear_prefix(self, prefix: str) -> None:
        async with self._lock:
            keys = [key for key in self._store if key.startswith(prefix)]
            for key in keys:
                self._store.pop(key, None)


class OptionalRedisCache:
    def __init__(self, redis_url: str | None) -> None:
        self._redis_url = redis_url
        self._client = None
        self._enabled = bool(redis_url and redis_async)
        self._checked = False

    async def _client_or_none(self):
        if not self._enabled:
            return None
        if self._client is None:
            self._client = redis_async.from_url(self._redis_url, decode_responses=True)
        if not self._checked:
            try:
                await self._client.ping()
                self._checked = True
            except Exception:
                self._enabled = False
                return None
        return self._client

    async def get_json(self, key: str) -> Any | None:
        client = await self._client_or_none()
        if client is None:
            return None
        try:
            raw = await client.get(key)
        except Exception:
            return None
        if raw is None:
            return None
        return json.loads(raw)

    async def set_json(self, key: str, value: Any, ttl_seconds: int) -> None:
        client = await self._client_or_none()
        if client is None:
            return
        try:
            payload = json.dumps(value, separators=(",", ":"), ensure_ascii=False, default=str)
            await client.set(key, payload, ex=max(ttl_seconds, 1))
        except Exception:
            return

    async def clear_prefix(self, prefix: str) -> None:
        client = await self._client_or_none()
        if client is None:
            return
        try:
            async for key in client.scan_iter(match=f"{prefix}*"):
                await client.delete(key)
        except Exception:
            return


class APICache:
    def __init__(self) -> None:
        self._memory = InMemoryTTLCache()
        self._redis = OptionalRedisCache(settings.api_cache_redis_url)
        self._namespace = settings.api_cache_namespace
        self._ttl = settings.api_cache_ttl_seconds

    def _key(self, key: str) -> str:
        return f"{self._namespace}:{key}"

    async def get_json(self, key: str) -> Any | None:
        if not settings.api_cache_enabled:
            return None
        namespaced = self._key(key)
        cached = await self._redis.get_json(namespaced)
        if cached is not None:
            return cached
        return await self._memory.get_json(namespaced)

    async def set_json(self, key: str, value: Any, ttl_seconds: int | None = None) -> None:
        if not settings.api_cache_enabled:
            return
        namespaced = self._key(key)
        ttl = ttl_seconds if ttl_seconds is not None else self._ttl
        await self._memory.set_json(namespaced, value, ttl)
        await self._redis.set_json(namespaced, value, ttl)

    async def invalidate_all(self) -> None:
        prefix = f"{self._namespace}:"
        await self._memory.clear_prefix(prefix)
        await self._redis.clear_prefix(prefix)


def build_user_cache_key(request: Request, *, scope: str) -> str:
    user_id = get_actor_user_id()
    role = get_actor_role() or "anonymous"
    query_items = sorted(request.query_params.multi_items())
    query_string = urlencode(query_items, doseq=True)
    return f"{scope}|user:{user_id or 0}|role:{role}|path:{request.url.path}|query:{query_string}"


api_cache = APICache()
