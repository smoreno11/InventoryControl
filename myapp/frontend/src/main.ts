/** Entry point: build the shell, mount the default page, and wire tab navigation.

Everything else lives in its own module — `pages/` for screens, `api/` for
network calls, `lib/` for shared helpers. */

import { q, qa } from "./lib/dom";
import { mountInventory } from "./pages/inventory";
import { appShellHTML, type PageName } from "./shell";

document.addEventListener("DOMContentLoaded", () => {
  q("#app").innerHTML = appShellHTML();

  // The inventory page is the landing tab, so it mounts eagerly.
  mountInventory(q<HTMLElement>("#page-inventory"));

  wireNav();
});

function wireNav(): void {
  qa<HTMLButtonElement>(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => void showPage(btn.dataset.page as PageName, btn));
  });
}

/**
 * Reveal one page and hide the rest.
 *
 * Returns and Shipping are imported on demand so their code is not in the
 * initial bundle; both are safe to mount more than once.
 */
async function showPage(page: PageName, btn: HTMLButtonElement): Promise<void> {
  qa(".nav-btn").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");

  const inventoryEl = q<HTMLElement>("#page-inventory");
  const returnsEl = q<HTMLElement>("#page-returns");
  const shippingEl = q<HTMLElement>("#page-shipping");

  inventoryEl.classList.toggle("hidden", page !== "inventory");
  returnsEl.classList.toggle("hidden", page !== "returns");
  shippingEl.classList.toggle("hidden", page !== "shipping");

  if (page === "returns") {
    const { mountReturns } = await import("./pages/returns");
    mountReturns(returnsEl);
  } else if (page === "shipping") {
    const { mountShipping } = await import("./pages/shipping");
    mountShipping(shippingEl);
  }
}
