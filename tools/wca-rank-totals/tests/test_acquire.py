from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from io import BytesIO
import os
from pathlib import Path
import tempfile
from threading import Thread
import unittest
from unittest.mock import patch
import zipfile
import zlib

from wca_rank_totals.acquire import (
    HTTPRangeReader,
    REQUIRED_MEMBERS,
    RangeUnsupported,
    _promote_members,
    materialize_required_members,
)


FIXTURES = Path(__file__).parent / "fixtures"
FIXTURE_NAMES = {
    "WCA_export_countries.tsv": "countries.tsv",
    "WCA_export_persons.tsv": "persons.tsv",
    "WCA_export_ranks_single.tsv": "ranks_single.tsv",
    "WCA_export_ranks_average.tsv": "ranks_average.tsv",
}


def archive_bytes(*, omit: str | None = None, duplicate: str | None = None) -> bytes:
    output = BytesIO()
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        for member, fixture in FIXTURE_NAMES.items():
            if member != omit:
                archive.writestr(member, (FIXTURES / fixture).read_bytes())
                if member == duplicate:
                    with unittest.mock.patch("warnings.warn"):
                        archive.writestr(member, (FIXTURES / fixture).read_bytes())
    return output.getvalue()


def handler_for(payload: bytes, supports_range: bool):
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:
            requested = self.headers.get("Range")
            if supports_range and requested:
                _, interval = requested.split("=", maxsplit=1)
                start_text, end_text = interval.split("-", maxsplit=1)
                start, end = int(start_text), min(int(end_text), len(payload) - 1)
                body = payload[start : end + 1]
                self.send_response(206)
                self.send_header("Content-Range", f"bytes {start}-{end}/{len(payload)}")
            else:
                body = payload
                self.send_response(200)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, format: str, *args: object) -> None:
            return

    return Handler


class Server:
    def __init__(self, payload: bytes, supports_range: bool) -> None:
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), handler_for(payload, supports_range))
        self.thread = Thread(target=self.server.serve_forever, daemon=True)

    def __enter__(self) -> str:
        self.thread.start()
        return f"http://127.0.0.1:{self.server.server_port}/export.zip"

    def __exit__(self, *args: object) -> None:
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()


class AcquireTest(unittest.TestCase):
    def test_range_mode_materializes_exact_members(self) -> None:
        with Server(archive_bytes(), True) as url, tempfile.TemporaryDirectory() as directory:
            result = materialize_required_members(url, Path(directory) / "members")
            self.assertEqual("range", result.mode)
            self.assertGreater(result.bytes_received, 0)
            self.assertEqual(set(REQUIRED_MEMBERS), set(result.members))
            self.assertTrue(all(path.stat().st_size > 0 for path in result.members.values()))

    def test_full_fallback_materializes_exact_members(self) -> None:
        payload = archive_bytes()
        with Server(payload, False) as url, tempfile.TemporaryDirectory() as directory:
            result = materialize_required_members(url, Path(directory) / "members")
            self.assertEqual("full", result.mode)
            self.assertGreaterEqual(result.bytes_received, len(payload))

    def test_missing_member_fails_without_touching_destination(self) -> None:
        with Server(archive_bytes(omit=REQUIRED_MEMBERS[-1]), False) as url, tempfile.TemporaryDirectory() as directory:
            destination = Path(directory) / "members"
            destination.mkdir()
            sentinel = destination / REQUIRED_MEMBERS[0]
            sentinel.write_text("old", encoding="utf-8")
            with self.assertRaises(zipfile.BadZipFile):
                materialize_required_members(url, destination)
            self.assertEqual("old", sentinel.read_text(encoding="utf-8"))

    def test_zlib_range_failure_falls_back_to_full(self) -> None:
        payload = archive_bytes()
        with Server(payload, False) as url, tempfile.TemporaryDirectory() as directory:
            with patch("wca_rank_totals.acquire._range_attempt", side_effect=zlib.error("bad stream")):
                result = materialize_required_members(url, Path(directory) / "members")
            self.assertEqual("full", result.mode)

    def test_eof_range_failure_falls_back_to_full(self) -> None:
        payload = archive_bytes()
        with Server(payload, False) as url, tempfile.TemporaryDirectory() as directory:
            with patch("wca_rank_totals.acquire._range_attempt", side_effect=EOFError("truncated")):
                result = materialize_required_members(url, Path(directory) / "members")
            self.assertEqual("full", result.mode)

    def test_range_probe_is_not_cached_as_full_block(self) -> None:
        payload = archive_bytes()
        with Server(payload, True) as url:
            reader = HTTPRangeReader(url, block_size=64)
            self.assertEqual(b"PK\x03\x04", reader.read(4))

    def test_negative_seek_fails(self) -> None:
        payload = archive_bytes()
        with Server(payload, True) as url:
            reader = HTTPRangeReader(url)
            with self.assertRaisesRegex(ValueError, "negative"):
                reader.seek(-1)

    def test_promotion_rolls_back_all_members_on_failure(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            destination = root / "destination"
            staging = root / "staging"
            destination.mkdir()
            staging.mkdir()
            staged = {}
            for name in REQUIRED_MEMBERS:
                (destination / name).write_text(f"old-{name}", encoding="utf-8")
                staged[name] = staging / name
                staged[name].write_text(f"new-{name}", encoding="utf-8")
            real_replace = os.replace
            promotion_count = 0

            def flaky_replace(source, target):
                nonlocal promotion_count
                if Path(source).parent == staging:
                    promotion_count += 1
                    if promotion_count == 2:
                        raise OSError("disk failure")
                return real_replace(source, target)

            with patch("wca_rank_totals.acquire.os.replace", side_effect=flaky_replace):
                with self.assertRaisesRegex(OSError, "disk failure"):
                    _promote_members(staged, destination)
            for name in REQUIRED_MEMBERS:
                self.assertEqual(f"old-{name}", (destination / name).read_text(encoding="utf-8"))

    def test_value_error_in_selective_reader_falls_back(self) -> None:
        payload = archive_bytes()
        with Server(payload, False) as url, tempfile.TemporaryDirectory() as directory:
            with patch("wca_rank_totals.acquire._range_attempt", side_effect=ValueError("unsupported layout")):
                result = materialize_required_members(url, Path(directory) / "members")
            self.assertEqual("full", result.mode)

    def test_successful_promotion_replaces_every_member(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            destination = root / "destination"
            staging = root / "staging"
            destination.mkdir()
            staging.mkdir()
            staged = {}
            for name in REQUIRED_MEMBERS:
                (destination / name).write_text("old", encoding="utf-8")
                staged[name] = staging / name
                staged[name].write_text("new", encoding="utf-8")
            promoted = _promote_members(staged, destination)
            self.assertTrue(all(path.read_text(encoding="utf-8") == "new" for path in promoted.values()))


if __name__ == "__main__":
    unittest.main()
