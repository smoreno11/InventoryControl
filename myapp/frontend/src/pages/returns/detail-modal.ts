/** Detail/edit modal: every stage of one return, editable in place.

Fields carry `data-k` (text, number, select) or `data-kb` (checkbox) attributes,
so `collectFields` can read the whole form generically instead of naming each
input twice. */

import { ApiError } from "../../api/client";
import { deleteReturn, updateReturn, type ReturnFields } from "../../api/returns";
import { q, qa } from "../../lib/dom";
import { esc } from "../../lib/html";
import type { EbayReturn } from "../../types";
import { closeModal, modalRoot } from "./modal-root";
import { STAGES, nextStage, stageIndex } from "./stages";
import { state } from "./state";

let refresh: () => Promise<void> = async () => {};

export function openDetail(r: EbayReturn, onRefresh: () => Promise<void>): void {
  refresh = onRefresh;
  state.detailReturn = r;
  render();
}

function render(): void {
  const r = state.detailReturn;
  if (!r) return;

  const el = modalRoot();
  const stage = STAGES[stageIndex(r.status)];
  const isComplete = r.status === "refund_received";

  el.innerHTML = `
    <div class="rtn-modal-overlay">
      <div class="rtn-modal rtn-modal-wide">
        <div class="rtn-modal-header">
          <div>
            <h3>Return #${r.id} — ${esc(r.ebay_order_id)}</h3>
            <div class="detail-subhead">
              <span class="status-badge stage-${stage.color}">${esc(stage.label)}</span>
              <span class="detail-item-name">${esc(r.item_name || "Unnamed")}</span>
            </div>
          </div>
          <button class="modal-close" id="rtn-close">&#10005;</button>
        </div>
        <div class="rtn-modal-body">
          ${stageSectionHTML(1, "Item Inspection", stage1HTML(r))}
          ${stageSectionHTML(2, "eBay Filed", stage2HTML(r))}
          ${stageSectionHTML(3, "Pending Approval", stage3HTML(r))}
          ${stageSectionHTML(4, "Packing & Ship", stage4HTML(r))}
          ${stageSectionHTML(5, "Refund Received", stage5HTML(r))}
          <div id="rtn-detail-msg"></div>
        </div>
        <div class="rtn-modal-footer detail-footer">
          <button class="btn btn-danger" id="d-delete">Delete Return</button>
          <div class="footer-spacer"></div>
          <button class="btn btn-ghost" id="d-cancel">Close</button>
          <button class="btn btn-ghost" id="d-save-only">Save Only</button>
          <button class="btn btn-primary" id="d-save">
            ${isComplete ? "Save" : "Save &amp; Advance Stage →"}
          </button>
        </div>
      </div>
    </div>`;

  wire(isComplete);
}

function wire(isComplete: boolean): void {
  const el = modalRoot();

  q<HTMLButtonElement>("#rtn-close", el).addEventListener("click", closeModal);
  q<HTMLButtonElement>("#d-cancel", el).addEventListener("click", closeModal);
  q<HTMLButtonElement>("#d-save-only", el).addEventListener("click", () => void save(false));
  q<HTMLButtonElement>("#d-save", el).addEventListener("click", () => void save(!isComplete));
  q<HTMLButtonElement>("#d-delete", el).addEventListener("click", () => void remove());

  // Stage 2's date field only applies once the label has been received.
  const labelCb = el.querySelector<HTMLInputElement>('[data-kb="return_label_received"]');
  const labelWrap = el.querySelector<HTMLDivElement>("#d-label-date-wrap");
  if (labelCb && labelWrap) {
    labelCb.addEventListener("change", () =>
      labelWrap.classList.toggle("hidden", !labelCb.checked),
    );
  }

  qa<HTMLElement>(".detail-stage-head", el).forEach((head) => {
    head.addEventListener("click", () => head.parentElement!.classList.toggle("collapsed"));
  });
}

/** Wrap a stage's fields in a collapsible section; only the current stage starts open. */
function stageSectionHTML(n: number, label: string, inner: string): string {
  const collapsed =
    state.detailReturn && stageIndex(state.detailReturn.status) !== n - 1 ? "collapsed" : "";

  return `
    <div class="detail-stage ${collapsed}">
      <div class="detail-stage-head">
        <span>Stage ${n}: ${esc(label)}</span>
        <span class="toggle-arrow">▼</span>
      </div>
      <div class="detail-stage-body">${inner}</div>
    </div>`;
}

// ── Stage field groups ───────────────────────────────────────────────────────

function stage1HTML(r: EbayReturn): string {
  return `
    <div class="form-grid">
      <div class="form-field span-2"><label>eBay Order ID</label><input type="text" data-k="ebay_order_id" value="${esc(r.ebay_order_id)}"/></div>
      <div class="form-field span-2"><label>Item Name</label><input type="text" data-k="item_name" value="${esc(r.item_name)}"/></div>
      <div class="form-field"><label>Quantity</label><input type="number" data-k="quantity" value="${r.quantity}"/></div>
      <div class="form-field"><label>Total Cost</label><input type="number" step="0.01" data-k="total_cost" value="${r.total_cost}"/></div>
      <div class="form-field"><label>Date Received</label><input type="date" data-k="date_received" value="${esc(r.date_received)}"/></div>
      <div class="form-field"><label>Serial #</label><input type="text" data-k="serial_number" value="${esc(r.serial_number)}"/></div>
      <div class="form-field span-2"><label>Logged By</label><input type="text" data-k="logged_by" value="${esc(r.logged_by)}"/></div>
      <div class="form-field span-2">
        <label>Condition</label>
        <div class="checkbox-grid">
          <label class="cb"><input type="checkbox" data-kb="wms_functional" ${r.wms_functional ? "checked" : ""}> WMS Functional</label>
          <label class="cb"><input type="checkbox" data-kb="wms_case_good" ${r.wms_case_good ? "checked" : ""}> WMS Case Good</label>
          <label class="cb"><input type="checkbox" data-kb="cd_changer_functional" ${r.cd_changer_functional ? "checked" : ""}> 3CD Functional</label>
          <label class="cb"><input type="checkbox" data-kb="cd_changer_case_good" ${r.cd_changer_case_good ? "checked" : ""}> 3CD Case Good</label>
        </div>
      </div>
      <div class="form-field">
        <label>Return Reason</label>
        <select data-k="return_reason">
          <option value="">—</option>
          <option value="Damaged" ${r.return_reason === "Damaged" ? "selected" : ""}>Damaged</option>
          <option value="Defective" ${r.return_reason === "Defective" ? "selected" : ""}>Defective</option>
        </select>
      </div>
      <div class="form-field span-2"><label>Inspection Notes <span class="opt">(Optional)</span></label><textarea data-k="inspection_notes" rows="2">${esc(r.inspection_notes)}</textarea></div>
    </div>`;
}

function stage2HTML(r: EbayReturn): string {
  const labelReceived = Boolean(r.return_label_received);
  return `
    <div class="form-grid">
      <div class="form-field"><label>Date Return Open</label><input type="date" data-k="date_return_open" value="${esc(r.date_return_open)}"/></div>
      <div class="form-field"><label>Return Open By</label><input type="text" data-k="return_open_by" value="${esc(r.return_open_by)}"/></div>
      <div class="form-field"><label>eBay Follow-up</label><input type="date" data-k="ebay_followup_date" value="${esc(r.ebay_followup_date)}"/></div>
      <div class="form-field span-2"><label class="cb"><input type="checkbox" data-kb="return_label_received" ${labelReceived ? "checked" : ""}> Return Label Received</label></div>
      <div class="form-field ${labelReceived ? "" : "hidden"}" id="d-label-date-wrap"><label>Date Label Received</label><input type="date" data-k="date_label_received" value="${esc(r.date_label_received)}"/></div>
      <div class="form-field span-2"><label>eBay Notes <span class="opt">(Optional)</span></label><textarea data-k="ebay_notes" rows="2">${esc(r.ebay_notes)}</textarea></div>
    </div>`;
}

function stage3HTML(r: EbayReturn): string {
  return `
    <div class="form-grid">
      <div class="form-field span-2"><label class="cb"><input type="checkbox" data-kb="partial_refund_accepted" ${r.partial_refund_accepted ? "checked" : ""}> Partial Refund Accepted</label></div>
      <div class="form-field"><label>Partial Refund Amount</label><input type="number" step="0.01" data-k="partial_refund_amount" value="${r.partial_refund_amount}"/></div>
      <div class="form-field"><label>Date Contacted Seller</label><input type="date" data-k="date_contacted_seller" value="${esc(r.date_contacted_seller)}"/></div>
      <div class="form-field"><label>Michael Approval Date</label><input type="date" data-k="michael_approval_date" value="${esc(r.michael_approval_date)}"/></div>
      <div class="form-field span-2"><label>Approval Notes <span class="opt">(Optional)</span></label><textarea data-k="approval_notes" rows="2">${esc(r.approval_notes)}</textarea></div>
    </div>`;
}

function stage4HTML(r: EbayReturn): string {
  return `
    <div class="form-grid">
      <div class="form-field"><label>Packed By</label><input type="text" data-k="rtn_packed_by" value="${esc(r.rtn_packed_by)}"/></div>
      <div class="form-field"><label>Date Package Returned</label><input type="date" data-k="date_package_returned" value="${esc(r.date_package_returned)}"/></div>
      <div class="form-field span-2"><label>Return Tracking</label><input type="text" data-k="return_tracking" value="${esc(r.return_tracking)}"/></div>
      <div class="form-field span-2"><label>Packing Notes <span class="opt">(Optional)</span></label><textarea data-k="packing_notes" rows="2">${esc(r.packing_notes)}</textarea></div>
    </div>`;
}

function stage5HTML(r: EbayReturn): string {
  return `
    <div class="form-grid">
      <div class="form-field"><label>Refund Amount Received</label><input type="number" step="0.01" data-k="amount_refund_received" value="${r.amount_refund_received}"/></div>
      <div class="form-field"><label>Date Refund Received</label><input type="date" data-k="date_refund_received" value="${esc(r.date_refund_received)}"/></div>
      <div class="form-field span-2"><label>Refund Notes <span class="opt">(Optional)</span></label><textarea data-k="refund_notes" rows="2">${esc(r.refund_notes)}</textarea></div>
    </div>`;
}

// ── Save and delete ──────────────────────────────────────────────────────────

/** Read every `data-k` and `data-kb` input in the modal into a payload object. */
function collectFields(): ReturnFields {
  const el = modalRoot();
  const fields: ReturnFields = {};

  qa<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("[data-k]", el).forEach((input) => {
    const key = input.dataset.k!;
    const value = input.value;
    fields[key] = (input as HTMLInputElement).type === "number" ? parseFloat(value) || 0 : value;
  });

  qa<HTMLInputElement>("[data-kb]", el).forEach((box) => {
    fields[box.dataset.kb!] = box.checked ? 1 : 0;
  });

  return fields;
}

async function save(advance: boolean): Promise<void> {
  const r = state.detailReturn;
  if (!r) return;

  const msg = q<HTMLDivElement>("#rtn-detail-msg", modalRoot());
  const fields = collectFields();
  if (advance) fields.status = nextStage(r.status);

  try {
    const result = await updateReturn(r.id, fields);

    if (advance) {
      closeModal();
      await refresh();
      return;
    }

    state.detailReturn = result.item;
    await refresh();

    // refresh() re-renders the page and clears the modal root, so put the modal
    // back. Without this the "Save Only" button silently closed the modal and
    // wrote its success message to a detached element.
    render();
    const liveMsg = q<HTMLDivElement>("#rtn-detail-msg", modalRoot());
    liveMsg.innerHTML = '<div class="msg msg-success">Saved.</div>';
    setTimeout(() => {
      liveMsg.innerHTML = "";
    }, 1800);
  } catch (err) {
    msg.innerHTML = `<div class="msg msg-error">${esc(
      err instanceof ApiError ? err.message : "Network error.",
    )}</div>`;
  }
}

async function remove(): Promise<void> {
  const r = state.detailReturn;
  if (!r) return;
  if (!confirm("Delete this return? This cannot be undone.")) return;

  try {
    await deleteReturn(r.id);
    closeModal();
    await refresh();
  } catch {
    /* leave the modal open so the user can retry */
  }
}
