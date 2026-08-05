/** Markup builders for the returns page.

These functions return HTML strings and read state; they attach no listeners.
All event wiring lives in `index.ts`, delegated from the page container. */

import { daysSince, fmtMoney } from "../../lib/format";
import { esc } from "../../lib/html";
import type { EbayReturn } from "../../types";
import { ACTIVE_STAGES, STAGES, stageIndex, stageProgress } from "./stages";
import { state } from "./state";

/** Returns page shell: header, stat cards, and the slots the views render into. */
export function pageShellHTML(): string {
  const { stats, viewMode } = state;
  return `
    <div class="returns-page">
      <div class="returns-header">
        <div>
          <h2 class="returns-title">eBay Returns</h2>
          <div class="returns-subtitle">Track returns from inspection to refund</div>
        </div>
        <div class="returns-actions">
          <div class="view-toggle">
            <button class="view-btn ${viewMode === "kanban" ? "active" : ""}" data-rview="kanban">Kanban</button>
            <button class="view-btn ${viewMode === "table" ? "active" : ""}" data-rview="table">Table</button>
          </div>
          <button class="btn btn-primary" id="rtn-new">+ New Return</button>
        </div>
      </div>

      <div class="stats-row">
        <div class="stat-card stat-blue">
          <div class="stat-label">Total Open</div>
          <div class="stat-value">${stats.total_open}</div>
        </div>
        <div class="stat-card stat-purple">
          <div class="stat-label">Pending Approval</div>
          <div class="stat-value">${stats.pending_approval}</div>
        </div>
        <div class="stat-card stat-red">
          <div class="stat-label">Urgent (25+ days)</div>
          <div class="stat-value">${stats.urgent}</div>
        </div>
        <div class="stat-card stat-green">
          <div class="stat-label">Total Refunded</div>
          <div class="stat-value">${fmtMoney(stats.total_refunded, "$0.00")}</div>
        </div>
      </div>

      <div id="rtn-body"></div>
      <div id="rtn-history"></div>
      <div id="rtn-modal-root"></div>
    </div>`;
}

/** A return is urgent once it has been open 25 days without a refund. */
function isUrgent(r: EbayReturn): boolean {
  const days = daysSince(r.date_return_open);
  return r.status !== "refund_received" && Boolean(r.date_return_open) && days != null && days >= 25;
}

function reasonTagHTML(reason: string): string {
  if (!reason) return '<span class="td-muted">—</span>';
  return `<span class="reason-tag reason-${esc(reason.toLowerCase())}">${esc(reason)}</span>`;
}

export function kanbanHTML(): string {
  const cols = ACTIVE_STAGES.map((stage) => {
    const items = state.data.filter((r) => r.status === stage.key);
    return `
      <div class="kanban-col">
        <div class="kanban-col-head stage-${stage.color}">
          <span>${esc(stage.label)}</span>
          <span class="kanban-count">${items.length}</span>
        </div>
        <div class="kanban-col-body">
          ${items.map(returnCardHTML).join("") || '<div class="kanban-empty">No returns</div>'}
        </div>
      </div>`;
  }).join("");

  return `<div class="kanban">${cols}</div>`;
}

function returnCardHTML(r: EbayReturn): string {
  const days = daysSince(r.date_return_open);
  const urgent = isUrgent(r);

  return `
    <div class="return-card ${urgent ? "urgent" : ""}" data-return-id="${r.id}">
      <div class="rc-row1">
        <span class="rc-order">${esc(r.ebay_order_id)}</span>
        ${urgent ? '<span class="urgent-dot" title="Urgent"></span>' : ""}
      </div>
      <div class="rc-name">${esc(r.item_name || "Unnamed item")}</div>
      <div class="rc-row2">
        ${r.return_reason ? reasonTagHTML(r.return_reason) : ""}
        ${days != null ? `<span class="rc-days">${days}d open</span>` : ""}
      </div>
    </div>`;
}

export function tableHTML(): string {
  const active = state.data.filter((r) => r.status !== "refund_received");

  if (active.length === 0) {
    return `<div class="empty-state"><p>No open returns. Click "New Return" to start.</p></div>`;
  }

  const rows = active.map((r) => {
    const stage = STAGES[stageIndex(r.status)];
    return `
      <tr data-return-id="${r.id}">
        <td class="td-sn">${esc(r.ebay_order_id)}</td>
        <td><strong>${esc(r.item_name || "—")}</strong></td>
        <td>${reasonTagHTML(r.return_reason)}</td>
        <td><span class="status-badge stage-${stage.color}">${esc(stage.label)}</span></td>
        <td class="td-muted">${esc(r.date_return_open) || "—"}</td>
        <td class="td-muted">${esc(r.ebay_followup_date) || "—"}</td>
        <td>
          <div class="progress-bar">
            <div class="progress-fill stage-${stage.color}" style="width:${stageProgress(r.status)}%"></div>
          </div>
        </td>
        <td><button class="btn btn-ghost btn-sm" data-return-id="${r.id}">Edit</button></td>
      </tr>`;
  }).join("");

  return `
    <div class="section">
      <div class="inv-group-body">
        <table class="inv-table">
          <thead><tr>
            <th>Order ID</th><th>Item</th><th>Reason</th><th>Status</th>
            <th>Opened</th><th>Follow-up</th><th>Progress</th><th></th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

/** Collapsible list of completed returns. Empty string when there are none. */
export function historyHTML(): string {
  const completed = state.data.filter((r) => r.status === "refund_received");
  if (completed.length === 0) return "";

  const rows = completed.map((r) => `
    <tr data-return-id="${r.id}" class="clickable-row">
      <td class="td-sn">${esc(r.ebay_order_id)}</td>
      <td><strong>${esc(r.item_name || "—")}</strong></td>
      <td>${reasonTagHTML(r.return_reason)}</td>
      <td class="td-muted">${esc(r.date_refund_received) || "—"}</td>
      <td class="td-muted"><strong>${fmtMoney(r.amount_refund_received, "$0.00")}</strong></td>
      <td><button class="btn btn-ghost btn-sm" data-return-id="${r.id}">View</button></td>
    </tr>`).join("");

  return `
    <div class="section returns-history">
      <div class="inv-group-head history-toggle" id="rtn-hist-toggle">
        <span class="history-title">Return History (${completed.length} completed)</span>
        <span class="history-hint">${state.historyExpanded ? "▲ Hide" : "▼ Show"}</span>
      </div>
      <div id="rtn-hist-body" class="${state.historyExpanded ? "" : "hidden"}">
        <div class="inv-group-body">
          <table class="inv-table">
            <thead><tr>
              <th>Order ID</th><th>Item</th><th>Reason</th><th>Date Refunded</th><th>Amount</th><th></th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    </div>`;
}
