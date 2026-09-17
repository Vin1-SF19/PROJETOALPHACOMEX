from __future__ import annotations

from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
import hashlib
import hmac
import os
import re
import shutil
import subprocess
from typing import Iterator

import smbclient

from .config import Settings
from .office import is_office_temporary_file
from .paths import BLOCKED_NAMES, TRASH_ROOT, child_relative_path, to_internal_unc, to_unc, validate_segment
from .secrets import NasCredential


@dataclass(frozen=True)
class SmbEntry:
    name: str
    relative_path: str
    is_directory: bool
    size: int | None
    modified_at: str | None


class PartialMoveError(RuntimeError):
    pass


class SmbValidationError(RuntimeError):
    code = "SMB_CONNECTION_FAILED"

    def __init__(self, message: str, diagnostic_code: str = "UNCLASSIFIED") -> None:
        super().__init__(message)
        self.diagnostic_code = diagnostic_code


class SmbAuthenticationFailed(SmbValidationError):
    code = "SMB_AUTHENTICATION_FAILED"


class SmbAccountLocked(SmbValidationError):
    code = "SMB_ACCOUNT_LOCKED"


class SmbPasswordExpired(SmbValidationError):
    code = "SMB_PASSWORD_EXPIRED"


class SmbNoAccessibleShares(SmbValidationError):
    code = "SMB_NO_ACCESSIBLE_SHARES"


class SmbSecurityIncompatible(SmbValidationError):
    code = "SMB_SECURITY_INCOMPATIBLE"


class SmbConnectionTimeout(SmbValidationError):
    code = "SMB_CONNECTION_TIMEOUT"


class SmbConnectionUnavailable(SmbValidationError):
    code = "SMB_CONNECTION_UNAVAILABLE"


RESERVED_SHARES = {"onyx", "ipc$", "admin$", "print$", "printers", "homes"}


class SmbClient:
    """Creates a private smbclient connection cache for every identity operation."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._shares = {share.casefold(): share for share in settings.smb_shares}

    def _share_is_permitted(self, share: str) -> bool:
        folded = share.casefold()
        if folded in RESERVED_SHARES or share.endswith("$"):
            return False
        return not self._shares or folded in self._shares

    def _unc_root(self, share: str) -> str:
        return rf"\\{self._settings.smb_server}\{share}"

    def _resolve_user_path(self, relative_path: str) -> tuple[str, str]:
        if not relative_path:
            raise PermissionError("SMB share root required")
        segments = relative_path.split("\\")
        requested_share = validate_segment(segments[0])
        share = self._shares.get(requested_share.casefold(), requested_share)
        if not self._share_is_permitted(share):
            raise PermissionError("SMB share denied")
        inner_path = "\\".join(validate_segment(segment) for segment in segments[1:])
        return self._unc_root(share), inner_path

    def _user_unc(self, relative_path: str) -> str:
        root, inner_path = self._resolve_user_path(relative_path)
        return to_unc(root, inner_path)

    def _internal_unc(self, internal_path: str) -> str:
        root, inner_path = self._resolve_user_path(internal_path)
        return to_internal_unc(root, inner_path)
    @contextmanager
    def _session(self, credential: NasCredential) -> Iterator[dict[str, object]]:
        connection_cache: dict[str, object] = {}
        try:
            smbclient.register_session(
                self._settings.smb_server,
                username=credential.principal,
                password=credential.password,
                port=self._settings.smb_port,
                encrypt=None,
                require_signing=True,
                connection_timeout=8,
                connection_cache=connection_cache,
            )
            yield connection_cache
        finally:
            smbclient.reset_connection_cache(fail_on_error=False, connection_cache=connection_cache)

    def validate(self, credential: NasCredential) -> None:
        try:
            with self._session(credential) as connection_cache:
                if not self._accessible_shares(credential, connection_cache):
                    raise SmbNoAccessibleShares("no allowed SMB shares")
        except SmbValidationError:
            raise
        except Exception as error:
            raise self._classify_connection_error(error) from None

    @staticmethod
    def _classify_connection_error(error: BaseException) -> SmbValidationError:
        diagnostic = f"{type(error).__name__} {error}".upper()
        status_match = re.search(r"(?:NT_)?STATUS_[A-Z0-9_]+", diagnostic)
        diagnostic_code = status_match.group(0) if status_match else type(error).__name__.upper()
        if any(marker in diagnostic for marker in ("ACCOUNT_LOCKED", "LOCKED_OUT")):
            return SmbAccountLocked("QNAP account locked", diagnostic_code)
        if any(marker in diagnostic for marker in ("PASSWORD_EXPIRED", "PASSWORD_MUST_CHANGE")):
            return SmbPasswordExpired("QNAP password expired", diagnostic_code)
        if any(marker in diagnostic for marker in (
            "LOGON_FAILURE", "WRONG_PASSWORD", "NO_SUCH_USER", "ACCESS_DENIED", "AUTHENTICATION",
            "ACCOUNT_DISABLED", "ACCOUNT_RESTRICTION", "LOGON_TYPE_NOT_GRANTED", "INVALID_LOGON_HOURS",
        )):
            return SmbAuthenticationFailed("QNAP authentication failed", diagnostic_code)
        if any(marker in diagnostic for marker in ("SIGNING", "ENCRYPTION", "NOT_SUPPORTED")):
            return SmbSecurityIncompatible("QNAP SMB security incompatible", diagnostic_code)
        if any(marker in diagnostic for marker in ("TIMEOUT", "TIMED OUT")):
            return SmbConnectionTimeout("QNAP SMB connection timeout", diagnostic_code)
        return SmbConnectionUnavailable("QNAP SMB connection unavailable", diagnostic_code)

    @staticmethod
    def _parse_share_catalog(output: str) -> list[str]:
        shares: list[str] = []
        for line in output.splitlines():
            kind, separator, remainder = line.partition("|")
            if separator != "|" or kind != "Disk":
                continue
            share, separator, _comment = remainder.partition("|")
            if separator != "|":
                continue
            try:
                normalized = validate_segment(share.strip())
            except ValueError:
                continue
            if normalized not in shares:
                shares.append(normalized)
        return shares

    def _enumerate_shares(self, credential: NasCredential) -> list[str]:
        if any(char in credential.principal or char in credential.password for char in "\r\n\x00"):
            raise PermissionError("invalid SMB credential")
        executable = shutil.which("smbclient")
        if executable is None or not hasattr(os, "memfd_create"):
            raise RuntimeError("SMB share discovery unavailable")
        descriptor = os.memfd_create("alpha-explorer-smb-auth", flags=0)
        try:
            authentication = f"username = {credential.principal}\npassword = {credential.password}\n".encode()
            os.write(descriptor, authentication)
            os.lseek(descriptor, 0, os.SEEK_SET)
            result = subprocess.run(
                [
                    executable,
                    "-L", f"//{self._settings.smb_server}",
                    "-A", f"/proc/self/fd/{descriptor}",
                    "-g", "-m", "SMB3",
                    "--client-protection=sign",
                    "--port", str(self._settings.smb_port),
                ],
                stdin=subprocess.DEVNULL,
                capture_output=True,
                text=True,
                timeout=10,
                check=False,
                pass_fds=(descriptor,),
                env={"PATH": "/usr/bin:/bin", "LANG": "C", "LC_ALL": "C"},
            )
            discovered_shares = self._parse_share_catalog(result.stdout)
            if discovered_shares:
                return discovered_shares
            if result.returncode != 0:
                diagnostic_output = "\n".join(
                    value.strip() for value in (result.stderr, result.stdout) if value.strip()
                )
                raise self._classify_connection_error(RuntimeError(diagnostic_output or "smbclient failed"))
            return []
        except subprocess.TimeoutExpired as error:
            raise SmbConnectionTimeout("SMB share discovery timeout") from error
        finally:
            os.close(descriptor)

    def _accessible_shares(
        self, credential: NasCredential, connection_cache: dict[str, object]
    ) -> list[str]:
        candidates = self._enumerate_shares(credential)
        accessible: list[str] = []
        for discovered_share in candidates:
            share = self._shares.get(discovered_share.casefold(), discovered_share)
            if not self._share_is_permitted(share):
                continue
            try:
                iterator = smbclient.scandir(self._unc_root(share), connection_cache=connection_cache)
                try:
                    next(iterator, None)
                finally:
                    iterator.close()
                accessible.append(share)
            except Exception:
                continue
        return accessible

    def list_directory(
        self, credential: NasCredential, relative_path: str, offset: int, limit: int
    ) -> tuple[list[SmbEntry], bool]:
        if not relative_path:
            with self._session(credential) as connection_cache:
                shares = self._accessible_shares(credential, connection_cache)
            page_names = shares[offset:offset + limit]
            return ([
                SmbEntry(name=share, relative_path=share, is_directory=True, size=None, modified_at=None)
                for share in page_names
            ], offset + len(page_names) < len(shares))
        unc = self._user_unc(relative_path)
        output: list[SmbEntry] = []
        visible_index = 0
        with self._session(credential) as connection_cache:
            self._assert_safe_user_path(relative_path, connection_cache)
            iterator = smbclient.scandir(unc, connection_cache=connection_cache)
            try:
                for entry in iterator:
                    try:
                        name = validate_segment(entry.name)
                    except ValueError:
                        continue
                    if (
                        name.casefold() in {blocked.casefold() for blocked in BLOCKED_NAMES}
                        or name.casefold().startswith(".alpha-explorer-upload-")
                        or is_office_temporary_file(name)
                    ):
                        continue
                    stat = entry.stat(follow_symlinks=False)
                    is_directory = entry.is_dir(follow_symlinks=False)
                    if entry.is_symlink():
                        continue
                    if self._is_reparse(stat):
                        continue
                    if visible_index < offset:
                        visible_index += 1
                        continue
                    if len(output) >= limit + 1:
                        break
                    output.append(SmbEntry(
                        name=name,
                        relative_path=child_relative_path(relative_path, name),
                        is_directory=is_directory,
                        size=None if is_directory else stat.st_size,
                        modified_at=datetime.fromtimestamp(stat.st_mtime, timezone.utc).isoformat().replace("+00:00", "Z"),
                    ))
                    visible_index += 1
            finally:
                iterator.close()
        page = output[:limit]
        return page, len(output) > limit

    def make_directory(self, credential: NasCredential, parent_path: str, name: str) -> None:
        target = self._user_unc(child_relative_path(parent_path, name))
        with self._session(credential) as cache:
            self._assert_safe_user_path(parent_path, cache)
            smbclient.mkdir(target, connection_cache=cache)

    def create_empty(self, credential: NasCredential, internal_path: str) -> None:
        target = self._internal_unc(internal_path)
        with self._session(credential) as cache:
            if TRASH_ROOT in internal_path.split("\\"):
                self._makedirs_internal(target.rsplit("\\", 1)[0], cache)
            with smbclient.open_file(target, mode="xb", connection_cache=cache):
                pass

    def append_chunk(self, credential: NasCredential, internal_path: str, offset: int, data: bytes) -> None:
        target = self._internal_unc(internal_path)
        with self._session(credential) as cache:
            with smbclient.open_file(target, mode="r+b", connection_cache=cache) as stream:
                stream.seek(offset)
                written = stream.write(data)
                if written != len(data):
                    raise OSError("short SMB write")
                stream.flush()

    def publish_upload(self, credential: NasCredential, internal_path: str, final_path: str, expected_size: int) -> None:
        source = self._internal_unc(internal_path)
        destination = self._user_unc(final_path)
        with self._session(credential) as cache:
            self._assert_safe_entry(source, cache)
            destination_parent = final_path.rsplit("\\", 1)[0] if "\\" in final_path else ""
            self._assert_safe_user_path(destination_parent, cache)
            if smbclient.stat(source, follow_symlinks=False, connection_cache=cache).st_size != expected_size:
                raise ValueError("upload size mismatch")
            self._assert_missing(destination, cache)
            smbclient.rename(source, destination, connection_cache=cache)

    def remove_internal(self, credential: NasCredential, internal_path: str) -> None:
        target = self._internal_unc(internal_path)
        with self._session(credential) as cache:
            try:
                smbclient.remove(target, connection_cache=cache)
            except FileNotFoundError:
                return

    def stat_internal(self, credential: NasCredential, internal_path: str) -> int:
        target = self._internal_unc(internal_path)
        with self._session(credential) as cache:
            return smbclient.stat(target, follow_symlinks=False, connection_cache=cache).st_size

    def stat_file(self, credential: NasCredential, relative_path: str) -> int:
        target = self._user_unc(relative_path)
        with self._session(credential) as cache:
            self._assert_safe_user_path(relative_path, cache)
            result = smbclient.stat(target, follow_symlinks=False, connection_cache=cache)
            if not smbclient.path.isfile(target, connection_cache=cache):
                raise FileNotFoundError
            return result.st_size

    def iter_file(self, credential: NasCredential, relative_path: str, start: int, length: int, block_size: int = 1024 * 1024):
        target = self._user_unc(relative_path)
        with self._session(credential) as cache:
            self._assert_safe_user_path(relative_path, cache)
            with smbclient.open_file(target, mode="rb", connection_cache=cache) as stream:
                stream.seek(start)
                remaining = length
                while remaining:
                    chunk = stream.read(min(block_size, remaining))
                    if not chunk:
                        raise OSError("unexpected SMB EOF")
                    remaining -= len(chunk)
                    yield chunk

    def copy_verify_delete(self, credential: NasCredential, source_path: str, destination_path: str) -> None:
        source = self._user_unc(source_path)
        destination = self._user_unc(destination_path)
        with self._session(credential) as cache:
            self._assert_safe_user_path(source_path, cache)
            destination_parent = destination_path.rsplit("\\", 1)[0] if "\\" in destination_path else ""
            self._assert_safe_user_path(destination_parent, cache)
            if not smbclient.path.isfile(source, connection_cache=cache):
                raise IsADirectoryError("recursive directory move is not supported")
            source_stat = smbclient.stat(source, follow_symlinks=False, connection_cache=cache)
            self._assert_missing(destination, cache)
            try:
                source_digest = hashlib.sha256()
                with smbclient.open_file(source, mode="rb", connection_cache=cache) as reader:
                    with smbclient.open_file(destination, mode="xb", connection_cache=cache) as writer:
                        while chunk := reader.read(1024 * 1024):
                            source_digest.update(chunk)
                            writer.write(chunk)
                        writer.flush()
                if smbclient.stat(destination, follow_symlinks=False, connection_cache=cache).st_size != source_stat.st_size:
                    raise OSError("copy verification failed")
                destination_digest = hashlib.sha256()
                with smbclient.open_file(destination, mode="rb", connection_cache=cache) as copied:
                    while chunk := copied.read(1024 * 1024):
                        destination_digest.update(chunk)
                if not hmac.compare_digest(source_digest.digest(), destination_digest.digest()):
                    raise OSError("copy checksum verification failed")
            except Exception:
                try:
                    smbclient.remove(destination, connection_cache=cache)
                except Exception:
                    pass
                raise
            try:
                smbclient.remove(source, connection_cache=cache)
            except Exception as error:
                raise PartialMoveError("copy verified but source delete failed") from error

    def rename_entry(self, credential: NasCredential, source_path: str, new_name: str) -> None:
        if "\\" not in source_path:
            raise PermissionError("SMB share rename denied")
        parent = source_path.rsplit("\\", 1)[0] if "\\" in source_path else ""
        destination_path = child_relative_path(parent, new_name)
        source = self._user_unc(source_path)
        destination = self._user_unc(destination_path)
        with self._session(credential) as cache:
            self._assert_safe_user_path(source_path, cache)
            self._assert_safe_user_path(parent, cache)
            self._assert_missing(destination, cache)
            smbclient.rename(source, destination, connection_cache=cache)

    def move_to_internal(self, credential: NasCredential, source_path: str, internal_path: str) -> None:
        source = self._user_unc(source_path)
        destination = self._internal_unc(internal_path)
        with self._session(credential) as cache:
            self._assert_safe_user_path(source_path, cache)
            self._makedirs_internal(destination.rsplit("\\", 1)[0], cache)
            self._assert_missing(destination, cache)
            smbclient.rename(source, destination, connection_cache=cache)

    def restore_from_internal(self, credential: NasCredential, internal_path: str, destination_path: str) -> None:
        source = self._internal_unc(internal_path)
        destination = self._user_unc(destination_path)
        with self._session(credential) as cache:
            destination_parent = destination_path.rsplit("\\", 1)[0] if "\\" in destination_path else ""
            self._assert_safe_user_path(destination_parent, cache)
            self._assert_safe_entry(source, cache)
            self._assert_missing(destination, cache)
            smbclient.rename(source, destination, connection_cache=cache)

    @staticmethod
    def _assert_missing(path: str, cache: dict[str, object]) -> None:
        try:
            smbclient.stat(path, follow_symlinks=False, connection_cache=cache)
        except FileNotFoundError:
            return
        raise FileExistsError(path)

    @staticmethod
    def _is_reparse(stat: object) -> bool:
        attributes = int(getattr(stat, "st_file_attributes", 0) or 0)
        reparse_tag = int(getattr(stat, "st_reparse_tag", 0) or 0)
        return bool(attributes & 0x400) or reparse_tag != 0

    @classmethod
    def _assert_safe_entry(cls, path: str, cache: dict[str, object]) -> None:
        stat = smbclient.stat(path, follow_symlinks=False, connection_cache=cache)
        if cls._is_reparse(stat) or smbclient.path.islink(path, connection_cache=cache):
            raise PermissionError("SMB reparse entry denied")

    def _assert_safe_user_path(self, relative_path: str, cache: dict[str, object]) -> None:
        current, inner_path = self._resolve_user_path(relative_path)
        self._assert_safe_entry(current, cache)
        if not inner_path:
            return
        for segment in inner_path.split("\\"):
            current = f"{current}\\{validate_segment(segment)}"
            self._assert_safe_entry(current, cache)

    @staticmethod
    def _makedirs_internal(parent: str, cache: dict[str, object]) -> None:
        smbclient.makedirs(parent, exist_ok=True, connection_cache=cache)
