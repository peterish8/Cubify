import json
from pathlib import Path
import tempfile
import unittest

from wca_rank_totals.document import build_document, load_document, serialize_document, validate_document, write_atomic
from wca_rank_totals.model import ExportMetadata, RankBucket


METADATA = ExportMetadata("2026-07-17T03:24:49+00:00", "2.0.2", "https://example.test/export.zip")


class DocumentTest(unittest.TestCase):
    def valid(self):
        return build_document(METADATA, {"333": {"single": RankBucket(2, {"_Asia": 2}, {"IN": 2})}})

    def test_serialization_is_sorted_deterministic_and_has_no_build_time(self) -> None:
        totals = {
            "333": {"single": RankBucket(2, {"_North America": 1, "_Asia": 1}, {"US": 1, "IN": 1})},
            "222": {"average": RankBucket(1, {"_Asia": 1}, {"IN": 1})},
        }
        first = serialize_document(build_document(METADATA, totals))
        second = serialize_document(build_document(METADATA, totals))
        self.assertEqual(first, second)
        self.assertTrue(first.endswith("\n"))
        self.assertNotIn("buildTime", first)
        self.assertLess(first.index('"222"'), first.index('"333"'))
        self.assertLess(first.index('"_Asia"'), first.index('"_North America"'))

    def test_reconciliation_rejects_country_sum(self) -> None:
        with self.assertRaisesRegex(ValueError, "country total"):
            build_document(METADATA, {"333": {"single": RankBucket(2, {"_Asia": 2}, {"IN": 1})}})

    def test_reconciliation_rejects_continent_sum(self) -> None:
        with self.assertRaisesRegex(ValueError, "continent total"):
            build_document(METADATA, {"333": {"single": RankBucket(2, {"_Asia": 1}, {"IN": 2})}})

    def test_schema_rejects_boolean_counts(self) -> None:
        document = self.valid()
        document["events"]["333"]["single"]["world"] = True
        with self.assertRaisesRegex(ValueError, "world total"):
            validate_document(document)

    def test_schema_rejects_unknown_keys(self) -> None:
        document = self.valid()
        document["generatedAt"] = "now"
        with self.assertRaisesRegex(ValueError, "shape"):
            validate_document(document)

    def test_atomic_write_replaces_target(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "rank-totals.json"
            path.write_text("old", encoding="utf-8")
            write_atomic(path, "new\n")
            self.assertEqual("new\n", path.read_text(encoding="utf-8"))

    def test_load_document_runs_strict_validation(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "rank-totals.json"
            path.write_text(json.dumps(self.valid()), encoding="utf-8")
            self.assertEqual(1, load_document(path)["schemaVersion"])
            path.write_text("{}", encoding="utf-8")
            with self.assertRaises(ValueError):
                load_document(path)

    def test_empty_events_are_rejected(self) -> None:
        with self.assertRaisesRegex(ValueError, "events"):
            build_document(METADATA, {})

    def test_zero_regional_count_is_rejected(self) -> None:
        document = self.valid()
        document["events"]["333"]["single"]["countries"]["IN"] = 0
        with self.assertRaisesRegex(ValueError, "countries entry"):
            validate_document(document)

    def test_country_keys_must_be_uppercase_iso2(self) -> None:
        document = self.valid()
        document["events"]["333"]["single"]["countries"] = {"in": 2}
        with self.assertRaisesRegex(ValueError, "country key"):
            validate_document(document)


if __name__ == "__main__":
    unittest.main()
