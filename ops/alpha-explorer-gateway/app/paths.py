from __future__ import annotations

import re
import unicodedata


TEMP_ROOT = ".alpha-explorer-upload"
TRASH_ROOT = ".alpha-explorer-trash"
BLOCKED_NAMES = {"@Recycle", "@Recently-Snapshot", TEMP_ROOT, TRASH_ROOT}
CONTROL = re.compile(r"[\x00-\x1f\x7f]")


def validate_segment(raw: str) -> str:
    value = unicodedata.normalize("NFC", raw)
    if not value or len(value) > 255 or value in {".", ".."}:
        raise ValueError("invalid path segment")
    if CONTROL.search(value) or "/" in value or "\\" in value or ":" in value or value.endswith((".", " ")):
        raise ValueError("invalid path segment")
    if value.casefold() in {name.casefold() for name in BLOCKED_NAMES} or value.casefold().startswith(f"{TEMP_ROOT}-"):
        raise ValueError("reserved path segment")
    return value


def child_relative_path(parent: str, child: str) -> str:
    segment = validate_segment(child)
    return segment if not parent else f"{parent}\\{segment}"


def to_unc(root: str, relative: str) -> str:
    if not relative:
        return root
    segments = [validate_segment(segment) for segment in relative.split("\\")]
    return root + "\\" + "\\".join(segments)


def internal_relative_path(root_name: str, parent: str, binding_key: str, leaf: str) -> str:
    if root_name not in {TEMP_ROOT, TRASH_ROOT} or not re.fullmatch(r"[a-f0-9]{64}", binding_key) or re.fullmatch(r"[a-f0-9]{32}", leaf) is None:
        raise ValueError("invalid internal path")
    parent_prefix = f"{parent}\\" if parent else ""
    if root_name == TEMP_ROOT:
        return f"{parent_prefix}{TEMP_ROOT}-{leaf}.tmp"
    return f"{parent_prefix}{TRASH_ROOT}\\{binding_key}\\{leaf}"


def to_internal_unc(root: str, relative: str) -> str:
    segments = relative.split("\\")
    if re.fullmatch(r"\.alpha-explorer-upload-[a-f0-9]{32}\.tmp", segments[-1]):
        parent = [validate_segment(segment) for segment in segments[:-1]]
        return root + "\\" + "\\".join([*parent, segments[-1]])
    if len(segments) >= 3 and segments[-3] == TRASH_ROOT and re.fullmatch(r"[a-f0-9]{64}", segments[-2]) and re.fullmatch(r"[a-f0-9]{32}", segments[-1]):
        parent = [validate_segment(segment) for segment in segments[:-3]]
        return root + "\\" + "\\".join([*parent, TRASH_ROOT, segments[-2], segments[-1]])
    raise ValueError("invalid internal path")
