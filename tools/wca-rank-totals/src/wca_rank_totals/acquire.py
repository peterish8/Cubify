from __future__ import annotations

from collections import OrderedDict
import io
import os
from pathlib import Path
import re
import shutil
import struct
import tempfile
from urllib.error import HTTPError
from urllib.request import Request, urlopen
import zipfile
import zlib

from .model import AcquisitionResult


REQUIRED_MEMBERS = (
    "WCA_export_countries.tsv",
    "WCA_export_persons.tsv",
    "WCA_export_ranks_single.tsv",
    "WCA_export_ranks_average.tsv",
)

USER_AGENT = "Cubify-wca-rank-totals/0.1"


class RangeUnsupported(OSError):
    """The server or archive cannot safely support selective range access."""


class HTTPRangeReader(io.RawIOBase):
    def __init__(
        self,
        url: str,
        block_size: int = 1024 * 1024,
        max_blocks: int = 8,
        opener=urlopen,
    ) -> None:
        if block_size <= 0 or max_blocks <= 0:
            raise ValueError("block_size and max_blocks must be positive")
        self.url = url
        self.block_size = block_size
        self.max_blocks = max_blocks
        self._opener = opener
        self.position = 0
        self.bytes_received = 0
        self._cache: OrderedDict[int, bytes] = OrderedDict()
        # This one-byte feature probe is intentionally not cached as a full block.
        _, self._size = self._fetch(0, 0)
        if self._size <= 0:
            raise RangeUnsupported("empty remote archive")

    def _fetch(self, start: int, end: int) -> tuple[bytes, int]:
        request = Request(
            self.url,
            headers={"Range": f"bytes={start}-{end}", "Accept-Encoding": "identity", "User-Agent": USER_AGENT},
        )
        try:
            response = self._opener(request, timeout=60)
        except HTTPError as error:
            error.close()
            raise RangeUnsupported(f"range request failed with HTTP {error.code}") from error
        try:
            with response:
                status = getattr(response, "status", response.getcode())
                if status != 206:
                    raise RangeUnsupported("server did not honor byte ranges")
                content_range = response.headers.get("Content-Range", "")
                match = re.fullmatch(r"bytes (\d+)-(\d+)/(\d+)", content_range)
                if match is None:
                    raise RangeUnsupported("invalid Content-Range response")
                actual_start, actual_end, total = map(int, match.groups())
                if actual_start != start or actual_end != end or actual_end >= total:
                    raise RangeUnsupported("unexpected Content-Range interval")
                body = response.read()
        except HTTPError as error:
            error.close()
            raise RangeUnsupported(f"range response failed with HTTP {error.code}") from error
        expected = end - start + 1
        if len(body) != expected:
            raise RangeUnsupported("truncated range response")
        self.bytes_received += len(body)
        return body, total

    def _block(self, index: int) -> bytes:
        cached = self._cache.get(index)
        if cached is not None:
            self._cache.move_to_end(index)
            return cached
        start = index * self.block_size
        if start >= self._size:
            return b""
        end = min(self._size - 1, start + self.block_size - 1)
        block, total = self._fetch(start, end)
        if total != self._size:
            raise RangeUnsupported("remote archive size changed during acquisition")
        self._cache[index] = block
        self._cache.move_to_end(index)
        while len(self._cache) > self.max_blocks:
            self._cache.popitem(last=False)
        return block

    def readable(self) -> bool:
        return True

    def seekable(self) -> bool:
        return True

    def tell(self) -> int:
        return self.position

    def seek(self, offset: int, whence: int = io.SEEK_SET) -> int:
        if whence == io.SEEK_SET:
            position = offset
        elif whence == io.SEEK_CUR:
            position = self.position + offset
        elif whence == io.SEEK_END:
            position = self._size + offset
        else:
            raise ValueError("invalid whence")
        if position < 0:
            raise ValueError("negative seek position")
        self.position = position
        return position

    def read(self, size: int = -1) -> bytes:
        if self.position >= self._size or size == 0:
            return b""
        if size < 0:
            size = self._size - self.position
        remaining = min(size, self._size - self.position)
        chunks: list[bytes] = []
        while remaining:
            index, within = divmod(self.position, self.block_size)
            block = self._block(index)
            available = len(block) - within
            if available <= 0:
                raise RangeUnsupported("range reader made no progress")
            take = min(remaining, available)
            chunks.append(block[within : within + take])
            self.position += take
            remaining -= take
        return b"".join(chunks)


def _copy_members(archive: zipfile.ZipFile, staging: Path) -> dict[str, Path]:
    infos: dict[str, list[zipfile.ZipInfo]] = {name: [] for name in REQUIRED_MEMBERS}
    for info in archive.infolist():
        if info.filename in infos:
            infos[info.filename].append(info)
    missing = [name for name, matches in infos.items() if not matches]
    duplicates = [name for name, matches in infos.items() if len(matches) > 1]
    if missing:
        raise zipfile.BadZipFile(f"missing required members: {', '.join(missing)}")
    if duplicates:
        raise zipfile.BadZipFile(f"duplicate required members: {', '.join(duplicates)}")
    staging.mkdir(parents=True, exist_ok=True)
    paths: dict[str, Path] = {}
    for name in REQUIRED_MEMBERS:
        info = infos[name][0]
        if info.is_dir() or info.flag_bits & 0x1:
            raise zipfile.BadZipFile(f"unsupported required member: {name}")
        target = staging / name
        with archive.open(info, "r") as source, target.open("wb") as output:
            shutil.copyfileobj(source, output, length=1024 * 1024)
        if target.stat().st_size != info.file_size:
            raise zipfile.BadZipFile(f"truncated required member: {name}")
        paths[name] = target
    return paths


def _promote_members(staged: dict[str, Path], destination: Path) -> dict[str, Path]:
    """Replace all four destinations as one recoverable transaction."""
    destination.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=".wca-backup-", dir=destination.parent) as backup_text:
        backup = Path(backup_text)
        moved_old: list[str] = []
        promoted: list[str] = []
        try:
            for name in REQUIRED_MEMBERS:
                target = destination / name
                if target.exists():
                    os.replace(target, backup / name)
                    moved_old.append(name)
            for name in REQUIRED_MEMBERS:
                os.replace(staged[name], destination / name)
                promoted.append(name)
        except BaseException:
            for name in reversed(promoted):
                (destination / name).unlink(missing_ok=True)
            for name in moved_old:
                old = backup / name
                if old.exists():
                    os.replace(old, destination / name)
            raise
    return {name: destination / name for name in REQUIRED_MEMBERS}


def _range_attempt(url: str, staging: Path) -> tuple[dict[str, Path], int]:
    remote = HTTPRangeReader(url)
    try:
        with zipfile.ZipFile(remote) as archive:
            members = _copy_members(archive, staging)
    except BaseException as error:
        setattr(error, "range_bytes_received", remote.bytes_received)
        raise
    return members, remote.bytes_received


def _full_attempt(url: str, staging: Path) -> tuple[dict[str, Path], int]:
    archive_path = staging / "download.zip"
    request = Request(url, headers={"Accept-Encoding": "identity", "User-Agent": USER_AGENT})
    response = None
    try:
        response = urlopen(request, timeout=300)
        with response, archive_path.open("wb") as output:
            shutil.copyfileobj(response, output, length=1024 * 1024)
        bytes_received = archive_path.stat().st_size
        with zipfile.ZipFile(archive_path) as archive:
            members = _copy_members(archive, staging / "members")
        return members, bytes_received
    except HTTPError as error:
        error.close()
        raise
    finally:
        archive_path.unlink(missing_ok=True)


_RANGE_FALLBACK_ERRORS = (
    RangeUnsupported,
    zipfile.BadZipFile,
    OSError,
    EOFError,
    zlib.error,
    RuntimeError,
    ValueError,
    struct.error,
)


def materialize_required_members(url: str, destination: Path) -> AcquisitionResult:
    destination_parent = destination.parent
    destination_parent.mkdir(parents=True, exist_ok=True)
    range_bytes = 0
    with tempfile.TemporaryDirectory(prefix=".wca-range-", dir=destination_parent) as attempt_text:
        attempt = Path(attempt_text)
        try:
            staged, range_bytes = _range_attempt(url, attempt)
        except _RANGE_FALLBACK_ERRORS as error:
            range_bytes = int(getattr(error, "range_bytes_received", 0))
        else:
            members = _promote_members(staged, destination)
            return AcquisitionResult("range", range_bytes, members)

    with tempfile.TemporaryDirectory(prefix=".wca-full-", dir=destination_parent) as attempt_text:
        staged, full_bytes = _full_attempt(url, Path(attempt_text))
        members = _promote_members(staged, destination)
    return AcquisitionResult("full", range_bytes + full_bytes, members)
