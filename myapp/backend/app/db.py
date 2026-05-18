import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "inventory.db"


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def create_table():
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS INVENTORY (
                STATUS       TEXT DEFAULT 'pending',
                DATE         TEXT,
                NAME         TEXT DEFAULT '',
                TRACKING     TEXT DEFAULT '',
                EBAYORDERID  TEXT DEFAULT '',
                QTYORDERED   INTEGER DEFAULT 0,
                TOTALCOST    REAL DEFAULT 0,
                ITEMTYPE     TEXT DEFAULT '',
                QTYRECEIVED  INTEGER DEFAULT 0,
                SERIALNUMBER TEXT DEFAULT '',
                LOGGEDBY     TEXT DEFAULT '',
                NOTES        TEXT DEFAULT ''
            )
        """)
        conn.commit()
        _migrate_schema(cur, conn)


def _migrate_schema(cur, conn):
    cur.execute("PRAGMA table_info(INVENTORY)")
    existing = {row[1] for row in cur.fetchall()}

    is_old_schema = "STATUS" not in existing

    new_cols = [
        ("STATUS",       "TEXT DEFAULT 'pending'"),
        ("ITEMTYPE",     "TEXT DEFAULT ''"),
        ("QTYORDERED",   "INTEGER DEFAULT 0"),
        ("QTYRECEIVED",  "INTEGER DEFAULT 0"),
        ("EBAYORDERID",  "TEXT DEFAULT ''"),
        ("NAME",         "TEXT DEFAULT ''"),
        ("TRACKING",     "TEXT DEFAULT ''"),
    ]
    for col, defn in new_cols:
        if col not in existing:
            cur.execute(f"ALTER TABLE INVENTORY ADD COLUMN {col} {defn}")

    if is_old_schema:
        if "EBAYID" in existing:
            cur.execute("UPDATE INVENTORY SET EBAYORDERID = EBAYID WHERE EBAYORDERID = '' OR EBAYORDERID IS NULL")
        if "QUANTITY" in existing:
            cur.execute("UPDATE INVENTORY SET QTYORDERED = QUANTITY, QTYRECEIVED = QUANTITY WHERE QTYORDERED = 0")
        cur.execute("UPDATE INVENTORY SET STATUS = 'complete' WHERE STATUS = 'pending' OR STATUS IS NULL OR STATUS = ''")

    conn.commit()


def insert_pending(date: str, name: str, tracking: str, ebayorderid: str,
                   qtyordered: int, totalcost: float) -> int:
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO INVENTORY (STATUS, DATE, NAME, TRACKING, EBAYORDERID, QTYORDERED, TOTALCOST)
            VALUES ('pending', ?, ?, ?, ?, ?, ?)
        """, (date, name, tracking, ebayorderid, qtyordered, totalcost))
        return cur.lastrowid


def complete_item(item_id: int, itemtype: str, qtyreceived: int,
                  serialnumber: str, loggedby: str, notes: str) -> int:
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            UPDATE INVENTORY
            SET STATUS='complete', ITEMTYPE=?, QTYRECEIVED=?, SERIALNUMBER=?, LOGGEDBY=?, NOTES=?
            WHERE rowid=?
        """, (itemtype, qtyreceived, serialnumber, loggedby, notes, item_id))
        return cur.rowcount


def insert_full(date: str, name: str, tracking: str, ebayorderid: str,
                qtyordered: int, totalcost: float, itemtype: str,
                qtyreceived: int, serialnumber: str, loggedby: str, notes: str):
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO INVENTORY
            (STATUS, DATE, NAME, TRACKING, EBAYORDERID, QTYORDERED, TOTALCOST,
             ITEMTYPE, QTYRECEIVED, SERIALNUMBER, LOGGEDBY, NOTES)
            VALUES ('complete', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (date, name, tracking, ebayorderid, qtyordered, totalcost,
              itemtype, qtyreceived, serialnumber, loggedby, notes))


def get_pending() -> list[dict]:
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT rowid as id, * FROM INVENTORY WHERE STATUS='pending' ORDER BY DATE DESC")
        return [dict(row) for row in cur.fetchall()]


def get_complete() -> list[dict]:
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            SELECT rowid as id, * FROM INVENTORY
            WHERE STATUS='complete'
            ORDER BY ITEMTYPE COLLATE NOCASE, DATE DESC
        """)
        return [dict(row) for row in cur.fetchall()]


def get_inventory() -> list[dict]:
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT rowid as id, * FROM INVENTORY ORDER BY STATUS, ITEMTYPE COLLATE NOCASE, DATE DESC")
        return [dict(row) for row in cur.fetchall()]
