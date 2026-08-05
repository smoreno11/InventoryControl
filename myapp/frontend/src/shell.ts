/** Application chrome: header, tab navigation, and the page containers. */

export const PAGES = ["inventory", "returns", "shipping"] as const;
export type PageName = (typeof PAGES)[number];

export function appShellHTML(): string {
  return `
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

    <div id="page-inventory"></div>
    <div id="page-returns" class="hidden"></div>
    <div id="page-shipping" class="hidden"></div>`;
}
