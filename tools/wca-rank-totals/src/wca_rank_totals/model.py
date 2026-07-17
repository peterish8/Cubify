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
