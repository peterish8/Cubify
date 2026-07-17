from __future__ import annotations

from datetime import datetime
import json
from typing import Any, Protocol
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

from .model import ExportMetadata


PUBLIC_EXPORT_METADATA_URL = "https://www.worldcubeassociation.org/api/v0/export/public"


class MetadataError(ValueError):
    pass


class Opener(Protocol):
    def __call__(self, request: Request, timeout: int): ...


def normalize_export_format_version(value: Any) -> str:
    """Map public-API and ZIP metadata version strings to a bare major.minor.patch form.

    Live /api/v0/export/public uses ``export_version: "v2.0.2"``.
    The ZIP ``metadata.json`` uses ``export_format_version: "2.0.2"``.
    """
    if not isinstance(value, str) or not value.strip():
        raise TypeError("export format version must be a non-empty string")
    version = value.strip()
    if version.lower().startswith("v") and len(version) > 1 and version[1].isdigit():
        version = version[1:]
    return version


def extract_export_format_version(payload: dict[str, Any]) -> str:
    if "export_format_version" in payload:
        return normalize_export_format_version(payload["export_format_version"])
    if "export_version" in payload:
        return normalize_export_format_version(payload["export_version"])
    raise KeyError("export_format_version")


def validate_metadata(metadata: ExportMetadata) -> ExportMetadata:
    try:
        major = metadata.major_version
        timestamp = datetime.fromisoformat(metadata.export_date.replace("Z", "+00:00"))
    except (TypeError, ValueError) as error:
        raise MetadataError("invalid WCA export metadata values") from error
    if major != 2:
        raise MetadataError(f"unsupported export format {metadata.export_format_version}")
    archive_url = urlsplit(metadata.tsv_url)
    if timestamp.tzinfo is None or archive_url.scheme != "https" or not archive_url.netloc:
        raise MetadataError("invalid WCA export metadata values")
    return metadata


def fetch_metadata(url: str = PUBLIC_EXPORT_METADATA_URL, opener: Opener = urlopen) -> ExportMetadata:
    request = Request(url, headers={"Accept": "application/json", "User-Agent": "Cubify-wca-rank-totals/0.1"})
    try:
        with opener(request, timeout=30) as response:
            payload = json.load(response)
        if not isinstance(payload, dict):
            raise TypeError("metadata response is not an object")
        export_format_version = extract_export_format_version(payload)
        metadata = ExportMetadata(
            export_date=payload["export_date"],
            export_format_version=export_format_version,
            tsv_url=payload["tsv_url"],
        )
        if not all(isinstance(value, str) for value in (metadata.export_date, metadata.export_format_version, metadata.tsv_url)):
            raise TypeError("metadata fields must be strings")
        return validate_metadata(metadata)
    except MetadataError:
        raise
    except (KeyError, TypeError, ValueError, OSError) as error:
        raise MetadataError("invalid WCA export metadata") from error
