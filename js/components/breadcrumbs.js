/* ═══════════════════════════════════════════
   Breadcrumbs + chips de filtros activos
   ═══════════════════════════════════════════ */

import { el, refreshIcons } from '../utils.js';
import { filters, subscribe } from '../store.js';
import { CATEGORIES, TAGS, PRICE_BUCKETS } from '../data.js';

const getCategoryLabel = (id) => CATEGORIES.find(c => c.id === id)?.label ?? id;
const getTagLabel = (id) => TAGS.find(t => t.id === id)?.label ?? id;
const getPriceLabel = (id) => PRICE_BUCKETS.find(b => b.id === id)?.label ?? id;

const renderCrumb = (label, action, value, { current = false } = {}) =>
  current
    ? el('li', { class: 'breadcrumbs__item' },
        el('span', {
          class: 'breadcrumbs__current',
          'aria-current': 'page',
        }, label),
      )
    : el('li', { class: 'breadcrumbs__item' },
        el('button', {
          class: 'breadcrumbs__link',
          type: 'button',
          data: { action, value: value ?? '' },
        }, label),
        el('span', { class: 'breadcrumbs__sep', 'aria-hidden': 'true' }, '/'),
      );

const renderChip = (label, action, value) =>
  el('button', {
    class: 'chip',
    type: 'button',
    'aria-label': `Quitar filtro ${label}`,
    data: { action, value },
  },
    el('span', {}, label),
    el('span', { class: 'chip__x', 'aria-hidden': 'true', html: '<i data-lucide="x"></i>' }),
  );

export function mountBreadcrumbs(crumbEl, chipsEl) {
  subscribe('filters', (f) => {
    /* ── Breadcrumbs ── */
    const list = el('ol', { class: 'breadcrumbs__list' });
    list.append(renderCrumb('Inicio', 'clear-filters'));
    if (f.category === 'all') {
      list.append(renderCrumb('Tienda', null, null, { current: true }));
    } else {
      list.append(renderCrumb('Tienda', 'set-category', 'all'));
      list.append(renderCrumb(getCategoryLabel(f.category), null, null, { current: true }));
    }
    crumbEl.innerHTML = '';
    crumbEl.append(list);

    /* ── Chips de filtros activos ── */
    chipsEl.innerHTML = '';
    const chips = [];
    f.brands.forEach(b => chips.push(renderChip(b, 'toggle-brand', b)));
    f.tags.forEach(t => chips.push(renderChip(getTagLabel(t), 'toggle-tag', t)));
    if (f.priceBucket !== 'all') {
      chips.push(renderChip(getPriceLabel(f.priceBucket), 'set-price', 'all'));
    }
    if (chips.length > 0) {
      chipsEl.append(...chips);
      chipsEl.append(
        el('button', {
          class: 'chip chip--clear',
          type: 'button',
          data: { action: 'clear-filters' },
        }, 'Limpiar todo'),
      );
    }

    refreshIcons();
  });
}
