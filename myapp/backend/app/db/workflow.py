"""Queries against the workflow_fields table, plus the box-number lookups built on it.

A workflow field records who did something to a unit (TESTEDBY, PACKEDBY,
SHIPPEDBY, RETURNEDBY) or a value attached to it (BOX_NUMBER,
OUTGOING_TRACKING), keyed by serial number.
"""

import random

from app.db.connection import get_connection

BOX_NUMBER_FIELD = "BOX_NUMBER"
PACKED_BY_FIELD = "PACKEDBY"
OUTGOING_TRACKING_FIELD = "OUTGOING_TRACKING"


def get_fields(serial_number: str) -> dict:
    """All saved fields for a serial number, each with the time it was set."""
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT field, value, updated_at FROM workflow_fields WHERE serial_number = ?",
            (serial_number,),
        )
        return {
            row["field"]: {"value": row["value"], "timestamp": row["updated_at"]}
            for row in cur.fetchall()
        }


def set_field(serial_number: str, field: str, value: str) -> None:
    """Insert or update one field. Packing a unit for the first time assigns it a box number."""
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO workflow_fields (serial_number, field, value, updated_at)
            VALUES (?, ?, ?, datetime('now'))
            ON CONFLICT(serial_number, field) DO UPDATE SET
                value = excluded.value,
                updated_at = excluded.updated_at
        """, (serial_number, field, value))

        if field == PACKED_BY_FIELD and value:
            _assign_box_number_if_missing(cur, serial_number)

        conn.commit()


def _assign_box_number_if_missing(cur, serial_number: str) -> None:
    """Give a newly packed unit a 4-digit box number, unless it already has one."""
    cur.execute(
        "SELECT 1 FROM workflow_fields WHERE serial_number=? AND field=?",
        (serial_number, BOX_NUMBER_FIELD),
    )
    if cur.fetchone() is not None:
        return

    box_number = str(random.randint(1000, 9999))
    cur.execute("""
        INSERT INTO workflow_fields (serial_number, field, value, updated_at)
        VALUES (?, ?, ?, datetime('now'))
    """, (serial_number, BOX_NUMBER_FIELD, box_number))


def get_item_by_box_number(box_number: str) -> dict | None:
    """The inventory item and all workflow fields behind a 4-digit box number."""
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT serial_number FROM workflow_fields WHERE field=? AND value=?",
            (BOX_NUMBER_FIELD, box_number),
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
        fields = {
            r["field"]: {"value": r["value"], "timestamp": r["updated_at"]}
            for r in cur.fetchall()
        }

        return {
            "serial_number": serial,
            "box_number": box_number,
            "item": dict(item_row) if item_row else None,
            "workflow_fields": fields,
        }


def get_packed_boxes() -> list[dict]:
    """Every unit with a box number, newest first, with outgoing tracking if set."""
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            SELECT bn.serial_number,
                   bn.value       AS box_number,
                   bn.updated_at  AS packed_at,
                   ot.value       AS outgoing_tracking
            FROM workflow_fields bn
            LEFT JOIN workflow_fields ot
                   ON ot.serial_number = bn.serial_number AND ot.field = ?
            WHERE bn.field = ?
            ORDER BY bn.updated_at DESC
        """, (OUTGOING_TRACKING_FIELD, BOX_NUMBER_FIELD))
        rows = cur.fetchall()

        # Looked up one at a time rather than joined: a serial number can appear
        # more than once in INVENTORY, and only the first match belongs here.
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
