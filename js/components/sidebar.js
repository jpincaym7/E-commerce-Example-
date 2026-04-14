/* ═══════════════════════════════════════════
   Sidebar — filtros: categorías, marcas, ofertas, precio
   Render una sola vez; las actualizaciones solo togglean estados activos.
   ═══════════════════════════════════════════ */

import { CATEGORIES, TAGS, PRICE_BUCKETS, PRODUCTS, getBrands } from '../data.js';
import { el, $$, refreshIcons } from '../utils.js';
import { filters, subscribe } from '../store.js';

/* ── Contadores derivados (estáticos) ── */
const countByCategory = (id) =>
  id === 'all' ? PRODUCTS.length : PRODUCTS.filter(p => p.category === id).length;

const countByBrand = (brand) =>
  PRODUCTS.filter(p => p.brand === brand).length;

const countByTag = (tag) =>
  PRODUCTS.filter(p => p.badges.includes(tag)).length;

const countByBucket = (bucket) =>
  bucket.test
    ? PRODUCTS.filter(p => bucket.test(p.price)).length
    : PRODUCTS.length;

/* ── Render genérico de un item ── */
const renderItem = ({ id, label, icon, count, multi, action }) =>
  el('li', {},
    el('button', {
      class: 'sidebar__item',
      type: 'button',
      role: multi ? 'checkbox' : 'radio',
      'aria-checked': 'false',
      data: { action, value: id },
    },
      multi
        ? el('span', { class: 'sidebar__check', 'aria-hidden': 'true' })
        : icon
          ? el('span', {
              class: 'sidebar__icon',
              'aria-hidden': 'true',
              html: `<i data-lucide="${icon}"></i>`,
            })
          : null,
      el('span', { class: 'sidebar__label' }, label),
      count != null ? el('span', { class: 'sidebar__count' }, String(count)) : null,
    ),
  );

/* ── Render de un grupo ── */
const renderGroup = ({ title, items, multi, action, scroll = false }) => {
  const list = el('ul', {
    class: `sidebar__list${scroll ? ' sidebar__list--scroll' : ''}`,
    role: multi ? 'group' : 'radiogroup',
    'aria-label': title,
  });
  items.forEach(item => list.append(renderItem({ ...item, multi, action })));
  return el('div', { class: 'sidebar__group' },
    el('h4', { class: 'sidebar__title' }, title),
    list,
  );
};

/* ── Header (título + cerrar en mobile) ── */
const renderHeader = () =>
  el('div', { class: 'sidebar__header' },
    el('div', { class: 'sidebar__heading-wrap' },
      el('h3', { class: 'sidebar__heading text-display' }, 'Filtros'),
      el('span', { class: 'sidebar__heading-count', 'data-active-count': '' }, '0'),
    ),
    el('button', {
      class: 'sidebar__close',
      type: 'button',
      'aria-label': 'Cerrar filtros',
      data: { action: 'close-sidebar' },
      html: '<i data-lucide="x"></i>',
    }),
  );

const renderFooter = () =>
  el('button', {
    class: 'btn btn--ghost btn--block sidebar__clear',
    type: 'button',
    data: { action: 'clear-filters' },
    html: '<i data-lucide="rotate-ccw"></i><span>Limpiar filtros</span>',
  });

/* ── Build once ── */
const buildSidebar = (inner) => {
  inner.append(renderHeader());

  inner.append(renderGroup({
    title: 'Categorías',
    items: CATEGORIES.map(c => ({
      id: c.id, label: c.label, icon: c.icon, count: countByCategory(c.id),
    })),
    multi: false,
    action: 'set-category',
  }));

  inner.append(renderGroup({
    title: 'Marcas',
    items: getBrands().map(b => ({ id: b, label: b, count: countByBrand(b) })),
    multi: true,
    action: 'toggle-brand',
    scroll: true,
  }));

  inner.append(renderGroup({
    title: 'Ofertas y novedades',
    items: TAGS.map(t => ({ id: t.id, label: t.label, icon: t.icon, count: countByTag(t.id) })),
    multi: true,
    action: 'toggle-tag',
  }));

  inner.append(renderGroup({
    title: 'Precio',
    items: PRICE_BUCKETS.map(b => ({ id: b.id, label: b.label, count: countByBucket(b) })),
    multi: false,
    action: 'set-price',
  }));

  inner.append(renderFooter());
};

/* ── Update (solo estados) ── */
const setActive = (btn, isActive) => {
  btn.classList.toggle('is-active', isActive);
  btn.setAttribute('aria-checked', isActive ? 'true' : 'false');
};

const syncActiveStates = (root, f) => {
  $$('[data-action="set-category"]', root).forEach(btn =>
    setActive(btn, btn.dataset.value === f.category));
  $$('[data-action="toggle-brand"]', root).forEach(btn =>
    setActive(btn, f.brands.includes(btn.dataset.value)));
  $$('[data-action="toggle-tag"]', root).forEach(btn =>
    setActive(btn, f.tags.includes(btn.dataset.value)));
  $$('[data-action="set-price"]', root).forEach(btn =>
    setActive(btn, btn.dataset.value === f.priceBucket));
};

/* ── Mount ── */
export function mountSidebar(sidebarEl) {
  const inner = el('div', { class: 'sidebar__inner' });
  sidebarEl.append(inner);

  buildSidebar(inner);
  refreshIcons();

  const headingCount = inner.querySelector('.sidebar__heading-count');
  const clearBtn     = inner.querySelector('.sidebar__clear');

  subscribe('filters', (f) => {
    syncActiveStates(inner, f);
    const active = filters.activeCount();
    headingCount.textContent = String(active);
    headingCount.style.display = active > 0 ? '' : 'none';
    if (clearBtn) clearBtn.disabled = active === 0;
  });

  subscribe('ui', (u) => {
    sidebarEl.classList.toggle('is-open', u.sidebarOpen);
  });
}
