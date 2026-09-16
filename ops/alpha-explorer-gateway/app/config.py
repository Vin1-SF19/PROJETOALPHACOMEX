from __future__ import annotations

from dataclasses import dataclass
import hmac
import os
from pathlib import Path
from urllib.parse import urlparse


class ConfigurationError(RuntimeError):
    pass


def _required(env: dict[str, str], name: str) -> str:
    value = env.get(name, "").strip()
    if not value:
        raise ConfigurationError(f"missing configuration: {name}")
    return value


def _exact_origin(value: str) -> str:
    parsed = urlparse(value)
    if (
        parsed.scheme not in {"http", "https"} or not parsed.netloc or parsed.path not in {"", "/"}
        or parsed.params or parsed.query or parsed.fragment or parsed.username is not None or parsed.password is not None
    ):
        raise ConfigurationError("invalid exact origin")
    return f"{parsed.scheme}://{parsed.netloc}"


def _ticket_secret(env: dict[str, str], environment_name: str) -> bytes:
    file_name = env.get(f"SMB_GATEWAY_TICKET_SECRET_{environment_name}_FILE", "").strip()
    if file_name:
        try:
            value = Path(file_name).read_text(encoding="utf-8").strip()
        except OSError as error:
            raise ConfigurationError(f"ticket secret file unavailable: {environment_name}") from error
    else:
        value = _required(env, f"SMB_GATEWAY_TICKET_SECRET_{environment_name}")
    return value.encode()


@dataclass(frozen=True)
class Settings:
    audience: str
    origins: tuple[str, str]
    key_authorities: dict[str, tuple[str, bytes]]
    origin_issuers: dict[str, str]
    smb_server: str
    smb_shares: tuple[str, ...]
    smb_port: int
    vault_url: str
    vault_token_file: str
    vault_ca_cert: str
    vault_mount: str
    vault_prefix: str
    environment: str
    secret_store: str
    replay_db_path: str
    state_db_path: str
    handle_ttl_seconds: int = 300

def load_settings(source: dict[str, str] | None = None) -> Settings:
    env = dict(os.environ if source is None else source)
    environment = env.get("SMB_GATEWAY_ENVIRONMENT", "production").strip().lower()
    prod_origin = _exact_origin(_required(env, "SMB_GATEWAY_PRODUCTION_ORIGIN"))
    stage_origin = _exact_origin(_required(env, "SMB_GATEWAY_STAGE_ORIGIN"))
    prod_issuer = _required(env, "SMB_GATEWAY_ISSUER_PRODUCTION")
    stage_issuer = _required(env, "SMB_GATEWAY_ISSUER_STAGE")
    prod_kid = _required(env, "SMB_GATEWAY_TICKET_KID_PRODUCTION")
    stage_kid = _required(env, "SMB_GATEWAY_TICKET_KID_STAGE")
    prod_secret = _ticket_secret(env, "PRODUCTION")
    stage_secret = _ticket_secret(env, "STAGE")
    if (
        len(prod_secret) < 32 or len(stage_secret) < 32
        or hmac.compare_digest(prod_secret, stage_secret)
        or prod_issuer == stage_issuer or prod_kid == stage_kid
    ):
        raise ConfigurationError("issuer secrets must be >=32 bytes and authorities must differ")
    secret_store = env.get("SMB_GATEWAY_SECRET_STORE", "vault").strip().lower()
    if secret_store != "vault" and not (secret_store == "memory" and environment == "test"):
        raise ConfigurationError("memory secret store is allowed only in tests")
    port = int(env.get("SMB_GATEWAY_SMB_PORT", "445"))
    if not 1 <= port <= 65535:
        raise ConfigurationError("invalid SMB port")
    raw_shares = env.get("SMB_GATEWAY_SMB_SHARES", "").strip()
    smb_shares = tuple(dict.fromkeys(part.strip() for part in raw_shares.split(",") if part.strip()))
    if len(smb_shares) > 64:
        raise ConfigurationError("invalid SMB share allowlist")
    if any(
        len(share) > 255 or share in {".", ".."} or any(char in share for char in "\\/:\x00")
        for share in smb_shares
    ):
        raise ConfigurationError("invalid SMB share allowlist")
    if any(share.casefold() == "onyx" for share in smb_shares):
        raise ConfigurationError("ONYX is outside Alpha Explorer scope")
    vault_url = env.get("SMB_GATEWAY_VAULT_URL", "").strip()
    if secret_store == "vault":
        parsed_vault = urlparse(vault_url)
        loopback_test = (
            environment == "test" and parsed_vault.scheme == "http"
            and parsed_vault.hostname in {"127.0.0.1", "localhost", "::1"}
        )
        if parsed_vault.scheme != "https" and not loopback_test:
            raise ConfigurationError("Vault URL must use HTTPS")
    return Settings(
        audience=_required(env, "SMB_GATEWAY_AUDIENCE"),
        origins=(prod_origin, stage_origin),
        key_authorities={prod_kid: (prod_issuer, prod_secret), stage_kid: (stage_issuer, stage_secret)},
        origin_issuers={prod_origin: prod_issuer, stage_origin: stage_issuer},
        smb_server=_required(env, "SMB_GATEWAY_SMB_SERVER"),
        smb_shares=smb_shares,
        smb_port=port,
        vault_url=vault_url,
        vault_token_file=env.get("SMB_GATEWAY_VAULT_TOKEN_FILE", "").strip(),
        vault_ca_cert=env.get("SMB_GATEWAY_VAULT_CA_CERT", "").strip(),
        vault_mount=env.get("SMB_GATEWAY_VAULT_MOUNT", "alpha-explorer").strip(),
        vault_prefix=env.get("SMB_GATEWAY_VAULT_PREFIX", "smb-bindings").strip("/"),
        environment=environment,
        secret_store=secret_store,
        replay_db_path=env.get("SMB_GATEWAY_REPLAY_DB_PATH", "/var/lib/alpha-explorer-gateway/replay.sqlite3"),
        state_db_path=env.get("SMB_GATEWAY_STATE_DB_PATH", "/var/lib/alpha-explorer-gateway/state.sqlite3"),
        handle_ttl_seconds=min(max(int(env.get("SMB_GATEWAY_HANDLE_TTL_SECONDS", "300")), 30), 900),
    )
