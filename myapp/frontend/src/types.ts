/** Shapes returned by the API.

The INVENTORY table uses uppercase column names, so `Item` mirrors them
verbatim; the newer `returns` and `workflow_fields` tables use snake_case. */

export interface Item {
  id: number;
  STATUS: string;
  DATE: string;
  NAME: string;
  TRACKING: string;
  EBAYORDERID: string;
  QTYORDERED: number;
  TOTALCOST: number;
  ITEMTYPE: string;
  QTYRECEIVED: number;
  SERIALNUMBER: string;
  LOGGEDBY: string;
  NOTES: string;
}

export type ReturnStatus =
  | "inspection"
  | "ebay_filed"
  | "pending_approval"
  | "packing"
  | "refund_received";

export interface EbayReturn {
  id: number;
  status: ReturnStatus;
  ebay_order_id: string;
  item_name: string;
  quantity: number;
  total_cost: number;
  date_received: string;
  serial_number: string;
  logged_by: string;
  wms_functional: number;
  wms_case_good: number;
  cd_changer_functional: number;
  cd_changer_case_good: number;
  return_reason: string;
  inspection_notes: string;
  date_return_open: string;
  return_open_by: string;
  ebay_followup_date: string;
  return_label_received: number;
  date_label_received: string;
  ebay_notes: string;
  partial_refund_accepted: number;
  partial_refund_amount: number;
  michael_approval_date: string;
  approval_notes: string;
  date_contacted_seller: string;
  rtn_packed_by: string;
  date_package_returned: string;
  return_tracking: string;
  packing_notes: string;
  amount_refund_received: number;
  date_refund_received: string;
  refund_notes: string;
  created_at: string;
  updated_at: string;
}

export interface ReturnStats {
  total_open: number;
  pending_approval: number;
  urgent: number;
  total_refunded: number;
}

/** One saved workflow value plus when it was set. */
export interface WorkflowField {
  value: string;
  timestamp: string;
}

/** Map of field name (TESTEDBY, BOX_NUMBER, …) to its saved value. */
export type WorkflowFields = Record<string, WorkflowField>;

export interface BoxResult {
  serial_number: string;
  box_number: string;
  item: Partial<Item> | null;
  workflow_fields: WorkflowFields;
}

export interface PackedBox {
  serial_number: string;
  box_number: string;
  packed_at: string;
  outgoing_tracking: string;
  item: Partial<Item> | null;
}
