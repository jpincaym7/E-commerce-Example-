/* ═══════════════════════════════════════════
   Quick-view modal
   ═══════════════════════════════════════════ */

import { el, formatPrice, starsHtml, refreshIcons } from '../utils.js';
import { subscribe } from '../store.js';
import { getProduct } from '../data.js';

const badgeLabels = { sale: 'Oferta', new: 'Nuevo', hot: 'Top' };

const renderCard = (p) =>
  el('div', { class: 'modal__card', role: 'document' },
    el('button', {
      class: 'modal__close',
      type: 'button',
      'aria-label': 'Cerrar',
      data: { action: 'close-quick' },
      html: '<i data-lucide="x"></i>',
    }),
    el('div', { class: 'modal__media' },
      el('img', { src: p.image, alt: p.name }),
    ),
    el('div', { class: 'modal__body' },
      el('div', { style: 'display:flex; gap: var(--sp-2); flex-wrap: wrap;' },
        ...p.badges.map(b => el('span', { class: `badge badge--${b}` }, badgeLabels[b] ?? b)),
      ),
      el('span', { class: 'modal__brand' }, p.brand),
      el('h2', { class: 'modal__title' }, p.name),
      el('div', { class: 'modal__rating' },
        el('span', {
          class: 'modal__rating-stars',
          role: 'img',
          'aria-label': `${p.rating.toFixed(1)} de 5 estrellas`,
          html: starsHtml(p.rating),
        }),
        el('span', {}, `${p.rating.toFixed(1)} · ${p.reviews.toLocaleString()} reseñas`),
      ),
      el('div', { class: 'modal__price-row' },
        el('span', { class: 'modal__price' }, formatPrice(p.price)),
        p.priceOld ? el('span', { class: 'modal__price-old' }, formatPrice(p.priceOld)) : null,
      ),
      el('p', { class: 'modal__desc' }, p.description),
      el('span', { class: 'modal__specs-title' }, 'Características'),
      el('ul', { class: 'modal__specs' },
        ...p.specs.map(s => el('li', { class: 'modal__spec' }, s)),
      ),
      el('div', { class: 'modal__cta' },
        el('button', {
          class: 'btn btn--primary btn--lg',
          type: 'button',
          data: { action: 'add', id: p.id },
          html: '<i data-lucide="shopping-cart"></i><span>Añadir al carrito</span>',
        }),
        el('button', {
          class: 'btn btn--ghost btn--lg',
          type: 'button',
          data: { action: 'close-quick' },
        }, 'Seguir explorando'),
      ),
    ),
  );

export function mountModal(modalEl) {
  subscribe('ui', (ui) => {
    if (ui.quickView) {
      const p = getProduct(ui.quickView);
      if (!p) return;
      modalEl.innerHTML = '';
      modalEl.append(renderCard(p));
      modalEl.classList.add('is-open');
      modalEl.setAttribute('aria-hidden', 'false');
      refreshIcons();
    } else {
      modalEl.classList.remove('is-open');
      modalEl.setAttribute('aria-hidden', 'true');
      modalEl.innerHTML = '';
    }
  });

  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) modalEl.dispatchEvent(new CustomEvent('modal:backdrop', { bubbles: true }));
  });
}
