from pathlib import Path
import tempfile
import unittest

from wca_rank_totals.parse import CountingError, count_ranks, load_countries, load_current_people


FIXTURES = Path(__file__).parent / "fixtures"


class ParseTest(unittest.TestCase):
    def people(self):
        return load_current_people(FIXTURES / "persons.tsv", load_countries(FIXTURES / "countries.tsv"))

    def temporary_tsv(self, content: str):
        directory = tempfile.TemporaryDirectory()
        path = Path(directory.name) / "input.tsv"
        path.write_text(content, encoding="utf-8")
        self.addCleanup(directory.cleanup)
        return path

    def test_counts_current_people_without_multiplying_history_or_ties(self) -> None:
        people = self.people()
        totals = {}
        count_ranks(FIXTURES / "ranks_single.tsv", "single", people, totals)
        count_ranks(FIXTURES / "ranks_average.tsv", "average", people, totals)
        self.assertEqual(4, len(people))
        self.assertEqual(3, totals["333"]["single"].world)
        self.assertEqual(2, totals["333"]["average"].world)
        self.assertEqual({"IN": 2, "US": 1}, totals["333"]["single"].countries)

    def test_duplicate_rank_fails(self) -> None:
        path = self.temporary_tsv(
            "person_id\tevent_id\tworld_rank\tcontinent_rank\tcountry_rank\n"
            "2020TEST01\t333\t1\t1\t1\n2020TEST01\t333\t1\t1\t1\n"
        )
        with self.assertRaisesRegex(CountingError, "duplicate rank row"):
            count_ranks(path, "single", self.people(), {})

    def test_non_positive_rank_fails_closed(self) -> None:
        for value in ("0", "-1"):
            with self.subTest(value=value):
                path = self.temporary_tsv(
                    "person_id\tevent_id\tworld_rank\tcontinent_rank\tcountry_rank\n"
                    f"2020TEST01\t333\t{value}\t1\t1\n"
                )
                with self.assertRaisesRegex(CountingError, "non-positive rank"):
                    count_ranks(path, "single", self.people(), {})

    def test_invalid_numeric_rank_is_counting_error(self) -> None:
        path = self.temporary_tsv(
            "person_id\tevent_id\tworld_rank\tcontinent_rank\tcountry_rank\n"
            "2020TEST01\t333\tnope\t1\t1\n"
        )
        with self.assertRaisesRegex(CountingError, "invalid rank"):
            count_ranks(path, "single", self.people(), {})

    def test_missing_current_person_fails(self) -> None:
        path = self.temporary_tsv(
            "person_id\tevent_id\tworld_rank\tcontinent_rank\tcountry_rank\n"
            "2099NONE01\t333\t1\t1\t1\n"
        )
        with self.assertRaisesRegex(CountingError, "missing current person"):
            count_ranks(path, "single", self.people(), {})

    def test_duplicate_current_person_fails(self) -> None:
        path = self.temporary_tsv(
            "wca_id\tsub_id\tcountry_id\n2020TEST01\t1\tIndia\n2020TEST01\t1\tIndia\n"
        )
        with self.assertRaisesRegex(CountingError, "duplicate current person"):
            load_current_people(path, load_countries(FIXTURES / "countries.tsv"))

    def test_unknown_country_fails(self) -> None:
        path = self.temporary_tsv("wca_id\tsub_id\tcountry_id\n2020TEST01\t1\tAtlantis\n")
        with self.assertRaisesRegex(CountingError, "unknown country"):
            load_current_people(path, load_countries(FIXTURES / "countries.tsv"))

    def test_missing_header_fails(self) -> None:
        path = self.temporary_tsv("person_id\tevent_id\n2020TEST01\t333\n")
        with self.assertRaisesRegex(CountingError, "missing TSV columns"):
            count_ranks(path, "single", self.people(), {})

    def test_unsupported_rank_type_fails(self) -> None:
        with self.assertRaisesRegex(CountingError, "unsupported rank type"):
            count_ranks(FIXTURES / "ranks_single.tsv", "median", self.people(), {})

    def test_duplicate_country_id_fails(self) -> None:
        path = self.temporary_tsv("id\tcontinent_id\tiso2\nIndia\t_Asia\tIN\nIndia\t_Asia\tIX\n")
        with self.assertRaisesRegex(CountingError, "duplicate country id"):
            load_countries(path)

    def test_duplicate_country_iso_fails(self) -> None:
        path = self.temporary_tsv("id\tcontinent_id\tiso2\nIndia\t_Asia\tIN\nOther\t_Asia\tIN\n")
        with self.assertRaisesRegex(CountingError, "duplicate country ISO2"):
            load_countries(path)

    def test_invalid_person_sub_id_fails(self) -> None:
        path = self.temporary_tsv("wca_id\tsub_id\tcountry_id\n2020TEST01\tnot-a-number\tIndia\n")
        with self.assertRaisesRegex(CountingError, "invalid person sub_id"):
            load_current_people(path, load_countries(FIXTURES / "countries.tsv"))

    def test_extra_tsv_fields_fail(self) -> None:
        path = self.temporary_tsv(
            "person_id\tevent_id\tworld_rank\tcontinent_rank\tcountry_rank\n"
            "2020TEST01\t333\t1\t1\t1\textra\n"
        )
        with self.assertRaisesRegex(CountingError, "extra TSV fields"):
            count_ranks(path, "single", self.people(), {})


if __name__ == "__main__":
    unittest.main()
