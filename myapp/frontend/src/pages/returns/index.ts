/** Returns page: mounting, data loading, and event wiring.

All listeners live here, delegated from the page container, so the view modules
stay pure string builders. */

import { getStats, listReturns } from "../../api/returns";
import { delegate, q } from "../../lib/dom";
import { openDetail } from "./detail-modal";
import { findReturn, state } from "./state";
import { historyHTML, kanbanHTML, pageShellHTML, tableHTML } from "./views";
import { openWizard } from "./wizard";

/**
 * Render the returns page into `el` and load its data.
 *
 * Called every time the user selects the Returns tab, so the listener wiring is
 * guarded — the container element persists across renders, and re-delegating on
 * it would stack a duplicate handler per visit.
 */
export function mountReturns(el: HTMLElement): void {
  const isFirstMount = state.container !== el;
  state.container = el;

  render();
  if (isFirstMount) wire(el);

  void loadAll();
}

async function loadAll(): Promise<void> {
  try {
    const [data, stats] = await Promise.all([listReturns(), getStats()]);
    state.data = data;
    state.stats = stats;
    render();
  } catch (e) {
    console.error("Failed to load returns", e);
  }
}

/** Replace the page contents. Attaches no listeners — see `wire`. */
function render(): void {
  const el = state.container;
  if (!el) return;

  el.innerHTML = pageShellHTML();
  q("#rtn-body", el).innerHTML = state.viewMode === "kanban" ? kanbanHTML() : tableHTML();
  q("#rtn-history", el).innerHTML = historyHTML();
}

/** Attach delegated listeners once. They survive every later re-render. */
function wire(el: HTMLElement): void {
  delegate(el, "click", ".view-btn[data-rview]", (btn) => {
    state.viewMode = btn.dataset.rview as "kanban" | "table";
    render();
  });

  delegate(el, "click", "#rtn-new", () => openWizard(loadAll));

  delegate(el, "click", "#rtn-hist-toggle", () => {
    state.historyExpanded = !state.historyExpanded;
    q("#rtn-history", el).innerHTML = historyHTML();
  });

  // Cards, table rows, and history rows all open the same detail modal. Clicks
  // inside the modal are excluded so its own controls do not re-trigger this.
  delegate(el, "click", "[data-return-id]", (target) => {
    if (target.closest("#rtn-modal-root")) return;

    const found = findReturn(Number(target.dataset.returnId));
    if (found) openDetail(found, loadAll);
  });
}
