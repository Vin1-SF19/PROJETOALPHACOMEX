from __future__ import annotations

from dataclasses import dataclass
import secrets
import threading
import time


@dataclass(frozen=True)
class HandleRecord:
    binding_key: str
    relative_path: str
    expires_at: float


class HandleRegistry:
    def __init__(self, ttl_seconds: int) -> None:
        self._ttl = ttl_seconds
        self._records: dict[str, HandleRecord] = {}
        self._lock = threading.Lock()

    def issue(self, binding_key: str, relative_path: str) -> str:
        handle = "h_" + secrets.token_urlsafe(24)
        with self._lock:
            self._purge(time.monotonic())
            self._records[handle] = HandleRecord(binding_key, relative_path, time.monotonic() + self._ttl)
        return handle

    def resolve(self, binding_key: str, handle: str) -> str:
        if handle == "root":
            return ""
        with self._lock:
            now = time.monotonic()
            self._purge(now)
            record = self._records.get(handle)
            if record is None or record.binding_key != binding_key or record.expires_at <= now:
                raise KeyError("handle unavailable")
            return record.relative_path

    def revoke_binding(self, binding_key: str) -> None:
        with self._lock:
            self._records = {key: value for key, value in self._records.items() if value.binding_key != binding_key}

    def _purge(self, now: float) -> None:
        self._records = {key: value for key, value in self._records.items() if value.expires_at > now}
