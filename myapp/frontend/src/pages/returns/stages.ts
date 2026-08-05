/** The five stages a return moves through, and helpers for stepping between them. */

export const STAGES = [
  { key: "inspection",       label: "Item Inspection",  color: "blue"   },
  { key: "ebay_filed",       label: "eBay Filed",       color: "amber"  },
  { key: "pending_approval", label: "Pending Approval", color: "purple" },
  { key: "packing",          label: "Packing & Ship",   color: "teal"   },
  { key: "refund_received",  label: "Refund Received",  color: "green"  },
] as const;

/** Stages shown as kanban columns — completed returns move to the history table. */
export const ACTIVE_STAGES = STAGES.slice(0, 4);

export type StageKey = (typeof STAGES)[number]["key"];

/** Position of a stage key, defaulting to the first stage if unrecognised. */
export function stageIndex(s: string): number {
  const i = STAGES.findIndex((x) => x.key === s);
  return i < 0 ? 0 : i;
}

/** The stage after `s`, or `s` itself if it is already the last one. */
export function nextStage(s: string): StageKey {
  return STAGES[Math.min(stageIndex(s) + 1, STAGES.length - 1)].key;
}

/** How far through the workflow a stage is, as a percentage. */
export function stageProgress(s: string): number {
  return Math.round((stageIndex(s) / (STAGES.length - 1)) * 100);
}
