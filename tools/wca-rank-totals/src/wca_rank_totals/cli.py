from __future__ import annotations

import argparse
from pathlib import Path
import tempfile

from .acquire import REQUIRED_MEMBERS, materialize_required_members
from .document import build_document, load_document, serialize_document, write_atomic
from .metadata import fetch_metadata, validate_metadata
from .model import ExportMetadata
from .parse import count_ranks, load_countries, load_country_names, load_current_people
from .population import (
    build_population_document,
    load_population_document,
    serialize_population_document,
)
from .rank_list import rank_lists_match_export, write_rank_lists


TOOL_ROOT = Path(__file__).resolve().parents[2]


def _same_valid_export(path: Path, metadata: ExportMetadata) -> bool:
    if not path.exists():
        return False
    try:
        document = load_document(path)
    except ValueError:
        return False
    return _source_matches(document["source"], metadata)


def _same_valid_population(path: Path | None, metadata: ExportMetadata) -> bool:
    if path is None:
        return True
    if not path.exists():
        return False
    try:
        document = load_population_document(path)
    except ValueError:
        return False
    return _source_matches(document["source"], metadata)


def _same_valid_rank_lists(directory: Path | None, metadata: ExportMetadata) -> bool:
    if directory is None:
        return True
    return rank_lists_match_export(directory, metadata)


def _source_matches(source: dict, metadata: ExportMetadata) -> bool:
    return (
        source["exportDate"] == metadata.export_date
        and source["exportFormatVersion"] == metadata.export_format_version
        and source["archiveUrl"] == metadata.tsv_url
    )


def generate(
    output: Path,
    workdir: Path,
    metadata: ExportMetadata | None = None,
    population_output: Path | None = None,
    rank_lists_dir: Path | None = None,
) -> int:
    metadata = validate_metadata(metadata) if metadata is not None else fetch_metadata()
    if (
        _same_valid_export(output, metadata)
        and _same_valid_population(population_output, metadata)
        and _same_valid_rank_lists(rank_lists_dir, metadata)
    ):
        print(f"WCA export {metadata.export_date} is already published and valid")
        return 0
    workdir.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="generation-", dir=workdir) as temporary:
        acquired = Path(temporary) / "members"
        result = materialize_required_members(metadata.tsv_url, acquired)
        countries = load_countries(result.members[REQUIRED_MEMBERS[0]])
        names = load_country_names(result.members[REQUIRED_MEMBERS[0]])
        people = load_current_people(result.members[REQUIRED_MEMBERS[1]], countries)
        totals = {}
        entries = {}
        count_ranks(result.members[REQUIRED_MEMBERS[2]], "single", people, totals, entries)
        count_ranks(result.members[REQUIRED_MEMBERS[3]], "average", people, totals, entries)
        content = serialize_document(build_document(metadata, totals))
        write_atomic(output, content)
        if population_output is not None:
            population = build_population_document(metadata, people, names)
            write_atomic(population_output, serialize_population_document(population))
        shard_count = 0
        if rank_lists_dir is not None:
            shard_count = write_rank_lists(rank_lists_dir, metadata, entries, totals)
    summary = (
        f"Published {len(totals)} events using {result.mode} acquisition "
        f"({result.bytes_received} bytes received)"
    )
    if population_output is not None:
        summary += f"; {len(people)} cubers across {len(population['countries'])} countries"
    if rank_lists_dir is not None:
        summary += f"; {shard_count} rank-list shards"
    print(summary)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate exact WCA rank totals")
    parser.add_argument("--output", type=Path, default=TOOL_ROOT / "data" / "rank-totals.json")
    parser.add_argument(
        "--population-output", type=Path, default=TOOL_ROOT / "data" / "country-totals.json"
    )
    parser.add_argument(
        "--rank-lists-dir", type=Path, default=TOOL_ROOT / "data" / "rank-lists"
    )
    parser.add_argument("--workdir", type=Path, default=TOOL_ROOT / ".work")
    args = parser.parse_args()
    return generate(
        args.output,
        args.workdir,
        population_output=args.population_output,
        rank_lists_dir=args.rank_lists_dir,
    )


if __name__ == "__main__":
    raise SystemExit(main())
