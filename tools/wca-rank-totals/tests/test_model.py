import unittest

from wca_rank_totals.model import ExportMetadata, RankBucket, Region


class ModelTest(unittest.TestCase):
    def test_rank_bucket_increments_all_scopes(self) -> None:
        bucket = RankBucket()
        bucket.add(Region(iso2="IN", continent_id="_Asia"))
        self.assertEqual(1, bucket.world)
        self.assertEqual({"_Asia": 1}, bucket.continents)
        self.assertEqual({"IN": 1}, bucket.countries)

    def test_export_metadata_exposes_major_version(self) -> None:
        metadata = ExportMetadata("2026-07-17T03:24:49+00:00", "2.0.2", "https://example.test/export.zip")
        self.assertEqual(2, metadata.major_version)


if __name__ == "__main__":
    unittest.main()
