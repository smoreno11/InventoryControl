/** Item workflow modal: records who tested, packed, shipped or returned a unit.

Saving PACKEDBY causes the backend to assign a 4-digit box number, which is
shown here so it can be written on the physical box. */

import { getWorkflowFields, setWorkflowField } from "../../api/workflow";
import { TEAM_MEMBERS, WORKFLOW_FIELDS } from "../../constants";
import { q } from "../../lib/dom";
import { fmtTimestamp } from "../../lib/format";
import { esc } from "../../lib/html";
import type { Item, WorkflowFields } from "../../types";

const OVERLAY_ID = "assessment-overlay";

function overlayHTML(): string {
  return `
    <div class="modal-overlay hidden" id="${OVERLAY_ID}">
      <div class="modal">
        <div class="modal-header">
          <h3>Item Workflow</h3>
          <button class="modal-close" id="assessment-close">&#10005;</button>
        </div>
        <div class="modal-body">
          <div class="modal-item-info" id="assessment-item-info"></div>
          <div id="assessment-box-display" class="assessment-box-slot"></div>
          <div id="assessment-rows" class="assessment-rows"></div>
          <div id="assessment-msg"></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" id="assessment-cancel">Close</button>
        </div>
      </div>
    </div>`;
}

/** Create the overlay on first use and attach its close handlers. */
function ensureOverlay(): HTMLElement {
  const existing = document.getElementById(OVERLAY_ID);
  if (existing) return existing;

  document.body.insertAdjacentHTML("beforeend", overlayHTML());
  const overlay = document.getElementById(OVERLAY_ID)!;

  q("#assessment-close").addEventListener("click", closeAssessment);
  q("#assessment-cancel").addEventListener("click", closeAssessment);
  overlay.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeAssessment();
  });

  return overlay;
}

export function closeAssessment(): void {
  document.getElementById(OVERLAY_ID)?.classList.add("hidden");
}

export async function openAssessment(item: Item): Promise<void> {
  const overlay = ensureOverlay();
  const serial = item.SERIALNUMBER || "";

  q("#assessment-item-info").innerHTML = `
    <div class="report-item-type">${esc(item.ITEMTYPE || "Uncategorized")}</div>
    <div class="report-item-meta">
      <span>${esc(item.DATE || "")}</span>
      ${serial ? `<span>SN: ${esc(serial)}</span>` : ""}
      ${item.NAME ? `<span class="report-item-name" title="${esc(item.NAME)}">${esc(item.NAME)}</span>` : ""}
    </div>`;

  // A lookup failure is non-fatal: the modal still opens with empty dropdowns.
  let saved: WorkflowFields = {};
  try {
    saved = await getWorkflowFields(serial);
  } catch {
    /* fall through with no saved values */
  }

  q("#assessment-rows").innerHTML = WORKFLOW_FIELDS.map((field) =>
    rowHTML(field, saved[field]?.value ?? "", saved[field]?.timestamp ?? ""),
  ).join("");
  q("#assessment-msg").innerHTML = "";
  renderBoxNumber(saved);

  for (const field of WORKFLOW_FIELDS) {
    q(`#asmt-save-${field}`).addEventListener("click", () => saveField(serial, field));
  }

  overlay.classList.remove("hidden");
}

/** One workflow row: label, name dropdown, save button, and last-set timestamp. */
function rowHTML(field: string, savedValue: string, savedTimestamp: string): string {
  const options = TEAM_MEMBERS.map(
    (n) => `<option value="${n}" ${n === savedValue ? "selected" : ""}>${n}</option>`,
  ).join("");

  return `
    <div class="assessment-row">
      <div class="assessment-row-label" id="asmt-label-${field}">
        ${labelHTML(field, savedTimestamp)}
      </div>
      <select id="asmt-${field}" class="assessment-select">
        <option value="">-- Select Name --</option>
        ${options}
      </select>
      <button class="btn btn-primary btn-sm" id="asmt-save-${field}">Save</button>
      <span id="asmt-msg-${field}" class="assessment-row-msg"></span>
    </div>`;
}

function labelHTML(field: string, timestamp: string): string {
  const stamp = timestamp
    ? `<div class="assessment-row-time">Set ${fmtTimestamp(timestamp)}</div>`
    : "";
  return `<div class="assessment-row-name">${esc(field)}</div>${stamp}`;
}

/** Show the assigned box number, or nothing if the unit has not been packed yet. */
function renderBoxNumber(saved: WorkflowFields): void {
  const el = document.getElementById("assessment-box-display");
  if (!el) return;

  const boxNumber = saved["BOX_NUMBER"]?.value ?? "";
  el.innerHTML = boxNumber
    ? `<div class="box-banner">
         <div class="box-banner-label">Box #</div>
         <div class="box-banner-number">${esc(boxNumber)}</div>
         <div class="box-banner-hint">Write this on the box</div>
       </div>`
    : "";
}

async function saveField(serial: string, field: string): Promise<void> {
  const select = q<HTMLSelectElement>(`#asmt-${field}`);
  const msgEl = q(`#asmt-msg-${field}`);

  if (!select.value) {
    msgEl.textContent = "Select a name first";
    return;
  }

  try {
    await setWorkflowField(serial, field, select.value);

    // Re-read so the timestamp and any newly assigned box number appear
    // without closing the modal.
    const refreshed = await getWorkflowFields(serial);
    const label = document.getElementById(`asmt-label-${field}`);
    if (label) label.innerHTML = labelHTML(field, refreshed[field]?.timestamp ?? "");
    renderBoxNumber(refreshed);

    msgEl.textContent = "Saved!";
    setTimeout(() => {
      msgEl.textContent = "";
    }, 1800);
  } catch {
    msgEl.textContent = "Failed";
  }
}
