const el = document.getElementById("app");
if (!el) throw new Error("Missing #app");

el.innerHTML = el.innerHTML = `
  <main style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; padding: 24px; max-width: 720px;">
    <h1>A MorBright Product</h1>
    <p>A MorBright Product</p>

    <button id="btn" style="padding: 10px 14px; border-radius: 10px; border: 1px solid #ccc; cursor: pointer;">
      Search
    </button>

    <pre id="out" style="margin-top: 16px; padding: 12px; border-radius: 12px; background: #f6f6f6; overflow:auto;"></pre>

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

    <div style="margin-top: 12px; border: 1px solid #e5e5e5; border-radius: 12px; overflow: hidden;">
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #fafafa; text-align: left;">
            <th style="padding: 12px; border-bottom: 1px solid #eee;">Item</th>
            <th style="padding: 12px; border-bottom: 1px solid #eee; width: 80px;">Qty</th>
            <th style="padding: 12px; border-bottom: 1px solid #eee;">Location</th>
            <th style="padding: 12px; border-bottom: 1px solid #eee; width: 140px;">Status</th>
          </tr>
        </thead>
        <tbody id="inv-rows"></tbody>
      </table>
    </div>

    <pre id="inv-err" style="display:none; margin-top: 12px; padding: 12px; border-radius: 12px; background: #fff3f3; border: 1px solid #ffd2d2; overflow:auto;"></pre>
  </main>
`;

const btn = document.getElementById("btn") as HTMLButtonElement | null;
const out = document.getElementById("out") as HTMLPreElement | null;

async function callHealth() {
  if (!out) return;
  out.textContent = "Loading...";
  try {
    // In dev, Vite proxies /api -> backend
    const res = await fetch("/api/health");
    const data = await res.json();
    out.textContent = JSON.stringify(data, null, 2);
  } catch (err) {
    out.textContent = String(err);
  }
}

btn?.addEventListener("click", callHealth);
callHealth();

// Daily Inventory UI
// - Fetches items from /api/items
// - Supports search by name/location in building/status
// - Highlights DAMAGED items for quick scanning

type InventoryItem = {
  id: number;
  name: string;
  quantity: number;
  location: string;
  status: string;
};

const invBtn = document.getElementById("inv-btn") as HTMLButtonElement | null;
const invQ = document.getElementById("inv-q") as HTMLInputElement | null;
const invRows = document.getElementById(
  "inv-rows",
) as HTMLTableSectionElement | null;
const invMeta = document.getElementById("inv-meta") as HTMLSpanElement | null;
const invErr = document.getElementById("inv-err") as HTMLPreElement | null;

let allItems: InventoryItem[] = [];

// Escape HTML if text fields contain any special characters
function esc(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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
    const hay = `${it.name} ${it.location} ${it.status}`.toLowerCase();
    return hay.includes(q);
  });

  invMeta.textContent = `${filtered.length} of ${allItems.length} items`;

  invRows.innerHTML = filtered
    .map((it) => {
      // Business rule: damaged items are visually highlighted
      const rowBg =
        it.status.toUpperCase() === "DAMAGED" ? "background:#fff7c2;" : "";

      const qtyStyle =
        it.quantity === 0 ? "color:#b00020; font-weight:600;" : "";

      return `
        <tr style="${rowBg}">
          <td style="padding:12px; border-bottom:1px solid #f1f1f1;">${esc(it.name)}</td>
          <td style="padding:12px; border-bottom:1px solid #f1f1f1; ${qtyStyle}">${it.quantity}</td>
          <td style="padding:12px; border-bottom:1px solid #f1f1f1;">${esc(it.location)}</td>
          <td style="padding:12px; border-bottom:1px solid #f1f1f1;">${esc(it.status)}</td>
        </tr>
      `;
    })
    .join("");
}

// Fetch inventory from backend and re-render table
async function loadInventory() {
  clearInvErr();
  if (invMeta) invMeta.textContent = "Loading...";

  try {
    const res = await fetch("/api/items");
    if (!res.ok)
      throw new Error(`GET /api/items failed: ${res.status} ${res.statusText}`);
    allItems = (await res.json()) as InventoryItem[];
    renderInventory();
  } catch (e) {
    showInvErr(String(e));
    if (invMeta) invMeta.textContent = "";
  }
}

invBtn?.addEventListener("click", loadInventory);
invQ?.addEventListener("input", renderInventory);

// Optional: auto-load on page load
loadInventory();
