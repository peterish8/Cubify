from __future__ import annotations

from datetime import datetime
import json
import re
from typing import Any, Protocol
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

from .model import ExportMetadata


PUBLIC_EXPORT_METADATA_URL = "https://www.worldcubeassociation.org/api/v0/export/public"
EXPORT_RESULTS_PAGE_URL = "https://www.worldcubeassociation.org/export/results"
USER_AGENT = "Cubify-wca-rank-totals/0.1"


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


def _looks_like_direct_zip_url(url: str) -> bool:
    path = urlsplit(url).path.lower()
    return path.endswith(".zip")


def _export_date_token(export_date: str) -> str:
    """``2026-07-17T00:00:43Z`` → ``20260717T000043Z`` for CDN filename matching."""
    cleaned = export_date.strip().replace("-", "").replace(":", "")
    if cleaned.endswith("+00:00"):
        cleaned = cleaned[: -len("+00:00")] + "Z"
    return cleaned


def _probe_archive_url(url: str, opener: Opener) -> str | None:
    """Return the final URL if a tiny range/GET succeeds, else None."""
    request = Request(
        url,
        headers={
            "Range": "bytes=0-15",
            "Accept-Encoding": "identity",
            "User-Agent": USER_AGENT,
        },
    )
    try:
        with opener(request, timeout=30) as response:
            status = getattr(response, "status", None) or response.getcode()
            if status not in {200, 206}:
                return None
            body = response.read(4)
            if body[:2] != b"PK":
                return None
            final = getattr(response, "geturl", lambda: url)()
            return final or url
    except (HTTPError, URLError, TimeoutError, OSError, ValueError, AttributeError):
        return None


def _scrape_tsv_zip_url(export_date: str, opener: Opener) -> str | None:
    """Find the official TSV ZIP on the WCA export results page (CDN link).

    The public API ``tsv_url`` sometimes 500s while the CDN object still works.
    """
    request = Request(
        EXPORT_RESULTS_PAGE_URL,
        headers={"Accept": "text/html", "User-Agent": USER_AGENT},
    )
    try:
        with opener(request, timeout=30) as response:
            html = response.read().decode("utf-8", "replace")
    except (HTTPError, URLError, TimeoutError, OSError, UnicodeError, AttributeError):
        return None

    links = re.findall(r"https://exports\.worldcubeassociation\.org/results/[^\"'\s>]+\.tsv\.zip", html)
    if not links:
        links = re.findall(r"https://[^\s\"']+\.tsv\.zip", html)
    if not links:
        return None

    token = _export_date_token(export_date)
    for link in links:
        if token and token in link:
            return link
    return links[0]


def resolve_tsv_archive_url(preferred: str, export_date: str, opener: Opener = urlopen) -> str:
    """Resolve a downloadable HTTPS ZIP URL for the official TSV export.

    Order:
    1. Prefer an already-direct ``*.zip`` URL (tests and pre-resolved CDN links).
    2. Probe the API ``tsv_url`` (follows redirects to CDN when healthy).
    3. Scrape the export results page for the CDN ``.tsv.zip`` link.
    """
    if not isinstance(preferred, str) or not preferred.startswith("https://"):
        raise MetadataError("invalid WCA export archive URL")

    if _looks_like_direct_zip_url(preferred):
        return preferred

    probed = _probe_archive_url(preferred, opener)
    if probed and probed.startswith("https://"):
        return probed

    scraped = _scrape_tsv_zip_url(export_date, opener)
    if scraped and scraped.startswith("https://"):
        return scraped

    raise MetadataError("could not resolve a downloadable WCA TSV archive URL")


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
    request = Request(url, headers={"Accept": "application/json", "User-Agent": USER_AGENT})
    try:
        with opener(request, timeout=30) as response:
            payload = json.load(response)
        if not isinstance(payload, dict):
            raise TypeError("metadata response is not an object")
        export_format_version = extract_export_format_version(payload)
        export_date = payload["export_date"]
        preferred_tsv = payload["tsv_url"]
        if not all(isinstance(value, str) for value in (export_date, export_format_version, preferred_tsv)):
            raise TypeError("metadata fields must be strings")
        tsv_url = resolve_tsv_archive_url(preferred_tsv, export_date, opener=opener)
        metadata = ExportMetadata(
            export_date=export_date,
            export_format_version=export_format_version,
            tsv_url=tsv_url,
        )
        return validate_metadata(metadata)
    except MetadataError:
        raise
    except (KeyError, TypeError, ValueError, OSError) as error:
        raise MetadataError("invalid WCA export metadata") from error
