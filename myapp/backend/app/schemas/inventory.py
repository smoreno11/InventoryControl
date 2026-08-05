"""Request bodies for the inventory routes."""

from pydantic import BaseModel


class PendingItem(BaseModel):
    """A shipment logged before it arrives."""

    date: str
    name: str = ""
    tracking: str = ""
    ebayorderid: str = ""
    qtyordered: int = 0
    totalcost: float = 0.0


class CompleteUpdate(BaseModel):
    """Inspection details filled in when a pending shipment is received."""

    itemtype: str
    qtyreceived: int
    serialnumber: str
    loggedby: str
    notes: str = ""


class FullItem(PendingItem):
    """A shipment and its inspection recorded in one step."""

    itemtype: str
    qtyreceived: int
    serialnumber: str
    loggedby: str
    notes: str = ""
