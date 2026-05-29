import os
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pydantic import BaseModel, ConfigDict
from app import db
from app.upload import router as upload_router

load_dotenv()
app = FastAPI(title="Inventory Control API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload_router)

# ── Models ───────────────────────────────────────────────────────────────────

class PendingItem(BaseModel):
    date: str
    name: str = ""
    tracking: str = ""
    ebayorderid: str = ""
    qtyordered: int = 0
    totalcost: float = 0.0


class CompleteUpdate(BaseModel):
    itemtype: str
    qtyreceived: int
    serialnumber: str
    loggedby: str
    notes: str = ""


class FullItem(BaseModel):
    date: str
    name: str = ""
    tracking: str = ""
    ebayorderid: str = ""
    qtyordered: int = 0
    totalcost: float = 0.0
    itemtype: str
    qtyreceived: int
    serialnumber: str
    loggedby: str
    notes: str = ""


# ── Startup ──────────────────────────────────────────────────────────────────

class ReturnCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    ebay_order_id: str
    item_name: Optional[str] = ""
    quantity: Optional[int] = 0
    total_cost: Optional[float] = 0.0
    date_received: Optional[str] = ""
    serial_number: Optional[str] = ""
    logged_by: Optional[str] = ""
    wms_functional: Optional[int] = 0
    wms_case_good: Optional[int] = 0
    cd_changer_functional: Optional[int] = 0
    cd_changer_case_good: Optional[int] = 0
    return_reason: Optional[str] = ""
    inspection_notes: Optional[str] = ""
    status: Optional[str] = "inspection"


class ReturnUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    status: Optional[str] = None
    ebay_order_id: Optional[str] = None
    item_name: Optional[str] = None
    quantity: Optional[int] = None
    total_cost: Optional[float] = None
    date_received: Optional[str] = None
    serial_number: Optional[str] = None
    logged_by: Optional[str] = None
    wms_functional: Optional[int] = None
    wms_case_good: Optional[int] = None
    cd_changer_functional: Optional[int] = None
    cd_changer_case_good: Optional[int] = None
    return_reason: Optional[str] = None
    inspection_notes: Optional[str] = None
    date_return_open: Optional[str] = None
    return_open_by: Optional[str] = None
    ebay_followup_date: Optional[str] = None
    return_label_received: Optional[int] = None
    date_label_received: Optional[str] = None
    ebay_notes: Optional[str] = None
    partial_refund_accepted: Optional[int] = None
    partial_refund_amount: Optional[float] = None
    michael_approval_date: Optional[str] = None
    approval_notes: Optional[str] = None
    rtn_packed_by: Optional[str] = None
    date_contacted_seller: Optional[str] = None
    date_package_returned: Optional[str] = None
    return_tracking: Optional[str] = None
    packing_notes: Optional[str] = None
    amount_refund_received: Optional[float] = None
    date_refund_received: Optional[str] = None
    refund_notes: Optional[str] = None


@app.on_event("startup")
def on_startup():
    db.create_table()
    db.create_returns_table()
    db.create_workflow_fields_table()


# ── Routes ───────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/items")
def get_items():
    return db.get_inventory()


@app.get("/api/pending")
def get_pending():
    return db.get_pending()


@app.get("/api/complete")
def get_complete():
    return db.get_complete()


@app.post("/api/pending", status_code=201)
def add_pending(item: PendingItem):
    if not item.date.strip():
        raise HTTPException(status_code=400, detail="Date is required.")
    row_id = db.insert_pending(
        item.date.strip(), item.name.strip(), item.tracking.strip(),
        item.ebayorderid.strip(), item.qtyordered, item.totalcost,
    )
    return {"ok": True, "id": row_id}


@app.put("/api/inventory/{item_id}/complete")
def complete_item(item_id: int, update: CompleteUpdate):
    errors = []
    if not update.itemtype.strip():
        errors.append("Item Type is required.")
    if not update.serialnumber.strip():
        errors.append("Serial Number is required.")
    if not update.loggedby.strip():
        errors.append("Logged By is required.")
    if update.qtyreceived < 1:
        errors.append("Qty Received must be at least 1.")
    if errors:
        raise HTTPException(status_code=400, detail=" ".join(errors))

    affected = db.complete_item(
        item_id, update.itemtype.strip(), update.qtyreceived,
        update.serialnumber.strip(), update.loggedby.strip(), update.notes,
    )
    if affected == 0:
        raise HTTPException(status_code=404, detail="Item not found.")
    return {"ok": True}


@app.post("/api/inventory", status_code=201)
def add_full_item(item: FullItem):
    errors = []
    if not item.date.strip():
        errors.append("Date is required.")
    if not item.itemtype.strip():
        errors.append("Item Type is required.")
    if not item.serialnumber.strip():
        errors.append("Serial Number is required.")
    if not item.loggedby.strip():
        errors.append("Logged By is required.")
    if errors:
        raise HTTPException(status_code=400, detail=" ".join(errors))

    db.insert_full(
        item.date.strip(), item.name.strip(), item.tracking.strip(),
        item.ebayorderid.strip(), item.qtyordered, item.totalcost,
        item.itemtype.strip(), item.qtyreceived,
        item.serialnumber.strip(), item.loggedby.strip(), item.notes,
    )
    return {"ok": True}


# Returns routes

@app.get("/api/inventory/lookup")
def inventory_lookup(ebay_order_id: str):
    if not ebay_order_id.strip():
        raise HTTPException(status_code=400, detail="ebay_order_id is required")
    row = db.lookup_inventory_by_ebay_order(ebay_order_id.strip())
    if not row:
        raise HTTPException(status_code=404, detail="No inventory found for that eBay order ID.")
    return row


@app.get("/api/returns/stats")
def returns_stats():
    return db.get_returns_stats()


@app.get("/api/returns")
def list_returns(status: Optional[str] = None):
    return db.get_returns(status=status)


@app.get("/api/returns/{return_id}")
def get_one_return(return_id: int):
    row = db.get_return(return_id)
    if not row:
        raise HTTPException(status_code=404, detail="Return not found.")
    return row


@app.post("/api/returns", status_code=201)
def create_return_route(payload: ReturnCreate):
    if not payload.ebay_order_id.strip():
        raise HTTPException(status_code=400, detail="ebay_order_id is required")
    data = payload.model_dump()
    data["ebay_order_id"] = data["ebay_order_id"].strip()
    new_id = db.create_return(**data)
    return {"ok": True, "id": new_id, "item": db.get_return(new_id)}


@app.patch("/api/returns/{return_id}")
def patch_return(return_id: int, payload: ReturnUpdate):
    fields = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
    if not fields:
        raise HTTPException(status_code=400, detail="No fields to update.")
    affected = db.update_return(return_id, **fields)
    if affected == 0:
        existing = db.get_return(return_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Return not found.")
    return {"ok": True, "item": db.get_return(return_id)}


@app.delete("/api/returns/{return_id}")
def delete_return_route(return_id: int):
    affected = db.delete_return(return_id)
    if affected == 0:
        raise HTTPException(status_code=404, detail="Return not found.")
    return {"ok": True}


# Shipping / box-number routes

# Returns item info + workflow fields for a given 4-digit box number.
@app.get("/api/box-lookup")
def box_lookup(box_number: str):
    if not box_number.strip():
        raise HTTPException(status_code=400, detail="box_number is required")
    result = db.get_item_by_box_number(box_number.strip())
    if not result:
        raise HTTPException(status_code=404, detail="No item found with that box number.")
    return result


# Returns all items that have been packed (have a BOX_NUMBER assigned), newest first.
@app.get("/api/packed-boxes")
def packed_boxes():
    return db.get_packed_boxes()


# Workflow field routes

class WorkflowFieldUpdate(BaseModel):
    serial_number: str
    field: str
    value: str

# Returns all saved workflow field values for a given serial number.
@app.get("/api/workflow-fields")
def get_workflow_fields(serial_number: str):
    if not serial_number.strip():
        raise HTTPException(status_code=400, detail="serial_number is required")
    return db.get_workflow_fields(serial_number.strip())

# Saves a single workflow field value for a serial number.
@app.post("/api/update-field")
def update_field(payload: WorkflowFieldUpdate):
    if not payload.serial_number.strip():
        raise HTTPException(status_code=400, detail="serial_number is required")
    if not payload.field.strip():
        raise HTTPException(status_code=400, detail="field is required")
    db.set_workflow_field(payload.serial_number.strip(), payload.field.strip(), payload.value.strip())
    return {"ok": True}


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("API_PORT", "8000"))
    uvicorn.run("app.main:app", host="127.0.0.1", port=port, reload=True)
