# WCA Rank Totals Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public, no-SQL GitHub Actions pipeline that converts the official WCA Results Export into exact per-event world, continent, and country totals for single and average rankings.

**Architecture:** A standalone Python 3.12 repository streams four official TSV files into deterministic aggregate JSON. It first attempts HTTP-range-backed selective ZIP access, falls back to the full archive when ranges are unsupported, validates every aggregate, and commits only a new last-known-good `data/rank-totals.json`.

**Tech Stack:** Python 3.12 standard library, `unittest`, GitHub Actions, official WCA Results Export v2, GitHub-hosted Ubuntu runner.

## Global Constraints

- Repository: public `peterish8/wca-rank-totals`.
- No SQL, MySQL, Supabase, database service, server process, or runtime PyPI dependencies.
- Input members: `WCA_export_countries.tsv`, `WCA_export_persons.tsv`, `WCA_export_ranks_single.tsv`, and `WCA_export_ranks_average.tsv` only.
- Current competitor identity is the unique `persons` row where `sub_id = 1`.
- Count unique `(event_id, person_id)` rows only when all three official ranks are positive.
- Output contract: `data/rank-totals.json`, schema version `1`, canonical WCA continent IDs, uppercase country ISO2 values.
- Same-export runs must exit without downloading the ZIP; same input must produce byte-identical JSON.
- Any acquisition, parsing, or validation failure must leave the previously committed JSON unchanged.
- Scheduled trigger: `17 6 * * *` (06:17 UTC daily), plus manual dispatch.
- Workflow permission: `contents: write` only; no repository secrets and no exported archives uploaded as artifacts.

---

## File map

- `pyproject.toml` — package metadata, Python floor, and package discovery.
- `README.md` — source attribution, generated-file contract, operation, and measured benchmarks.
- `src/wca_rank_totals/__init__.py` — package version.
- `src/wca_rank_totals/model.py` — immutable metadata, region, acquisition, and aggregate types.
- `src/wca_rank_totals/metadata.py` — official metadata fetch and validation.
- `src/wca_rank_totals/acquire.py` — selective HTTP range reader, full-download fallback, and exact ZIP-member materialization.
- `src/wca_rank_totals/parse.py` — TSV header validation, current-person mapping, unique ranked-person counting.
- `src/wca_rank_totals/document.py` — reconciliation, schema construction, deterministic serialization, atomic writes.
- `src/wca_rank_totals/cli.py` — orchestration and unchanged-export short circuit.
- `tests/fixtures/*.tsv` — minimal official-shape datasets covering current/historical persons, ties, and rank-type differences.
- `tests/test_metadata.py` — metadata contract tests.
- `tests/test_acquire.py` — range-reader and fallback tests.
- `tests/test_parse.py` — counting and duplicate-identity tests.
- `tests/test_document.py` — reconciliation and deterministic JSON tests.
- `tests/test_cli.py` — unchanged-export and last-known-good orchestration tests.
- `.github/workflows/update-rank-totals.yml` — tests, generation, commit, and workflow summary.

### Task 1: Create the repository and metadata model

**Files:**
- Create: `pyproject.toml`
- Create: `README.md`
- Create: `src/wca_rank_totals/__init__.py`
- Create: `src/wca_rank_totals/model.py`
- Test: `tests/test_model.py`

**Interfaces:**
- Consumes: no earlier task.
- Produces: `Region`, `ExportMetadata`, `AcquisitionResult`, `RankBucket`, and `Totals` for all later tasks.

- [ ] **Step 1: Create and clone the public repository**

Run with an authenticated GitHub CLI:

```bash
gh repo create peterish8/wca-rank-totals --public --description "Exact WCA ranked-competitor totals generated from the official export" --clone
cd wca-rank-totals
```

Expected: an empty public repository cloned locally with `origin` set to `https://github.com/peterish8/wca-rank-totals.git`.

- [ ] **Step 2: Write the failing model test**

Create `tests/test_model.py`:

```python
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
        metadata = ExportMetadata(
            export_date="2026-07-17T03:24:49+00:00",
            export_format_version="2.0.2",
            tsv_url="https://exports.worldcubeassociation.org/results/example.tsv.zip",
        )

        self.assertEqual(2, metadata.major_version)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 3: Run the model test and verify it fails**

Run:

```bash
PYTHONPATH=src python -m unittest tests.test_model -v
```

Expected: `ModuleNotFoundError: No module named 'wca_rank_totals'`.

- [ ] **Step 4: Implement the package and model**

Create `src/wca_rank_totals/__init__.py`:

```python
__version__ = "0.1.0"
```

Create `src/wca_rank_totals/model.py`:

```python
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import TypeAlias


@dataclass(frozen=True)
class Region:
    iso2: str
    continent_id: str


@dataclass(frozen=True)
class ExportMetadata:
    export_date: str
    export_format_version: str
    tsv_url: str

    @property
    def major_version(self) -> int:
        return int(self.export_format_version.split(".", maxsplit=1)[0])


@dataclass(frozen=True)
class AcquisitionResult:
    mode: str
    bytes_received: int
    members: dict[str, Path]


@dataclass
class RankBucket:
    world: int = 0
    continents: dict[str, int] = field(default_factory=dict)
    countries: dict[str, int] = field(default_factory=dict)

    def add(self, region: Region) -> None:
        self.world += 1
        self.continents[region.continent_id] = self.continents.get(region.continent_id, 0) + 1
        self.countries[region.iso2] = self.countries.get(region.iso2, 0) + 1


Totals: TypeAlias = dict[str, dict[str, RankBucket]]
```

Create `pyproject.toml`:

```toml
[build-system]
requires = ["setuptools>=75"]
build-backend = "setuptools.build_meta"

[project]
name = "wca-rank-totals"
version = "0.1.0"
description = "Exact WCA ranked-competitor totals from the official results export"
requires-python = ">=3.12"
dependencies = []

[tool.setuptools.packages.find]
where = ["src"]
```

Create `README.md` with the project title, the exact four input member names, the no-SQL guarantee, and this attribution:

```markdown
# WCA Rank Totals

Exact per-event world, continent, and country counts for competitors with valid official WCA single or average rankings. The data is generated with Python and GitHub Actions; no SQL database or API server is used.

This information is based on competition results owned and maintained by the World Cube Association, published at https://worldcubeassociation.org/results. The exact export date is stored in `data/rank-totals.json`.
```

- [ ] **Step 5: Run the model test and verify it passes**

Run:

```bash
PYTHONPATH=src python -m unittest tests.test_model -v
```

Expected: `Ran 2 tests` and `OK`.

- [ ] **Step 6: Commit the repository foundation**

```bash
git add pyproject.toml README.md src tests/test_model.py
git commit -m "chore: initialize WCA rank totals generator"
```

### Task 2: Parse official TSVs and count unique ranked competitors

**Files:**
- Create: `src/wca_rank_totals/parse.py`
- Create: `tests/fixtures/countries.tsv`
- Create: `tests/fixtures/persons.tsv`
- Create: `tests/fixtures/ranks_single.tsv`
- Create: `tests/fixtures/ranks_average.tsv`
- Test: `tests/test_parse.py`

**Interfaces:**
- Consumes: `Region`, `RankBucket`, and `Totals` from Task 1.
- Produces: `load_countries(path)`, `load_current_people(path, countries)`, and `count_ranks(path, rank_type, people, totals)`.

- [ ] **Step 1: Add official-shape TSV fixtures**

Create `tests/fixtures/countries.tsv`:

```text
id	name	continent_id	iso2
India	India	_Asia	IN
United States	United States	_North America	US
```

Create `tests/fixtures/persons.tsv`:

```text
wca_id	sub_id	name	country_id	gender
2020TEST01	1	Current Tester	India	m
2020TEST01	2	Historical Tester	United States	m
2021ONLY01	1	Registration Only	India	f
2022SING01	1	Single Only	United States	m
2023TIED01	1	Tied Tester	India	f
```

Create `tests/fixtures/ranks_single.tsv`:

```text
person_id	event_id	best	world_rank	continent_rank	country_rank
2020TEST01	333	1000	1	1	1
2022SING01	333	1100	2	1	1
2023TIED01	333	1100	2	2	2
```

Create `tests/fixtures/ranks_average.tsv`:

```text
person_id	event_id	best	world_rank	continent_rank	country_rank
2020TEST01	333	1200	1	1	1
2023TIED01	333	1300	2	2	2
```

- [ ] **Step 2: Write failing parser tests**

Create `tests/test_parse.py`:

```python
from pathlib import Path
import tempfile
import unittest

from wca_rank_totals.parse import CountingError, count_ranks, load_countries, load_current_people


FIXTURES = Path(__file__).parent / "fixtures"


class ParseTest(unittest.TestCase):
    def test_counts_current_people_without_multiplying_historical_rows(self) -> None:
        countries = load_countries(FIXTURES / "countries.tsv")
        people = load_current_people(FIXTURES / "persons.tsv", countries)
        totals = {}

        count_ranks(FIXTURES / "ranks_single.tsv", "single", people, totals)
        count_ranks(FIXTURES / "ranks_average.tsv", "average", people, totals)

        self.assertEqual(3, totals["333"]["single"].world)
        self.assertEqual(2, totals["333"]["average"].world)
        self.assertEqual({"IN": 2, "US": 1}, totals["333"]["single"].countries)
        self.assertEqual({"_Asia": 2, "_North America": 1}, totals["333"]["single"].continents)
        self.assertEqual(4, len(people))

    def test_duplicate_event_person_rank_fails(self) -> None:
        duplicate = "\n".join([
            "person_id\tevent_id\tbest\tworld_rank\tcontinent_rank\tcountry_rank",
            "2020TEST01\t333\t1000\t1\t1\t1",
            "2020TEST01\t333\t1000\t1\t1\t1",
        ])
        countries = load_countries(FIXTURES / "countries.tsv")
        people = load_current_people(FIXTURES / "persons.tsv", countries)

        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "duplicate.tsv"
            path.write_text(duplicate, encoding="utf-8")
            with self.assertRaisesRegex(CountingError, "duplicate rank row"):
                count_ranks(path, "single", people, {})


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 3: Run the parser tests and verify they fail**

Run:

```bash
PYTHONPATH=src python -m unittest tests.test_parse -v
```

Expected: import failure for `wca_rank_totals.parse`.

- [ ] **Step 4: Implement strict streaming TSV parsing**

Create `src/wca_rank_totals/parse.py`:

```python
from __future__ import annotations

import csv
from pathlib import Path
from typing import Iterator

from .model import RankBucket, Region, Totals


class CountingError(ValueError):
    pass


def _rows(path: Path, required: set[str]) -> Iterator[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as stream:
        reader = csv.DictReader(stream, delimiter="\t")
        actual = set(reader.fieldnames or [])
        if not required.issubset(actual):
            missing = ", ".join(sorted(required - actual))
            raise CountingError(f"{path.name}: missing TSV columns: {missing}")
        yield from reader


def load_countries(path: Path) -> dict[str, Region]:
    countries: dict[str, Region] = {}
    for row in _rows(path, {"id", "continent_id", "iso2"}):
        country_id = row["id"]
        iso2 = row["iso2"].upper()
        continent_id = row["continent_id"]
        if not country_id or not iso2 or not continent_id:
            raise CountingError(f"{path.name}: incomplete country row")
        if country_id in countries:
            raise CountingError(f"{path.name}: duplicate country id {country_id}")
        countries[country_id] = Region(iso2=iso2, continent_id=continent_id)
    return countries


def load_current_people(path: Path, countries: dict[str, Region]) -> dict[str, Region]:
    people: dict[str, Region] = {}
    for row in _rows(path, {"wca_id", "sub_id", "country_id"}):
        if row["sub_id"] != "1":
            continue
        wca_id = row["wca_id"]
        if wca_id in people:
            raise CountingError(f"{path.name}: duplicate current person {wca_id}")
        try:
            people[wca_id] = countries[row["country_id"]]
        except KeyError as error:
            raise CountingError(f"{path.name}: unknown country for {wca_id}") from error
    return people


def count_ranks(
    path: Path,
    rank_type: str,
    people: dict[str, Region],
    totals: Totals,
) -> None:
    if rank_type not in {"single", "average"}:
        raise CountingError(f"unsupported rank type {rank_type}")
    seen: set[tuple[str, str]] = set()
    required = {"person_id", "event_id", "world_rank", "continent_rank", "country_rank"}
    for row in _rows(path, required):
        person_id = row["person_id"]
        event_id = row["event_id"]
        key = (event_id, person_id)
        if key in seen:
            raise CountingError(f"{path.name}: duplicate rank row {event_id}/{person_id}")
        seen.add(key)
        ranks = (int(row["world_rank"]), int(row["continent_rank"]), int(row["country_rank"]))
        if any(rank <= 0 for rank in ranks):
            raise CountingError(f"{path.name}: non-positive rank for {event_id}/{person_id}")
        try:
            region = people[person_id]
        except KeyError as error:
            raise CountingError(f"{path.name}: missing current person {person_id}") from error
        bucket = totals.setdefault(event_id, {}).setdefault(rank_type, RankBucket())
        bucket.add(region)
```

- [ ] **Step 5: Run parser tests and the full suite**

Run:

```bash
PYTHONPATH=src python -m unittest discover -s tests -v
```

Expected: `Ran 4 tests` and `OK`.

- [ ] **Step 6: Commit the counting engine**

```bash
git add src/wca_rank_totals/parse.py tests/fixtures tests/test_parse.py
git commit -m "feat: count unique official WCA rank rows"
```

### Task 3: Validate and serialize the deterministic document

**Files:**
- Create: `src/wca_rank_totals/document.py`
- Test: `tests/test_document.py`

**Interfaces:**
- Consumes: `ExportMetadata`, `RankBucket`, and populated `Totals`.
- Produces: `build_document(metadata, totals)`, `serialize_document(document)`, and `write_atomic(path, content)`.

- [ ] **Step 1: Write failing reconciliation and determinism tests**

Create `tests/test_document.py`:

```python
from pathlib import Path
import tempfile
import unittest

from wca_rank_totals.document import build_document, serialize_document, write_atomic
from wca_rank_totals.model import ExportMetadata, RankBucket


class DocumentTest(unittest.TestCase):
    def setUp(self) -> None:
        self.metadata = ExportMetadata("2026-07-17T03:24:49+00:00", "2.0.2", "https://example.test/export.zip")

    def test_serialization_is_sorted_and_deterministic(self) -> None:
        bucket = RankBucket(world=2, continents={"_Asia": 2}, countries={"IN": 2})
        document = build_document(self.metadata, {"333": {"single": bucket}})
        first = serialize_document(document)
        second = serialize_document(document)

        self.assertEqual(first, second)
        self.assertIn('"schemaVersion": 1', first)
        self.assertTrue(first.endswith("\n"))

    def test_reconciliation_rejects_incorrect_country_sum(self) -> None:
        bucket = RankBucket(world=2, continents={"_Asia": 2}, countries={"IN": 1})
        with self.assertRaisesRegex(ValueError, "country total"):
            build_document(self.metadata, {"333": {"single": bucket}})

    def test_atomic_write_replaces_target(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "rank-totals.json"
            path.write_text("old", encoding="utf-8")
            write_atomic(path, "new\n")
            self.assertEqual("new\n", path.read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run the document tests and verify they fail**

Run:

```bash
PYTHONPATH=src python -m unittest tests.test_document -v
```

Expected: import failure for `wca_rank_totals.document`.

- [ ] **Step 3: Implement reconciliation and canonical JSON**

Create `src/wca_rank_totals/document.py`:

```python
from __future__ import annotations

import json
import os
from pathlib import Path
import tempfile
from typing import Any

from .model import ExportMetadata, Totals


def build_document(metadata: ExportMetadata, totals: Totals) -> dict[str, Any]:
    events: dict[str, Any] = {}
    for event_id in sorted(totals):
        event: dict[str, Any] = {}
        for rank_type in ("single", "average"):
            bucket = totals[event_id].get(rank_type)
            if bucket is None:
                continue
            if sum(bucket.countries.values()) != bucket.world:
                raise ValueError(f"{event_id}/{rank_type}: country total does not match world")
            if sum(bucket.continents.values()) != bucket.world:
                raise ValueError(f"{event_id}/{rank_type}: continent total does not match world")
            event[rank_type] = {
                "world": bucket.world,
                "continents": dict(sorted(bucket.continents.items())),
                "countries": dict(sorted(bucket.countries.items())),
            }
        events[event_id] = event
    return {
        "schemaVersion": 1,
        "source": {
            "name": "World Cube Association Results Export",
            "exportDate": metadata.export_date,
            "exportFormatVersion": metadata.export_format_version,
            "archiveUrl": metadata.tsv_url,
            "url": "https://www.worldcubeassociation.org/export/results",
            "attribution": "Based on competition results owned and maintained by the World Cube Association.",
        },
        "events": events,
    }


def serialize_document(document: dict[str, Any]) -> str:
    encoded = json.dumps(document, ensure_ascii=False, indent=2, sort_keys=False) + "\n"
    parsed = json.loads(encoded)
    if parsed.get("schemaVersion") != 1 or not isinstance(parsed.get("events"), dict):
        raise ValueError("generated document failed schema validation")
    return encoded


def write_atomic(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, delete=False) as stream:
        stream.write(content)
        temporary = Path(stream.name)
    try:
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)
```

- [ ] **Step 4: Run document tests and full suite**

Run:

```bash
PYTHONPATH=src python -m unittest discover -s tests -v
```

Expected: `Ran 7 tests` and `OK`.

- [ ] **Step 5: Commit the document builder**

```bash
git add src/wca_rank_totals/document.py tests/test_document.py
git commit -m "feat: validate and serialize rank totals"
```

### Task 4: Fetch and validate official export metadata

**Files:**
- Create: `src/wca_rank_totals/metadata.py`
- Test: `tests/test_metadata.py`

**Interfaces:**
- Consumes: `ExportMetadata`.
- Produces: `fetch_metadata(url=PUBLIC_EXPORT_METADATA_URL, opener=urlopen)`.

- [ ] **Step 1: Write failing metadata tests with an in-memory response**

Create `tests/test_metadata.py`:

```python
from io import BytesIO
import unittest

from wca_rank_totals.metadata import MetadataError, fetch_metadata


class MetadataTest(unittest.TestCase):
    def test_accepts_official_v2_shape(self) -> None:
        response = BytesIO(b'{"export_date":"2026-07-17T03:24:49+00:00","export_format_version":"2.0.2","tsv_url":"https://example.test/export.zip"}')
        metadata = fetch_metadata(opener=lambda request, timeout: response)
        self.assertEqual(2, metadata.major_version)

    def test_rejects_unsupported_major_version(self) -> None:
        response = BytesIO(b'{"export_date":"2026-07-17T03:24:49+00:00","export_format_version":"3.0.0","tsv_url":"https://example.test/export.zip"}')
        with self.assertRaisesRegex(MetadataError, "unsupported export format"):
            fetch_metadata(opener=lambda request, timeout: response)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run metadata tests and verify they fail**

Run: `PYTHONPATH=src python -m unittest tests.test_metadata -v`

Expected: import failure for `wca_rank_totals.metadata`.

- [ ] **Step 3: Implement metadata validation**

Create `src/wca_rank_totals/metadata.py`:

```python
from __future__ import annotations

import json
from typing import Callable, Protocol
from urllib.request import Request, urlopen

from .model import ExportMetadata


PUBLIC_EXPORT_METADATA_URL = "https://www.worldcubeassociation.org/api/v0/export/public"


class MetadataError(ValueError):
    pass


class Opener(Protocol):
    def __call__(self, request: Request, timeout: int): ...


def fetch_metadata(
    url: str = PUBLIC_EXPORT_METADATA_URL,
    opener: Opener = urlopen,
) -> ExportMetadata:
    request = Request(url, headers={"Accept": "application/json", "User-Agent": "wca-rank-totals/0.1"})
    try:
        with opener(request, timeout=30) as response:
            payload = json.load(response)
        metadata = ExportMetadata(
            export_date=str(payload["export_date"]),
            export_format_version=str(payload["export_format_version"]),
            tsv_url=str(payload["tsv_url"]),
        )
    except (KeyError, TypeError, ValueError, OSError) as error:
        raise MetadataError("invalid WCA export metadata") from error
    if metadata.major_version != 2:
        raise MetadataError(f"unsupported export format {metadata.export_format_version}")
    if not metadata.tsv_url.startswith("https://") or not metadata.export_date:
        raise MetadataError("invalid WCA export metadata values")
    return metadata
```

- [ ] **Step 4: Run metadata tests and full suite**

Run: `PYTHONPATH=src python -m unittest discover -s tests -v`

Expected: `Ran 9 tests` and `OK`.

- [ ] **Step 5: Commit the metadata client**

```bash
git add src/wca_rank_totals/metadata.py tests/test_metadata.py
git commit -m "feat: validate official WCA export metadata"
```

### Task 5: Acquire only required ZIP members with a safe fallback

**Files:**
- Create: `src/wca_rank_totals/acquire.py`
- Test: `tests/test_acquire.py`

**Interfaces:**
- Consumes: `AcquisitionResult`.
- Produces: `HTTPRangeReader`, `RangeUnsupported`, `materialize_required_members(url, destination)`.

- [ ] **Step 1: Write failing range-reader and fallback tests**

Create `tests/test_acquire.py`:

```python
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from io import BytesIO
from pathlib import Path
import tempfile
from threading import Thread
import unittest
import zipfile

from wca_rank_totals.acquire import REQUIRED_MEMBERS, materialize_required_members


FIXTURES = Path(__file__).parent / "fixtures"


def archive_bytes() -> bytes:
    output = BytesIO()
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        fixture_names = {
            "WCA_export_countries.tsv": "countries.tsv",
            "WCA_export_persons.tsv": "persons.tsv",
            "WCA_export_ranks_single.tsv": "ranks_single.tsv",
            "WCA_export_ranks_average.tsv": "ranks_average.tsv",
        }
        for member, fixture in fixture_names.items():
            archive.writestr(member, (FIXTURES / fixture).read_bytes())
    return output.getvalue()


def handler_for(payload: bytes, supports_range: bool):
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:
            requested = self.headers.get("Range")
            if supports_range and requested:
                unit, interval = requested.split("=", maxsplit=1)
                start_text, end_text = interval.split("-", maxsplit=1)
                start, end = int(start_text), min(int(end_text), len(payload) - 1)
                body = payload[start:end + 1]
                self.send_response(206)
                self.send_header("Content-Range", f"bytes {start}-{end}/{len(payload)}")
                self.send_header("Content-Length", str(len(body)))
            else:
                body = payload
                self.send_response(200)
                self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, format: str, *args: object) -> None:
            return

    return Handler


class AcquireTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        payload = archive_bytes()
        cls.servers = []
        cls.urls = []
        for supports_range in (True, False):
            server = ThreadingHTTPServer(("127.0.0.1", 0), handler_for(payload, supports_range))
            Thread(target=server.serve_forever, daemon=True).start()
            cls.servers.append(server)
            cls.urls.append(f"http://127.0.0.1:{server.server_port}/export.zip")

    @classmethod
    def tearDownClass(cls) -> None:
        for server in cls.servers:
            server.shutdown()
            server.server_close()

    def test_selective_range_mode_materializes_exact_members(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            result = materialize_required_members(self.urls[0], Path(directory))
            self.assertEqual("range", result.mode)
            self.assertEqual(set(REQUIRED_MEMBERS), set(result.members))
            self.assertTrue(all(path.stat().st_size > 0 for path in result.members.values()))

    def test_full_download_fallback_materializes_exact_members(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            result = materialize_required_members(self.urls[1], Path(directory))
            self.assertEqual("full", result.mode)
            self.assertEqual(set(REQUIRED_MEMBERS), set(result.members))


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run acquisition tests and verify they fail**

Run: `PYTHONPATH=src python -m unittest tests.test_acquire -v`

Expected: import failure for `wca_rank_totals.acquire`.

- [ ] **Step 3: Implement the seekable block-cached HTTP range reader**

Create `src/wca_rank_totals/acquire.py` with:

```python
from __future__ import annotations

from collections import OrderedDict
import io
from pathlib import Path
import re
import shutil
import tempfile
from urllib.request import Request, urlopen
import zipfile

from .model import AcquisitionResult


REQUIRED_MEMBERS = (
    "WCA_export_countries.tsv",
    "WCA_export_persons.tsv",
    "WCA_export_ranks_single.tsv",
    "WCA_export_ranks_average.tsv",
)


class RangeUnsupported(OSError):
    pass


class HTTPRangeReader(io.RawIOBase):
    def __init__(self, url: str, block_size: int = 1024 * 1024, max_blocks: int = 8) -> None:
        self.url = url
        self.block_size = block_size
        self.max_blocks = max_blocks
        self.position = 0
        self.bytes_received = 0
        self._cache: OrderedDict[int, bytes] = OrderedDict()
        _, total = self._fetch(0, 0)
        self._size = total

    def _fetch(self, start: int, end: int) -> tuple[bytes, int]:
        request = Request(self.url, headers={"Range": f"bytes={start}-{end}", "Accept-Encoding": "identity", "User-Agent": "wca-rank-totals/0.1"})
        with urlopen(request, timeout=60) as response:
            if response.status != 206:
                raise RangeUnsupported("server did not honor byte ranges")
            content_range = response.headers.get("Content-Range", "")
            match = re.fullmatch(r"bytes (\d+)-(\d+)/(\d+)", content_range)
            if match is None:
                raise RangeUnsupported("invalid Content-Range response")
            body = response.read()
            total = int(match.group(3))
            expected = int(match.group(2)) - int(match.group(1)) + 1
            if len(body) != expected:
                raise RangeUnsupported("truncated range response")
            self.bytes_received += len(body)
            return body, total

    def _block(self, index: int) -> bytes:
        if index in self._cache:
            self._cache.move_to_end(index)
            return self._cache[index]
        start = index * self.block_size
        end = min(self._size - 1, start + self.block_size - 1)
        block, _ = self._fetch(start, end)
        self._cache[index] = block
        self._cache.move_to_end(index)
        while len(self._cache) > self.max_blocks:
            self._cache.popitem(last=False)
        return block

    def readable(self) -> bool:
        return True

    def seekable(self) -> bool:
        return True

    def tell(self) -> int:
        return self.position

    def seek(self, offset: int, whence: int = io.SEEK_SET) -> int:
        if whence == io.SEEK_SET:
            position = offset
        elif whence == io.SEEK_CUR:
            position = self.position + offset
        elif whence == io.SEEK_END:
            position = self._size + offset
        else:
            raise ValueError("invalid whence")
        if position < 0:
            raise ValueError("negative seek position")
        self.position = position
        return self.position

    def read(self, size: int = -1) -> bytes:
        if self.position >= self._size:
            return b""
        if size < 0:
            size = self._size - self.position
        remaining = min(size, self._size - self.position)
        chunks: list[bytes] = []
        while remaining:
            index, within = divmod(self.position, self.block_size)
            block = self._block(index)
            take = min(remaining, len(block) - within)
            chunks.append(block[within:within + take])
            self.position += take
            remaining -= take
        return b"".join(chunks)
```

- [ ] **Step 4: Implement exact-member copying and full fallback in the same file**

Append:

```python
def _copy_members(archive: zipfile.ZipFile, destination: Path) -> dict[str, Path]:
    names = set(archive.namelist())
    missing = set(REQUIRED_MEMBERS) - names
    if missing:
        raise zipfile.BadZipFile(f"missing required members: {', '.join(sorted(missing))}")
    destination.mkdir(parents=True, exist_ok=True)
    paths: dict[str, Path] = {}
    for name in REQUIRED_MEMBERS:
        target = destination / name
        with archive.open(name, "r") as source, target.open("wb") as output:
            shutil.copyfileobj(source, output, length=1024 * 1024)
        paths[name] = target
    return paths


def _clear_known_members(destination: Path) -> None:
    for name in REQUIRED_MEMBERS:
        (destination / name).unlink(missing_ok=True)


def materialize_required_members(url: str, destination: Path) -> AcquisitionResult:
    try:
        remote = HTTPRangeReader(url)
        with zipfile.ZipFile(remote) as archive:
            members = _copy_members(archive, destination)
        return AcquisitionResult("range", remote.bytes_received, members)
    except (RangeUnsupported, zipfile.BadZipFile, OSError):
        _clear_known_members(destination)

    destination.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=destination, suffix=".zip", delete=False) as temporary:
        archive_path = Path(temporary.name)
        request = Request(url, headers={"Accept-Encoding": "identity", "User-Agent": "wca-rank-totals/0.1"})
        with urlopen(request, timeout=300) as response:
            shutil.copyfileobj(response, temporary, length=1024 * 1024)
        bytes_received = temporary.tell()
    try:
        with zipfile.ZipFile(archive_path) as archive:
            members = _copy_members(archive, destination)
        return AcquisitionResult("full", bytes_received, members)
    finally:
        archive_path.unlink(missing_ok=True)
```

- [ ] **Step 5: Run acquisition tests and full suite**

Run: `PYTHONPATH=src python -m unittest discover -s tests -v`

Expected: all tests pass, including both acquisition modes.

- [ ] **Step 6: Commit archive acquisition**

```bash
git add src/wca_rank_totals/acquire.py tests/test_acquire.py
git commit -m "feat: selectively fetch WCA export members"
```

### Task 6: Orchestrate unchanged checks, generation, and last-known-good writes

**Files:**
- Create: `src/wca_rank_totals/cli.py`
- Test: `tests/test_cli.py`
- Create: `data/.gitkeep`

**Interfaces:**
- Consumes: metadata, acquisition, parsing, validation, serialization, and atomic write functions.
- Produces: `generate(output, workdir, metadata=None) -> int` and `main() -> int`.

- [ ] **Step 1: Write failing unchanged-export and generation tests**

Create `tests/test_cli.py`:

```python
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from wca_rank_totals.acquire import REQUIRED_MEMBERS
from wca_rank_totals.cli import generate
from wca_rank_totals.model import AcquisitionResult, ExportMetadata


FIXTURES = Path(__file__).parent / "fixtures"
METADATA = ExportMetadata("2026-07-17T03:24:49+00:00", "2.0.2", "https://example.test/export.zip")


def fixture_acquisition() -> AcquisitionResult:
    paths = {
        REQUIRED_MEMBERS[0]: FIXTURES / "countries.tsv",
        REQUIRED_MEMBERS[1]: FIXTURES / "persons.tsv",
        REQUIRED_MEMBERS[2]: FIXTURES / "ranks_single.tsv",
        REQUIRED_MEMBERS[3]: FIXTURES / "ranks_average.tsv",
    }
    return AcquisitionResult("range", 1234, paths)


class CliTest(unittest.TestCase):
    def test_matching_export_date_skips_acquisition(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            output = root / "rank-totals.json"
            output.write_text(json.dumps({"source": {"exportDate": METADATA.export_date}}), encoding="utf-8")
            with patch("wca_rank_totals.cli.materialize_required_members") as acquire:
                self.assertEqual(0, generate(output, root, METADATA))
                acquire.assert_not_called()

    def test_generation_publishes_fixture_totals(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            output = root / "rank-totals.json"
            with patch("wca_rank_totals.cli.materialize_required_members", return_value=fixture_acquisition()):
                self.assertEqual(0, generate(output, root, METADATA))
            document = json.loads(output.read_text(encoding="utf-8"))
            self.assertEqual(3, document["events"]["333"]["single"]["world"])
            self.assertEqual(2, document["events"]["333"]["average"]["world"])


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run CLI tests and verify they fail**

Run: `PYTHONPATH=src python -m unittest tests.test_cli -v`

Expected: import failure for `wca_rank_totals.cli`.

- [ ] **Step 3: Implement orchestration**

Create `src/wca_rank_totals/cli.py`:

```python
from __future__ import annotations

import argparse
import json
from pathlib import Path
import tempfile

from .acquire import REQUIRED_MEMBERS, materialize_required_members
from .document import build_document, serialize_document, write_atomic
from .metadata import fetch_metadata
from .model import ExportMetadata
from .parse import count_ranks, load_countries, load_current_people


def _existing_export_date(path: Path) -> str | None:
    if not path.exists():
        return None
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        return str(payload["source"]["exportDate"])
    except (KeyError, TypeError, ValueError, OSError):
        return None


def generate(output: Path, workdir: Path, metadata: ExportMetadata | None = None) -> int:
    metadata = metadata or fetch_metadata()
    if _existing_export_date(output) == metadata.export_date:
        print(f"WCA export {metadata.export_date} is already published")
        return 0
    with tempfile.TemporaryDirectory(dir=workdir) as temporary:
        result = materialize_required_members(metadata.tsv_url, Path(temporary))
        countries = load_countries(result.members[REQUIRED_MEMBERS[0]])
        people = load_current_people(result.members[REQUIRED_MEMBERS[1]], countries)
        totals = {}
        count_ranks(result.members[REQUIRED_MEMBERS[2]], "single", people, totals)
        count_ranks(result.members[REQUIRED_MEMBERS[3]], "average", people, totals)
        content = serialize_document(build_document(metadata, totals))
        write_atomic(output, content)
        print(f"Published {len(totals)} events using {result.mode} acquisition ({result.bytes_received} bytes received)")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate exact WCA rank totals")
    parser.add_argument("--output", type=Path, default=Path("data/rank-totals.json"))
    parser.add_argument("--workdir", type=Path, default=Path(".work"))
    args = parser.parse_args()
    args.workdir.mkdir(parents=True, exist_ok=True)
    return generate(args.output, args.workdir)


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 4: Run CLI tests and full suite**

Run: `PYTHONPATH=src python -m unittest discover -s tests -v`

Expected: every test passes.

- [ ] **Step 5: Verify the CLI help path**

Run: `PYTHONPATH=src python -m wca_rank_totals.cli --help`

Expected: usage text containing `--output` and `--workdir`.

- [ ] **Step 6: Commit orchestration**

```bash
mkdir -p data
: > data/.gitkeep
git add src/wca_rank_totals/cli.py tests/test_cli.py data/.gitkeep
git commit -m "feat: generate last-known-good rank totals"
```

### Task 7: Automate, run production generation, and record benchmarks

**Files:**
- Create: `.github/workflows/update-rank-totals.yml`
- Modify: `README.md`
- Generate: `data/rank-totals.json`

**Interfaces:**
- Consumes: `python -m wca_rank_totals.cli` from Task 6.
- Produces: daily static JSON at the stable raw GitHub URL consumed by Cubify.

- [ ] **Step 1: Create the workflow**

Create `.github/workflows/update-rank-totals.yml`:

```yaml
name: Update WCA rank totals

on:
  schedule:
    - cron: "17 6 * * *"
  workflow_dispatch:

concurrency:
  group: update-wca-rank-totals
  cancel-in-progress: false

permissions:
  contents: read

jobs:
  update:
    runs-on: ubuntu-latest
    timeout-minutes: 120
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683
      - uses: actions/setup-python@a26af69be951a213d495a4c3e4e4022e16d87065
        with:
          python-version: "3.12"
      - name: Test
        run: PYTHONPATH=src python -m unittest discover -s tests -v
      - name: Generate
        run: |
          mkdir -p .work
          START_SECONDS=$SECONDS
          PYTHONPATH=src python -m wca_rank_totals.cli | tee generation.log
          echo "### WCA rank totals" >> "$GITHUB_STEP_SUMMARY"
          echo "- Runtime: $((SECONDS - START_SECONDS)) seconds" >> "$GITHUB_STEP_SUMMARY"
          echo "- $(tail -1 generation.log)" >> "$GITHUB_STEP_SUMMARY"
      - name: Commit changed data
        run: |
          if git diff --quiet -- data/rank-totals.json; then
            echo "No data change" >> "$GITHUB_STEP_SUMMARY"
            exit 0
          fi
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add data/rank-totals.json
          git commit -m "data: update WCA rank totals"
          git push
```

- [ ] **Step 2: Run all tests before publishing**

Run: `PYTHONPATH=src python -m unittest discover -s tests -v`

Expected: all tests pass.

- [ ] **Step 3: Push the implementation and enable Actions**

```bash
git add .github/workflows/update-rank-totals.yml
git commit -m "ci: publish WCA rank totals daily"
git push -u origin main
gh workflow run "Update WCA rank totals"
```

Expected: GitHub accepts the workflow dispatch.

- [ ] **Step 4: Watch the first production run**

```bash
RUN_ID=$(gh run list --workflow "Update WCA rank totals" --limit 1 --json databaseId --jq '.[0].databaseId')
gh run watch "$RUN_ID" --exit-status
```

Expected: tests, generation, and commit steps succeed; `data/rank-totals.json` exists on `main`.

- [ ] **Step 5: Verify production invariants independently**

```bash
python - <<'PY'
import json
from pathlib import Path

data = json.loads(Path("data/rank-totals.json").read_text(encoding="utf-8"))
assert data["schemaVersion"] == 1
assert data["source"]["exportFormatVersion"].split(".")[0] == "2"
assert "333" in data["events"]
for event_id, event in data["events"].items():
    for rank_type, bucket in event.items():
        assert bucket["world"] == sum(bucket["countries"].values()), (event_id, rank_type, "countries")
        assert bucket["world"] == sum(bucket["continents"].values()), (event_id, rank_type, "continents")
print(f"verified {len(data['events'])} events from {data['source']['exportDate']}")
PY
```

Expected: prints the verified event count without an assertion failure.

- [ ] **Step 6: Record real measurements in README and commit**

Add the first workflow's acquisition mode, transferred bytes, runtime, export date, and generated JSON size under a `Production benchmark` heading. Use the exact values from the workflow summary and `wc -c data/rank-totals.json`.

```bash
git add README.md data/rank-totals.json
git commit -m "docs: record initial production benchmark"
git push
```

Expected: the repository's README documents measured numbers rather than estimates.

## Generator completion gate

Do not start the Cubify integration plan until all of these are true:

- The public repository exists and its unit suite passes.
- The first real official export run succeeds.
- `data/rank-totals.json` passes independent reconciliation.
- The stable raw URL returns schema version `1`.
- The README records the actual acquisition mode, runtime, transfer, and output size.
