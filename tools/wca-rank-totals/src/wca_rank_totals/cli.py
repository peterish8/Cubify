from __future__ import annotations

import argparse
from pathlib import Path
import tempfile

from .acquire import REQUIRED_MEMBERS, materialize_required_members
from .document import build_document, load_document, serialize_document, write_atomic
from .metadata import fetch_metadata, validate_metadata
from .model import ExportMetadata
from .parse import count_ranks, load_countries, load_current_people


TOOL_ROOT = Path(__file__).resolve().parents[2]


def _same_valid_export(path: Path, metadata: ExportMetadata) -> bool:
    if not path.exists():
        return False
    try:
        document = load_document(path)
    except ValueError:
        return False
    source = document["source"]
    return (
        source["exportDate"] == metadata.export_date
        and source["exportFormatVersion"] == metadata.export_format_version
        and source["archiveUrl"] == metadata.tsv_url
    )


def generate(output: Path, workdir: Path, metadata: ExportMetadata | None = None) -> int:
    metadata = validate_metadata(metadata) if metadata is not None else fetch_metadata()
    if _same_valid_export(output, metadata):
        print(f"WCA export {metadata.export_date} is already published and valid")
        return 0
    workdir.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="generation-", dir=workdir) as temporary:
        acquired = Path(temporary) / "members"
        result = materialize_required_members(metadata.tsv_url, acquired)
        countries = load_countries(result.members[REQUIRED_MEMBERS[0]])
        people = load_current_people(result.members[REQUIRED_MEMBERS[1]], countries)
        totals = {}
        count_ranks(result.members[REQUIRED_MEMBERS[2]], "single", people, totals)
        count_ranks(result.members[REQUIRED_MEMBERS[3]], "average", people, totals)
        content = serialize_document(build_document(metadata, totals))
        write_atomic(output, content)
    print(
        f"Published {len(totals)} events using {result.mode} acquisition "
        f"({result.bytes_received} bytes received)"
    )
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate exact WCA rank totals")
    parser.add_argument("--output", type=Path, default=TOOL_ROOT / "data" / "rank-totals.json")
    parser.add_argument("--workdir", type=Path, default=TOOL_ROOT / ".work")
    args = parser.parse_args()
    return generate(args.output, args.workdir)


if __name__ == "__main__":
    raise SystemExit(main())
