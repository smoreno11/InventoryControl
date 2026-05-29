import random
import sqlite3
from datetime import datetime
from pathlib import Path

# Path to the SQLite database file, resolved relative to this file so it works regardless of working directory.
DB_PATH = Path(__file__).resolve().parent.parent / "inventory.db"


# Opens and returns a new SQLite connection with row_factory set so rows behave like dicts.
def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


# Creates the INVENTORY table if it doesn't exist, then runs the migration to add any missing columns.
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


# Adds any columns missing from older database versions and backfills data from legacy column names.
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


# Inserts a new pending shipment row and returns its row ID.
def insert_pending(date: str, name: str, tracking: str, ebayorderid: str,
                   qtyordered: int, totalcost: float) -> int:
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO INVENTORY (STATUS, DATE, NAME, TRACKING, EBAYORDERID, QTYORDERED, TOTALCOST)
            VALUES ('pending', ?, ?, ?, ?, ?, ?)
        """, (date, name, tracking, ebayorderid, qtyordered, totalcost))
        return cur.lastrowid


# Marks a pending item as complete by filling in inspection fields; returns the number of rows affected.
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


# Inserts a fully filled-out inventory item directly as complete, skipping the pending step.
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


# Returns all pending inventory rows ordered by date descending.
def get_pending() -> list[dict]:
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT rowid as id, * FROM INVENTORY WHERE STATUS='pending' ORDER BY DATE DESC")
        return [dict(row) for row in cur.fetchall()]


# Returns all completed inventory rows grouped by item type then sorted by date descending.
def get_complete() -> list[dict]:
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            SELECT rowid as id, * FROM INVENTORY
            WHERE STATUS='complete'
            ORDER BY ITEMTYPE COLLATE NOCASE, DATE DESC
        """)
        return [dict(row) for row in cur.fetchall()]


# Returns every inventory row ordered by status, then item type, then date.
def get_inventory() -> list[dict]:
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT rowid as id, * FROM INVENTORY ORDER BY STATUS, ITEMTYPE COLLATE NOCASE, DATE DESC")
        return [dict(row) for row in cur.fetchall()]


# Returns

# All valid column names for the returns table, used to filter out any unexpected kwargs before hitting the DB.
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


# Creates the returns table if it doesn't exist. Safe to call on every startup.
def create_returns_table():
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


# Returns all returns, optionally filtered by status, ordered newest first.
def get_returns(status: str | None = None) -> list[dict]:
    with get_connection() as conn:
        cur = conn.cursor()
        if status:
            cur.execute("SELECT * FROM returns WHERE status = ? ORDER BY created_at DESC", (status,))
        else:
            cur.execute("SELECT * FROM returns ORDER BY created_at DESC")
        return [dict(row) for row in cur.fetchall()]


# Returns a single return by ID, or None if not found.
def get_return(return_id: int) -> dict | None:
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM returns WHERE id = ?", (return_id,))
        row = cur.fetchone()
        return dict(row) if row else None


# Inserts a new return row using only the fields that exist in RETURNS_COLUMNS; returns the new row's ID.
def create_return(**kwargs) -> int:
    fields = {k: v for k, v in kwargs.items() if k in RETURNS_COLUMNS}
    if "ebay_order_id" not in fields:
        raise ValueError("ebay_order_id is required")
    cols = list(fields.keys())
    placeholders = ", ".join("?" for _ in cols)
    col_list = ", ".join(cols)
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"INSERT INTO returns ({col_list}) VALUES ({placeholders})",
            tuple(fields[c] for c in cols),
        )
        return cur.lastrowid


# Updates any valid fields on an existing return and stamps updated_at; returns the number of rows affected.
def update_return(return_id: int, **kwargs) -> int:
    fields = {k: v for k, v in kwargs.items() if k in RETURNS_COLUMNS}
    if not fields:
        return 0
    fields["updated_at"] = datetime.now().isoformat(sep=" ", timespec="seconds")
    set_clause = ", ".join(f"{k} = ?" for k in fields.keys())
    values = list(fields.values()) + [return_id]
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(f"UPDATE returns SET {set_clause} WHERE id = ?", values)
        return cur.rowcount


# Deletes a return by ID and returns the number of rows affected (0 if not found).
def delete_return(return_id: int) -> int:
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("DELETE FROM returns WHERE id = ?", (return_id,))
        return cur.rowcount


# Returns summary stats: total open returns, how many are pending approval, how many are urgent (25+ days open), and total amount refunded.
def get_returns_stats() -> dict:
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM returns WHERE status != 'refund_received'")
        total_open = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM returns WHERE status = 'pending_approval'")
        pending_approval = cur.fetchone()[0]

        cur.execute("""
            SELECT COUNT(*) FROM returns
            WHERE status != 'refund_received'
              AND date_return_open IS NOT NULL
              AND date_return_open != ''
              AND julianday('now') - julianday(date_return_open) >= 25
        """)
        urgent = cur.fetchone()[0]

        cur.execute("SELECT COALESCE(SUM(amount_refund_received), 0) FROM returns WHERE status = 'refund_received'")
        total_refunded = cur.fetchone()[0] or 0
        return {
            "total_open": total_open,
            "pending_approval": pending_approval,
            "urgent": urgent,
            "total_refunded": float(total_refunded),
        }


# Looks up an inventory row by eBay order ID, checking both EBAYORDERID and the legacy EBAYID column if it exists.
def lookup_inventory_by_ebay_order(ebay_order_id: str) -> dict | None:
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("PRAGMA table_info(INVENTORY)")
        cols = {row[1] for row in cur.fetchall()}
        clauses = []
        if "EBAYORDERID" in cols:
            clauses.append("EBAYORDERID = ?")
        if "EBAYID" in cols:
            clauses.append("EBAYID = ?")
        if not clauses:
            return None
        where = " OR ".join(clauses)
        params = tuple([ebay_order_id] * len(clauses))
        cur.execute(f"SELECT rowid as id, * FROM INVENTORY WHERE {where} LIMIT 1", params)
        row = cur.fetchone()
        return dict(row) if row else None


# Workflow Fields

# Creates the workflow_fields table if it doesn't exist. Stores one row per serial+field combination.
def create_workflow_fields_table():
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


# Returns all saved workflow field values for a given serial number, including the timestamp of when each was set.
def get_workflow_fields(serial_number: str) -> dict:
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT field, value, updated_at FROM workflow_fields WHERE serial_number = ?", (serial_number,))
        return {row["field"]: {"value": row["value"], "timestamp": row["updated_at"]} for row in cur.fetchall()}


# Inserts or updates a single workflow field value for a serial number.
# If the field being saved is PACKEDBY and no BOX_NUMBER exists yet, auto-generates one.
def set_workflow_field(serial_number: str, field: str, value: str):
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO workflow_fields (serial_number, field, value, updated_at)
            VALUES (?, ?, ?, datetime('now'))
            ON CONFLICT(serial_number, field) DO UPDATE SET
                value = excluded.value,
                updated_at = excluded.updated_at
        """, (serial_number, field, value))
        # Auto-assign a 4-digit box number the first time an item is packed.
        if field == "PACKEDBY" and value:
            cur.execute(
                "SELECT 1 FROM workflow_fields WHERE serial_number=? AND field='BOX_NUMBER'",
                (serial_number,),
            )
            if cur.fetchone() is None:
                box_num = str(random.randint(1000, 9999))
                cur.execute("""
                    INSERT INTO workflow_fields (serial_number, field, value, updated_at)
                    VALUES (?, 'BOX_NUMBER', ?, datetime('now'))
                """, (serial_number, box_num))
        conn.commit()


# Returns the inventory item and all workflow fields for a given 4-digit box number, or None if not found.
def get_item_by_box_number(box_number: str) -> dict | None:
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT serial_number FROM workflow_fields WHERE field='BOX_NUMBER' AND value=?",
            (box_number,),
        )
        row = cur.fetchone()
        if not row:
            return None
        serial = row["serial_number"]
        cur.execute("SELECT rowid as id, * FROM INVENTORY WHERE SERIALNUMBER=? LIMIT 1", (serial,))
        item_row = cur.fetchone()
        cur.execute(
            "SELECT field, value, updated_at FROM workflow_fields WHERE serial_number=?",
            (serial,),
        )
        fields = {r["field"]: {"value": r["value"], "timestamp": r["updated_at"]} for r in cur.fetchall()}
        return {
            "serial_number": serial,
            "box_number": box_number,
            "item": dict(item_row) if item_row else None,
            "workflow_fields": fields,
        }


# Returns all items that have been assigned a box number, newest first, with outgoing tracking if set.
def get_packed_boxes() -> list[dict]:
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            SELECT bn.serial_number,
                   bn.value       AS box_number,
                   bn.updated_at  AS packed_at,
                   ot.value       AS outgoing_tracking
            FROM workflow_fields bn
            LEFT JOIN workflow_fields ot
                   ON ot.serial_number = bn.serial_number AND ot.field = 'OUTGOING_TRACKING'
            WHERE bn.field = 'BOX_NUMBER'
            ORDER BY bn.updated_at DESC
        """)
        rows = cur.fetchall()
        result = []
        for row in rows:
            serial = row["serial_number"]
            cur.execute("SELECT rowid as id, * FROM INVENTORY WHERE SERIALNUMBER=? LIMIT 1", (serial,))
            item_row = cur.fetchone()
            result.append({
                "serial_number": serial,
                "box_number": row["box_number"],
                "packed_at": row["packed_at"],
                "outgoing_tracking": row["outgoing_tracking"] or "",
                "item": dict(item_row) if item_row else None,
            })
        return result
