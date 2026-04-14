/* ═══════════════════════════════════════════
   Checkout — pasarela de pago (wizard 4 pasos)
   ═══════════════════════════════════════════ */

import { el, $, $$, formatPrice, refreshIcons, uid } from '../utils.js';
import { cart, ui, subscribe } from '../store.js';

const SHIPPING_THRESHOLD = 500;
const SHIPPING_FEE = 19;
const PROCESSING_MS = 1800;

/* ── Formatters de input ── */
const formatCardNumber = (raw) =>
  raw.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();

const formatExpiry = (raw) => {
  const d = raw.replace(/\D/g, '').slice(0, 4);
  return d.length >= 3 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};

const formatCVV = (raw) => raw.replace(/\D/g, '').slice(0, 4);

const formatHolder = (raw) =>
  raw.replace(/[^a-zA-ZÀ-ÿ\s]/g, '').toUpperCase().slice(0, 26);

const FORMATTERS = {
  'payment.number': formatCardNumber,
  'payment.holder': formatHolder,
  'payment.expiry': formatExpiry,
  'payment.cvv':    formatCVV,
};

/* ── Card brand detection ── */
const detectBrand = (num) => {
  const n = num.replace(/\D/g, '');
  if (!n) return { id: 'generic', label: 'Tarjeta' };
  if (/^4/.test(n))               return { id: 'visa',     label: 'VISA' };
  if (/^(5[1-5]|2[2-7])/.test(n)) return { id: 'mc',       label: 'Mastercard' };
  if (/^3[47]/.test(n))           return { id: 'amex',     label: 'AMEX' };
  if (/^6/.test(n))               return { id: 'discover', label: 'Discover' };
  return { id: 'generic', label: 'Tarjeta' };
};

/* ── Typing animation per character ── */
const renderTyped = (value, prev, placeholder = '') => {
  if (!value) {
    return `<span class="char char--placeholder">${placeholder}</span>`;
  }
  const isAdding = value.length > prev.length;
  return value.split('').map((c, i) => {
    const isNew = isAdding && i === value.length - 1;
    const char = c === ' ' ? '&nbsp;' : c;
    return `<span class="char${isNew ? ' char--new' : ''}">${char}</span>`;
  }).join('');
};

/* ── Validation helpers ── */
const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const digits  = (s) => s.replace(/\D/g, '');

const validators = {
  shipping: {
    name:    (v) => v.trim().length >= 3,
    email:   (v) => emailRx.test(v.trim()),
    address: (v) => v.trim().length >= 4,
    city:    (v) => v.trim().length >= 2,
    zip:     (v) => v.trim().length >= 3,
  },
  payment: {
    number: (v) => digits(v).length === 16,
    holder: (v) => v.trim().length >= 3,
    expiry: (v) => {
      const m = v.match(/^(\d{2})\/(\d{2})$/);
      if (!m) return false;
      const mo = +m[1], yr = +m[2];
      return mo >= 1 && mo <= 12 && yr >= 24 && yr <= 40;
    },
    cvv: (v) => /^\d{3,4}$/.test(v),
  },
};

/* ── State interno del componente ── */
const createState = () => ({
  step: 1,
  shipping: { name: '', email: '', address: '', city: '', zip: '' },
  payment:  { number: '', holder: '', expiry: '', cvv: '' },
  order:    null,
  flipped:  false,
  prev:     { number: '', holder: '', expiry: '', cvv: '' },
});

/* ══════════════════════════════════════════════
   Templates
   ══════════════════════════════════════════════ */

const STEPS = [
  { id: 1, label: 'Envío' },
  { id: 2, label: 'Pago' },
  { id: 3, label: 'Confirmar' },
];

const renderSteps = (current) =>
  el('ol', { class: 'checkout-steps' },
    ...STEPS.map(s => {
      const done   = current > s.id || current === 4;
      const active = current === s.id || (current === 4 && s.id === 3);
      return el('li', {
        class: `checkout-step${active ? ' is-active' : ''}${done && !active ? ' is-done' : ''}`,
      },
        el('span', { class: 'checkout-step__dot' },
          done && !active
            ? el('span', { html: '<i data-lucide="check"></i>' })
            : String(s.id),
        ),
        el('span', { class: 'checkout-step__label' }, s.label),
      );
    }),
  );

const renderField = ({ name, label, type = 'text', placeholder, value, error, autocomplete }) =>
  el('div', { class: `field${error ? ' field--error' : ''}`, data: { field: name } },
    el('label', { class: 'field__label', for: `f-${name}` }, label),
    el('input', {
      class: 'input',
      id: `f-${name}`,
      name,
      type,
      value,
      placeholder,
      autocomplete: autocomplete ?? 'off',
      data: { bind: name },
    }),
    error ? el('span', { class: 'field__error' }, error) : null,
  );

/* ── Summary (right column) ── */
const renderSummary = (items, showOrderDate = null) => {
  const sub   = items.reduce((a, { product, qty }) => a + product.price * qty, 0);
  const ship  = sub === 0 ? 0 : (sub >= SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE);
  const total = sub + ship;

  return el('aside', { class: 'checkout-summary' },
    el('h3', { class: 'checkout-summary__title' }, showOrderDate ? 'Resumen del pedido' : 'Tu pedido'),
    el('div', { class: 'checkout-summary__items' },
      ...items.map(({ product, qty }) =>
        el('div', { class: 'checkout-summary__item' },
          el('img', { src: product.image, alt: product.name }),
          el('div', {},
            el('div', { class: 'checkout-summary__name' }, product.name),
            el('div', { class: 'checkout-summary__qty' }, `Cantidad: ${qty}`),
          ),
          el('span', { class: 'checkout-summary__price' }, formatPrice(product.price * qty)),
        ),
      ),
    ),
    el('div', { class: 'checkout-summary__lines' },
      el('div', { class: 'checkout-summary__line' },
        el('span', {}, 'Subtotal'),
        el('span', {}, formatPrice(sub)),
      ),
      el('div', { class: 'checkout-summary__line' },
        el('span', {}, 'Envío'),
        el('span', {}, ship === 0 ? 'Gratis' : formatPrice(ship)),
      ),
      el('div', { class: 'checkout-summary__line checkout-summary__line--total' },
        el('span', {}, 'Total'),
        el('strong', {}, formatPrice(total)),
      ),
      showOrderDate
        ? el('div', { class: 'checkout-summary__line', style: 'margin-top:var(--sp-3);' },
            el('span', {}, 'Fecha'),
            el('span', {}, showOrderDate),
          )
        : null,
    ),
  );
};

/* ══════════════════════════════════════════════
   Step renderers
   ══════════════════════════════════════════════ */

const renderShippingForm = (state, errors) =>
  el('form', { class: 'checkout-form', onsubmit: (e) => e.preventDefault() },
    el('h3', { class: 'checkout-modal__title', style: 'margin:0;' }, 'Datos de envío'),
    el('div', { class: 'form-grid form-grid--2' },
      renderField({
        name: 'shipping.name', label: 'Nombre completo', placeholder: 'Juan Pérez',
        value: state.shipping.name, error: errors['shipping.name'], autocomplete: 'name',
      }),
      renderField({
        name: 'shipping.email', label: 'Email', type: 'email', placeholder: 'juan@email.com',
        value: state.shipping.email, error: errors['shipping.email'], autocomplete: 'email',
      }),
    ),
    renderField({
      name: 'shipping.address', label: 'Dirección', placeholder: 'Av. Principal 123, Dpto 4B',
      value: state.shipping.address, error: errors['shipping.address'], autocomplete: 'street-address',
    }),
    el('div', { class: 'form-grid form-grid--2' },
      renderField({
        name: 'shipping.city', label: 'Ciudad', placeholder: 'Lima',
        value: state.shipping.city, error: errors['shipping.city'], autocomplete: 'address-level2',
      }),
      renderField({
        name: 'shipping.zip', label: 'Código postal', placeholder: '15001',
        value: state.shipping.zip, error: errors['shipping.zip'], autocomplete: 'postal-code',
      }),
    ),
    el('div', { class: 'checkout-actions' },
      el('button', {
        class: 'btn btn--ghost', type: 'button',
        data: { action: 'close-checkout' },
      }, 'Cancelar'),
      el('button', {
        class: 'btn btn--primary btn--lg', type: 'button',
        data: { action: 'checkout-next' },
        html: 'Continuar a pago <i data-lucide="arrow-right"></i>',
      }),
    ),
  );

const renderPaymentCard = (state) => {
  const brand = detectBrand(state.payment.number);
  return el('div', {
    class: `payment-card${state.flipped ? ' is-flipped' : ''}`,
    'data-brand': brand.id,
  },
    el('div', { class: 'payment-card__inner' },
      /* ── Front ── */
      el('div', { class: 'payment-card__face payment-card__front' },
        el('div', { class: 'payment-card__brand' }, brand.label),
        el('div', { class: 'payment-card__chip', 'aria-hidden': 'true' }),
        el('div', {
          class: 'payment-card__number',
          data: { field: 'number' },
          html: renderTyped(state.payment.number, state.prev.number, '•••• •••• •••• ••••'),
        }),
        el('div', { class: 'payment-card__row' },
          el('div', {},
            el('div', { class: 'payment-card__label' }, 'Titular'),
            el('div', {
              class: 'payment-card__holder',
              data: { field: 'holder' },
              html: renderTyped(state.payment.holder, state.prev.holder, 'NOMBRE COMPLETO'),
            }),
          ),
          el('div', {},
            el('div', { class: 'payment-card__label' }, 'Vence'),
            el('div', {
              class: 'payment-card__expiry',
              data: { field: 'expiry' },
              html: renderTyped(state.payment.expiry, state.prev.expiry, 'MM/YY'),
            }),
          ),
        ),
      ),
      /* ── Back ── */
      el('div', { class: 'payment-card__face payment-card__back' },
        el('div', { class: 'payment-card__stripe' }),
        el('div', { class: 'payment-card__signature' },
          el('span', {
            class: 'payment-card__cvv',
            data: { field: 'cvv' },
            html: renderTyped(state.payment.cvv, state.prev.cvv, '•••'),
          }),
        ),
        el('p', { class: 'payment-card__hint' },
          'El CVV son los 3 dígitos al reverso. Tu información está encriptada.'),
      ),
    ),
  );
};

const renderPaymentForm = (state, errors) => {
  const items = cart.items();
  const sub   = cart.subtotal();
  const ship  = sub >= SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
  const total = sub + ship;

  return el('div', { class: 'checkout-form' },
    el('h3', { class: 'checkout-modal__title', style: 'margin:0;' }, 'Datos de tarjeta'),
    renderPaymentCard(state),
    el('form', {
      class: 'checkout-form',
      style: 'gap: var(--sp-3);',
      onsubmit: (e) => e.preventDefault(),
    },
      renderField({
        name: 'payment.number', label: 'Número de tarjeta',
        placeholder: '1234 5678 9012 3456',
        value: state.payment.number, error: errors['payment.number'],
        autocomplete: 'cc-number',
      }),
      renderField({
        name: 'payment.holder', label: 'Titular',
        placeholder: 'JUAN PEREZ',
        value: state.payment.holder, error: errors['payment.holder'],
        autocomplete: 'cc-name',
      }),
      el('div', { class: 'form-grid form-grid--2' },
        renderField({
          name: 'payment.expiry', label: 'Vencimiento', placeholder: 'MM/YY',
          value: state.payment.expiry, error: errors['payment.expiry'],
          autocomplete: 'cc-exp',
        }),
        renderField({
          name: 'payment.cvv', label: 'CVV', placeholder: '•••',
          value: state.payment.cvv, error: errors['payment.cvv'],
          autocomplete: 'cc-csc',
        }),
      ),
    ),
    el('div', { class: 'checkout-actions' },
      el('button', {
        class: 'btn btn--ghost', type: 'button',
        data: { action: 'checkout-back' },
      }, 'Atrás'),
      el('button', {
        class: 'btn btn--primary btn--lg', type: 'button',
        data: { action: 'checkout-pay' },
        html: `<i data-lucide="lock"></i><span>Pagar ${formatPrice(total)}</span>`,
      }),
    ),
  );
};

const renderProcessing = () =>
  el('div', { class: 'checkout-processing' },
    el('div', { class: 'checkout-processing__spinner', 'aria-hidden': 'true' }),
    el('h3', { class: 'checkout-processing__title' }, 'Procesando pago…'),
    el('p', { class: 'checkout-processing__desc' },
      'Estamos verificando con tu emisor. No cierres esta ventana.'),
  );

const renderSuccess = (order) => {
  const fullName = order.shipping.name || 'Cliente';
  const fechaStr = new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'medium', timeStyle: 'short',
  }).format(order.date);
  const lastFour = order.card.slice(-4);

  return el('div', { class: 'checkout-success' },
    el('div', { class: 'checkout-success__left' },
      el('div', { class: 'checkout-success__check', 'aria-hidden': 'true' },
        el('span', { html: '<i data-lucide="check"></i>' }),
      ),
      el('h2', { class: 'checkout-success__title text-display' }, '¡Pago exitoso!'),
      el('p', { class: 'checkout-success__subtitle' },
        `Gracias ${fullName.split(' ')[0]}, tu pedido está confirmado. Recibirás un email con los detalles.`),
      el('div', { class: 'checkout-success__order' }, `ORDEN #${order.id}`),
      el('div', { class: 'checkout-success__actions' },
        el('button', {
          class: 'btn btn--primary btn--lg', type: 'button',
          data: { action: 'close-checkout' },
          html: 'Seguir comprando <i data-lucide="arrow-right"></i>',
        }),
      ),
    ),
    el('div', { class: 'checkout-success__receipt' },
      el('h3', { class: 'checkout-success__receipt-title' }, 'Recibo'),
      el('div', { class: 'checkout-success__meta' },
        el('div', { class: 'checkout-summary__line' },
          el('span', {}, 'Fecha'), el('strong', {}, fechaStr),
        ),
        el('div', { class: 'checkout-summary__line' },
          el('span', {}, 'Tarjeta'), el('strong', {}, `${order.brand} •••• ${lastFour}`),
        ),
        el('div', { class: 'checkout-summary__line' },
          el('span', {}, 'Entrega'),
          el('strong', {},
            `${order.shipping.city}, ${order.shipping.zip}`),
        ),
      ),
      el('div', { class: 'checkout-summary__lines' },
        el('div', { class: 'checkout-summary__line' },
          el('span', {}, `${order.items.length} producto${order.items.length === 1 ? '' : 's'}`),
          el('span', {}, formatPrice(order.subtotal)),
        ),
        el('div', { class: 'checkout-summary__line' },
          el('span', {}, 'Envío'),
          el('span', {}, order.shipping_fee === 0 ? 'Gratis' : formatPrice(order.shipping_fee)),
        ),
        el('div', { class: 'checkout-summary__line checkout-summary__line--total' },
          el('span', {}, 'Total pagado'),
          el('strong', {}, formatPrice(order.total)),
        ),
      ),
    ),
  );
};

/* ══════════════════════════════════════════════
   Mount
   ══════════════════════════════════════════════ */

export function mountCheckout(modalEl) {
  let state  = createState();
  let errors = {};

  const render = () => {
    /* sync prev con payment para no re-animar en re-renders de step */
    state.prev = { ...state.payment };
    modalEl.innerHTML = '';
    const card = el('div', { class: 'checkout-modal__card', role: 'document' },
      el('button', {
        class: 'checkout-modal__close', type: 'button',
        'aria-label': 'Cerrar checkout',
        data: { action: 'close-checkout' },
        html: '<i data-lucide="x"></i>',
      }),
      el('header', { class: 'checkout-modal__head' },
        el('h2', { class: 'checkout-modal__title text-display' }, 'Finalizar compra'),
        renderSteps(state.step),
      ),
    );

    const body = el('div', { class: 'checkout-modal__body' });

    if (state.step === 1) {
      body.append(
        el('div', { class: 'checkout-panel' }, renderShippingForm(state, errors)),
        renderSummary(cart.items()),
      );
    } else if (state.step === 2) {
      body.append(
        el('div', { class: 'checkout-panel' }, renderPaymentForm(state, errors)),
        renderSummary(cart.items()),
      );
    } else if (state.step === 3) {
      body.append(renderProcessing());
    } else if (state.step === 4 && state.order) {
      body.append(renderSuccess(state.order));
    }

    card.append(body);
    modalEl.append(card);
    refreshIcons();

    /* Re-bind input handlers after render */
    bindInputs();
  };

  /* ── Input binding (typing animation reacts here) ── */
  const bindInputs = () => {
    $$('input[data-bind]', modalEl).forEach(input => {
      input.addEventListener('input', onInput);
      input.addEventListener('focus', onFocus);
      input.addEventListener('blur',  onBlur);
    });
  };

  const onInput = (e) => {
    const bind = e.target.dataset.bind;
    if (!bind) return;
    const [section, key] = bind.split('.');
    const raw = e.target.value;
    const formatted = FORMATTERS[bind]?.(raw) ?? raw;

    /* Save previous to drive typing animation */
    state.prev = { ...state.payment };

    state[section][key] = formatted;
    e.target.value = formatted;

    if (errors[bind]) {
      delete errors[bind];
      e.target.closest('.field')?.classList.remove('field--error');
    }

    /* Update card preview fields in-place (no full re-render) */
    if (section === 'payment') updateCardFields();
  };

  const onFocus = (e) => {
    const bind = e.target.dataset.bind;
    if (!bind) return;
    const [section, key] = bind.split('.');
    if (section !== 'payment') return;

    state.flipped = key === 'cvv';
    modalEl.querySelector('.payment-card')?.classList.toggle('is-flipped', state.flipped);

    /* Highlight matching card field */
    $$('.payment-card [data-field]', modalEl).forEach(n =>
      n.classList.toggle('is-focus', n.dataset.field === key));
  };

  const onBlur = () => {
    $$('.payment-card [data-field]', modalEl).forEach(n => n.classList.remove('is-focus'));
  };

  /* ── In-place card preview update (called on every payment input) ── */
  const updateCardFields = () => {
    const p = state.payment;
    const pr = state.prev;
    const numberEl = $('.payment-card__number', modalEl);
    const holderEl = $('.payment-card__holder', modalEl);
    const expiryEl = $('.payment-card__expiry', modalEl);
    const cvvEl    = $('.payment-card__cvv',    modalEl);
    const brandEl  = $('.payment-card__brand',  modalEl);

    if (numberEl) numberEl.innerHTML = renderTyped(p.number, pr.number, '•••• •••• •••• ••••');
    if (holderEl) holderEl.innerHTML = renderTyped(p.holder, pr.holder, 'NOMBRE COMPLETO');
    if (expiryEl) expiryEl.innerHTML = renderTyped(p.expiry, pr.expiry, 'MM/YY');
    if (cvvEl)    cvvEl.innerHTML    = renderTyped(p.cvv,    pr.cvv,    '•••');

    if (brandEl) {
      const brand = detectBrand(p.number);
      brandEl.textContent = brand.label;
      modalEl.querySelector('.payment-card')?.setAttribute('data-brand', brand.id);
    }
  };

  /* ── Validation ── */
  const validateStep = () => {
    errors = {};
    const rules = state.step === 1 ? validators.shipping : validators.payment;
    const section = state.step === 1 ? 'shipping' : 'payment';
    for (const [key, test] of Object.entries(rules)) {
      const value = state[section][key];
      if (!test(value)) errors[`${section}.${key}`] = 'Campo requerido o inválido';
    }
    return Object.keys(errors).length === 0;
  };

  /* ── Step navigation ── */
  const nextStep = () => {
    if (!validateStep()) return render();
    if (state.step === 1) { state.step = 2; render(); }
  };

  const backStep = () => {
    if (state.step === 2) { state.step = 1; render(); }
  };

  const processPayment = () => {
    if (!validateStep()) return render();

    const items = cart.items();
    const subtotal = cart.subtotal();
    const shipping_fee = subtotal >= SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
    const total = subtotal + shipping_fee;

    state.order = {
      id: 'TB-' + uid().toUpperCase(),
      date: new Date(),
      items,
      subtotal,
      shipping_fee,
      total,
      shipping: { ...state.shipping },
      card: state.payment.number.replace(/\D/g, ''),
      brand: detectBrand(state.payment.number).label,
    };

    state.step = 3;
    render();

    setTimeout(() => {
      cart.clear();
      state.step = 4;
      render();
    }, PROCESSING_MS);
  };

  /* ── Public API through data-actions ── */
  modalEl.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    if (action === 'checkout-next') { e.preventDefault(); nextStep(); }
    if (action === 'checkout-back') { e.preventDefault(); backStep(); }
    if (action === 'checkout-pay')  { e.preventDefault(); processPayment(); }
  });

  /* ── Sync with store UI ── */
  subscribe('ui', (u) => {
    const wasOpen = modalEl.classList.contains('is-open');
    if (u.checkoutOpen && !wasOpen) {
      /* Reset on open */
      state = createState();
      errors = {};
      render();
      modalEl.classList.add('is-open');
      modalEl.setAttribute('aria-hidden', 'false');
    } else if (!u.checkoutOpen && wasOpen) {
      modalEl.classList.remove('is-open');
      modalEl.setAttribute('aria-hidden', 'true');
    }
  });
}
