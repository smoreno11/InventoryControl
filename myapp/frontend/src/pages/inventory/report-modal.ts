/** "Report Issue" modal for flagging a damaged or incomplete unit. */

import { q } from "../../lib/dom";
import { esc } from "../../lib/html";
import type { Item } from "../../types";

const OVERLAY_ID = "report-overlay";

function overlayHTML(): string {
  return `
    <div class="modal-overlay hidden" id="${OVERLAY_ID}">
      <div class="modal">
        <div class="modal-header">
          <h3>Report Issue</h3>
          <button class="modal-close" id="report-close">&#10005;</button>
        </div>
        <div class="modal-body">
          <div class="modal-item-info" id="report-item-info"></div>
          <div class="form-field form-field-gap">
            <label for="report-desc">Describe the issue *</label>
            <textarea id="report-desc" rows="4"
              placeholder="e.g. Unit powers on but remote is missing, screen has a crack..."></textarea>
          </div>
          <div id="report-msg"></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" id="report-cancel">Cancel</button>
          <button class="btn-alert" id="report-send">Send Alert to Boss</button>
        </div>
      </div>
    </div>`;
}

function ensureOverlay(): HTMLElement {
  const existing = document.getElementById(OVERLAY_ID);
  if (existing) return existing;

  document.body.insertAdjacentHTML("beforeend", overlayHTML());
  const overlay = document.getElementById(OVERLAY_ID)!;

  q("#report-close").addEventListener("click", closeReport);
  q("#report-cancel").addEventListener("click", closeReport);
  q("#report-send").addEventListener("click", sendReport);
  overlay.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeReport();
  });

  return overlay;
}

export function closeReport(): void {
  document.getElementById(OVERLAY_ID)?.classList.add("hidden");
}

export function openReport(item: Item): void {
  const overlay = ensureOverlay();

  q("#report-item-info").innerHTML = `
    <div class="report-item-type">${esc(item.ITEMTYPE || "Uncategorized")}</div>
    <div class="report-item-meta">
      ${item.SERIALNUMBER ? `<span>SN: <strong>${esc(item.SERIALNUMBER)}</strong></span>` : ""}
      ${item.DATE ? `<span>Date: <strong>${esc(item.DATE)}</strong></span>` : ""}
      ${item.NAME ? `<span class="report-item-name" title="${esc(item.NAME)}">${esc(item.NAME)}</span>` : ""}
    </div>`;

  q<HTMLTextAreaElement>("#report-desc").value = "";
  q("#report-msg").innerHTML = "";
  overlay.classList.remove("hidden");
  q<HTMLTextAreaElement>("#report-desc").focus();
}

/**
 * Acknowledge the report.
 *
 * Still cosmetic — no alert is actually delivered anywhere. Wire this to email,
 * Slack, or a backend route to make it real.
 */
function sendReport(): void {
  const desc = q<HTMLTextAreaElement>("#report-desc").value.trim();
  const msgEl = q("#report-msg");

  if (!desc) {
    msgEl.innerHTML = '<div class="msg msg-error">Please describe the issue.</div>';
    return;
  }

  const btn = q<HTMLButtonElement>("#report-send");
  btn.disabled = true;
  btn.textContent = "Sending...";

  setTimeout(() => {
    msgEl.innerHTML = '<div class="msg msg-success">Alert logged! Your boss will be notified.</div>';
    btn.disabled = false;
    btn.textContent = "Send Alert to Boss";
    setTimeout(closeReport, 1800);
  }, 600);
}
