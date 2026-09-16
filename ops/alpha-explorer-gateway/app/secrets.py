from __future__ import annotations

from dataclasses import dataclass
import hashlib
import pathlib
import threading
from typing import Protocol

import hvac

from .config import Settings


@dataclass(frozen=True)
class NasCredential:
    principal: str
    password: str


@dataclass(frozen=True)
class BindingIdentity:
    issuer: str
    audience: str
    subject: str

    @property
    def key(self) -> str:
        material = "\x1f".join((self.issuer, self.audience, self.subject))
        return hashlib.sha256(material.encode()).hexdigest()


class PrincipalAlreadyLinked(RuntimeError):
    pass


class PrincipalChangeDenied(RuntimeError):
    pass


class BindingAlreadyExists(RuntimeError):
    pass


class BindingNotFound(RuntimeError):
    pass


@dataclass(frozen=True)
class BindingStatus:
    linked: bool
    principal: str | None
    principal_key: str | None
    secret_ref: str | None
    credential_version: int


class SecretStore(Protocol):
    def put(self, binding: BindingIdentity, credential: NasCredential) -> None: ...
    def create(self, binding: BindingIdentity, credential: NasCredential) -> None: ...
    def rotate(self, binding: BindingIdentity, credential: NasCredential) -> None: ...
    def get(self, binding: BindingIdentity) -> NasCredential | None: ...
    def describe(self, binding: BindingIdentity) -> BindingStatus: ...
    def delete(self, binding: BindingIdentity) -> None: ...


def _principal_key(principal: str) -> str:
    return hashlib.sha256(principal.casefold().encode()).hexdigest()


class VaultKv2SecretStore:
    def __init__(self, settings: Settings) -> None:
        if not settings.vault_url or not settings.vault_token_file:
            raise RuntimeError("vault configuration unavailable")
        token_path = pathlib.Path(settings.vault_token_file)
        token = token_path.read_text(encoding="utf-8").strip()
        if not token:
            raise RuntimeError("vault token unavailable")
        self._client = hvac.Client(url=settings.vault_url, token=token, verify=settings.vault_ca_cert or True)
        self._mount = settings.vault_mount
        self._prefix = settings.vault_prefix

    def _path(self, binding: BindingIdentity) -> str:
        return f"{self._prefix}/bindings/{binding.key}"

    def _principal_path(self, principal: str) -> str:
        return f"{self._prefix}/principal-index/{_principal_key(principal)}"

    def _binding_principal_path(self, binding: BindingIdentity) -> str:
        return f"{self._prefix}/binding-principal/{binding.key}"

    def put(self, binding: BindingIdentity, credential: NasCredential) -> None:
        existing = self.get(binding)
        if existing is None:
            self.create(binding, credential)
        else:
            self.rotate(binding, credential)

    def create(self, binding: BindingIdentity, credential: NasCredential) -> None:
        self._write(binding, credential, require_existing=False)

    def rotate(self, binding: BindingIdentity, credential: NasCredential) -> None:
        self._write(binding, credential, require_existing=True)

    def _write(self, binding: BindingIdentity, credential: NasCredential, require_existing: bool) -> None:
        index_path = self._principal_path(credential.principal)
        binding_principal_path = self._binding_principal_path(binding)
        created_index = False
        created_binding_principal = False
        current_version = 0
        try:
            existing_secret = self._client.secrets.kv.v2.read_secret_version(
                mount_point=self._mount, path=self._path(binding), raise_on_deleted_version=True
            )
            existing_data = existing_secret.get("data", {}).get("data", {})
            existing_principal = existing_data.get("principal")
            if not isinstance(existing_principal, str):
                raise RuntimeError("vault binding malformed")
            if existing_principal.casefold() != credential.principal.casefold():
                raise PrincipalChangeDenied("binding principal is immutable")
            if not require_existing:
                raise BindingAlreadyExists("binding already exists")
            current_version = existing_secret.get("data", {}).get("metadata", {}).get("version")
            if not isinstance(current_version, int) or current_version <= 0:
                raise RuntimeError("vault binding version unavailable")
        except hvac.exceptions.InvalidPath:
            if require_existing:
                raise BindingNotFound("binding not found") from None
        try:
            existing_binding = self._client.secrets.kv.v2.read_secret_version(
                mount_point=self._mount, path=binding_principal_path
            )
            principal_key = existing_binding.get("data", {}).get("data", {}).get("principal_key")
            if principal_key != _principal_key(credential.principal):
                raise PrincipalChangeDenied("binding principal is immutable")
        except hvac.exceptions.InvalidPath:
            try:
                self._client.secrets.kv.v2.create_or_update_secret(
                    mount_point=self._mount,
                    path=binding_principal_path,
                    secret={"principal_key": _principal_key(credential.principal)},
                    cas=0,
                )
                created_binding_principal = True
            except hvac.exceptions.InvalidRequest as error:
                raise PrincipalChangeDenied("binding principal is immutable") from error
        try:
            try:
                existing = self._client.secrets.kv.v2.read_secret_version(mount_point=self._mount, path=index_path)
                owner = existing.get("data", {}).get("data", {}).get("binding_key")
                if owner != binding.key:
                    raise PrincipalAlreadyLinked("principal already linked")
            except hvac.exceptions.InvalidPath:
                try:
                    self._client.secrets.kv.v2.create_or_update_secret(
                        mount_point=self._mount, path=index_path, secret={"binding_key": binding.key}, cas=0,
                    )
                    created_index = True
                except hvac.exceptions.InvalidRequest as error:
                    raise PrincipalAlreadyLinked("principal already linked") from error
            self._client.secrets.kv.v2.create_or_update_secret(
                mount_point=self._mount, path=self._path(binding),
                secret={"principal": credential.principal, "password": credential.password},
                cas=current_version,
            )
        except Exception:
            if created_index:
                self._client.secrets.kv.v2.delete_metadata_and_all_versions(mount_point=self._mount, path=index_path)
            if created_binding_principal:
                self._client.secrets.kv.v2.delete_metadata_and_all_versions(
                    mount_point=self._mount, path=binding_principal_path
                )
            raise

    def get(self, binding: BindingIdentity) -> NasCredential | None:
        try:
            response = self._client.secrets.kv.v2.read_secret_version(
                mount_point=self._mount, path=self._path(binding), raise_on_deleted_version=True
            )
        except hvac.exceptions.InvalidPath:
            return None
        data = response.get("data", {}).get("data", {})
        principal, password = data.get("principal"), data.get("password")
        if not isinstance(principal, str) or not isinstance(password, str):
            raise RuntimeError("vault binding malformed")
        return NasCredential(principal=principal, password=password)

    def describe(self, binding: BindingIdentity) -> BindingStatus:
        try:
            response = self._client.secrets.kv.v2.read_secret_version(
                mount_point=self._mount, path=self._path(binding), raise_on_deleted_version=True
            )
        except hvac.exceptions.InvalidPath:
            return BindingStatus(False, None, None, None, 0)
        data = response.get("data", {}).get("data", {})
        metadata = response.get("data", {}).get("metadata", {})
        principal = data.get("principal")
        version = metadata.get("version")
        if not isinstance(principal, str) or not isinstance(version, int) or version <= 0:
            raise RuntimeError("vault binding metadata malformed")
        return BindingStatus(True, principal, _principal_key(principal), binding.key, version)

    def delete(self, binding: BindingIdentity) -> None:
        credential = self.get(binding)
        self._client.secrets.kv.v2.delete_metadata_and_all_versions(mount_point=self._mount, path=self._path(binding))
        # Principal indexes and the immutable binding marker intentionally remain.
        # Releasing or transferring a QNAP principal is an explicit administrative operation.
        del credential


class MemorySecretStore:
    """Test double. Application startup refuses this store outside environment=test."""

    def __init__(self) -> None:
        self._values: dict[str, NasCredential] = {}
        self._versions: dict[str, int] = {}
        self._principal_by_binding: dict[str, str] = {}
        self._binding_by_principal: dict[str, str] = {}
        self._lock = threading.Lock()

    def put(self, binding: BindingIdentity, credential: NasCredential) -> None:
        with self._lock:
            exists = binding.key in self._values
        if exists:
            self.rotate(binding, credential)
        else:
            self.create(binding, credential)

    def create(self, binding: BindingIdentity, credential: NasCredential) -> None:
        with self._lock:
            if binding.key in self._values:
                raise BindingAlreadyExists("binding already exists")
            self._write_locked(binding, credential)

    def rotate(self, binding: BindingIdentity, credential: NasCredential) -> None:
        with self._lock:
            if binding.key not in self._values:
                raise BindingNotFound("binding not found")
            self._write_locked(binding, credential)

    def _write_locked(self, binding: BindingIdentity, credential: NasCredential) -> None:
        principal_key = credential.principal.casefold()
        linked_principal = self._principal_by_binding.get(binding.key)
        if linked_principal is not None and linked_principal != principal_key:
            raise PrincipalChangeDenied("binding principal is immutable")
        owner = self._binding_by_principal.get(principal_key)
        if owner is not None and owner != binding.key:
            raise PrincipalAlreadyLinked("principal already linked")
        self._principal_by_binding[binding.key] = principal_key
        self._binding_by_principal[principal_key] = binding.key
        self._values[binding.key] = credential
        self._versions[binding.key] = self._versions.get(binding.key, 0) + 1

    def get(self, binding: BindingIdentity) -> NasCredential | None:
        with self._lock:
            return self._values.get(binding.key)

    def describe(self, binding: BindingIdentity) -> BindingStatus:
        credential = self.get(binding)
        if credential is None:
            return BindingStatus(False, None, None, None, 0)
        return BindingStatus(
            True, credential.principal, _principal_key(credential.principal), binding.key,
            self._versions.get(binding.key, 1),
        )

    def delete(self, binding: BindingIdentity) -> None:
        with self._lock:
            self._values.pop(binding.key, None)
            self._versions.pop(binding.key, None)


def build_secret_store(settings: Settings) -> SecretStore:
    if settings.secret_store == "memory" and settings.environment == "test":
        return MemorySecretStore()
    return VaultKv2SecretStore(settings)
