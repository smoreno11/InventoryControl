/** The "Inventory" section: logged items, searchable, grouped by date or type. */

import { MONTH_NAMES } from "../../constants";
import { delegate, q } from "../../lib/dom";
import { fmtMoney, parseDate } from "../../lib/format";
import { esc } from "../../lib/html";
import type { Item } from "../../types";
import { openAssessment } from "./assessment-modal";
import { openReport } from "./report-modal";
import { findItem, state } from "./state";

/** Apply the month and search filters, then render in the active view mode. */
export function renderComplete(): void {
  const list = q("#complete-list");

  renderMonthLabel();

  let items = state.complete;

  if (state.filterMonth !== null) {
    items = items.filter((it) => {
      const ts = parseDate(it.DATE);
      if (!ts) return false;
      const d = new Date(ts);
      return d.getMonth() + 1 === state.filterMonth && d.getFullYear() === state.filterYear;
    });
  }

  if (state.searchQuery) {
    items = items.filter(matchesSearch);
  }

  if (items.length === 0) {
    const msg = state.searchQuery
      ? `No items match "${state.searchQuery}"`
      : "No logged inventory yet.";
    list.innerHTML = `<div class="empty-state"><p>${esc(msg)}</p></div>`;
    return;
  }

  list.innerHTML = state.viewMode === "date" ? byDateHTML(items) : byTypeHTML(items);
}

function renderMonthLabel(): void {
  const label = document.getElementById("month-label")!;
  const allBtn = document.getElementById("month-all")!;

  if (state.filterMonth === null) {
    label.textContent = "All Time";
    allBtn.classList.add("active");
  } else {
    label.textContent = `${MONTH_NAMES[state.filterMonth - 1]} ${state.filterYear}`;
    allBtn.classList.remove("active");
  }
}

function matchesSearch(it: Item): boolean {
  const haystack = [
    it.ITEMTYPE, it.SERIALNUMBER, it.LOGGEDBY, it.NAME,
    it.NOTES, it.EBAYORDERID, it.TRACKING, it.DATE,
  ];
  return haystack.some((f) => String(f ?? "").toLowerCase().includes(state.searchQuery));
}

// ── Row rendering ────────────────────────────────────────────────────────────

function tableHead(showType: boolean): string {
  const typeHeader = showType ? "<th>Item Type</th>" : "";
  return `<thead><tr>${typeHeader}<th>Date</th><th>Serial #</th><th>Qty</th><th>Logged By</th>` +
    `<th>Cost</th><th>eBay Order</th><th>eBay Item Name</th><th>Notes</th><th></th><th></th></tr></thead>`;
}

/**
 * One inventory row.
 *
 * The action buttons carry only `data-id`; the handlers look the item up in
 * state. This replaces the previous approach of URI-encoding a JSON blob of the
 * item into an inline `onclick` attribute.
 */
function itemRow(it: Item, showType: boolean): string {
  const typeCell = showType
    ? `<td><strong>${esc(it.ITEMTYPE?.trim() || "Uncategorized")}</strong></td>`
    : "";

  return `
    <tr>
      ${typeCell}
      <td class="td-muted">${esc(it.DATE) || "—"}</td>
      <td class="td-sn">${esc(it.SERIALNUMBER) || '<span class="td-muted">—</span>'}</td>
      <td class="td-qty ${it.QTYRECEIVED === 0 ? "td-qty-zero" : ""}">${it.QTYRECEIVED ?? "—"}</td>
      <td>${esc(it.LOGGEDBY) || '<span class="td-muted">—</span>'}</td>
      <td class="td-cost">${fmtMoney(it.TOTALCOST)}</td>
      <td class="td-muted td-small">${esc(it.EBAYORDERID) || "—"}</td>
      <td class="td-notes" title="${esc(it.NAME)}">${esc(it.NAME) || '<span class="td-muted">—</span>'}</td>
      <td class="td-notes" title="${esc(it.NOTES)}">${esc(it.NOTES) || '<span class="td-muted">—</span>'}</td>
      <td><button class="td-notes" data-assess-id="${it.id}">Assessment</button></td>
      <td><button class="btn-report" data-report-id="${it.id}">Report Issue</button></td>
    </tr>`;
}

function byDateHTML(items: Item[]): string {
  const sorted = [...items].sort((a, b) => parseDate(b.DATE) - parseDate(a.DATE));
  return `
    <div class="inv-group">
      <div class="inv-group-body inv-group-body-flush">
        <table class="inv-table">
          ${tableHead(true)}
          <tbody>${sorted.map((it) => itemRow(it, true)).join("")}</tbody>
        </table>
      </div>
    </div>`;
}

function byTypeHTML(items: Item[]): string {
  const groups = new Map<string, Item[]>();
  for (const item of items) {
    const key = (item.ITEMTYPE?.trim() || "Uncategorized").toUpperCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }

  const sortedKeys = [...groups.keys()].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );

  return sortedKeys
    .map((key) => {
      const group = groups.get(key)!.sort((a, b) => parseDate(b.DATE) - parseDate(a.DATE));
      const totalQty = group.reduce((sum, i) => sum + (i.QTYRECEIVED || 0), 0);
      const gid = `g-${key.replace(/\W+/g, "-")}`;
      return `
      <div class="inv-group">
        <div class="inv-group-head" data-group-toggle="${gid}">
          <span class="inv-group-name">${esc(key)}</span>
          <span class="badge badge-info">${totalQty} unit${totalQty !== 1 ? "s" : ""}</span>
          <span class="toggle-arrow rotated">▼</span>
        </div>
        <div class="inv-group-body" id="${gid}">
          <table class="inv-table">
            ${tableHead(false)}
            <tbody>${group.map((it) => itemRow(it, false)).join("")}</tbody>
          </table>
        </div>
      </div>`;
    })
    .join("");
}

// ── Delegated events ─────────────────────────────────────────────────────────

/**
 * Attach the list's click handlers once.
 *
 * Delegation on the container means rows re-rendered by search, filtering, or a
 * reload stay interactive without re-binding, and nothing needs to be exposed on
 * `window`.
 */
export function wireCompleteList(): void {
  const list = q("#complete-list");

  delegate(list, "click", "[data-group-toggle]", (head) => {
    const body = document.getElementById(head.dataset.groupToggle!)!;
    const arrow = q<HTMLElement>(".toggle-arrow", head);
    const hidden = body.classList.toggle("hidden");
    arrow.classList.toggle("rotated", !hidden);
  });

  delegate(list, "click", "[data-assess-id]", (btn) => {
    const item = findItem(Number(btn.dataset.assessId));
    if (item) openAssessment(item);
  });

  delegate(list, "click", "[data-report-id]", (btn) => {
    const item = findItem(Number(btn.dataset.reportId));
    if (item) openReport(item);
  });
}
