/* ═══════════════════════════════════════════
   Bootstrap — wiring + event delegation
   ═══════════════════════════════════════════ */

import { $, debounce, formatPrice, refreshIcons } from './utils.js';
import { cart, filters, ui, get, subscribe } from './store.js';
import { getProduct, getFeatured } from './data.js';

import { mountSidebar }     from './components/sidebar.js';
import { mountBreadcrumbs } from './components/breadcrumbs.js';
import { mountProductGrid, mountSortSelect } from './components/productGrid.js';
import { mountCart, mountCartBadge } from './components/cart.js';
import { mountModal } from './components/modal.js';
import { mountToastStack, toast } from './components/toast.js';

/* ── Mount all components ── */
mountSidebar($('#sidebar'));
mountBreadcrumbs($('#breadcrumbs'), $('#active-chips'));
mountSortSelect($('#sort-container'));
mountProductGrid($('#product-grid'), $('#product-count'));
mountCart($('#cart-drawer'));
mountCartBadge($('#cart-badge'));
mountModal($('#quick-view'));
mountToastStack($('#toast-stack'));

/* ── Hydrate hero with featured product ── */
const featured = getFeatured();
const heroImg = $('#hero-image');
const heroName = $('#hero-featured-name');
const heroBrand = $('#hero-featured-brand');
const heroPrice = $('#hero-featured-price');
if (heroImg) {
  heroImg.src = featured.image;
  heroImg.alt = featured.name;
  heroName.textContent = featured.name;
  heroBrand.textContent = featured.brand;
  heroPrice.textContent = formatPrice(featured.price);
}

/* ── Keep filter-toggle badge in sync with active filters count ── */
const filterToggle = $('#filter-toggle');
if (filterToggle) {
  subscribe('filters', () => {
    filterToggle.dataset.activeCount = String(filters.activeCount());
  });
}

/* ── Body overlay state reacts to any UI drawer/modal ── */
subscribe('ui', (u) => {
  document.body.classList.toggle(
    'overlay-active',
    u.cartOpen || u.sidebarOpen || !!u.quickView,
  );
});

/* ── Convert all <i data-lucide> placeholders to SVG ── */
refreshIcons();

/* ── Event delegation — un único listener ── */
const handlers = {
  add(id) {
    const p = getProduct(id);
    if (!p) return;
    const current = get('cart')[id] ?? 0;
    if (current >= p.stock) {
      toast(`Stock máximo alcanzado (${p.stock})`, 'warning');
      return;
    }
    cart.add(id);
    toast(`${p.name} añadido al carrito`, 'success');
  },
  remove(id) {
    const p = getProduct(id);
    cart.remove(id);
    if (p) toast(`${p.name} removido`, 'info');
  },
  'qty-inc'(id) { cart.setQty(id, (get('cart')[id] ?? 0) + 1); },
  'qty-dec'(id) { cart.setQty(id, (get('cart')[id] ?? 0) - 1); },
  quick(id) { ui.openQuick(id); },
  'close-quick'() { ui.closeQuick(); },
  'open-cart'()  { ui.openCart();  },
  'close-cart'() { ui.closeCart(); },
  'open-sidebar'()  { ui.openSidebar();  },
  'close-sidebar'() { ui.closeSidebar(); },
  'clear-cart'() {
    if (cart.count() === 0) return;
    cart.clear();
    toast('Carrito vaciado', 'info');
  },
  checkout() {
    const total = cart.subtotal();
    if (total === 0) return;
    toast(`Checkout simulado · ${formatPrice(total)}`, 'success');
    cart.clear();
    ui.closeCart();
  },
  'set-category'(_id, btn) {
    filters.setCategory(btn.dataset.value);
  },
  'toggle-brand'(_id, btn) {
    filters.toggleBrand(btn.dataset.value);
  },
  'toggle-tag'(_id, btn) {
    filters.toggleTag(btn.dataset.value);
  },
  'set-price'(_id, btn) {
    filters.setPrice(btn.dataset.value);
  },
  'clear-filters'() {
    filters.clear();
  },
  sort(_id, select) {
    filters.set({ sort: select.value });
  },
  fav(id, btn) {
    btn.classList.toggle('is-active');
    const p = getProduct(id);
    if (p) toast(
      btn.classList.contains('is-active') ? `${p.name} guardado` : `${p.name} removido de favoritos`,
      'info',
    );
  },
};

document.addEventListener('click', (e) => {
  const target = e.target.closest('[data-action]');
  if (!target) return;
  const { action, id } = target.dataset;
  const fn = handlers[action];
  if (fn) {
    e.preventDefault();
    fn(id, target);
  }
});

document.addEventListener('change', (e) => {
  const target = e.target.closest('[data-action="sort"]');
  if (!target) return;
  handlers.sort(null, target);
});

/* ── Modal backdrop ── */
document.addEventListener('modal:backdrop', () => ui.closeQuick());

/* ── Backdrop click: close drawer/modal/sidebar when clicking outside ── */
document.addEventListener('click', (e) => {
  if (!document.body.classList.contains('overlay-active')) return;
  const drawer  = $('#cart-drawer');
  const modal   = $('#quick-view');
  const sidebar = $('#sidebar');
  if (drawer.contains(e.target) || modal.contains(e.target) || sidebar.contains(e.target)) return;
  if (e.target.closest('[data-action]')) return;
  ui.closeAny();
});

/* ── Keyboard ── */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') ui.closeAny();
});

/* ── Search input (debounced) ── */
const searchInput = $('#search-input');
if (searchInput) {
  searchInput.addEventListener('input', debounce((e) => {
    filters.set({ query: e.target.value });
  }, 150));
}

/* ── Ready ── */
document.documentElement.classList.add('is-ready');
