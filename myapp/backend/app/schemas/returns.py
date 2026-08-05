"""Request bodies for the returns routes.

Both models ignore unknown keys: the frontend wizard posts whole form snapshots
and the detail modal sends every field it rendered, so extras are expected.
"""

from typing import Optional

from pydantic import BaseModel, ConfigDict


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
    """Every field optional — the route drops the unset ones before updating."""

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
