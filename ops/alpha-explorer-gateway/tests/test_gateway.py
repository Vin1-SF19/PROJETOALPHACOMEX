from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import subprocess
import time
import tempfile
import uuid

from fastapi.testclient import TestClient
import hvac

from app.config import ConfigurationError, Settings, load_settings
from app.handles import HandleRegistry
from app.main import create_app
from app.paths import child_relative_path, to_unc, validate_segment
from app.secrets import (
    BindingIdentity, MemorySecretStore, NasCredential, PrincipalAlreadyLinked, PrincipalChangeDenied,
    VaultKv2SecretStore,
)
from app.security import ReplayGuard, TicketError, verify_ticket
from app.smb import SmbAuthenticationFailed, SmbClient, SmbEntry
from app.smb import PartialMoveError


ORIGIN = "https://stagealpha-sistema.alpak.ai"
ISSUER = "alpha-explorer-stage"
SECRET = b"stage-secret-with-more-than-thirty-two-bytes"


def settings() -> Settings:
    return Settings(
        audience="alpha-explorer-smb-gateway",
        origins=("https://painel.alpha-comex.com", ORIGIN),
        key_authorities={"prod-key-2026": ("alpha-explorer-production", b"production-secret-with-more-than-32-bytes"), "stage-key-2026": (ISSUER, SECRET)},
        origin_issuers={"https://painel.alpha-comex.com": "alpha-explorer-production", ORIGIN: ISSUER},
        smb_server="nas.invalid", smb_shares=("ALPHA_TEST", "FINANCEIRO_TEST"), smb_port=445,
        vault_url="", vault_token_file="", vault_ca_cert="", vault_mount="alpha-explorer", vault_prefix="smb-bindings",
        environment="test", secret_store="memory", replay_db_path=":memory:", state_db_path=":memory:", handle_ttl_seconds=300,
    )


def ticket(
    scope: str, subject: str = "user:42", resource: str = "root", jti: str | None = None,
    auth_time: int | None | object = ..., max_bytes: int | None = None, offset: int | None = None,
    destination: str | None = None, target_name: str | None = None, actor_subject: str | None = None,
    justification: str = "Acesso corporativo autorizado",
) -> str:
    now = int(time.time())
    credential_mutation = scope in {"credential:enroll", "credential:rotate", "credential:unlink"}
    effective_auth_time = now if credential_mutation else None
    if auth_time is not ...:
        effective_auth_time = auth_time
    effective_actor = actor_subject if actor_subject is not None else ("user:1" if scope.startswith("credential:") else None)
    header = _encode({"alg": "HS256", "typ": "JWT", "kid": "stage-key-2026"})
    payload = _encode({
        "iss": ISSUER, "aud": "alpha-explorer-smb-gateway", "sub": subject, "origin": ORIGIN,
        "actor_sub": effective_actor,
        "scope": scope, "resource": resource, "jti": jti or str(uuid.uuid4()), "iat": now, "nbf": now - 2,
        "exp": now + 45, "auth_time": effective_auth_time, "max_bytes": max_bytes, "offset": offset,
        "destination": destination, "target_name": target_name,
        "binding_nonce": str(uuid.uuid4()) if credential_mutation else None,
        "justification_hash": hashlib.sha256(justification.strip().encode()).hexdigest() if credential_mutation else None,
    })
    signature = base64.urlsafe_b64encode(hmac.new(SECRET, f"{header}.{payload}".encode(), hashlib.sha256).digest()).rstrip(b"=").decode()
    return f"{header}.{payload}.{signature}"


def _encode(value: object) -> str:
    return base64.urlsafe_b64encode(json.dumps(value, separators=(",", ":")).encode()).rstrip(b"=").decode()


class FakeSmb:
    def __init__(self) -> None:
        self.validated: list[str] = []
        self.file_size = 6

    def validate(self, credential: NasCredential) -> None:
        if credential.password != "valid-password":
            raise PermissionError
        self.validated.append(credential.principal)

    def list_directory(
        self, credential: NasCredential, relative_path: str, offset: int, limit: int
    ) -> tuple[list[SmbEntry], bool]:
        if relative_path:
            entries = [SmbEntry("Relatorio.docx", child_relative_path(relative_path, "Relatorio.docx"), False, self.file_size, None)]
        elif credential.principal == "maria":
            entries = [SmbEntry("Financeiro", child_relative_path(relative_path, "Financeiro"), True, None, None)]
        else:
            entries = [SmbEntry("Comercial", child_relative_path(relative_path, "Comercial"), True, None, None)]
        page = entries[offset:offset + limit]
        return page, offset + len(page) < len(entries)

    def make_directory(self, credential: NasCredential, parent_path: str, name: str) -> None:
        self.validated.append(f"mkdir:{parent_path}:{name}")

    def stat_file(self, credential: NasCredential, relative_path: str) -> int:
        return self.file_size

    def iter_file(self, credential: NasCredential, relative_path: str, start: int, length: int):
        yield b"abcdef"[start:start + length]

    def create_empty(self, credential: NasCredential, internal_path: str) -> None:
        self.upload = bytearray()

    def append_chunk(self, credential: NasCredential, internal_path: str, offset: int, data: bytes) -> None:
        if len(self.upload) != offset:
            raise ValueError
        self.upload.extend(data)

    def publish_upload(self, credential: NasCredential, internal_path: str, final_path: str, expected_size: int) -> None:
        if len(self.upload) != expected_size:
            raise ValueError
        self.published = final_path

    def remove_internal(self, credential: NasCredential, internal_path: str) -> None:
        self.upload = bytearray()

    def stat_internal(self, credential: NasCredential, internal_path: str) -> int:
        return len(self.upload)

    def copy_verify_delete(self, credential: NasCredential, source_path: str, destination_path: str) -> None:
        self.moved = (source_path, destination_path)

    def move_to_internal(self, credential: NasCredential, source_path: str, internal_path: str) -> None:
        self.trashed = (source_path, internal_path)

    def restore_from_internal(self, credential: NasCredential, internal_path: str, destination_path: str) -> None:
        self.restored = (internal_path, destination_path)

    def rename_entry(self, credential: NasCredential, source_path: str, new_name: str) -> None:
        self.renamed = (source_path, new_name)


def auth_headers(scope: str, **kwargs: str) -> dict[str, str]:
    return {"Origin": ORIGIN, "Authorization": f"Bearer {ticket(scope, **kwargs)}"}


def test_office_session_opens_docx_without_exposing_smb_path_or_credential() -> None:
    store, smb = MemorySecretStore(), FakeSmb()
    binding = BindingIdentity(ISSUER, "alpha-explorer-smb-gateway", "user:42")
    store.create(binding, NasCredential("maria", "valid-password"))
    client = TestClient(create_app(settings(), store, smb))

    root = client.get("/v1/items?handle=root", headers=auth_headers("list"))
    folder_handle = root.json()["entries"][0]["handle"]
    child = client.get(
        f"/v1/items?handle={folder_handle}",
        headers=auth_headers("list", resource=folder_handle),
    )
    file_handle = child.json()["entries"][0]["handle"]
    opened = client.post(
        "/v1/office/sessions",
        headers=auth_headers(
            "office_open", resource=file_handle, max_bytes=6, target_name="Relatorio.docx",
        ),
        json={"name": "Relatorio.docx"},
    )

    assert opened.status_code == 201
    payload = opened.json()
    assert payload["application"] == "word"
    assert payload["documentPath"].startswith("/v1/office/files/o_")
    assert "Financeiro" not in payload["documentPath"]
    assert "maria" not in payload["documentPath"]

    document = client.get(payload["documentPath"])
    assert document.status_code == 200
    assert document.content == b"abcdef"
    assert document.headers["content-type"].startswith(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
    assert document.headers["content-disposition"].startswith("inline;")
    assert document.headers["cache-control"] == "private, no-store"

    partial = client.get(payload["documentPath"], headers={"Range": "bytes=1-3"})
    assert partial.status_code == 206 and partial.content == b"bcd"
    assert partial.headers["content-range"] == "bytes 1-3/6"
    assert client.head(payload["documentPath"]).status_code == 200
    assert client.get(payload["documentPath"].replace("Relatorio.docx", "Outro.docx")).status_code == 404

    smb.file_size = 7
    assert client.get(payload["documentPath"]).status_code == 409


def test_office_session_denies_stale_size_and_unsupported_extension() -> None:
    store, smb = MemorySecretStore(), FakeSmb()
    binding = BindingIdentity(ISSUER, "alpha-explorer-smb-gateway", "user:42")
    store.create(binding, NasCredential("maria", "valid-password"))
    client = TestClient(create_app(settings(), store, smb))
    root = client.get("/v1/items?handle=root", headers=auth_headers("list"))
    folder_handle = root.json()["entries"][0]["handle"]
    child = client.get(f"/v1/items?handle={folder_handle}", headers=auth_headers("list", resource=folder_handle))
    file_handle = child.json()["entries"][0]["handle"]

    stale = client.post(
        "/v1/office/sessions",
        headers=auth_headers("office_open", resource=file_handle, max_bytes=5, target_name="Relatorio.docx"),
        json={"name": "Relatorio.docx"},
    )
    assert stale.status_code == 409
    wrong_name = client.post(
        "/v1/office/sessions",
        headers=auth_headers("office_open", resource=file_handle, max_bytes=6, target_name="Relatorio.html"),
        json={"name": "Relatorio.html"},
    )
    assert wrong_name.status_code == 403


def test_admin_enrollment_list_and_unlink_are_bound_to_target_subject() -> None:
    store, smb = MemorySecretStore(), FakeSmb()
    client = TestClient(create_app(settings(), store, smb))
    justification = "Acesso corporativo autorizado"
    enrolled = client.post(
        "/v1/admin/credentials/enroll",
        headers=auth_headers("credential:enroll", justification=justification),
        json={"principal": "maria", "password": "valid-password", "justification": justification},
    )
    assert enrolled.status_code == 201
    assert enrolled.json() == {"ok": True, "linked": True, "supportId": enrolled.json()["supportId"]}

    status = client.get(
        "/v1/admin/credentials/status",
        headers=auth_headers("credential:status"),
    )
    assert status.status_code == 200
    assert status.json()["principal"] == "maria"
    assert status.json()["principalKey"] == hashlib.sha256(b"maria").hexdigest()
    assert status.json()["secretRef"] == BindingIdentity(
        ISSUER, "alpha-explorer-smb-gateway", "user:42"
    ).key
    assert status.json()["credentialVersion"] == 1

    listing = client.get("/v1/items?handle=root", headers=auth_headers("list"))
    assert listing.status_code == 200
    assert [entry["name"] for entry in listing.json()["entries"]] == ["Financeiro"]
    child_handle = listing.json()["entries"][0]["handle"]

    other_subject = client.get(
        f"/v1/items?handle={child_handle}",
        headers=auth_headers("list", subject="user:99", resource=child_handle),
    )
    assert other_subject.status_code == 403

    unlinked = client.request(
        "DELETE", "/v1/admin/credentials",
        headers=auth_headers("credential:unlink", justification=justification),
        json={"confirm": True, "justification": justification},
    )
    assert unlinked.status_code == 200
    assert store.get(BindingIdentity(ISSUER, "alpha-explorer-smb-gateway", "user:42")) is None
    unlinked_status = client.get(
        "/v1/admin/credentials/status",
        headers=auth_headers("credential:status"),
    )
    assert unlinked_status.status_code == 200
    assert unlinked_status.json()["linked"] is False
    assert unlinked_status.json()["secretRef"] is None
    assert unlinked_status.json()["credentialVersion"] == 0


def test_ticket_is_single_use_and_origin_is_exact() -> None:
    client = TestClient(create_app(settings(), MemorySecretStore(), FakeSmb()))
    value = ticket("health")
    headers = {"Origin": ORIGIN, "Authorization": f"Bearer {value}"}
    assert client.get("/v1/health", headers=headers).status_code == 200
    assert client.get("/v1/health", headers=headers).status_code == 401
    evil = {"Origin": "https://evil.example", "Authorization": f"Bearer {ticket('health')}"}
    response = client.get("/v1/health", headers=evil)
    assert response.status_code == 401
    assert response.headers.get("access-control-allow-origin") is None


def test_invalid_credential_never_creates_binding() -> None:
    store = MemorySecretStore()
    client = TestClient(create_app(settings(), store, FakeSmb()))
    justification = "Acesso corporativo autorizado"
    response = client.post(
        "/v1/admin/credentials/enroll",
        headers=auth_headers("credential:enroll", justification=justification),
        json={"principal": "maria", "password": "wrong", "justification": justification},
    )
    assert response.status_code == 403
    assert response.json()["code"] == "SMB_CREDENTIAL_REJECTED"
    assert response.json()["supportId"] == response.headers["X-Support-Id"]
    assert store.get(BindingIdentity(ISSUER, "alpha-explorer-smb-gateway", "user:42")) is None
    assert "wrong" not in response.text


def test_enrollment_does_not_require_recent_authentication_or_justification() -> None:
    client = TestClient(create_app(settings(), MemorySecretStore(), FakeSmb()))
    headers = {"Origin": ORIGIN, "Authorization": f"Bearer {ticket('credential:enroll', auth_time=None)}"}
    response = client.post(
        "/v1/admin/credentials/enroll", headers=headers,
        json={"principal": "maria", "password": "valid-password"},
    )
    assert response.status_code == 201


def test_admin_credential_ticket_cannot_operate_files_and_body_needs_no_justification() -> None:
    store = MemorySecretStore()
    client = TestClient(create_app(settings(), store, FakeSmb()))
    admin_ticket = ticket("credential:status", subject="user:42", actor_subject="user:1")
    file_response = client.get(
        "/v1/items?handle=root",
        headers={"Origin": ORIGIN, "Authorization": f"Bearer {admin_ticket}"},
    )
    assert file_response.status_code == 401

    enrolled = client.post(
        "/v1/admin/credentials/enroll",
        headers=auth_headers("credential:enroll"),
        json={"principal": "maria", "password": "valid-password"},
    )
    assert enrolled.status_code == 201
    assert store.get(BindingIdentity(ISSUER, "alpha-explorer-smb-gateway", "user:42")) is not None


def test_failed_rotation_preserves_previous_vault_value_and_builtin_principals_are_denied() -> None:
    store = MemorySecretStore()
    binding = BindingIdentity(ISSUER, "alpha-explorer-smb-gateway", "user:42")
    store.create(binding, NasCredential("maria", "valid-password"))
    client = TestClient(create_app(settings(), store, FakeSmb()))
    justification = "Rotação corporativa autorizada"
    failed = client.post(
        "/v1/admin/credentials/rotate",
        headers=auth_headers("credential:rotate", justification=justification),
        json={"principal": "maria", "password": "wrong", "justification": justification},
    )
    assert failed.status_code == 403
    assert store.get(binding) == NasCredential("maria", "valid-password")

    denied = client.post(
        "/v1/admin/credentials/enroll",
        headers=auth_headers("credential:enroll", subject="user:99", justification=justification),
        json={"principal": "admin", "password": "valid-password", "justification": justification},
    )
    assert denied.status_code == 403


def test_principal_is_unique_across_full_binding_identity() -> None:
    store = MemorySecretStore()
    first = BindingIdentity(ISSUER, "alpha-explorer-smb-gateway", "user:42")
    second = BindingIdentity("alpha-explorer-production", "alpha-explorer-smb-gateway", "user:99")
    store.put(first, NasCredential("maria", "one"))
    try:
        store.put(second, NasCredential("MARIA", "two"))
    except PrincipalAlreadyLinked:
        pass
    else:
        raise AssertionError("same QNAP principal was linked to two bindings")
    assert first.key != second.key


def test_binding_principal_is_immutable_even_after_unlink() -> None:
    store = MemorySecretStore()
    binding = BindingIdentity(ISSUER, "alpha-explorer-smb-gateway", "user:42")
    store.put(binding, NasCredential("maria", "old-password"))
    store.put(binding, NasCredential("MARIA", "rotated-password"))
    store.delete(binding)
    try:
        store.put(binding, NasCredential("joao", "different-account"))
    except PrincipalChangeDenied:
        pass
    else:
        raise AssertionError("binding accepted a silent QNAP principal change")


def test_handles_are_isolated_by_full_binding_identity() -> None:
    handles = HandleRegistry(300)
    stage = BindingIdentity(ISSUER, "alpha-explorer-smb-gateway", "user:42")
    production = BindingIdentity("alpha-explorer-production", "alpha-explorer-smb-gateway", "user:42")
    handle = handles.issue(stage.key, "Financeiro")
    assert handles.resolve(stage.key, handle) == "Financeiro"
    try:
        handles.resolve(production.key, handle)
    except KeyError:
        pass
    else:
        raise AssertionError("stage handle was accepted by production binding")


def test_validation_errors_never_reflect_password() -> None:
    client = TestClient(create_app(settings(), MemorySecretStore(), FakeSmb()))
    password = "S" * 513
    response = client.post(
        "/v1/admin/credentials/enroll",
        headers=auth_headers("credential:enroll", justification="Acesso corporativo autorizado"),
        json={"principal": "maria", "password": password, "justification": "Acesso corporativo autorizado"},
    )
    assert response.status_code == 422
    assert response.json()["code"] == "VALIDATION_ERROR"
    assert password not in response.text


def test_rate_limit_is_persistent_for_the_guard_instance() -> None:
    with tempfile.NamedTemporaryFile(suffix=".sqlite3") as database:
        guard = ReplayGuard(database.name)
        assert guard.consume_rate("binding", 2, 60, 120) is True
        assert guard.consume_rate("binding", 2, 60, 121) is True
        assert guard.consume_rate("binding", 2, 60, 122) is False


def test_vault_requires_https_outside_loopback_tests() -> None:
    base = {
        "SMB_GATEWAY_PRODUCTION_ORIGIN": "https://painel.alpha-comex.com",
        "SMB_GATEWAY_STAGE_ORIGIN": ORIGIN,
        "SMB_GATEWAY_ISSUER_PRODUCTION": "alpha-explorer-production",
        "SMB_GATEWAY_ISSUER_STAGE": ISSUER,
        "SMB_GATEWAY_TICKET_KID_PRODUCTION": "prod-key-2026",
        "SMB_GATEWAY_TICKET_KID_STAGE": "stage-key-2026",
        "SMB_GATEWAY_TICKET_SECRET_PRODUCTION": "production-secret-with-more-than-32-bytes",
        "SMB_GATEWAY_TICKET_SECRET_STAGE": SECRET.decode(),
        "SMB_GATEWAY_SMB_SERVER": "nas.invalid",
        "SMB_GATEWAY_SMB_SHARES": "ALPHA_TEST,FINANCEIRO_TEST",
        "SMB_GATEWAY_SECRET_STORE": "vault",
        "SMB_GATEWAY_VAULT_URL": "http://vault.internal",
    }
    try:
        load_settings(base)
    except ConfigurationError:
        pass
    else:
        raise AssertionError("insecure Vault transport was accepted")
    duplicate_secret = dict(base)
    duplicate_secret["SMB_GATEWAY_VAULT_URL"] = "https://vault.internal"
    duplicate_secret["SMB_GATEWAY_TICKET_SECRET_STAGE"] = duplicate_secret["SMB_GATEWAY_TICKET_SECRET_PRODUCTION"]
    try:
        load_settings(duplicate_secret)
    except ConfigurationError:
        pass
    else:
        raise AssertionError("identical production and stage ticket secrets were accepted")


def test_gateway_accepts_only_explicit_runtime_origin_aliases() -> None:
    configured = load_settings({
        "SMB_GATEWAY_ENVIRONMENT": "test",
        "SMB_GATEWAY_AUDIENCE": "alpha-explorer-smb-gateway",
        "SMB_GATEWAY_PRODUCTION_ORIGIN": "https://painel.alpha-comex.com",
        "SMB_GATEWAY_STAGE_ORIGIN": ORIGIN,
        "SMB_GATEWAY_ADDITIONAL_STAGE_ORIGINS": "https://painel-alpha.alpak.ai",
        "SMB_GATEWAY_ISSUER_PRODUCTION": "alpha-explorer-production",
        "SMB_GATEWAY_ISSUER_STAGE": ISSUER,
        "SMB_GATEWAY_TICKET_KID_PRODUCTION": "prod-key-2026",
        "SMB_GATEWAY_TICKET_KID_STAGE": "stage-key-2026",
        "SMB_GATEWAY_TICKET_SECRET_PRODUCTION": "production-secret-with-more-than-32-bytes",
        "SMB_GATEWAY_TICKET_SECRET_STAGE": SECRET.decode(),
        "SMB_GATEWAY_SMB_SERVER": "nas.invalid",
        "SMB_GATEWAY_SECRET_STORE": "memory",
    })
    assert configured.origins == (
        "https://painel.alpha-comex.com", ORIGIN, "https://painel-alpha.alpak.ai",
    )
    assert configured.origin_issuers["https://painel-alpha.alpak.ai"] == ISSUER


def test_root_discovers_shares_and_lists_only_those_accessible_to_bound_identity(monkeypatch) -> None:
    class EmptyDirectory:
        def __iter__(self):
            return self

        def __next__(self):
            raise StopIteration

        def close(self) -> None:
            return None

    monkeypatch.setattr("app.smb.smbclient.register_session", lambda *_args, **_kwargs: None)
    monkeypatch.setattr("app.smb.smbclient.reset_connection_cache", lambda **_kwargs: None)
    monkeypatch.setattr(
        SmbClient,
        "_enumerate_shares",
        lambda _self, _credential: ["ALPHA_TEST", "FINANCEIRO_TEST", "ONYX", "ADMIN$"],
    )

    def fake_scandir(path: str, **_kwargs):
        if path.endswith("FINANCEIRO_TEST"):
            raise PermissionError
        return EmptyDirectory()

    monkeypatch.setattr("app.smb.smbclient.scandir", fake_scandir)
    client = SmbClient(settings())
    entries, has_more = client.list_directory(NasCredential("maria", "valid-password"), "", 0, 100)
    assert [entry.name for entry in entries] == ["ALPHA_TEST"]
    assert has_more is False
    client.validate(NasCredential("maria", "valid-password"))

    unsafe = dict(os.environ)
    unsafe["SMB_GATEWAY_SMB_SHARES"] = "ALPHA_TEST,ONYX"
    try:
        load_settings(unsafe)
    except ConfigurationError:
        pass
    else:
        raise AssertionError("ONYX was accepted in the Alpha Explorer allowlist")


def test_root_can_discover_all_accessible_non_reserved_shares_without_allowlist(monkeypatch) -> None:
    current = settings()
    discovery_settings = Settings(**{
        **current.__dict__,
        "smb_shares": (),
    })

    class EmptyDirectory:
        def __iter__(self):
            return self

        def __next__(self):
            raise StopIteration

        def close(self) -> None:
            return None

    monkeypatch.setattr("app.smb.smbclient.register_session", lambda *_args, **_kwargs: None)
    monkeypatch.setattr("app.smb.smbclient.reset_connection_cache", lambda **_kwargs: None)
    monkeypatch.setattr("app.smb.smbclient.scandir", lambda *_args, **_kwargs: EmptyDirectory())
    monkeypatch.setattr(
        SmbClient,
        "_enumerate_shares",
        lambda _self, _credential: ["Comercial", "Financeiro", "ONYX", "IPC$", "print$"],
    )

    client = SmbClient(discovery_settings)
    entries, has_more = client.list_directory(NasCredential("maria", "valid-password"), "", 0, 100)
    assert [entry.name for entry in entries] == ["Comercial", "Financeiro"]
    assert has_more is False


def test_directory_listing_hides_microsoft_office_lock_files(monkeypatch) -> None:
    class Stat:
        st_size = 12
        st_mtime = 0
        st_file_attributes = 0
        st_reparse_tag = 0

    class Entry:
        def __init__(self, name: str) -> None:
            self.name = name

        def stat(self, follow_symlinks: bool = False):
            return Stat()

        def is_dir(self, follow_symlinks: bool = False) -> bool:
            return False

        def is_symlink(self) -> bool:
            return False

    class DirectoryIterator:
        def __init__(self) -> None:
            self._entries = iter([Entry("~$CLIENTES RADAR -.xlsx"), Entry("CLIENTES RADAR -.xlsx")])

        def __iter__(self):
            return self

        def __next__(self):
            return next(self._entries)

        def close(self) -> None:
            return None

    monkeypatch.setattr("app.smb.smbclient.register_session", lambda *_args, **_kwargs: None)
    monkeypatch.setattr("app.smb.smbclient.reset_connection_cache", lambda **_kwargs: None)
    monkeypatch.setattr("app.smb.smbclient.stat", lambda *_args, **_kwargs: Stat())
    monkeypatch.setattr("app.smb.smbclient.path.islink", lambda *_args, **_kwargs: False)
    monkeypatch.setattr("app.smb.smbclient.scandir", lambda *_args, **_kwargs: DirectoryIterator())

    client = SmbClient(settings())
    entries, has_more = client.list_directory(
        NasCredential("maria", "valid-password"), "ALPHA_TEST", 0, 100,
    )
    assert [entry.name for entry in entries] == ["CLIENTES RADAR -.xlsx"]
    assert has_more is False


def test_share_catalog_parser_accepts_only_disk_shares_and_removes_duplicates() -> None:
    output = "\n".join([
        "Disk|Comercial|Equipe comercial",
        "Disk|Financeiro|",
        "IPC|IPC$|IPC Service",
        "Disk|Comercial|Duplicada",
        "Disk|../escape|Inválida",
    ])
    assert SmbClient._parse_share_catalog(output) == ["Comercial", "Financeiro"]


def test_share_discovery_keeps_credentials_out_of_process_arguments(monkeypatch) -> None:
    observed_arguments: list[str] = []

    def fake_run(arguments, **options):
        observed_arguments.extend(arguments)
        descriptor = options["pass_fds"][0]
        authentication = os.pread(descriptor, 4096, 0).decode()
        assert "username = maria" in authentication
        assert "password = very-secret-password" in authentication
        return subprocess.CompletedProcess(arguments, 0, "Disk|Comercial|\n", "")

    monkeypatch.setattr("app.smb.shutil.which", lambda _name: "/usr/bin/smbclient")
    monkeypatch.setattr("app.smb.subprocess.run", fake_run)
    client = SmbClient(Settings(**{**settings().__dict__, "smb_shares": ()}))
    assert client._enumerate_shares(NasCredential("maria", "very-secret-password")) == ["Comercial"]
    rendered_arguments = " ".join(observed_arguments)
    assert "maria" not in rendered_arguments
    assert "very-secret-password" not in rendered_arguments
    assert "--client-protection=sign" in observed_arguments
    assert "--client-protection=encrypt" not in observed_arguments


def test_share_discovery_classifies_qnap_authentication_failure(monkeypatch) -> None:
    def fake_run(arguments, **_options):
        return subprocess.CompletedProcess(
            arguments,
            1,
            "session setup failed: NT_STATUS_LOGON_FAILURE",
            "WARNING: harmless smbclient diagnostic",
        )

    monkeypatch.setattr("app.smb.shutil.which", lambda _name: "/usr/bin/smbclient")
    monkeypatch.setattr("app.smb.subprocess.run", fake_run)
    client = SmbClient(Settings(**{**settings().__dict__, "smb_shares": ()}))
    try:
        client._enumerate_shares(NasCredential("maria", "wrong-password"))
    except SmbAuthenticationFailed as error:
        assert error.diagnostic_code == "NT_STATUS_LOGON_FAILURE"
    else:
        raise AssertionError("QNAP authentication failure was not classified")


def test_share_discovery_accepts_valid_catalog_before_legacy_workgroup_warning(monkeypatch) -> None:
    def fake_run(arguments, **_options):
        return subprocess.CompletedProcess(
            arguments,
            1,
            "Disk|Comercial|\nDisk|Financeiro|\n",
            "SMB1 disabled -- no workgroup available",
        )

    monkeypatch.setattr("app.smb.shutil.which", lambda _name: "/usr/bin/smbclient")
    monkeypatch.setattr("app.smb.subprocess.run", fake_run)
    client = SmbClient(Settings(**{**settings().__dict__, "smb_shares": ()}))
    assert client._enumerate_shares(NasCredential("maria", "valid-password")) == ["Comercial", "Financeiro"]


def test_share_allowlist_is_optional_for_automatic_discovery() -> None:
    automatic = dict(os.environ)
    automatic.pop("SMB_GATEWAY_SMB_SHARES", None)
    assert load_settings(automatic).smb_shares == ()


def test_list_rejects_expensive_offsets_before_touching_smb() -> None:
    store = MemorySecretStore()
    store.put(BindingIdentity(ISSUER, "alpha-explorer-smb-gateway", "user:42"), NasCredential("maria", "valid-password"))
    client = TestClient(create_app(settings(), store, FakeSmb()))
    response = client.get("/v1/items?handle=root&offset=2001", headers=auth_headers("list"))
    assert response.status_code == 422
    assert response.json()["code"] == "VALIDATION_ERROR"


def test_vault_store_uses_cas_preserves_tombstones_and_rolls_back(monkeypatch, tmp_path) -> None:
    class FakeKvV2:
        def __init__(self) -> None:
            self.values: dict[str, dict[str, str]] = {}
            self.versions: dict[str, int] = {}
            self.fail_path: str | None = None

        def read_secret_version(self, *, path: str, **_kwargs):
            if path not in self.values:
                raise hvac.exceptions.InvalidPath
            return {"data": {"data": self.values[path], "metadata": {"version": self.versions[path]}}}

        def create_or_update_secret(self, *, path: str, secret: dict[str, str], cas: int | None = None, **_kwargs):
            if path == self.fail_path:
                raise RuntimeError("synthetic Vault failure")
            if cas == 0 and path in self.values:
                raise hvac.exceptions.InvalidRequest
            if cas not in {None, 0} and self.versions.get(path) != cas:
                raise hvac.exceptions.InvalidRequest
            self.values[path] = dict(secret)
            self.versions[path] = self.versions.get(path, 0) + 1

        def delete_metadata_and_all_versions(self, *, path: str, **_kwargs):
            self.values.pop(path, None)
            self.versions.pop(path, None)

    fake_v2 = FakeKvV2()

    class FakeClient:
        def __init__(self, **kwargs) -> None:
            assert kwargs["verify"] is True
            self.secrets = type("Secrets", (), {
                "kv": type("Kv", (), {"v2": fake_v2})(),
            })()

    monkeypatch.setattr("app.secrets.hvac.Client", FakeClient)
    token_file = tmp_path / "vault-token"
    token_file.write_text("test-token", encoding="utf-8")
    configured = settings()
    configured = Settings(**{
        **configured.__dict__, "secret_store": "vault", "vault_url": "https://vault.internal",
        "vault_token_file": str(token_file),
    })
    store = VaultKv2SecretStore(configured)
    binding = BindingIdentity(ISSUER, configured.audience, "user:42")
    store.put(binding, NasCredential("maria", "first"))
    store.put(binding, NasCredential("MARIA", "rotated"))
    assert store.get(binding) == NasCredential("MARIA", "rotated")
    store.delete(binding)
    assert store.get(binding) is None
    assert any("binding-principal" in path for path in fake_v2.values)
    assert any("principal-index" in path for path in fake_v2.values)
    try:
        store.put(binding, NasCredential("joao", "different"))
    except PrincipalChangeDenied:
        pass
    else:
        raise AssertionError("Vault binding accepted a different QNAP principal")

    second = BindingIdentity(ISSUER, configured.audience, "user:99")
    binding_path = store._path(second)
    fake_v2.fail_path = binding_path
    try:
        store.put(second, NasCredential("ana", "password"))
    except RuntimeError:
        pass
    else:
        raise AssertionError("synthetic Vault failure was not propagated")
    assert store._binding_principal_path(second) not in fake_v2.values
    assert store._principal_path("ana") not in fake_v2.values


def test_replay_guard_is_durable_across_instances() -> None:
    with tempfile.NamedTemporaryFile(suffix=".sqlite3") as database:
        value = ticket("health")
        verify_ticket(value, ORIGIN, "health", settings(), ReplayGuard(database.name))
        try:
            verify_ticket(value, ORIGIN, "health", settings(), ReplayGuard(database.name))
        except TicketError:
            pass
        else:
            raise AssertionError("durable replay guard accepted consumed ticket")


def test_path_hardening_rejects_escape_unc_controls_and_windows_ambiguity() -> None:
    for value in ("..", "../x", "..\\x", "\\server", "C:", "bad\x00name", "trailing.", "trailing ", "@Recycle"):
        try:
            validate_segment(value)
        except ValueError:
            pass
        else:
            raise AssertionError(f"accepted unsafe segment: {value!r}")
    assert validate_segment("Relatórios") == "Relatórios"
    assert to_unc(r"\\nas\ONYX", "Financeiro\\2026") == r"\\nas\ONYX\Financeiro\2026"


def test_link_status_mkdir_and_range_download() -> None:
    store, smb = MemorySecretStore(), FakeSmb()
    store.put(BindingIdentity(ISSUER, "alpha-explorer-smb-gateway", "user:42"), NasCredential("maria", "valid-password"))
    client = TestClient(create_app(settings(), store, smb))
    status = client.get("/v1/link", headers=auth_headers("link_status"))
    assert status.status_code == 200 and status.json()["linked"] is True
    mkdir = client.post("/v1/directories", headers=auth_headers("mkdir", target_name="2026"), json={"name": "2026"})
    assert mkdir.status_code == 201
    assert "mkdir::2026" in smb.validated
    listing = client.get("/v1/items?handle=root", headers=auth_headers("list"))
    handle = listing.json()["entries"][0]["handle"]
    download = client.get("/v1/files/download", headers={**auth_headers("download", resource=handle, max_bytes=3), "Range": "bytes=1-3"})
    assert download.status_code == 206
    assert download.content == b"bcd"
    assert download.headers["content-range"] == "bytes 1-3/6"
    traversal = client.post("/v1/directories", headers=auth_headers("mkdir", target_name="../escape"), json={"name": "../escape"})
    assert traversal.status_code == 400


def test_chunked_upload_commit_and_cancel() -> None:
    store, smb = MemorySecretStore(), FakeSmb()
    store.put(BindingIdentity(ISSUER, "alpha-explorer-smb-gateway", "user:42"), NasCredential("maria", "valid-password"))
    client = TestClient(create_app(settings(), store, smb))
    started = client.post("/v1/uploads", headers=auth_headers("upload_start", max_bytes=6, target_name="arquivo.txt"), json={"name": "arquivo.txt", "expectedSize": 6})
    assert started.status_code == 201
    session = started.json()["sessionHandle"]
    chunk = client.post(f"/v1/uploads/{session}/chunks", headers=auth_headers("upload_chunk", resource=session, max_bytes=6, offset=0), content=b"abcdef")
    assert chunk.status_code == 200 and chunk.json()["receivedSize"] == 6
    wrong_offset = client.post(f"/v1/uploads/{session}/chunks", headers=auth_headers("upload_chunk", resource=session, max_bytes=1, offset=0), content=b"x")
    assert wrong_offset.status_code == 409
    committed = client.post(f"/v1/uploads/{session}/commit", headers=auth_headers("upload_commit", resource=session))
    assert committed.status_code == 200
    assert smb.published == "arquivo.txt"

    another = client.post("/v1/uploads", headers=auth_headers("upload_start", max_bytes=4, target_name="cancel.txt"), json={"name": "cancel.txt", "expectedSize": 4})
    cancel_session = another.json()["sessionHandle"]
    canceled = client.delete(f"/v1/uploads/{cancel_session}", headers=auth_headers("upload_cancel", resource=cancel_session))
    assert canceled.status_code == 200

    tampered_name = client.post("/v1/uploads", headers=auth_headers("upload_start", max_bytes=1, target_name="permitido.txt"), json={"name": "trocado.txt", "expectedSize": 1})
    assert tampered_name.status_code == 403


def test_rename_move_trash_restore_and_partial_move() -> None:
    store, smb = MemorySecretStore(), FakeSmb()
    store.put(BindingIdentity(ISSUER, "alpha-explorer-smb-gateway", "user:42"), NasCredential("maria", "valid-password"))
    client = TestClient(create_app(settings(), store, smb))
    handle = client.get("/v1/items?handle=root", headers=auth_headers("list")).json()["entries"][0]["handle"]
    renamed = client.post("/v1/items/rename", headers=auth_headers("rename", resource=handle, target_name="Novo"), json={"name": "Novo"})
    assert renamed.status_code == 200 and smb.renamed == ("Financeiro", "Novo")
    moved = client.post("/v1/items/move", headers=auth_headers("move", resource=handle, destination="root", target_name="Movido"), json={"name": "Movido", "destinationHandle": "root"})
    assert moved.status_code == 200 and smb.moved == ("Financeiro", "Movido")
    trashed = client.request("DELETE", "/v1/items/trash", headers=auth_headers("trash", resource=handle))
    assert trashed.status_code == 200
    trash_handle = trashed.json()["trashHandle"]
    persisted = client.get("/v1/trash", headers=auth_headers("trash_list"))
    assert persisted.status_code == 200 and persisted.json()["items"] == [{"trashHandle": trash_handle, "name": "Financeiro"}]
    restored = client.post(f"/v1/items/{trash_handle}/restore", headers=auth_headers("restore", resource=trash_handle))
    assert restored.status_code == 200

    class PartialSmb(FakeSmb):
        def copy_verify_delete(self, credential: NasCredential, source_path: str, destination_path: str) -> None:
            raise PartialMoveError

    partial = PartialSmb()
    partial_client = TestClient(create_app(settings(), store, partial))
    partial_handle = partial_client.get("/v1/items?handle=root", headers=auth_headers("list")).json()["entries"][0]["handle"]
    failed = partial_client.post("/v1/items/move", headers=auth_headers("move", resource=partial_handle, destination="root", target_name="Movido"), json={"name": "Movido", "destinationHandle": "root"})
    assert failed.status_code == 409 and failed.json()["code"] == "MOVE_RECONCILIATION_REQUIRED"

    class DirectorySmb(FakeSmb):
        def copy_verify_delete(self, credential: NasCredential, source_path: str, destination_path: str) -> None:
            raise IsADirectoryError

    directory_client = TestClient(create_app(settings(), store, DirectorySmb()))
    directory_handle = directory_client.get("/v1/items?handle=root", headers=auth_headers("list")).json()["entries"][0]["handle"]
    blocked = directory_client.post("/v1/items/move", headers=auth_headers("move", resource=directory_handle, destination="root", target_name="Movido"), json={"name": "Movido", "destinationHandle": "root"})
    assert blocked.status_code == 422 and blocked.json()["code"] == "RECURSIVE_DIRECTORY_MOVE_UNSUPPORTED"
