/** Mutable state for the returns page. */

import type { EbayReturn, ReturnStats } from "../../types";

export interface ReturnsState {
  data: EbayReturn[];
  stats: ReturnStats;
  viewMode: "kanban" | "table";
  historyExpanded: boolean;
  /** The element the page is mounted into; set by `mountReturns`. */
  container: HTMLElement | null;
  /** ID of the return the new-return wizard is building, once it exists. */
  wizardReturnId: number | null;
  /** Current wizard step, 1–5. */
  wizardStep: number;
  /** The return open in the detail/edit modal. */
  detailReturn: EbayReturn | null;
}

export const state: ReturnsState = {
  data: [],
  stats: { total_open: 0, pending_approval: 0, urgent: 0, total_refunded: 0 },
  viewMode: "kanban",
  historyExpanded: false,
  container: null,
  wizardReturnId: null,
  wizardStep: 1,
  detailReturn: null,
};

export function findReturn(id: number): EbayReturn | undefined {
  return state.data.find((r) => r.id === id);
}
