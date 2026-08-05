/** Mutable state for the inventory page.

Kept in one place so the render modules read from a single source rather than
reaching for module-level `let` bindings scattered across files. */

import type { Item } from "../../types";

/** Captured once at load; used as the reset point for month navigation. */
export const NOW = new Date();

export interface InventoryState {
  pending: Item[];
  complete: Item[];
  searchQuery: string;
  viewMode: "date" | "type";
  /** null means "All Time". */
  filterMonth: number | null;
  filterYear: number | null;
}

export const state: InventoryState = {
  pending: [],
  complete: [],
  searchQuery: "",
  viewMode: "date",
  filterMonth: NOW.getMonth() + 1,
  filterYear: NOW.getFullYear(),
};

/** Find a loaded item by row ID across both lists. */
export function findItem(id: number): Item | undefined {
  return state.complete.find((i) => i.id === id) ?? state.pending.find((i) => i.id === id);
}
