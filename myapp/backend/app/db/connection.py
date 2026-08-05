"""SQLite connection handling."""

import sqlite3

from app.config import DB_PATH


def get_connection() -> sqlite3.Connection:
    """Open a new connection with ``row_factory`` set so rows behave like dicts."""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn
