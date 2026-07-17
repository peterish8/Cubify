from __future__ import annotations

import json
import os
from pathlib import Path
import tempfile
from typing import Any

from .model import ExportMetadata, Totals


SOURCE_NAME = "World Cube Association Results Export"
SOURCE_URL = "https://www.worldcubeassociation.org/export/results"
ATTRIBUTION = "Based on competition results owned and maintained by the World Cube Association."


def _plain_int(value: Any) -> bool:
    return isinstance(value, int) and not isinstance(value, bool)


def validate_document(document: Any) -> dict[str, Any]:
    if not isinstance(document, dict) or set(document) != {"schemaVersion", "source", "events"}:
        raise ValueError("invalid generated document shape")
    if document["schemaVersion"] != 1:
        raise ValueError("unsupported schema version")
    source = document["source"]
    required_source = {"name", "exportDate", "exportFormatVersion", "archiveUrl", "url", "attribution"}
    if not isinstance(source, dict) or set(source) != required_source:
        raise ValueError("invalid source metadata")
    if source["name"] != SOURCE_NAME or source["url"] != SOURCE_URL or source["attribution"] != ATTRIBUTION:
        raise ValueError("invalid source attribution")
    if not all(isinstance(source[key], str) and source[key] for key in required_source):
        raise ValueError("invalid source metadata values")
    try:
        major = int(source["exportFormatVersion"].split(".", maxsplit=1)[0])
    except (AttributeError, ValueError) as error:
        raise ValueError("invalid export format version") from error
    if major != 2 or not source["archiveUrl"].startswith("https://"):
        raise ValueError("invalid source export metadata")
    events = document["events"]
    if not isinstance(events, dict) or not events:
        raise ValueError("events must be an object")
    for event_id, event in events.items():
        if not isinstance(event_id, str) or not event_id or not isinstance(event, dict) or not event:
            raise ValueError("invalid event entry")
        if not set(event).issubset({"single", "average"}):
            raise ValueError(f"{event_id}: invalid rank type")
        for rank_type, bucket in event.items():
            if not isinstance(bucket, dict) or set(bucket) != {"world", "continents", "countries"}:
                raise ValueError(f"{event_id}/{rank_type}: invalid bucket shape")
            world = bucket["world"]
            if not _plain_int(world) or world <= 0:
                raise ValueError(f"{event_id}/{rank_type}: invalid world total")
            for scope in ("continents", "countries"):
                values = bucket[scope]
                if not isinstance(values, dict) or not values:
                    raise ValueError(f"{event_id}/{rank_type}: invalid {scope}")
                for key, value in values.items():
                    if not isinstance(key, str) or not key or not _plain_int(value) or value <= 0:
                        raise ValueError(f"{event_id}/{rank_type}: invalid {scope} entry")
                    if scope == "countries" and (len(key) != 2 or not key.isalpha() or key != key.upper()):
                        raise ValueError(f"{event_id}/{rank_type}: invalid country key")
                    if scope == "continents" and not key.startswith("_"):
                        raise ValueError(f"{event_id}/{rank_type}: invalid continent key")
                if sum(values.values()) != world:
                    singular = "continent" if scope == "continents" else "country"
                    raise ValueError(f"{event_id}/{rank_type}: {singular} total does not match world")
    return document


def build_document(metadata: ExportMetadata, totals: Totals) -> dict[str, Any]:
    events: dict[str, Any] = {}
    for event_id in sorted(totals):
        event: dict[str, Any] = {}
        for rank_type in ("single", "average"):
            bucket = totals[event_id].get(rank_type)
            if bucket is None:
                continue
            event[rank_type] = {
                "world": bucket.world,
                "continents": dict(sorted(bucket.continents.items())),
                "countries": dict(sorted(bucket.countries.items())),
            }
        if event:
            events[event_id] = event
    document = {
        "schemaVersion": 1,
        "source": {
            "name": SOURCE_NAME,
            "exportDate": metadata.export_date,
            "exportFormatVersion": metadata.export_format_version,
            "archiveUrl": metadata.tsv_url,
            "url": SOURCE_URL,
            "attribution": ATTRIBUTION,
        },
        "events": events,
    }
    return validate_document(document)


def serialize_document(document: dict[str, Any]) -> str:
    validate_document(document)
    encoded = json.dumps(document, ensure_ascii=False, indent=2, sort_keys=False) + "\n"
    validate_document(json.loads(encoded))
    return encoded


def load_document(path: Path) -> dict[str, Any]:
    try:
        return validate_document(json.loads(path.read_text(encoding="utf-8")))
    except (json.JSONDecodeError, UnicodeError, OSError) as error:
        raise ValueError(f"invalid rank totals file: {path}") from error


def write_atomic(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary: Path | None = None
    try:
        with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, delete=False) as stream:
            temporary = Path(stream.name)
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
        temporary = None
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
