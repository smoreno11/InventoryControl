// ── Types ─────────────────────────────────────────────────────────────────

interface Item {
  id: number;
  STATUS: string;
  DATE: string;
  NAME: string;
  TRACKING: string;
  EBAYORDERID: string;
  QTYORDERED: number;
  TOTALCOST: number;
  ITEMTYPE: string;
  QTYRECEIVED: number;
  SERIALNUMBER: string;
  LOGGEDBY: string;
  NOTES: string;
}

// ── Utilities ──────────────────────────────────────────────────────────────

function esc(val: unknown): string {
  return String(val ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmt$(n: number | null | undefined): string {
  if (n == null || isNaN(Number(n))) return "—";
  return `$${Number(n).toFixed(2)}`;
}

function q<T extends Element>(
  sel: string,
  root: Element | Document = document,
): T {
  return root.querySelector<T>(sel)!;
}

// ── State ──────────────────────────────────────────────────────────────────

let pendingItems: Item[] = [];
let completeItems: Item[] = [];
let searchQuery = "";
let viewMode: "date" | "type" = "date";

const _now = new Date();
let filterMonth: number | null = _now.getMonth() + 1;
let filterYear: number | null = _now.getFullYear();

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// ── Date helpers ────────────────────────────────────────────────────────────

function parseDate(s: string): number {
  if (!s) return 0;
  const parts = s.split("/");
  if (parts.length === 3) {
    const [m, d, y] = parts.map(Number);
    const year = y < 100 ? 2000 + y : y;
    const ts = new Date(year, m - 1, d).getTime();
    if (!isNaN(ts)) return ts;
  }
  const fallback = new Date(s).getTime();
  return isNaN(fallback) ? 0 : fallback;
}

// ── Bootstrap ──────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  buildShell();
  wire();
  loadAll();
});

function buildShell() {
  document.getElementById("app")!.innerHTML = `
    <header class="app-header">
      <div class="header-inner">
        <div class="header-brand">
          <h1>Inventory Control</h1>
          <div class="tagline">A MorBright Product</div>
        </div>
        <nav class="app-nav">
          <button class="nav-btn active" data-page="inventory">Inventory</button>
          <button class="nav-btn" data-page="returns">eBay Returns</button>
          <button class="nav-btn" data-page="shipping">Shipping</button>
        </nav>
        <div class="header-stats" id="header-stats"></div>
      </div>
    </header>

    <div id="page-inventory">
    <main class="app-main">

      <!-- ① Add Pending Shipment -->
      <section class="section">
        <div class="section-head clickable" id="toggle-add">
          <div class="section-title">
            <h2>Add Pending Shipment</h2>
            <span class="section-subtitle">Manual entry when Google Sheets is unavailable</span>
          </div>
          <span class="toggle-arrow" id="add-arrow">▼</span>
        </div>
        <div class="section-body collapsed" id="add-body">
          <form id="form-add" novalidate>
            <div class="form-grid">
              <div class="form-field">
                <label for="p-date">Date *</label>
                <input type="text" id="p-date" placeholder="MM/DD/YY" />
              </div>
              <div class="form-field">
                <label for="p-ebayorderid">eBay Order ID</label>
                <input type="text" id="p-ebayorderid" placeholder="112-XXXXX-XXXXXX" />
              </div>
              <div class="form-field">
                <label for="p-tracking">Tracking #</label>
                <input type="text" id="p-tracking" placeholder="Carrier tracking number" />
              </div>
              <div class="form-field">
                <label for="p-qty">Qty from Order</label>
                <input type="number" id="p-qty" min="0" placeholder="0" />
              </div>
              <div class="form-field">
                <label for="p-cost">Total Cost ($)</label>
                <input type="number" id="p-cost" min="0" step="0.01" placeholder="0.00" />
              </div>
              <div class="form-field">
                <label for="p-name">eBay Item Name (optional)</label>
                <input type="text" id="p-name" placeholder="Full eBay listing title" />
              </div>
            </div>
            <div id="add-msg"></div>
            <button type="submit" class="btn btn-primary">+ Add Pending Shipment</button>
          </form>
        </div>
      </section>

      <!-- ② Pending Inventory -->
      <section class="section">
        <div class="section-head">
          <div class="section-title">
            <h2>Pending Inventory</h2>
            <span class="badge badge-pending" id="badge-pending">0</span>
          </div>
        </div>
        <div class="section-body">
          <div id="pending-list" class="pending-list"></div>
        </div>
      </section>

      <!-- ③ Complete Inventory -->
      <section class="section">
        <div class="section-head">
          <div class="section-title">
            <h2>Inventory</h2>
            <span class="badge badge-complete" id="badge-complete">0</span>
          </div>
          <div class="view-toggle">
            <button class="view-btn active" data-view="date">By Date</button>
            <button class="view-btn" data-view="type">By Type</button>
          </div>
        </div>
        <div class="month-bar">
          <button class="month-nav" id="month-prev">&#8249;</button>
          <span class="month-label" id="month-label"></span>
          <button class="month-nav" id="month-next">&#8250;</button>
          <button class="month-all" id="month-all">All Time</button>
        </div>
        <div class="section-body">
          <div class="search-wrap">
            <input type="search" id="inv-search"
              placeholder="Search by item type, serial #, date (MM/DD/YY), eBay order, logged by..." />
          </div>
          <div id="complete-list" class="inv-groups"></div>
        </div>
      </section>

    </main>
    </div>

    <div id="page-returns" style="display:none"></div>
    <div id="page-shipping" style="display:none"></div>

    <!-- Assessment Modal -->
    <div class="modal-overlay hidden" id="assessment-overlay">
      <div class="modal">
        <div class="modal-header">
          <h3>Item Workflow</h3>
          <button class="modal-close" id="assessment-close">&#10005;</button>
        </div>
        <div class="modal-body">
          <div class="modal-item-info" id="assessment-item-info"></div>
          <div id="assessment-box-display" style="margin-top:14px;"></div>
          <div id="assessment-rows" style="margin-top:12px;display:flex;flex-direction:column;gap:10px;"></div>
          <div id="assessment-msg"></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" id="assessment-cancel">Close</button>
        </div>
      </div>
    </div>

    <!-- Report Issue Modal -->
    <div class="modal-overlay hidden" id="report-overlay">
      <div class="modal">
        <div class="modal-header">
          <h3>Report Issue</h3>
          <button class="modal-close" id="report-close">&#10005;</button>
        </div>
        <div class="modal-body">
          <div class="modal-item-info" id="report-item-info"></div>
          <div class="form-field" style="margin-top:12px;">
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
    </div>
  `;
}

import { createUploadUI } from "./upload";

createUploadUI();

function wire() {
  q("#toggle-add").addEventListener("click", () => {
    const body = q<HTMLDivElement>("#add-body");
    const arrow = q("#add-arrow");
    const collapsed = body.classList.toggle("collapsed");
    arrow.classList.toggle("rotated", !collapsed);
  });

  q<HTMLFormElement>("#form-add").addEventListener("submit", onAddPending);

  q<HTMLInputElement>("#inv-search").addEventListener("input", (e) => {
    searchQuery = (e.target as HTMLInputElement).value.toLowerCase();
    renderComplete();
  });

  document.querySelectorAll<HTMLButtonElement>(".view-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      viewMode = btn.dataset.view as "date" | "type";
      document
        .querySelectorAll(".view-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      renderComplete();
    });
  });

  q("#month-prev").addEventListener("click", () => {
    if (filterMonth === null) {
      filterMonth = _now.getMonth() + 1;
      filterYear = _now.getFullYear();
    } else if (filterMonth === 1) {
      filterMonth = 12;
      filterYear = (filterYear ?? _now.getFullYear()) - 1;
    } else {
      filterMonth -= 1;
    }
    renderComplete();
  });

  q("#month-next").addEventListener("click", () => {
    if (filterMonth === null) {
      filterMonth = _now.getMonth() + 1;
      filterYear = _now.getFullYear();
    } else if (filterMonth === 12) {
      filterMonth = 1;
      filterYear = (filterYear ?? _now.getFullYear()) + 1;
    } else {
      filterMonth += 1;
    }
    renderComplete();
  });

  q("#month-all").addEventListener("click", () => {
    filterMonth = null;
    filterYear = null;
    renderComplete();
  });

  q("#assessment-close").addEventListener("click", closeAssessment);
  q("#assessment-cancel").addEventListener("click", closeAssessment);
  q("#assessment-overlay").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeAssessment();
  });

  q("#report-close").addEventListener("click", closeReport);
  q("#report-cancel").addEventListener("click", closeReport);
  q("#report-overlay").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeReport();
  });
  q("#report-send").addEventListener("click", sendReport);

  document.querySelectorAll<HTMLButtonElement>('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const page = btn.dataset.page!;
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('page-inventory')!.style.display = page === 'inventory' ? '' : 'none';
      const rtnEl = document.getElementById('page-returns')!;
      rtnEl.style.display = page === 'returns' ? '' : 'none';
      if (page === 'returns') {
        import('./returns').then(m => m.mountReturns(rtnEl));
      }
      const shipEl = document.getElementById('page-shipping')!;
      shipEl.style.display = page === 'shipping' ? '' : 'none';
      if (page === 'shipping') {
        import('./shipping').then(m => m.mountShipping(shipEl));
      }
    });
  });
}

// ── Data ───────────────────────────────────────────────────────────────────

async function loadAll() {
  try {
    const [p, c] = await Promise.all([
      fetch("/api/pending").then((r) => r.json()),
      fetch("/api/complete").then((r) => r.json()),
    ]);
    pendingItems = p as Item[];
    completeItems = c as Item[];
    renderAll();
  } catch {
    console.error("Failed to load inventory — is the backend running?");
  }
}

function renderAll() {
  renderHeader();
  renderPending();
  renderComplete();
}

// ── Header ─────────────────────────────────────────────────────────────────

function renderHeader() {
  q("#header-stats").innerHTML = `
    <div class="stat-chip">
      <span class="stat-n">${pendingItems.length}</span>
      <span>Pending</span>
    </div>
    <div class="stat-chip">
      <span class="stat-n">${completeItems.length}</span>
      <span>Logged</span>
    </div>
  `;
  q("#badge-pending").textContent = String(pendingItems.length);
  q("#badge-complete").textContent = String(completeItems.length);
}

// ── Pending section ────────────────────────────────────────────────────────

function renderPending() {
  const list = q("#pending-list");

  if (pendingItems.length === 0) {
    list.innerHTML = `<div class="empty-state"><p>No pending shipments — everything has been logged!</p></div>`;
    return;
  }

  list.innerHTML = pendingItems.map(pendingCardHTML).join("");

  list.querySelectorAll<HTMLButtonElement>(".btn-expand").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id!;
      const wrap = list.querySelector<HTMLDivElement>(`#cwrap-${id}`)!;
      const hidden = wrap.classList.toggle("hidden");
      btn.textContent = hidden ? "Log Receipt" : "Cancel";
    });
  });

  list.querySelectorAll<HTMLFormElement>(".form-complete").forEach((form) => {
    form.addEventListener("submit", (e) => onComplete(e, form));
  });
}

function pendingCardHTML(item: Item): string {
  const name = item.NAME?.trim() || "Unknown Item";
  const pills = [
    item.DATE &&
      `<span class="meta-pill">Date: <strong>${esc(item.DATE)}</strong></span>`,
    item.EBAYORDERID &&
      `<span class="meta-pill">Order: <strong>${esc(item.EBAYORDERID)}</strong></span>`,
    item.TRACKING &&
      `<span class="meta-pill">Tracking: ${esc(item.TRACKING)}</span>`,
    item.QTYORDERED &&
      `<span class="meta-pill">Qty ordered: <strong>${item.QTYORDERED}</strong></span>`,
    item.TOTALCOST &&
      `<span class="meta-pill">Cost: <strong>${fmt$(item.TOTALCOST)}</strong></span>`,
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
          <button type="submit" class="btn btn-success" style="margin-top:8px;">
            Mark as Complete
          </button>
        </form>
      </div>
    </div>`;
}

// ── Complete inventory ──────────────────────────────────────────────────────

function renderComplete() {
  const list = q("#complete-list");

  const label = document.getElementById("month-label")!;
  const allBtn = document.getElementById("month-all")!;
  if (filterMonth === null) {
    label.textContent = "All Time";
    allBtn.classList.add("active");
  } else {
    label.textContent = `${MONTH_NAMES[filterMonth - 1]} ${filterYear}`;
    allBtn.classList.remove("active");
  }

  let items = completeItems;

  if (filterMonth !== null) {
    items = items.filter((it) => {
      const ts = parseDate(it.DATE);
      if (!ts) return false;
      const d = new Date(ts);
      return d.getMonth() + 1 === filterMonth && d.getFullYear() === filterYear;
    });
  }

  if (searchQuery) {
    items = items.filter((it) =>
      [
        it.ITEMTYPE,
        it.SERIALNUMBER,
        it.LOGGEDBY,
        it.NAME,
        it.NOTES,
        it.EBAYORDERID,
        it.TRACKING,
        it.DATE,
      ].some((f) =>
        String(f ?? "")
          .toLowerCase()
          .includes(searchQuery),
      ),
    );
  }

  if (items.length === 0) {
    const msg = searchQuery
      ? `No items match "${searchQuery}"`
      : "No logged inventory yet.";
    list.innerHTML = `<div class="empty-state"><p>${esc(msg)}</p></div>`;
    return;
  }

  if (viewMode === "date") {
    renderByDate(list, items);
  } else {
    renderByType(list, items);
  }
}

function itemRow(it: Item, showType: boolean): string {
  const typeCell = showType
    ? `<td><strong>${esc(it.ITEMTYPE?.trim() || "Uncategorized")}</strong></td>`
    : "";
  const reportData = encodeURIComponent(
    JSON.stringify({
      id: it.id,
      type: it.ITEMTYPE,
      sn: it.SERIALNUMBER,
      date: it.DATE,
      name: it.NAME,
    }),
  );
  return `
    <tr>
      ${typeCell}
      <td class="td-muted">${esc(it.DATE) || "—"}</td>
      <td class="td-sn">${esc(it.SERIALNUMBER) || '<span class="td-muted">—</span>'}</td>
      <td class="td-qty ${it.QTYRECEIVED === 0 ? "td-qty-zero" : ""}">${it.QTYRECEIVED ?? "—"}</td>
      <td>${esc(it.LOGGEDBY) || '<span class="td-muted">—</span>'}</td>
      <td class="td-cost">${fmt$(it.TOTALCOST)}</td>
      <td class="td-muted" style="font-size:0.75rem">${esc(it.EBAYORDERID) || "—"}</td>
      <td class="td-notes" title="${esc(it.NAME)}">${esc(it.NAME) || '<span class="td-muted">—</span>'}</td>
      <td class="td-notes" title="${esc(it.NOTES)}">${esc(it.NOTES) || '<span class="td-muted">—</span>'}</td>
      <td><button class="td-notes" onclick="__testReport('${reportData}')">Assesment</button></td>
      <td><button class="btn-report" onclick="__openReport('${reportData}')">Report Issue</button></td>
      
      </tr>`;
}

function tableHead(showType: boolean): string {
  const typeHeader = showType ? "<th>Item Type</th>" : "";
  return `<thead><tr>${typeHeader}<th>Date</th><th>Serial #</th><th>Qty</th><th>Logged By</th><th>Cost</th><th>eBay Order</th><th>eBay Item Name</th><th>Notes</th><th></th></tr></thead>`;
}

function renderByDate(list: Element, items: Item[]) {
  const sorted = [...items].sort(
    (a, b) => parseDate(b.DATE) - parseDate(a.DATE),
  );
  list.innerHTML = `
    <div class="inv-group">
      <div class="inv-group-body" style="border:none">
        <table class="inv-table">
          ${tableHead(true)}
          <tbody>${sorted.map((it) => itemRow(it, true)).join("")}</tbody>
        </table>
      </div>
    </div>`;
}

function renderByType(list: Element, items: Item[]) {
  const groups = new Map<string, Item[]>();
  for (const item of items) {
    const key = (item.ITEMTYPE?.trim() || "Uncategorized").toUpperCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }

  const sortedKeys = [...groups.keys()].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );

  list.innerHTML = sortedKeys
    .map((key) => {
      const group = groups
        .get(key)!
        .sort((a, b) => parseDate(b.DATE) - parseDate(a.DATE));
      const totalQty = group.reduce((s, i) => s + (i.QTYRECEIVED || 0), 0);
      const gid = `g-${key.replace(/\W+/g, "-")}`;
      return `
      <div class="inv-group">
        <div class="inv-group-head" onclick="__toggleGroup('${gid}', this)">
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

//Group toggle (global for inline onclick)

(window as Record<string, unknown>)["__toggleGroup"] = (
  gid: string,
  headEl: HTMLElement,
) => {
  const body = document.getElementById(gid)!;
  const arrow = headEl.querySelector<HTMLElement>(".toggle-arrow")!;
  const hidden = body.classList.toggle("hidden");
  arrow.classList.toggle("rotated", !hidden);
};

// Report modal

(window as Record<string, unknown>)["__openReport"] = (encoded: string) => {
  const item = JSON.parse(decodeURIComponent(encoded));
  q("#report-item-info").innerHTML = `
    <div class="report-item-type">${esc(item.type || "Uncategorized")}</div>
    <div class="report-item-meta">
      ${item.sn ? `<span>SN: <strong>${esc(item.sn)}</strong></span>` : ""}
      ${item.date ? `<span>Date: <strong>${esc(item.date)}</strong></span>` : ""}
      ${item.name ? `<span class="report-item-name" title="${esc(item.name)}">${esc(item.name)}</span>` : ""}
    </div>`;
  q<HTMLTextAreaElement>("#report-desc").value = "";
  q("#report-msg").innerHTML = "";
  q("#report-overlay").classList.remove("hidden");
  q<HTMLTextAreaElement>("#report-desc").focus();
};

function closeReport() {
  q("#report-overlay").classList.add("hidden");
}

function sendReport() {
  const desc = q<HTMLTextAreaElement>("#report-desc").value.trim();
  const msgEl = q("#report-msg");
  if (!desc) {
    msgEl.innerHTML =
      '<div class="msg msg-error">Please describe the issue.</div>';
    return;
  }
  const btn = q<HTMLButtonElement>("#report-send");
  btn.disabled = true;
  btn.textContent = "Sending...";
  // Cosmetic for now — wire to email/Slack/backend here later
  setTimeout(() => {
    msgEl.innerHTML =
      '<div class="msg msg-success">Alert logged! Your boss will be notified.</div>';
    btn.disabled = false;
    btn.textContent = "Send Alert to Boss";
    setTimeout(closeReport, 1800);
  }, 600);
}

// ── Form handlers ──────────────────────────────────────────────────────────

async function onAddPending(e: Event) {
  e.preventDefault();
  const form = e.target as HTMLFormElement;
  const btn = form.querySelector<HTMLButtonElement>("[type=submit]")!;
  const msgEl = q<HTMLDivElement>("#add-msg");

  const dateEl = q<HTMLInputElement>("#p-date");
  const date = dateEl.value.trim();

  dateEl.classList.remove("field-error");
  msgEl.innerHTML = "";

  if (!date) {
    dateEl.classList.add("field-error");
    msgEl.innerHTML = '<div class="msg msg-error">Date is required.</div>';
    return;
  }

  btn.disabled = true;
  btn.textContent = "Adding...";

  try {
    const res = await fetch("/api/pending", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date,
        ebayorderid: q<HTMLInputElement>("#p-ebayorderid").value.trim(),
        tracking: q<HTMLInputElement>("#p-tracking").value.trim(),
        qtyordered: parseInt(q<HTMLInputElement>("#p-qty").value) || 0,
        totalcost: parseFloat(q<HTMLInputElement>("#p-cost").value) || 0,
        name: q<HTMLInputElement>("#p-name").value.trim(),
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      msgEl.innerHTML = `<div class="msg msg-error">${esc(err.detail ?? "Failed to add.")}</div>`;
    } else {
      msgEl.innerHTML =
        '<div class="msg msg-success">Pending shipment added!</div>';
      form.reset();
      await loadAll();
      setTimeout(() => {
        msgEl.innerHTML = "";
      }, 3500);
    }
  } catch {
    msgEl.innerHTML =
      '<div class="msg msg-error">Network error — is the backend running?</div>';
  } finally {
    btn.disabled = false;
    btn.textContent = "+ Add Pending Shipment";
  }
}

async function onComplete(e: Event, form: HTMLFormElement) {
  e.preventDefault();
  const id = parseInt(form.dataset.id!);
  const btn = form.querySelector<HTMLButtonElement>("[type=submit]")!;
  const msgEl = document.getElementById(`cmsg-${id}`)!;

  const get = (name: string) =>
    (
      form.querySelector<HTMLInputElement>(`[name="${name}"]`)?.value ?? ""
    ).trim();

  const itemtype = get("itemtype");
  const serialnumber = get("serialnumber");
  const qtyreceived = parseInt(
    form.querySelector<HTMLInputElement>('[name="qtyreceived"]')?.value ?? "0",
  );
  const loggedby = get("loggedby");
  const notes = get("notes");

  form
    .querySelectorAll("input")
    .forEach((i) => i.classList.remove("field-error"));
  msgEl.innerHTML = "";

  const errors: string[] = [];
  if (!itemtype) {
    errors.push("Item Type is required.");
    form
      .querySelector<HTMLInputElement>('[name="itemtype"]')
      ?.classList.add("field-error");
  }
  if (!serialnumber) {
    errors.push("Serial Number is required.");
    form
      .querySelector<HTMLInputElement>('[name="serialnumber"]')
      ?.classList.add("field-error");
  }
  if (!loggedby) {
    errors.push("Logged By is required.");
    form
      .querySelector<HTMLInputElement>('[name="loggedby"]')
      ?.classList.add("field-error");
  }
  if (qtyreceived < 1) {
    errors.push("Qty Received must be at least 1.");
    form
      .querySelector<HTMLInputElement>('[name="qtyreceived"]')
      ?.classList.add("field-error");
  }

  if (errors.length) {
    msgEl.innerHTML = `<div class="msg msg-error">${errors.join(" ")}</div>`;
    return;
  }

  btn.disabled = true;
  btn.textContent = "Saving...";

  try {
    const res = await fetch(`/api/inventory/${id}/complete`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemtype,
        serialnumber,
        qtyreceived,
        loggedby,
        notes,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      msgEl.innerHTML = `<div class="msg msg-error">${esc(err.detail ?? "Failed to complete item.")}</div>`;
      btn.disabled = false;
      btn.textContent = "Mark as Complete";
    } else {
      await loadAll();
    }
  } catch {
    msgEl.innerHTML = '<div class="msg msg-error">Network error.</div>';
    btn.disabled = false;
    btn.textContent = "Mark as Complete";
  }
}

function getOptions() {
  const names = ["John", "Saul", "Ryan", "Dan", "William", "Michael"];

  return names.map((n) => `<option value="${n}">${n}</option>`).join("");
}

// Updates (or clears) the box number banner inside the assessment modal.
function refreshBoxDisplay(saved: Record<string, { value: string; timestamp: string }>) {
  const el = document.getElementById("assessment-box-display");
  if (!el) return;
  const boxNum = saved["BOX_NUMBER"]?.value ?? "";
  if (!boxNum) {
    el.innerHTML = "";
    return;
  }
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;background:var(--accent);color:#fff;border-radius:8px;padding:10px 16px;">
      <div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:1px;opacity:.85;line-height:1;">Box #</div>
      <div style="font-size:1.8rem;font-weight:800;letter-spacing:5px;line-height:1;">${esc(boxNum)}</div>
      <div style="font-size:0.72rem;opacity:.85;margin-left:4px;">Write this on the box</div>
    </div>
  `;
}

//Creating the log to attack name to the products based on who tested them
function closeAssessment() {
  q("#assessment-overlay").classList.add("hidden");
}

// Formats a DB timestamp string (e.g. "2026-05-18 10:23:45") into a readable label like "May 18, 2026 10:23 AM".
function fmtTimestamp(ts: string): string {
  if (!ts) return "";
  const d = new Date(ts.replace(" ", "T") + "Z");
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

// Builds one workflow row (label + name dropdown + Save button + timestamp). savedTimestamp is shown in muted text if present.
function buildAssessmentRow(field: string, serial: string, savedValue: string = "", savedTimestamp: string = ""): string {
  const names = ["John", "Saul", "Ryan", "Dan", "William", "Michael"];
  const options = names.map(n =>
    `<option value="${n}" ${n === savedValue ? "selected" : ""}>${n}</option>`
  ).join("");
  const tsLabel = savedTimestamp
    ? `<div style="font-size:0.7rem;color:var(--text-muted);margin-top:2px;">Set ${fmtTimestamp(savedTimestamp)}</div>`
    : "";
  return `
    <div style="display:flex;align-items:center;gap:10px;">
      <div id="asmt-label-${field}" style="width:120px;">
        <div style="font-weight:600;font-size:0.85rem">${esc(field)}</div>
        ${tsLabel}
      </div>
      <select id="asmt-${field}" style="flex:1;padding:6px 8px;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:0.85rem">
        <option value="">-- Select Name --</option>
        ${options}
      </select>
      <button class="btn btn-primary btn-sm" id="asmt-save-${field}" data-field="${field}" data-serial="${esc(serial)}">Save</button>
      <span id="asmt-msg-${field}" style="font-size:0.75rem;color:var(--complete)"></span>
    </div>
  `;
}

(window as Record<string, unknown>)["__testReport"] = async (encoded: string) => {
  const item = JSON.parse(decodeURIComponent(encoded));

  q("#assessment-item-info").innerHTML = `
    <div class="report-item-type">${esc(item.type || "Uncategorized")}</div>
    <div class="report-item-meta">
      <span>${esc(item.date || "")}</span>
      ${item.sn ? `<span>SN: ${esc(item.sn)}</span>` : ""}
      ${item.name ? `<span class="report-item-name" title="${esc(item.name)}">${esc(item.name)}</span>` : ""}
    </div>
  `;

  // Load any previously saved values (and their timestamps) for this serial number.
  let saved: Record<string, { value: string; timestamp: string }> = {};
  try {
    const res = await fetch(`/api/workflow-fields?serial_number=${encodeURIComponent(item.sn || "")}`);
    if (res.ok) saved = await res.json();
  } catch { /* silently ignore — modal still opens with empty dropdowns */ }

  const fields = ["TESTEDBY", "PACKEDBY", "SHIPPEDBY", "RETURNEDBY"];
  q("#assessment-rows").innerHTML = fields.map(f =>
    buildAssessmentRow(f, item.sn, saved[f]?.value ?? "", saved[f]?.timestamp ?? "")
  ).join("");
  q("#assessment-msg").innerHTML = "";
  refreshBoxDisplay(saved);

  fields.forEach(field => {
    q(`#asmt-save-${field}`).addEventListener("click", async () => {
      const select = q<HTMLSelectElement>(`#asmt-${field}`);
      const msgEl = q(`#asmt-msg-${field}`);
      if (!select.value) { msgEl.textContent = "Select a name first"; return; }
      try {
        await fetch("/api/update-field", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ serial_number: item.sn, field, value: select.value }),
        });
        // Refresh timestamps and box number display without closing the modal.
        const res2 = await fetch(`/api/workflow-fields?serial_number=${encodeURIComponent(item.sn || "")}`);
        if (res2.ok) {
          const refreshed: Record<string, { value: string; timestamp: string }> = await res2.json();
          const ts = refreshed[field]?.timestamp ?? "";
          const labelCell = document.getElementById(`asmt-label-${field}`);
          if (labelCell) {
            labelCell.innerHTML = `<div style="font-weight:600;font-size:0.85rem">${esc(field)}</div>` +
              (ts ? `<div style="font-size:0.7rem;color:var(--text-muted);margin-top:2px;">Set ${fmtTimestamp(ts)}</div>` : "");
          }
          refreshBoxDisplay(refreshed);
        }
        msgEl.textContent = "Saved!";
        setTimeout(() => { msgEl.textContent = ""; }, 1800);
      } catch {
        msgEl.textContent = "Failed";
      }
    });
  });

  q("#assessment-overlay").classList.remove("hidden");
};
