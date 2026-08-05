"""Inventory routes: pending shipments, receipt logging, and lookup."""

from fastapi import APIRouter, HTTPException

from app.db import inventory as inventory_db
from app.schemas.inventory import CompleteUpdate, FullItem, PendingItem
from app.validation import FieldErrors

router = APIRouter(prefix="/api", tags=["inventory"])


@router.get("/items")
def get_items():
    return inventory_db.get_all()


@router.get("/pending")
def get_pending():
    return inventory_db.get_pending()


@router.get("/complete")
def get_complete():
    return inventory_db.get_complete()


@router.post("/pending", status_code=201)
def add_pending(item: PendingItem):
    errors = FieldErrors()
    date = errors.require(item.date, "Date")
    errors.raise_if_any()

    row_id = inventory_db.insert_pending(
        date, item.name.strip(), item.tracking.strip(),
        item.ebayorderid.strip(), item.qtyordered, item.totalcost,
    )
    return {"ok": True, "id": row_id}


@router.put("/inventory/{item_id}/complete")
def complete_item(item_id: int, update: CompleteUpdate):
    errors = FieldErrors()
    itemtype = errors.require(update.itemtype, "Item Type")
    serialnumber = errors.require(update.serialnumber, "Serial Number")
    loggedby = errors.require(update.loggedby, "Logged By")
    if update.qtyreceived < 1:
        errors.add("Qty Received must be at least 1.")
    errors.raise_if_any()

    affected = inventory_db.complete_item(
        item_id, itemtype, update.qtyreceived, serialnumber, loggedby, update.notes,
    )
    if affected == 0:
        raise HTTPException(status_code=404, detail="Item not found.")
    return {"ok": True}


@router.post("/inventory", status_code=201)
def add_full_item(item: FullItem):
    errors = FieldErrors()
    date = errors.require(item.date, "Date")
    itemtype = errors.require(item.itemtype, "Item Type")
    serialnumber = errors.require(item.serialnumber, "Serial Number")
    loggedby = errors.require(item.loggedby, "Logged By")
    errors.raise_if_any()

    inventory_db.insert_full(
        date, item.name.strip(), item.tracking.strip(),
        item.ebayorderid.strip(), item.qtyordered, item.totalcost,
        itemtype, item.qtyreceived, serialnumber, loggedby, item.notes,
    )
    return {"ok": True}


@router.get("/inventory/lookup")
def inventory_lookup(ebay_order_id: str):
    """Used by the returns wizard to auto-fill an item from its eBay order ID."""
    if not ebay_order_id.strip():
        raise HTTPException(status_code=400, detail="ebay_order_id is required")

    row = inventory_db.lookup_by_ebay_order(ebay_order_id.strip())
    if not row:
        raise HTTPException(status_code=404, detail="No inventory found for that eBay order ID.")
    return row
