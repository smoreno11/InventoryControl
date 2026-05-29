// ── Types ────────────────────────────────────────────────────────────────────

interface WorkflowField { value: string; timestamp: string; }

interface BoxResult {
  serial_number: string;
  box_number: string;
  item: Record<string, unknown> | null;
  workflow_fields: Record<string, WorkflowField>;
}

interface PackedBox {
  serial_number: string;
  box_number: string;
  packed_at: string;
  outgoing_tracking: string;
  item: Record<string, unknown> | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function esc(val: unknown): string {
  return String(val ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmtTs(ts: string): string {
  if (!ts) return "";
  const d = new Date(ts.replace(" ", "T") + "Z");
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

// ── Mount ─────────────────────────────────────────────────────────────────────

// Mounts the Shipping page into the given element and wires up all interactions.
export function mountShipping(el: HTMLElement) {
  el.innerHTML = `
    <main class="app-main">

      <!-- Search section -->
      <section class="section">
        <div class="section-head">
          <div class="section-title">
            <h2>Ship a Box</h2>
            <span class="section-subtitle">Find a box by its 4-digit number, then attach the outgoing tracking number</span>
          </div>
        </div>
        <div class="section-body">
          <div style="display:flex;gap:10px;align-items:flex-end;max-width:380px;">
            <div class="form-field" style="flex:1;margin:0;">
              <label for="ship-box-input">Box Number</label>
              <input
                type="text" id="ship-box-input"
                placeholder="e.g. 4821"
                maxlength="4"
                inputmode="numeric"
                style="font-size:1.6rem;letter-spacing:6px;text-align:center;font-weight:700;"
              />
            </div>
            <button class="btn btn-primary" id="ship-search-btn" style="height:42px;">Search</button>
          </div>
          <div id="ship-msg" style="margin-top:8px;"></div>
          <div id="ship-result" style="margin-top:20px;"></div>
        </div>
      </section>

      <!-- Packed boxes list -->
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

    </main>
  `;

  const input  = document.getElementById("ship-box-input")  as HTMLInputElement;
  const btn    = document.getElementById("ship-search-btn") as HTMLButtonElement;
  const msgEl  = document.getElementById("ship-msg")!;
  const resultEl = document.getElementById("ship-result")!;

  // Search on button click or Enter key.
  async function doSearch() {
    const val = input.value.trim();
    if (!val) {
      msgEl.innerHTML = '<div class="msg msg-error">Enter a 4-digit box number.</div>';
      return;
    }
    btn.disabled = true;
    btn.textContent = "Searching…";
    msgEl.innerHTML = "";
    resultEl.innerHTML = "";
    try {
      const res = await fetch(`/api/box-lookup?box_number=${encodeURIComponent(val)}`);
      if (res.status === 404) {
        msgEl.innerHTML = `<div class="msg msg-error">No box found with number <strong>${esc(val)}</strong>.</div>`;
      } else if (!res.ok) {
        msgEl.innerHTML = '<div class="msg msg-error">Search failed — try again.</div>';
      } else {
        const data: BoxResult = await res.json();
        renderResult(resultEl, data);
      }
    } catch {
      msgEl.innerHTML = '<div class="msg msg-error">Network error — is the backend running?</div>';
    } finally {
      btn.disabled = false;
      btn.textContent = "Search";
    }
  }

  btn.addEventListener("click", doSearch);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") doSearch(); });

  loadPackedList();
}

// ── Result card ───────────────────────────────────────────────────────────────

// Renders the found-item card with item details and the outgoing tracking input.
function renderResult(el: HTMLElement, data: BoxResult) {
  const item = data.item;
  const wf   = data.workflow_fields;
  const existingTracking = wf["OUTGOING_TRACKING"]?.value ?? "";
  const packedBy  = wf["PACKEDBY"]?.value  ?? "";
  const packedAt  = wf["PACKEDBY"]?.timestamp ?? "";
  const shippedBy = wf["SHIPPEDBY"]?.value ?? "";

  el.innerHTML = `
    <div class="pending-card" style="max-width:600px;">

      <!-- Box number badge + item info -->
      <div style="display:flex;align-items:flex-start;gap:20px;flex-wrap:wrap;">
        <div style="background:var(--accent);color:#fff;border-radius:10px;padding:10px 18px;text-align:center;min-width:80px;">
          <div style="font-size:0.65rem;letter-spacing:1px;text-transform:uppercase;opacity:.85;">Box #</div>
          <div style="font-size:2rem;font-weight:800;letter-spacing:4px;line-height:1.1;">${esc(data.box_number)}</div>
        </div>
        <div style="flex:1;">
          <div class="pending-name">${esc(item?.ITEMTYPE as string || "Unknown Item")}</div>
          <div class="pending-meta" style="margin-top:6px;">
            ${item?.SERIALNUMBER ? `<span class="meta-pill">SN: <strong>${esc(item.SERIALNUMBER as string)}</strong></span>` : ""}
            ${item?.DATE         ? `<span class="meta-pill">Logged: <strong>${esc(item.DATE as string)}</strong></span>` : ""}
            ${item?.EBAYORDERID  ? `<span class="meta-pill">eBay: <strong>${esc(item.EBAYORDERID as string)}</strong></span>` : ""}
            ${packedBy ? `<span class="meta-pill">Packed by: <strong>${esc(packedBy)}</strong>${packedAt ? ` <span style="font-weight:400;font-size:0.8em">(${fmtTs(packedAt)})</span>` : ""}</span>` : ""}
            ${shippedBy ? `<span class="meta-pill">Shipped by: <strong>${esc(shippedBy)}</strong></span>` : ""}
          </div>
        </div>
      </div>

      <!-- Tracking input -->
      <div style="margin-top:18px;border-top:1px solid var(--border);padding-top:18px;">
        ${existingTracking
          ? `<div style="margin-bottom:10px;font-size:0.82rem;color:var(--text-muted);">
               Current tracking: <strong style="color:var(--complete);font-size:0.9rem;">${esc(existingTracking)}</strong>
             </div>`
          : ""}
        <div style="display:flex;gap:10px;align-items:flex-end;">
          <div class="form-field" style="flex:1;margin:0;">
            <label for="ship-tracking-input">${existingTracking ? "Update" : "Outgoing"} Tracking Number</label>
            <input type="text" id="ship-tracking-input"
              placeholder="e.g. 1Z999AA10123456784"
              value="${esc(existingTracking)}"
            />
          </div>
          <button class="btn btn-success" id="ship-save-btn" style="height:42px;">Save Tracking</button>
        </div>
        <div id="ship-save-msg" style="margin-top:6px;"></div>
      </div>

    </div>
  `;

  // Wire save button.
  document.getElementById("ship-save-btn")!.addEventListener("click", async () => {
    const trackingInput = document.getElementById("ship-tracking-input") as HTMLInputElement;
    const saveMsgEl     = document.getElementById("ship-save-msg")!;
    const saveBtn       = document.getElementById("ship-save-btn") as HTMLButtonElement;
    const tracking      = trackingInput.value.trim();

    if (!tracking) {
      saveMsgEl.innerHTML = '<div class="msg msg-error">Enter a tracking number first.</div>';
      return;
    }
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving…";

    try {
      const res = await fetch("/api/update-field", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serial_number: data.serial_number, field: "OUTGOING_TRACKING", value: tracking }),
      });
      if (res.ok) {
        saveMsgEl.innerHTML = '<div class="msg msg-success">Tracking number saved!</div>';
        // Update the "current tracking" line without re-searching.
        const currentLine = el.querySelector<HTMLDivElement>("[data-tracking-display]");
        if (currentLine) currentLine.innerHTML = `Current tracking: <strong style="color:var(--complete);font-size:0.9rem;">${esc(tracking)}</strong>`;
        setTimeout(() => { saveMsgEl.innerHTML = ""; }, 2500);
        loadPackedList(); // refresh the list below
      } else {
        saveMsgEl.innerHTML = '<div class="msg msg-error">Failed to save — try again.</div>';
      }
    } catch {
      saveMsgEl.innerHTML = '<div class="msg msg-error">Network error.</div>';
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Tracking";
    }
  });
}

// ── Packed boxes list ─────────────────────────────────────────────────────────

// Fetches and renders the full list of packed boxes, split into "needs tracking" and "shipped".
async function loadPackedList() {
  const listEl = document.getElementById("ship-packed-list");
  if (!listEl) return;

  try {
    const res = await fetch("/api/packed-boxes");
    if (!res.ok) {
      listEl.innerHTML = '<div class="empty-state"><p>Unable to load packed boxes.</p></div>';
      return;
    }
    const items: PackedBox[] = await res.json();

    if (items.length === 0) {
      listEl.innerHTML = '<div class="empty-state"><p>No packed boxes yet — save PACKEDBY in the Assessment modal to auto-assign a box number.</p></div>';
      return;
    }

    const pending  = items.filter(i => !i.outgoing_tracking);
    const shipped  = items.filter(i =>  i.outgoing_tracking);

    listEl.innerHTML = `
      ${pending.length ? `
        <div style="font-size:0.75rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--text-muted);margin-bottom:6px;">
          Needs Tracking (${pending.length})
        </div>
        ${packedTable(pending)}
        <div style="margin-bottom:24px;"></div>
      ` : ""}
      ${shipped.length ? `
        <div style="font-size:0.75rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--text-muted);margin-bottom:6px;">
          Tracking Attached (${shipped.length})
        </div>
        ${packedTable(shipped)}
      ` : ""}
    `;
  } catch {
    listEl.innerHTML = '<div class="empty-state"><p>Network error.</p></div>';
  }
}

// Builds the HTML table for a list of packed boxes.
function packedTable(items: PackedBox[]): string {
  return `
    <table class="inv-table">
      <thead>
        <tr>
          <th>Box #</th>
          <th>Item Type</th>
          <th>Serial #</th>
          <th>eBay Order</th>
          <th>Packed</th>
          <th>Outgoing Tracking</th>
        </tr>
      </thead>
      <tbody>
        ${items.map(r => `
          <tr>
            <td><strong style="font-size:1.05rem;letter-spacing:3px;">${esc(r.box_number)}</strong></td>
            <td>${esc(r.item?.ITEMTYPE as string || "—")}</td>
            <td class="td-sn">${esc(r.serial_number)}</td>
            <td class="td-muted" style="font-size:0.75rem;">${esc(r.item?.EBAYORDERID as string || "—")}</td>
            <td class="td-muted" style="font-size:0.75rem;">${fmtTs(r.packed_at)}</td>
            <td>${r.outgoing_tracking
              ? `<span style="color:var(--complete);font-size:0.82rem;">${esc(r.outgoing_tracking)}</span>`
              : `<span class="td-muted">—</span>`
            }</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}
