from io import BytesIO
import unittest

from wca_rank_totals.metadata import MetadataError, fetch_metadata, validate_metadata
from wca_rank_totals.model import ExportMetadata


class MetadataTest(unittest.TestCase):
    def response(self, text: str):
        return BytesIO(text.encode())

    def test_accepts_official_v2_shape(self) -> None:
        response = self.response(
            '{"export_date":"2026-07-17T03:24:49+00:00","export_format_version":"2.0.2",'
            '"tsv_url":"https://example.test/export.zip"}'
        )
        metadata = fetch_metadata(opener=lambda request, timeout: response)
        self.assertEqual(2, metadata.major_version)

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
