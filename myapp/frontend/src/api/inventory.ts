/** Inventory endpoints. */

import type { Item } from "../types";
import { get, post, put } from "./client";

export interface PendingPayload {
  date: string;
  name: string;
  tracking: string;
  ebayorderid: string;
  qtyordered: number;
  totalcost: number;
}

export interface CompletePayload {
  itemtype: string;
  serialnumber: string;
  qtyreceived: number;
  loggedby: string;
  notes: string;
}

export const listPending = () => get<Item[]>("/api/pending");

export const listComplete = () => get<Item[]>("/api/complete");

export const listAll = () => get<Item[]>("/api/items");

export const addPending = (payload: PendingPayload) =>
  post<{ ok: boolean; id: number }>("/api/pending", payload);

export const completeItem = (id: number, payload: CompletePayload) =>
  put<{ ok: boolean }>(`/api/inventory/${id}/complete`, payload);

/** Look up an item by eBay order ID. Throws ApiError with status 404 if absent. */
export const lookupByEbayOrder = (ebayOrderId: string) =>
  get<Item>(`/api/inventory/lookup?ebay_order_id=${encodeURIComponent(ebayOrderId)}`);
