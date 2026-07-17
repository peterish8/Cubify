from __future__ import annotations

import csv
from pathlib import Path
from typing import Iterator

from .model import RankBucket, Region, Totals


class CountingError(ValueError):
    """The official export is structurally inconsistent or unsafe to count."""


def _rows(path: Path, required: set[str]) -> Iterator[dict[str, str]]:
    try:
        stream = path.open("r", encoding="utf-8-sig", newline="")
    except OSError as error:
        raise CountingError(f"{path.name}: cannot open TSV") from error
    with stream:
        reader = csv.DictReader(stream, delimiter="\t")
        fields = reader.fieldnames
        if fields is None:
            raise CountingError(f"{path.name}: missing TSV header")
        if len(fields) != len(set(fields)):
            raise CountingError(f"{path.name}: duplicate TSV column")
        actual = set(fields)
        if not required.issubset(actual):
            missing = ", ".join(sorted(required - actual))
            raise CountingError(f"{path.name}: missing TSV columns: {missing}")
        try:
            for row in reader:
                if None in row:
                    raise CountingError(f"{path.name}: row has extra TSV fields")
                yield row
        except (csv.Error, UnicodeError) as error:
            raise CountingError(f"{path.name}: invalid TSV data") from error


def load_countries(path: Path) -> dict[str, Region]:
    countries: dict[str, Region] = {}
    seen_iso2: set[str] = set()
    for row in _rows(path, {"id", "continent_id", "iso2"}):
        country_id = row["id"].strip()
        iso2 = row["iso2"].strip().upper()
        continent_id = row["continent_id"].strip()
        if not country_id or len(iso2) != 2 or not iso2.isalpha() or not continent_id.startswith("_"):
            raise CountingError(f"{path.name}: incomplete or invalid country row")
        if country_id in countries:
            raise CountingError(f"{path.name}: duplicate country id {country_id}")
        if iso2 in seen_iso2:
            raise CountingError(f"{path.name}: duplicate country ISO2 {iso2}")
        countries[country_id] = Region(iso2=iso2, continent_id=continent_id)
        seen_iso2.add(iso2)
    if not countries:
        raise CountingError(f"{path.name}: no countries")
    return countries


def load_current_people(path: Path, countries: dict[str, Region]) -> dict[str, Region]:
    people: dict[str, Region] = {}
    for row in _rows(path, {"wca_id", "sub_id", "country_id"}):
        try:
            sub_id = int(row["sub_id"].strip())
        except ValueError as error:
            raise CountingError(f"{path.name}: invalid person sub_id") from error
        if sub_id <= 0:
            raise CountingError(f"{path.name}: invalid person sub_id")
        if sub_id != 1:
            continue
        wca_id = row["wca_id"].strip().upper()
        country_id = row["country_id"].strip()
        if not wca_id:
            raise CountingError(f"{path.name}: empty current WCA ID")
        if wca_id in people:
            raise CountingError(f"{path.name}: duplicate current person {wca_id}")
        try:
            people[wca_id] = countries[country_id]
        except KeyError as error:
            raise CountingError(f"{path.name}: unknown country for {wca_id}") from error
    if not people:
        raise CountingError(f"{path.name}: no current people")
    return people


def _parse_rank(value: str, path: Path, event_id: str, person_id: str) -> int:
    try:
        return int(value)
    except (TypeError, ValueError) as error:
        raise CountingError(f"{path.name}: invalid rank for {event_id}/{person_id}") from error


def count_ranks(path: Path, rank_type: str, people: dict[str, Region], totals: Totals) -> None:
    if rank_type not in {"single", "average"}:
        raise CountingError(f"unsupported rank type {rank_type}")
    seen: set[tuple[str, str]] = set()
    required = {"person_id", "event_id", "world_rank", "continent_rank", "country_rank"}
    for row in _rows(path, required):
        person_id = row["person_id"].strip().upper()
        event_id = row["event_id"].strip()
        if not person_id or not event_id:
            raise CountingError(f"{path.name}: empty event or person id")
        key = (event_id, person_id)
        if key in seen:
            raise CountingError(f"{path.name}: duplicate rank row {event_id}/{person_id}")
        seen.add(key)
        # Only world_rank gates inclusion. Official export rows can have 0 continent/country
        # ranks (e.g. data quirks); those values are unused because region comes from persons.
        world_rank = _parse_rank(row["world_rank"], path, event_id, person_id)
        _parse_rank(row["continent_rank"], path, event_id, person_id)
        _parse_rank(row["country_rank"], path, event_id, person_id)
        if world_rank <= 0:
            continue
        try:
            region = people[person_id]
        except KeyError as error:
            raise CountingError(f"{path.name}: missing current person {person_id}") from error
        totals.setdefault(event_id, {}).setdefault(rank_type, RankBucket()).add(region)
