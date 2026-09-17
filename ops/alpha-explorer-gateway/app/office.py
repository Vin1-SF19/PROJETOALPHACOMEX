from __future__ import annotations

from dataclasses import dataclass
import secrets
import threading
import time

from .secrets import BindingIdentity


OFFICE_FILE_TYPES: dict[str, tuple[str, str]] = {
    ".docx": ("word", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    ".xlsx": ("excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
}


def is_office_temporary_file(file_name: str) -> bool:
    return file_name.startswith("~$")


def office_file_type(file_name: str) -> tuple[str, str] | None:
    if is_office_temporary_file(file_name):
        return None
    separator = file_name.rfind(".")
    if separator <= 0:
        return None
    return OFFICE_FILE_TYPES.get(file_name[separator:].casefold())


@dataclass(frozen=True)
class OfficeSession:
    token: str
    binding: BindingIdentity
    relative_path: str
    file_name: str
    application: str
    content_type: str
    expected_size: int
    client_host: str
    expires_at_monotonic: float
    expires_at_epoch: int


class OfficeSessionRegistry:
    def __init__(self, ttl_seconds: int = 120, max_per_binding: int = 10) -> None:
        self._ttl_seconds = min(max(ttl_seconds, 30), 300)
        self._max_per_binding = min(max(max_per_binding, 1), 20)
        self._records: dict[str, OfficeSession] = {}
        self._lock = threading.Lock()

    def issue(
        self,
        binding: BindingIdentity,
        relative_path: str,
        file_name: str,
        expected_size: int,
        client_host: str,
    ) -> OfficeSession:
        file_type = office_file_type(file_name)
        if file_type is None:
            raise ValueError("unsupported Office file")
        application, content_type = file_type
        now_monotonic = time.monotonic()
        now_epoch = int(time.time())
        token = "o_" + secrets.token_urlsafe(32)
        record = OfficeSession(
            token=token,
            binding=binding,
            relative_path=relative_path,
            file_name=file_name,
            application=application,
            content_type=content_type,
            expected_size=expected_size,
            client_host=client_host,
            expires_at_monotonic=now_monotonic + self._ttl_seconds,
            expires_at_epoch=now_epoch + self._ttl_seconds,
        )
        with self._lock:
            self._purge(now_monotonic)
            binding_records = sorted(
                (item for item in self._records.values() if item.binding.key == binding.key),
                key=lambda item: item.expires_at_monotonic,
            )
            for stale in binding_records[:max(0, len(binding_records) - self._max_per_binding + 1)]:
                self._records.pop(stale.token, None)
            self._records[token] = record
        return record

    def resolve(self, token: str, file_name: str, client_host: str) -> OfficeSession:
        record = self.resolve_token(token, client_host)
        if not secrets.compare_digest(record.file_name, file_name):
            raise KeyError("Office session unavailable")
        return record

    def resolve_token(self, token: str, client_host: str) -> OfficeSession:
        with self._lock:
            now = time.monotonic()
            self._purge(now)
            record = self._records.get(token)
            if (
                record is None
                or record.expires_at_monotonic <= now
                or not secrets.compare_digest(record.client_host, client_host)
            ):
                raise KeyError("Office session unavailable")
            return record

    def revoke_binding(self, binding_key: str) -> None:
        with self._lock:
            self._records = {
                key: value for key, value in self._records.items() if value.binding.key != binding_key
            }

    def _purge(self, now: float) -> None:
        self._records = {
            key: value for key, value in self._records.items() if value.expires_at_monotonic > now
        }
