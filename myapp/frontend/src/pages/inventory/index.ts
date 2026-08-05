/** Inventory page: mounting, data loading, and top-level wiring. */

import { ApiError } from "../../api/client";
import { addPending, listComplete, listPending } from "../../api/inventory";
import { mountUploadButton } from "../../features/file-upload";
import { q, qa } from "../../lib/dom";
import { esc } from "../../lib/html";
import { renderComplete, wireCompleteList } from "./complete";
import { renderPending } from "./pending";
import { NOW, state } from "./state";
import { inventoryPageHTML } from "./view";

/** Render the page into `el` and wire it up. Safe to call once at startup. */
export function mountInventory(el: HTMLElement): void {
  el.innerHTML = inventoryPageHTML();
  wire();
  void loadAll();
}

async function loadAll(): Promise<void> {
  try {
    const [pending, complete] = await Promise.all([listPending(), listComplete()]);
    state.pending = pending;
    state.complete = complete;
    renderAll();
  } catch {
    console.error("Failed to load inventory — is the backend running?");
  }
}

function renderAll(): void {
  renderHeaderStats();
  renderPending(loadAll);
  renderComplete();
}

function renderHeaderStats(): void {
  q("#header-stats").innerHTML = `
    <div class="stat-chip">
      <span class="stat-n">${state.pending.length}</span>
      <span>Pending</span>
    </div>
    <div class="stat-chip">
      <span class="stat-n">${state.complete.length}</span>
      <span>Logged</span>
    </div>`;

  q("#badge-pending").textContent = String(state.pending.length);
  q("#badge-complete").textContent = String(state.complete.length);
}

// ── Wiring ───────────────────────────────────────────────────────────────────

function wire(): void {
  wireAddForm();
  wireSearch();
  wireViewToggle();
  wireMonthNav();
  wireCompleteList();
  mountUploadButton();
}

function wireAddForm(): void {
  q("#toggle-add").addEventListener("click", () => {
    const body = q<HTMLDivElement>("#add-body");
    const arrow = q("#add-arrow");
    const collapsed = body.classList.toggle("collapsed");
    arrow.classList.toggle("rotated", !collapsed);
  });

  q<HTMLFormElement>("#form-add").addEventListener("submit", onAddPending);
}

function wireSearch(): void {
  q<HTMLInputElement>("#inv-search").addEventListener("input", (e) => {
    state.searchQuery = (e.target as HTMLInputElement).value.toLowerCase();
    renderComplete();
  });
}

function wireViewToggle(): void {
  qa<HTMLButtonElement>(".view-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.viewMode = btn.dataset.view as "date" | "type";
      qa(".view-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      renderComplete();
    });
  });
}

function wireMonthNav(): void {
  /** Step the month filter, wrapping the year. Coming from "All Time" resets to today. */
  const step = (delta: -1 | 1) => {
    if (state.filterMonth === null) {
      state.filterMonth = NOW.getMonth() + 1;
      state.filterYear = NOW.getFullYear();
    } else {
      const zeroBased = state.filterMonth - 1 + delta;
      state.filterMonth = ((zeroBased % 12) + 12) % 12 + 1;
      state.filterYear = (state.filterYear ?? NOW.getFullYear()) + Math.floor(zeroBased / 12);
    }
    renderComplete();
  };

  q("#month-prev").addEventListener("click", () => step(-1));
  q("#month-next").addEventListener("click", () => step(1));

  q("#month-all").addEventListener("click", () => {
    state.filterMonth = null;
    state.filterYear = null;
    renderComplete();
  });
}

async function onAddPending(e: Event): Promise<void> {
  e.preventDefault();

  const form = e.target as HTMLFormElement;
  const btn = q<HTMLButtonElement>("[type=submit]", form);
  const msgEl = q<HTMLDivElement>("#add-msg");
  const dateEl = q<HTMLInputElement>("#p-date");
  const date = dateEl.value.trim();

  dateEl.classList.remove("field-error");
  msgEl.innerHTML = "";

  if (!date) {
    dateEl.classList.add("field-error");
    msgEl.innerHTML = '<div class="msg msg-error">Date is required.</div>';
    return;
  }

  btn.disabled = true;
  btn.textContent = "Adding...";

  try {
    await addPending({
      date,
      ebayorderid: q<HTMLInputElement>("#p-ebayorderid").value.trim(),
      tracking: q<HTMLInputElement>("#p-tracking").value.trim(),
      qtyordered: parseInt(q<HTMLInputElement>("#p-qty").value) || 0,
      totalcost: parseFloat(q<HTMLInputElement>("#p-cost").value) || 0,
      name: q<HTMLInputElement>("#p-name").value.trim(),
    });

    msgEl.innerHTML = '<div class="msg msg-success">Pending shipment added!</div>';
    form.reset();
    await loadAll();
    setTimeout(() => {
      msgEl.innerHTML = "";
    }, 3500);
  } catch (err) {
    const detail =
      err instanceof ApiError ? err.message : "Network error — is the backend running?";
    msgEl.innerHTML = `<div class="msg msg-error">${esc(detail)}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = "+ Add Pending Shipment";
  }
}
