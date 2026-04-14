/* ═══════════════════════════════════════════
   Product grid — render + filtro + sort
   ═══════════════════════════════════════════ */

import { SORT_OPTIONS } from '../data.js';
import { el, formatPrice, starsHtml, refreshIcons } from '../utils.js';
import { filters, subscribe } from '../store.js';

const badgeLabels = { sale: 'Oferta', new: 'Nuevo', hot: 'Top' };

const renderBadges = (list) =>
  list.map(b => el('span', { class: `badge badge--${b}` }, badgeLabels[b] ?? b));

const renderCard = (p, index) =>
  el('article', {
    class: 'product-card',
    style: `animation-delay: ${Math.min(index * 40, 320)}ms;`,
    data: { id: p.id },
  },
    el('div', { class: 'product-card__media' },
      p.badges.length
        ? el('div', { class: 'product-card__badges' }, renderBadges(p.badges))
        : null,
      el('div', { class: 'product-card__actions' },
        el('button', {
          class: 'product-card__action-btn',
          type: 'button',
          'aria-label': 'Vista rápida',
          title: 'Vista rápida',
          data: { action: 'quick', id: p.id },
          html: '<i data-lucide="eye"></i>',
        }),
        el('button', {
          class: 'product-card__action-btn',
          type: 'button',
          'aria-label': 'Añadir a favoritos',
          title: 'Favorito',
          data: { action: 'fav', id: p.id },
          html: '<i data-lucide="heart"></i>',
        }),
      ),
      el('img', {
        class: 'product-card__img',
        src: p.image,
        alt: p.name,
        loading: 'lazy',
      }),
    ),
    el('div', { class: 'product-card__body' },
      el('span', { class: 'product-card__brand' }, p.brand),
      el('h3', { class: 'product-card__name' }, p.name),
      el('div', { class: 'product-card__rating' },
        el('span', {
          class: 'product-card__stars',
          role: 'img',
          'aria-label': `${p.rating.toFixed(1)} de 5 estrellas`,
          html: starsHtml(p.rating),
        }),
        el('span', {}, `${p.rating.toFixed(1)} · ${p.reviews.toLocaleString()} reseñas`),
      ),
      el('span', {
        class: `product-card__stock${p.stock <= 10 ? ' is-low' : ''}`,
      }, p.stock <= 10 ? `Solo ${p.stock} en stock` : 'En stock'),
      el('div', { class: 'product-card__foot' },
        el('div', { class: 'product-card__price-col' },
          el('span', { class: 'product-card__price' }, formatPrice(p.price)),
          p.priceOld ? el('span', { class: 'product-card__price-old' }, formatPrice(p.priceOld)) : null,
        ),
        el('button', {
          class: 'btn btn--primary product-card__add',
          type: 'button',
          'aria-label': `Añadir ${p.name} al carrito`,
          data: { action: 'add', id: p.id },
          html: '<i data-lucide="shopping-cart"></i><span>Añadir</span>',
        }),
      ),
    ),
  );

const renderEmpty = () =>
  el('div', { class: 'empty-state', style: 'grid-column: 1 / -1;' },
    el('div', { class: 'empty-state__icon', html: '<i data-lucide="search-x"></i>' }),
    el('h3', { class: 'empty-state__title' }, 'No encontramos productos'),
    el('p', { class: 'empty-state__desc' }, 'Prueba con otra categoría o limpia tu búsqueda.'),
  );

export function mountSortSelect(container) {
  const select = el('select', {
    class: 'select',
    id: 'sort-select',
    'aria-label': 'Ordenar productos',
    data: { action: 'sort' },
  });
  SORT_OPTIONS.forEach(opt => {
    select.append(el('option', { value: opt.id }, opt.label));
  });
  container.append(select);
  subscribe('filters', (f) => { select.value = f.sort; });
}

export function mountProductGrid(gridEl, countEl) {
  subscribe('filters', () => {
    const list = filters.apply();
    gridEl.innerHTML = '';
    if (list.length === 0) {
      gridEl.append(renderEmpty());
    } else {
      list.forEach((p, i) => gridEl.append(renderCard(p, i)));
    }
    if (countEl) {
      countEl.innerHTML = `<strong>${list.length}</strong> ${list.length === 1 ? 'producto' : 'productos'}`;
    }
    refreshIcons();
  });
}
