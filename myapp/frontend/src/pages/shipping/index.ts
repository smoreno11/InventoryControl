/** Shipping page: look up a packed box by number and attach its tracking. */

import { ApiError } from "../../api/client";
import { listPackedBoxes, lookupBox, OUTGOING_TRACKING, setWorkflowField } from "../../api/workflow";
import { q } from "../../lib/dom";
import { esc } from "../../lib/html";
import type { BoxResult } from "../../types";
import { packedListHTML, resultHTML, shippingPageHTML } from "./views";

export function mountShipping(el: HTMLElement): void {
  el.innerHTML = shippingPageHTML();

  const input = q<HTMLInputElement>("#ship-box-input", el);
  const searchBtn = q<HTMLButtonElement>("#ship-search-btn", el);

  const search = () => void doSearch(el, input, searchBtn);

  searchBtn.addEventListener("click", search);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") search();
  });

  void loadPackedList();
}

async function doSearch(
  el: HTMLElement,
  input: HTMLInputElement,
  btn: HTMLButtonElement,
): Promise<void> {
  const msgEl = q("#ship-msg", el);
  const resultEl = q<HTMLElement>("#ship-result", el);
  const boxNumber = input.value.trim();

  if (!boxNumber) {
    msgEl.innerHTML = '<div class="msg msg-error">Enter a 4-digit box number.</div>';
    return;
  }

  btn.disabled = true;
  btn.textContent = "Searching…";
  msgEl.innerHTML = "";
  resultEl.innerHTML = "";

  try {
    const data = await lookupBox(boxNumber);
    renderResult(resultEl, data);
  } catch (err) {
    msgEl.innerHTML = `<div class="msg msg-error">${errorFor(err, boxNumber)}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = "Search";
  }
}

function errorFor(err: unknown, boxNumber: string): string {
  if (err instanceof ApiError) {
    return err.status === 404
      ? `No box found with number <strong>${esc(boxNumber)}</strong>.`
      : "Search failed — try again.";
  }
  return "Network error — is the backend running?";
}

function renderResult(el: HTMLElement, data: BoxResult): void {
  el.innerHTML = resultHTML(data);
  q<HTMLButtonElement>("#ship-save-btn", el).addEventListener("click", () =>
    void saveTracking(el, data),
  );
}

async function saveTracking(el: HTMLElement, data: BoxResult): Promise<void> {
  const input = q<HTMLInputElement>("#ship-tracking-input", el);
  const msgEl = q("#ship-save-msg", el);
  const btn = q<HTMLButtonElement>("#ship-save-btn", el);
  const tracking = input.value.trim();

  if (!tracking) {
    msgEl.innerHTML = '<div class="msg msg-error">Enter a tracking number first.</div>';
    return;
  }

  btn.disabled = true;
  btn.textContent = "Saving…";

  try {
    await setWorkflowField(data.serial_number, OUTGOING_TRACKING, tracking);

    msgEl.innerHTML = '<div class="msg msg-success">Tracking number saved!</div>';

    // Update the "current tracking" line in place. The previous version looked
    // for a [data-tracking-display] element that the markup never rendered, so
    // this display never actually refreshed.
    const display = el.querySelector<HTMLDivElement>("[data-tracking-display]");
    if (display) {
      display.classList.remove("hidden");
      display.innerHTML = `Current tracking: <strong>${esc(tracking)}</strong>`;
    }

    setTimeout(() => {
      msgEl.innerHTML = "";
    }, 2500);

    await loadPackedList();
  } catch {
    msgEl.innerHTML = '<div class="msg msg-error">Failed to save — try again.</div>';
  } finally {
    btn.disabled = false;
    btn.textContent = "Save Tracking";
  }
}

async function loadPackedList(): Promise<void> {
  const listEl = document.getElementById("ship-packed-list");
  if (!listEl) return;

  try {
    const items = await listPackedBoxes();

    if (items.length === 0) {
      listEl.innerHTML =
        '<div class="empty-state"><p>No packed boxes yet — save PACKEDBY in the Assessment modal to auto-assign a box number.</p></div>';
      return;
    }

    listEl.innerHTML = packedListHTML(items);
  } catch (err) {
    listEl.innerHTML =
      err instanceof ApiError
        ? '<div class="empty-state"><p>Unable to load packed boxes.</p></div>'
        : '<div class="empty-state"><p>Network error.</p></div>';
  }
}
