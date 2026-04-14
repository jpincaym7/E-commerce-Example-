/* ═══════════════════════════════════════════
   Store pub/sub — estado único reactivo
   ═══════════════════════════════════════════ */

import { PRODUCTS, getProduct, PRICE_BUCKETS } from './data.js';
import { loadCart, saveCart } from './utils.js';

const listeners = new Map();

const state = {
  cart: loadCart(),
  filters: {
    category: 'all',
    brands: [],
    tags: [],
    priceBucket: 'all',
    sort: 'relevance',
    query: '',
  },
  ui: { cartOpen: false, sidebarOpen: false, quickView: null, checkoutOpen: false },
};

const emit = (key) => {
  (listeners.get(key) ?? []).forEach(fn => fn(state[key]));
};

export const subscribe = (key, fn) => {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key).add(fn);
  fn(state[key]);
  return () => listeners.get(key).delete(fn);
};

export const get = (key) => state[key];

/* ── Cart actions ── */
export const cart = {
  add(id, qty = 1) {
    const prod = getProduct(id);
    if (!prod) return;
    const current = state.cart[id] ?? 0;
    state.cart = { ...state.cart, [id]: Math.min(current + qty, prod.stock) };
    saveCart(state.cart);
    emit('cart');
  },
  setQty(id, qty) {
    const prod = getProduct(id);
    if (!prod) return;
    const clamped = Math.max(0, Math.min(qty, prod.stock));
    const next = { ...state.cart };
    if (clamped === 0) delete next[id];
    else next[id] = clamped;
    state.cart = next;
    saveCart(state.cart);
    emit('cart');
  },
  remove(id) {
    const next = { ...state.cart };
    delete next[id];
    state.cart = next;
    saveCart(state.cart);
    emit('cart');
  },
  clear() {
    state.cart = {};
    saveCart(state.cart);
    emit('cart');
  },
  items() {
    return Object.entries(state.cart)
      .map(([id, qty]) => ({ product: getProduct(id), qty }))
      .filter(i => i.product);
  },
  count() {
    return Object.values(state.cart).reduce((a, b) => a + b, 0);
  },
  subtotal() {
    return this.items().reduce((a, { product, qty }) => a + product.price * qty, 0);
  },
};

/* ── Filters ── */
const toggleInArray = (arr, value) =>
  arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value];

export const filters = {
  set(patch) {
    state.filters = { ...state.filters, ...patch };
    emit('filters');
  },
  setCategory(id) {
    this.set({ category: id });
  },
  toggleBrand(brand) {
    this.set({ brands: toggleInArray(state.filters.brands, brand) });
  },
  toggleTag(tag) {
    this.set({ tags: toggleInArray(state.filters.tags, tag) });
  },
  setPrice(bucketId) {
    this.set({ priceBucket: bucketId });
  },
  clear() {
    state.filters = {
      category: 'all',
      brands: [],
      tags: [],
      priceBucket: 'all',
      sort: state.filters.sort,
      query: '',
    };
    emit('filters');
  },
  activeCount() {
    const f = state.filters;
    let n = 0;
    if (f.category !== 'all') n++;
    n += f.brands.length;
    n += f.tags.length;
    if (f.priceBucket !== 'all') n++;
    if (f.query.trim()) n++;
    return n;
  },
  apply() {
    const { category, brands, tags, priceBucket, sort, query } = state.filters;
    const bucket = PRICE_BUCKETS.find(b => b.id === priceBucket);

    let list = PRODUCTS.filter(p => {
      if (category !== 'all' && p.category !== category) return false;
      if (brands.length && !brands.includes(p.brand)) return false;
      if (tags.length && !tags.some(t => p.badges.includes(t))) return false;
      if (bucket && bucket.test && !bucket.test(p.price)) return false;
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        if (!p.name.toLowerCase().includes(q) && !p.brand.toLowerCase().includes(q)) return false;
      }
      return true;
    });

    const sorters = {
      'price-asc':  (a, b) => a.price - b.price,
      'price-desc': (a, b) => b.price - a.price,
      'rating':     (a, b) => b.rating - a.rating,
      'newest':     (a, b) => Number(b.badges.includes('new')) - Number(a.badges.includes('new')),
      'relevance':  () => 0,
    };
    return [...list].sort(sorters[sort] ?? (() => 0));
  },
};

/* ── UI actions ── */
export const ui = {
  openCart()     { state.ui = { ...state.ui, cartOpen: true  }; emit('ui'); },
  closeCart()    { state.ui = { ...state.ui, cartOpen: false }; emit('ui'); },
  openSidebar()  { state.ui = { ...state.ui, sidebarOpen: true  }; emit('ui'); },
  closeSidebar() { state.ui = { ...state.ui, sidebarOpen: false }; emit('ui'); },
  openQuick(id)  { state.ui = { ...state.ui, quickView: id }; emit('ui'); },
  closeQuick()   { state.ui = { ...state.ui, quickView: null }; emit('ui'); },
  openCheckout() { state.ui = { ...state.ui, checkoutOpen: true, cartOpen: false }; emit('ui'); },
  closeCheckout(){ state.ui = { ...state.ui, checkoutOpen: false }; emit('ui'); },
  closeAny() {
    if (state.ui.checkoutOpen) return this.closeCheckout();
    if (state.ui.quickView)    return this.closeQuick();
    if (state.ui.sidebarOpen)  return this.closeSidebar();
    if (state.ui.cartOpen)     return this.closeCart();
  },
};
