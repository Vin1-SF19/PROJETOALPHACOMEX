from __future__ import annotations

import pytest

from app.office import OfficeSessionRegistry, is_office_temporary_file, office_file_type
from app.secrets import BindingIdentity


def test_office_registry_binds_session_to_client_file_and_identity(monkeypatch: pytest.MonkeyPatch) -> None:
    clock = {"monotonic": 100.0, "epoch": 1_800_000_000.0}
    monkeypatch.setattr("app.office.time.monotonic", lambda: clock["monotonic"])
    monkeypatch.setattr("app.office.time.time", lambda: clock["epoch"])
    registry = OfficeSessionRegistry(ttl_seconds=30)
    binding = BindingIdentity("issuer", "audience", "user:42")
    session = registry.issue(binding, "Financeiro\\Relatorio.docx", "Relatorio.docx", 123, "client-a")

    assert registry.resolve(session.token, "Relatorio.docx", "client-a") == session
    with pytest.raises(KeyError):
        registry.resolve(session.token, "Outro.docx", "client-a")
    with pytest.raises(KeyError):
        registry.resolve(session.token, "Relatorio.docx", "client-b")

    clock["monotonic"] = 131.0
    with pytest.raises(KeyError):
        registry.resolve(session.token, "Relatorio.docx", "client-a")


def test_office_file_type_is_fail_closed() -> None:
    assert office_file_type("Relatorio.DOCX") is not None
    assert office_file_type("Planilha.xlsx") is not None
    assert office_file_type("pagina.html") is None
    assert office_file_type("macro.xlsm") is None
    assert office_file_type("arquivo") is None
    assert office_file_type("~$Planilha.xlsx") is None
    assert is_office_temporary_file("~$Planilha.xlsx") is True
    assert is_office_temporary_file("Planilha.xlsx") is False
