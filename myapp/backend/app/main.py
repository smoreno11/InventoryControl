import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pydantic import BaseModel
from app import db

load_dotenv()
app = FastAPI(title="Inventory Control API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


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

@app.on_event("startup")
def on_startup():
    db.create_table()


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


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("API_PORT", "8000"))
    uvicorn.run("app.main:app", host="127.0.0.1", port=port, reload=True)
