import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from wca_rank_totals.acquire import REQUIRED_MEMBERS
from wca_rank_totals.cli import generate
from wca_rank_totals.document import build_document, serialize_document
from wca_rank_totals.model import AcquisitionResult, ExportMetadata, RankBucket


FIXTURES = Path(__file__).parent / "fixtures"
METADATA = ExportMetadata("2026-07-17T03:24:49+00:00", "2.0.2", "https://example.test/export.zip")


def fixture_acquisition() -> AcquisitionResult:
    return AcquisitionResult(
        "range",
        1234,
        {
            REQUIRED_MEMBERS[0]: FIXTURES / "countries.tsv",
            REQUIRED_MEMBERS[1]: FIXTURES / "persons.tsv",
            REQUIRED_MEMBERS[2]: FIXTURES / "ranks_single.tsv",
            REQUIRED_MEMBERS[3]: FIXTURES / "ranks_average.tsv",
        },
    )


class CliTest(unittest.TestCase):
    def test_matching_valid_export_skips_archive(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            output = root / "rank-totals.json"
            content = serialize_document(
                build_document(METADATA, {"333": {"single": RankBucket(1, {"_Asia": 1}, {"IN": 1})}})
            )
            output.write_text(content, encoding="utf-8")
            with patch("wca_rank_totals.cli.materialize_required_members") as acquire:
                self.assertEqual(0, generate(output, root / "work", METADATA))
                acquire.assert_not_called()

    def test_corrupt_matching_export_is_regenerated(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            output = root / "rank-totals.json"
            output.write_text(json.dumps({"source": {"exportDate": METADATA.export_date}}), encoding="utf-8")
            with patch("wca_rank_totals.cli.materialize_required_members", return_value=fixture_acquisition()) as acquire:
                generate(output, root / "work", METADATA)
            acquire.assert_called_once()
            self.assertEqual(3, json.loads(output.read_text())["events"]["333"]["single"]["world"])

    def test_same_date_but_different_archive_is_regenerated(self) -> None:
        old = ExportMetadata(METADATA.export_date, METADATA.export_format_version, "https://example.test/old.zip")
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            output = root / "rank-totals.json"
            output.write_text(
                serialize_document(build_document(old, {"333": {"single": RankBucket(1, {"_Asia": 1}, {"IN": 1})}})),
                encoding="utf-8",
            )
            with patch("wca_rank_totals.cli.materialize_required_members", return_value=fixture_acquisition()) as acquire:
                generate(output, root / "work", METADATA)
            acquire.assert_called_once()

    def test_generation_publishes_fixture_totals(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            output = root / "rank-totals.json"
            with patch("wca_rank_totals.cli.materialize_required_members", return_value=fixture_acquisition()):
                self.assertEqual(0, generate(output, root / "work", METADATA))
            document = json.loads(output.read_text(encoding="utf-8"))
            self.assertEqual(3, document["events"]["333"]["single"]["world"])
            self.assertEqual(2, document["events"]["333"]["average"]["world"])

    def test_failure_preserves_last_known_good_output(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            output = root / "rank-totals.json"
            output.write_text("last-known-good", encoding="utf-8")
            with patch("wca_rank_totals.cli.materialize_required_members", side_effect=OSError("network")):
                with self.assertRaisesRegex(OSError, "network"):
                    generate(output, root / "work", METADATA)
            self.assertEqual("last-known-good", output.read_text(encoding="utf-8"))

    def test_same_input_produces_identical_bytes(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            outputs = [root / "one.json", root / "two.json"]
            with patch("wca_rank_totals.cli.materialize_required_members", return_value=fixture_acquisition()):
                for output in outputs:
                    generate(output, root / "work", METADATA)
            self.assertEqual(outputs[0].read_bytes(), outputs[1].read_bytes())

    def test_invalid_supplied_metadata_blocks_before_acquisition(self) -> None:
        invalid = ExportMetadata(METADATA.export_date, "3.0.0", METADATA.tsv_url)
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with patch("wca_rank_totals.cli.materialize_required_members") as acquire:
                with self.assertRaisesRegex(ValueError, "unsupported export format"):
                    generate(root / "output.json", root / "work", invalid)
                acquire.assert_not_called()


if __name__ == "__main__":
    unittest.main()
