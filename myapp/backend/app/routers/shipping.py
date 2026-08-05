"""Shipping routes, keyed on the 4-digit box number written on a packed box."""

from fastapi import APIRouter, HTTPException

from app.db import workflow as workflow_db

router = APIRouter(prefix="/api", tags=["shipping"])


@router.get("/box-lookup")
def box_lookup(box_number: str):
    """Item details and workflow fields for a given box number."""
    if not box_number.strip():
        raise HTTPException(status_code=400, detail="box_number is required")

    result = workflow_db.get_item_by_box_number(box_number.strip())
    if not result:
        raise HTTPException(status_code=404, detail="No item found with that box number.")
    return result


@router.get("/packed-boxes")
def packed_boxes():
    """Every packed box, newest first."""
    return workflow_db.get_packed_boxes()
