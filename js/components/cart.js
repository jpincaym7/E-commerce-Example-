/* ═══════════════════════════════════════════
   Cart drawer — render + interacciones
   ═══════════════════════════════════════════ */

import { el, $, formatPrice, refreshIcons } from '../utils.js';
import { cart, subscribe } from '../store.js';

const SHIPPING_THRESHOLD = 500;
const SHIPPING_FEE = 19;

const renderItem = ({ product, qty }) =>
  el('div', { class: 'cart-item', data: { id: product.id } },
    el('img', { class: 'cart-item__img', src: product.image, alt: product.name, loading: 'lazy' }),
    el('div', { class: 'cart-item__body' },
      el('span', { class: 'cart-item__brand' }, product.brand),
      el('h4', { class: 'cart-item__name' }, product.name),
      el('span', { class: 'cart-item__price' }, formatPrice(product.price * qty)),
    ),
    el('div', { class: 'cart-item__side' },
      el('button', {
        class: 'cart-item__remove',
        type: 'button',
        'aria-label': `Quitar ${product.name}`,
        title: 'Quitar',
        data: { action: 'remove', id: product.id },
        html: '<i data-lucide="trash-2"></i>',
      }),
      el('div', { class: 'qty' },
        el('button', { class: 'qty__btn', type: 'button', 'aria-label': 'Restar', data: { action: 'qty-dec', id: product.id } }, '−'),
        el('span', { class: 'qty__value', 'aria-live': 'polite' }, String(qty)),
        el('button', {
          class: 'qty__btn',
          type: 'button',
          'aria-label': 'Sumar',
          disabled: qty >= product.stock,
          data: { action: 'qty-inc', id: product.id },
        }, '+'),
      ),
    ),
  );

const renderEmpty = () =>
  el('div', { class: 'cart-empty' },
    el('div', { class: 'cart-empty__icon', html: '<i data-lucide="shopping-bag"></i>' }),
    el('h3', { class: 'cart-empty__title' }, 'Tu carrito está vacío'),
    el('p', { class: 'cart-empty__desc' }, 'Añade productos desde la tienda para verlos aquí.'),
    el('button', {
      class: 'btn btn--primary',
      type: 'button',
      data: { action: 'close-cart' },
    }, 'Explorar productos'),
  );

export function mountCart(drawer) {
  const body       = $('.cart-drawer__body', drawer);
  const countLabel = $('.cart-drawer__title-count', drawer);
  const subLine    = $('[data-cart-subtotal]', drawer);
  const shipLine   = $('[data-cart-shipping]', drawer);
  const totLine    = $('[data-cart-total]', drawer);
  const footer     = $('.cart-drawer__footer', drawer);
  const checkoutBtn = $('[data-action="checkout"]', drawer);
  const clearBtn    = $('[data-action="clear-cart"]', drawer);

  subscribe('cart', () => {
    const items = cart.items();
    const count = cart.count();
    const sub   = cart.subtotal();
    const ship  = items.length === 0 ? 0 : (sub >= SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE);
    const total = sub + ship;

    body.innerHTML = '';
    if (items.length === 0) {
      body.append(renderEmpty());
      footer.style.display = 'none';
    } else {
      items.forEach(i => body.append(renderItem(i)));
      footer.style.display = '';
    }

    countLabel.textContent = `${count} item${count === 1 ? '' : 's'}`;
    subLine.textContent = formatPrice(sub);
    shipLine.textContent = ship === 0 ? 'Gratis' : formatPrice(ship);
    totLine.innerHTML = `<strong>${formatPrice(total)}</strong>`;

    if (checkoutBtn) checkoutBtn.disabled = items.length === 0;
    if (clearBtn)    clearBtn.disabled    = items.length === 0;

    refreshIcons();
  });

  subscribe('ui', (ui) => {
    drawer.classList.toggle('is-open', ui.cartOpen);
    drawer.setAttribute('aria-hidden', ui.cartOpen ? 'false' : 'true');
  });
}

export function mountCartBadge(badgeEl) {
  subscribe('cart', () => {
    const count = cart.count();
    badgeEl.textContent = count;
    badgeEl.style.display = count > 0 ? '' : 'none';
    badgeEl.classList.remove('is-bumping');
    void badgeEl.offsetWidth;
    badgeEl.classList.add('is-bumping');
  });
}
