"""Import a CSV export into the INVENTORY table.

Replaces the old ``CVSImport.py``, which ran on import, hardcoded an absolute
path to one developer's machine, and pointed at ``backend/app/inventory.db`` —
a different file from the ``backend/inventory.db`` the API reads. Rows imported
that way never showed up in the app.

Usage::

    python -m app.scripts.import_csv Sheet1.csv            # append (default)
    python -m app.scripts.import_csv Sheet1.csv --replace  # wipe and reload
"""

import argparse
import sqlite3
import sys
from pathlib import Path

from app.config import DB_PATH
from app.db import schema

TABLE = "INVENTORY"


def import_csv(csv_path: Path, db_path: Path, replace: bool) -> int:
    """Load ``csv_path`` into the inventory table. Returns the number of rows written."""
    import pandas as pd  # imported lazily so the API does not depend on pandas

    if not csv_path.is_file():
        raise FileNotFoundError(f"CSV not found: {csv_path}")

    frame = pd.read_csv(csv_path)
    if frame.empty:
        print(f"{csv_path} has no rows — nothing to import.")
        return 0

    # Make sure the table and its migrations exist before writing into it.
    schema.create_all()

    with sqlite3.connect(str(db_path)) as conn:
        frame.to_sql(TABLE, conn, if_exists="replace" if replace else "append", index=False)

    return len(frame)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("csv", type=Path, help="path to the CSV file to import")
    parser.add_argument(
        "--replace",
        action="store_true",
        help="drop existing rows and recreate the table from the CSV "
             "(destructive: this also discards the table's column defaults)",
    )
    parser.add_argument(
        "--db",
        type=Path,
        default=DB_PATH,
        help=f"database to write to (default: {DB_PATH})",
    )
    args = parser.parse_args(argv)

    if args.replace:
        answer = input(f"--replace will delete every row in {TABLE}. Type 'yes' to continue: ")
        if answer.strip().lower() != "yes":
            print("Aborted.")
            return 1

    try:
        count = import_csv(args.csv, args.db, args.replace)
    except FileNotFoundError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    verb = "replaced with" if args.replace else "appended"
    print(f"{count} rows {verb} in {TABLE} ({args.db}).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
