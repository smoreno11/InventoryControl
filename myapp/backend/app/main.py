import os
from fastapi import FastAPI
from dotenv import load_dotenv
from pydantic import BaseModel
from typing import List
from app.db import create_table, insert_inventory, get_inventory

load_dotenv()
app = FastAPI()

class InventoryItem(BaseModel):
    DATE: str
    NAME: str
    TRACKING: int
    EBAYID: str
    QUANTITY: int
    TOTALCOST: float
    SERIALNUMBER: str
    LOGGEDBY: str
    NOTES: str

@app.on_event("startup")
def startup():
    create_table()

@app.get("/api/health")
def health():
    return {"ok": True, "message": "Saul is testing the backend"}

@app.get("/api/echo")
def echo(msg: str = "hello"):
    return {"msg": msg}

@app.post("/api/inventory")
def add_inventory(item: InventoryItem):
    insert_inventory(
        item.DATE,
        item.NAME,
        item.TRACKING,
        item.EBAYID,
        item.QUANTITY,
        item.TOTALCOST,
        item.SERIALNUMBER,
        item.LOGGEDBY,
        item.NOTES,
    )
    return {"message": "Inventory item added"}

@app.get("/api/items", response_model=List[InventoryItem])
def get_items():
    return get_inventory()

@app.get("/api/inventory", response_model=List[InventoryItem])
def read_inventory():
    return get_inventory()

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("API_PORT", "8000"))
    uvicorn.run("app.main:app", host="127.0.0.1", port=port, reload=True)