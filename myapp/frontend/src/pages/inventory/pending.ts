/** The "Pending Inventory" section: awaiting-receipt cards and their log-receipt forms. */

import { completeItem } from "../../api/inventory";
import { ApiError } from "../../api/client";
import { q, qa } from "../../lib/dom";
import { esc } from "../../lib/html";
import { fmtMoney } from "../../lib/format";
import type { Item } from "../../types";
import { state } from "./state";

/** Render the pending list and wire its expand buttons and forms. */
export function renderPending(reload: () => Promise<void>): void {
  const list = q("#pending-list");

  if (state.pending.length === 0) {
    list.innerHTML = `<div class="empty-state"><p>No pending shipments — everything has been logged!</p></div>`;
    return;
  }

  list.innerHTML = state.pending.map(pendingCardHTML).join("");

  qa<HTMLButtonElement>(".btn-expand", list).forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id!;
      const wrap = q<HTMLDivElement>(`#cwrap-${id}`, list);
      const hidden = wrap.classList.toggle("hidden");
      btn.textContent = hidden ? "Log Receipt" : "Cancel";
    });
  });

  qa<HTMLFormElement>(".form-complete", list).forEach((form) => {
    form.addEventListener("submit", (e) => onComplete(e, form, reload));
  });
}

function pendingCardHTML(item: Item): string {
  const name = item.NAME?.trim() || "Unknown Item";
  const pills = [
    item.DATE && `<span class="meta-pill">Date: <strong>${esc(item.DATE)}</strong></span>`,
    item.EBAYORDERID && `<span class="meta-pill">Order: <strong>${esc(item.EBAYORDERID)}</strong></span>`,
    item.TRACKING && `<span class="meta-pill">Tracking: ${esc(item.TRACKING)}</span>`,
    item.QTYORDERED && `<span class="meta-pill">Qty ordered: <strong>${item.QTYORDERED}</strong></span>`,
    item.TOTALCOST && `<span class="meta-pill">Cost: <strong>${fmtMoney(item.TOTALCOST)}</strong></span>`,
  ]
    .filter(Boolean)
    .join("");

  return `
    <div class="pending-card">
      <div class="pending-card-head">
        <div class="pending-info">
          <div class="pending-label">Awaiting Receipt</div>
          <div class="pending-name" title="${esc(name)}">${esc(name)}</div>
          <div class="pending-meta">${pills || '<span class="td-muted">No shipment details</span>'}</div>
        </div>
        <button class="btn btn-primary btn-sm btn-expand" data-id="${item.id}">Log Receipt</button>
      </div>
      <div class="complete-form-wrap hidden" id="cwrap-${item.id}">
        <div class="complete-form-title">Log Package Receipt</div>
        <form class="form-complete" data-id="${item.id}" novalidate>
          <div class="form-grid">
            <div class="form-field">
              <label for="c-type-${item.id}">Item Type *</label>
              <input type="text" id="c-type-${item.id}" name="itemtype"
                placeholder="e.g. Bose WMS IV Black" />
            </div>
            <div class="form-field">
              <label for="c-sn-${item.id}">Serial Number *</label>
              <input type="text" id="c-sn-${item.id}" name="serialnumber"
                placeholder="e.g. 2948239SAFWE823942" />
            </div>
            <div class="form-field">
              <label for="c-qty-${item.id}">Qty Received *</label>
              <input type="number" id="c-qty-${item.id}" name="qtyreceived"
                min="1" placeholder="1" value="${item.QTYORDERED || 1}" />
            </div>
            <div class="form-field">
              <label for="c-by-${item.id}">Logged By *</label>
              <input type="text" id="c-by-${item.id}" name="loggedby"
                placeholder="Your name" />
            </div>
            <div class="form-field span-2">
              <label for="c-notes-${item.id}">Notes</label>
              <input type="text" id="c-notes-${item.id}" name="notes"
                placeholder="e.g. Received in good condition, missing remote" />
            </div>
          </div>
          <div id="cmsg-${item.id}"></div>
          <button type="submit" class="btn btn-success form-submit-gap">
            Mark as Complete
          </button>
        </form>
      </div>
    </div>`;
}

/**
 * Validate and submit a log-receipt form.
 *
 * Fields are validated here as well as on the server so the user gets immediate
 * feedback with the offending inputs highlighted.
 */
async function onComplete(e: Event, form: HTMLFormElement, reload: () => Promise<void>): Promise<void> {
  e.preventDefault();

  const id = parseInt(form.dataset.id!);
  const btn = q<HTMLButtonElement>("[type=submit]", form);
  const msgEl = document.getElementById(`cmsg-${id}`)!;

  const field = (name: string) => q<HTMLInputElement>(`[name="${name}"]`, form);
  const value = (name: string) => (field(name)?.value ?? "").trim();

  const itemtype = value("itemtype");
  const serialnumber = value("serialnumber");
  const loggedby = value("loggedby");
  const notes = value("notes");
  const qtyreceived = parseInt(field("qtyreceived")?.value ?? "0");

  qa("input", form).forEach((i) => i.classList.remove("field-error"));
  msgEl.innerHTML = "";

  const errors: string[] = [];
  const requireField = (name: string, message: string, ok: boolean) => {
    if (ok) return;
    errors.push(message);
    field(name)?.classList.add("field-error");
  };

  requireField("itemtype", "Item Type is required.", Boolean(itemtype));
  requireField("serialnumber", "Serial Number is required.", Boolean(serialnumber));
  requireField("loggedby", "Logged By is required.", Boolean(loggedby));
  requireField("qtyreceived", "Qty Received must be at least 1.", qtyreceived >= 1);

  if (errors.length) {
    msgEl.innerHTML = `<div class="msg msg-error">${errors.join(" ")}</div>`;
    return;
  }

  btn.disabled = true;
  btn.textContent = "Saving...";

  try {
    await completeItem(id, { itemtype, serialnumber, qtyreceived, loggedby, notes });
    // The card disappears on reload, so the button is never re-enabled here.
    await reload();
  } catch (err) {
    const detail = err instanceof ApiError ? err.message : "Network error.";
    msgEl.innerHTML = `<div class="msg msg-error">${esc(detail)}</div>`;
    btn.disabled = false;
    btn.textContent = "Mark as Complete";
  }
}
