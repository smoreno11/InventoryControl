"""eBay return routes: the five-stage workflow from inspection to refund."""

from typing import Optional

from fastapi import APIRouter, HTTPException

from app.db import returns as returns_db
from app.schemas.returns import ReturnCreate, ReturnUpdate

router = APIRouter(prefix="/api", tags=["returns"])


# Declared before /returns/{return_id} so "stats" is not parsed as an ID.
@router.get("/returns/stats")
def returns_stats():
    return returns_db.get_stats()


@router.get("/returns")
def list_returns(status: Optional[str] = None):
    return returns_db.get_all(status=status)


@router.get("/returns/{return_id}")
def get_one_return(return_id: int):
    row = returns_db.get_one(return_id)
    if not row:
        raise HTTPException(status_code=404, detail="Return not found.")
    return row


@router.post("/returns", status_code=201)
def create_return(payload: ReturnCreate):
    if not payload.ebay_order_id.strip():
        raise HTTPException(status_code=400, detail="ebay_order_id is required")

    data = payload.model_dump()
    data["ebay_order_id"] = data["ebay_order_id"].strip()
    new_id = returns_db.create(**data)
    return {"ok": True, "id": new_id, "item": returns_db.get_one(new_id)}


@router.patch("/returns/{return_id}")
def patch_return(return_id: int, payload: ReturnUpdate):
    fields = payload.model_dump(exclude_none=True)
    if not fields:
        raise HTTPException(status_code=400, detail="No fields to update.")

    affected = returns_db.update(return_id, **fields)
    # A no-op update is fine, but a missing row is not.
    if affected == 0 and not returns_db.get_one(return_id):
        raise HTTPException(status_code=404, detail="Return not found.")
    return {"ok": True, "item": returns_db.get_one(return_id)}


@router.delete("/returns/{return_id}")
def delete_return(return_id: int):
    if returns_db.delete(return_id) == 0:
        raise HTTPException(status_code=404, detail="Return not found.")
    return {"ok": True}
