/** Static markup for the inventory page. */

export function inventoryPageHTML(): string {
  return `
    <main class="app-main">

      <!-- Add Pending Shipment -->
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

      <!-- Pending Inventory -->
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

      <!-- Logged Inventory -->
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
          <div class="month-bar-spacer"></div>
          <button class="btn btn-ghost btn-sm" id="upload-file">Upload Spreadsheet</button>
          <span id="upload-msg" class="upload-msg"></span>
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
  `;
}
