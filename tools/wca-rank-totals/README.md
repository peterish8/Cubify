# WCA Rank Totals Generator

This folder contains Cubify's no-database data pipeline. It converts the official WCA Results Export into exact per-event world, continent, and country counts for competitors with valid official single or average rankings.

The generator reads only these four archive members:

- `WCA_export_countries.tsv`
- `WCA_export_persons.tsv`
- `WCA_export_ranks_single.tsv`
- `WCA_export_ranks_average.tsv`

It uses Python 3.12's standard library only. There is no SQL database, Supabase project, API server, or runtime package installation. It first tries selective HTTP byte-range access and safely falls back to the complete ZIP. Files from an acquisition attempt are staged and promoted together only after every required member is readable.

From this directory, run:

```sh
PYTHONPATH=src python -m unittest discover -s tests -v
PYTHONPATH=src python -m wca_rank_totals.cli
```

The default staging output is this tool's `data/rank-totals.json`, regardless of the caller's current directory. Cubify's workflow publishes that validated file as `/data/rank-totals.json` on the dedicated `rank-data` branch. The CLI validates an existing output before treating an export as unchanged. Any metadata, acquisition, parsing, reconciliation, or schema error leaves the previous file untouched.

This information is based on competition results owned and maintained by the World Cube Association, published at https://worldcubeassociation.org/results. The exact export date and archive URL are stored in the generated JSON.
