const el = document.getElementById("app");
if (!el) throw new Error("Missing #app");

el.innerHTML = `
  <main style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; padding: 24px; max-width: 720px;">
    <h1>A MorBright Product</h1>
    <p>A MorBright Product</p>

    <button id="btn" style="padding: 10px 14px; border-radius: 10px; border: 1px solid #ccc; cursor: pointer;">
      Search
    </button>

    <pre id="out" style="margin-top: 16px; padding: 12px; border-radius: 12px; background: #f6f6f6; overflow:auto;"></pre>
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
