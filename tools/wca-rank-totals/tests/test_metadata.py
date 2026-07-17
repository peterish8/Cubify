from io import BytesIO
import unittest
from urllib.error import HTTPError
from urllib.request import Request

from wca_rank_totals.metadata import (
    MetadataError,
    extract_export_format_version,
    fetch_metadata,
    normalize_export_format_version,
    resolve_tsv_archive_url,
    validate_metadata,
)
from wca_rank_totals.model import ExportMetadata


class MetadataTest(unittest.TestCase):
    def response(self, text: str):
        return BytesIO(text.encode())

    def test_accepts_official_v2_shape(self) -> None:
        # Direct .zip URLs are accepted without probing (tests + pre-resolved CDN links).
        response = self.response(
            '{"export_date":"2026-07-17T03:24:49+00:00","export_format_version":"2.0.2",'
            '"tsv_url":"https://example.test/export.zip"}'
        )
        metadata = fetch_metadata(opener=lambda request, timeout: response)
        self.assertEqual(2, metadata.major_version)
        self.assertEqual("2.0.2", metadata.export_format_version)
        self.assertEqual("https://example.test/export.zip", metadata.tsv_url)

    def test_accepts_live_public_api_shape_with_cdn_fallback(self) -> None:
        """API uses export_version + proxy tsv_url; resolve CDN ZIP when the proxy 500s."""
        api_body = (
            '{"export_date":"2026-07-17T00:00:43Z","export_version":"v2.0.2",'
            '"sql_url":"https://www.worldcubeassociation.org/export/results/v2/sql",'
            '"tsv_url":"https://www.worldcubeassociation.org/export/results/v2/tsv",'
            '"tsv_filesize_bytes":366886026}'
        )
        page_html = (
            '<a href="https://exports.worldcubeassociation.org/results/'
            'WCA_export_v2_198_20260717T000043Z.tsv.zip">TSV</a>'
        )
        cdn = (
            "https://exports.worldcubeassociation.org/results/"
            "WCA_export_v2_198_20260717T000043Z.tsv.zip"
        )

        def opener(request: Request, timeout: int):
            url = request.full_url
            if url.endswith("/export/public") or "export/public" in url:
                return self.response(api_body)
            if url.endswith("/v2/tsv"):
                raise HTTPError(url, 500, "Internal Server Error", hdrs=None, fp=BytesIO())
            if "export/results" in url:
                return self.response(page_html)
            raise AssertionError(f"unexpected URL {url}")

        metadata = fetch_metadata(
            url="https://www.worldcubeassociation.org/api/v0/export/public",
            opener=opener,
        )
        self.assertEqual("2.0.2", metadata.export_format_version)
        self.assertEqual(2, metadata.major_version)
        self.assertEqual("2026-07-17T00:00:43Z", metadata.export_date)
        self.assertEqual(cdn, metadata.tsv_url)

    def test_resolve_prefers_direct_zip_url(self) -> None:
        url = "https://exports.example.test/WCA_export.tsv.zip"
        self.assertEqual(url, resolve_tsv_archive_url(url, "2026-07-17T00:00:43Z"))

    def test_normalize_strips_leading_v(self) -> None:
        self.assertEqual("2.0.2", normalize_export_format_version("v2.0.2"))
        self.assertEqual("2.0.2", normalize_export_format_version("2.0.2"))
        self.assertEqual("2.0.2", normalize_export_format_version("V2.0.2"))

    def test_extract_prefers_export_format_version(self) -> None:
        self.assertEqual(
            "2.0.2",
            extract_export_format_version({"export_format_version": "2.0.2", "export_version": "v9.9.9"}),
        )

    def test_rejects_unsupported_major(self) -> None:
        metadata = ExportMetadata("2026-07-17T03:24:49+00:00", "3.0.0", "https://example.test/export.zip")
        with self.assertRaisesRegex(MetadataError, "unsupported export format"):
            validate_metadata(metadata)

    def test_rejects_naive_export_date(self) -> None:
        metadata = ExportMetadata("2026-07-17T03:24:49", "2.0.2", "https://example.test/export.zip")
        with self.assertRaisesRegex(MetadataError, "invalid"):
            validate_metadata(metadata)

    def test_rejects_non_https_archive(self) -> None:
        metadata = ExportMetadata("2026-07-17T03:24:49+00:00", "2.0.2", "http://example.test/export.zip")
        with self.assertRaisesRegex(MetadataError, "invalid"):
            validate_metadata(metadata)

    def test_rejects_missing_field(self) -> None:
        response = self.response('{"export_date":"2026-07-17T03:24:49+00:00"}')
        with self.assertRaisesRegex(MetadataError, "invalid WCA export metadata"):
            fetch_metadata(opener=lambda request, timeout: response)

    def test_rejects_non_string_field(self) -> None:
        response = self.response(
            '{"export_date":"2026-07-17T03:24:49+00:00","export_format_version":2,'
            '"tsv_url":"https://example.test/export.zip"}'
        )
        with self.assertRaisesRegex(MetadataError, "invalid WCA export metadata"):
            fetch_metadata(opener=lambda request, timeout: response)

    def test_rejects_invalid_json(self) -> None:
        with self.assertRaisesRegex(MetadataError, "invalid WCA export metadata"):
            fetch_metadata(opener=lambda request, timeout: self.response("not-json"))


if __name__ == "__main__":
    unittest.main()
