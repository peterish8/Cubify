import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from wca_rank_totals.cli import generate
from wca_rank_totals.model import ExportMetadata, RankListEntry, Region
from wca_rank_totals.rank_list import (
    build_shard,
    load_manifest,
    load_shard,
    pack_i32_deltas,
    unpack_i32_deltas,
    write_rank_lists,
)
from wca_rank_totals.model import RankBucket

from test_cli import METADATA, fixture_acquisition


class RankListTest(unittest.TestCase):
    def test_delta_roundtrip(self) -> None:
        values = [1000, 1100, 1100, 1205]
        encoded = pack_i32_deltas(values)
        self.assertEqual(values, unpack_i32_deltas(encoded, len(values)))

    def test_shard_sorts_and_indexes_regions(self) -> None:
        entries = [
            RankListEntry(1100, 2, Region("US", "_North America")),
            RankListEntry(1000, 1, Region("IN", "_Asia")),
            RankListEntry(1100, 2, Region("IN", "_Asia")),
        ]
        shard = build_shard(METADATA, "333", "single", entries)
        decoded = unpack_i32_deltas(shard["bestsB64"], shard["count"])
        self.assertEqual([1000, 1100, 1100], decoded)
        self.assertEqual(3, shard["count"])
        self.assertIn("IN", shard["countries"])
        self.assertIn("_Asia", shard["continents"])

    def test_write_rank_lists_matches_totals(self) -> None:
        entries = {
            "333": {
                "single": [
                    RankListEntry(1000, 1, Region("IN", "_Asia")),
                    RankListEntry(1100, 2, Region("US", "_North America")),
                ]
            }
        }
        totals = {"333": {"single": RankBucket(2, {"_Asia": 1, "_North America": 1}, {"IN": 1, "US": 1})}}
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            count = write_rank_lists(root, METADATA, entries, totals)
            self.assertEqual(1, count)
            manifest = load_manifest(root / "manifest.json")
            self.assertEqual(["333/single.json"], manifest["files"])
            shard = load_shard(root / "333" / "single.json")
            self.assertEqual(2, shard["count"])

    def test_cli_publishes_rank_list_shards(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            output = root / "rank-totals.json"
            lists_dir = root / "rank-lists"
            with patch("wca_rank_totals.cli.materialize_required_members", return_value=fixture_acquisition()):
                self.assertEqual(
                    0,
                    generate(output, root / "work", METADATA, rank_lists_dir=lists_dir),
                )
            shard = json.loads((lists_dir / "333" / "single.json").read_text(encoding="utf-8"))
            self.assertEqual(3, shard["count"])
            self.assertEqual("333", shard["eventId"])
            average = json.loads((lists_dir / "333" / "average.json").read_text(encoding="utf-8"))
            self.assertEqual(2, average["count"])
            # Second call with matching export + lists should skip acquisition.
            with patch("wca_rank_totals.cli.materialize_required_members") as acquire:
                self.assertEqual(
                    0,
                    generate(output, root / "work", METADATA, rank_lists_dir=lists_dir),
                )
                acquire.assert_not_called()


if __name__ == "__main__":
    unittest.main()
