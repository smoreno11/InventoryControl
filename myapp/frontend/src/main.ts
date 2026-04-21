const el = document.getElementById("app");
if (!el) throw new Error("Missing #app");

el.innerHTML = `
  <main style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; padding: 24px; max-width: 720px;">
    <h1>A MorBright Product</h1>

    <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e5e5;" />

    <h2 style="margin: 0 0 12px;">Add Item</h2>
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 10px;">
      <input id="f-date" placeholder="Date (e.g. 2026-04-21)" style="padding: 10px 12px; border-radius: 10px; border: 1px solid #ccc;" />
      <input id="f-name" placeholder="Item Name" style="padding: 10px 12px; border-radius: 10px; border: 1px solid #ccc;" />
      <input id="f-tracking" placeholder="Tracking #" type="number" style="padding: 10px 12px; border-radius: 10px; border: 1px solid #ccc;" />
      <input id="f-ebayid" placeholder="eBay ID" type="text" style="padding: 10px 12px; border-radius: 10px; border: 1px solid #ccc;" />
      <input id="f-quantity" placeholder="Quantity" type="number" style="padding: 10px 12px; border-radius: 10px; border: 1px solid #ccc;" />
      <input id="f-totalcost" placeholder="Total Cost" type="number" style="padding: 10px 12px; border-radius: 10px; border: 1px solid #ccc;" />
      <input id="f-serialnumber" placeholder="Serial Number" type="text" style="padding: 10px 12px; border-radius: 10px; border: 1px solid #ccc;" />
      <input id="f-loggedby" placeholder="Logged By" style="padding: 10px 12px; border-radius: 10px; border: 1px solid #ccc;" />
      <input id="f-notes" placeholder="Notes" style="padding: 10px 12px; border-radius: 10px; border: 1px solid #ccc; grid-column: span 2;" />
    </div>
    <button id="f-submit" style="margin-top: 12px; padding: 10px 20px; border-radius: 10px; border: none; background: #111; color: #fff; cursor: pointer; font-size: 14px;">
      Add Item
    </button>
    <span id="f-msg" style="margin-left: 12px; font-size: 14px; color: green;"></span>

    <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e5e5;" />

    <h2 style="margin: 0 0 8px;">Inventory</h2>
    <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
      <input
        id="inv-q"
        placeholder="Search inventory..."
        style="flex:1; min-width: 240px; padding: 10px 12px; border-radius: 10px; border: 1px solid #ccc;"
      />
      <button id="inv-btn" style="padding: 10px 14px; border-radius: 10px; border: 1px solid #ccc; cursor: pointer;">
        Load items
      </button>
      <span id="inv-meta" style="color:#666; font-size: 14px;"></span>
    </div>

    <div style="margin-top: 12px; border: 1px solid #e5e5e5; border-radius: 12px; overflow-x: auto;">
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #fafafa; text-align: left;">
           <th style="padding: 12px; border-bottom: 1px solid #eee;">Date</th>
           <th style="padding: 12px; border-bottom: 1px solid #eee;">Item</th>
           <th style="padding: 12px; border-bottom: 1px solid #eee;">Tracking</th>
           <th style="padding: 12px; border-bottom: 1px solid #eee;">eBay ID</th>
           <th style="padding: 12px; border-bottom: 1px solid #eee;">Qty</th>
           <th style="padding: 12px; border-bottom: 1px solid #eee;">Total Cost</th>
           <th style="padding: 12px; border-bottom: 1px solid #eee;">Serial #</th>
           <th style="padding: 12px; border-bottom: 1px solid #eee;">Logged By</th>
           <th style="padding: 12px; border-bottom: 1px solid #eee;">Notes</th>
          </tr> 
        </thead>
        <tbody id="inv-rows"></tbody>
      </table>
    </div>

    <pre id="inv-err" style="display:none; margin-top: 12px; padding: 12px; border-radius: 12px; background: #fff3f3; border: 1px solid #ffd2d2; overflow:auto;"></pre>
  </main>
`;

type InventoryItem = {
  DATE: string;
  NAME: string;
  TRACKING: number;
  EBAYID: string;
  QUANTITY: number;
  TOTALCOST: number;
  SERIALNUMBER: string;
  LOGGEDBY: string;
  NOTES: string;
};

const invBtn = document.getElementById("inv-btn") as HTMLButtonElement | null;
const invQ = document.getElementById("inv-q") as HTMLInputElement | null;
const invRows = document.getElementById("inv-rows") as HTMLTableSectionElement | null;
const invMeta = document.getElementById("inv-meta") as HTMLSpanElement | null;
const invErr = document.getElementById("inv-err") as HTMLPreElement | null;
const fSubmit = document.getElementById("f-submit") as HTMLButtonElement | null;
const fMsg = document.getElementById("f-msg") as HTMLSpanElement | null;

let allItems: InventoryItem[] = [];

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showInvErr(msg: string) {
  if (!invErr) return;
  invErr.style.display = "block";
  invErr.textContent = msg;
}

function clearInvErr() {
  if (!invErr) return;
  invErr.style.display = "none";
  invErr.textContent = "";
}

function renderInventory() {
  if (!invRows || !invMeta) return;

  const q = (invQ?.value ?? "").trim().toLowerCase();
  const filtered = allItems.filter((it) => {
    if (!q) return true;
    const hay = `${it.NAME} ${it.NOTES} ${it.LOGGEDBY}`.toLowerCase();
    return hay.includes(q);
  });

  invMeta.textContent = `${filtered.length} of ${allItems.length} items`;

  invRows.innerHTML = filtered
    .map((it) => {
      const qtyStyle = it.QUANTITY === 0 ? "color:#b00020; font-weight:600;" : "";
      return `
        <tr>
          <td style="padding:12px; border-bottom:1px solid #f1f1f1;">${esc(it.DATE)}</td>
          <td style="padding:12px; border-bottom:1px solid #f1f1f1;">${esc(it.NAME)}</td>
          <td style="padding:12px; border-bottom:1px solid #f1f1f1;">${it.TRACKING}</td>
          <td style="padding:12px; border-bottom:1px solid #f1f1f1;">${it.EBAYID}</td>
          <td style="padding:12px; border-bottom:1px solid #f1f1f1; ${qtyStyle}">${it.QUANTITY}</td>
          <td style="padding:12px; border-bottom:1px solid #f1f1f1;">$${it.TOTALCOST}</td>
          <td style="padding:12px; border-bottom:1px solid #f1f1f1;">${esc(it.SERIALNUMBER)}</td>
          <td style="padding:12px; border-bottom:1px solid #f1f1f1;">${esc(it.LOGGEDBY)}</td>
          <td style="padding:12px; border-bottom:1px solid #f1f1f1;">${esc(it.NOTES)}</td>
        </tr>
      `;
    })
    .join("");
}

async function loadInventory() {
  clearInvErr();
  if (invMeta) invMeta.textContent = "Loading...";
  try {
    const res = await fetch("/api/items");
    if (!res.ok) throw new Error(`GET /api/items failed: ${res.status} ${res.statusText}`);
    allItems = (await res.json()) as InventoryItem[];
    renderInventory();
  } catch (e) {
    showInvErr(String(e));
    if (invMeta) invMeta.textContent = "";
  }
}

async function addItem() {
  if (!fMsg) return;
  fMsg.textContent = "";

  const item = {
    DATE: (document.getElementById("f-date") as HTMLInputElement).value,
    NAME: (document.getElementById("f-name") as HTMLInputElement).value,
    TRACKING: Number((document.getElementById("f-tracking") as HTMLInputElement).value),
    EBAYID: (document.getElementById("f-ebayid") as HTMLInputElement).value,
    QUANTITY: Number((document.getElementById("f-quantity") as HTMLInputElement).value),
    TOTALCOST: Number((document.getElementById("f-totalcost") as HTMLInputElement).value),
    SERIALNUMBER: (document.getElementById("f-serialnumber") as HTMLInputElement).value,
    LOGGEDBY: (document.getElementById("f-loggedby") as HTMLInputElement).value,
    NOTES: (document.getElementById("f-notes") as HTMLInputElement).value,
  };

  try {
    const res = await fetch("/api/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item),
    });
    if (!res.ok) throw new Error(`POST failed: ${res.status}`);
    fMsg.textContent = "Item added!";
    fMsg.style.color = "green";
    // Clear the form
    ["f-date","f-name","f-tracking","f-ebayid","f-quantity","f-totalcost","f-serialnumber","f-loggedby","f-notes"]
      .forEach(id => (document.getElementById(id) as HTMLInputElement).value = "");
    // Reload the table
    loadInventory();
  } catch (e) {
    fMsg.textContent = String(e);
    fMsg.style.color = "red";
  }
}

fSubmit?.addEventListener("click", addItem);
invBtn?.addEventListener("click", loadInventory);
invQ?.addEventListener("input", renderInventory);

loadInventory();