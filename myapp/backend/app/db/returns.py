"""Queries against the returns table."""

from datetime import datetime

from app.db.connection import get_connection
from app.db.schema import RETURNS_COLUMNS


def get_all(status: str | None = None) -> list[dict]:
    """All returns, optionally filtered by status, newest first."""
    with get_connection() as conn:
        cur = conn.cursor()
        if status:
            cur.execute("SELECT * FROM returns WHERE status = ? ORDER BY created_at DESC", (status,))
        else:
            cur.execute("SELECT * FROM returns ORDER BY created_at DESC")
        return [dict(row) for row in cur.fetchall()]


def get_one(return_id: int) -> dict | None:
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM returns WHERE id = ?", (return_id,))
        row = cur.fetchone()
        return dict(row) if row else None


def create(**kwargs) -> int:
    """Insert a return using only recognised columns. Returns the new row's ID."""
    fields = {k: v for k, v in kwargs.items() if k in RETURNS_COLUMNS}
    if "ebay_order_id" not in fields:
        raise ValueError("ebay_order_id is required")

    cols = list(fields.keys())
    col_list = ", ".join(cols)
    placeholders = ", ".join("?" for _ in cols)
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"INSERT INTO returns ({col_list}) VALUES ({placeholders})",
            tuple(fields[c] for c in cols),
        )
        return cur.lastrowid


def update(return_id: int, **kwargs) -> int:
    """Update recognised fields and stamp updated_at. Returns rows affected."""
    fields = {k: v for k, v in kwargs.items() if k in RETURNS_COLUMNS}
    if not fields:
        return 0

    fields["updated_at"] = datetime.now().isoformat(sep=" ", timespec="seconds")
    set_clause = ", ".join(f"{k} = ?" for k in fields)
    values = list(fields.values()) + [return_id]
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(f"UPDATE returns SET {set_clause} WHERE id = ?", values)
        return cur.rowcount


def delete(return_id: int) -> int:
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("DELETE FROM returns WHERE id = ?", (return_id,))
        return cur.rowcount


def get_stats() -> dict:
    """Open count, how many await approval, how many are 25+ days old, and total refunded."""
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

        cur.execute(
            "SELECT COALESCE(SUM(amount_refund_received), 0) FROM returns "
            "WHERE status = 'refund_received'"
        )
        total_refunded = cur.fetchone()[0] or 0

        return {
            "total_open": total_open,
            "pending_approval": pending_approval,
            "urgent": urgent,
            "total_refunded": float(total_refunded),
        }
