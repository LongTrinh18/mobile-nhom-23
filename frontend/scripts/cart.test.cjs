const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.join(__dirname, '..');

// Run the actual TS modules without adding a test runtime or writing compiled output.
function loader(mocks = {}) {
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const mod = new Module(file, module);
    cache.set(file, mod);
    mod.filename = file;
    mod.paths = module.paths;
    mod.require = name => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      if (name.startsWith('.')) {
        const stem = path.resolve(path.dirname(file), name);
        const target = ['.ts', '.tsx', '.js'].map(ext => stem + ext).find(f => fs.existsSync(f));
        return load(target ?? stem);
      }
      return require(name);
    };
    const result = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
      fileName: file,
    });
    mod._compile(result.outputText, file);
    return mod.exports;
  }
  return name => load(path.join(root, name));
}
const variant = { id: 'sku1', product_id: 'p1', sku: 'SHIRT-M', size: 'M', color_name: 'White',
  color_code: 'WHITE', is_active: true, product: { id: 'p1', code: 'SHIRT', name: 'Shirt', base_price: 200000, sale_price: 150000 } };
const row = { id: 'cart1', user_id: 'alice', variant_id: 'sku1', quantity: 2, added_at: '', variant };
const catalog = { source: 'supabase', branches: [{ id: 'b1', name: 'Store 1' }, { id: 'b2', name: 'Store 2' }],
  products: [{ id: 'p1', name: 'Shirt', imageUrl: 'image', variants: [{ id: 'sku1', productId: 'p1', sku: 'SHIRT-M', size: 'M', color: 'White' }], priceVnd: 150000 }],
  stock: [{ skuId: 'sku1', branchId: 'b1', quantity: 20 }, { skuId: 'sku1', branchId: 'b2', quantity: 1 }] };
const adapter = loader()('src/services/cart-adapter.ts');

test('server cart uses row IDs, server prices, one pickup branch, and the 10-item cap', () => {
  const first = adapter.hydrateCart([row], catalog, 'missing');
  assert.equal(first.branchId, 'b1');
  assert.equal(first.items[0].key, 'cart1');
  assert.equal(first.items[0].unitPriceVnd, 150000);
  assert.equal(first.items[0].maxAvailable, 10);
  const changed = adapter.hydrateCart([row], catalog, 'b2');
  assert.equal(changed.items[0].key, first.items[0].key);
  assert.equal(changed.items[0].quantity, 2);
  assert.equal(changed.items[0].maxAvailable, 1);
  assert.throws(() => adapter.validateOrderItems(changed.items), /tồn kho/);
});
test('RLS-hidden variants/products stay removable and cannot be ordered', () => {
  for (const unavailable of [{ ...row, variant: null }, { ...row, variant: { ...variant, product: null } }]) {
    const result = adapter.hydrateCart([unavailable], catalog, 'b1');
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].key, row.id);
    assert.equal(result.items[0].maxAvailable, 0);
    assert.throws(() => adapter.validateOrderItems(result.items));
  }
});
test('checkout rejects empty carts and mixed pickup branches', () => {
  assert.throws(() => adapter.validateOrderItems([]));
  const first = adapter.hydrateCart([row], catalog, 'b1').items[0];
  assert.throws(() => adapter.validateOrderItems([first, { ...first, branchId: 'b2' }]), /chi nhánh/);
});

// A small hook driver lets us exercise the provider against a stateful fake server.
// Effects, auth events and pending requests are controlled explicitly in each test.
function harness(initialOwner = 'alice') {
  let cursor = 0;
  const slots = [];
  let effects = [];
  let authCallback;
  const state = { owner: initialOwner, rows: { alice: [structuredClone(row)], bob: [] }, calls: [], failWrite: false,
    failLoad: false, failOrder: false, failAfterOrder: false, holdLoad: null };
  const equal = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const memo = (factory, deps) => {
    const i = cursor++;
    if (!slots[i] || !equal(slots[i].deps, deps)) slots[i] = { value: factory(), deps };
    return slots[i].value;
  };
  const react = {
    createContext: () => ({ Provider: 'provider' }),
    useState: initial => { const i = cursor++; if (!(i in slots)) slots[i] = initial;
      return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }]; },
    useRef: initial => { const i = cursor++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i]; },
    useCallback: (fn, deps) => memo(() => fn, deps),
    useEffect: (effect, deps) => { const i = cursor++; if (!slots[i] || !equal(slots[i].deps, deps)) {
      slots[i] = { deps }; effects.push(effect);
    } },
  };
  const api = {
    getCart: async () => {
      const rows = structuredClone(state.rows[state.owner] ?? []);
      if (state.holdLoad) await state.holdLoad;
      if (state.failLoad) throw new Error('Network unavailable');
      return rows;
    },
    addToCart: async (skuId, quantity) => {
      state.calls.push(['add', skuId, quantity]);
      if (state.failWrite) throw new Error('Write failed');
      const rows = state.rows[state.owner];
      const existing = rows.find(r => r.variant_id === skuId);
      if (existing) existing.quantity = Math.min(10, existing.quantity + quantity);
      else rows.push({ ...structuredClone(row), quantity });
    },
    setCartQuantity: async (id, quantity) => {
      state.calls.push(['quantity', id, quantity]);
      if (state.failWrite) throw new Error('Write failed');
      state.rows[state.owner].find(r => r.id === id).quantity = quantity;
    },
    removeFromCart: async id => {
      state.calls.push(['remove', id]);
      if (state.failWrite) throw new Error('Write failed');
      state.rows[state.owner] = state.rows[state.owner].filter(r => r.id !== id);
    },
    clearServerCart: async () => { state.calls.push(['clear']); state.rows[state.owner] = []; },
  };
  const supabase = { auth: {
    onAuthStateChange: callback => { authCallback = callback; return { data: { subscription: { unsubscribe() {} } } }; },
    getSession: async () => ({ data: { session: state.owner ? { user: { id: state.owner } } : null }, error: null }),
  } };
  const load = loader({ react, 'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) },
    '../lib/supabase': { supabase }, '../api/cartApi': api,
    '../services/catalog-service': { getCatalog: async () => structuredClone(catalog) },
    '../api/orderApi': { placeOrder: async input => {
      state.calls.push(['order', input]);
      if (state.failOrder) throw new Error('OUT_OF_STOCK');
      state.rows[state.owner] = [];
      if (state.failAfterOrder) state.failLoad = true;
      return { order_id: 'order1', order_code: 'DH-1', total_amount: 300000 };
    } },
  });
  const { CartProvider } = load('src/context/CartContext.tsx');
  function render() { cursor = 0; const tree = CartProvider({ children: null });
    const pending = effects; effects = []; pending.forEach(effect => effect()); return tree.props.value; }
  const settle = async () => { for (let i = 0; i < 4; i++) await new Promise(setImmediate); return render(); };
  render();
  return { state, render, settle, auth: owner => { state.owner = owner; authCallback('SIGNED_IN', owner ? { user: { id: owner } } : null); } };
}

test('signed-in cart loads, updates by row ID, changes branch, removes and clears on the server', async () => {
  const h = harness(); let cart = await h.settle();
  assert.equal(cart.count, 2);
  await cart.updateQuantity('cart1', 3);
  cart = h.render(); assert.equal(cart.count, 3);
  assert.deepEqual(h.state.calls[0], ['quantity', 'cart1', 3]);
  await cart.selectBranch('b2'); cart = h.render();
  assert.equal(cart.items[0].branchId, 'b2');
  assert.equal(cart.items[0].quantity, 3);
  await cart.removeItem('cart1'); cart = h.render(); assert.equal(cart.count, 0);
  await cart.addItem({ ...adapter.hydrateCart([row], catalog, 'b1').items[0] }, 1);
  cart = h.render(); assert.equal(cart.count, 1);
  await cart.clearCart(); assert.equal(h.render().count, 0);
  assert.deepEqual(h.state.rows.alice, []);
});
test('guest writes are refused and failed server writes preserve the existing cart', async () => {
  const guest = harness(null); let cart = await guest.settle();
  await assert.rejects(cart.clearCart(), /NOT_AUTHENTICATED/);
  assert.deepEqual(guest.state.calls, []);
  const h = harness(); cart = await h.settle(); h.state.failWrite = true;
  await assert.rejects(cart.updateQuantity('cart1', 3), /Write failed/);
  cart = h.render(); assert.equal(cart.count, 2); assert.match(cart.error, /Write failed/);
});
test('sign-out and account changes discard late cart responses, and signing back in restores server data', async () => {
  const h = harness(); let cart = await h.settle();
  let release;
  h.state.holdLoad = new Promise(resolve => { release = resolve; });
  const pending = cart.refresh();
  h.auth(null); cart = h.render(); assert.equal(cart.count, 0);
  release(); await assert.rejects(pending, /Tài khoản/);
  h.state.holdLoad = null;
  cart = await h.settle(); assert.equal(cart.count, 0);
  h.auth('bob'); cart = await h.settle(); assert.equal(cart.userId, 'bob'); assert.equal(cart.count, 0);
  h.auth('alice'); cart = await h.settle(); assert.equal(cart.count, 2);
});
test('checkout uses the RPC result, keeps cart on rejection, and does not delete again after success', async () => {
  const h = harness(); let cart = await h.settle(); h.state.failOrder = true;
  const customer = { customerName: 'Test', customerPhone: '0912345678' };
  await assert.rejects(cart.submitOrder(customer), /OUT_OF_STOCK/);
  cart = h.render(); assert.equal(cart.count, 2);
  h.state.failOrder = false;
  const order = await cart.submitOrder(customer);
  assert.deepEqual(order, { order_id: 'order1', order_code: 'DH-1', total_amount: 300000 });
  assert.equal(h.render().count, 0);
  assert.equal(h.state.calls.filter(call => call[0] === 'clear').length, 0);
  const input = h.state.calls.find(call => call[0] === 'order')[1];
  assert.equal(input.branchId, 'b1');
  assert.deepEqual(input.items, [{ variantId: 'sku1', quantity: 2 }]);
});
test('overlapping writes are rejected rather than submitting duplicate mutations', async () => {
  const h = harness(); const cart = await h.settle();
  let release;
  h.state.holdLoad = new Promise(resolve => { release = resolve; });
  const pending = cart.refresh();
  await assert.rejects(cart.clearCart(), /đang cập nhật/);
  release(); await pending;
  assert.equal(h.state.calls.length, 0);
});

test('reducing a cart above available stock remains possible without silently changing its quantity', async () => {
  const h = harness(); let cart = await h.settle();
  h.state.rows.alice[0].quantity = 8;
  await cart.selectBranch('b2'); cart = h.render();
  assert.equal(cart.items[0].maxAvailable, 1);
  await cart.updateQuantity('cart1', 7);
  assert.equal(h.render().count, 7);
  await assert.rejects(h.render().updateQuantity('cart1', 8), /tồn kho/);
});
test('a refresh failure after a committed order still returns success and preserves the real order code', async () => {
  const h = harness(); const cart = await h.settle(); h.state.failAfterOrder = true;
  const order = await cart.submitOrder({ customerName: 'Test', customerPhone: '0912345678' });
  assert.equal(order.order_code, 'DH-1');
  assert.equal(h.render().count, 0);
  assert.match(h.render().error, /Network unavailable/);
  assert.equal(h.state.calls.filter(call => call[0] === 'order').length, 1);
});

test('adding a branch-neutral SKU preserves the cart pickup branch and uses availability across active stores', async () => {
  const h = harness(); let cart = await h.settle();
  await cart.selectBranch('b2'); cart = h.render();
  await cart.addItem({ productId: 'p1', productName: 'Shirt', skuId: 'sku1', skuCode: 'SHIRT-M', size: 'M', color: 'White', unitPriceVnd: 150000 }, 1);
  cart = h.render();
  assert.equal(cart.branchId, 'b2');
  assert.equal(cart.count, 3);
  assert.equal(cart.items[0].maxAvailable, 1);
  assert.deepEqual(h.state.calls.find(call => call[0] === 'add'), ['add', 'sku1', 1]);
});
