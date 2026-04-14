/* ═══════════════════════════════════════════
   Utilidades DOM + formato + storage
   ═══════════════════════════════════════════ */

export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const el = (tag, attrs = {}, ...children) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class')      node.className = v;
    else if (k === 'html')  node.innerHTML = v;
    else if (k === 'data')  Object.entries(v).forEach(([dk, dv]) => node.dataset[dk] = dv);
    else if (k.startsWith('on')) node.addEventListener(k.slice(2).toLowerCase(), v);
    else                     node.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
};

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});
export const formatPrice = (n) => money.format(n);

export const starsHtml = (rating) => {
  const filled = Math.round(rating);
  let html = '';
  for (let i = 0; i < 5; i++) {
    const cls = `star${i < filled ? ' is-filled' : ''}`;
    html += `<i data-lucide="star" class="${cls}" aria-hidden="true"></i>`;
  }
  return html;
};

export const refreshIcons = () => {
  if (window.lucide?.createIcons) window.lucide.createIcons();
};

export const debounce = (fn, ms = 200) => {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
};

const STORAGE_KEY = 'techbox:cart';

export const loadCart = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {};
  } catch {
    return {};
  }
};

export const saveCart = (cart) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cart)); } catch { /* quota */ }
};

export const uid = () => Math.random().toString(36).slice(2, 10);
