/** eBay returns endpoints. */

import type { EbayReturn, ReturnStats } from "../types";
import { del, get, patch, post } from "./client";

/** Return payloads are partial by design — the wizard saves one stage at a time. */
export type ReturnFields = Record<string, unknown>;

interface MutationResult {
  ok: boolean;
  item: EbayReturn;
}

interface CreateResult extends MutationResult {
  id: number;
}

export const listReturns = () => get<EbayReturn[]>("/api/returns");

export const getStats = () => get<ReturnStats>("/api/returns/stats");

export const createReturn = (fields: ReturnFields) =>
  post<CreateResult>("/api/returns", fields);

export const updateReturn = (id: number, fields: ReturnFields) =>
  patch<MutationResult>(`/api/returns/${id}`, fields);

export const deleteReturn = (id: number) => del<{ ok: boolean }>(`/api/returns/${id}`);
