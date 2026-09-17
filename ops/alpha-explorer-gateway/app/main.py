from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import threading
import time
from urllib.parse import quote
import uuid

from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel, ConfigDict, Field

from .config import Settings, load_settings
from .handles import HandleRegistry
from .office import OfficeSessionRegistry, office_file_type
from .paths import TEMP_ROOT, TRASH_ROOT, child_relative_path, internal_relative_path, validate_segment
from .secrets import (
    BindingAlreadyExists, BindingIdentity, BindingNotFound, NasCredential, PrincipalAlreadyLinked,
    PrincipalChangeDenied, SecretStore, build_secret_store,
)
from .security import ReplayGuard, TicketClaims, TicketError, verify_ticket
from .smb import PartialMoveError, SmbClient, SmbValidationError
from .state import OperationState


class CredentialBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    principal: str = Field(min_length=1, max_length=128, pattern=r"^[^\\/@\x00-\x1f]+$")
    password: str = Field(min_length=1, max_length=512)
    justification: str | None = Field(default=None, max_length=240)


class UnlinkBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    confirm: bool
    justification: str | None = Field(default=None, max_length=240)


class NameBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=255)


class MoveBody(NameBody):
    destinationHandle: str = Field(min_length=4, max_length=130)


class UploadStartBody(NameBody):
    expectedSize: int = Field(ge=0, le=2 * 1024 * 1024 * 1024)


class ReconcileBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    execute: bool = False


class OfficeSessionBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=255)


def _subject_hash(subject: str) -> str:
    return hashlib.sha256(subject.encode()).hexdigest()[:16]


def _log(
    action: str, result: str, support_id: str, subject: str | None = None,
    duration_ms: int | None = None, actor: str | None = None, error_code: str | None = None,
    provider_code: str | None = None,
) -> None:
    event: dict[str, object] = {
        "scope": "alpha-explorer-smb-gateway", "action": action, "result": result, "supportId": support_id,
    }
    if subject:
        event["subjectHash"] = _subject_hash(subject)
    if actor:
        event["actorHash"] = _subject_hash(actor)
    if duration_ms is not None:
        event["durationMs"] = duration_ms
    if error_code is not None:
        event["errorCode"] = error_code
    if provider_code is not None:
        event["providerCode"] = provider_code
    print(json.dumps(event, separators=(",", ":")), flush=True)


def create_app(settings: Settings | None = None, store: SecretStore | None = None, smb: SmbClient | None = None) -> FastAPI:
    current = settings or load_settings()
    secret_store = store or build_secret_store(current)
    smb_client = smb or SmbClient(current)
    replay = ReplayGuard(current.replay_db_path)
    state = OperationState(current.state_db_path)
    handles = HandleRegistry(current.handle_ttl_seconds)
    office_sessions = OfficeSessionRegistry()
    upload_locks: dict[str, threading.Lock] = {}
    app = FastAPI(title="Alpha Explorer SMB Gateway", version="1.0.0", docs_url=None, redoc_url=None, openapi_url=None)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(current.origins), allow_credentials=False,
        allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "Range"], expose_headers=["X-Support-Id", "Content-Range", "Accept-Ranges"], max_age=300,
    )

    @app.middleware("http")
    async def limit_body(request: Request, call_next):
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                maximum = 8 * 1024 * 1024 if "/chunks" in request.url.path else 16_384
                if int(content_length) > maximum:
                    return _error_response(413, "REQUEST_TOO_LARGE")
            except ValueError:
                return _error_response(400, "INVALID_CONTENT_LENGTH")
        return await call_next(request)

    def authorize(scope: str):
        def dependency(request: Request, authorization: str | None = Header(default=None), origin: str | None = Header(default=None)) -> TicketClaims:
            if not authorization or not authorization.startswith("Bearer ") or not origin:
                raise HTTPException(status_code=401, detail="UNAUTHENTICATED")
            try:
                claims = verify_ticket(authorization[7:], origin, scope, current, replay)
            except TicketError:
                raise HTTPException(status_code=401, detail="UNAUTHENTICATED") from None
            binding = binding_for(claims)
            client_host = request.client.host if request.client is not None else "unknown"
            maximum, window = ((5, 600) if scope in {"credential:enroll", "credential:rotate"} else (20, 60) if scope == "office_open" else (60, 60) if scope == "list" else (30, 60) if scope in {
                "mkdir", "rename", "move", "trash", "restore", "unlink", "upload_start", "upload_commit"
            } or scope == "credential:unlink" else (240, 60))
            now = int(time.time())
            binding_rate_key = hashlib.sha256(f"binding\x1f{binding.key}\x1f{scope}".encode()).hexdigest()
            client_rate_key = hashlib.sha256(f"client\x1f{client_host}\x1f{scope}".encode()).hexdigest()
            if (
                not replay.consume_rate(binding_rate_key, maximum, window, now)
                or not replay.consume_rate(client_rate_key, maximum * 20, window, now)
            ):
                raise HTTPException(status_code=429, detail="RATE_LIMITED")
            return claims
        return dependency

    @app.exception_handler(HTTPException)
    async def http_error(_request: Request, exc: HTTPException):
        return _error_response(exc.status_code, str(exc.detail), getattr(exc, "support_id", None))

    @app.exception_handler(RequestValidationError)
    async def request_validation_error(_request: Request, _exc: RequestValidationError):
        return _error_response(422, "VALIDATION_ERROR")

    @app.exception_handler(Exception)
    async def unhandled_error(_request: Request, _exc: Exception):
        return _error_response(500, "INTERNAL_ERROR")

    def binding_for(claims: TicketClaims) -> BindingIdentity:
        return BindingIdentity(issuer=claims.issuer, audience=claims.audience, subject=claims.subject)

    def credential_for(claims: TicketClaims) -> tuple[BindingIdentity, NasCredential]:
        binding = binding_for(claims)
        try:
            credential = secret_store.get(binding)
        except Exception:
            raise HTTPException(status_code=503, detail="SECRET_STORE_UNAVAILABLE") from None
        if credential is None:
            raise HTTPException(status_code=403, detail="SMB_IDENTITY_NOT_LINKED")
        return binding, credential

    def assert_admin_credential_body(claims: TicketClaims) -> None:
        if claims.actor_subject is None or claims.binding_nonce is None:
            raise HTTPException(status_code=403, detail="ADMIN_CREDENTIAL_SCOPE_DENIED")

    def validate_managed_principal(principal: str) -> None:
        if principal.strip().casefold() in {"admin", "administrator", "guest"}:
            raise HTTPException(status_code=403, detail="SMB_PRINCIPAL_POLICY_DENIED")

    def resolve_handle(claims: TicketClaims, handle: str) -> str:
        if handle != claims.resource:
            raise HTTPException(status_code=403, detail="RESOURCE_DENIED")
        try:
            return handles.resolve(binding_for(claims).key, handle)
        except KeyError:
            raise HTTPException(status_code=404, detail="HANDLE_NOT_FOUND") from None

    @app.get("/v1/health")
    def health(claims: TicketClaims = Depends(authorize("health"))):
        support_id = str(uuid.uuid4())
        _log("health", "success", support_id, claims.subject)
        return {
            "ok": True,
            "service": "alpha-explorer-smb-gateway",
            "version": "v1",
            "checks": {
                "application": True,
                "vaultConfigured": current.secret_store == "vault" and bool(current.vault_url and current.vault_token_file),
            },
            "supportId": support_id,
        }

    @app.get("/v1/link")
    def link_status(claims: TicketClaims = Depends(authorize("link_status"))):
        binding = binding_for(claims)
        try:
            linked = secret_store.get(binding) is not None
        except Exception:
            raise HTTPException(status_code=503, detail="SECRET_STORE_UNAVAILABLE") from None
        return {"linked": linked, "supportId": str(uuid.uuid4())}

    @app.get("/v1/admin/credentials/status")
    def admin_credential_status(claims: TicketClaims = Depends(authorize("credential:status"))):
        try:
            status = secret_store.describe(binding_for(claims))
        except Exception:
            raise HTTPException(status_code=503, detail="SECRET_STORE_UNAVAILABLE") from None
        return {
            "linked": status.linked,
            "principal": status.principal,
            "principalKey": status.principal_key,
            "secretRef": status.secret_ref,
            "credentialVersion": status.credential_version,
            "supportId": str(uuid.uuid4()),
        }

    def write_admin_credential(body: CredentialBody, claims: TicketClaims, rotate: bool):
        support_id, started = str(uuid.uuid4()), time.monotonic()
        assert_admin_credential_body(claims)
        validate_managed_principal(body.principal)
        authority_secret = next(
            (secret for issuer, secret in current.key_authorities.values() if issuer == claims.issuer), None
        )
        if authority_secret is None:
            raise HTTPException(status_code=401, detail="UNAUTHENTICATED")
        principal_key = hmac.new(
            authority_secret, body.principal.casefold().encode(), hashlib.sha256
        ).hexdigest()
        if not replay.consume_rate(f"principal:{principal_key}", 10, 600, int(time.time())):
            raise HTTPException(status_code=429, detail="RATE_LIMITED")
        credential = NasCredential(body.principal, body.password)
        try:
            smb_client.validate(credential)
        except SmbValidationError as error:
            status = 403 if error.code in {
                "SMB_AUTHENTICATION_FAILED", "SMB_ACCOUNT_LOCKED", "SMB_PASSWORD_EXPIRED", "SMB_NO_ACCESSIBLE_SHARES",
            } else 503
            _log("credential.rotate" if rotate else "credential.enroll", "failure", support_id, claims.subject,
                 int((time.monotonic() - started) * 1000), claims.actor_subject, error.code,
                 error.diagnostic_code)
            failure = HTTPException(status_code=status, detail=error.code)
            failure.support_id = support_id
            raise failure from None
        except Exception:
            error_code = "SMB_CREDENTIAL_REJECTED"
            _log("credential.rotate" if rotate else "credential.enroll", "failure", support_id, claims.subject,
                 int((time.monotonic() - started) * 1000), claims.actor_subject, error_code)
            failure = HTTPException(status_code=403, detail=error_code)
            failure.support_id = support_id
            raise failure from None
        try:
            if rotate:
                secret_store.rotate(binding_for(claims), credential)
            else:
                secret_store.create(binding_for(claims), credential)
        except BindingAlreadyExists:
            raise HTTPException(status_code=409, detail="SMB_BINDING_ALREADY_EXISTS") from None
        except BindingNotFound:
            raise HTTPException(status_code=404, detail="SMB_BINDING_NOT_FOUND") from None
        except PrincipalAlreadyLinked:
            raise HTTPException(status_code=409, detail="SMB_PRINCIPAL_ALREADY_LINKED") from None
        except PrincipalChangeDenied:
            raise HTTPException(status_code=409, detail="SMB_PRINCIPAL_CHANGE_DENIED") from None
        except Exception:
            raise HTTPException(status_code=503, detail="SECRET_STORE_UNAVAILABLE") from None
        handles.revoke_binding(binding_for(claims).key)
        office_sessions.revoke_binding(binding_for(claims).key)
        _log("credential.rotate" if rotate else "credential.enroll", "success", support_id, claims.subject,
             int((time.monotonic() - started) * 1000), claims.actor_subject)
        return {"ok": True, "linked": True, "supportId": support_id}

    @app.post("/v1/admin/credentials/enroll", status_code=201)
    def admin_enroll(body: CredentialBody, claims: TicketClaims = Depends(authorize("credential:enroll"))):
        return write_admin_credential(body, claims, rotate=False)

    @app.post("/v1/admin/credentials/rotate")
    def admin_rotate(body: CredentialBody, claims: TicketClaims = Depends(authorize("credential:rotate"))):
        return write_admin_credential(body, claims, rotate=True)

    @app.delete("/v1/admin/credentials")
    def admin_unlink(body: UnlinkBody, claims: TicketClaims = Depends(authorize("credential:unlink"))):
        if not body.confirm:
            raise HTTPException(status_code=400, detail="CONFIRMATION_REQUIRED")
        assert_admin_credential_body(claims)
        support_id = str(uuid.uuid4())
        secret_store.delete(binding_for(claims))
        handles.revoke_binding(binding_for(claims).key)
        office_sessions.revoke_binding(binding_for(claims).key)
        _log("credential.unlink", "success", support_id, claims.subject, actor=claims.actor_subject)
        return {"ok": True, "linked": False, "supportId": support_id}

    @app.get("/v1/items")
    def list_items(
        claims: TicketClaims = Depends(authorize("list")),
        handle: str = Query(default="root", min_length=4, max_length=130),
        limit: int = Query(default=100, ge=1, le=200),
        offset: int = Query(default=0, ge=0, le=2_000),
    ):
        support_id, started = str(uuid.uuid4()), time.monotonic()
        binding, credential = credential_for(claims)
        try:
            relative = resolve_handle(claims, handle)
            entries, has_more = smb_client.list_directory(credential, relative, offset, limit)
        except Exception:
            _log("list", "failure", support_id, claims.subject, int((time.monotonic() - started) * 1000))
            raise HTTPException(status_code=503, detail="SMB_UNAVAILABLE") from None
        response_entries = [{
            "handle": handles.issue(binding.key, entry.relative_path), "name": entry.name,
            "kind": "directory" if entry.is_directory else "file", "size": entry.size, "modifiedAt": entry.modified_at,
        } for entry in entries]
        next_offset = offset + len(entries)
        _log("list", "success", support_id, claims.subject, int((time.monotonic() - started) * 1000))
        return {"entries": response_entries, "nextCursor": str(next_offset) if has_more else None, "supportId": support_id}

    @app.post("/v1/directories", status_code=201)
    def mkdir(body: NameBody, claims: TicketClaims = Depends(authorize("mkdir"))):
        _binding, credential = credential_for(claims)
        parent = resolve_handle(claims, claims.resource)
        if claims.target_name != body.name:
            raise HTTPException(status_code=403, detail="TARGET_CONSTRAINT_DENIED")
        try:
            name = validate_segment(body.name)
            smb_client.make_directory(credential, parent, name)
        except FileExistsError:
            raise HTTPException(status_code=409, detail="DESTINATION_EXISTS") from None
        except ValueError:
            raise HTTPException(status_code=400, detail="INVALID_NAME") from None
        return {"ok": True, "supportId": str(uuid.uuid4())}

    @app.get("/v1/files/download")
    def download(request: Request, claims: TicketClaims = Depends(authorize("download"))):
        _binding, credential = credential_for(claims)
        relative = resolve_handle(claims, claims.resource)
        try:
            size = smb_client.stat_file(credential, relative)
        except Exception:
            raise HTTPException(status_code=404, detail="FILE_NOT_FOUND") from None
        start, end, status = _parse_range(request.headers.get("range"), size)
        length = end - start + 1
        if claims.max_bytes is not None and length > claims.max_bytes:
            raise HTTPException(status_code=403, detail="SIZE_CONSTRAINT_DENIED")
        filename = relative.rsplit("\\", 1)[-1]
        headers = {
            "Accept-Ranges": "bytes", "Content-Length": str(length),
            "Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename, safe='')}",
        }
        if status == 206:
            headers["Content-Range"] = f"bytes {start}-{end}/{size}"
        return StreamingResponse(smb_client.iter_file(credential, relative, start, length), status_code=status, headers=headers, media_type="application/octet-stream")

    @app.post("/v1/office/sessions", status_code=201)
    def create_office_session(
        body: OfficeSessionBody,
        request: Request,
        claims: TicketClaims = Depends(authorize("office_open")),
    ):
        support_id, started = str(uuid.uuid4()), time.monotonic()
        binding, credential = credential_for(claims)
        relative = resolve_handle(claims, claims.resource)
        file_name = relative.rsplit("\\", 1)[-1]
        if claims.target_name != body.name or body.name != file_name or office_file_type(file_name) is None:
            raise HTTPException(status_code=403, detail="OFFICE_FILE_DENIED")
        try:
            size = smb_client.stat_file(credential, relative)
        except Exception:
            raise HTTPException(status_code=404, detail="FILE_NOT_FOUND") from None
        if claims.max_bytes is None or claims.max_bytes != size:
            raise HTTPException(status_code=409, detail="OFFICE_FILE_CHANGED")
        client_host = request.client.host if request.client is not None else "unknown"
        session = office_sessions.issue(binding, relative, file_name, size, client_host)
        document_path = f"/v1/office/files/{session.token}/{quote(file_name, safe='')}"
        _log("office.open", "success", support_id, claims.subject, int((time.monotonic() - started) * 1000))
        return {
            "application": session.application,
            "documentPath": document_path,
            "expiresAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(session.expires_at_epoch)),
            "supportId": support_id,
        }

    @app.options("/v1/office/files/{session_token}")
    def office_folder_options(session_token: str, request: Request):
        client_host = request.client.host if request.client is not None else "unknown"
        try:
            office_sessions.resolve_token(session_token, client_host)
        except KeyError:
            raise HTTPException(status_code=404, detail="OFFICE_SESSION_NOT_FOUND") from None
        return Response(status_code=204, headers={
            "Allow": "OPTIONS, HEAD, GET",
            "Cache-Control": "private, no-store",
        })

    @app.api_route("/v1/office/files/{session_token}/{file_name}", methods=["OPTIONS", "HEAD", "GET"])
    def office_file(session_token: str, file_name: str, request: Request):
        support_id, started = str(uuid.uuid4()), time.monotonic()
        client_host = request.client.host if request.client is not None else "unknown"
        try:
            session = office_sessions.resolve(session_token, file_name, client_host)
            credential = secret_store.get(session.binding)
        except Exception:
            raise HTTPException(status_code=404, detail="OFFICE_SESSION_NOT_FOUND") from None
        session_rate_key = hashlib.sha256(f"office-session\x1f{session_token}".encode()).hexdigest()
        if not replay.consume_rate(session_rate_key, 64, 60, int(time.time())):
            raise HTTPException(status_code=429, detail="RATE_LIMITED")
        if credential is None:
            raise HTTPException(status_code=403, detail="SMB_IDENTITY_NOT_LINKED")
        if request.method == "OPTIONS":
            return Response(status_code=204, headers={
                "Allow": "OPTIONS, HEAD, GET",
                "Cache-Control": "private, no-store",
            })
        try:
            size = smb_client.stat_file(credential, session.relative_path)
        except Exception:
            raise HTTPException(status_code=404, detail="FILE_NOT_FOUND") from None
        if size != session.expected_size:
            raise HTTPException(status_code=409, detail="OFFICE_FILE_CHANGED")
        start, end, status = _parse_range(request.headers.get("range"), size)
        length = end - start + 1
        headers = {
            "Accept-Ranges": "bytes",
            "Cache-Control": "private, no-store",
            "Content-Disposition": f"inline; filename*=UTF-8''{quote(session.file_name, safe='')}",
            "Content-Length": str(length),
            "X-Content-Type-Options": "nosniff",
            "X-Support-Id": support_id,
        }
        if status == 206:
            headers["Content-Range"] = f"bytes {start}-{end}/{size}"
        _log("office.read", "success", support_id, session.binding.subject, int((time.monotonic() - started) * 1000))
        if request.method == "HEAD":
            return Response(status_code=status, headers=headers, media_type=session.content_type)
        return StreamingResponse(
            smb_client.iter_file(credential, session.relative_path, start, length),
            status_code=status,
            headers=headers,
            media_type=session.content_type,
        )

    @app.post("/v1/uploads", status_code=201)
    def upload_start(body: UploadStartBody, claims: TicketClaims = Depends(authorize("upload_start"))):
        binding, credential = credential_for(claims)
        parent = resolve_handle(claims, claims.resource)
        if claims.max_bytes is None or body.expectedSize != claims.max_bytes or claims.target_name != body.name:
            raise HTTPException(status_code=403, detail="SIZE_CONSTRAINT_DENIED")
        try:
            final_path = child_relative_path(parent, body.name)
            temporary_path = internal_relative_path(TEMP_ROOT, parent, binding.key, uuid.uuid4().hex)
            record = state.create_upload(binding.key, parent, temporary_path, final_path, body.expectedSize)
            smb_client.create_empty(credential, temporary_path)
        except (ValueError, FileExistsError):
            raise HTTPException(status_code=409, detail="UPLOAD_START_CONFLICT") from None
        except Exception:
            if 'record' in locals():
                state.set_upload_status(binding.key, record.session_id, "OPEN", "FAILED")
            raise HTTPException(status_code=503, detail="SMB_UNAVAILABLE") from None
        return {"sessionHandle": record.session_id, "receivedSize": 0, "expectedSize": record.expected_size, "supportId": str(uuid.uuid4())}

    @app.post("/v1/uploads/{session_id}/chunks")
    async def upload_chunk(session_id: str, request: Request, claims: TicketClaims = Depends(authorize("upload_chunk"))):
        binding, credential = credential_for(claims)
        if claims.resource != session_id or claims.offset is None or claims.max_bytes is None or claims.max_bytes > 8 * 1024 * 1024:
            raise HTTPException(status_code=403, detail="UPLOAD_CONSTRAINT_DENIED")
        lock = upload_locks.setdefault(session_id, threading.Lock())
        await asyncio.to_thread(lock.acquire)
        try:
            try:
                record = state.get_upload(binding.key, session_id)
                if record.status != "OPEN" or record.received_size != claims.offset:
                    raise ValueError
                received = 0
                async for chunk in request.stream():
                    if not chunk:
                        continue
                    if received + len(chunk) > claims.max_bytes:
                        raise HTTPException(status_code=413, detail="CHUNK_TOO_LARGE")
                    await asyncio.to_thread(smb_client.append_chunk, credential, record.temporary_path, claims.offset + received, bytes(chunk))
                    received += len(chunk)
                if received == 0:
                    raise HTTPException(status_code=400, detail="EMPTY_CHUNK")
                record = state.advance_upload(binding.key, session_id, claims.offset, received)
            except HTTPException:
                raise
            except (KeyError, ValueError):
                raise HTTPException(status_code=409, detail="UPLOAD_STATE_CONFLICT") from None
            except Exception:
                raise HTTPException(status_code=503, detail="SMB_UNAVAILABLE") from None
        finally:
            lock.release()
        return {"receivedSize": record.received_size, "expectedSize": record.expected_size, "supportId": str(uuid.uuid4())}

    @app.post("/v1/uploads/{session_id}/commit")
    def upload_commit(session_id: str, claims: TicketClaims = Depends(authorize("upload_commit"))):
        binding, credential = credential_for(claims)
        if claims.resource != session_id:
            raise HTTPException(status_code=403, detail="RESOURCE_DENIED")
        with upload_locks.setdefault(session_id, threading.Lock()):
            try:
                record = state.get_upload(binding.key, session_id)
                if record.status != "OPEN" or record.received_size != record.expected_size:
                    raise ValueError
                state.set_upload_status(binding.key, session_id, "OPEN", "COMMITTING")
                smb_client.publish_upload(credential, record.temporary_path, record.final_path, record.expected_size)
                record = state.set_upload_status(binding.key, session_id, "COMMITTING", "COMPLETED")
            except FileExistsError:
                try:
                    state.set_upload_status(binding.key, session_id, "COMMITTING", "OPEN")
                except (KeyError, ValueError):
                    pass
                raise HTTPException(status_code=409, detail="DESTINATION_EXISTS") from None
            except (KeyError, ValueError):
                raise HTTPException(status_code=409, detail="UPLOAD_STATE_CONFLICT") from None
            except Exception:
                raise HTTPException(status_code=503, detail="SMB_UNAVAILABLE") from None
        return {"ok": True, "status": record.status, "supportId": str(uuid.uuid4())}

    @app.delete("/v1/uploads/{session_id}")
    def upload_cancel(session_id: str, claims: TicketClaims = Depends(authorize("upload_cancel"))):
        binding, credential = credential_for(claims)
        if claims.resource != session_id:
            raise HTTPException(status_code=403, detail="RESOURCE_DENIED")
        with upload_locks.setdefault(session_id, threading.Lock()):
            try:
                record = state.get_upload(binding.key, session_id)
                if record.status != "OPEN":
                    raise ValueError
                smb_client.remove_internal(credential, record.temporary_path)
                state.set_upload_status(binding.key, session_id, "OPEN", "CANCELED")
            except (KeyError, ValueError):
                raise HTTPException(status_code=409, detail="UPLOAD_STATE_CONFLICT") from None
        return {"ok": True, "supportId": str(uuid.uuid4())}

    def copy_move(body: MoveBody, claims: TicketClaims):
        _binding, credential = credential_for(claims)
        source = resolve_handle(claims, claims.resource)
        if claims.destination != body.destinationHandle or claims.target_name != body.name:
            raise HTTPException(status_code=403, detail="TARGET_CONSTRAINT_DENIED")
        try:
            destination_parent = handles.resolve(binding_for(claims).key, body.destinationHandle)
            destination = child_relative_path(destination_parent, body.name)
            smb_client.copy_verify_delete(credential, source, destination)
        except KeyError:
            raise HTTPException(status_code=404, detail="HANDLE_NOT_FOUND") from None
        except FileExistsError:
            raise HTTPException(status_code=409, detail="DESTINATION_EXISTS") from None
        except PartialMoveError:
            raise HTTPException(status_code=409, detail="MOVE_RECONCILIATION_REQUIRED") from None
        except IsADirectoryError:
            raise HTTPException(status_code=422, detail="RECURSIVE_DIRECTORY_MOVE_UNSUPPORTED") from None
        except ValueError:
            raise HTTPException(status_code=400, detail="INVALID_NAME") from None
        return {"ok": True, "supportId": str(uuid.uuid4())}

    @app.post("/v1/items/rename")
    def rename(body: NameBody, claims: TicketClaims = Depends(authorize("rename"))):
        _binding, credential = credential_for(claims)
        source = resolve_handle(claims, claims.resource)
        if claims.target_name != body.name:
            raise HTTPException(status_code=403, detail="TARGET_CONSTRAINT_DENIED")
        try:
            smb_client.rename_entry(credential, source, validate_segment(body.name))
        except FileExistsError:
            raise HTTPException(status_code=409, detail="DESTINATION_EXISTS") from None
        except ValueError:
            raise HTTPException(status_code=400, detail="INVALID_NAME") from None
        return {"ok": True, "supportId": str(uuid.uuid4())}

    @app.post("/v1/items/move")
    def move(body: MoveBody, claims: TicketClaims = Depends(authorize("move"))):
        return copy_move(body, claims)

    @app.delete("/v1/items/trash")
    def trash(claims: TicketClaims = Depends(authorize("trash"))):
        binding, credential = credential_for(claims)
        source = resolve_handle(claims, claims.resource)
        parent = source.rsplit("\\", 1)[0] if "\\" in source else ""
        internal = internal_relative_path(TRASH_ROOT, parent, binding.key, uuid.uuid4().hex)
        record = state.create_trash(binding.key, source, internal)
        try:
            smb_client.move_to_internal(credential, source, internal)
            state.set_trash_status(binding.key, record.trash_id, "PENDING", "TRASHED")
        except Exception:
            state.set_trash_status(binding.key, record.trash_id, "PENDING", "FAILED")
            raise HTTPException(status_code=503, detail="SMB_UNAVAILABLE") from None
        return {"trashHandle": record.trash_id, "supportId": str(uuid.uuid4())}

    @app.get("/v1/trash")
    def trash_list(
        claims: TicketClaims = Depends(authorize("trash_list")),
        limit: int = Query(default=100, ge=1, le=200),
        offset: int = Query(default=0, ge=0, le=100_000),
    ):
        binding, credential = credential_for(claims)
        try:
            smb_client.validate(credential)
        except Exception:
            raise HTTPException(status_code=403, detail="SMB_ACCESS_DENIED") from None
        records, has_more = state.list_trash(binding.key, offset, limit)
        items = [{"trashHandle": record.trash_id, "name": record.original_path.rsplit("\\", 1)[-1]} for record in records]
        return {"items": items, "nextCursor": str(offset + limit) if has_more else None, "supportId": str(uuid.uuid4())}

    @app.post("/v1/items/{trash_id}/restore")
    def restore(trash_id: str, claims: TicketClaims = Depends(authorize("restore"))):
        binding, credential = credential_for(claims)
        if claims.resource != trash_id:
            raise HTTPException(status_code=403, detail="RESOURCE_DENIED")
        try:
            record = state.get_trash(binding.key, trash_id)
            if record.status != "TRASHED":
                raise ValueError
            smb_client.restore_from_internal(credential, record.trash_path, record.original_path)
            state.restore_trash(binding.key, trash_id)
        except FileExistsError:
            raise HTTPException(status_code=409, detail="DESTINATION_EXISTS") from None
        except (KeyError, ValueError):
            raise HTTPException(status_code=409, detail="TRASH_STATE_CONFLICT") from None
        return {"ok": True, "supportId": str(uuid.uuid4())}

    @app.post("/v1/uploads/reconcile")
    def reconcile(body: ReconcileBody, claims: TicketClaims = Depends(authorize("upload_reconcile"))):
        binding, credential = credential_for(claims)
        stale = state.stale_uploads(binding.key, 900)
        results = []
        for record in stale:
            try:
                if record.status == "COMMITTING":
                    final_size = smb_client.stat_file(credential, record.final_path)
                    if final_size == record.expected_size:
                        if body.execute:
                            state.set_upload_status(binding.key, record.session_id, "COMMITTING", "COMPLETED")
                        results.append({"sessionHandle": record.session_id, "recoverable": True, "resolution": "complete"})
                        continue
            except Exception:
                if record.status == "COMMITTING" and body.execute:
                    try:
                        state.set_upload_status(binding.key, record.session_id, "COMMITTING", "OPEN")
                    except Exception:
                        pass
            try:
                actual = smb_client.stat_internal(credential, record.temporary_path)
                if body.execute:
                    state.reconcile_received(binding.key, record.session_id, actual)
                results.append({"sessionHandle": record.session_id, "recoverable": actual <= record.expected_size, "resolution": "resume"})
            except Exception:
                results.append({"sessionHandle": record.session_id, "recoverable": False, "resolution": "manual"})
        return {"dryRun": not body.execute, "sessions": results, "supportId": str(uuid.uuid4())}

    return app


def _error_response(status_code: int, code: str, support_id: str | None = None):
    from fastapi.responses import JSONResponse
    effective_support_id = support_id or str(uuid.uuid4())
    return JSONResponse(status_code=status_code, content={"ok": False, "code": code, "supportId": effective_support_id}, headers={"X-Support-Id": effective_support_id})


def _parse_range(value: str | None, size: int) -> tuple[int, int, int]:
    if size < 0:
        raise HTTPException(status_code=404, detail="FILE_NOT_FOUND")
    if value is None:
        return (0, size - 1, 200)
    if size == 0 or not value.startswith("bytes=") or "," in value:
        raise HTTPException(status_code=416, detail="RANGE_NOT_SATISFIABLE")
    spec = value[6:]
    try:
        start_text, end_text = spec.split("-", 1)
        if not start_text:
            suffix = int(end_text)
            if suffix <= 0:
                raise ValueError
            start, end = max(0, size - suffix), size - 1
        else:
            start = int(start_text)
            end = size - 1 if not end_text else min(int(end_text), size - 1)
        if start < 0 or start >= size or end < start:
            raise ValueError
    except (ValueError, TypeError):
        raise HTTPException(status_code=416, detail="RANGE_NOT_SATISFIABLE") from None
    return (start, end, 206)


app = create_app()
