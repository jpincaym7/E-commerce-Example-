/* ═══════════════════════════════════════════
   Toast — notificaciones efímeras
   ═══════════════════════════════════════════ */

import { el, $, uid, refreshIcons } from '../utils.js';

const typeIcons = {
  success: 'check-circle',
  info:    'zap',
  warning: 'shield-alert',
  danger:  'x-circle',
};

const DURATION = 3000;

let stack;

export function mountToastStack(container) {
  stack = container;
}

export function toast(message, type = 'success') {
  if (!stack) return;
  const id = uid();
  const node = el('div', {
    class: `toast toast--${type}`,
    role: 'status',
    'aria-live': 'polite',
    data: { id },
  },
    el('span', { class: 'toast__icon', html: `<i data-lucide="${typeIcons[type] ?? 'zap'}"></i>` }),
    el('div', { class: 'toast__body' }, message),
    el('button', {
      class: 'toast__close',
      type: 'button',
      'aria-label': 'Cerrar',
      onclick: () => remove(id),
    }, '×'),
  );
  stack.append(node);
  refreshIcons();
  setTimeout(() => remove(id), DURATION);
}

function remove(id) {
  const node = $(`.toast[data-id="${id}"]`, stack);
  if (!node) return;
  node.classList.add('is-leaving');
  node.addEventListener('animationend', () => node.remove(), { once: true });
}
