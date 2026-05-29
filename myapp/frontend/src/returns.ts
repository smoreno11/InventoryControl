// Types

interface EbayReturn {
  id: number;
  status: 'inspection' | 'ebay_filed' | 'pending_approval' | 'packing' | 'refund_received';
  ebay_order_id: string;
  item_name: string;
  quantity: number;
  total_cost: number;
  date_received: string;
  serial_number: string;
  logged_by: string;
  wms_functional: number;
  wms_case_good: number;
  cd_changer_functional: number;
  cd_changer_case_good: number;
  return_reason: string;
  inspection_notes: string;
  date_return_open: string;
  return_open_by: string;
  ebay_followup_date: string;
  return_label_received: number;
  date_label_received: string;
  ebay_notes: string;
  partial_refund_accepted: number;
  partial_refund_amount: number;
  michael_approval_date: string;
  approval_notes: string;
  date_contacted_seller: string;
  rtn_packed_by: string;
  date_package_returned: string;
  return_tracking: string;
  packing_notes: string;
  amount_refund_received: number;
  date_refund_received: string;
  refund_notes: string;
  created_at: string;
  updated_at: string;
}

interface ReturnStats {
  total_open: number;
  pending_approval: number;
  urgent: number;
  total_refunded: number;
}

// Utils

// Escapes HTML special characters to prevent XSS when injecting into innerHTML.
function esc(val: unknown): string {
  return String(val ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Formats a number as a dollar string (e.g. 12.5 → "$12.50").
function fmt$(n: number | null | undefined): string {
  if (n == null || isNaN(Number(n))) return "$0.00";
  return `$${Number(n).toFixed(2)}`;
}

// Returns today's date as a YYYY-MM-DD string for use in date inputs.
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// Returns how many whole days have passed since a given date string, or null if the date is empty/invalid.
function daysSince(dateStr: string): number | null {
  if (!dateStr) return null;
  const ts = new Date(dateStr).getTime();
  if (isNaN(ts)) return null;
  return Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24));
}

// Adds a number of days to a YYYY-MM-DD date string and returns the resulting date string.
function addDays(dateStr: string, days: number): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Stages

const STAGES = [
  { key: 'inspection',       label: 'Item Inspection',   color: 'blue'   },
  { key: 'ebay_filed',       label: 'eBay Filed',        color: 'amber'  },
  { key: 'pending_approval', label: 'Pending Approval',  color: 'purple' },
  { key: 'packing',          label: 'Packing & Ship',    color: 'teal'   },
  { key: 'refund_received',  label: 'Refund Received',   color: 'green'  },
] as const;

// Active stages shown in kanban/table (completed returns go to history).
const ACTIVE_STAGES = STAGES.slice(0, 4);

type StageKey = typeof STAGES[number]['key'];

// Returns the 0-based index of a stage key in STAGES, defaulting to 0 if not found.
function stageIndex(s: string): number {
  const i = STAGES.findIndex(x => x.key === s);
  return i < 0 ? 0 : i;
}

// Returns the key of the next stage after the given one, or stays at the last stage if already there.
function nextStage(s: string): StageKey {
  const i = stageIndex(s);
  return STAGES[Math.min(i + 1, STAGES.length - 1)].key;
}

// State

let returnsData: EbayReturn[] = [];
let statsData: ReturnStats = { total_open: 0, pending_approval: 0, urgent: 0, total_refunded: 0 };
let viewMode: 'kanban' | 'table' = 'kanban';
let container: HTMLElement;
let historyExpanded = false;

// Modal state
let modalReturnId: number | null = null;
let modalStep: number = 1; // 1..5
let detailReturn: EbayReturn | null = null;

// Mount

// Entry point — sets the container element, does an initial render, then kicks off the API load.
export function mountReturns(el: HTMLElement): void {
  container = el;
  render();
  loadAll();
}

// Fetches the returns list and stats from the API in parallel, updates module state, and re-renders.
async function loadAll() {
  try {
    const [list, stats] = await Promise.all([
      fetch('/api/returns').then(r => r.json()),
      fetch('/api/returns/stats').then(r => r.json()),
    ]);
    returnsData = list as EbayReturn[];
    statsData = stats as ReturnStats;
    render();
  } catch (e) {
    console.error('Failed to load returns', e);
  }
}

// Render

// Builds the full page shell (header, stats row, view toggle, body/history/modal slots) then calls the active view renderer.
function render() {
  container.innerHTML = `
    <div class="returns-page">
      <div class="returns-header">
        <div>
          <h2 style="font-size:1.2rem;font-weight:700">eBay Returns</h2>
          <div style="font-size:0.8rem;color:var(--text-secondary)">Track returns from inspection to refund</div>
        </div>
        <div style="display:flex;gap:10px;align-items:center">
          <div class="view-toggle">
            <button class="view-btn ${viewMode === 'kanban' ? 'active' : ''}" data-rview="kanban">Kanban</button>
            <button class="view-btn ${viewMode === 'table' ? 'active' : ''}" data-rview="table">Table</button>
          </div>
          <button class="btn btn-primary" id="rtn-new">+ New Return</button>
        </div>
      </div>

      <div class="stats-row">
        <div class="stat-card stat-blue">
          <div class="stat-label">Total Open</div>
          <div class="stat-value">${statsData.total_open}</div>
        </div>
        <div class="stat-card stat-purple">
          <div class="stat-label">Pending Approval</div>
          <div class="stat-value">${statsData.pending_approval}</div>
        </div>
        <div class="stat-card stat-red">
          <div class="stat-label">Urgent (25+ days)</div>
          <div class="stat-value">${statsData.urgent}</div>
        </div>
        <div class="stat-card stat-green">
          <div class="stat-label">Total Refunded</div>
          <div class="stat-value">${fmt$(statsData.total_refunded)}</div>
        </div>
      </div>

      <div id="rtn-body"></div>
      <div id="rtn-history"></div>
      <div id="rtn-modal-root"></div>
    </div>
  `;

  if (viewMode === 'kanban') renderKanban();
  else renderTable();

  renderHistory();

  container.querySelectorAll<HTMLButtonElement>('.view-btn[data-rview]').forEach(btn => {
    btn.addEventListener('click', () => {
      viewMode = btn.dataset.rview as 'kanban' | 'table';
      render();
    });
  });

  container.querySelector<HTMLButtonElement>('#rtn-new')!
    .addEventListener('click', () => openNewModal());
}

// Renders the 4 active stages as kanban columns; each card is clickable to open the detail modal.
function renderKanban() {
  const body = container.querySelector<HTMLDivElement>('#rtn-body')!;
  const cols = ACTIVE_STAGES.map(stage => {
    const items = returnsData.filter(r => r.status === stage.key);
    return `
      <div class="kanban-col">
        <div class="kanban-col-head stage-${stage.color}">
          <span>${esc(stage.label)}</span>
          <span class="kanban-count">${items.length}</span>
        </div>
        <div class="kanban-col-body">
          ${items.map(returnCardHTML).join('') || '<div class="kanban-empty">No returns</div>'}
        </div>
      </div>
    `;
  }).join('');
  body.innerHTML = `<div class="kanban">${cols}</div>`;

  body.querySelectorAll<HTMLElement>('.return-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = Number(card.dataset.id);
      const r = returnsData.find(x => x.id === id);
      if (r) openDetailModal(r);
    });
  });
}

// Returns the HTML string for a single kanban card, including an urgent indicator and return reason tag.
function returnCardHTML(r: EbayReturn): string {
  const days = daysSince(r.date_return_open);
  const isUrgent = r.status !== 'refund_received' && r.date_return_open && days != null && days >= 25;
  const reason = (r.return_reason || '').toLowerCase();
  const reasonTag = reason
    ? `<span class="reason-tag reason-${reason}">${esc(r.return_reason)}</span>`
    : '';
  return `
    <div class="return-card ${isUrgent ? 'urgent' : ''}" data-id="${r.id}">
      <div class="rc-row1">
        <span class="rc-order">${esc(r.ebay_order_id)}</span>
        ${isUrgent ? '<span class="urgent-dot" title="Urgent"></span>' : ''}
      </div>
      <div class="rc-name">${esc(r.item_name || 'Unnamed item')}</div>
      <div class="rc-row2">
        ${reasonTag}
        ${days != null ? `<span class="rc-days">${days}d open</span>` : ''}
      </div>
    </div>
  `;
}

// Renders active (non-completed) returns as a table with status badges and progress bars; rows are clickable.
function renderTable() {
  const body = container.querySelector<HTMLDivElement>('#rtn-body')!;
  const activeReturns = returnsData.filter(r => r.status !== 'refund_received');
  if (activeReturns.length === 0) {
    body.innerHTML = `<div class="empty-state"><p>No open returns. Click "New Return" to start.</p></div>`;
    return;
  }
  const rows = activeReturns.map(r => {
    const idx = stageIndex(r.status);
    const pct = Math.round((idx / (STAGES.length - 1)) * 100);
    const stage = STAGES[idx];
    return `
      <tr data-id="${r.id}">
        <td class="td-sn">${esc(r.ebay_order_id)}</td>
        <td><strong>${esc(r.item_name || '—')}</strong></td>
        <td>${r.return_reason ? `<span class="reason-tag reason-${r.return_reason.toLowerCase()}">${esc(r.return_reason)}</span>` : '<span class="td-muted">—</span>'}</td>
        <td><span class="status-badge stage-${stage.color}">${esc(stage.label)}</span></td>
        <td class="td-muted">${esc(r.date_return_open) || '—'}</td>
        <td class="td-muted">${esc(r.ebay_followup_date) || '—'}</td>
        <td>
          <div class="progress-bar"><div class="progress-fill stage-${stage.color}" style="width:${pct}%"></div></div>
        </td>
        <td><button class="btn btn-ghost btn-sm rtn-edit" data-id="${r.id}">Edit</button></td>
      </tr>
    `;
  }).join('');

  body.innerHTML = `
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
    </div>
  `;

  body.querySelectorAll<HTMLElement>('tr[data-id]').forEach(tr => {
    tr.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('button')) return;
      const id = Number(tr.dataset.id);
      const r = returnsData.find(x => x.id === id);
      if (r) openDetailModal(r);
    });
  });
  body.querySelectorAll<HTMLButtonElement>('.rtn-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = Number(btn.dataset.id);
      const r = returnsData.find(x => x.id === id);
      if (r) openDetailModal(r);
    });
  });
}

// Renders a collapsible "Return History" section below the main view showing all refund_received returns.
function renderHistory() {
  const histEl = container.querySelector<HTMLDivElement>('#rtn-history')!;
  const completed = returnsData.filter(r => r.status === 'refund_received');

  if (completed.length === 0) {
    histEl.innerHTML = '';
    return;
  }

  const rows = completed.map(r => `
    <tr data-id="${r.id}" style="cursor:pointer">
      <td class="td-sn">${esc(r.ebay_order_id)}</td>
      <td><strong>${esc(r.item_name || '—')}</strong></td>
      <td>${r.return_reason ? `<span class="reason-tag reason-${r.return_reason.toLowerCase()}">${esc(r.return_reason)}</span>` : '<span class="td-muted">—</span>'}</td>
      <td class="td-muted">${esc(r.date_refund_received) || '—'}</td>
      <td class="td-muted"><strong>${fmt$(r.amount_refund_received)}</strong></td>
      <td><button class="btn btn-ghost btn-sm hist-edit" data-id="${r.id}">View</button></td>
    </tr>
  `).join('');

  histEl.innerHTML = `
    <div class="section" style="margin-top:16px">
      <div class="inv-group-head" id="rtn-hist-toggle" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);user-select:none">
        <span style="font-weight:600;font-size:0.9rem">Return History (${completed.length} completed)</span>
        <span style="color:var(--text-muted);font-size:0.85rem">${historyExpanded ? '▲ Hide' : '▼ Show'}</span>
      </div>
      <div id="rtn-hist-body" style="${historyExpanded ? '' : 'display:none'}">
        <div class="inv-group-body">
          <table class="inv-table">
            <thead><tr>
              <th>Order ID</th><th>Item</th><th>Reason</th><th>Date Refunded</th><th>Amount</th><th></th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  histEl.querySelector<HTMLElement>('#rtn-hist-toggle')!.addEventListener('click', () => {
    historyExpanded = !historyExpanded;
    renderHistory();
  });

  histEl.querySelectorAll<HTMLElement>('tr[data-id], .hist-edit').forEach(el => {
    el.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).tagName === 'TR' && (e.target as HTMLElement).closest('button')) return;
      const id = Number((el as HTMLElement).dataset.id ?? (el as HTMLElement).closest('tr')?.dataset.id);
      const r = returnsData.find(x => x.id === id);
      if (r) openDetailModal(r);
    });
  });
}

// New Return Modal (multi-step)

// Resets modal state to step 1 and opens the new-return wizard.
function openNewModal() {
  modalReturnId = null;
  modalStep = 1;
  renderNewModal();
}

// Clears modal state and removes the modal from the DOM.
function closeModal() {
  modalReturnId = null;
  detailReturn = null;
  container.querySelector<HTMLDivElement>('#rtn-modal-root')!.innerHTML = '';
}

// Returns the HTML for the step progress indicator shown at the top of the new-return wizard.
function stepIndicatorHTML(currentStep: number): string {
  return `
    <div class="step-indicator">
      ${STAGES.map((s, i) => {
        const n = i + 1;
        const cls = n < currentStep ? 'done' : n === currentStep ? 'active' : '';
        return `
          <div class="step-item">
            <div class="step-dot ${cls}">${n}</div>
            <div class="step-label">${esc(s.label)}</div>
          </div>
          ${i < STAGES.length - 1 ? '<div class="step-bar"></div>' : ''}
        `;
      }).join('')}
    </div>
  `;
}

// Renders the modal shell (header, step indicator, body slot) and delegates to renderStepBody for the form content.
function renderNewModal() {
  const root = container.querySelector<HTMLDivElement>('#rtn-modal-root')!;
  root.innerHTML = `
    <div class="rtn-modal-overlay">
      <div class="rtn-modal">
        <div class="rtn-modal-header">
          <h3>New Return — Step ${modalStep} of 5</h3>
          <button class="modal-close" id="rtn-close">&#10005;</button>
        </div>
        ${stepIndicatorHTML(modalStep)}
        <div class="rtn-modal-body" id="rtn-step-body"></div>
      </div>
    </div>
  `;
  root.querySelector<HTMLButtonElement>('#rtn-close')!.addEventListener('click', closeModal);
  renderStepBody();
}

// Injects the correct step form into the modal body based on the current modalStep value.
function renderStepBody() {
  const body = container.querySelector<HTMLDivElement>('#rtn-step-body')!;
  const current = modalReturnId ? returnsData.find(r => r.id === modalReturnId) : null;

  if (modalStep === 1) {
    body.innerHTML = stepOneHTML(current);
    wireStepOne();
  } else if (modalStep === 2) {
    body.innerHTML = stepTwoHTML(current);
    wireStepTwo();
  } else if (modalStep === 3) {
    body.innerHTML = stepThreeHTML(current);
    wireStepThree();
  } else if (modalStep === 4) {
    body.innerHTML = stepFourHTML(current);
    wireStepFour();
  } else if (modalStep === 5) {
    body.innerHTML = stepFiveHTML(current);
    wireStepFive();
  }
}

// Returns the HTML for step 1: item info fields, condition checkboxes, and return reason.
function stepOneHTML(r: EbayReturn | null | undefined): string {
  return `
    <div class="rtn-form-section">
      <div class="form-grid">
        <div class="form-field span-2">
          <label>eBay Order ID *</label>
          <div style="display:flex;gap:8px">
            <input type="text" id="f-ebay-order" value="${esc(r?.ebay_order_id ?? '')}" placeholder="112-XXXXX-XXXXXX" />
            <button type="button" class="btn btn-ghost" id="f-lookup">Look Up</button>
          </div>
          <div id="f-lookup-msg" style="font-size:0.75rem;color:var(--text-muted);margin-top:4px"></div>
        </div>
        <div class="form-field span-2">
          <label>Item Name</label>
          <input type="text" id="f-item-name" value="${esc(r?.item_name ?? '')}" />
        </div>
        <div class="form-field">
          <label>Quantity</label>
          <input type="number" id="f-qty" value="${r?.quantity ?? ''}" />
        </div>
        <div class="form-field">
          <label>Total Cost ($)</label>
          <input type="number" step="0.01" id="f-cost" value="${r?.total_cost ?? ''}" />
        </div>
        <div class="form-field">
          <label>Date Received</label>
          <input type="date" id="f-date-received" value="${esc(r?.date_received || todayISO())}" />
        </div>
        <div class="form-field">
          <label>Serial Number</label>
          <input type="text" id="f-serial" value="${esc(r?.serial_number ?? '')}" />
        </div>
        <div class="form-field span-2">
          <label>Logged By</label>
          <input type="text" id="f-logged-by" value="${esc(r?.logged_by ?? '')}" />
        </div>
      </div>
    </div>

    <div class="rtn-form-section">
      <div class="rtn-section-title">Condition Inspection</div>
      <div class="checkbox-grid">
        <label class="cb"><input type="checkbox" id="f-wms-func" ${r?.wms_functional ? 'checked' : ''}> WMS Functional</label>
        <label class="cb"><input type="checkbox" id="f-wms-case" ${r?.wms_case_good ? 'checked' : ''}> WMS Case Good</label>
        <label class="cb"><input type="checkbox" id="f-cd-func" ${r?.cd_changer_functional ? 'checked' : ''}> 3CD Changer Functional</label>
        <label class="cb"><input type="checkbox" id="f-cd-case" ${r?.cd_changer_case_good ? 'checked' : ''}> 3CD Changer Case Good</label>
      </div>
    </div>

    <div class="rtn-form-section">
      <div class="form-grid">
        <div class="form-field">
          <label>Return Reason</label>
          <select id="f-reason">
            <option value="">— Select —</option>
            <option value="Damaged" ${r?.return_reason === 'Damaged' ? 'selected' : ''}>Damaged</option>
            <option value="Defective" ${r?.return_reason === 'Defective' ? 'selected' : ''}>Defective</option>
          </select>
        </div>
        <div class="form-field span-2">
          <label>Inspection Notes <span class="opt">(Optional)</span></label>
          <textarea id="f-inspection-notes" rows="3">${esc(r?.inspection_notes ?? '')}</textarea>
        </div>
      </div>
    </div>

    <div id="rtn-step-msg"></div>

    <div class="rtn-modal-footer">
      <button class="btn btn-ghost" id="rtn-skip">Skip for now</button>
      <button class="btn btn-primary" id="rtn-next">Start Return →</button>
    </div>
  `;
}

// Attaches event listeners for step 1: inventory lookup button, skip (close modal), and next (submit).
function wireStepOne() {
  container.querySelector<HTMLButtonElement>('#f-lookup')!
    .addEventListener('click', doLookup);
  container.querySelector<HTMLButtonElement>('#rtn-skip')!
    .addEventListener('click', closeModal);
  container.querySelector<HTMLButtonElement>('#rtn-next')!
    .addEventListener('click', submitStepOne);
}

// Calls the inventory lookup API with the entered eBay order ID and auto-fills matching fields if found.
async function doLookup() {
  const eb = (container.querySelector<HTMLInputElement>('#f-ebay-order')!.value || '').trim();
  const msg = container.querySelector<HTMLDivElement>('#f-lookup-msg')!;
  if (!eb) { msg.textContent = 'Enter eBay Order ID first.'; return; }
  msg.textContent = 'Looking up...';
  try {
    const res = await fetch(`/api/inventory/lookup?ebay_order_id=${encodeURIComponent(eb)}`);
    if (!res.ok) {
      msg.textContent = 'No matching inventory found.';
      return;
    }
    const inv = await res.json();
    const set = (id: string, val: string | number | null | undefined) => {
      const el = container.querySelector<HTMLInputElement>(id);
      if (el && val != null) el.value = String(val);
    };
    set('#f-item-name', inv.NAME);
    set('#f-qty', inv.QTYRECEIVED ?? inv.QTYORDERED);
    set('#f-cost', inv.TOTALCOST);
    set('#f-date-received', inv.DATE);
    set('#f-serial', inv.SERIALNUMBER);
    set('#f-logged-by', inv.LOGGEDBY);
    msg.textContent = 'Auto-filled from inventory.';
  } catch {
    msg.textContent = 'Lookup failed.';
  }
}

// Reads all step 1 form values into a plain object for submission.
function readStepOne() {
  const v = (id: string) => container.querySelector<HTMLInputElement>(id)!.value.trim();
  const cb = (id: string) => container.querySelector<HTMLInputElement>(id)!.checked ? 1 : 0;
  const ta = (id: string) => container.querySelector<HTMLTextAreaElement>(id)!.value.trim();
  const sel = (id: string) => container.querySelector<HTMLSelectElement>(id)!.value;
  return {
    ebay_order_id: v('#f-ebay-order'),
    item_name: v('#f-item-name'),
    quantity: parseInt(v('#f-qty')) || 0,
    total_cost: parseFloat(v('#f-cost')) || 0,
    date_received: v('#f-date-received'),
    serial_number: v('#f-serial'),
    logged_by: v('#f-logged-by'),
    wms_functional: cb('#f-wms-func'),
    wms_case_good: cb('#f-wms-case'),
    cd_changer_functional: cb('#f-cd-func'),
    cd_changer_case_good: cb('#f-cd-case'),
    return_reason: sel('#f-reason'),
    inspection_notes: ta('#f-inspection-notes'),
  };
}

// Validates step 1, POSTs a new return (or PATCHes if one already exists), then advances the wizard to step 2.
async function submitStepOne() {
  const data = readStepOne();
  const msg = container.querySelector<HTMLDivElement>('#rtn-step-msg')!;
  if (!data.ebay_order_id) {
    msg.innerHTML = '<div class="msg msg-error">eBay Order ID is required.</div>';
    return;
  }
  try {
    let item: EbayReturn;
    if (modalReturnId) {
      const res = await fetch(`/api/returns/${modalReturnId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, status: 'ebay_filed' }),
      });
      const j = await res.json();
      item = j.item;
    } else {
      const res = await fetch('/api/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, status: 'ebay_filed' }),
      });
      if (!res.ok) {
        const err = await res.json();
        msg.innerHTML = `<div class="msg msg-error">${esc(err.detail ?? 'Failed.')}</div>`;
        return;
      }
      const j = await res.json();
      item = j.item;
      modalReturnId = j.id;
    }
    await loadAll();
    if (item) returnsData = returnsData.map(r => r.id === item.id ? item : r);
    modalStep = 2;
    renderNewModal();
  } catch {
    msg.innerHTML = '<div class="msg msg-error">Network error.</div>';
  }
}

// Returns the HTML for step 2: return open date, follow-up date, label received checkbox, and eBay notes.
function stepTwoHTML(r: EbayReturn | null | undefined): string {
  const dateOpen = r?.date_return_open || todayISO();
  const followup = r?.ebay_followup_date || addDays(dateOpen, 30);
  const labelRcvd = r?.return_label_received ? true : false;
  return `
    <div class="rtn-form-section">
      <div class="form-grid">
        <div class="form-field">
          <label>Date Return Opened</label>
          <input type="date" id="f-date-open" value="${esc(dateOpen)}" />
        </div>
        <div class="form-field">
          <label>Return Opened By</label>
          <input type="text" id="f-return-by" value="${esc(r?.return_open_by ?? '')}" />
        </div>
        <div class="form-field">
          <label>eBay Follow-up Date</label>
          <input type="date" id="f-followup" value="${esc(followup)}" />
        </div>
        <div class="form-field span-2">
          <label class="cb"><input type="checkbox" id="f-label-rcvd" ${labelRcvd ? 'checked' : ''}> Return Label Received</label>
        </div>
        <div class="form-field" id="f-label-date-wrap" style="${labelRcvd ? '' : 'display:none'}">
          <label>Date Label Received</label>
          <input type="date" id="f-label-date" value="${esc(r?.date_label_received ?? '')}" />
        </div>
        <div class="form-field span-2">
          <label>eBay Notes <span class="opt">(Optional)</span></label>
          <textarea id="f-ebay-notes" rows="3">${esc(r?.ebay_notes ?? '')}</textarea>
        </div>
      </div>
    </div>
    <div id="rtn-step-msg"></div>
    <div class="rtn-modal-footer">
      <button class="btn btn-ghost" id="rtn-skip">Skip for now</button>
      <button class="btn btn-primary" id="rtn-next">Save & Continue →</button>
    </div>
  `;
}

// Attaches listeners for step 2: date-open change auto-updates follow-up, label checkbox shows/hides date field, next saves and advances.
function wireStepTwo() {
  const dateOpen = container.querySelector<HTMLInputElement>('#f-date-open')!;
  dateOpen.addEventListener('change', () => {
    container.querySelector<HTMLInputElement>('#f-followup')!.value = addDays(dateOpen.value, 30);
  });
  const labelCb = container.querySelector<HTMLInputElement>('#f-label-rcvd')!;
  labelCb.addEventListener('change', () => {
    const wrap = container.querySelector<HTMLDivElement>('#f-label-date-wrap')!;
    wrap.style.display = labelCb.checked ? '' : 'none';
  });
  container.querySelector<HTMLButtonElement>('#rtn-skip')!.addEventListener('click', closeModal);
  container.querySelector<HTMLButtonElement>('#rtn-next')!.addEventListener('click', async () => {
    await patchAdvance({
      date_return_open: dateOpen.value,
      return_open_by: container.querySelector<HTMLInputElement>('#f-return-by')!.value.trim(),
      ebay_followup_date: container.querySelector<HTMLInputElement>('#f-followup')!.value,
      return_label_received: labelCb.checked ? 1 : 0,
      date_label_received: container.querySelector<HTMLInputElement>('#f-label-date')?.value ?? '',
      ebay_notes: container.querySelector<HTMLTextAreaElement>('#f-ebay-notes')!.value.trim(),
    }, 'pending_approval');
  });
}

// Returns the HTML for step 3 (Michael's approval): partial refund toggle, date contacted seller, approval date, and notes.
function stepThreeHTML(r: EbayReturn | null | undefined): string {
  const accepted = r?.partial_refund_accepted ? true : false;
  return `
    <div class="rtn-form-section">
      <div class="form-grid">
        <div class="form-field span-2">
          <label class="cb"><input type="checkbox" id="f-partial" ${accepted ? 'checked' : ''}> Partial Refund Accepted</label>
        </div>
        <div class="form-field" id="f-partial-amt-wrap" style="${accepted ? '' : 'display:none'}">
          <label>Partial Refund Amount ($)</label>
          <input type="number" step="0.01" id="f-partial-amt" value="${r?.partial_refund_amount ?? ''}" />
        </div>
        <div class="form-field">
          <label>Date Contacted Seller</label>
          <input type="date" id="f-date-contacted" value="${esc(r?.date_contacted_seller ?? '')}" />
        </div>
        <div class="form-field">
          <label>Michael Approval Date</label>
          <input type="date" id="f-approval-date" value="${esc(r?.michael_approval_date ?? '')}" />
        </div>
        <div class="form-field span-2">
          <label>Approval Notes <span class="opt">(Optional)</span></label>
          <textarea id="f-approval-notes" rows="3">${esc(r?.approval_notes ?? '')}</textarea>
        </div>
      </div>
      <button class="btn btn-success" id="f-approve-btn" style="margin-top:10px">✓ Approve (set today)</button>
    </div>
    <div id="rtn-step-msg"></div>
    <div class="rtn-modal-footer">
      <button class="btn btn-ghost" id="rtn-skip">Skip for now</button>
      <button class="btn btn-primary" id="rtn-next">Save & Continue →</button>
    </div>
  `;
}

// Attaches listeners for step 3: partial refund checkbox shows/hides amount field, approve button sets today's date, next saves and advances.
function wireStepThree() {
  const partial = container.querySelector<HTMLInputElement>('#f-partial')!;
  partial.addEventListener('change', () => {
    container.querySelector<HTMLDivElement>('#f-partial-amt-wrap')!.style.display = partial.checked ? '' : 'none';
  });
  container.querySelector<HTMLButtonElement>('#f-approve-btn')!.addEventListener('click', () => {
    container.querySelector<HTMLInputElement>('#f-approval-date')!.value = todayISO();
  });
  container.querySelector<HTMLButtonElement>('#rtn-skip')!.addEventListener('click', closeModal);
  container.querySelector<HTMLButtonElement>('#rtn-next')!.addEventListener('click', async () => {
    await patchAdvance({
      partial_refund_accepted: partial.checked ? 1 : 0,
      partial_refund_amount: parseFloat(container.querySelector<HTMLInputElement>('#f-partial-amt')?.value || '0') || 0,
      date_contacted_seller: container.querySelector<HTMLInputElement>('#f-date-contacted')!.value,
      michael_approval_date: container.querySelector<HTMLInputElement>('#f-approval-date')!.value,
      approval_notes: container.querySelector<HTMLTextAreaElement>('#f-approval-notes')!.value.trim(),
    }, 'packing');
  });
}

// Returns the HTML for step 4 (packing & ship): packed by, date returned, tracking number, and notes.
function stepFourHTML(r: EbayReturn | null | undefined): string {
  return `
    <div class="rtn-form-section">
      <div class="form-grid">
        <div class="form-field">
          <label>Return Packed By</label>
          <input type="text" id="f-packed-by" value="${esc(r?.rtn_packed_by ?? '')}" />
        </div>
        <div class="form-field">
          <label>Date Package Returned</label>
          <input type="date" id="f-date-returned" value="${esc(r?.date_package_returned ?? '')}" />
        </div>
        <div class="form-field span-2">
          <label>Return Tracking</label>
          <input type="text" id="f-tracking" value="${esc(r?.return_tracking ?? '')}" />
        </div>
        <div class="form-field span-2">
          <label>Packing Notes <span class="opt">(Optional)</span></label>
          <textarea id="f-packing-notes" rows="3">${esc(r?.packing_notes ?? '')}</textarea>
        </div>
      </div>
    </div>
    <div id="rtn-step-msg"></div>
    <div class="rtn-modal-footer">
      <button class="btn btn-ghost" id="rtn-skip">Skip for now</button>
      <button class="btn btn-primary" id="rtn-next">Save & Continue →</button>
    </div>
  `;
}

// Attaches listeners for step 4: next saves packing fields and advances to refund_received.
function wireStepFour() {
  container.querySelector<HTMLButtonElement>('#rtn-skip')!.addEventListener('click', closeModal);
  container.querySelector<HTMLButtonElement>('#rtn-next')!.addEventListener('click', async () => {
    await patchAdvance({
      rtn_packed_by: container.querySelector<HTMLInputElement>('#f-packed-by')!.value.trim(),
      date_package_returned: container.querySelector<HTMLInputElement>('#f-date-returned')!.value,
      return_tracking: container.querySelector<HTMLInputElement>('#f-tracking')!.value.trim(),
      packing_notes: container.querySelector<HTMLTextAreaElement>('#f-packing-notes')!.value.trim(),
    }, 'refund_received');
  });
}

// Returns the HTML for step 5 (refund received): refund amount, date, and notes.
function stepFiveHTML(r: EbayReturn | null | undefined): string {
  return `
    <div class="rtn-form-section">
      <div class="form-grid">
        <div class="form-field">
          <label>Amount Refund Received ($)</label>
          <input type="number" step="0.01" id="f-refund-amt" value="${r?.amount_refund_received ?? ''}" />
        </div>
        <div class="form-field">
          <label>Date Refund Received</label>
          <input type="date" id="f-refund-date" value="${esc(r?.date_refund_received ?? todayISO())}" />
        </div>
        <div class="form-field span-2">
          <label>Refund Notes <span class="opt">(Optional)</span></label>
          <textarea id="f-refund-notes" rows="3">${esc(r?.refund_notes ?? '')}</textarea>
        </div>
      </div>
    </div>
    <div id="rtn-step-msg"></div>
    <div class="rtn-modal-footer">
      <button class="btn btn-ghost" id="rtn-skip">Skip for now</button>
      <button class="btn btn-success" id="rtn-next">✓ Complete Return</button>
    </div>
  `;
}

// Attaches listeners for step 5: next saves refund fields and marks the return fully complete.
function wireStepFive() {
  container.querySelector<HTMLButtonElement>('#rtn-skip')!.addEventListener('click', closeModal);
  container.querySelector<HTMLButtonElement>('#rtn-next')!.addEventListener('click', async () => {
    await patchFinal({
      amount_refund_received: parseFloat(container.querySelector<HTMLInputElement>('#f-refund-amt')!.value) || 0,
      date_refund_received: container.querySelector<HTMLInputElement>('#f-refund-date')!.value,
      refund_notes: container.querySelector<HTMLTextAreaElement>('#f-refund-notes')!.value.trim(),
    });
  });
}

// PATCH helpers

// PATCHes the active return with the given fields and new status, then advances to the next wizard step.
async function patchAdvance(fields: Record<string, unknown>, newStatus: StageKey) {
  if (!modalReturnId) return;
  const msg = container.querySelector<HTMLDivElement>('#rtn-step-msg')!;
  try {
    const res = await fetch(`/api/returns/${modalReturnId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...fields, status: newStatus }),
    });
    if (!res.ok) {
      msg.innerHTML = '<div class="msg msg-error">Failed to save.</div>';
      return;
    }
    await loadAll();
    modalStep += 1;
    renderNewModal();
  } catch {
    msg.innerHTML = '<div class="msg msg-error">Network error.</div>';
  }
}

// PATCHes the active return with refund fields and status=refund_received, then closes the modal.
async function patchFinal(fields: Record<string, unknown>) {
  if (!modalReturnId) return;
  const msg = container.querySelector<HTMLDivElement>('#rtn-step-msg')!;
  try {
    const res = await fetch(`/api/returns/${modalReturnId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...fields, status: 'refund_received' }),
    });
    if (!res.ok) {
      msg.innerHTML = '<div class="msg msg-error">Failed to save.</div>';
      return;
    }
    await loadAll();
    closeModal();
  } catch {
    msg.innerHTML = '<div class="msg msg-error">Network error.</div>';
  }
}

// Detail/Edit Modal

// Sets detailReturn to the given record and opens the detail/edit modal.
function openDetailModal(r: EbayReturn) {
  detailReturn = r;
  renderDetailModal();
}

// Renders the full detail modal with all 5 collapsible stages, save/advance/delete buttons, and wires all listeners.
function renderDetailModal() {
  if (!detailReturn) return;
  const r = detailReturn;
  const root = container.querySelector<HTMLDivElement>('#rtn-modal-root')!;
  const currentIdx = stageIndex(r.status);
  const stage = STAGES[currentIdx];
  const isComplete = r.status === 'refund_received';

  root.innerHTML = `
    <div class="rtn-modal-overlay">
      <div class="rtn-modal rtn-modal-wide">
        <div class="rtn-modal-header">
          <div>
            <h3>Return #${r.id} — ${esc(r.ebay_order_id)}</h3>
            <div style="font-size:0.78rem;color:var(--text-secondary);margin-top:2px">
              <span class="status-badge stage-${stage.color}">${esc(stage.label)}</span>
              <span style="margin-left:8px">${esc(r.item_name || 'Unnamed')}</span>
            </div>
          </div>
          <button class="modal-close" id="rtn-close">&#10005;</button>
        </div>
        <div class="rtn-modal-body">
          ${detailStageHTML(1, 'Item Inspection', detailStage1HTML(r))}
          ${detailStageHTML(2, 'eBay Filed', detailStage2HTML(r))}
          ${detailStageHTML(3, 'Pending Approval', detailStage3HTML(r))}
          ${detailStageHTML(4, 'Packing & Ship', detailStage4HTML(r))}
          ${detailStageHTML(5, 'Refund Received', detailStage5HTML(r))}
          <div id="rtn-detail-msg"></div>
        </div>
        <div class="rtn-modal-footer detail-footer">
          <button class="btn btn-danger" id="d-delete">Delete Return</button>
          <div style="flex:1"></div>
          <button class="btn btn-ghost" id="d-cancel">Close</button>
          <button class="btn btn-ghost" id="d-save-only">Save Only</button>
          ${isComplete
            ? `<button class="btn btn-primary" id="d-save">Save</button>`
            : `<button class="btn btn-primary" id="d-save">Save &amp; Advance Stage →</button>`
          }
        </div>
      </div>
    </div>
  `;

  root.querySelector<HTMLButtonElement>('#rtn-close')!.addEventListener('click', closeModal);
  root.querySelector<HTMLButtonElement>('#d-cancel')!.addEventListener('click', closeModal);
  root.querySelector<HTMLButtonElement>('#d-save-only')!.addEventListener('click', () => saveDetail(false));
  root.querySelector<HTMLButtonElement>('#d-save')!.addEventListener('click', () => saveDetail(!isComplete));
  root.querySelector<HTMLButtonElement>('#d-delete')!.addEventListener('click', deleteDetail);

  // Wire label received checkbox to show/hide date field in stage 2.
  const labelCb = root.querySelector<HTMLInputElement>('[data-kb="return_label_received"]');
  const labelWrap = root.querySelector<HTMLDivElement>('#d-label-date-wrap');
  if (labelCb && labelWrap) {
    labelCb.addEventListener('change', () => {
      labelWrap.style.display = labelCb.checked ? '' : 'none';
    });
  }

  root.querySelectorAll<HTMLElement>('.detail-stage-head').forEach(h => {
    h.addEventListener('click', () => {
      const sec = h.parentElement!;
      sec.classList.toggle('collapsed');
    });
  });
}

// Wraps a stage's inner HTML in a collapsible container; auto-collapses all stages except the current one.
function detailStageHTML(n: number, label: string, inner: string): string {
  const collapsed = detailReturn && stageIndex(detailReturn.status) !== (n - 1) ? 'collapsed' : '';
  return `
    <div class="detail-stage ${collapsed}">
      <div class="detail-stage-head">
        <span>Stage ${n}: ${esc(label)}</span>
        <span class="toggle-arrow">▼</span>
      </div>
      <div class="detail-stage-body">
        ${inner}
      </div>
    </div>
  `;
}

// Returns the edit fields for stage 1 (item info, condition checkboxes, return reason) using data-k/data-kb attributes.
function detailStage1HTML(r: EbayReturn): string {
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
          <label class="cb"><input type="checkbox" data-kb="wms_functional" ${r.wms_functional?'checked':''}> WMS Functional</label>
          <label class="cb"><input type="checkbox" data-kb="wms_case_good" ${r.wms_case_good?'checked':''}> WMS Case Good</label>
          <label class="cb"><input type="checkbox" data-kb="cd_changer_functional" ${r.cd_changer_functional?'checked':''}> 3CD Functional</label>
          <label class="cb"><input type="checkbox" data-kb="cd_changer_case_good" ${r.cd_changer_case_good?'checked':''}> 3CD Case Good</label>
        </div>
      </div>
      <div class="form-field">
        <label>Return Reason</label>
        <select data-k="return_reason">
          <option value="">—</option>
          <option value="Damaged" ${r.return_reason==='Damaged'?'selected':''}>Damaged</option>
          <option value="Defective" ${r.return_reason==='Defective'?'selected':''}>Defective</option>
        </select>
      </div>
      <div class="form-field span-2"><label>Inspection Notes <span class="opt">(Optional)</span></label><textarea data-k="inspection_notes" rows="2">${esc(r.inspection_notes)}</textarea></div>
    </div>
  `;
}

// Returns the edit fields for stage 2 (eBay filing: open date, follow-up, label received, notes).
function detailStage2HTML(r: EbayReturn): string {
  const labelRcvd = r.return_label_received ? true : false;
  return `
    <div class="form-grid">
      <div class="form-field"><label>Date Return Open</label><input type="date" data-k="date_return_open" value="${esc(r.date_return_open)}"/></div>
      <div class="form-field"><label>Return Open By</label><input type="text" data-k="return_open_by" value="${esc(r.return_open_by)}"/></div>
      <div class="form-field"><label>eBay Follow-up</label><input type="date" data-k="ebay_followup_date" value="${esc(r.ebay_followup_date)}"/></div>
      <div class="form-field span-2"><label class="cb"><input type="checkbox" data-kb="return_label_received" ${labelRcvd?'checked':''}> Return Label Received</label></div>
      <div class="form-field" id="d-label-date-wrap" style="${labelRcvd ? '' : 'display:none'}"><label>Date Label Received</label><input type="date" data-k="date_label_received" value="${esc(r.date_label_received)}"/></div>
      <div class="form-field span-2"><label>eBay Notes <span class="opt">(Optional)</span></label><textarea data-k="ebay_notes" rows="2">${esc(r.ebay_notes)}</textarea></div>
    </div>
  `;
}

// Returns the edit fields for stage 3 (Michael's approval: partial refund, date contacted, approval date, notes).
function detailStage3HTML(r: EbayReturn): string {
  return `
    <div class="form-grid">
      <div class="form-field span-2"><label class="cb"><input type="checkbox" data-kb="partial_refund_accepted" ${r.partial_refund_accepted?'checked':''}> Partial Refund Accepted</label></div>
      <div class="form-field"><label>Partial Refund Amount</label><input type="number" step="0.01" data-k="partial_refund_amount" value="${r.partial_refund_amount}"/></div>
      <div class="form-field"><label>Date Contacted Seller</label><input type="date" data-k="date_contacted_seller" value="${esc(r.date_contacted_seller)}"/></div>
      <div class="form-field"><label>Michael Approval Date</label><input type="date" data-k="michael_approval_date" value="${esc(r.michael_approval_date)}"/></div>
      <div class="form-field span-2"><label>Approval Notes <span class="opt">(Optional)</span></label><textarea data-k="approval_notes" rows="2">${esc(r.approval_notes)}</textarea></div>
    </div>
  `;
}

// Returns the edit fields for stage 4 (packing: packed by, date returned, tracking number, notes).
function detailStage4HTML(r: EbayReturn): string {
  return `
    <div class="form-grid">
      <div class="form-field"><label>Packed By</label><input type="text" data-k="rtn_packed_by" value="${esc(r.rtn_packed_by)}"/></div>
      <div class="form-field"><label>Date Package Returned</label><input type="date" data-k="date_package_returned" value="${esc(r.date_package_returned)}"/></div>
      <div class="form-field span-2"><label>Return Tracking</label><input type="text" data-k="return_tracking" value="${esc(r.return_tracking)}"/></div>
      <div class="form-field span-2"><label>Packing Notes <span class="opt">(Optional)</span></label><textarea data-k="packing_notes" rows="2">${esc(r.packing_notes)}</textarea></div>
    </div>
  `;
}

// Returns the edit fields for stage 5 (refund: amount received, date received, notes).
function detailStage5HTML(r: EbayReturn): string {
  return `
    <div class="form-grid">
      <div class="form-field"><label>Refund Amount Received</label><input type="number" step="0.01" data-k="amount_refund_received" value="${r.amount_refund_received}"/></div>
      <div class="form-field"><label>Date Refund Received</label><input type="date" data-k="date_refund_received" value="${esc(r.date_refund_received)}"/></div>
      <div class="form-field span-2"><label>Refund Notes <span class="opt">(Optional)</span></label><textarea data-k="refund_notes" rows="2">${esc(r.refund_notes)}</textarea></div>
    </div>
  `;
}

// Reads all data-k (text/number/select) and data-kb (checkbox) inputs from the detail modal and returns them as a key-value object.
function collectDetailFields(): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  const root = container.querySelector<HTMLDivElement>('#rtn-modal-root')!;
  root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('[data-k]').forEach(el => {
    const k = el.dataset.k!;
    const v = (el as HTMLInputElement).value;
    if ((el as HTMLInputElement).type === 'number') {
      fields[k] = parseFloat(v) || 0;
    } else {
      fields[k] = v;
    }
  });
  root.querySelectorAll<HTMLInputElement>('[data-kb]').forEach(el => {
    fields[el.dataset.kb!] = el.checked ? 1 : 0;
  });
  return fields;
}

// PATCHes the return with all current form values; if advance=true also bumps the status to the next stage and closes the modal, otherwise shows a brief success message.
async function saveDetail(advance: boolean) {
  if (!detailReturn) return;
  const msg = container.querySelector<HTMLDivElement>('#rtn-detail-msg')!;
  const fields = collectDetailFields();
  if (advance) {
    fields.status = nextStage(detailReturn.status);
  }
  try {
    const res = await fetch(`/api/returns/${detailReturn.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    });
    if (!res.ok) {
      msg.innerHTML = '<div class="msg msg-error">Failed to save.</div>';
      return;
    }
    const j = await res.json();
    await loadAll();
    if (advance) {
      closeModal();
    } else {
      detailReturn = j.item;
      msg.innerHTML = '<div class="msg msg-success">Saved.</div>';
      setTimeout(() => { msg.innerHTML = ''; }, 1800);
    }
  } catch {
    msg.innerHTML = '<div class="msg msg-error">Network error.</div>';
  }
}

// Asks for confirmation then DELETEs the current return, closes the modal, and reloads the list.
async function deleteDetail() {
  if (!detailReturn) return;
  if (!confirm('Delete this return? This cannot be undone.')) return;
  try {
    const res = await fetch(`/api/returns/${detailReturn.id}`, { method: 'DELETE' });
    if (!res.ok) return;
    closeModal();
    await loadAll();
  } catch {
    /* ignore */
  }
}
