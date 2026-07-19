from __future__ import annotations

import base64
import json
import struct
from pathlib import Path
from typing import Any

from .document import ATTRIBUTION, SOURCE_NAME, SOURCE_URL, write_atomic
from .model import ExportMetadata, RankEntries, Totals


def _plain_int(value: Any) -> bool:
    return isinstance(value, int) and not isinstance(value, bool)


def pack_i32_deltas(values: list[int]) -> str:
    """Little-endian signed int32 deltas of a non-decreasing sequence, base64."""
    if not values:
        return ""
    deltas = [values[0]]
    previous = values[0]
    for value in values[1:]:
        deltas.append(value - previous)
        previous = value
    return base64.b64encode(struct.pack(f"<{len(deltas)}i", *deltas)).decode("ascii")


def unpack_i32_deltas(encoded: str, expected: int) -> list[int]:
    if expected == 0:
        if encoded:
            raise ValueError("unexpected bests payload for empty list")
        return []
    raw = base64.b64decode(encoded, validate=True)
    if len(raw) != expected * 4:
        raise ValueError("bests payload length mismatch")
    deltas = struct.unpack(f"<{expected}i", raw)
    values: list[int] = []
    acc = 0
    for delta in deltas:
        acc += delta
        values.append(acc)
    return values


def pack_u16(values: list[int]) -> str:
    if not values:
        return ""
    if any(v < 0 or v > 0xFFFF for v in values):
        raise ValueError("country index out of uint16 range")
    return base64.b64encode(struct.pack(f"<{len(values)}H", *values)).decode("ascii")


def unpack_u16(encoded: str, expected: int) -> list[int]:
    if expected == 0:
        if encoded:
            raise ValueError("unexpected country payload for empty list")
        return []
    raw = base64.b64decode(encoded, validate=True)
    if len(raw) != expected * 2:
        raise ValueError("country payload length mismatch")
    return list(struct.unpack(f"<{expected}H", raw))


def pack_u8(values: list[int]) -> str:
    if not values:
        return ""
    if any(v < 0 or v > 0xFF for v in values):
        raise ValueError("continent index out of uint8 range")
    return base64.b64encode(bytes(values)).decode("ascii")


def unpack_u8(encoded: str, expected: int) -> list[int]:
    if expected == 0:
        if encoded:
            raise ValueError("unexpected continent payload for empty list")
        return []
    raw = base64.b64decode(encoded, validate=True)
    if len(raw) != expected:
        raise ValueError("continent payload length mismatch")
    return list(raw)


def build_shard(
    metadata: ExportMetadata,
    event_id: str,
    rank_type: str,
    entries: list,
) -> dict[str, Any]:
    # Sort by best ascending, then official world_rank for stability.
    ordered = sorted(entries, key=lambda item: (item.best, item.world_rank))
    countries: list[str] = []
    continents: list[str] = []
    country_lookup: dict[str, int] = {}
    continent_lookup: dict[str, int] = {}
    bests: list[int] = []
    country_idx: list[int] = []
    continent_idx: list[int] = []

    for entry in ordered:
        iso2 = entry.region.iso2
        continent_id = entry.region.continent_id
        if iso2 not in country_lookup:
            country_lookup[iso2] = len(countries)
            countries.append(iso2)
        if continent_id not in continent_lookup:
            continent_lookup[continent_id] = len(continents)
            continents.append(continent_id)
        bests.append(entry.best)
        country_idx.append(country_lookup[iso2])
        continent_idx.append(continent_lookup[continent_id])

    document = {
        "schemaVersion": 1,
        "eventId": event_id,
        "rankType": rank_type,
        "encoding": "delta-i32+u16+u8-b64",
        "source": {
            "name": SOURCE_NAME,
            "exportDate": metadata.export_date,
            "exportFormatVersion": metadata.export_format_version,
            "archiveUrl": metadata.tsv_url,
            "url": SOURCE_URL,
            "attribution": ATTRIBUTION,
        },
        "count": len(bests),
        "countries": countries,
        "continents": continents,
        "bestsB64": pack_i32_deltas(bests),
        "countryIdxB64": pack_u16(country_idx),
        "continentIdxB64": pack_u8(continent_idx),
    }
    return validate_shard(document)


def validate_shard(document: Any) -> dict[str, Any]:
    if not isinstance(document, dict):
        raise ValueError("rank list shard must be an object")
    required = {
        "schemaVersion",
        "eventId",
        "rankType",
        "encoding",
        "source",
        "count",
        "countries",
        "continents",
        "bestsB64",
        "countryIdxB64",
        "continentIdxB64",
    }
    if set(document) != required:
        raise ValueError("rank list shard has invalid keys")
    if document["schemaVersion"] != 1:
        raise ValueError("unsupported rank list schema")
    if document["encoding"] != "delta-i32+u16+u8-b64":
        raise ValueError("unsupported rank list encoding")
    if document["rankType"] not in {"single", "average"}:
        raise ValueError("invalid rank type")
    if not isinstance(document["eventId"], str) or not document["eventId"]:
        raise ValueError("invalid event id")
    source = document["source"]
    required_source = {"name", "exportDate", "exportFormatVersion", "archiveUrl", "url", "attribution"}
    if not isinstance(source, dict) or set(source) != required_source:
        raise ValueError("invalid rank list source")
    if source["name"] != SOURCE_NAME or source["url"] != SOURCE_URL or source["attribution"] != ATTRIBUTION:
        raise ValueError("invalid rank list attribution")
    if not all(isinstance(source[key], str) and source[key] for key in required_source):
        raise ValueError("invalid rank list source values")
    if not source["archiveUrl"].startswith("https://"):
        raise ValueError("invalid archive url")
    try:
        major = int(source["exportFormatVersion"].split(".", maxsplit=1)[0])
    except (AttributeError, ValueError) as error:
        raise ValueError("invalid export format version") from error
    if major != 2:
        raise ValueError("unsupported export format major version")

    count = document["count"]
    if not _plain_int(count) or count < 0:
        raise ValueError("invalid count")
    countries = document["countries"]
    continents = document["continents"]
    if not isinstance(countries, list) or not isinstance(continents, list):
        raise ValueError("countries/continents must be arrays")
    if count > 0 and (not countries or not continents):
        raise ValueError("missing region tables")
    for iso2 in countries:
        if not isinstance(iso2, str) or len(iso2) != 2 or not iso2.isalpha() or iso2 != iso2.upper():
            raise ValueError("invalid country code in table")
    for continent_id in continents:
        if not isinstance(continent_id, str) or not continent_id.startswith("_"):
            raise ValueError("invalid continent id in table")
    if len(countries) > 0xFFFF:
        raise ValueError("too many countries for uint16 index")
    if len(continents) > 0xFF:
        raise ValueError("too many continents for uint8 index")

    if not isinstance(document["bestsB64"], str) or not isinstance(document["countryIdxB64"], str):
        raise ValueError("invalid packed payloads")
    if not isinstance(document["continentIdxB64"], str):
        raise ValueError("invalid packed payloads")

    bests = unpack_i32_deltas(document["bestsB64"], count)
    country_idx = unpack_u16(document["countryIdxB64"], count)
    continent_idx = unpack_u8(document["continentIdxB64"], count)
    previous = None
    for index, best in enumerate(bests):
        if best <= 0:
            raise ValueError("non-positive best in shard")
        if previous is not None and best < previous:
            raise ValueError("bests must be non-decreasing")
        previous = best
        if country_idx[index] >= len(countries):
            raise ValueError("country index out of range")
        if continent_idx[index] >= len(continents):
            raise ValueError("continent index out of range")
    return document


def serialize_shard(document: dict[str, Any]) -> str:
    validate_shard(document)
    return json.dumps(document, ensure_ascii=False, separators=(",", ":"), sort_keys=True) + "\n"


def load_shard(path: Path) -> dict[str, Any]:
    try:
        return validate_shard(json.loads(path.read_text(encoding="utf-8")))
    except (json.JSONDecodeError, UnicodeError, OSError) as error:
        raise ValueError(f"invalid rank list shard: {path}") from error


def build_manifest(metadata: ExportMetadata, shards: list[tuple[str, str]]) -> dict[str, Any]:
    files = [f"{event_id}/{rank_type}.json" for event_id, rank_type in sorted(shards)]
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
        "files": files,
    }
    return validate_manifest(document)


def validate_manifest(document: Any) -> dict[str, Any]:
    if not isinstance(document, dict) or set(document) != {"schemaVersion", "source", "files"}:
        raise ValueError("invalid rank list manifest shape")
    if document["schemaVersion"] != 1:
        raise ValueError("unsupported manifest schema")
    source = document["source"]
    required_source = {"name", "exportDate", "exportFormatVersion", "archiveUrl", "url", "attribution"}
    if not isinstance(source, dict) or set(source) != required_source:
        raise ValueError("invalid manifest source")
    if source["name"] != SOURCE_NAME or source["url"] != SOURCE_URL:
        raise ValueError("invalid manifest source name/url")
    files = document["files"]
    if not isinstance(files, list) or not files:
        raise ValueError("manifest files must be a non-empty array")
    seen: set[str] = set()
    for path in files:
        if not isinstance(path, str) or not path.endswith(".json") or path in seen:
            raise ValueError("invalid manifest file entry")
        parts = path.split("/")
        if len(parts) != 2 or not parts[0] or parts[1] not in {"single.json", "average.json"}:
            raise ValueError("invalid manifest file path")
        seen.add(path)
    return document


def serialize_manifest(document: dict[str, Any]) -> str:
    validate_manifest(document)
    return json.dumps(document, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def load_manifest(path: Path) -> dict[str, Any]:
    try:
        return validate_manifest(json.loads(path.read_text(encoding="utf-8")))
    except (json.JSONDecodeError, UnicodeError, OSError) as error:
        raise ValueError(f"invalid rank list manifest: {path}") from error


def assert_entries_match_totals(entries: RankEntries, totals: Totals) -> None:
    for event_id, kinds in totals.items():
        for rank_type, bucket in kinds.items():
            rows = entries.get(event_id, {}).get(rank_type, [])
            if len(rows) != bucket.world:
                raise ValueError(
                    f"{event_id}/{rank_type}: rank list rows {len(rows)} != totals world {bucket.world}"
                )


def write_rank_lists(directory: Path, metadata: ExportMetadata, entries: RankEntries, totals: Totals) -> int:
    assert_entries_match_totals(entries, totals)
    # Stage into a temp tree then swap file-by-file atomically after full build.
    staged: list[tuple[Path, str]] = []
    shard_keys: list[tuple[str, str]] = []
    for event_id in sorted(entries):
        for rank_type in ("single", "average"):
            rows = entries[event_id].get(rank_type)
            if not rows:
                continue
            shard = build_shard(metadata, event_id, rank_type, rows)
            rel = Path(event_id) / f"{rank_type}.json"
            staged.append((directory / rel, serialize_shard(shard)))
            shard_keys.append((event_id, rank_type))
    if not staged:
        raise ValueError("no rank list shards produced")
    manifest = serialize_manifest(build_manifest(metadata, shard_keys))
    for path, content in staged:
        write_atomic(path, content)
    write_atomic(directory / "manifest.json", manifest)
    return len(staged)


def rank_lists_match_export(directory: Path, metadata: ExportMetadata) -> bool:
    manifest_path = directory / "manifest.json"
    if not manifest_path.is_file():
        return False
    try:
        manifest = load_manifest(manifest_path)
    except ValueError:
        return False
    source = manifest["source"]
    if (
        source["exportDate"] != metadata.export_date
        or source["exportFormatVersion"] != metadata.export_format_version
        or source["archiveUrl"] != metadata.tsv_url
    ):
        return False
    for rel in manifest["files"]:
        path = directory / rel
        if not path.is_file():
            return False
        try:
            shard = load_shard(path)
        except ValueError:
            return False
        if (
            shard["source"]["exportDate"] != metadata.export_date
            or shard["eventId"] != rel.split("/")[0]
            or f"{shard['rankType']}.json" != rel.split("/")[1]
        ):
            return False
    return True
