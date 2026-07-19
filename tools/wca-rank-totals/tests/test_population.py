import copy
from pathlib import Path
import unittest

from wca_rank_totals.model import ExportMetadata
from wca_rank_totals.parse import load_countries, load_country_names, load_current_people
from wca_rank_totals.population import (
    build_population_document,
    serialize_population_document,
    validate_population_document,
)


FIXTURES = Path(__file__).parent / "fixtures"
METADATA = ExportMetadata(
    export_date="2026-07-17T03:24:49+00:00",
    export_format_version="2.0.2",
    tsv_url="https://example.test/export.zip",
)


def _document() -> dict:
    countries = load_countries(FIXTURES / "countries.tsv")
    names = load_country_names(FIXTURES / "countries.tsv")
    people = load_current_people(FIXTURES / "persons.tsv", countries)
    return build_population_document(METADATA, people, names)


class PopulationTest(unittest.TestCase):
    def test_counts_current_people_per_country(self) -> None:
        document = _document()
        # Fixture current people (sub_id=1): 3 in India, 1 in the United States.
        self.assertEqual(document["totalCubers"], 4)
        by_iso2 = {entry["iso2"]: entry for entry in document["countries"]}
        self.assertEqual(by_iso2["IN"]["cubers"], 3)
        self.assertEqual(by_iso2["US"]["cubers"], 1)
        self.assertEqual(by_iso2["IN"]["name"], "India")
        self.assertEqual(by_iso2["IN"]["continentId"], "_Asia")

    def test_sorted_descending_by_cubers(self) -> None:
        document = _document()
        counts = [entry["cubers"] for entry in document["countries"]]
        self.assertEqual(counts, sorted(counts, reverse=True))
        self.assertEqual(document["countries"][0]["iso2"], "IN")

    def test_serialize_roundtrips(self) -> None:
        document = _document()
        encoded = serialize_population_document(document)
        self.assertTrue(encoded.endswith("\n"))
        self.assertEqual(serialize_population_document(document), encoded)

    def test_rejects_unsorted_countries(self) -> None:
        document = _document()
        document["countries"].reverse()  # now ascending -> invalid
        with self.assertRaisesRegex(ValueError, "sorted"):
            validate_population_document(document)

    def test_rejects_unreconciled_total(self) -> None:
        document = _document()
        document["totalCubers"] += 1
        with self.assertRaisesRegex(ValueError, "reconcile"):
            validate_population_document(document)

    def test_rejects_invalid_country_iso2(self) -> None:
        document = _document()
        document["countries"][0]["iso2"] = "IND"
        with self.assertRaisesRegex(ValueError, "iso2"):
            validate_population_document(document)

    def test_rejects_zero_cubers(self) -> None:
        document = _document()
        broken = copy.deepcopy(document)
        broken["countries"][0]["cubers"] = 0
        with self.assertRaises(ValueError):
            validate_population_document(broken)


if __name__ == "__main__":
    unittest.main()
