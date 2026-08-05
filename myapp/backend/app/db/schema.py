"""Table definitions and migrations.

``create_all`` runs on every startup and is safe to re-run: each statement is
``CREATE TABLE IF NOT EXISTS``, and the inventory migration only adds columns
that are missing.
"""

import sqlite3

from app.db.connection import get_connection

# Valid column names for the returns table. Kept next to the CREATE TABLE below
# because the two must stay in sync — the write helpers use this list to drop
# unexpected keyword arguments before they reach SQL.
RETURNS_COLUMNS = [
    "status", "ebay_order_id", "item_name", "quantity", "total_cost",
    "date_received", "serial_number", "logged_by",
    "wms_functional", "wms_case_good", "cd_changer_functional", "cd_changer_case_good",
    "return_reason", "inspection_notes",
    "date_return_open", "return_open_by", "ebay_followup_date",
    "return_label_received", "date_label_received", "ebay_notes",
    "partial_refund_accepted", "partial_refund_amount",
    "michael_approval_date", "approval_notes",
    "rtn_packed_by", "date_contacted_seller", "date_package_returned",
    "return_tracking", "packing_notes",
    "amount_refund_received", "date_refund_received", "refund_notes",
]


def create_all() -> None:
    """Create every table the app needs and migrate older inventory databases."""
    create_inventory_table()
    create_returns_table()
    create_workflow_fields_table()


# ── Inventory ────────────────────────────────────────────────────────────────

def create_inventory_table() -> None:
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
        _migrate_inventory(cur, conn)


def _migrate_inventory(cur: sqlite3.Cursor, conn: sqlite3.Connection) -> None:
    """Add columns missing from older databases and backfill legacy column names."""
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
            cur.execute(
                "UPDATE INVENTORY SET EBAYORDERID = EBAYID "
                "WHERE EBAYORDERID = '' OR EBAYORDERID IS NULL"
            )
        if "QUANTITY" in existing:
            cur.execute(
                "UPDATE INVENTORY SET QTYORDERED = QUANTITY, QTYRECEIVED = QUANTITY "
                "WHERE QTYORDERED = 0"
            )
        cur.execute(
            "UPDATE INVENTORY SET STATUS = 'complete' "
            "WHERE STATUS = 'pending' OR STATUS IS NULL OR STATUS = ''"
        )

    conn.commit()


# ── Returns ──────────────────────────────────────────────────────────────────

def create_returns_table() -> None:
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS returns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                status TEXT NOT NULL DEFAULT 'inspection',
                ebay_order_id TEXT NOT NULL,
                item_name TEXT DEFAULT '',
                quantity INTEGER DEFAULT 0,
                total_cost REAL DEFAULT 0,
                date_received TEXT DEFAULT '',
                serial_number TEXT DEFAULT '',
                logged_by TEXT DEFAULT '',
                wms_functional INTEGER DEFAULT 0,
                wms_case_good INTEGER DEFAULT 0,
                cd_changer_functional INTEGER DEFAULT 0,
                cd_changer_case_good INTEGER DEFAULT 0,
                return_reason TEXT DEFAULT '',
                inspection_notes TEXT DEFAULT '',
                date_return_open TEXT DEFAULT '',
                return_open_by TEXT DEFAULT '',
                ebay_followup_date TEXT DEFAULT '',
                return_label_received INTEGER DEFAULT 0,
                date_label_received TEXT DEFAULT '',
                ebay_notes TEXT DEFAULT '',
                partial_refund_accepted INTEGER DEFAULT 0,
                partial_refund_amount REAL DEFAULT 0,
                michael_approval_date TEXT DEFAULT '',
                approval_notes TEXT DEFAULT '',
                rtn_packed_by TEXT DEFAULT '',
                date_contacted_seller TEXT DEFAULT '',
                date_package_returned TEXT DEFAULT '',
                return_tracking TEXT DEFAULT '',
                packing_notes TEXT DEFAULT '',
                amount_refund_received REAL DEFAULT 0,
                date_refund_received TEXT DEFAULT '',
                refund_notes TEXT DEFAULT '',
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            )
        """)
        conn.commit()


# ── Workflow fields ──────────────────────────────────────────────────────────

def create_workflow_fields_table() -> None:
    """One row per (serial number, field) pair — e.g. who packed a given unit."""
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS workflow_fields (
                serial_number TEXT NOT NULL,
                field         TEXT NOT NULL,
                value         TEXT NOT NULL DEFAULT '',
                updated_at    TEXT DEFAULT (datetime('now')),
                PRIMARY KEY (serial_number, field)
            )
        """)
        conn.commit()
