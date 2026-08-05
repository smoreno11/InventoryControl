/** Markup builders for the shipping page. */

import { fmtTimestamp } from "../../lib/format";
import { esc } from "../../lib/html";
import type { BoxResult, PackedBox } from "../../types";

export function shippingPageHTML(): string {
  return `
    <main class="app-main">

      <section class="section">
        <div class="section-head">
          <div class="section-title">
            <h2>Ship a Box</h2>
            <span class="section-subtitle">Find a box by its 4-digit number, then attach the outgoing tracking number</span>
          </div>
        </div>
        <div class="section-body">
          <div class="box-search">
            <div class="form-field box-search-field">
              <label for="ship-box-input">Box Number</label>
              <input type="text" id="ship-box-input" class="box-number-input"
                placeholder="e.g. 4821" maxlength="4" inputmode="numeric" />
            </div>
            <button class="btn btn-primary" id="ship-search-btn">Search</button>
          </div>
          <div id="ship-msg" class="ship-msg"></div>
          <div id="ship-result" class="ship-result"></div>
        </div>
      </section>

      <section class="section">
        <div class="section-head">
          <div class="section-title">
            <h2>All Packed Boxes</h2>
            <span class="section-subtitle">Every box with an assigned number — green means tracking is attached</span>
          </div>
        </div>
        <div class="section-body">
          <div id="ship-packed-list">Loading…</div>
        </div>
      </section>

    </main>`;
}

/** The found-box card: item details plus the outgoing tracking input. */
export function resultHTML(data: BoxResult): string {
  const item = data.item;
  const fields = data.workflow_fields;
  const tracking = fields["OUTGOING_TRACKING"]?.value ?? "";
  const packedBy = fields["PACKEDBY"]?.value ?? "";
  const packedAt = fields["PACKEDBY"]?.timestamp ?? "";
  const shippedBy = fields["SHIPPEDBY"]?.value ?? "";

  const pill = (label: string, value: unknown) =>
    value ? `<span class="meta-pill">${label}: <strong>${esc(value as string)}</strong></span>` : "";

  return `
    <div class="pending-card box-card">

      <div class="box-card-head">
        <div class="box-badge">
          <div class="box-badge-label">Box #</div>
          <div class="box-badge-number">${esc(data.box_number)}</div>
        </div>
        <div class="box-card-info">
          <div class="pending-name">${esc((item?.ITEMTYPE as string) || "Unknown Item")}</div>
          <div class="pending-meta">
            ${pill("SN", item?.SERIALNUMBER)}
            ${pill("Logged", item?.DATE)}
            ${pill("eBay", item?.EBAYORDERID)}
            ${packedBy
              ? `<span class="meta-pill">Packed by: <strong>${esc(packedBy)}</strong>${
                  packedAt ? ` <span class="meta-pill-time">(${fmtTimestamp(packedAt)})</span>` : ""
                }</span>`
              : ""}
            ${pill("Shipped by", shippedBy)}
          </div>
        </div>
      </div>

      <div class="box-tracking">
        <div class="current-tracking ${tracking ? "" : "hidden"}" data-tracking-display>
          ${tracking ? `Current tracking: <strong>${esc(tracking)}</strong>` : ""}
        </div>
        <div class="box-tracking-row">
          <div class="form-field box-tracking-field">
            <label for="ship-tracking-input">${tracking ? "Update" : "Outgoing"} Tracking Number</label>
            <input type="text" id="ship-tracking-input"
              placeholder="e.g. 1Z999AA10123456784" value="${esc(tracking)}" />
          </div>
          <button class="btn btn-success" id="ship-save-btn">Save Tracking</button>
        </div>
        <div id="ship-save-msg" class="ship-save-msg"></div>
      </div>

    </div>`;
}

/** Packed boxes, split into those still needing tracking and those already shipped. */
export function packedListHTML(items: PackedBox[]): string {
  const needsTracking = items.filter((i) => !i.outgoing_tracking);
  const shipped = items.filter((i) => i.outgoing_tracking);

  const group = (title: string, rows: PackedBox[]) =>
    rows.length
      ? `<div class="packed-group-title">${title} (${rows.length})</div>${packedTableHTML(rows)}`
      : "";

  return `
    ${group("Needs Tracking", needsTracking)}
    ${needsTracking.length && shipped.length ? '<div class="packed-group-gap"></div>' : ""}
    ${group("Tracking Attached", shipped)}`;
}

function packedTableHTML(items: PackedBox[]): string {
  const rows = items.map((r) => `
    <tr>
      <td><strong class="packed-box-number">${esc(r.box_number)}</strong></td>
      <td>${esc((r.item?.ITEMTYPE as string) || "—")}</td>
      <td class="td-sn">${esc(r.serial_number)}</td>
      <td class="td-muted td-small">${esc((r.item?.EBAYORDERID as string) || "—")}</td>
      <td class="td-muted td-small">${fmtTimestamp(r.packed_at)}</td>
      <td>${r.outgoing_tracking
        ? `<span class="tracking-ok">${esc(r.outgoing_tracking)}</span>`
        : '<span class="td-muted">—</span>'}</td>
    </tr>`).join("");

  return `
    <table class="inv-table">
      <thead>
        <tr>
          <th>Box #</th><th>Item Type</th><th>Serial #</th>
          <th>eBay Order</th><th>Packed</th><th>Outgoing Tracking</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}
