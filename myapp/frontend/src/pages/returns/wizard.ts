/** The "New Return" wizard: five steps mirroring the five workflow stages.

Each step saves to the server before advancing, so a return survives closing the
wizard partway through and can be finished later from the detail modal. */

import { ApiError } from "../../api/client";
import { lookupByEbayOrder } from "../../api/inventory";
import { createReturn, updateReturn, type ReturnFields } from "../../api/returns";
import { q } from "../../lib/dom";
import { addDays, todayISO } from "../../lib/format";
import { esc } from "../../lib/html";
import type { EbayReturn } from "../../types";
import { closeModal, modalRoot } from "./modal-root";
import { STAGES, type StageKey } from "./stages";
import { findReturn, state } from "./state";

const LAST_STEP = 5;

/** Reload-and-rerender callback, injected by the page controller on open. */
let refresh: () => Promise<void> = async () => {};

export function openWizard(onRefresh: () => Promise<void>): void {
  refresh = onRefresh;
  state.wizardReturnId = null;
  state.wizardStep = 1;
  render();
}

function render(): void {
  const el = modalRoot();
  el.innerHTML = `
    <div class="rtn-modal-overlay">
      <div class="rtn-modal">
        <div class="rtn-modal-header">
          <h3>New Return — Step ${state.wizardStep} of ${LAST_STEP}</h3>
          <button class="modal-close" id="rtn-close">&#10005;</button>
        </div>
        ${stepIndicatorHTML(state.wizardStep)}
        <div class="rtn-modal-body" id="rtn-step-body"></div>
      </div>
    </div>`;

  q<HTMLButtonElement>("#rtn-close", el).addEventListener("click", closeModal);
  renderStep();
}

function stepIndicatorHTML(currentStep: number): string {
  return `
    <div class="step-indicator">
      ${STAGES.map((s, i) => {
        const n = i + 1;
        const cls = n < currentStep ? "done" : n === currentStep ? "active" : "";
        return `
          <div class="step-item">
            <div class="step-dot ${cls}">${n}</div>
            <div class="step-label">${esc(s.label)}</div>
          </div>
          ${i < STAGES.length - 1 ? '<div class="step-bar"></div>' : ""}`;
      }).join("")}
    </div>`;
}

function renderStep(): void {
  const body = q<HTMLDivElement>("#rtn-step-body", modalRoot());
  const current = state.wizardReturnId ? findReturn(state.wizardReturnId) : null;

  const steps: Array<[(r?: EbayReturn | null) => string, () => void]> = [
    [stepOneHTML, wireStepOne],
    [stepTwoHTML, wireStepTwo],
    [stepThreeHTML, wireStepThree],
    [stepFourHTML, wireStepFour],
    [stepFiveHTML, wireStepFive],
  ];

  const [html, wire] = steps[state.wizardStep - 1];
  body.innerHTML = html(current);
  wire();
}

// ── Field access ─────────────────────────────────────────────────────────────

const root = () => modalRoot();
const val = (id: string) => q<HTMLInputElement>(id, root()).value.trim();
const rawVal = (id: string) => q<HTMLInputElement>(id, root()).value;
const checked = (id: string) => (q<HTMLInputElement>(id, root()).checked ? 1 : 0);
const text = (id: string) => q<HTMLTextAreaElement>(id, root()).value.trim();
const selected = (id: string) => q<HTMLSelectElement>(id, root()).value;

function footerHTML(nextLabel: string, nextClass = "btn-primary"): string {
  return `
    <div id="rtn-step-msg"></div>
    <div class="rtn-modal-footer">
      <button class="btn btn-ghost" id="rtn-skip">Skip for now</button>
      <button class="btn ${nextClass}" id="rtn-next">${nextLabel}</button>
    </div>`;
}

/** Wire the footer buttons shared by every step. */
function wireFooter(onNext: () => void | Promise<void>): void {
  q<HTMLButtonElement>("#rtn-skip", root()).addEventListener("click", closeModal);
  q<HTMLButtonElement>("#rtn-next", root()).addEventListener("click", () => void onNext());
}

function showStepError(message: string): void {
  q<HTMLDivElement>("#rtn-step-msg", root()).innerHTML =
    `<div class="msg msg-error">${esc(message)}</div>`;
}

// ── Step 1: inspection ───────────────────────────────────────────────────────

function stepOneHTML(r?: EbayReturn | null): string {
  return `
    <div class="rtn-form-section">
      <div class="form-grid">
        <div class="form-field span-2">
          <label>eBay Order ID *</label>
          <div class="field-with-action">
            <input type="text" id="f-ebay-order" value="${esc(r?.ebay_order_id ?? "")}" placeholder="112-XXXXX-XXXXXX" />
            <button type="button" class="btn btn-ghost" id="f-lookup">Look Up</button>
          </div>
          <div id="f-lookup-msg" class="field-hint"></div>
        </div>
        <div class="form-field span-2">
          <label>Item Name</label>
          <input type="text" id="f-item-name" value="${esc(r?.item_name ?? "")}" />
        </div>
        <div class="form-field">
          <label>Quantity</label>
          <input type="number" id="f-qty" value="${r?.quantity ?? ""}" />
        </div>
        <div class="form-field">
          <label>Total Cost ($)</label>
          <input type="number" step="0.01" id="f-cost" value="${r?.total_cost ?? ""}" />
        </div>
        <div class="form-field">
          <label>Date Received</label>
          <input type="date" id="f-date-received" value="${esc(r?.date_received || todayISO())}" />
        </div>
        <div class="form-field">
          <label>Serial Number</label>
          <input type="text" id="f-serial" value="${esc(r?.serial_number ?? "")}" />
        </div>
        <div class="form-field span-2">
          <label>Logged By</label>
          <input type="text" id="f-logged-by" value="${esc(r?.logged_by ?? "")}" />
        </div>
      </div>
    </div>

    <div class="rtn-form-section">
      <div class="rtn-section-title">Condition Inspection</div>
      <div class="checkbox-grid">
        <label class="cb"><input type="checkbox" id="f-wms-func" ${r?.wms_functional ? "checked" : ""}> WMS Functional</label>
        <label class="cb"><input type="checkbox" id="f-wms-case" ${r?.wms_case_good ? "checked" : ""}> WMS Case Good</label>
        <label class="cb"><input type="checkbox" id="f-cd-func" ${r?.cd_changer_functional ? "checked" : ""}> 3CD Changer Functional</label>
        <label class="cb"><input type="checkbox" id="f-cd-case" ${r?.cd_changer_case_good ? "checked" : ""}> 3CD Changer Case Good</label>
      </div>
    </div>

    <div class="rtn-form-section">
      <div class="form-grid">
        <div class="form-field">
          <label>Return Reason</label>
          <select id="f-reason">
            <option value="">— Select —</option>
            <option value="Damaged" ${r?.return_reason === "Damaged" ? "selected" : ""}>Damaged</option>
            <option value="Defective" ${r?.return_reason === "Defective" ? "selected" : ""}>Defective</option>
          </select>
        </div>
        <div class="form-field span-2">
          <label>Inspection Notes <span class="opt">(Optional)</span></label>
          <textarea id="f-inspection-notes" rows="3">${esc(r?.inspection_notes ?? "")}</textarea>
        </div>
      </div>
    </div>

    ${footerHTML("Start Return →")}`;
}

function wireStepOne(): void {
  q<HTMLButtonElement>("#f-lookup", root()).addEventListener("click", () => void doLookup());
  wireFooter(submitStepOne);
}

/** Auto-fill the form from an existing inventory row with the same eBay order ID. */
async function doLookup(): Promise<void> {
  const orderId = val("#f-ebay-order");
  const msg = q<HTMLDivElement>("#f-lookup-msg", root());

  if (!orderId) {
    msg.textContent = "Enter eBay Order ID first.";
    return;
  }

  msg.textContent = "Looking up...";
  try {
    const inv = await lookupByEbayOrder(orderId);
    const set = (id: string, value: string | number | null | undefined) => {
      const el = root().querySelector<HTMLInputElement>(id);
      if (el && value != null) el.value = String(value);
    };

    set("#f-item-name", inv.NAME);
    set("#f-qty", inv.QTYRECEIVED ?? inv.QTYORDERED);
    set("#f-cost", inv.TOTALCOST);
    set("#f-date-received", inv.DATE);
    set("#f-serial", inv.SERIALNUMBER);
    set("#f-logged-by", inv.LOGGEDBY);
    msg.textContent = "Auto-filled from inventory.";
  } catch (err) {
    msg.textContent =
      err instanceof ApiError && err.status === 404
        ? "No matching inventory found."
        : "Lookup failed.";
  }
}

function readStepOne(): ReturnFields {
  return {
    ebay_order_id: val("#f-ebay-order"),
    item_name: val("#f-item-name"),
    quantity: parseInt(val("#f-qty")) || 0,
    total_cost: parseFloat(val("#f-cost")) || 0,
    date_received: val("#f-date-received"),
    serial_number: val("#f-serial"),
    logged_by: val("#f-logged-by"),
    wms_functional: checked("#f-wms-func"),
    wms_case_good: checked("#f-wms-case"),
    cd_changer_functional: checked("#f-cd-func"),
    cd_changer_case_good: checked("#f-cd-case"),
    return_reason: selected("#f-reason"),
    inspection_notes: text("#f-inspection-notes"),
  };
}

/** Create the return (or update it, if the user came back to step 1) and advance. */
async function submitStepOne(): Promise<void> {
  const data = readStepOne();

  if (!data.ebay_order_id) {
    showStepError("eBay Order ID is required.");
    return;
  }

  try {
    if (state.wizardReturnId) {
      await updateReturn(state.wizardReturnId, { ...data, status: "ebay_filed" });
    } else {
      const created = await createReturn({ ...data, status: "ebay_filed" });
      state.wizardReturnId = created.id;
    }
    await refresh();
    state.wizardStep = 2;
    render();
  } catch (err) {
    showStepError(err instanceof ApiError ? err.message : "Network error.");
  }
}

// ── Step 2: eBay filing ──────────────────────────────────────────────────────

function stepTwoHTML(r?: EbayReturn | null): string {
  const dateOpen = r?.date_return_open || todayISO();
  const followup = r?.ebay_followup_date || addDays(dateOpen, 30);
  const labelReceived = Boolean(r?.return_label_received);

  return `
    <div class="rtn-form-section">
      <div class="form-grid">
        <div class="form-field">
          <label>Date Return Opened</label>
          <input type="date" id="f-date-open" value="${esc(dateOpen)}" />
        </div>
        <div class="form-field">
          <label>Return Opened By</label>
          <input type="text" id="f-return-by" value="${esc(r?.return_open_by ?? "")}" />
        </div>
        <div class="form-field">
          <label>eBay Follow-up Date</label>
          <input type="date" id="f-followup" value="${esc(followup)}" />
        </div>
        <div class="form-field span-2">
          <label class="cb"><input type="checkbox" id="f-label-rcvd" ${labelReceived ? "checked" : ""}> Return Label Received</label>
        </div>
        <div class="form-field ${labelReceived ? "" : "hidden"}" id="f-label-date-wrap">
          <label>Date Label Received</label>
          <input type="date" id="f-label-date" value="${esc(r?.date_label_received ?? "")}" />
        </div>
        <div class="form-field span-2">
          <label>eBay Notes <span class="opt">(Optional)</span></label>
          <textarea id="f-ebay-notes" rows="3">${esc(r?.ebay_notes ?? "")}</textarea>
        </div>
      </div>
    </div>
    ${footerHTML("Save & Continue →")}`;
}

function wireStepTwo(): void {
  const dateOpen = q<HTMLInputElement>("#f-date-open", root());
  dateOpen.addEventListener("change", () => {
    q<HTMLInputElement>("#f-followup", root()).value = addDays(dateOpen.value, 30);
  });

  toggleOnCheckbox("#f-label-rcvd", "#f-label-date-wrap");

  wireFooter(() =>
    saveAndAdvance({
      date_return_open: dateOpen.value,
      return_open_by: val("#f-return-by"),
      ebay_followup_date: rawVal("#f-followup"),
      return_label_received: checked("#f-label-rcvd"),
      date_label_received: root().querySelector<HTMLInputElement>("#f-label-date")?.value ?? "",
      ebay_notes: text("#f-ebay-notes"),
    }, "pending_approval"),
  );
}

// ── Step 3: approval ─────────────────────────────────────────────────────────

function stepThreeHTML(r?: EbayReturn | null): string {
  const accepted = Boolean(r?.partial_refund_accepted);

  return `
    <div class="rtn-form-section">
      <div class="form-grid">
        <div class="form-field span-2">
          <label class="cb"><input type="checkbox" id="f-partial" ${accepted ? "checked" : ""}> Partial Refund Accepted</label>
        </div>
        <div class="form-field ${accepted ? "" : "hidden"}" id="f-partial-amt-wrap">
          <label>Partial Refund Amount ($)</label>
          <input type="number" step="0.01" id="f-partial-amt" value="${r?.partial_refund_amount ?? ""}" />
        </div>
        <div class="form-field">
          <label>Date Contacted Seller</label>
          <input type="date" id="f-date-contacted" value="${esc(r?.date_contacted_seller ?? "")}" />
        </div>
        <div class="form-field">
          <label>Michael Approval Date</label>
          <input type="date" id="f-approval-date" value="${esc(r?.michael_approval_date ?? "")}" />
        </div>
        <div class="form-field span-2">
          <label>Approval Notes <span class="opt">(Optional)</span></label>
          <textarea id="f-approval-notes" rows="3">${esc(r?.approval_notes ?? "")}</textarea>
        </div>
      </div>
      <button class="btn btn-success approve-btn" id="f-approve-btn">✓ Approve (set today)</button>
    </div>
    ${footerHTML("Save & Continue →")}`;
}

function wireStepThree(): void {
  toggleOnCheckbox("#f-partial", "#f-partial-amt-wrap");

  q<HTMLButtonElement>("#f-approve-btn", root()).addEventListener("click", () => {
    q<HTMLInputElement>("#f-approval-date", root()).value = todayISO();
  });

  wireFooter(() =>
    saveAndAdvance({
      partial_refund_accepted: checked("#f-partial"),
      partial_refund_amount:
        parseFloat(root().querySelector<HTMLInputElement>("#f-partial-amt")?.value || "0") || 0,
      date_contacted_seller: rawVal("#f-date-contacted"),
      michael_approval_date: rawVal("#f-approval-date"),
      approval_notes: text("#f-approval-notes"),
    }, "packing"),
  );
}

// ── Step 4: packing ──────────────────────────────────────────────────────────

function stepFourHTML(r?: EbayReturn | null): string {
  return `
    <div class="rtn-form-section">
      <div class="form-grid">
        <div class="form-field">
          <label>Return Packed By</label>
          <input type="text" id="f-packed-by" value="${esc(r?.rtn_packed_by ?? "")}" />
        </div>
        <div class="form-field">
          <label>Date Package Returned</label>
          <input type="date" id="f-date-returned" value="${esc(r?.date_package_returned ?? "")}" />
        </div>
        <div class="form-field span-2">
          <label>Return Tracking</label>
          <input type="text" id="f-tracking" value="${esc(r?.return_tracking ?? "")}" />
        </div>
        <div class="form-field span-2">
          <label>Packing Notes <span class="opt">(Optional)</span></label>
          <textarea id="f-packing-notes" rows="3">${esc(r?.packing_notes ?? "")}</textarea>
        </div>
      </div>
    </div>
    ${footerHTML("Save & Continue →")}`;
}

function wireStepFour(): void {
  wireFooter(() =>
    saveAndAdvance({
      rtn_packed_by: val("#f-packed-by"),
      date_package_returned: rawVal("#f-date-returned"),
      return_tracking: val("#f-tracking"),
      packing_notes: text("#f-packing-notes"),
    }, "refund_received"),
  );
}

// ── Step 5: refund ───────────────────────────────────────────────────────────

function stepFiveHTML(r?: EbayReturn | null): string {
  return `
    <div class="rtn-form-section">
      <div class="form-grid">
        <div class="form-field">
          <label>Amount Refund Received ($)</label>
          <input type="number" step="0.01" id="f-refund-amt" value="${r?.amount_refund_received ?? ""}" />
        </div>
        <div class="form-field">
          <label>Date Refund Received</label>
          <input type="date" id="f-refund-date" value="${esc(r?.date_refund_received ?? todayISO())}" />
        </div>
        <div class="form-field span-2">
          <label>Refund Notes <span class="opt">(Optional)</span></label>
          <textarea id="f-refund-notes" rows="3">${esc(r?.refund_notes ?? "")}</textarea>
        </div>
      </div>
    </div>
    ${footerHTML("✓ Complete Return", "btn-success")}`;
}

function wireStepFive(): void {
  wireFooter(async () => {
    if (!state.wizardReturnId) return;
    try {
      await updateReturn(state.wizardReturnId, {
        amount_refund_received: parseFloat(rawVal("#f-refund-amt")) || 0,
        date_refund_received: rawVal("#f-refund-date"),
        refund_notes: text("#f-refund-notes"),
        status: "refund_received",
      });
      closeModal();
      await refresh();
    } catch (err) {
      showStepError(err instanceof ApiError ? err.message : "Network error.");
    }
  });
}

// ── Shared step behaviour ────────────────────────────────────────────────────

/** Show or hide a dependent field as a checkbox is toggled. */
function toggleOnCheckbox(checkboxId: string, wrapId: string): void {
  const box = q<HTMLInputElement>(checkboxId, root());
  const wrap = q<HTMLDivElement>(wrapId, root());
  box.addEventListener("change", () => wrap.classList.toggle("hidden", !box.checked));
}

/** Save the current step's fields, move the return to `newStatus`, and advance. */
async function saveAndAdvance(fields: ReturnFields, newStatus: StageKey): Promise<void> {
  if (!state.wizardReturnId) return;

  try {
    await updateReturn(state.wizardReturnId, { ...fields, status: newStatus });
    await refresh();
    state.wizardStep += 1;
    render();
  } catch (err) {
    showStepError(err instanceof ApiError ? err.message : "Network error.");
  }
}
