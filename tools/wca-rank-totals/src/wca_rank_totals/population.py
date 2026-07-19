from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .document import ATTRIBUTION, SOURCE_NAME, SOURCE_URL, _plain_int
from .model import ExportMetadata, Region


def count_populations(people: dict[str, Region]) -> dict[str, Region]:
    """Return one representative Region per ISO2 seen among current people.

    Population counting itself happens in :func:`build_population_document`; this
    helper only exists so callers can inspect the distinct countries if needed.
    """
    by_iso2: dict[str, Region] = {}
    for region in people.values():
        by_iso2.setdefault(region.iso2, region)
    return by_iso2


def build_population_document(
    metadata: ExportMetadata,
    people: dict[str, Region],
    names: dict[str, str],
) -> dict[str, Any]:
    counts: dict[str, int] = {}
    continents: dict[str, str] = {}
    for region in people.values():
        counts[region.iso2] = counts.get(region.iso2, 0) + 1
        continents[region.iso2] = region.continent_id

    # Rank descending by cubers, then ISO2 ascending for a deterministic order.
    ordered = sorted(counts.items(), key=lambda item: (-item[1], item[0]))
    countries = [
        {
            "iso2": iso2,
            "name": names.get(iso2, iso2),
            "continentId": continents[iso2],
            "cubers": cubers,
        }
        for iso2, cubers in ordered
    ]
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
        "totalCubers": sum(counts.values()),
        "countries": countries,
    }
    return validate_population_document(document)


def validate_population_document(document: Any) -> dict[str, Any]:
    if not isinstance(document, dict) or set(document) != {
        "schemaVersion",
        "source",
        "totalCubers",
        "countries",
    }:
        raise ValueError("invalid population document shape")
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

    total = document["totalCubers"]
    if not _plain_int(total) or total <= 0:
        raise ValueError("invalid total cubers")

    countries = document["countries"]
    if not isinstance(countries, list) or not countries:
        raise ValueError("countries must be a non-empty list")

    seen: set[str] = set()
    running = 0
    previous: int | None = None
    for entry in countries:
        if not isinstance(entry, dict) or set(entry) != {"iso2", "name", "continentId", "cubers"}:
            raise ValueError("invalid country entry shape")
        iso2 = entry["iso2"]
        if not isinstance(iso2, str) or len(iso2) != 2 or not iso2.isalpha() or iso2 != iso2.upper():
            raise ValueError("invalid country iso2")
        if iso2 in seen:
            raise ValueError(f"duplicate country {iso2}")
        seen.add(iso2)
        if not isinstance(entry["name"], str) or not entry["name"]:
            raise ValueError(f"{iso2}: invalid country name")
        if not isinstance(entry["continentId"], str) or not entry["continentId"].startswith("_"):
            raise ValueError(f"{iso2}: invalid continent id")
        cubers = entry["cubers"]
        if not _plain_int(cubers) or cubers <= 0:
            raise ValueError(f"{iso2}: invalid cuber count")
        if previous is not None and cubers > previous:
            raise ValueError("countries must be sorted by cubers descending")
        previous = cubers
        running += cubers
    if running != total:
        raise ValueError("country totals do not reconcile with totalCubers")
    return document


def serialize_population_document(document: dict[str, Any]) -> str:
    validate_population_document(document)
    encoded = json.dumps(document, ensure_ascii=False, indent=2, sort_keys=False) + "\n"
    validate_population_document(json.loads(encoded))
    return encoded


def load_population_document(path: Path) -> dict[str, Any]:
    try:
        return validate_population_document(json.loads(path.read_text(encoding="utf-8")))
    except (json.JSONDecodeError, UnicodeError, OSError) as error:
        raise ValueError(f"invalid population file: {path}") from error
