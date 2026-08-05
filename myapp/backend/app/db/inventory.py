"""Queries against the INVENTORY table."""

from app.db.connection import get_connection


def insert_pending(date: str, name: str, tracking: str, ebayorderid: str,
                   qtyordered: int, totalcost: float) -> int:
    """Insert a pending shipment row and return its row ID."""
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO INVENTORY (STATUS, DATE, NAME, TRACKING, EBAYORDERID, QTYORDERED, TOTALCOST)
            VALUES ('pending', ?, ?, ?, ?, ?, ?)
        """, (date, name, tracking, ebayorderid, qtyordered, totalcost))
        return cur.lastrowid


def complete_item(item_id: int, itemtype: str, qtyreceived: int,
                  serialnumber: str, loggedby: str, notes: str) -> int:
    """Fill in a pending row's inspection fields. Returns rows affected."""
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
                qtyreceived: int, serialnumber: str, loggedby: str, notes: str) -> None:
    """Insert an already-inspected item directly as complete, skipping the pending step."""
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
    """All pending rows, newest first."""
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT rowid as id, * FROM INVENTORY WHERE STATUS='pending' ORDER BY DATE DESC")
        return [dict(row) for row in cur.fetchall()]


def get_complete() -> list[dict]:
    """All completed rows, grouped by item type then newest first."""
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            SELECT rowid as id, * FROM INVENTORY
            WHERE STATUS='complete'
            ORDER BY ITEMTYPE COLLATE NOCASE, DATE DESC
        """)
        return [dict(row) for row in cur.fetchall()]


def get_all() -> list[dict]:
    """Every row, ordered by status, then item type, then date."""
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT rowid as id, * FROM INVENTORY "
            "ORDER BY STATUS, ITEMTYPE COLLATE NOCASE, DATE DESC"
        )
        return [dict(row) for row in cur.fetchall()]


def lookup_by_ebay_order(ebay_order_id: str) -> dict | None:
    """Find a row by eBay order ID, checking the legacy EBAYID column too."""
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
