from __future__ import annotations

from dataclasses import dataclass
import base64
import hashlib
import hmac
import json
import re
import sqlite3
import threading
import time
from typing import Any
import uuid

from .config import Settings


class TicketError(RuntimeError):
    pass


@dataclass(frozen=True)
class TicketClaims:
    issuer: str
    audience: str
    subject: str
    actor_subject: str | None
    origin: str
    scope: str
    resource: str
    jti: str
    expires_at: int
    max_bytes: int | None
    offset: int | None
    destination: str | None
    target_name: str | None
    binding_nonce: str | None
    justification_hash: str | None

    @property
    def binding(self) -> tuple[str, str, str]:
        return (self.issuer, self.audience, self.subject)

def _decode(value: str) -> bytes:
    try:
        return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))
    except (ValueError, TypeError) as error:
        raise TicketError("ticket malformed") from error


class ReplayGuard:
    def __init__(self, database_path: str) -> None:
        self._lock = threading.Lock()
        self._connection = sqlite3.connect(database_path, check_same_thread=False, isolation_level=None)
        self._connection.execute("PRAGMA journal_mode=WAL")
        self._connection.execute("CREATE TABLE IF NOT EXISTS consumed_ticket (jti TEXT PRIMARY KEY, expires_at INTEGER NOT NULL)")
        self._connection.execute("""CREATE TABLE IF NOT EXISTS request_rate_limit (
            rate_key TEXT NOT NULL, window_start INTEGER NOT NULL, request_count INTEGER NOT NULL,
            PRIMARY KEY (rate_key, window_start)
        )""")

    def consume(self, jti: str, expires_at: int, now: int) -> None:
        with self._lock:
            try:
                self._connection.execute("BEGIN IMMEDIATE")
                self._connection.execute("DELETE FROM consumed_ticket WHERE expires_at <= ?", (now,))
                self._connection.execute("INSERT INTO consumed_ticket(jti, expires_at) VALUES (?, ?)", (jti, expires_at))
                self._connection.execute("COMMIT")
            except sqlite3.IntegrityError as error:
                self._connection.execute("ROLLBACK")
                raise TicketError("ticket replayed") from error
            except Exception:
                self._connection.execute("ROLLBACK")
                raise

    def consume_rate(self, rate_key: str, maximum: int, window_seconds: int, now: int) -> bool:
        window_start = now - (now % window_seconds)
        with self._lock:
            try:
                self._connection.execute("BEGIN IMMEDIATE")
                self._connection.execute(
                    "DELETE FROM request_rate_limit WHERE window_start < ?",
                    (window_start - (window_seconds * 2),),
                )
                self._connection.execute(
                    "INSERT INTO request_rate_limit(rate_key,window_start,request_count) VALUES (?, ?, 1) "
                    "ON CONFLICT(rate_key,window_start) DO UPDATE SET request_count=request_count+1",
                    (rate_key, window_start),
                )
                count = self._connection.execute(
                    "SELECT request_count FROM request_rate_limit WHERE rate_key=? AND window_start=?",
                    (rate_key, window_start),
                ).fetchone()[0]
                self._connection.execute("COMMIT")
                return count <= maximum
            except Exception:
                self._connection.execute("ROLLBACK")
                raise


def verify_ticket(token: str, origin: str, expected_scope: str, settings: Settings, replay: ReplayGuard, now: int | None = None) -> TicketClaims:
    parts = token.split(".")
    if len(parts) != 3:
        raise TicketError("ticket malformed")
    encoded_header, encoded_payload, received_signature = parts
    try:
        header: Any = json.loads(_decode(encoded_header))
        payload: Any = json.loads(_decode(encoded_payload))
    except (json.JSONDecodeError, UnicodeDecodeError) as error:
        raise TicketError("ticket malformed") from error
    if not isinstance(header, dict) or set(header) != {"alg", "typ", "kid"} or header.get("alg") != "HS256" or header.get("typ") != "JWT" or not isinstance(header.get("kid"), str) or not isinstance(payload, dict):
        raise TicketError("ticket malformed")
    required = {
        "iss", "aud", "sub", "actor_sub", "origin", "scope", "resource", "jti", "iat", "nbf", "exp",
        "auth_time", "max_bytes", "offset", "destination", "target_name", "binding_nonce", "justification_hash",
    }
    if set(payload) != required or not all(isinstance(payload[key], str) for key in {"iss", "aud", "sub", "origin", "scope", "resource", "jti"}):
        raise TicketError("ticket malformed")
    if not isinstance(payload["iat"], int) or not isinstance(payload["nbf"], int) or not isinstance(payload["exp"], int) or (payload["auth_time"] is not None and not isinstance(payload["auth_time"], int)):
        raise TicketError("ticket malformed")
    if (payload["max_bytes"] is not None and (not isinstance(payload["max_bytes"], int) or payload["max_bytes"] < 0 or payload["max_bytes"] > 2 * 1024 * 1024 * 1024)) or (payload["offset"] is not None and (not isinstance(payload["offset"], int) or payload["offset"] < 0)):
        raise TicketError("ticket constraints malformed")
    if payload["destination"] is not None and (not isinstance(payload["destination"], str) or (payload["destination"] != "root" and re.fullmatch(r"h_[A-Za-z0-9_-]{22,128}", payload["destination"]) is None)):
        raise TicketError("ticket destination malformed")
    if payload["target_name"] is not None and (not isinstance(payload["target_name"], str) or not 1 <= len(payload["target_name"]) <= 255):
        raise TicketError("ticket target malformed")
    credential_scope = payload["scope"].startswith("credential:")
    credential_mutation = credential_scope and payload["scope"] != "credential:status"
    if credential_scope:
        if not isinstance(payload["actor_sub"], str) or re.fullmatch(r"user:[1-9][0-9]*", payload["actor_sub"]) is None:
            raise TicketError("ticket actor denied")
    elif payload["actor_sub"] is not None:
        raise TicketError("ticket actor denied")
    if credential_mutation:
        try:
            uuid.UUID(payload["binding_nonce"])
        except (ValueError, TypeError) as error:
            raise TicketError("ticket binding nonce denied") from error
        if payload["justification_hash"] is not None and (
            not isinstance(payload["justification_hash"], str)
            or re.fullmatch(r"[a-f0-9]{64}", payload["justification_hash"]) is None
        ):
            raise TicketError("ticket justification denied")
    elif payload["binding_nonce"] is not None or payload["justification_hash"] is not None:
        raise TicketError("ticket administrative metadata denied")
    authority = settings.key_authorities.get(header["kid"])
    if authority is None or authority[0] != payload["iss"]:
        raise TicketError("ticket issuer denied")
    secret = authority[1]
    expected_signature = base64.urlsafe_b64encode(
        hmac.new(secret, f"{encoded_header}.{encoded_payload}".encode(), hashlib.sha256).digest()
    ).rstrip(b"=").decode()
    if not hmac.compare_digest(expected_signature, received_signature):
        raise TicketError("ticket signature denied")
    current = int(time.time()) if now is None else now
    if payload["aud"] != settings.audience or payload["origin"] != origin or settings.origin_issuers.get(origin) != payload["iss"]:
        raise TicketError("ticket audience denied")
    if payload["scope"] != expected_scope or re.fullmatch(r"user:[1-9][0-9]*", payload["sub"]) is None:
        raise TicketError("ticket scope denied")
    if payload["resource"] != "root" and re.fullmatch(r"h_[A-Za-z0-9_-]{22,128}", payload["resource"]) is None:
        raise TicketError("ticket resource denied")
    try:
        uuid.UUID(payload["jti"])
    except ValueError as error:
        raise TicketError("ticket identifier denied") from error
    if payload["iat"] > current + 5 or payload["nbf"] > current + 5 or payload["exp"] <= current or payload["exp"] - payload["iat"] > 60:
        raise TicketError("ticket expired")
    replay.consume("\x1f".join((payload["iss"], payload["aud"], payload["jti"])), payload["exp"], current)
    return TicketClaims(
        issuer=payload["iss"], audience=payload["aud"], subject=payload["sub"], actor_subject=payload["actor_sub"],
        origin=payload["origin"], scope=payload["scope"],
        resource=payload["resource"], jti=payload["jti"], expires_at=payload["exp"],
        max_bytes=payload["max_bytes"], offset=payload["offset"],
        destination=payload["destination"], target_name=payload["target_name"],
        binding_nonce=payload["binding_nonce"], justification_hash=payload["justification_hash"],
    )
