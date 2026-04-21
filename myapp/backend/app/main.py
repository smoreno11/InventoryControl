import os
from fastapi import FastAPI
from dotenv import load_dotenv
from pydantic import BaseModel

load_dotenv()
app = FastAPI()

#Confirm the backend server is running and let frontend apps check if the API is live. 
@app.get("/api/health")
def health():
    return {"ok": True, "message": "Saul is testing the backend"}

@app.get("/api/echo")
def echo(msg: str = "hello"):
    return {"msg": msg}


from app.db import create_table, insert_inventory, get_inventory

class InventoryItem(BaseModel):
    date: str
    name: str
    tracking: int
    ebayid: int
    quantity: int
    totalcost: int
    serialnumber: int
    loggedby: str
    notes: str


@app.on_event("startup")
def startup():
    create_table()

@app.post("/api/inventory")
def add_inventory(item: InventoryItem):
    insert_inventory(
        item.date,
        item.name,
        item.tracking,
        item.ebayid,
        item.quantity,
        item.totalcost,
        item.serialnumber,
        item.loggedby,
        item.notes,
    )
    return {"message": "Inventory item added"}

@app.get("/api/inventory")
def read_inventory():
    return get_inventory()

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("API_PORT", "8000"))
    uvicorn.run("app.main:app", host="127.0.0.1", port=port, reload=True)


@app.get("/api/items")
def get_items():
    return [
        {
            "id": 1,
            "name": "PSVR Set",
            "quantity": 13,
            "location": "On Corner Rack",
            "status": "Renewed - Good"
        },
        {
            "id": 2,
            "name": "Power Cable",
            "quantity": 3,
            "location": "Top Shelf Station 7",
            "status": "DAMAGED"
        },
        {
            "id": 3,
            "name": "Meta Quest 2",
            "quantity": 0,
            "location": "Repair Bin",
            "status": "DAMAGED"
        }
    ]