from __future__ import annotations

from dataclasses import dataclass
import sqlite3
import threading
import time
import uuid


@dataclass(frozen=True)
class UploadRecord:
    session_id: str
    binding_key: str
    parent_path: str
    temporary_path: str
    final_path: str
    expected_size: int
    received_size: int
    status: str


@dataclass(frozen=True)
class TrashRecord:
    trash_id: str
    binding_key: str
    original_path: str
    trash_path: str
    status: str


class OperationState:
    def __init__(self, database_path: str) -> None:
        self._lock = threading.Lock()
        self._db = sqlite3.connect(database_path, check_same_thread=False, isolation_level=None)
        self._db.execute("PRAGMA journal_mode=WAL")
        self._db.execute("""CREATE TABLE IF NOT EXISTS smb_upload (
            session_id TEXT PRIMARY KEY, binding_key TEXT NOT NULL, parent_path TEXT NOT NULL,
            temporary_path TEXT NOT NULL, final_path TEXT NOT NULL, expected_size INTEGER NOT NULL,
            received_size INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL, updated_at INTEGER NOT NULL
        )""")
        self._db.execute("""CREATE TABLE IF NOT EXISTS smb_trash (
            trash_id TEXT PRIMARY KEY, binding_key TEXT NOT NULL, original_path TEXT NOT NULL,
            trash_path TEXT NOT NULL, status TEXT NOT NULL, updated_at INTEGER NOT NULL
        )""")

    def create_upload(self, binding_key: str, parent_path: str, temporary_path: str, final_path: str, expected_size: int) -> UploadRecord:
        session_id = "h_" + uuid.uuid4().hex
        now = int(time.time())
        with self._lock:
            self._db.execute(
                "INSERT INTO smb_upload VALUES (?, ?, ?, ?, ?, ?, 0, 'OPEN', ?)",
                (session_id, binding_key, parent_path, temporary_path, final_path, expected_size, now),
            )
        return self.get_upload(binding_key, session_id)

    def get_upload(self, binding_key: str, session_id: str) -> UploadRecord:
        row = self._db.execute(
            "SELECT session_id,binding_key,parent_path,temporary_path,final_path,expected_size,received_size,status FROM smb_upload WHERE session_id=? AND binding_key=?",
            (session_id, binding_key),
        ).fetchone()
        if row is None:
            raise KeyError("upload not found")
        return UploadRecord(*row)

    def advance_upload(self, binding_key: str, session_id: str, expected_offset: int, chunk_size: int) -> UploadRecord:
        now = int(time.time())
        with self._lock:
            cursor = self._db.execute(
                "UPDATE smb_upload SET received_size=received_size+?,updated_at=? WHERE session_id=? AND binding_key=? AND status='OPEN' AND received_size=? AND received_size+?<=expected_size",
                (chunk_size, now, session_id, binding_key, expected_offset, chunk_size),
            )
            if cursor.rowcount != 1:
                raise ValueError("upload offset or state conflict")
        return self.get_upload(binding_key, session_id)

    def set_upload_status(self, binding_key: str, session_id: str, expected_status: str, status: str) -> UploadRecord:
        with self._lock:
            cursor = self._db.execute(
                "UPDATE smb_upload SET status=?,updated_at=? WHERE session_id=? AND binding_key=? AND status=?",
                (status, int(time.time()), session_id, binding_key, expected_status),
            )
            if cursor.rowcount != 1:
                raise ValueError("upload state conflict")
        return self.get_upload(binding_key, session_id)

    def reconcile_received(self, binding_key: str, session_id: str, actual_size: int) -> UploadRecord:
        with self._lock:
            cursor = self._db.execute(
                "UPDATE smb_upload SET received_size=?,updated_at=? WHERE session_id=? AND binding_key=? AND status='OPEN' AND received_size<=? AND expected_size>=?",
                (actual_size, int(time.time()), session_id, binding_key, actual_size, actual_size),
            )
            if cursor.rowcount != 1:
                raise ValueError("upload reconciliation conflict")
        return self.get_upload(binding_key, session_id)

    def stale_uploads(self, binding_key: str, older_than_seconds: int) -> list[UploadRecord]:
        threshold = int(time.time()) - older_than_seconds
        rows = self._db.execute(
            "SELECT session_id,binding_key,parent_path,temporary_path,final_path,expected_size,received_size,status FROM smb_upload WHERE binding_key=? AND status IN ('OPEN','COMMITTING') AND updated_at<? LIMIT 200",
            (binding_key, threshold),
        ).fetchall()
        return [UploadRecord(*row) for row in rows]

    def create_trash(self, binding_key: str, original_path: str, trash_path: str) -> TrashRecord:
        trash_id = "h_" + uuid.uuid4().hex
        with self._lock:
            self._db.execute("INSERT INTO smb_trash VALUES (?, ?, ?, ?, 'PENDING', ?)", (trash_id, binding_key, original_path, trash_path, int(time.time())))
        return self.get_trash(binding_key, trash_id)

    def set_trash_status(self, binding_key: str, trash_id: str, expected_status: str, status: str) -> TrashRecord:
        with self._lock:
            cursor = self._db.execute(
                "UPDATE smb_trash SET status=?,updated_at=? WHERE trash_id=? AND binding_key=? AND status=?",
                (status, int(time.time()), trash_id, binding_key, expected_status),
            )
            if cursor.rowcount != 1:
                raise ValueError("trash state conflict")
        return self.get_trash(binding_key, trash_id)

    def get_trash(self, binding_key: str, trash_id: str) -> TrashRecord:
        row = self._db.execute(
            "SELECT trash_id,binding_key,original_path,trash_path,status FROM smb_trash WHERE trash_id=? AND binding_key=?",
            (trash_id, binding_key),
        ).fetchone()
        if row is None:
            raise KeyError("trash record not found")
        return TrashRecord(*row)

    def list_trash(self, binding_key: str, offset: int, limit: int) -> tuple[list[TrashRecord], bool]:
        rows = self._db.execute(
            "SELECT trash_id,binding_key,original_path,trash_path,status FROM smb_trash WHERE binding_key=? AND status='TRASHED' ORDER BY updated_at DESC,trash_id LIMIT ? OFFSET ?",
            (binding_key, limit + 1, offset),
        ).fetchall()
        return ([TrashRecord(*row) for row in rows[:limit]], len(rows) > limit)

    def restore_trash(self, binding_key: str, trash_id: str) -> TrashRecord:
        with self._lock:
            cursor = self._db.execute(
                "UPDATE smb_trash SET status='RESTORED',updated_at=? WHERE trash_id=? AND binding_key=? AND status='TRASHED'",
                (int(time.time()), trash_id, binding_key),
            )
            if cursor.rowcount != 1:
                raise ValueError("trash state conflict")
        return self.get_trash(binding_key, trash_id)
